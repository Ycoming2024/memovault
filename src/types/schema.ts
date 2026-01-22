/**
 * MemoVault 共享类型定义
 * 前后端共享，确保类型一致性
 */

// ============================================================================
// 核心实体类型
// ============================================================================

/**
 * 笔记实体
 * 存储在本地 IndexedDB 中，通过 Y.js 同步
 */
export interface Note {
  id: string;                    // 唯一标识符
  title: string;                 // 笔记标题
  content: string;               // Markdown 内容
  tags: string[];                // 标签列表
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
  isDeleted: boolean;            // 软删除标记
  wikiLinks: string[];           // 提取的 WikiLink 列表
}

/**
 * 文件实体
 * 存储在本地 IndexedDB，加密后上传到 S3
 */
export interface File {
  id: string;                    // 唯一标识符
  name: string;                  // 文件名
  type: string;                  // MIME 类型
  size: number;                  // 文件大小（字节）
  encryptedData: ArrayBuffer;    // 加密后的数据
  iv: Uint8Array;                // 初始化向量
  checksum: string;              // SHA-256 校验和
  createdAt: Date;               // 创建时间
}

/**
 * 密钥材料
 * 存储在本地 IndexedDB，用于派生加密密钥
 */
export interface KeyMaterial {
  id: string;                    // 唯一标识符
  salt: Uint8Array;              // PBKDF2 盐值
  publicKey: string;             // 公钥（用于共享）
  encryptedPrivateKey: string;   // 加密的私钥
  createdAt: Date;               // 创建时间
}

// ============================================================================
// 加密相关类型
// ============================================================================

/**
 * 加密配置
 */
export interface EncryptionConfig {
  algorithm: 'AES-GCM';           // 加密算法
  keyLength: 256;                 // 密钥长度（位）
  ivLength: 12;                   // 初始化向量长度（字节）
}

/**
 * 加密结果
 */
export interface EncryptedData {
  ciphertext: Uint8Array;         // 加密后的数据
  iv: Uint8Array;                 // 初始化向量
  authTag?: Uint8Array;           // 认证标签（某些算法需要）
}

/**
 * PBKDF2 配置
 */
export interface PBKDF2Config {
  iterations: number;             // 迭代次数
  hash: 'SHA-256' | 'SHA-384' | 'SHA-512';
  saltLength: number;             // 盐值长度（字节）
}

// ============================================================================
// 同步相关类型
// ============================================================================

/**
 * 同步状态
 */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

/**
 * 同步状态信息
 */
export interface SyncState {
  status: SyncStatus;
  lastSyncAt?: Date;
  errorMessage?: string;
  pendingChanges: number;
}

/**
 * WebSocket 消息类型
 */
export enum WSMessageType {
  // 认证
  AUTH = 'auth',
  AUTH_SUCCESS = 'auth_success',
  AUTH_ERROR = 'auth_error',
  
  // 同步
  SYNC_UPDATE = 'sync_update',
  SYNC_ACK = 'sync_ack',
  SYNC_ERROR = 'sync_error',
  
  // 连接
  PING = 'ping',
  PONG = 'pong',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
}

/**
 * WebSocket 消息基础接口
 */
export interface WSMessage {
  type: WSMessageType;
  timestamp: number;
  payload?: unknown;
}

/**
 * 认证消息
 */
export interface AuthMessage extends WSMessage {
  type: WSMessageType.AUTH;
  payload: {
    token: string;                // JWT Token
    userId: string;               // 用户 ID
  };
}

/**
 * 同步更新消息
 */
export interface SyncUpdateMessage extends WSMessage {
  type: WSMessageType.SYNC_UPDATE;
  payload: {
    update: Uint8Array;           // Y.js 更新数据
    clientId: string;             // 客户端 ID
  };
}

// ============================================================================
// API 相关类型
// ============================================================================

/**
 * API 响应基础接口
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 登录请求
 */
export interface LoginRequest {
  email: string;
  password: string;               // 原始密码（仅在客户端使用）
}

/**
 * 登录响应
 */
export interface LoginResponse {
  token: string;                  // JWT Token
  userId: string;
  expiresAt: Date;
}

/**
 * Blob 上传请求
 */
export interface BlobUploadRequest {
  blobId: string;
  encryptedData: Uint8Array;
  iv: Uint8Array;
  checksum: string;
  mimeType?: string;
}

/**
 * Blob 上传响应
 */
export interface BlobUploadResponse {
  blobId: string;
  url: string;                    // S3 URL
  uploadedAt: Date;
}

// ============================================================================
// 搜索相关类型
// ============================================================================

/**
 * 搜索结果
 */
export interface SearchResult {
  noteId: string;
  title: string;
  excerpt: string;                // 匹配片段
  score: number;                  // 相关性分数
  highlights: string[];          // 高亮关键词
}

/**
 * 搜索过滤器
 */
export interface SearchFilters {
  tags?: string[];                // 按标签过滤
  dateFrom?: Date;               // 起始日期
  dateTo?: Date;                 // 结束日期
  minScore?: number;             // 最小相关性分数
}

// ============================================================================
// 图谱相关类型
// ============================================================================

/**
 * 图谱节点
 */
export interface GraphNode {
  id: string;
  label: string;
  type: 'note' | 'tag' | 'file';
  weight?: number;               // 节点权重
}

/**
 * 图谱边
 */
export interface GraphEdge {
  id: string;
  source: string;                // 源节点 ID
  target: string;                // 目标节点 ID
  type: 'wiki-link' | 'tag' | 'reference';
  weight?: number;               // 边权重
}

/**
 * 图谱数据
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ============================================================================
// UI 相关类型
// ============================================================================

/**
 * 主题配置
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * 用户偏好设置
 */
export interface UserPreferences {
  theme: Theme;
  sidebarWidth: number;
  fontSize: number;
  autoSave: boolean;
  syncInterval: number;          // 同步间隔（毫秒）
}

/**
 * 编辑器状态
 */
export interface EditorState {
  noteId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt?: Date;
}

// ============================================================================
// 错误类型
// ============================================================================

/**
 * 应用错误基类
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * 加密错误
 */
export class CryptoError extends AppError {
  constructor(message: string, details?: unknown) {
    super('CRYPTO_ERROR', message, details);
    this.name = 'CryptoError';
  }
}

/**
 * 同步错误
 */
export class SyncError extends AppError {
  constructor(message: string, details?: unknown) {
    super('SYNC_ERROR', message, details);
    this.name = 'SyncError';
  }
}

/**
 * 认证错误
 */
export class AuthError extends AppError {
  constructor(message: string, details?: unknown) {
    super('AUTH_ERROR', message, details);
    this.name = 'AuthError';
  }
}
