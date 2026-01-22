/**
 * MemoVault 主应用外壳
 * 包含侧边栏、头部和主要内容区域
 * 
 * 功能：
 * - 响应式侧边栏（可折叠）
 * - 笔记列表导航
 * - 知识图谱入口
 * - 同步状态显示
 * - 搜索功能
 * - 设置功能
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Network, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useNotes, updateNote, deleteNote } from '@/lib/db';
import { useSyncState } from '@/lib/sync';
import type { Note } from '@/types/schema';

// ============================================================================
// 子组件
// ============================================================================

interface SidebarProps {
  notes: Note[];
  selectedNoteId: string | null;
  onNoteSelect: (noteId: string) => void;
  onNewNote: () => Promise<void>;
  onNoteDelete: (noteId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onNavigateToGraph: () => void;
}

function Sidebar({
  notes,
  selectedNoteId,
  onNoteSelect,
  onNewNote,
  onNoteDelete,
  isOpen,
  onToggle,
  onNavigateToGraph,
}: SidebarProps) {
  return (
    <aside
      className={`
        fixed left-0 top-0 h-full bg-slate-900 text-white
        transition-all duration-300 ease-in-out z-40
        ${isOpen ? 'w-72' : 'w-0 overflow-hidden'}
        lg:relative lg:translate-x-0
      `}
    >
      {/* 侧边栏头部 */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6" />
            MemoVault
          </h1>
          <button
            onClick={onToggle}
            className="lg:hidden p-2 hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* 新建笔记按钮 */}
        <button
          onClick={() => onNewNote()}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建笔记
        </button>
      </div>
 
      {/* 导航菜单 */}
      <nav className="p-4">
        <button
          onClick={onNavigateToGraph}
          className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 rounded-lg transition-colors mb-2"
        >
          <Network className="w-5 h-5" />
          知识图谱
        </button>
        
        <button className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 rounded-lg transition-colors mb-2">
          <Settings className="w-5 h-5" />
          设置
        </button>
      </nav>
 
      {/* 笔记列表 */}
      <div className="p-4 border-t border-slate-700 overflow-y-auto flex-1">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">笔记</h2>
        <ul className="space-y-1">
          {notes.length === 0 ? (
            <li className="text-slate-500 text-sm text-center py-4">
              暂无笔记
            </li>
          ) : (
            notes.map((note) => (
              <li key={note.id}>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onNoteSelect(note.id)}
                    className={`
                      flex-1 text-left p-3 rounded-lg transition-colors
                      ${selectedNoteId === note.id 
                        ? 'bg-blue-600 text-white' 
                        : 'hover:bg-slate-800'
                      }
                    `}
                  >
                    <div className="font-medium truncate">{note.title}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(note.updatedAt).toLocaleDateString('zh-CN')}
                    </div>
                  </button>
                  <button
                    onClick={() => onNoteDelete(note.id)}
                    className="p-2 hover:bg-red-600 rounded-lg transition-colors text-slate-400 hover:text-white"
                    title="删除笔记"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </aside>
  );
}

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  syncState: ReturnType<typeof useSyncState>;
  onLogout: () => void;
}

