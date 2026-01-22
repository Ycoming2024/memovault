/**
 * 用户存储服务（Local-First 模式）
 * 使用 IndexedDB 存储用户信息
 */

import Dexie, { Table } from 'dexie';

export interface UserRecord {
  id?: number;
  email: string;
  authHash: string; // PBKDF2 派生的认证哈希
  salt: number[]; // 盐值数组
  userId: string; // UUID
  createdAt: Date;
}

class UserDatabase extends Dexie {
  users!: Table<UserRecord>;

  constructor() {
    super('MemoVaultUsers');
    this.version(1).stores({
      users: 'email, userId, createdAt',
    });
  }
}

const db = new UserDatabase();

/**
 * 用户存储服务
 */
export const userStore = {
  /**
   * 检查用户是否存在
   */
  async exists(email: string): Promise<boolean> {
    const user = await db.users.where('email').equals(email).first();
    return !!user;
  },

  /**
   * 创建用户
   */
  async create(email: string, authHash: string, salt: Uint8Array): Promise<UserRecord> {
    const userId = crypto.randomUUID();
    const user: UserRecord = {
      email,
      authHash,
      salt: Array.from(salt),
      userId,
      createdAt: new Date(),
    };
    const id = await db.users.add(user);
    return { ...user, id };
  },

  /**
   * 获取用户
   */
  async get(email: string): Promise<UserRecord | undefined> {
    return await db.users.where('email').equals(email).first();
  },

  /**
   * 验证密码
   */
  async verifyPassword(email: string, authHash: string): Promise<boolean> {
    const user = await this.get(email);
    if (!user) {
      return false;
    }
    return user.authHash === authHash;
  },

  /**
   * 删除用户
   */
  async delete(email: string): Promise<void> {
    await db.users.where('email').equals(email).delete();
  },

  /**
   * 获取所有用户
   */
  async getAll(): Promise<UserRecord[]> {
    return await db.users.toArray();
  },
};

export default userStore;
