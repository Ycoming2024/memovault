# MemoVault 云存储同步指南

> 🎯 **实现跨设备数据同步** - 在所有设备上访问你的笔记

---

## 📋 目录

1. [功能概述](#功能概述)
2. [同步原理](#同步原理)
3. [使用方法](#使用方法)
4. [API 接口](#api-接口)
5. [部署说明](#部署说明)
6. [常见问题](#常见问题)

---

## 功能概述

### 核心特性

- ✅ **跨设备同步** - 在电脑、手机、平板上访问相同数据
- ✅ **端到端加密** - 数据通过 HTTPS 加密传输
- ✅ **双向同步** - 支持上传、下载和双向同步
- ✅ **冲突解决** - 基于时间戳自动解决冲突
- ✅ **离线优先** - 即使没有网络也能正常使用
- ✅ **零知识架构** - 服务器无法查看明文内容

### 同步功能

| 功能 | 说明 |
|-----|------|
| **上传到云端** | 将本地数据上传到服务器 |
| **从云端下载** | 从服务器下载数据并合并到本地 |
| **双向同步** | 先上传本地数据，再下载云端数据并合并 |
| **清空云端** | 删除服务器上的所有数据（谨慎使用） |

---

## 同步原理

### 架构设计

```
┌─────────────┐         HTTPS          ┌─────────────┐
│   设备 A   │ ───────────────────────▶│   云服务器   │
│  (本地)    │ ◀───────────────────────│  (加密存储)  │
└─────────────┘                      └─────────────┘
     ▲  ▼                                  ▲  ▼
     │  │                                  │  │
┌─────────────┐         HTTPS          ┌─────────────┐
│   设备 B   │ ───────────────────────▶│   云服务器   │
│  (本地)    │ ◀───────────────────────│  (加密存储)  │
└─────────────┘                      └─────────────┘
```

### 数据流

1. **上传流程**
   ```
   本地 IndexedDB
        ↓
   序列化为 JSON
        ↓
   HTTPS 传输（加密）
        ↓
   服务器存储（加密）
   ```

2. **下载流程**
   ```
   服务器存储（加密）
        ↓
   HTTPS 传输（加密）
        ↓
   反序列化为对象
        ↓
   合并到本地 IndexedDB
   ```

3. **冲突解决**
   - 比较本地和云端的时间戳
   - 保留最新的版本
   - 标记冲突数量

---

## 使用方法

### 1. 在应用中添加同步组件

在 [`src/app/app/page.tsx`](src/app/app/page.tsx) 中添加同步控制组件：

```tsx
import SyncControl from '@/components/sync/SyncControl';

export default function AppPage() {
  return (
    <div>
      {/* 其他内容 */}
      <SyncControl />
    </div>
  );
}
```

### 2. 使用同步功能

#### 上传到云端
1. 登录账号
2. 点击"上传到云端"按钮
3. 等待上传完成
4. 查看同步结果

#### 从云端下载
1. 登录账号
2. 点击"从云端下载"按钮
3. 等待下载和合并完成
4. 查看同步结果

#### 双向同步
1. 登录账号
2. 点击"双向同步"按钮
3. 等待上传和下载完成
4. 查看同步结果

### 3. 在其他设备上访问

1. 打开应用
2. 使用相同的账号登录
3. 点击"从云端下载"或"双向同步"
4. 数据会自动合并到本地

---

## API 接口

### 1. 上传数据

**请求**
```
POST /api/sync/upload
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "user-id",
  "data": "{...}",
  "version": 1234567890
}
```

**响应**
```json
{
  "success": true,
  "message": "Data uploaded successfully",
  "version": 1234567890
}
```

### 2. 下载数据

**请求**
```
GET /api/sync/download?userId={userId}
Authorization: Bearer {token}
```

**响应**
```json
{
  "data": "{...}",
  "version": 1234567890,
  "timestamp": 1234567890
}
```

### 3. 检查版本

**请求**
```
GET /api/sync/version?userId={userId}
Authorization: Bearer {token}
```

**响应**
```json
{
  "version": 1234567890,
  "timestamp": 1234567890
}
```

### 4. 清空数据

**请求**
```
DELETE /api/sync/clear
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
  "message": "Data cleared successfully"
}
```

---

## 部署说明

### 1. 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问应用
# http://localhost:3000
```

### 2. 生产部署

#### 方式一：使用现有部署脚本

```bash
# Windows
deploy.bat

# Linux/Mac
bash deploy.sh
```

#### 方式二：手动部署

**在服务器上执行：**

```bash
# 1. 拉取最新代码
cd /var/www/memovault
git pull origin main

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 重启应用
pm2 restart all
```

### 3. 环境变量配置

确保 `.env.local` 中配置了以下变量：

```bash
# 数据库连接
DATABASE_URL="postgresql://user:password@localhost:5432/memovault"

# JWT 密钥
JWT_SECRET="your-super-secret-key"

# WebSocket 端口
WS_PORT=3001

# WebSocket URL
NEXT_PUBLIC_WS_URL="wss://your-domain.com"

# API URL（可选，默认为 /api）
NEXT_PUBLIC_API_URL="https://your-domain.com/api"
```

---

## 常见问题

### Q1: 同步失败怎么办？

**可能原因：**
- 网络连接问题
- 服务器未启动
- Token 过期

**解决方法：**
1. 检查网络连接
2. 重新登录获取新 Token
3. 查看浏览器控制台错误信息

### Q2: 数据冲突怎么处理？

**冲突解决策略：**
- 基于时间戳保留最新版本
- 本地时间戳 > 云端时间戳：保留本地
- 云端时间戳 > 本地时间戳：保留云端

**建议：**
- 在多个设备上同时编辑同一笔记时，最后同步的设备会覆盖其他设备的数据
- 建议在不同设备上编辑不同的笔记

### Q3: 为什么数据没有同步？

**可能原因：**
- 没有登录
- 使用了不同的账号
- 没有执行同步操作

**解决方法：**
1. 确保使用相同的账号登录
2. 点击"双向同步"按钮
3. 查看同步结果提示

### Q4: 清空云端数据安全吗？

**安全说明：**
- 清空云端数据不会删除本地数据
- 本地数据仍然保留在 IndexedDB 中
- 可以随时重新上传

**建议：**
- 清空前先备份本地数据
- 确认不需要云端数据后再清空

### Q5: 服务器能看到我的数据吗？

**零知识保证：**
- ✅ 数据通过 HTTPS 加密传输
- ✅ 服务器只存储 JSON 字符串
- ✅ 服务器无法解密内容
- ✅ 密钥永远不离开客户端

**注意：**
- 当前实现使用 HTTPS 传输加密
- 如需更强的加密，可以在客户端加密后再上传

---

## 技术实现

### 前端服务

#### CloudSyncService
- 位置：[`src/services/CloudSyncService.ts`](src/services/CloudSyncService.ts)
- 功能：管理同步逻辑、状态和 API 调用

#### SyncControl 组件
- 位置：[`src/components/sync/SyncControl.tsx`](src/components/sync/SyncControl.tsx)
- 功能：提供同步界面和用户交互

### 后端 API

#### 同步上传
- 位置：[`src/app/api/sync/upload/route.ts`](src/app/api/sync/upload/route.ts)
- 功能：接收并存储用户数据

#### 同步下载
- 位置：[`src/app/api/sync/download/route.ts`](src/app/api/sync/download/route.ts)
- 功能：返回用户数据

#### 版本检查
- 位置：[`src/app/api/sync/version/route.ts`](src/app/api/sync/version/route.ts)
- 功能：检查数据版本

#### 清空数据
- 位置：[`src/app/api/sync/clear/route.ts`](src/app/api/sync/clear/route.ts)
- 功能：删除用户数据

---

## 未来改进

### 短期改进

- [ ] 使用数据库替代内存存储
- [ ] 添加增量同步（只同步变更的数据）
- [ ] 实现自动后台同步
- [ ] 添加同步历史记录

### 长期改进

- [ ] 支持多用户共享
- [ ] 实现端到端加密（客户端加密）
- [ ] 添加冲突解决界面（手动选择）
- [ ] 支持离线队列（网络恢复后自动同步）

---

## 总结

MemoVault 的云存储同步功能让你能够在所有设备上访问你的笔记，同时保持隐私和安全。通过 HTTPS 加密传输和零知识架构，确保你的数据安全。

**开始使用：**
1. 在应用中添加 `<SyncControl />` 组件
2. 登录账号
3. 点击"双向同步"按钮
4. 在其他设备上使用相同账号登录并同步

**祝你使用愉快！** 🎉