function Header({ 
  onToggleSidebar, 
  onOpenSearch,
  onOpenSettings,
  syncState, 
  onLogout 
}: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        {/* 同步状态指示器 */}
        <div className="flex items-center gap-2 text-sm">
          {syncState.status === 'synced' && (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-slate-600">已同步</span>
            </>
          )}
          {syncState.status === 'syncing' && (
            <>
              <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
              <span className="text-slate-600">同步中...</span>
            </>
          )}
          {syncState.status === 'error' && (
            <>
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-slate-600">同步失败</span>
            </>
          )}
          {syncState.status === 'idle' && (
            <>
              <span className="text-slate-400">离线（WebSocket 未启动）</span>
            </>
          )}
        </div>
      </div>
 
      <div className="flex items-center gap-2">
        {/* 搜索按钮 */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <Search className="w-4 h-4" />
          <span className="text-sm text-slate-600 hidden sm:inline">
            搜索 (Ctrl+K)
          </span>
        </button>
 
        {/* 设置按钮 */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm text-slate-600 hidden sm:inline">
            设置
          </span>
        </button>
 
        {/* 登出按钮 */}
        <button
          onClick={onLogout}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="登出"
        >
          <LogOut className="w-5 h-5 text-slate-600" />
        </button>
      </div>
    </header>
  );
}

interface MainContentProps {
  selectedNote: Note | null | undefined;
  onNoteChange: (note: Partial<Note>) => void;
  onSave: () => void;
}

function MainContent({ selectedNote, onNoteChange, onSave }: MainContentProps) {
  const [content, setContent] = useState('');
 
  useEffect(() => {
    if (selectedNote) {
      setContent(selectedNote.content);
    }
  }, [selectedNote]);
 
  if (!selectedNote) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-500">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">选择或创建一个笔记开始</p>
        </div>
      </div>
    );
  }
 
  return (
    <main className="flex-1 flex flex-col bg-white">
      {/* 笔记标题 */}
      <div className="border-b border-slate-200 px-6 py-4">
        <input
          type="text"
          value={selectedNote.title}
          onChange={(e) => onNoteChange({ title: e.target.value })}
          className="w-full text-2xl font-bold bg-transparent border-none outline-none placeholder-slate-400"
          placeholder="笔记标题..."
        />
      </div>
 
      {/* 笔记编辑器 */}
      <div className="flex-1 p-6 overflow-y-auto">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            onNoteChange({ content: e.target.value });
          }}
          onBlur={onSave}
          className="w-full h-full resize-none bg-transparent border-none outline-none text-slate-700 leading-relaxed placeholder-slate-400"
          placeholder="开始写作..."
          style={{ minHeight: 'calc(100vh - 300px)' }}
        />
      </div>
 
      {/* 底部工具栏 */}
      <div className="border-t border-slate-200 px-6 py-3 flex items-center justify-between text-sm text-slate-500">
        <div>
          最后更新: {new Date(selectedNote.updatedAt).toLocaleString('zh-CN')}
        </div>
        <div>
          支持 [[WikiLink]] 语法
        </div>
      </div>
    </main>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export default function AppShell({
  selectedNoteId,
  onNoteSelect,
  onNewNote,
  onLogout,
}: {
  selectedNoteId: string | null;
  onNoteSelect: (noteId: string) => void;
  onNewNote: () => Promise<void>;
  onLogout: () => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const notes = useNotes();
  const syncState = useSyncState();
  
  // 搜索笔记（使用 useMemo 避免 useLiveQuery 的类型问题）
  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    
    const query = searchQuery.toLowerCase();
    return notes.filter(note => 
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);
  
  // 获取当前选中的笔记
  const selectedNote = notes.find((note) => note.id === selectedNoteId);
  
  // 处理笔记选择
  const handleNoteSelect = (noteId: string) => {
    onNoteSelect(noteId);
    // 在移动端关闭侧边栏
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };
  
  // 处理新建笔记
  const handleNewNote = async () => {
    await onNewNote();
    // 在移动端关闭侧边栏
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };
  
  // 处理搜索
  const handleOpenSearch = () => {
    setSearchOpen(true);
    setSearchQuery('');
  };

  // 处理关闭搜索
  const handleCloseSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
  };

  // 处理搜索查询变更
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // 处理搜索结果点击
  const handleSearchResultClick = (noteId: string) => {
    onNoteSelect(noteId);
    handleCloseSearch();
  };

  // 处理打开设置
  const handleOpenSettings = () => {
    setSettingsOpen(true);
  };

  // 处理关闭设置
  const handleCloseSettings = () => {
    setSettingsOpen(false);
  };

  // 处理导航到知识图谱
  const handleNavigateToGraph = () => {
    console.log('Navigating to graph...');
    // TODO: 实现知识图谱导航
  };
  
  // 处理笔记变更
  const handleNoteChange = async (updates: Partial<Note>) => {
    if (!selectedNote) return;
    
    try {
      await updateNote(selectedNote.id, updates);
      console.log('Note updated:', updates);
    } catch (error) {
      console.error('Error updating note:', error);
      alert('保存笔记失败');
    }
  };
  
  // 处理保存
  const handleSave = () => {
    // 笔记已经通过 handleNoteChange 实时保存了
    // 这个函数可以用于显式保存或显示保存提示
    console.log('Note saved');
  };

  // 处理删除笔记
  const handleNoteDelete = async (noteId: string) => {
    if (!confirm('确定要删除这个笔记吗？')) return;
    
    try {
      await deleteNote(noteId);
      // 如果删除的是当前选中的笔记，清空选中状态
      if (selectedNoteId === noteId) {
        onNoteSelect('');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('删除笔记失败');
    }
  };
  
  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleOpenSearch();
      }
      // ESC 关闭模态框
      if (e.key === 'Escape') {
        if (searchOpen) {
          handleCloseSearch();
        }
        if (settingsOpen) {
          handleCloseSettings();
        }
      }
    };
 
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* 侧边栏 */}
      <Sidebar
        notes={notes}
        selectedNoteId={selectedNoteId}
        onNoteSelect={handleNoteSelect}
        onNewNote={handleNewNote}
        onNoteDelete={handleNoteDelete}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onNavigateToGraph={handleNavigateToGraph}
      />
 
      {/* 侧边栏遮罩（移动端） */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
 
      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 头部 */}
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenSearch={handleOpenSearch}
          onOpenSettings={handleOpenSettings}
          syncState={syncState}
          onLogout={onLogout}
        />
 
        {/* 主要内容 */}
        <MainContent
          selectedNote={selectedNote}
          onNoteChange={handleNoteChange}
          onSave={handleSave}
        />
      </div>

      {/* 搜索模态框 */}
      {searchOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold">搜索笔记</h2>
              <button
                onClick={handleCloseSearch}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 搜索输入框 */}
            <div className="p-6">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="输入关键词搜索..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            {/* 搜索结果 */}
            <div className="flex-1 overflow-y-auto p-6">
              {searchResults && searchResults.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>没有找到匹配的笔记</p>
                </div>
              ) : searchResults && searchResults.length > 0 ? (
                <ul className="space-y-2">
                  {searchResults.map((note) => (
                    <li key={note.id}>
                      <button
                        onClick={() => handleSearchResultClick(note.id)}
                        className="w-full text-left p-4 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <div className="font-semibold text-lg">{note.title}</div>
                        <div className="text-sm text-slate-500 mt-1 line-clamp-2">
                          {note.content || '无内容'}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* 设置模态框 */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold">设置</h2>
              <button
                onClick={handleCloseSettings}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 设置内容 */}
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">用户信息</h3>
                  <p className="text-sm text-slate-500">{localStorage.getItem('email')}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  登出
                </button>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">应用信息</h3>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between">
                    <span>版本</span>
                    <span className="font-medium">0.1.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span>数据存储</span>
                    <span className="font-medium">本地 IndexedDB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>加密方式</span>
                    <span className="font-medium">PBKDF2 + AES-GCM-256</span>
                  </div>
                  <div className="flex justify-between">
                    <span>同步状态</span>
                    <span className={`font-medium ${
                      syncState.status === 'synced' ? 'text-green-600' :
                      syncState.status === 'syncing' ? 'text-blue-600' :
                      syncState.status === 'error' ? 'text-red-600' :
                      'text-slate-400'
                    }`}>
                      {syncState.status === 'synced' ? '已同步' :
                       syncState.status === 'syncing' ? '同步中...' :
                       syncState.status === 'error' ? '同步失败' :
                       '离线'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <p className="text-xs text-slate-400 text-center">
                  MemoVault - 隐私优先的个人知识库
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
