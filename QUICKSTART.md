# MemoVault 快速开始指南

本指南帮助您快速启动 MemoVault 项目。

## 前置条件

- Node.js >= 18.0.0
- PostgreSQL >= 14.0（可选，用于同步功能）

## 快速启动（仅前端）

如果您只想快速查看前端界面：

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev
```

访问 http://localhost:3000

## 完整启动（包含数据库和同步）

### 1. 安装依赖

```bash
npm install
```

如果遇到依赖冲突，使用：
```bash
npm install --legacy-peer-deps
```

### 2. 配置环境变量

**Windows:**
```cmd
copy .env.example .env.local
```

**Linux/Mac:**
```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件，至少配置以下变量：

```env
# 数据库连接（可选，用于同步功能）
DATABASE_URL="postgresql://postgres:password@localhost:5432/memovault?schema=public"

# JWT 密钥
JWT_SECRET="your-super-secret-key-change-in-production"
```

### 3. 初始化数据库（可选）

如果配置了 PostgreSQL：

```bash
npx prisma generate
npx prisma db push
```

### 4. 启动应用

**仅前端（推荐用于快速开始）：**
```bash
npm run dev
```

**包含 WebSocket 服务器：**
```bash
npm run build
npm run dev:full
```

## 访问应用

打开浏览器访问：http://localhost:3000

## 功能说明

### 当前可用功能

- ✅ 本地数据库（IndexedDB）
- ✅ 笔记创建和编辑
- ✅ WikiLink 支持（[[链接]]）
- ✅ 响应式 UI 设计
- ✅ 暗色模式支持
- ✅ 搜索入口（Ctrl+K）

### 待实现功能

- ⏳ 用户认证
- ⏳ WebSocket 同步
- ⏳ 知识图谱可视化
- ⏳ 文件上传/下载
- ⏳ 全文搜索

## 常见问题

### Q: npm install 失败

**A:** 尝试使用 `--legacy-peer-deps` 标志：
```bash
npm install --legacy-peer-deps
```

### Q: TypeScript 错误

**A:** 这些错误会在 `npm install` 后自动消失。如果仍然存在，尝试：
```bash
rm -rf node_modules package-lock.json
npm install
```

### Q: 数据库连接失败

**A:** 确保以下项目：
1. PostgreSQL 正在运行
2. `.env.local` 中的 `DATABASE_URL` 正确
3. 数据库用户有足够权限

### Q: 端口已被占用

**A:** 修改 `.env.local` 中的 `PORT` 变量：
```env
PORT=3001  # 使用其他端口
```

## 下一步

1. 阅读 [集成指南](INTEGRATION_GUIDE.md) 了解详细配置
2. 阅读 [项目结构](PROJECT_STRUCTURE.md) 了解代码组织
3. 查看 [项目总结](PROJECT_SUMMARY.md) 了解技术架构

## 开发提示

### 热重载

Next.js 开发服务器支持热重载，修改代码后会自动刷新浏览器。

### 查看数据库

使用 Prisma Studio 查看数据库内容：
```bash
npx prisma studio
```

### 调试

打开浏览器开发者工具（F12）查看控制台日志：
- `[DB]` - 本地数据库操作
- `[Crypto]` - 加密/解密操作
- `[Sync]` - 同步引擎状态

## 获取帮助

如有问题，请：
1. 查看集成指南中的[常见问题](INTEGRATION_GUIDE.md#常见问题)部分
2. 检查浏览器控制台错误
3. 查看终端输出

---

**祝您使用愉快！** 🚀
