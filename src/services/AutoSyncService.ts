/**
 * 自动同步服务
 * 实现后台自动同步、离线队列和冲突解决
 * 
 * 核心原则：
 * 1. 自动同步：定期自动同步数据
 * 2. 离线优先：支持离线编辑，网络恢复后自动同步
 * 3. 冲突解决：基于时间戳自动解决冲突
 * 4. 增量同步：只同步变更的数据
 */

import { Note, File } from '@/types/schema';
import { getAllNotes, getAllFiles, createNote, updateNote, getKeyMaterial } from '@/lib/db';
import { cloudSyncService, SyncResult } from './CloudSyncService';

// ============================================================================
// 类型定义
// ============================================================================

export interface AutoSyncConfig {
  enabled: boolean;
  autoSyncInterval: number; // 自动同步间隔（毫秒）
  offlineQueue: boolean; // 是否启用离线队列
  conflictResolution: 'latest' | 'local' | 'manual'; // 冲突解决策略
}

export interface OfflineOperation {
  type: 'create' | 'update' | 'delete';
  entityType: 'note' | 'file';
  entityId: string;
  data: any;
  timestamp: number;
}

export interface SyncQueueItem {
  id: string;
  operation: 'upload' | 'download' | 'sync';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  timestamp: number;
  retryCount: number;
}

// ============================================================================
// 自动同步服务类
// ============================================================================

export class AutoSyncService {
  private config: AutoSyncConfig = {
    enabled: true,
    autoSyncInterval: 60000, // 1 分钟
    offlineQueue: true,
    conflictResolution: 'latest' as 'local' | 'manual', // 冲突解决策略
  };

  private syncQueue: SyncQueueItem[] = [];
  private offlineQueue: OfflineOperation[] = [];
  private isOnline: boolean = true;
  private syncTimer: NodeJS.Timeout | null = undefined;
  private currentUserId: string | null = null;

  constructor(config?: Partial<AutoSyncConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.loadConfig();
    this.setupEventListeners();
  }

  /**
   * 加载配置
   */
  private loadConfig(): void {
    if (typeof window !== 'undefined') {
      const savedConfig = localStorage.getItem('memovault-auto-sync-config');
      if (savedConfig) {
        try {
          this.config = JSON.parse(savedConfig);
        } catch (error) {
          console.error('[AutoSync] Failed to load config:', error);
        }
      }
    }
  }

