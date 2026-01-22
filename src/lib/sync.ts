/**
 * MemoVault 同步引擎
 * 基于 Y.js (CRDT) + WebSocket
 * 
 * 核心原则：
 * 1. 使用 CRDT 实现无冲突的实时同步
 * 2. 本地 IndexedDB 作为持久化存储（y-indexeddb）
 * 3. WebSocket 用于实时网络同步
 * 4. 用户只能加入自己的房间（基于 User ID）
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import type { SyncState } from '@/types/schema';

// ============================================================================
// 配置常量
// ============================================================================

const SYNC_CONFIG = {
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  reconnectInterval: 5000, // 5 秒重连间隔
  maxReconnectAttempts: 10,
};

// ============================================================================
// 同步管理器类
// ============================================================================

class SyncManager {
  private ydoc: Y.Doc | null = null;
  private wsProvider: WebsocketProvider | null = null;
  private idbProvider: IndexeddbPersistence | null = null;
  private userId: string | null = null;
  private token: string | null = null;
  private state: SyncState = {
    status: 'idle',
    pendingChanges: 0,
  };
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stateChangeListeners: Set<(state: SyncState) => void> = new Set();

  /**
   * 初始化同步引擎
   * 
   * @param userId - 用户 ID
   * @param token - JWT Token
   * @param docName - 文档名称（默认使用用户 ID）
   */
  async initialize(
    _userId: string, 
    _token: string, 
    docName?: string
  ): Promise<void> {
    try {
      if (this.ydoc) {
        console.warn('[Sync] Already initialized');
        return;
      }

      // 使用参数避免 TypeScript 警告
      console.log('[Sync] Initializing for user:', _userId, 'with token:', _token);
      
      this.userId = _userId;
      this.token = _token;
      const roomName = docName || `user-${_userId}`;

      // 创建 Y.js 文档
      this.ydoc = new Y.Doc();

      // 初始化 IndexedDB 持久化
      this.idbProvider = new IndexeddbPersistence(`memovault-${roomName}`, this.ydoc);

      // 等待 IndexedDB 加载完成
      await new Promise<void>((resolve) => {
        this.idbProvider!.on('synced', () => {
          console.log('[Sync] IndexedDB synced');
          resolve();
        });

        this.idbProvider!.on('sync', () => {
          console.log('[Sync] IndexedDB syncing...');
        });

        // 设置超时
        setTimeout(() => {
          if (!this.idbProvider?.synced) {
            console.warn('[Sync] IndexedDB sync timeout, continuing...');
            resolve();
          }
        }, 5000);
      });

      // 初始化 WebSocket 提供者
      // y-websocket 会自动将房间名称附加到 URL 路径中
      // 我们只需要传递基础 URL 和房间名称
      const wsUrl = SYNC_CONFIG.wsUrl;

      this.wsProvider = new WebsocketProvider(
        wsUrl,
        roomName,
        this.ydoc,
        {
          connect: true,
          // 通过 WebSocket 子协议传递认证信息
          params: {
            token: this.token,
            userId: this.userId,
          },
        }
      );

      // 监听 WebSocket 连接状态
      this.wsProvider.on('status', (event: any) => {
        console.log('[Sync] WebSocket status:', event.status);
        
        switch (event.status) {
          case 'connected':
            this.updateState({
              status: 'synced',
              lastSyncAt: new Date(),
              pendingChanges: 0,
            });
            this.reconnectAttempts = 0;
            this.clearReconnectTimer();
            break;
          case 'connecting':
            this.updateState({
              status: 'syncing',
            });
            break;
          case 'disconnected':
            this.updateState({
              status: 'idle',
            });
            this.scheduleReconnect();
            break;
        }
      });

      // 监听同步错误
      this.wsProvider.on('connection-error', (error: any) => {
        console.error('[Sync] WebSocket connection error:', error);
        this.updateState({
          status: 'error',
          errorMessage: error.message,
        });
      });

      // 监听文档更新
      this.ydoc.on('update', (_update: Uint8Array, origin: any) => {
        // 本地更新（origin 为 null 或本地客户端）
        if (!origin || origin === this.wsProvider?.awareness.clientID) {
          this.state.pendingChanges++;
        }
      });

      console.log('[Sync] Initialized successfully');
    } catch (error) {
      console.error('[Sync] Initialization error:', error);
      throw new Error('Failed to initialize sync engine');
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    try {
      this.clearReconnectTimer();

      if (this.wsProvider) {
        this.wsProvider.disconnect();
        this.wsProvider.destroy();
        this.wsProvider = null;
      }

      if (this.idbProvider) {
        await this.idbProvider.destroy();
        this.idbProvider = null;
      }

      if (this.ydoc) {
        this.ydoc.destroy();
        this.ydoc = null;
      }

      this.userId = null;
      this.token = null;
      this.updateState({ status: 'idle', pendingChanges: 0 });

      console.log('[Sync] Disconnected');
    } catch (error) {
      console.error('[Sync] Disconnect error:', error);
      throw new Error('Failed to disconnect sync engine');
    }
  }

  /**
   * 获取 Y.js 文档
   */
  getDoc(): Y.Doc | null {
    return this.ydoc;
  }

  /**
   * 获取同步状态
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * 订阅状态变化
   */
  onStateChange(callback: (state: SyncState) => void): () => void {
    this.stateChangeListeners.add(callback);
    return () => {
      this.stateChangeListeners.delete(callback);
    };
  }

  /**
   * 手动触发同步
   */
  async forceSync(): Promise<void> {
    try {
      if (!this.wsProvider || !this.wsProvider.wsconnected) {
        throw new Error('WebSocket not connected');
      }

      this.updateState({ status: 'syncing' });

      // Y.js 会自动同步，这里只是确保连接活跃
      // this.wsProvider.sync(); // sync 方法不存在，移除此行

      // 等待同步完成（简单实现）
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 2000);
        this.wsProvider!.on('sync', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.updateState({
        status: 'synced',
        lastSyncAt: new Date(),
        pendingChanges: 0,
      });

      console.log('[Sync] Force sync completed');
    } catch (error) {
      console.error('[Sync] Force sync error:', error);
      this.updateState({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * 获取笔记数据（从 Y.js）
   */
  getNotesData(): Y.Map<any> | null {
    if (!this.ydoc) return null;
    return this.ydoc.getMap('notes');
  }

  /**
   * 获取文件数据（从 Y.js）
   */
  getFilesData(): Y.Map<any> | null {
    if (!this.ydoc) return null;
    return this.ydoc.getMap('files');
  }

  /**
   * 保存笔记到 Y.js
   */
  saveNote(noteId: string, noteData: any): void {
    if (!this.ydoc) {
      throw new Error('Sync engine not initialized');
    }

    const notes = this.ydoc.getMap('notes');
    notes.set(noteId, noteData);

    console.log(`[Sync] Saved note: ${noteId}`);
  }

  /**
   * 删除笔记（从 Y.js）
   */
  deleteNote(noteId: string): void {
    if (!this.ydoc) {
      throw new Error('Sync engine not initialized');
    }

    const notes = this.ydoc.getMap('notes');
    notes.delete(noteId);

    console.log(`[Sync] Deleted note: ${noteId}`);
  }

  /**
   * 保存文件元数据到 Y.js
   */
  saveFile(fileId: string, fileData: any): void {
    if (!this.ydoc) {
      throw new Error('Sync engine not initialized');
    }

    const files = this.ydoc.getMap('files');
    files.set(fileId, fileData);

    console.log(`[Sync] Saved file: ${fileId}`);
  }

  /**
   * 删除文件（从 Y.js）
   */
  deleteFile(fileId: string): void {
    if (!this.ydoc) {
      throw new Error('Sync engine not initialized');
    }

    const files = this.ydoc.getMap('files');
    files.delete(fileId);

    console.log(`[Sync] Deleted file: ${fileId}`);
  }

  /**
   * 获取在线用户列表
   */
  getOnlineUsers(): any[] {
    if (!this.wsProvider) return [];
    return Array.from(this.wsProvider.awareness.getStates().values());
  }

  /**
   * 设置用户状态（用于协作）
   */
  setUserState(state: any): void {
    if (!this.wsProvider) return;
    this.wsProvider.awareness.setLocalStateField('user', state);
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  private updateState(newState: Partial<SyncState>): void {
    this.state = { ...this.state, ...newState };
    
    // 通知监听器
    this.stateChangeListeners.forEach((callback) => {
      callback(this.state);
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= SYNC_CONFIG.maxReconnectAttempts) {
      console.error('[Sync] Max reconnect attempts reached');
      this.updateState({
        status: 'error',
        errorMessage: 'Max reconnect attempts reached',
      });
      return;
    }

    this.clearReconnectTimer();

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`[Sync] Reconnecting... (attempt ${this.reconnectAttempts})`);
      
      if (this.wsProvider) {
        this.wsProvider.connect();
      }
    }, SYNC_CONFIG.reconnectInterval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// 导出单例实例
export const syncManager = new SyncManager();

// ============================================================================
// React Hook
// ============================================================================

import { useEffect, useState } from 'react';

/**
 * 使用同步状态的 Hook
 */
export function useSyncState() {
  const [state, setState] = useState<SyncState>(syncManager.getState());

  useEffect(() => {
    const unsubscribe = syncManager.onStateChange((newState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return state;
}

/**
 * 使用同步管理器的 Hook
 */
export function useSyncManager() {
  return syncManager;
}
