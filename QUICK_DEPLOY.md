# 🚀 MemoVault 快速部署指南

> **小白友好！** 5 分钟内将你的笔记应用部署到云端。

---

## 📖 前置条件

- ✅ 一个域名（可选，没有域名也可以）
- ✅ 一个云平台账号（推荐 Vercel）
- ✅ Node.js 18+ 已安装
- ✅ Git 已安装（可选）

---

## 🎯 最简单的部署方式：Vercel

### 为什么选择 Vercel？

- ✅ **完全免费**（个人项目）
- ✅ **自动 HTTPS**
- ✅ **全球 CDN 加速**
- ✅ **部署最简单**
- ✅ **原生支持 Next.js**

---

## 📝 步骤 1：准备项目

### 1.1 安装依赖

打开终端（Windows 用户使用 PowerShell 或 CMD），进入项目目录：

```bash
cd c:/Users/admin/Desktop/bianqian
```

安装依赖：

```bash
npm install
```

### 1.2 配置环境变量

复制环境变量模板：

```bash
# Windows
copy .env.example .env.local

# Linux/Mac
cp .env.example .env.local
```

编辑 `.env.local` 文件，填入你的配置：

```bash
# 数据库连接（开发环境可以使用本地数据库）
DATABASE_URL="postgresql://postgresuser:password@localhost:5432/memovault?schema=public"

# JWT 密钥（生产环境必须使用强随机字符串）
JWT_SECRET="your-super-secret-key-change-in-production-12345678"

# WebSocket 服务器端口
WS_PORT=3001

# 客户端 WebSocket URL（开发环境）
NEXT_PUBLIC_WS_URL="ws://localhost:3001"

# S3/MinIO 配置（开发环境使用 MinIO）
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="memovault-dev"
S3_REGION="us-east-1"

# Node 环境
NODE_ENV="development"

# Next.js 端口
PORT=3000
```

---

## 📝 步骤 2：推送到 GitHub

### 2.1 创建 GitHub 仓库

1. 访问 https://github.com/new
2. 创建新仓库，命名为 `memovault`
3. 不要初始化 README、.gitignore 或 license

### 2.2 推送代码到 GitHub

```bash
# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 提交更改
git commit -m "Initial commit"

# 添加远程仓库
git remote add origin https://github.com/your-username/memovault.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

---

## 📝 步骤 3：部署到 Vercel

### 3.1 安装 Vercel CLI

```bash
npm install -g vercel
```

### 3.2 登录 Vercel

```bash
vercel login
```

按照提示登录你的 Vercel 账号。

### 3.3 部署项目

```bash
# 部署到 Vercel（预览版）
vercel

# 部署到生产环境
vercel --prod
```

### 3.4 配置环境变量

在 Vercel 控制台中添加以下环境变量：

| 变量名 | 值 |
|--------|---|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `JWT_SECRET` | 强随机密钥（至少 32 字符） |
| `WS_PORT` | `3001` |
| `NEXT_PUBLIC_WS_URL` | `wss://your-app.vercel.app` |

### 3.5 重新部署

配置环境变量后，重新部署项目：

```bash
vercel --prod
```

---

## 📝 步骤 4：配置数据库

### 4.1 使用 Vercel Postgres（推荐）

1. 在 Vercel 控制台中，点击 **Storage** 标签
2. 点击 **Create Database**
3. 选择 **Postgres**
4. 创建数据库
5. 复制连接字符串到 `DATABASE_URL` 环境变量

### 4.2 使用外部 PostgreSQL

如果你有外部 PostgreSQL 数据库，使用以下连接字符串：

```bash
postgresql://user:password@host:port/database?schema=public
```

---

## 📝 步骤 5：配置文件存储

### 5.1 使用 Vercel Blob（推荐）

1. 在 Vercel 控制台中，点击 **Storage** 标签
2. 点击 **Create Database**
3. 选择 **Blob**
4. 创建存储桶
5. 配置环境变量：

| 变量名 | 值 |
|--------|---|
| `S3_ENDPOINT` | Vercel Blob 端点 |
| `S3_ACCESS_KEY` | Vercel Blob Access Key |
| `S3_SECRET_KEY` | Vercel Blob Secret Key |
| `S3_BUCKET` | 存储桶名称 |
| `S3_REGION` | `us-east-1` |

### 5.2 使用 AWS S3

如果你有 AWS S3 账号，使用以下配置：

```bash
S3_ENDPOINT="https://s3.amazonaws.com"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"
S3_BUCKET="memovault-blobs"
S3_REGION="us-east-1"
```

---

## 📝 步骤 6：配置 WebSocket

### 6.1 Vercel WebSocket 配置

Vercel 原生支持 WebSocket，无需额外配置。

### 6.2 更新客户端 WebSocket URL

在 Vercel 控制台中，更新 `NEXT_PUBLIC_WS_URL` 环境变量：

```bash
NEXT_PUBLIC_WS_URL="wss://your-app.vercel.app"
```

---

## 🎉 完成！

部署完成后，你的应用可以通过以下方式访问：

**开发环境：**
- 应用：http://localhost:3000
- WebSocket：ws://localhost:3001

**生产环境：**
- 应用：https://your-app.vercel.app
- WebSocket：wss://your-app.vercel.app

---

## 🔍 验证部署

### 1. 检查应用状态

访问你的应用 URL，确认应用正常运行。

### 2. 测试登录功能

- 注册新账号
- 登录应用
- 创建笔记

### 3. 测试同步功能

- 在不同设备上登录
- 创建笔记
- 检查是否同步

### 4. 测试文件上传

- 上传图片或文件
- 确认文件可以下载

---

## 🐛 常见问题

### Q1: 部署失败，提示构建错误

**解决方法：**
```bash
# 清理构建缓存
rm -rf .next

# 重新构建
npm run build
```

### Q2: 数据库连接失败

**解决方法：**
- 检查 `DATABASE_URL` 是否正确
- 确认数据库白名单配置
- 测试数据库连接

### Q3: WebSocket 连接失败

**解决方法：**
- 检查 `NEXT_PUBLIC_WS_URL` 是否正确
- 确认 WebSocket 端口已开放
- 检查防火墙设置

### Q4: 文件上传失败

**解决方法：**
- 检查 S3 配置是否正确
- 确认存储桶权限
- 检查文件大小限制

---

## 📚 其他部署方式

### Netlify

```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 登录
netlify login

# 部署
netlify deploy --prod --dir=.next
```

### Railway

```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 初始化项目
railway init

# 部署
railway up
```

### Render

```bash
# 安装 Render CLI
npm install -g @render/cli

# 登录
render login

# 部署
render deploy
```

---

## 📞 需要帮助？

- 📖 查看 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) 获取详细部署指南
- 📖 查看 [README.md](README.md) 了解项目详情
- 📖 查看 [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) 了解集成指南
- 📖 查看 [QUICKSTART.md](QUICKSTART.md) 了解快速开始

---

## 🎯 下一步

1. ✅ 部署应用
2. ✅ 配置数据库
3. ✅ 配置文件存储
4. ✅ 测试所有功能
5. ✅ 享受你的笔记应用！

---

**祝你部署顺利！** 🚀
