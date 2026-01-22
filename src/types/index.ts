/**
 * MemoVault Phase 2 - Type Definitions
 * 知识图谱、文件附件和向量搜索的类型定义
 */

// ============================================================================
// Core Note Types (基础笔记类型)
// ============================================================================

/**
 * 笔记实体 - 支持双向链接和附件
 */
export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  attachments: Attachment[];
  forwardLinks: LinkReference[];
  backlinks: LinkReference[]; // 自动维护的反向链接
  embedding?: Float32Array; // 向量嵌入（用于语义搜索）
  tags: string[];
  isDeleted: boolean;
  version: number;
}

/**
 * 链接引用 - 用于双向链接
 */
export interface LinkReference {
  targetNoteId: string;
  targetNoteTitle: string; // 加密存储
  context: string; // 链接周围的上下文（加密）
  position: {
    start: number;
    end: number;
  };
  createdAt: number;
}

/**
 * WikiLink 语法解析结果
 */
export interface WikiLink {
  text: string; // 原始文本，如 [[Some Note]]
  targetId?: string; // 如果已解析为具体笔记ID
  alias?: string; // 可选的别名，如 [[Some Note|别名]]
  position: {
    start: number;
    end: number;
  };
}

// ============================================================================
// Attachment Types (附件类型)
// ============================================================================

/**
 * 文件附件元数据
 */
export interface Attachment {
  id: string;
  noteId: string;
  fileName: string; // 加密存储
  fileType: string;
  fileSize: number;
  mimeType: string;
  encryptedChunks: EncryptedChunk[];
  fileKey: string; // 加密的文件密钥
  checksum: string; // 用于完整性验证
  uploadedAt: number;
}

/**
 * 加密的文件块
 */
export interface EncryptedChunk {
  chunkIndex: number;
  encryptedData: string; // Base64编码的加密数据
  iv: string; // 初始化向量
  s3Key: string; // S3存储路径
  size: number;
}

/**
 * 文件上传状态
 */
export interface UploadProgress {
  attachmentId: string;
  fileName: string;
  totalChunks: number;
  uploadedChunks: number;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

// ============================================================================
// Encryption Types (加密类型)
// ============================================================================

/**
 * 加密配置
 */
export interface EncryptionConfig {
  algorithm: 'AES-GCM' | 'AES-CTR';
  keySize: 128 | 192 | 256;
  ivSize: number;
  chunkSize: number; // 文件分块大小（字节）
}

/**
 * 密钥派生参数
 */
export interface KeyDerivationParams {
  salt: string;
  iterations: number;
  algorithm: 'PBKDF2' | 'HKDF';
  hash: 'SHA-256' | 'SHA-384' | 'SHA-512';
}

/**
 * 加密的数据包
 */
export interface EncryptedData {
  data: string; // Base64编码的加密数据
  iv: string; // 初始化向量
  keyDerivation: KeyDerivationParams;
  algorithm: string;
}

// ============================================================================
// Knowledge Graph Types (知识图谱类型)
// ============================================================================

/**
 * 图节点 - 用于可视化
 */
export interface GraphNode {
  id: string;
  title: string; // 解密后的标题（仅用于客户端渲染）
  size: number; // 基于链接数量
  color: string;
  group?: string;
}

/**
 * 图边 - 用于可视化
 */
export interface GraphEdge {
  source: string;
  target: string;
  weight: number; // 基于链接频率
  type: 'forward' | 'bidirectional';
}

/**
 * 邻接表 - 用于图数据结构
 */
export interface AdjacencyList {
  [nodeId: string]: {
    forwardLinks: string[]; // 出边
    backlinks: string[]; // 入边
  };
}

/**
 * 图统计信息
 */
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  averageConnections: number;
  isolatedNodes: number;
  stronglyConnectedComponents: number;
}

// ============================================================================
// Vector Search Types (向量搜索类型)
// ============================================================================

/**
 * 向量嵌入结果
 */
