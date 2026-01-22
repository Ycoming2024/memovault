/**
 * MemoVault 加密层
 * 基于 Web Crypto API
 * 
 * 核心原则：
 * 1. 所有数据在客户端加密后再发送到服务器
 * 2. 服务器对数据内容"零知悉"
 * 3. 密钥永不离开客户端内存（除了加密后的私钥）
 */

import type {
  EncryptionConfig,
  EncryptedData,
  PBKDF2Config,
} from '@/types/schema';

// ============================================================================
// 配置常量
// ============================================================================

const ENCRYPTION_CONFIG: EncryptionConfig = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
};

const PBKDF2_CONFIG: PBKDF2Config = {
  iterations: 600000, // OWASP 推荐值
  hash: 'SHA-256',
  saltLength: 32,
};

// ============================================================================
// 密钥派生 (PBKDF2)
// ============================================================================

/**
 * 从密码派生主密钥
 * 
 * @param password - 用户密码
 * @param salt - 盐值（如果没有提供，会随机生成）
 * @returns 派生的密钥和盐值
 */
export async function deriveKeyFromPassword(
  password: string,
  salt?: Uint8Array
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  try {
    // 如果没有提供盐值，生成随机盐
    const keySalt = salt || crypto.getRandomValues(new Uint8Array(PBKDF2_CONFIG.saltLength));

    // 将密码编码为字节
    const passwordEncoder = new TextEncoder();
    const passwordData = passwordEncoder.encode(password);

    // 导入密码作为密钥材料
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // 派生主密钥
    const masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: keySalt.buffer as ArrayBuffer,
        iterations: PBKDF2_CONFIG.iterations,
        hash: PBKDF2_CONFIG.hash,
      },
      passwordKey,
      {
        name: 'AES-GCM',
        length: ENCRYPTION_CONFIG.keyLength,
      },
      false, // 密钥不可导出
      ['encrypt', 'decrypt']
    );

    return { key: masterKey, salt: keySalt };
  } catch (error) {
    console.error('[Crypto] Error deriving key from password:', error);
    throw new Error('Failed to derive key from password');
  }
}

/**
 * 从密码派生认证哈希（用于服务器验证）
 * 
 * @param password - 用户密码
 * @param salt - 盐值
 * @returns 认证哈希（Hex 字符串）
 */
export async function deriveAuthHash(
  password: string,
  salt: Uint8Array
): Promise<string> {
  try {
    const passwordEncoder = new TextEncoder();
    const passwordData = passwordEncoder.encode(password);

    const passwordKey = await crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    // 派生原始位
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: PBKDF2_CONFIG.iterations,
        hash: PBKDF2_CONFIG.hash,
      },
      passwordKey,
      256 // 256 位
    );

    // 转换为 Hex 字符串
    return bufferToHex(new Uint8Array(derivedBits));
  } catch (error) {
    console.error('[Crypto] Error deriving auth hash:', error);
    throw new Error('Failed to derive auth hash');
  }
}

// ============================================================================
// 加密/解密 (AES-GCM)
// ============================================================================

/**
 * 加密数据
 * 
 * @param data - 要加密的数据（字符串或 ArrayBuffer）
 * @param key - 加密密钥
 * @returns 加密结果（密文 + IV）
 */
