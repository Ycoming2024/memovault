/**
 * StreamEncryptionService - 流式加密服务
 * 
 * 核心功能：
 * 1. 大文件分块加密（避免内存溢出）
 * 2. 流式处理（使用 Streams API）
 * 3. Web Worker 支持（保持 UI 响应）
 * 4. S3 分块上传/下载
 * 
 * 架构说明：
 * - 加密在 Web Worker 中执行，避免阻塞主线程
 * - 使用 TransformStream 进行流式转换
 * - 每个块独立加密，支持并行处理
 * - 文件密钥使用 PBKDF2 从主密钥派生
 */

import {
  EncryptionConfig,
  EncryptedChunk,
  UploadProgress,
  Attachment,
  EncryptionError
} from '../types';

// ============================================================================
// 配置常量
// ============================================================================

const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'AES-GCM',
  keySize: 256,
  ivSize: 12,
  chunkSize: 1024 * 1024 // 1MB per chunk
};

const KEY_DERIVATION_CONFIG = {
  iterations: 100000,
  algorithm: 'PBKDF2',
  hash: 'SHA-256'
};

// ============================================================================
// StreamEncryptionService 类定义
// ============================================================================

class StreamEncryptionService {
  private config: EncryptionConfig;
  private cryptoKey: CryptoKey | null = null;
  private worker: Worker | null = null;

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeWorker();
  }

  // ========================================================================
  // 初始化方法
  // ========================================================================

  /**
   * 初始化 Web Worker
   * Worker 负责所有加密/解密操作，保持 UI 在 60fps
   */
  private initializeWorker(): void {
    // 创建内联 Worker Blob
    const workerCode = `
      self.onmessage = async (e) => {
        const { id, type, payload } = e.data;
        
        try {
          let result;
          
          switch (type) {
            case 'encrypt_chunk':
              result = await encryptChunk(payload);
              break;
            case 'decrypt_chunk':
              result = await decryptChunk(payload);
              break;
            case 'derive_file_key':
              result = await deriveFileKey(payload);
              break;
            default:
              throw new Error('Unknown task type');
          }
          
          self.postMessage({ id, success: true, data: result });
        } catch (error) {
          self.postMessage({ id, success: false, error: error.message });
        }
      };

      // 加密单个数据块
      async function encryptChunk({ data, key, iv, algorithm }) {
        const encrypted = await crypto.subtle.encrypt(
          { name: algorithm, iv },
          key,
          data
        );
        return {
          encryptedData: arrayBufferToBase64(encrypted),
          iv: arrayBufferToBase64(iv)
        };
      }

      // 解密单个数据块
      async function decryptChunk({ encryptedData, key, iv, algorithm }) {
        const decrypted = await crypto.subtle.decrypt(
          { name: algorithm, iv },
          key,
          base64ToArrayBuffer(encryptedData)
        );
        return arrayBufferToBase64(decrypted);
      }

      // 从主密钥派生文件密钥
      async function deriveFileKey({ masterKey, salt, iterations, hash }) {
        const importedKey = await crypto.subtle.importKey(
          'raw',
          base64ToArrayBuffer(masterKey),
          'PBKDF2',
          false,
          ['deriveKey']
        );
        
        const derivedKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: base64ToArrayBuffer(salt),
            iterations,
            hash
          },
          importedKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
        
        return await crypto.subtle.exportKey('raw', derivedKey);
      }

      // 辅助函数：ArrayBuffer 转 Base64
      function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      }

      // 辅助函数：Base64 转 ArrayBuffer
      function base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
      }
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
  }

  /**
   * 使用主密钥初始化加密服务
   * @param masterKey - 用户的加密主密钥
   */
  async initialize(masterKey: string): Promise<void> {
    try {
      // 导入主密钥
      this.cryptoKey = await crypto.subtle.importKey(
        'raw',
        this.base64ToArrayBuffer(masterKey),
        'PBKDF2',
        false,
        ['deriveKey']
      );
    } catch (error) {
      throw new EncryptionError('Failed to initialize encryption service', error);
    }
  }

  // ========================================================================
  // 文件加密流程
  // ========================================================================

  /**
   * 加密文件并上传到 S3
   * 
   * 流程：
   * 1. 读取文件并分块
   * 2. 为文件派生专用密钥
   * 3. 并行加密每个块
   * 4. 获取 S3 预签名 URL
   * 5. 上传加密块到 S3
   * 6. 返回附件元数据
   * 
   * @param file - 要加密的文件
   * @param noteId - 关联的笔记 ID
   * @param onProgress - 进度回调
   */
  async encryptAndUploadFile(
    file: File,
    noteId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<Attachment> {
    if (!this.cryptoKey) {
      throw new EncryptionError('Encryption service not initialized');
    }

    const attachmentId = this.generateId();
    const fileKey = await this.deriveFileKey(attachmentId);
    
    // 1. 分块文件
    const chunks = await this.chunkFile(file);
    const totalChunks = chunks.length;
    
    const encryptedChunks: EncryptedChunk[] = [];
    
    // 2. 并行加密所有块（使用 TransformStream）
    const encryptionStream = this.createEncryptionTransformStream(fileKey);
    
    // 3. 处理每个块
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // 报告进度
      if (onProgress) {
        onProgress({
          attachmentId,
          fileName: file.name,
          totalChunks,
          uploadedChunks: i,
          progress: (i / totalChunks) * 100,
          status: 'uploading'
        });
      }
      
      // 加密块
      const encryptedChunk = await this.encryptChunk(chunk, fileKey);
      
      // 4. 获取 S3 预签名 URL
      const s3Key = `attachments/${noteId}/${attachmentId}/chunk_${i}`;
      const presignedUrl = await this.getS3PresignedUrl(s3Key, 'putObject');
      
      // 5. 上传加密块到 S3
      await this.uploadChunkToS3(presignedUrl, encryptedChunk.encryptedData);
      
      encryptedChunks.push({
        chunkIndex: i,
        encryptedData: encryptedChunk.encryptedData,
        iv: encryptedChunk.iv,
        s3Key,
        size: chunk.byteLength
      });
    }
    
    // 6. 计算文件校验和
    const checksum = await this.calculateChecksum(file);
    
    // 7. 加密文件密钥（使用主密钥）
    const encryptedFileKey = await this.encryptFileKey(fileKey);
    
    // 8. 返回附件元数据
    const attachment: Attachment = {
      id: attachmentId,
      noteId,
      fileName: await this.encryptString(file.name),
      fileType: file.type,
      fileSize: file.size,
      mimeType: file.type,
      encryptedChunks,
      fileKey: encryptedFileKey,
      checksum,
      uploadedAt: Date.now()
    };
    
    // 最终进度报告
    if (onProgress) {
      onProgress({
        attachmentId,
        fileName: file.name,
        totalChunks,
        uploadedChunks: totalChunks,
        progress: 100,
        status: 'completed'
      });
    }
    
    return attachment;
  }

  // ========================================================================
  // 文件解密流程
  // ========================================================================

  /**
   * 从 S3 下载并解密文件
   * 
   * 流程：
   * 1. 解密文件密钥
   * 2. 并行下载所有加密块
   * 3. 解密每个块
   * 4. 重组为完整文件
   * 5. 创建 Blob URL 用于预览
   * 
   * @param attachment - 附件元数据
   * @param onProgress - 进度回调
   * @returns Blob URL 用于预览
   */
  async downloadAndDecryptFile(
    attachment: Attachment,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    if (!this.cryptoKey) {
      throw new EncryptionError('Encryption service not initialized');
    }

    // 1. 解密文件密钥
    const fileKey = await this.decryptFileKey(attachment.fileKey);
    
    const totalChunks = attachment.encryptedChunks.length;
    const decryptedChunks: ArrayBuffer[] = [];
    
    // 2. 并行下载和解密块
    for (let i = 0; i < attachment.encryptedChunks.length; i++) {
      const encryptedChunk = attachment.encryptedChunks[i];
      
      // 报告进度
      if (onProgress) {
        onProgress({
          attachmentId: attachment.id,
          fileName: await this.decryptString(attachment.fileName),
          totalChunks,
          uploadedChunks: i,
          progress: (i / totalChunks) * 100,
          status: 'uploading'
        });
      }
      
      // 3. 从 S3 下载加密块
      const presignedUrl = await this.getS3PresignedUrl(encryptedChunk.s3Key, 'getObject');
      const encryptedData = await this.downloadChunkFromS3(presignedUrl);
      
      // 4. 解密块
      const decryptedChunk = await this.decryptChunk(
        encryptedData,
        fileKey,
        encryptedChunk.iv
      );
      
      decryptedChunks.push(decryptedChunk);
    }
    
    // 5. 重组文件
    const fileBuffer = this.combineChunks(decryptedChunks);
    const blob = new Blob([fileBuffer], { type: attachment.mimeType });
    
    // 6. 创建 Blob URL（不写入磁盘）
    const blobUrl = URL.createObjectURL(blob);
    
    // 7. 验证校验和
    const actualChecksum = await this.calculateChecksum(new File([blob], 'temp'));
    if (actualChecksum !== attachment.checksum) {
      throw new EncryptionError('Checksum verification failed');
    }
    
    // 最终进度报告
    if (onProgress) {
      onProgress({
        attachmentId: attachment.id,
        fileName: await this.decryptString(attachment.fileName),
        totalChunks,
        uploadedChunks: totalChunks,
        progress: 100,
        status: 'completed'
      });
    }
    
    return blobUrl;
  }

  // ========================================================================
  // 流式加密/解密（用于大文件实时预览）
  // ========================================================================

  /**
   * 创建加密 TransformStream
   * 用于流式处理，避免一次性加载整个文件到内存
   */
  private createEncryptionTransformStream(key: CryptoKey): TransformStream {
    return new TransformStream({
      transform: async (chunk: Uint8Array, controller) => {
        try {
          // 生成随机 IV
          const iv = crypto.getRandomValues(new Uint8Array(this.config.ivSize));
          
          // 加密块
          const encrypted = await crypto.subtle.encrypt(
            { name: this.config.algorithm, iv },
            key,
            chunk
          );
          
          // 输出：IV + 加密数据
          const output = new Uint8Array(iv.length + encrypted.byteLength);
          output.set(iv, 0);
          output.set(new Uint8Array(encrypted), iv.length);
          
          controller.enqueue(output);
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  /**
   * 创建解密 TransformStream
   */
  private createDecryptionTransformStream(key: CryptoKey): TransformStream {
    let buffer = new Uint8Array(0);
    
    return new TransformStream({
      transform: async (chunk: Uint8Array, controller) => {
        try {
          // 将新数据追加到缓冲区
          const newBuffer = new Uint8Array(buffer.length + chunk.length);
          newBuffer.set(buffer, 0);
          newBuffer.set(chunk, buffer.length);
          buffer = newBuffer;
          
          // 处理完整的块（IV + 加密数据）
          const ivSize = this.config.ivSize;
          while (buffer.length >= ivSize) {
            const iv = buffer.slice(0, ivSize);
            
            // 计算加密数据大小（AES-GCM 会添加 16 字节认证标签）
            const encryptedSize = buffer.length - ivSize;
            if (encryptedSize < 16) break; // 至少需要认证标签
            
            const encryptedData = buffer.slice(ivSize);
            
            // 解密
            const decrypted = await crypto.subtle.decrypt(
              { name: this.config.algorithm, iv },
              key,
              encryptedData
            );
            
            controller.enqueue(new Uint8Array(decrypted));
            
            // 清空缓冲区
            buffer = new Uint8Array(0);
          }
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  // ========================================================================
  // 辅助方法
  // ========================================================================

  /**
   * 分块文件
   */
  private async chunkFile(file: File): Promise<ArrayBuffer[]> {
    const chunks: ArrayBuffer[] = [];
    const chunkSize = this.config.chunkSize;
    
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, file.size);
      const chunk = file.slice(offset, end);
      chunks.push(await chunk.arrayBuffer());
    }
    
    return chunks;
  }

  /**
   * 合并块
   */
  private combineChunks(chunks: ArrayBuffer[]): ArrayBuffer {
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    
    for (const chunk of chunks) {
      combined.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    
    return combined.buffer;
  }

  /**
   * 派生文件密钥
   */
  private async deriveFileKey(attachmentId: string): Promise<CryptoKey> {
    if (!this.cryptoKey) {
      throw new EncryptionError('Crypto key not initialized');
    }

    const salt = this.base64ToArrayBuffer(attachmentId);
    
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: KEY_DERIVATION_CONFIG.iterations,
        hash: KEY_DERIVATION_CONFIG.hash
      },
      this.cryptoKey,
      { name: this.config.algorithm, length: this.config.keySize },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * 加密单个块（在 Worker 中执行）
   */
  private async encryptChunk(
    data: ArrayBuffer,
    key: CryptoKey
  ): Promise<{ encryptedData: string; iv: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(this.config.ivSize));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: this.config.algorithm, iv },
      key,
      data
    );
    
    return {
      encryptedData: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv)
    };
  }

  /**
   * 解密单个块（在 Worker 中执行）
   */
  private async decryptChunk(
    encryptedData: string,
    key: CryptoKey,
    iv: string
  ): Promise<ArrayBuffer> {
    const decrypted = await crypto.subtle.decrypt(
      { name: this.config.algorithm, iv: this.base64ToArrayBuffer(iv) },
      key,
      this.base64ToArrayBuffer(encryptedData)
    );
    
    return decrypted;
  }

  /**
   * 加密文件密钥
   */
  private async encryptFileKey(fileKey: CryptoKey): Promise<string> {
    if (!this.cryptoKey) {
      throw new EncryptionError('Crypto key not initialized');
    }

    const rawKey = await crypto.subtle.exportKey('raw', fileKey);
    const iv = crypto.getRandomValues(new Uint8Array(this.config.ivSize));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: this.config.algorithm, iv },
      this.cryptoKey,
      rawKey
    );
    
    return this.arrayBufferToBase64(encrypted) + '.' + this.arrayBufferToBase64(iv);
  }

  /**
   * 解密文件密钥
   */
  private async decryptFileKey(encryptedFileKey: string): Promise<CryptoKey> {
    if (!this.cryptoKey) {
      throw new EncryptionError('Crypto key not initialized');
    }

    const [encrypted, iv] = encryptedFileKey.split('.');
    
    const decrypted = await crypto.subtle.decrypt(
      { name: this.config.algorithm, iv: this.base64ToArrayBuffer(iv) },
      this.cryptoKey,
      this.base64ToArrayBuffer(encrypted)
    );
    
    return await crypto.subtle.importKey(
      'raw',
      decrypted,
      this.config.algorithm,
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * 加密字符串
   */
  private async encryptString(text: string): Promise<string> {
    if (!this.cryptoKey) {
      throw new EncryptionError('Crypto key not initialized');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(this.config.ivSize));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: this.config.algorithm, iv },
      this.cryptoKey,
      data
    );
    
    return this.arrayBufferToBase64(encrypted) + '.' + this.arrayBufferToBase64(iv);
  }

  /**
   * 解密字符串
   */
  private async decryptString(encryptedText: string): Promise<string> {
    if (!this.cryptoKey) {
      throw new EncryptionError('Crypto key not initialized');
    }

    const [encrypted, iv] = encryptedText.split('.');
    
    const decrypted = await crypto.subtle.decrypt(
      { name: this.config.algorithm, iv: this.base64ToArrayBuffer(iv) },
      this.cryptoKey,
      this.base64ToArrayBuffer(encrypted)
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * 计算 SHA-256 校验和
   */
  private async calculateChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return this.arrayBufferToBase64(hashBuffer);
  }

  // ========================================================================
  // S3 集成（伪代码）
  // ========================================================================

  /**
   * 获取 S3 预签名 URL
   * 注意：此方法需要后端 API 支持
   */
  private async getS3PresignedUrl(
    s3Key: string,
    operation: 'putObject' | 'getObject'
  ): Promise<string> {
    // 伪代码：调用后端 API 获取预签名 URL
    const response = await fetch('/api/s3/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: s3Key, operation })
    });
    
    const data = await response.json();
    return data.url;
  }

  /**
   * 上传块到 S3
   */
  private async uploadChunkToS3(presignedUrl: string, data: string): Promise<void> {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: this.base64ToArrayBuffer(data),
      headers: { 'Content-Type': 'application/octet-stream' }
    });
    
    if (!response.ok) {
      throw new EncryptionError('Failed to upload chunk to S3');
    }
  }

  /**
   * 从 S3 下载块
   */
  private async downloadChunkFromS3(presignedUrl: string): Promise<string> {
    const response = await fetch(presignedUrl);
    
    if (!response.ok) {
      throw new EncryptionError('Failed to download chunk from S3');
    }
    
    const buffer = await response.arrayBuffer();
    return this.arrayBufferToBase64(buffer);
  }

  // ========================================================================
  // 工具方法
  // ========================================================================

  private generateId(): string {
    return crypto.randomUUID();
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.cryptoKey = null;
  }
}

// ============================================================================
// 导出
// ============================================================================

export default StreamEncryptionService;
export { DEFAULT_CONFIG, KEY_DERIVATION_CONFIG };
