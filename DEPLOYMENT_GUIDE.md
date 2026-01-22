# MemoVault 部署指南

> 🎯 **小白友好的！** 这份指南将帮助你将 MemoVault 部署到云服务器。

## 📋 目录

1. [项目概述](#项目概述)
2. [云服务器选择](#云服务器选择)
3. [部署前准备](#部署前准备)
4. [Vercel 部署](#vercel-部署)
5. [其他平台部署](#其他平台部署)
6. [环境变量配置](#环境变量配置)
7. [常见问题解决](#常见问题解决)

---

## 📖 项目概述

MemoVault 是一个 **零知识、本地优先**的笔记应用，采用以下架构：

### 核心特性
- ✅ 服务器零知识（服务器永远无法访问用户数据）
- ✅ 本地优先（所有数据处理在本地完成）
- ✅ 双向链接（支持 WikiLink 语法）
- ✅ 安全附件（流式加密大文件）
- ✅ 语义搜索（本地向量搜索）
- ✅ 零信任共享（URL 片段密钥传递）

### 技术栈
- **前端**：Next.js 14+ (App Router) + React 18 + TypeScript
- **后端**：Next.js API Routes + WebSocket 服务器
- **数据库**：IndexedDB (本地) + PostgreSQL (仅元数据)
- **存储**：S3/MinIO/R2 (加密文件)
- **搜索**：Orama (本地向量搜索)
- **图可视化**：Cytoscape.js

---

## 🌐 云服务器选择

### 推荐平台（按推荐顺序）

#### 1. **Vercel** ⭐⭐⭐⭐
**优点：**
- ✅ 部署 Next.js 应用最简单
- ✅ 全球 CDN 加速
- ✅ 自动 HTTPS 和 HTTP/2
- ✅ 免费额度慷慨
- ✅ 支持环境变量
- ✅ 原生支持 Next.js 14+
- ✅ WebSocket 支持（通过 Vercel）

**缺点：**
- ❌ 构建时间限制（免费版 60 秒）
- ❌ WebSocket 需要额外配置

**适合：** 初学者、快速部署、个人项目

#### 2. **Netlify**
**优点：**
- ✅ 部署 Next.js 应用简单
- ✅ 全球 CDN
- ✅ 免费额度高
- ✅ 支持 WebSocket

**缺点：**
- ❌ 构建时间限制（免费版 300 秒）
- ❌ 每个账户只能部署一个项目

**适合：** 静态站点、个人项目

#### 3. **Railway**
**优点：**
- ✅ 支持 WebSocket
- ✅ PostgreSQL 数据库托管
- ✅ 免费额度高
- ✅ 构建时间限制宽松

**缺点：**
- ❌ 部署 Next.js 相对复杂
- ❌ 需要配置文件

**适合：** 有数据库需求的项目

#### 4. **Render**
**优点：**
- ✅ 支持 PostgreSQL
- ✅ 支持 WebSocket
- ✅ 免费额度高
- ✅ 支持持久存储

**缺点：**
- ❌ 冷启动慢
- ❌ 免费层限制

**适合：** 全栈应用、需要数据库

#### 5. **DigitalOcean**
**优点：**
- ✅ 完全控制
- ✅ 支持 PostgreSQL
- ✅ 支持 S3 兼容存储
- ✅ 价格透明

**缺点：**
- ❌ 需要手动配置
- ❌ 需要维护服务器
- ❌ 按使用量计费

**适合：** 有服务器经验、需要完全控制

#### 6. **阿里云**
**优点：**
- ✅ 国内访问速度快
- ✅ 支持 OSS 对象存储
- ✅ 支持 PostgreSQL
- ✅ 价格透明

**缺点：**
- ❌ 需要备案
- ❌ 配置相对复杂
- ❌ 按使用量计费

**适合：** 国内项目、需要国内存储

---

## 📦 部署前准备

### 1. 准备域名

**如果你有域名：**
```bash
# 确保域名已解析到服务器 IP
ping yourdomain.com
```

**如果没有域名：**
- Vercel：使用 `your-app.vercel.app`
- Netlify：使用 `your-app.netlify.app`
- 其他平台：使用平台提供的域名

### 2. 安装依赖

```bash
# 进入项目目录
cd c:/Users/admin/Desktop/bianqian

# 安装依赖
npm install
```

### 3. 环境变量配置

**复制 `.env.example` 为 `.env.local`：**
```bash
cp .env.example .env.local
```

**编辑 `.env.local` 填入实际值：**
```bash
# 数据库连接（生产环境）
DATABASE_URL="postgresql://postgresuser:password@your-db-host:5432/memovault?schema=public"

# JWT 密钥（生产环境 - 使用强随机字符串）
JWT_SECRET="your-super-secret-key-change-in-production-12345678"

# WebSocket 服务器端口
WS_PORT=3001

# 客户端 WebSocket URL（暴露给浏览器）
NEXT_PUBLIC_WS_URL="wss://your-domain.com"

# S3/MinIO 配置（生产环境）
S3_ENDPOINT="https://your-s3-endpoint.com"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"
S3_BUCKET="memovault-blobs"
S3_REGION="us-east-1"

# Node 环境
NODE_ENV="production"

# Next.js 配置
PORT=3000
```

### 4. 编译 TypeScript 服务器代码

```bash
# 编译 WebSocket 服务器
npx tsc -p tsconfig.server.json
```

### 5. 测试本地运行

```bash
# 测试 Next.js 应用
npm run dev

# 测试 WebSocket 服务器（另一个终端）
node ws-server.js
```

---

## 🚀 Vercel 部署

### 1. 安装 Vercel CLI

```bash
npm install -g vercel
```

### 2. 登录 Vercel

```bash
vercel login
```

### 3. 部署项目

```bash
# 部署到 Vercel
vercel --prod
```

### 4. 配置环境变量

在 Vercel 控制台中添加以下环境变量：

| 变量名 | 值 |
|--------|---|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `JWT_SECRET` | 强随机密钥（至少 32 字符） |
| `WS_PORT` | `3001` |
| `NEXT_PUBLIC_WS_URL` | `wss://your-app.vercel.app` |

### 5. Vercel 特定配置

创建 `vercel.json` 在项目根目录：

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ]
}
```

### 6. WebSocket 支持

Vercel 原生支持 WebSocket，但需要额外配置。

### 7. 访问应用

部署完成后，Vercel 会提供访问 URL：
```
https://your-app.vercel.app
```

---

## 🌊 Netlify 部署

### 1. 安装 Netlify CLI

```bash
npm install -g netlify-cli
```

### 2. 登录 Netlify

```bash
netlify login
```

### 3. 部署项目

```bash
# 构建项目
npm run build

# 部署到 Netlify
netlify deploy --prod --dir=.next
```

### 4. 配置环境变量

在 Netlify 控制台中添加以下环境变量：

| 变量名 | 值 |
|--------|---|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `JWT_SECRET` | 强随机密钥（至少 32 字符） |
| `WS_PORT` | `3001` |
| `NEXT_PUBLIC_WS_URL` | `wss://your-app.netlify.app` |

### 5. Netlify 特定配置

创建 `netlify.toml` 在项目根目录：

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[redirects]]
  from = "/app/*"
  to = "/index.html"
  status = 200
  force = true
```

### 6. WebSocket 支持

Netlify 支持原生 WebSocket。

---

## 🌊 Railway 部署

### 1. 安装 Railway CLI

```bash
npm install -g @railway/cli
```

### 2. 登录 Railway

```bash
railway login
```

### 3. 创建新项目

在 Railway 控制台中创建新项目，选择：
- **模板：** Next.js
- **仓库：** 选择你的 GitHub 仓库
- **区域：** 选择离你最近的区域

### 4. 配置环境变量

在 Railway 环境变量中添加：

| 变量名 | 值 |
|--------|---|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `JWT_SECRET` | 强随机密钥（至少 32 字符） |
| `WS_PORT` | `3001` |
| `NEXT_PUBLIC_WS_URL` | `wss://your-app.railway.app` |

### 5. 部署 WebSocket 服务器

Railway 需要单独部署 WebSocket 服务器。

**在 Railway 创建新项目：**
- **模板：** Node.js
- **仓库：** 选择你的 GitHub 仓库
- **区域：** 选择离你最近的区域

**配置环境变量：**
- `JWT_SECRET`: 与主项目相同的密钥
- `WS_PORT`: `3001`

**部署 WebSocket 服务器：**
```bash
# 在 Railway 项目中
npm install
# 添加 `server.js` 和 `dist/server/socket.js`
# 配置端口 3001
```

---

## 🌊 Render 部署

### 1. 安装 Render CLI

```bash
npm install -g @render/cli
```

### 2. 登录 Render

```bash
render login
```

### 3. 创建新服务

在 Render 控制台中创建新服务：
- **名称：** `memovault-ws` (WebSocket 服务器)
- **类型：** Web Service
- **区域：** 选择离你最近的区域
- **运行时：** Docker

### 4. 配置环境变量

在 Render 环境变量中添加：

| 变量名 | 值 |
|--------|---|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `JWT_SECRET` | 强随机密钥（至少 32 字符） |
| `WS_PORT` | `3001` |

### 5. 部署 WebSocket 服务器

创建 `render.yaml` 配置文件：

```yaml
services:
  - type: web
    name: memovault-ws
    env: docker
    plan: free
    envVars:
      - key: JWT_SECRET
        sync: false
```

---

## 🌊 DigitalOcean App Platform

### 1. 创建 Droplet

在 DigitalOcean 控制台中创建新的 Droplet：
- **系统：** Ubuntu 22.04 LTS
- **计划：** Basic ($6/月)
- **区域：** 选择离你最近的区域

### 2. 安装依赖

```bash
# SSH 连接到 Droplet
ssh root@your-droplet-ip

# 更新系统
apt update && apt upgrade -y

# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash
```

### 3. 安装 PostgreSQL

```bash
# 安装 PostgreSQL
sudo apt install postgresql postgresql-contrib
sudo -u postgres psql
```

### 4. 配置 PostgreSQL

```bash
# 创建数据库和用户
sudo -u postgres psql << EOF
CREATE DATABASE memovault;
CREATE USER memovault WITH PASSWORD 'strong-password-123';
GRANT ALL PRIVILEGES ON DATABASE memovault TO memovault;
EOF
```

### 5. 配置环境变量

创建 `/root/memovault/.env` 文件：

```bash
# 数据库连接
DATABASE_URL="postgresql://memovault:strong-password-123@localhost:5432/memovault?schema=public"

# JWT 密钥（生成强随机密钥）
JWT_SECRET="your-super-secret-key-change-in-production-12345678"

# WebSocket 服务器端口
WS_PORT=3001

# 客户端 WebSocket URL
NEXT_PUBLIC_WS_URL="wss://your-domain.com"

# Node 环境
NODE_ENV="production"

# Next.js 端口
PORT=3000
```

### 6. 使用 PM2 运行

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start npm run dev --name "memovault-app"

# 启动 WebSocket 服务器
pm2 start node ws-server.js --name "memovault-ws"
```

### 7. 配置 Nginx 反向代理

创建 `/etc/nginx/sites-available/memovault` 配置文件：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Next.js 应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $http_host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # WebSocket 服务器
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $http_host;
        proxy_set_header X-RealIP $remote_addr;
    }
}
```

---

## 🌊 阿里云

### 1. 登录阿里云控制台

访问：https://console.aliyun.com

### 2. 创建 OSS Bucket

在 OSS 控制台中创建新的 Bucket：
- **Bucket 名称：** `memovault-blobs`
- **区域：** 选择离你最近的区域
- **读写权限：** 公共读/私有写

### 3. 配置 OSS 环境变量

在阿里云 RAM 控制台添加环境变量：

| 变量名 | 值 |
|--------|---|
| `S3_ENDPOINT` | `https://your-endpoint.oss-cn-hangzhou.aliyuncs.com` |
| `S3_ACCESS_KEY` | 你的 Access Key ID |
| `S3_SECRET_KEY` | 你的 Access Key Secret |
| `S3_BUCKET` | `memovault-blobs` |

### 4. 创建 PostgreSQL 实例

在阿里云 RDS 中创建 PostgreSQL 实例：
- **数据库引擎：** PostgreSQL
- **实例类型：** Serverless
- **VPC：** 选择离你最近的区域
- **白名单：** 你的 VPC IP

配置连接字符串：
```bash
postgresql://memovault:strong-password-123@rm-xxxxx.rds.aliyuncs.com:3433/memovault?sslmode=require&connect_timeout=10
```

### 5. 配置环境变量

在阿里云 RAM 中添加：

| 变量名 | 值 |
|--------|---|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `JWT_SECRET` | 强随机密钥（至少 32 字符） |
| `WS_PORT` | `3001` |
| `NEXT_PUBLIC_WS_URL` | `wss://your-domain.com` |

---

## 🔒 环境变量配置

### 开发环境 (.env.local)

```bash
# 数据库连接（本地开发）
DATABASE_URL="postgresql://postgresuser:password@localhost:5432/memovault?schema=public"

# JWT 密钥（开发环境）
JWT_SECRET="dev-secret-key-change-in-development"

# WebSocket 服务器端口
WS_PORT=3001

# 客户端 WebSocket URL（开发环境）
NEXT_PUBLIC_WS_URL="ws://localhost:3001"

# S3/MinIO 配置（开发环境 - 使用 MinIO）
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="memovault-dev"
S3_REGION="us-east-1"

# Node 环境
NODE_ENV="development"

# Next.js 配置
PORT=3000
```

### 生产环境 (.env.local)

```bash
# 数据库连接（生产环境 - 使用云数据库）
DATABASE_URL="postgresql://postgresuser:password@your-db-host:5432/memovault?schema=public"

# JWT 密钥（生产环境 - 使用强随机密钥）
JWT_SECRET="your-super-secret-key-change-in-production-12345678"

# WebSocket 服务器端口
WS_PORT=3001

# 客户端 WebSocket URL（生产环境）
NEXT_PUBLIC_WS_URL="wss://your-domain.com"

# S3/MinIO 配置（生产环境）
S3_ENDPOINT="https://your-s3-endpoint.com"
S3_ACCESS_KEY="your-access-key"
S3_SECRET_KEY="your-secret-key"
S3_BUCKET="memovault-blobs"
S3_REGION="us-east-1"

# Node 环境
NODE_ENV="production"

# Next.js 配置
PORT=3000
```

### 重要提示

⚠️ **不要将 `.env.local` 提交到 Git！**
- `.env.local` 已在 `.gitignore` 中
- 生产环境变量在云平台控制台配置

⚠️ **生产环境密钥必须保密**
- 使用强随机字符串（至少 32 字符）
- 不要在代码中硬编码密钥

⚠ **WebSocket 端口配置**
- 开发环境：`ws://localhost:3001`
- 生产环境：`wss://your-domain.com`

---

## 🐛 常见问题解决

### 1. WebSocket 连接失败

**问题：** 应用显示"离线（WebSocket 未启动）"

**可能原因：**
- JWT_SECRET 不匹配
- WebSocket URL 配置错误
- 防火墙阻止连接

**解决方法：**
```bash
# 检查环境变量
echo $JWT_SECRET
echo $NEXT_PUBLIC_WS_URL

# 检查 WebSocket 服务器日志
tail -f logs
```

### 2. 构建失败

**问题：** TypeScript 编译错误

**解决方法：**
```bash
# 清理构建缓存
rm -rf .next

# 重新构建
npm run build

# 如果失败，尝试使用 ts-node
npx ts-node --project tsconfig.server.json src/server/socket.ts
```

### 3. 数据库连接失败

**问题：** 无法连接到 PostgreSQL

**解决方法：**
```bash
# 测试连接
psql $DATABASE_URL

# 检查防火墙规则
# 检查白名单设置
```

### 4. WebSocket 服务器无法启动

**问题：** `node ws-server.js` 启动失败

**可能原因：**
- TypeScript 编译失败
- 端口被占用
- 环境变量未加载

**解决方法：**
```bash
# 检查编译输出
npx tsc -p tsconfig.server.json

# 检查环境变量
echo $WS_PORT

# 使用不同端口
WS_PORT=3002 node ws-server.js
```

### 5. Next.js 应用无法访问

**问题：** 404 Not Found 错误

**解决方法：**
```bash
# 检查构建输出
npm run build

# 检查 Vercel 部署状态
vercel ls
```

### 6. 环境变量未生效

**问题：** `.env.local` 中的值未读取

**解决方法：**
```bash
# 确保在项目根目录
pwd

# 检查文件是否存在
ls -la .env.local

# 检查文件权限
cat .env.local

# 重启服务
pm2 restart all
```

### 7. WebSocket 连接频繁断开

**问题：** 客户端不断重连

**可能原因：**
- 网络不稳定
- WebSocket 超时
- 客户端代码逻辑问题

**解决方法：**
```typescript
// 在客户端添加重连延迟
const RECONNECT_DELAY = 5000; // 5 秒
```

---

## 📝 部署检查清单

### 部署前检查

- [ ] 域名已配置 DNS
- [ ] `.env.local` 已创建并配置
- [ ] PostgreSQL 数据库已创建
- [ ] S3/MinIO Bucket 已创建
- [ ] 环境变量已配置
- [ ] WebSocket 端口已开放
- [ ] 防火墙规则已配置

### 部署后检查

- [ ] Next.js 应用可访问
- [ ] WebSocket 连接成功
- [ ] 数据库连接正常
- [ ] 文件上传/下载功能正常
- [ ] 搜索功能正常
- [ ] 知识图谱可显示
- [ ] 应用性能良好

---

## 🎉 成功部署！

部署完成后，你的应用应该可以通过以下方式访问：

**开发环境：**
- 应用：http://localhost:3000
- WebSocket：ws://localhost:3001

**生产环境：**
- 应用：https://your-domain.com
- WebSocket：wss://your-domain.com

---

## 🆘 需要帮助？

如果遇到问题，请检查以下资源：

1. **Vercel 文档：** https://vercel.com/docs
2. **Next.js 部署：** https://nextjs.org/docs/deployment
3. **PostgreSQL 文档：** https://www.postgresql.org/docs
4. **S3/MinIO 文档：** https://docs.min.io/docs
5. **GitHub Issues：** 搜索项目问题

---

## 📞 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

---

**祝你部署顺利！** 🚀
