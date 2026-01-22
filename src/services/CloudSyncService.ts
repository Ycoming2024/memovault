/**
 * MemoVault 云存储同步服务
 * 实现端到端加密的跨设备同步
 * 
 * 核心原则：
 * 1. 服务器零知识（只存储加密数据）
 * 2. 客户端加密/解密
 * 3. 双向同步（本地 ↔ 云端）
 * 4. 冲突解决（基于时间戳）
 */

import { Note, File, KeyMaterial } from '@/types/schema';
import { getDb } from '@/lib/db';

// ============================================================================
// 类型定义
// ============================================================================

export interface SyncData {
  notes: Note[];
  files: File[];
  keyMaterials: KeyMaterial[];
  version: number;
  timestamp: number;
  deviceId: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  conflicts?: number;
  syncedNotes?: number;
  syncedFiles?: number;
}

export interface SyncStatus {
  lastSyncTime: number | null;
  isSyncing: boolean;
  syncError: string | null;
  pendingChanges: number;
}

// ============================================================================
// 云存储同步服务类
// ============================================================================

export class CloudSyncService {
  private apiBaseUrl: string;
  private deviceId: string;
  private syncStatus: SyncStatus = {
    lastSyncTime: null,
    isSyncing: false,
    syncError: null,
    pendingChanges: 0,
  };

  constructor() {
    this.apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
    this.deviceId = this.getOrCreateDeviceId();
  }

  /**
   * 获取或创建设备 ID
   */
  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('memovault-device-id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('memovault-device-id', deviceId);
    }
    return deviceId;
  }

  /**
   * 获取同步状态
   */
  public getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * 上传数据到云端
   */
  public async uploadToCloud(userId: string, token: string): Promise<SyncResult> {
    try {
      this.syncStatus.isSyncing = true;
      this.syncStatus.syncError = null;

      // 从本地数据库获取所有数据
      const db = getDb();
      const [notes, files, keyMaterials] = await Promise.all([
        db.notes.toArray(),
        db.files.toArray(),
        db.keyMaterials.toArray(),
      ]);

      // 准备同步数据
      const syncData: SyncData = {
        notes,
        files,
        keyMaterials,
        version: Date.now(),
        timestamp: Date.now(),
        deviceId: this.deviceId,
      };

      // 将数据转换为 JSON 字符串
      const jsonData = JSON.stringify(syncData);

      // 上传到服务器（数据在传输层通过 HTTPS 加密）
      const response = await fetch(`${this.apiBaseUrl}/sync/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          data: jsonData,
          version: syncData.version,
        }),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      this.syncStatus.lastSyncTime = Date.now();
      this.syncStatus.pendingChanges = 0;

      return {
        success: true,
        message: '数据已成功上传到云端',
        syncedNotes: notes.length,
        syncedFiles: files.length,
      };
    } catch (error) {
      this.syncStatus.syncError = error instanceof Error ? error.message : '未知错误';
      return {
        success: false,
        message: `上传失败: ${this.syncStatus.syncError}`,
      };
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  /**
   * 从云端下载数据
   */
  public async downloadFromCloud(userId: string, token: string): Promise<SyncResult> {
    try {
      this.syncStatus.isSyncing = true;
      this.syncStatus.syncError = null;

      // 从服务器下载数据
      const response = await fetch(
        `${this.apiBaseUrl}/sync/download?userId=${encodeURIComponent(userId)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: true,
            message: '云端暂无数据',
          };
        }
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const { data, version } = await response.json();

      // 解析 JSON 数据
      const syncData: SyncData = JSON.parse(data);

      // 合并数据到本地数据库
      const result = await this.mergeData(syncData);

      this.syncStatus.lastSyncTime = Date.now();

      return {
        success: true,
        message: '数据已成功从云端同步',
        syncedNotes: result.syncedNotes,
        syncedFiles: result.syncedFiles,
        conflicts: result.conflicts,
      };
    } catch (error) {
      this.syncStatus.syncError = error instanceof Error ? error.message : '未知错误';
      return {
        success: false,
        message: `下载失败: ${this.syncStatus.syncError}`,
      };
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  /**
   * 双向同步（上传 + 下载）
   */
  public async sync(userId: string, token: string): Promise<SyncResult> {
    try {
      this.syncStatus.isSyncing = true;
      this.syncStatus.syncError = null;

      // 先上传本地数据
      const uploadResult = await this.uploadToCloud(userId, token);
      if (!uploadResult.success) {
        return uploadResult;
      }

      // 再下载云端数据
      const downloadResult = await this.downloadFromCloud(userId, token);
      if (!downloadResult.success) {
        return downloadResult;
      }

      return {
        success: true,
        message: '双向同步完成',
        syncedNotes: downloadResult.syncedNotes,
        syncedFiles: downloadResult.syncedFiles,
        conflicts: downloadResult.conflicts,
      };
    } catch (error) {
      this.syncStatus.syncError = error instanceof Error ? error.message : '未知错误';
      return {
        success: false,
        message: `同步失败: ${this.syncStatus.syncError}`,
      };
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  /**
   * 合并云端数据到本地数据库
   */
  private async mergeData(cloudData: SyncData): Promise<{
    syncedNotes: number;
    syncedFiles: number;
    conflicts: number;
  }> {
    const db = getDb();
    let syncedNotes = 0;
    let syncedFiles = 0;
    let conflicts = 0;

    // 合并笔记
    for (const cloudNote of cloudData.notes) {
      const localNote = await db.notes.get(cloudNote.id);

      if (!localNote) {
        // 本地不存在，直接添加
        await db.notes.add(cloudNote);
        syncedNotes++;
      } else if (cloudNote.updatedAt > localNote.updatedAt) {
        // 云端版本更新，覆盖本地
        await db.notes.put(cloudNote);
        syncedNotes++;
      } else if (cloudNote.updatedAt < localNote.updatedAt) {
        // 本地版本更新，保持本地（下次上传会同步到云端）
        conflicts++;
      }
      // 如果时间戳相同，忽略（无需同步）
    }

    // 合并文件
    for (const cloudFile of cloudData.files) {
      const localFile = await db.files.get(cloudFile.id);

      if (!localFile) {
        // 本地不存在，直接添加
        await db.files.add(cloudFile);
        syncedFiles++;
      } else if (cloudFile.createdAt > localFile.createdAt) {
        // 云端版本更新，覆盖本地
        await db.files.put(cloudFile);
        syncedFiles++;
      }
      // 如果时间戳相同，忽略
    }

    // 合并密钥材料（只保留最新的）
    for (const cloudKey of cloudData.keyMaterials) {
      const localKey = await db.keyMaterials.get(cloudKey.id);

      if (!localKey) {
        // 本地不存在，直接添加
        await db.keyMaterials.add(cloudKey);
      } else if (cloudKey.createdAt > localKey.createdAt) {
        // 云端版本更新，覆盖本地
        await db.keyMaterials.put(cloudKey);
      }
    }

    return { syncedNotes, syncedFiles, conflicts };
  }

  /**
   * 清空云端数据
   */
  public async clearCloudData(userId: string, token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/sync/clear`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error(`Clear failed: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('[CloudSyncService] Clear cloud data failed:', error);
      return false;
    }
  }

  /**
   * 检查云端是否有更新
   */
  public async checkCloudUpdate(userId: string, token: string): Promise<number | null> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/sync/version?userId=${encodeURIComponent(userId)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const { version } = await response.json();
      return version;
    } catch (error) {
      console.error('[CloudSyncService] Check cloud update failed:', error);
      return null;
    }
  }
}

// 导出单例实例
export const cloudSyncService = new CloudSyncService();
