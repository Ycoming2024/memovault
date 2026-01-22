# MemoVault 真正多用户云端同步系统

> 🎯 **实现真正的多用户、云端同步** - 在所有设备上访问你的笔记

---

## 📋 目录

1. [系统架构](#系统架构)
2. [数据库设计](#数据库设计)
3. [API 接口](#api-接口)
4. [前端集成](#前端集成)
5. [部署指南](#部署指南)
6. [使用说明](#使用说明)

---

## 系统架构

### 核心设计原则

```
┌─────────────────────────────────────────────┐
│              云端服务器                   │
│  (PostgreSQL - 持久化存储）            │
├─────────────────────────────────────────────┤
│  每个用户独立的数据                    │
│  - User 表（用户账户）                 │
│  - UserSyncData 表（同步数据）         │
│  - SyncLog 表（同步日志）             │
│  - EncryptedBlob 表（加密文件）      │
└─────────────────────────────────────────────┘
         ▲  ▼  ▲  ▼
    ┌────────┐  ┌────────┐  ┌────────┐
    │ 设备 A │  │ 设备 B │  │ 设备 C │
    │ (本地) │  │ (本地) │  │ (本地) │
    │ IndexedDB │  │ IndexedDB │  │ IndexedDB │
    │ (用户A) │  │ (用户B) │  │ (用户C) │
    └────────┘  └────────┘  └────────┘
```

### 数据流

```
用户 A 在设备 A 上注册
        ↓
    创建 userId-A
        ↓
    写笔记 1, 2, 3
        ↓
    点击"上传到云端"
        ↓
    数据存储在 PostgreSQL (UserSyncData)
        ↓
用户 A 在设备 B 上登录
        ↓
    使用相同的 userId-A
        ↓
    点击"从云端下载"
        ↓
    从 PostgreSQL 读取 UserSyncData
        ↓
    数据合并到 IndexedDB (用户A)
        ↓
    看到笔记 1, 2, 3
```

---

## 数据库设计

### 表结构

#### 1. User 表
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  auth_hash TEXT NOT NULL,
  salt BYTEA NOT NULL,
  user_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**字段说明：**
- `id`: 数据库主键
- `email`: 用户邮箱（唯一）
- `auth_hash`: PBKDF2 派生的认证哈希
- `salt`: PBKDF2 盐值
- `user_id`: 客户端生成的用户 ID（唯一）
- `created_at`, `updated_at`: 时间戳

#### 2. UserSyncData 表
```sql
CREATE TABLE user_sync_data (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  data TEXT NOT NULL,
  version BIGINT NOT NULL,
  device_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**字段说明：**
- `id`: 数据库主键
- `user_id`: 用户 ID（唯一）
- `data`: JSON 字符串，包含 notes, files, keyMaterials
- `version`: 版本号（自动递增）
- `device_id`: 设备标识符
- `created_at`, `updated_at`: 时间戳

#### 3. SyncLog 表
```sql
CREATE TABLE sync_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  notes_count INTEGER,
  files_count INTEGER,
  conflicts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**字段说明：**
- `id`: 数据库主键
- `user_id`: 用户 ID
- `action`: 操作类型（'upload', 'download', 'sync', 'clear'）
- `status`: 操作状态（'success', 'error'）
- `message`: 错误消息（可选）
- `notes_count`, `files_count`: 同步的笔记/文件数量
- `conflicts`: 冲突数量
- `created_at`: 时间戳

#### 4. EncryptedBlob 表
```sql
CREATE TABLE encrypted_blobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  blob_id TEXT UNIQUE NOT NULL,
  size BIGINT NOT NULL,
  mime_type TEXT,
  checksum TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**字段说明：**
- `id`: 数据库主键
- `user_id`: 用户 ID
- `blob_id`: S3 中的唯一标识
- `size`: 加密后的大小（字节）
- `mime_type`: MIME 类型（可选）
- `checksum`: SHA-256 校验和
- `created_at`, `updated_at`: 时间戳

---

## API 接口

### 1. 上传数据到云端

**请求**
```
POST /api/sync/db-upload
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "user-id",
  "data": "{...}",
  "version": 1234567890,
  "deviceId": "device-id"
}
```

**响应**
```json
{
  "success": true,
  "message": "Data uploaded successfully",
  "version": "1234567890"
}
```

### 2. 从云端下载数据

**请求**
```
GET /api/sync/db-download?userId={userId}
Authorization: Bearer {token}
```

**响应**
```json
{
  "data": "{...}",
  "version": "1234567890",
  "timestamp": 1234567890000
}
```

### 3. 检查版本

**请求**
```
GET /api/sync/db-version?userId={userId}
Authorization: Bearer {token}
```

**响应**
```json
{
  "version": "1234567890",
  "timestamp": 1234567890000
}
```

### 4. 清空云端数据

**请求**
```
DELETE /api/sync/db-clear
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "user-id"
}
```

**响应**
```json
{
  "success": true,
  "message": "Data cleared successfully",
  "count": 5
}
```

---

## 前端集成

### 1. 更新 CloudSyncService

修改 [`src/services/CloudSyncService.ts`](src/services/CloudSyncService.ts) 以使用新的 API：

```typescript
// 上传到云端
public async uploadToCloud(userId: string, token: string): Promise<SyncResult> {
  const response = await fetch('/api/sync/db-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId,
      data: JSON.stringify(syncData),
      version: Date.now(),
      deviceId: this.deviceId,
    }),
  });
  // ...
}

// 从云端下载
public async downloadFromCloud(userId: string, token: string): Promise<SyncResult> {
  const response = await fetch(
    `/api/sync/db-download?userId=${encodeURIComponent(userId)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  // ...
}
```

### 2. 更新 SyncControl 组件

修改 [`src/components/sync/SyncControl.tsx`](src/components/sync/SyncControl.tsx) 以使用新的 API。

---

## 部署指南

### 1. 初始化数据库

```bash
# 在服务器上执行
cd /var/www/memovault

# 安装 Prisma CLI
npm install -g prisma

# 初始化 Prisma
npx prisma generate

# 运行迁移
npx prisma migrate dev --name init_sync_tables

# 生成 Prisma Client
npx prisma generate
```

### 2. 配置环境变量

确保 `.env.local` 包含：

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/memovault?schema=public"
JWT_SECRET="your-super-secret-key-change-in-production-12345678"
```

### 3. 构建和重启

```bash
# 构建项目
npm run build

# 重启应用
pm2 restart all
```

---

## 使用说明

### 1. 注册和登录

1. **注册新用户**
   - 输入邮箱和密码
   - 客户端生成 userId
   - 服务器创建 User 记录
   - 返回 JWT Token

2. **登录用户**
   - 输入邮箱和密码
   - 服务器验证密码
   - 返回 JWT Token 和 userId

### 2. 在设备 A 上同步

1. **登录账号**
   - 使用相同的邮箱和密码登录
   - 获取 userId 和 Token

2. **创建笔记**
   - 在应用中创建笔记
   - 数据存储在本地 IndexedDB

3. **上传到云端**
   - 点击"上传到云端"按钮
   - 数据上传到 PostgreSQL

### 3. 在设备 B 上同步

1. **登录相同账号**
   - 使用相同的邮箱和密码登录
   - 获取相同的 userId 和 Token

2. **从云端下载**
   - 点击"从云端下载"按钮
   - 数据从 PostgreSQL 下载
   - 合并到本地 IndexedDB

3. **查看笔记**
   - 看到在设备 A 上创建的笔记

### 4. 多用户场景

1. **用户 A**
   - 邮箱: userA@example.com
   - userId: user-a-id
   - 笔记: 笔记 A1, A2, A3

2. **用户 B**
   - 邮箱: userB@example.com
   - userId: user-b-id
   - 笔记: 笔记 B1, B2, B3

3. **数据隔离**
   - 用户 A 的数据只对用户 A 可见
   - 用户 B 的数据只对用户 B 可见
   - 每个用户有独立的 PostgreSQL 记录

---

## 安全特性

- ✅ **真正的多用户支持** - 每个用户有独立的数据
- ✅ **JWT 认证** - 使用 Token 保护 API
- ✅ **版本控制** - 基于版本号解决冲突
- ✅ **设备追踪** - 记录每个设备的同步操作
- ✅ **同步日志** - 完整的同步历史记录
- ✅ **HTTPS 加密传输** - 所有数据通过 HTTPS 加密传输

---

## 文件清单

### 后端 API

- [`prisma/sync.prisma`](prisma/sync.prisma) - 数据库模型
- [`src/app/api/sync/db-upload/route.ts`](src/app/api/sync/db-upload/route.ts) - 上传接口
- [`src/app/api/sync/db-download/route.ts`](src/app/api/sync/db-download/route.ts) - 下载接口
- [`src/app/api/sync/db-version/route.ts`](src/app/api/sync/db-version/route.ts) - 版本检查接口
- [`src/app/api/sync/db-clear/route.ts`](src/app/api/sync/db-clear/route.ts) - 清空数据接口

### 前端服务

- [`src/services/CloudSyncService.ts`](src/services/CloudSyncService.ts) - 云存储同步服务
- [`src/components/sync/SyncControl.tsx`](src/components/sync/SyncControl.tsx) - 同步控制组件
- [`src/lib/userDb.ts`](src/lib/userDb.ts) - 用户数据库管理器（可选）

### 文档

- [`CLOUD_SYNC_GUIDE.md`](CLOUD_SYNC_GUIDE.md) - 云存储同步指南
- [`USER_DATA_ISOLATION.md`](USER_DATA_ISOLATION.md) - 用户数据隔离说明

---

## 总结

现在 MemoVault 支持真正的多用户云端同步：

1. **每个用户独立** - 每个邮箱注册一个账号
2. **数据隔离** - 每个用户的数据完全隔离
3. **云端同步** - 在所有设备上使用相同账号访问数据
4. **版本控制** - 基于版本号自动解决冲突
5. **同步日志** - 完整的同步历史记录

**开始使用：**
1. 初始化数据库：`npx prisma migrate dev --name init_sync_tables`
2. 构建项目：`npm run build`
3. 重启应用：`pm2 restart all`
4. 注册账号并开始使用

---

**祝你使用愉快！** 🎉
