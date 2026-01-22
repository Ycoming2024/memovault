/**
 * MemoVault 本地数据库层
 * 基于 Dexie.js (IndexedDB Wrapper)
 * 
 * 核心原则：
 * 1. 数据首先写入本地数据库（Local-First）
 * 2. 本地数据库是"第一真理"（Single Source of Truth）
 * 3. 同步引擎负责将变更同步到服务器
 */

import Dexie, { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Note, File, KeyMaterial } from '@/types/schema';

// ============================================================================
// Dexie 数据库定义
// ============================================================================

class MemoVaultDB extends Dexie {
  // 定义表
  notes!: Table<Note, string>;
  files!: Table<File, string>;
  keyMaterials!: Table<KeyMaterial, string>;

  constructor() {
    super('MemoVaultDB');

    // 定义数据库版本和表结构
    this.version(1).stores({
      notes: 'id, title, createdAt, updatedAt, isDeleted, wikiLinks',
      files: 'id, name, type, createdAt',
      keyMaterials: 'id, createdAt',
    });

    // 错误处理
    this.on('blocked', () => {
      console.error('[MemoVaultDB] Database blocked by another tab');
    });

    this.on('versionchange', () => {
      console.warn('[MemoVaultDB] Database version changed in another tab');
      // 关闭当前连接，允许其他标签页升级
      this.close();
    });
  }
}

// 创建数据库实例（单例）- 延迟初始化以避免服务端渲染问题
let dbInstance: MemoVaultDB | null = null;

export function getDb(): MemoVaultDB {
  // 只在客户端（浏览器环境）创建数据库实例
  if (typeof window === 'undefined') {
    throw new Error('Database can only be accessed in the browser');
  }
  
  if (!dbInstance) {
    dbInstance = new MemoVaultDB();
  }
  return dbInstance;
}

// 导出 db 实例（兼容旧代码）
export const db = typeof window !== 'undefined' ? getDb() : (null as unknown as MemoVaultDB);

// ============================================================================
// 笔记操作 (Notes)
// ============================================================================

/**
 * 获取所有笔记（排除已删除）
 */
export async function getAllNotes(): Promise<Note[]> {
  try {
    return await getDb().notes
      .filter(note => !note.isDeleted)
      .reverse()
      .sortBy('updatedAt');
  } catch (error) {
    console.error('[DB] Error fetching notes:', error);
    throw new Error('Failed to fetch notes');
  }
}

/**
 * 根据 ID 获取笔记
 */
export async function getNoteById(id: string): Promise<Note | undefined> {
  try {
    return await db.notes.get(id);
  } catch (error) {
    console.error(`[DB] Error fetching note ${id}:`, error);
    throw new Error(`Failed to fetch note ${id}`);
  }
}

/**
 * 创建新笔记
 * 
 * @param note - 笔记数据（不包含 id, createdAt, updatedAt）
 * @returns 创建的笔记
 */