export async function encryptData(
  data: string | ArrayBuffer,
  key: CryptoKey
): Promise<EncryptedData> {
  try {
    // 生成随机初始化向量
    const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));

    // 准备数据
    let dataBytes: Uint8Array;
    if (typeof data === 'string') {
      const encoder = new TextEncoder();
      dataBytes = encoder.encode(data);
    } else {
      dataBytes = new Uint8Array(data);
    }

    // 加密
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv.buffer as ArrayBuffer,
      },
      key,
      dataBytes.buffer as ArrayBuffer
    );

    return {
      ciphertext: new Uint8Array(ciphertext),
      iv: iv,
    };
  } catch (error) {
    console.error('[Crypto] Error encrypting data:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * 解密数据
 * 
 * @param encryptedData - 加密的数据（密文 + IV）
 * @param key - 解密密钥
 * @param asString - 是否返回字符串（默认 true）
 * @returns 解密后的数据
 */
export async function decryptData(
  encryptedData: EncryptedData,
  key: CryptoKey,
  asString: boolean = true
): Promise<string | Uint8Array> {
  try {
    // 解密
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: encryptedData.iv.buffer as ArrayBuffer,
      },
      key,
      encryptedData.ciphertext.buffer as ArrayBuffer
    );

    const decryptedBytes = new Uint8Array(decrypted);

    if (asString) {
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBytes);
    }

    return decryptedBytes;
  } catch (error) {
    console.error('[Crypto] Error decrypting data:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * 加密字符串并返回 Base64 编码的结果
 */
export async function encryptToBase64(
  data: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encrypted = await encryptData(data, key);
  return {
    ciphertext: bufferToBase64(encrypted.ciphertext),
    iv: bufferToBase64(encrypted.iv),
  };
}

/**
 * 从 Base64 解密字符串
 */
export async function decryptFromBase64(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const encryptedData: EncryptedData = {
    ciphertext: base64ToBuffer(ciphertext),
    iv: base64ToBuffer(iv),
  };

  const decrypted = await decryptData(encryptedData, key, true);
  return decrypted as string;
}

// ============================================================================
// 文件加密/解密
// ============================================================================

/**
 * 加密文件
 * 
 * @param file - File 对象
 * @param key - 加密密钥
 * @returns 加密后的文件数据（ArrayBuffer）和 IV
 */
export async function encryptFile(
  file: File,
  key: CryptoKey
): Promise<{ encryptedData: ArrayBuffer; iv: Uint8Array; checksum: string }> {
  try {
    const fileBuffer = await file.arrayBuffer();
    const encrypted = await encryptData(fileBuffer, key);
    const checksum = await calculateChecksum(fileBuffer);

    return {
      encryptedData: encrypted.ciphertext.buffer as ArrayBuffer,
      iv: encrypted.iv,
      checksum,
    };
  } catch (error) {
    console.error('[Crypto] Error encrypting file:', error);
    throw new Error('Failed to encrypt file');
  }
}

/**
 * 解密文件
 * 
 * @param encryptedData - 加密的文件数据
 * @param iv - 初始化向量
 * @param key - 解密密钥
 * @returns 解密后的文件数据（ArrayBuffer）
 */
export async function decryptFile(
  encryptedData: ArrayBuffer,
  iv: Uint8Array,
  key: CryptoKey
): Promise<ArrayBuffer> {
  try {
    const encrypted: EncryptedData = {
      ciphertext: new Uint8Array(encryptedData),
      iv: iv,
    };

    const decrypted = await decryptData(encrypted, key, false);
    return (decrypted as Uint8Array).buffer as ArrayBuffer;
  } catch (error) {
    console.error('[Crypto] Error decrypting file:', error);
    throw new Error('Failed to decrypt file');
  }
}

// ============================================================================
// 密钥对生成（用于共享功能）
// ============================================================================

/**
 * 生成 RSA-OAEP 密钥对
 * 用于加密共享给其他用户的私钥
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: CryptoKey;
}> {
  try {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true, // 私钥可导出（用于加密后存储）
      ['encrypt', 'decrypt']
    );

    // 导出公钥为 Base64
    const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKey = bufferToBase64(new Uint8Array(publicKeyBuffer));

    return {
      publicKey,
      privateKey: keyPair.privateKey as CryptoKey,
    };
  } catch (error) {
    console.error('[Crypto] Error generating key pair:', error);
    throw new Error('Failed to generate key pair');
  }
}

/**
 * 使用公钥加密数据
 */
export async function encryptWithPublicKey(
  data: string,
  publicKeyBase64: string
): Promise<string> {
  try {
    // 导入公钥
    const publicKeyBuffer = base64ToBuffer(publicKeyBase64);
    const publicKey = await crypto.subtle.importKey(
      'spki',
      publicKeyBuffer.buffer as ArrayBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['encrypt']
    );

    // 加密
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      publicKey,
      dataBytes.buffer as ArrayBuffer
    );

    return bufferToBase64(new Uint8Array(encrypted));
  } catch (error) {
    console.error('[Crypto] Error encrypting with public key:', error);
    throw new Error('Failed to encrypt with public key');
  }
}

/**
 * 使用私钥解密数据
 */
export async function decryptWithPrivateKey(
  encryptedData: string,
  privateKey: CryptoKey
): Promise<string> {
  try {
    const encryptedBytes = base64ToBuffer(encryptedData);
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      privateKey,
      encryptedBytes.buffer as ArrayBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('[Crypto] Error decrypting with private key:', error);
    throw new Error('Failed to decrypt with private key');
  }
}

/**
 * 导出私钥（加密后存储）
 */
export async function exportPrivateKey(
  privateKey: CryptoKey,
  encryptionKey: CryptoKey
): Promise<string> {
  try {
    const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', privateKey);
    const encrypted = await encryptData(privateKeyBuffer, encryptionKey);
    return bufferToBase64(encrypted.ciphertext) + '.' + bufferToBase64(encrypted.iv);
  } catch (error) {
    console.error('[Crypto] Error exporting private key:', error);
    throw new Error('Failed to export private key');
  }
}

/**
 * 导入私钥
 */
export async function importPrivateKey(
  encryptedPrivateKey: string,
  encryptionKey: CryptoKey
): Promise<CryptoKey> {
  try {
    const [ciphertextBase64, ivBase64] = encryptedPrivateKey.split('.');
    const encrypted: EncryptedData = {
      ciphertext: base64ToBuffer(ciphertextBase64),
      iv: base64ToBuffer(ivBase64),
    };

    const decrypted = await decryptData(encrypted, encryptionKey, false);
    const privateKeyBuffer = (decrypted as Uint8Array).buffer as ArrayBuffer;

    return await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      true,
      ['decrypt']
    );
  } catch (error) {
    console.error('[Crypto] Error importing private key:', error);
    throw new Error('Failed to import private key');
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 计算数据的 SHA-256 校验和
 */
export async function calculateChecksum(data: ArrayBuffer): Promise<string> {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return bufferToHex(new Uint8Array(hashBuffer));
  } catch (error) {
    console.error('[Crypto] Error calculating checksum:', error);
    throw new Error('Failed to calculate checksum');
  }
}

/**
 * 将 ArrayBuffer 转换为 Hex 字符串
 */
function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 将 ArrayBuffer 转换为 Base64 字符串
 */
function bufferToBase64(buffer: Uint8Array): string {
  const binary = String.fromCharCode(...buffer);
  return btoa(binary);
}

/**
 * 将 Base64 字符串转换为 ArrayBuffer
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 生成随机 ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// 密钥管理类（内存中的密钥存储）
// ============================================================================

class KeyManager {
  private masterKey: CryptoKey | null = null;
  private privateKey: CryptoKey | null = null;

  /**
   * 设置主密钥
   */
  setMasterKey(key: CryptoKey): void {
    this.masterKey = key;
  }

  /**
   * 获取主密钥
   */
  getMasterKey(): CryptoKey | null {
    return this.masterKey;
  }

  /**
   * 设置私钥
   */
  setPrivateKey(key: CryptoKey): void {
    this.privateKey = key;
  }

  /**
   * 获取私钥
   */
  getPrivateKey(): CryptoKey | null {
    return this.privateKey;
  }

  /**
   * 清除所有密钥（登出时调用）
   */
  clear(): void {
    this.masterKey = null;
    this.privateKey = null;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.masterKey !== null;
  }
}

// 导出单例实例
export const keyManager = new KeyManager();
