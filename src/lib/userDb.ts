/**
 * 用户数据库管理
 * 为每个用户创建独立的 IndexedDB 数据库
 * 
 * 核心原则：
 * 1. 每个用户有独立的数据库
 * 2. 数据库名称包含用户 ID
 * 3. 清除 Cookies 不影响其他用户的数据
 */

import Dexie, { Table } from 'dexie';
import type { Note, File, KeyMaterial } from '@/types/schema';

// ============================================================================
// 用户数据库缓存
// ============================================================================

const userDatabases: Map<string, UserMemoVaultDB> = new Map();

// ============================================================================
// 用户数据库类
// ============================================================================

class UserMemoVaultDB extends Dexie {
  notes!: Table<Note, string>;
  files!: Table<File, string>;
  keyMaterials!: Table<KeyMaterial, string>;

  constructor(userId: string) {
    // 为每个用户创建独立的数据库
    // 数据库名称格式: MemoVaultDB-{userId}
    super(`MemoVaultDB-${userId}`);

    // 定义数据库版本和表结构
    this.version(1).stores({
      notes: 'id, title, createdAt, updatedAt, isDeleted, wikiLinks',
      files: 'id, name, type, createdAt',
      keyMaterials: 'id, createdAt',
    });

    // 错误处理
    this.on('blocked', () => {
      console.error(`[UserDB] Database blocked for user ${userId}`);
    });

    this.on('versionchange', () => {
      console.warn(`[UserDB] Database version changed for user ${userId}`);
      this.close();
    });
  }
}

// ============================================================================
// 用户数据库管理器
// ============================================================================

export class UserDatabaseManager {
  /**
   * 获取或创建用户数据库
   */
  public static getUserDatabase(userId: string): UserMemoVaultDB {
    let db = userDatabases.get(userId);

    if (!db) {
      db = new UserMemoVaultDB(userId);
      userDatabases.set(userId, db);
    }

    return db;
  }

  /**
   * 关闭用户数据库
   */
  public static closeUserDatabase(userId: string): void {
    const db = userDatabases.get(userId);
    if (db) {
      db.close();
      userDatabases.delete(userId);
    }
  }

  /**
   * 关闭所有用户数据库
   */
  public static closeAllDatabases(): void {
    userDatabases.forEach((db, userId) => {
      db.close();
      console.log(`[UserDB] Closed database for user ${userId}`);
    });
    userDatabases.clear();
  }

  /**
   * 删除用户数据库
   */
  public static async deleteUserDatabase(userId: string): Promise<void> {
    const db = userDatabases.get(userId);
    if (db) {
      await db.delete();
      userDatabases.delete(userId);
      console.log(`[UserDB] Deleted database for user ${userId}`);
    }
  }

  /**
   * 获取所有笔记
   */
  public static async getAllNotes(userId: string): Promise<Note[]> {
    try {
      const db = this.getUserDatabase(userId);
      return await db.notes
        .filter(note => !note.isDeleted)
        .reverse()
        .sortBy('updatedAt');
    } catch (error) {
      console.error(`[UserDB] Error fetching notes for user ${userId}:`, error);
      throw new Error('Failed to fetch notes');
    }
  }

