/**
 * 同步控制组件
 * 提供云存储同步功能
 */

'use client';

import { useState, useEffect } from 'react';
import { cloudSyncService, SyncStatus, SyncResult } from '@/services/CloudSyncService';
import { getCurrentUser } from '@/lib/authService';

export default function SyncControl() {
  const user = getCurrentUser();
  const token = user?.token || null;
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSyncTime: null,
    isSyncing: false,
    syncError: null,
    pendingChanges: 0,
  });
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  // 更新同步状态
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncStatus(cloudSyncService.getSyncStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 上传到云端
  const handleUpload = async () => {
    if (!user || !token) {
      setSyncResult({
        success: false,
        message: '请先登录',
      });
      setShowResult(true);
      return;
    }

    const result = await cloudSyncService.uploadToCloud(user.id, token);
    setSyncResult(result);
    setShowResult(true);

    // 3秒后自动隐藏结果
    setTimeout(() => setShowResult(false), 3000);
  };

  // 从云端下载
  const handleDownload = async () => {
    if (!user || !token) {
      setSyncResult({
        success: false,
        message: '请先登录',
      });
      setShowResult(true);
      return;
    }

    const result = await cloudSyncService.downloadFromCloud(user.id, token);
    setSyncResult(result);
    setShowResult(true);

    // 3秒后自动隐藏结果
    setTimeout(() => setShowResult(false), 3000);
  };

  // 双向同步
  const handleSync = async () => {
    if (!user || !token) {
      setSyncResult({
        success: false,
        message: '请先登录',
      });
      setShowResult(true);
      return;
    }

    const result = await cloudSyncService.sync(user.id, token);
    setSyncResult(result);
    setShowResult(true);

    // 3秒后自动隐藏结果
    setTimeout(() => setShowResult(false), 3000);
  };

  // 清空云端数据
  const handleClearCloud = async () => {
    if (!user || !token) {
      setSyncResult({
        success: false,
        message: '请先登录',
      });
      setShowResult(true);
      return;
    }

    const confirmed = confirm('确定要清空云端所有数据吗？此操作不可撤销！');
    if (!confirmed) return;

    const success = await cloudSyncService.clearCloudData(user.id, token);
    setSyncResult({
      success,
      message: success ? '云端数据已清空' : '清空失败',
    });
    setShowResult(true);

    // 3秒后自动隐藏结果
    setTimeout(() => setShowResult(false), 3000);
  };

  // 格式化时间
  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '从未同步';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold mb-4 flex items-center">
        <span className="mr-2">☁️</span>
        云存储同步
      </h2>

      {/* 同步状态 */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-600">上次同步时间：</span>
            <span className="ml-2 font-medium">{formatTime(syncStatus.lastSyncTime)}</span>
          </div>
          <div>
            <span className="text-sm text-gray-600">同步状态：</span>
            <span className={`ml-2 font-medium ${syncStatus.isSyncing ? 'text-blue-600' : 'text-green-600'}`}>
              {syncStatus.isSyncing ? '同步中...' : '就绪'}
            </span>
          </div>
          {syncStatus.syncError && (
            <div className="col-span-2">
              <span className="text-sm text-gray-600">错误：</span>
              <span className="ml-2 font-medium text-red-600">{syncStatus.syncError}</span>
            </div>
          )}
        </div>
      </div>

      {/* 同步按钮 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <button
          onClick={handleUpload}
          disabled={syncStatus.isSyncing || !user}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          📤 上传到云端
        </button>
        <button
          onClick={handleDownload}
          disabled={syncStatus.isSyncing || !user}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          📥 从云端下载
        </button>
        <button
          onClick={handleSync}
          disabled={syncStatus.isSyncing || !user}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          🔄 双向同步
        </button>
      </div>

      {/* 危险操作 */}
      <div className="border-t pt-4">
        <button
          onClick={handleClearCloud}
          disabled={syncStatus.isSyncing || !user}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          🗑️ 清空云端数据
        </button>
      </div>

      {/* 同步结果提示 */}
      {showResult && syncResult && (
        <div
          className={`mt-4 p-4 rounded-lg ${
            syncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}
        >
          <p className={`font-medium ${syncResult.success ? 'text-green-800' : 'text-red-800'}`}>
            {syncResult.message}
          </p>
          {syncResult.syncedNotes !== undefined && (
            <p className="text-sm text-gray-600 mt-1">
              同步了 {syncResult.syncedNotes} 条笔记
            </p>
          )}
          {syncResult.syncedFiles !== undefined && (
            <p className="text-sm text-gray-600">
              同步了 {syncResult.syncedFiles} 个文件
            </p>
          )}
          {syncResult.conflicts !== undefined && syncResult.conflicts > 0 && (
            <p className="text-sm text-yellow-600 mt-1">
              ⚠️ 发现 {syncResult.conflicts} 个冲突
            </p>
          )}
        </div>
      )}

      {/* 使用说明 */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
        <h3 className="font-bold mb-2">💡 使用说明</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>上传到云端</strong>：将本地数据上传到服务器</li>
          <li><strong>从云端下载</strong>：从服务器下载数据并合并到本地</li>
          <li><strong>双向同步</strong>：先上传本地数据，再下载云端数据并合并</li>
          <li><strong>清空云端</strong>：删除服务器上的所有数据（谨慎使用）</li>
          <li>数据通过 HTTPS 加密传输，服务器无法查看明文内容</li>
          <li>冲突时，保留最新修改的数据（基于时间戳）</li>
        </ul>
      </div>
    </div>
  );
}