export async function createNote(
  note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Note> {
  try {
    const now = new Date();
    const newNote: Note = {
      ...note,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      wikiLinks: extractWikiLinks(note.content),
    };

    await db.notes.add(newNote);
    console.log(`[DB] Created note: ${newNote.id}`);
    return newNote;
  } catch (error) {
    console.error('[DB] Error creating note:', error);
    throw new Error('Failed to create note');
  }
}

/**
 * 更新笔记
 * 
 * @param id - 笔记 ID
 * @param updates - 要更新的字段
 * @returns 更新后的笔记
 */
export async function updateNote(
  id: string,
  updates: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Note | undefined> {
  try {
    const note = await db.notes.get(id);
    if (!note) {
      throw new Error(`Note ${id} not found`);
    }

    const updatedNote: Note = {
      ...note,
      ...updates,
      updatedAt: new Date(),
      wikiLinks: updates.content ? extractWikiLinks(updates.content) : note.wikiLinks,
    };

    await db.notes.put(updatedNote);
    console.log(`[DB] Updated note: ${id}`);
    return updatedNote;
  } catch (error) {
    console.error(`[DB] Error updating note ${id}:`, error);
    throw new Error(`Failed to update note ${id}`);
  }
}

/**
 * 软删除笔记
 */
export async function deleteNote(id: string): Promise<void> {
  try {
    await db.notes.update(id, { isDeleted: true, updatedAt: new Date() });
    console.log(`[DB] Soft deleted note: ${id}`);
  } catch (error) {
    console.error(`[DB] Error deleting note ${id}:`, error);
    throw new Error(`Failed to delete note ${id}`);
  }
}

/**
 * 永久删除笔记（慎用）
 */
export async function permanentlyDeleteNote(id: string): Promise<void> {
  try {
    await db.notes.delete(id);
    console.log(`[DB] Permanently deleted note: ${id}`);
  } catch (error) {
    console.error(`[DB] Error permanently deleting note ${id}:`, error);
    throw new Error(`Failed to permanently delete note ${id}`);
  }
}

// ============================================================================
// 文件操作 (Files)
// ============================================================================

/**
 * 获取所有文件
 */
export async function getAllFiles(): Promise<File[]> {
  try {
    return await db.files.reverse().sortBy('createdAt');
  } catch (error) {
    console.error('[DB] Error fetching files:', error);
    throw new Error('Failed to fetch files');
  }
}

/**
 * 根据 ID 获取文件
 */
export async function getFileById(id: string): Promise<File | undefined> {
  try {
    return await db.files.get(id);
  } catch (error) {
    console.error(`[DB] Error fetching file ${id}:`, error);
    throw new Error(`Failed to fetch file ${id}`);
  }
}

/**
 * 创建文件记录
 */
export async function createFile(file: Omit<File, 'id' | 'createdAt'>): Promise<File> {
  try {
    const newFile: File = {
      ...file,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };

    await db.files.add(newFile);
    console.log(`[DB] Created file: ${newFile.id}`);
    return newFile;
  } catch (error) {
    console.error('[DB] Error creating file:', error);
    throw new Error('Failed to create file');
  }
}

/**
 * 删除文件
 */
export async function deleteFile(id: string): Promise<void> {
  try {
    await db.files.delete(id);
    console.log(`[DB] Deleted file: ${id}`);
  } catch (error) {
    console.error(`[DB] Error deleting file ${id}:`, error);
    throw new Error(`Failed to delete file ${id}`);
  }
}

// ============================================================================
// 密钥材料操作 (Key Materials)
// ============================================================================

/**
 * 获取密钥材料
 */
export async function getKeyMaterial(): Promise<KeyMaterial | undefined> {
  try {
    // 只应该有一条密钥材料记录
    const materials = await db.keyMaterials.toArray();
    return materials[0];
  } catch (error) {
    console.error('[DB] Error fetching key material:', error);
    throw new Error('Failed to fetch key material');
  }
}

/**
 * 保存密钥材料
 */
export async function saveKeyMaterial(
  material: Omit<KeyMaterial, 'id' | 'createdAt'>
): Promise<KeyMaterial> {
  try {
    // 检查是否已存在
    const existing = await getKeyMaterial();
    
    if (existing) {
      // 更新现有记录
      const updated: KeyMaterial = {
        ...existing,
        ...material,
      };
      await db.keyMaterials.put(updated);
      console.log('[DB] Updated key material');
      return updated;
    } else {
      // 创建新记录
      const newMaterial: KeyMaterial = {
        ...material,
        id: crypto.randomUUID(),
        createdAt: new Date(),
      };
      await db.keyMaterials.add(newMaterial);
      console.log('[DB] Created key material');
      return newMaterial;
    }
  } catch (error) {
    console.error('[DB] Error saving key material:', error);
    throw new Error('Failed to save key material');
  }
}

// ============================================================================
// React Hooks (使用 useLiveQuery 实现响应式)
// ============================================================================

/**
 * 响应式获取所有笔记
 */
export function useNotes() {
  return useLiveQuery(
    () => getAllNotes(),
    [],
    []
  );
}

/**
 * 响应式获取单个笔记
 */
export function useNote(id: string) {
  return useLiveQuery(
    () => getNoteById(id),
    [id],
    undefined
  );
}

/**
 * 响应式获取所有文件
 */
export function useFiles() {
  return useLiveQuery(
    () => getAllFiles(),
    [],
    []
  );
}

/**
 * 响应式获取密钥材料
 */
export function useKeyMaterial() {
  return useLiveQuery(
    () => getKeyMaterial(),
    [],
    undefined
  );
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 从内容中提取 WikiLinks
 * WikiLink 格式: [[链接文本]]
 */
function extractWikiLinks(content: string): string[] {
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;

  while ((match = wikiLinkRegex.exec(content)) !== null) {
    links.push(match[1]);
  }

  return links;
}

/**
 * 清空数据库（用于测试或重置）
 */
export async function clearDatabase(): Promise<void> {
  try {
    await db.transaction('rw', db.notes, db.files, db.keyMaterials, async () => {
      await db.notes.clear();
      await db.files.clear();
      await db.keyMaterials.clear();
    });
    console.log('[DB] Database cleared');
  } catch (error) {
    console.error('[DB] Error clearing database:', error);
    throw new Error('Failed to clear database');
  }
}

/**
 * 导出数据库（用于备份）
 */
export async function exportDatabase(): Promise<{
  notes: Note[];
  files: File[];
  keyMaterials: KeyMaterial[];
}> {
  try {
    const [notes, files, keyMaterials] = await Promise.all([
      db.notes.toArray(),
      db.files.toArray(),
      db.keyMaterials.toArray(),
    ]);

    return { notes, files, keyMaterials };
  } catch (error) {
    console.error('[DB] Error exporting database:', error);
    throw new Error('Failed to export database');
  }
}

/**
 * 导入数据库（用于恢复）
 */
export async function importDatabase(data: {
  notes: Note[];
  files: File[];
  keyMaterials: KeyMaterial[];
}): Promise<void> {
  try {
    await db.transaction('rw', db.notes, db.files, db.keyMaterials, async () => {
      await db.notes.clear();
      await db.files.clear();
      await db.keyMaterials.clear();

      await db.notes.bulkAdd(data.notes);
      await db.files.bulkAdd(data.files);
      await db.keyMaterials.bulkAdd(data.keyMaterials);
    });

    console.log('[DB] Database imported successfully');
  } catch (error) {
    console.error('[DB] Error importing database:', error);
    throw new Error('Failed to import database');
  }
}