  /**
   * 创建笔记
   */
  public static async createNote(
    userId: string,
    note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Note> {
    try {
      const db = this.getUserDatabase(userId);
      const now = new Date();
      const newNote: Note = {
        ...note,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        wikiLinks: this.extractWikiLinks(note.content),
      };

      await db.notes.add(newNote);
      console.log(`[UserDB] Created note for user ${userId}: ${newNote.id}`);
      return newNote;
    } catch (error) {
      console.error(`[UserDB] Error creating note for user ${userId}:`, error);
      throw new Error('Failed to create note');
    }
  }

  /**
   * 更新笔记
   */
  public static async updateNote(
    userId: string,
    id: string,
    updates: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Note | undefined> {
    try {
      const db = this.getUserDatabase(userId);
      const note = await db.notes.get(id);

      if (!note) {
        throw new Error(`Note ${id} not found`);
      }

      const updatedNote: Note = {
        ...note,
        ...updates,
        updatedAt: new Date(),
        wikiLinks: updates.content ? this.extractWikiLinks(updates.content) : note.wikiLinks,
      };

      await db.notes.put(updatedNote);
      console.log(`[UserDB] Updated note for user ${userId}: ${id}`);
      return updatedNote;
    } catch (error) {
      console.error(`[UserDB] Error updating note ${id} for user ${userId}:`, error);
      throw new Error(`Failed to update note ${id}`);
    }
  }

  /**
   * 删除笔记
   */
  public static async deleteNote(userId: string, id: string): Promise<void> {
    try {
      const db = this.getUserDatabase(userId);
      await db.notes.update(id, { isDeleted: true, updatedAt: new Date() });
      console.log(`[UserDB] Soft deleted note for user ${userId}: ${id}`);
    } catch (error) {
      console.error(`[UserDB] Error deleting note ${id} for user ${userId}:`, error);
      throw new Error(`Failed to delete note ${id}`);
    }
  }

  /**
   * 获取所有文件
   */
  public static async getAllFiles(userId: string): Promise<File[]> {
    try {
      const db = this.getUserDatabase(userId);
      return await db.files.reverse().sortBy('createdAt');
    } catch (error) {
      console.error(`[UserDB] Error fetching files for user ${userId}:`, error);
      throw new Error('Failed to fetch files');
    }
  }

  /**
   * 获取密钥材料
   */
  public static async getKeyMaterial(userId: string): Promise<KeyMaterial | undefined> {
    try {
      const db = this.getUserDatabase(userId);
      const materials = await db.keyMaterials.toArray();
      return materials[0];
    } catch (error) {
      console.error(`[UserDB] Error fetching key material for user ${userId}:`, error);
      throw new Error('Failed to fetch key material');
    }
  }

  /**
   * 保存密钥材料
   */
  public static async saveKeyMaterial(
    userId: string,
    material: Omit<KeyMaterial, 'id' | 'createdAt'>
  ): Promise<KeyMaterial> {
    try {
      const db = this.getUserDatabase(userId);
      const existing = await this.getKeyMaterial(userId);
      
      if (existing) {
        const updated: KeyMaterial = {
          ...existing,
          ...material,
        };
        await db.keyMaterials.put(updated);
        console.log(`[UserDB] Updated key material for user ${userId}`);
        return updated;
      } else {
        const newMaterial: KeyMaterial = {
          ...material,
          id: crypto.randomUUID(),
          createdAt: new Date(),
        };
        await db.keyMaterials.add(newMaterial);
        console.log(`[UserDB] Created key material for user ${userId}`);
        return newMaterial;
      }
    } catch (error) {
      console.error(`[UserDB] Error saving key material for user ${userId}:`, error);
      throw new Error('Failed to save key material');
    }
  }

  /**
   * 导出用户数据
   */
  public static async exportUserData(userId: string): Promise<{
    notes: Note[];
    files: File[];
    keyMaterials: KeyMaterial[];
  }> {
    try {
      const db = this.getUserDatabase(userId);
      const [notes, files, keyMaterials] = await Promise.all([
        db.notes.toArray(),
        db.files.toArray(),
        db.keyMaterials.toArray(),
      ]);

      return { notes, files, keyMaterials };
    } catch (error) {
      console.error(`[UserDB] Error exporting data for user ${userId}:`, error);
      throw new Error('Failed to export data');
    }
  }

  /**
   * 导入用户数据
   */
  public static async importUserData(
    userId: string,
    data: {
      notes: Note[];
      files: File[];
      keyMaterials: KeyMaterial[];
    }
  ): Promise<void> {
    try {
      const db = this.getUserDatabase(userId);
      await db.transaction('rw', db.notes, db.files, db.keyMaterials, async () => {
        await db.notes.clear();
        await db.files.clear();
        await db.keyMaterials.clear();

        await db.notes.bulkAdd(data.notes);
        await db.files.bulkAdd(data.files);
        await db.keyMaterials.bulkAdd(data.keyMaterials);
      });

      console.log(`[UserDB] Imported data for user ${userId}`);
    } catch (error) {
      console.error(`[UserDB] Error importing data for user ${userId}:`, error);
      throw new Error('Failed to import data');
    }
  }

  /**
   * 清空用户数据库
   */
  public static async clearUserDatabase(userId: string): Promise<void> {
    try {
      const db = this.getUserDatabase(userId);
      await db.transaction('rw', db.notes, db.files, db.keyMaterials, async () => {
        await db.notes.clear();
        await db.files.clear();
        await db.keyMaterials.clear();
      });

      console.log(`[UserDB] Cleared database for user ${userId}`);
    } catch (error) {
      console.error(`[UserDB] Error clearing database for user ${userId}:`, error);
      throw new Error('Failed to clear database');
    }
  }

  /**
   * 从内容中提取 WikiLinks
   */
  private static extractWikiLinks(content: string): string[] {
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match;

    while ((match = wikiLinkRegex.exec(content)) !== null) {
      links.push(match[1]);
    }

    return links;
  }
}

// 导出单例
export const userDatabaseManager = new UserDatabaseManager();
