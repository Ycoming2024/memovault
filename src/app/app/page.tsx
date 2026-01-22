/**
 * MemoVault 应用主页面
 * 登录后显示笔记应用
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { useNotes, createNote } from '@/lib/db';
import { syncManager } from '@/lib/sync';

export default function AppPage() {
  const router = useRouter();
  const notes = useNotes();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 检查用户是否已登录
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
    } else {
      setIsAuthenticated(true);
      
      // 初始化同步引擎
      const userId = localStorage.getItem('userId');
      if (userId && token) {
        syncManager.initialize(userId, token, `user-${userId}`)
          .then(() => {
            console.log('[App] Sync engine initialized');
          })
          .catch((error) => {
            console.error('[App] Failed to initialize sync engine:', error);
          });
      }
    }
  }, [router]);

  // 处理创建新笔记
  const handleNewNote = async () => {
    setIsLoading(true);
    try {
      const newNote = await createNote({
        title: '新笔记',
        content: '',
        tags: [],
        isDeleted: false,
        wikiLinks: [],
      });
      setSelectedNoteId(newNote.id);
    } catch (error) {
      console.error('Error creating note:', error);
      alert('创建笔记失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 处理登出
  const handleLogout = async () => {
    // 断开同步连接
    await syncManager.disconnect();
    
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('email');
    localStorage.removeItem('salt');
    router.push('/');
  };

  // 如果未认证，显示加载状态
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      selectedNoteId={selectedNoteId}
      onNoteSelect={setSelectedNoteId}
      onNewNote={handleNewNote}
      onLogout={handleLogout}
    />
  );
}