  /**
   * 保存配置
   */
  private saveConfig(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('memovault-auto-sync-config', JSON.stringify(this.config));
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      // 网络状态监听
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.processOfflineQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        console.log('[AutoSync] Offline mode activated');
      });

      // 页面可见性变化监听
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.isOnline && this.config.enabled) {
          console.log('[AutoSync] Page visible, triggering sync');
          this.triggerSync();
        }
      });
    }
  }

  /**
   * 设置当前用户 ID
   */
  public setCurrentUserId(userId: string): void {
    this.currentUserId = userId;
    cloudSyncService.setCurrentUserId(userId);
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<AutoSyncConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();

    if (this.config.enabled && !this.syncTimer) {
      this.startAutoSync();
    } else if (!this.config.enabled && this.syncTimer) {
      this.stopAutoSync();
    }
  }

  /**
   * 启动自动同步
   */
  public startAutoSync(): void {
    this.stopAutoSync();

    if (this.config.enabled && this.isOnline) {
      console.log(`[AutoSync] Starting auto sync with interval ${this.config.autoSyncInterval}ms`);
      this.syncTimer = setInterval(() => {
        this.triggerSync();
      }, this.config.autoSyncInterval);
    }
  }

  /**
   * 停止自动同步
   */
  public stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('[AutoSync] Auto sync stopped');
    }
  }

  /**
   * 触发同步
   */
  public async triggerSync(): Promise<SyncResult> {
    if (!this.currentUserId) {
      console.warn('[AutoSync] No user ID set');
      return {
        success: false,
        message: '请先登录',
      };
    }

    if (!this.isOnline) {
      console.log('[AutoSync] Offline, adding to queue');
      this.addToSyncQueue('sync', { userId: this.currentUserId });
      return {
        success: false,
        message: '离线模式，已加入同步队列',
      };
    }

    try {
      console.log('[AutoSync] Triggering sync...');
      const result = await cloudSyncService.sync(this.currentUserId, this.getToken());
      
      if (result.success) {
        // 同步成功，清空离线队列
        this.offlineQueue = [];
      }

      return result;
    } catch (error) {
      console.error('[AutoSync] Sync failed:', error);
      return {
        success: false,
        message: `同步失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 添加到同步队列
   */
  private addToSyncQueue(
    operation: 'upload' | 'download' | 'sync',
    data: any
  ): void {
    const queueItem: SyncQueueItem = {
      id: crypto.randomUUID(),
      operation,
      status: 'pending',
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.syncQueue.push(queueItem);
    this.saveSyncQueue();
  }

  /**
   * 处理同步队列
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) return;

    console.log(`[AutoSync] Processing sync queue: ${this.syncQueue.length} items`);

    for (const item of this.syncQueue) {
      if (item.status !== 'pending') continue;

      item.status = 'in-progress';
      this.saveSyncQueue();

      try {
        let result: SyncResult;

        switch (item.operation) {
          case 'upload':
            result = await cloudSyncService.uploadToCloud(this.currentUserId!, this.getToken());
            break;
          case 'download':
            result = await cloudSyncService.downloadFromCloud(this.currentUserId!, this.getToken());
            break;
          case 'sync':
            result = await cloudSyncService.sync(this.currentUserId!, this.getToken());
            break;
        }

        item.status = result.success ? 'completed' : 'failed';
        this.saveSyncQueue();

        // 如果失败，增加重试计数
        if (!result.success) {
          item.retryCount++;
          if (item.retryCount < 3) {
            // 重新加入队列
            setTimeout(() => {
              item.status = 'pending';
              this.saveSyncQueue();
              this.processSyncQueue();
            }, 5000 * item.retryCount);
          } else {
            // 超过重试次数，移除
            this.syncQueue = this.syncQueue.filter(i => i.id !== item.id);
            this.saveSyncQueue();
          }
        }
      } catch (error) {
        console.error(`[AutoSync] Queue item ${item.id} failed`, error);
        item.status = 'failed';
        this.saveSyncQueue();
      }
    }

    // 清理已完成的项
    this.syncQueue = this.syncQueue.filter(item => item.status === 'pending' || item.status === 'in-progress');
    this.saveSyncQueue();
  }

  /**
   * 添加到离线队列
   */
  public addToOfflineQueue(operation: OfflineOperation): void {
    if (!this.config.offlineQueue) {
      console.log('[AutoSync] Offline queue disabled, skipping');
      return;
    }

    const offlineOp: OfflineOperation = {
      ...operation,
      timestamp: Date.now(),
    };

    this.offlineQueue.push(offlineOp);
    this.saveOfflineQueue();
    console.log(`[AutoSync] Added to offline queue: ${operation.type} ${operation.entityId}`);
  }

  /**
   * 处理离线队列
   */
  private async processOfflineQueue(): Promise<void> {
    if (!this.isOnline || this.offlineQueue.length === 0) return;

    console.log(`[AutoSync] Processing offline queue: ${this.offlineQueue.length} items`);

    for (const op of this.offlineQueue) {
      try {
        switch (op.type) {
          case 'create':
            await createNote(op.data);
            break;
          case 'update':
            await updateNote(op.entityId, op.data);
            break;
          case 'delete':
            // 删除操作 - 需要实现 deleteNote 函数
            break;
        }

        console.log(`[AutoSync] Processed offline operation: ${op.type} ${op.entityId}`);
      } catch (error) {
        console.error(`[AutoSync] Failed to process offline operation: ${op.type} ${op.entityId}`, error);
      }
    }

    this.offlineQueue = [];
    this.saveOfflineQueue();
  }

  /**
   * 保存同步队列
   */
  private saveSyncQueue(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('memovault-sync-queue', JSON.stringify(this.syncQueue));
    }
  }

  /**
   * 加载同步队列
   */
  private loadSyncQueue(): void {
    if (typeof window !== 'undefined') {
      const savedQueue = localStorage.getItem('memovault-sync-queue');
      if (savedQueue) {
        try {
          this.syncQueue = JSON.parse(savedQueue);
        } catch (error) {
          console.error('[AutoSync] Failed to load queue:', error);
        }
      }
    }
  }

  /**
   * 保存离线队列
   */
  private saveOfflineQueue(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('memovault-offline-queue', JSON.stringify(this.offlineQueue));
    }
  }

  /**
   * 加载离线队列
   */
  private loadOfflineQueue(): void {
    if (typeof window !== 'undefined') {
      const savedQueue = localStorage.getItem('memovault-offline-queue');
      if (savedQueue) {
        try {
          this.offlineQueue = JSON.parse(savedQueue);
        } catch (error) {
          console.error('[AutoSync] Failed to load offline queue:', error);
        }
      }
    }
  }

  /**
   * 获取 Token
   */
  private getToken(): string {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No token found');
    }
    return token;
  }

  /**
   * 获取同步状态
   */
  public getSyncStatus(): {
    queueSize: number;
    isOnline: boolean;
    config: AutoSyncConfig;
    lastSyncTime: number | null;
    pendingOperations: number;
  } {
    return {
      queueSize: this.syncQueue.filter(i => i.status === 'pending').length,
      isOnline: this.isOnline,
      config: this.config,
      lastSyncTime: cloudSyncService.getSyncStatus().lastSyncTime,
      pendingOperations: this.offlineQueue.length,
    };
  }

  /**
   * 获取同步历史
   */
  public getSyncHistory(): SyncQueueItem[] {
    return [...this.syncQueue];
  }

  /**
   * 清除同步队列
   */
  public clearSyncQueue(): void {
    this.syncQueue = [];
    this.saveSyncQueue();
    console.log('[AutoSync] Sync queue cleared');
  }

  /**
   * 清除离线队列
   */
  public clearOfflineQueue(): void {
    this.offlineQueue = [];
    this.saveOfflineQueue();
    console.log('[AutoSync] Offline queue cleared');
  }
}

// 导出单例实例
export const autoSyncService = new AutoSyncService();