export interface EmbeddingResult {
  noteId: string;
  vector: Float32Array;
  dimension: number;
  model: string;
  createdAt: number;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  noteId: string;
  title: string;
  content: string;
  score: number; // 相似度分数 0-1
  matchHighlights: string[]; // 匹配高亮
  vectorScore?: number; // 向量相似度分数
  keywordScore?: number; // 关键词匹配分数
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  query: string;
  limit?: number;
  threshold?: number; // 相似度阈值
  useVectorSearch?: boolean;
  useKeywordSearch?: boolean;
  filters?: {
    tags?: string[];
    dateRange?: {
      start: number;
      end: number;
    };
  };
}

/**
 * 索引状态
 */
export interface IndexStatus {
  totalNotes: number;
  indexedNotes: number;
  isIndexing: boolean;
  lastIndexedAt: number;
  errors: string[];
}

// ============================================================================
// Sharing Types (共享类型)
// ============================================================================

/**
 * 共享链接
 */
export interface ShareLink {
  id: string;
  noteId: string;
  encryptedNoteId: string; // 服务器端存储的加密ID
  ephemeralKey: string; // 临时密钥（仅客户端可见）
  expiresAt?: number;
  maxAccessCount?: number;
  accessCount: number;
  createdAt: number;
  createdBy: string;
}

/**
 * 共享权限
 */
export interface SharePermissions {
  canView: boolean;
  canEdit: boolean;
  canDownload: boolean;
  canShare: boolean;
}

/**
 * 共享元数据（服务器端可见）
 */
export interface ShareMetadata {
  encryptedNoteId: string;
  encryptedData: string; // 加密的笔记数据
  iv: string;
  createdAt: number;
  expiresAt?: number;
  accessCount: number;
  maxAccessCount?: number;
}

// ============================================================================
// Sync Types (同步类型)
// ============================================================================

/**
 * 同步操作类型
 */
export type SyncOperation = 
  | 'create_note'
  | 'update_note'
  | 'delete_note'
  | 'add_attachment'
  | 'remove_attachment'
  | 'add_link'
  | 'remove_link'
  | 'update_embedding';

/**
 * 同步事件
 */
export interface SyncEvent {
  id: string;
  operation: SyncOperation;
  noteId: string;
  data: any; // 操作相关的数据
  timestamp: number;
  deviceId: string;
  isProcessed: boolean;
}

/**
 * 冲突解决策略
 */
export type ConflictResolution = 
  | 'local_wins'
  | 'remote_wins'
  | 'manual_merge'
  | 'timestamp_based';

/**
 * 同步状态
 */
export interface SyncStatus {
  lastSyncAt: number;
  pendingEvents: number;
  conflicts: SyncEvent[];
  isOnline: boolean;
}

// ============================================================================
// Worker Message Types (Worker消息类型)
// ============================================================================

/**
 * Worker任务类型
 */
export type WorkerTaskType =
  | 'encrypt_file'
  | 'decrypt_file'
  | 'generate_embedding'
  | 'index_notes'
  | 'search_vectors';

/**
 * Worker消息
 */
export interface WorkerMessage<T = any> {
  id: string;
  type: WorkerTaskType;
  payload: T;
}

/**
 * Worker响应
 */
export interface WorkerResponse<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Error Types (错误类型)
// ============================================================================

/**
 * MemoVault错误基类
 */
export class MemoVaultError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MemoVaultError';
  }
}

/**
 * 加密错误
 */
export class EncryptionError extends MemoVaultError {
  constructor(message: string, details?: any) {
    super(message, 'ENCRYPTION_ERROR', details);
    this.name = 'EncryptionError';
  }
}

/**
 * 同步错误
 */
export class SyncError extends MemoVaultError {
  constructor(message: string, details?: any) {
    super(message, 'SYNC_ERROR', details);
    this.name = 'SyncError';
  }
}

/**
 * 链接错误（如悬空引用）
 */
export class LinkError extends MemoVaultError {
  constructor(message: string, details?: any) {
    super(message, 'LINK_ERROR', details);
    this.name = 'LinkError';
  }
}

/**
 * 索引错误
 */
export class IndexError extends MemoVaultError {
  constructor(message: string, details?: any) {
    super(message, 'INDEX_ERROR', details);
    this.name = 'IndexError';
  }
}
