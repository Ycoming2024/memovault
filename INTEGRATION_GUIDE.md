# MemoVault 集成指南

本文档说明如何运行和部署 MemoVault 开发服务器，包括 WebSocket 支持。

## 目录

1. [环境准备](#环境准备)
2. [安装依赖](#安装依赖)
3. [数据库配置](#数据库配置)
4. [环境变量配置](#环境变量配置)
5. [运行开发服务器](#运行开发服务器)
6. [项目结构说明](#项目结构说明)
7. [开发工作流](#开发工作流)

---

## 环境准备

### 必需软件

- **Node.js**: >= 18.0.0
- **PostgreSQL**: >= 14.0
- **MinIO** (或 R2/S3): 用于存储加密 Blob（可选，开发环境可使用本地 MinIO）

### 推荐工具

- **VS Code**: 推荐的代码编辑器
- **Postman**: 用于 API 测试
- **Docker**: 用于运行 PostgreSQL 和 MinIO（可选）

---

## 安装依赖

### 1. 克隆项目并安装 npm 包

```bash
# 进入项目目录
cd c:/Users/admin/Desktop/bianqian

# 安装依赖
npm install

# 如果遇到依赖冲突，使用以下命令：
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

然后编辑 `.env.local` 文件，填入实际的数据库连接信息。

### 3. 安装 Prisma CLI

```bash
# Prisma CLI 已在 package.json 中配置，会自动安装
# 如需单独安装：
npm install -g prisma
```

---

## 数据库配置

### 1. 配置 PostgreSQL 连接

创建 `.env` 文件（如果不存在）：

```env
# 数据库连接
DATABASE_URL="postgresql://postgres:password@localhost:5432/memovault?schema=public"

# JWT 密钥（生产环境请使用强随机字符串）
JWT_SECRET="your-super-secret-key-change-in-production"

# WebSocket 端口
WS_PORT=3001

# Next.js 配置
NEXT_PUBLIC_WS_URL="ws://localhost:3001"
```

### 2. 运行数据库迁移

```bash
# 生成 Prisma Client
npx prisma generate

# 推送数据库 schema（开发环境）
npx prisma db push

# 或使用迁移（生产环境推荐）
npx prisma migrate dev --name init
```

### 3. 验证数据库连接

```bash
# 打开 Prisma Studio（可视化数据库管理）
npx prisma studio
```

---

## 环境变量配置

### 开发环境 (.env.local)

```env
# 数据库
DATABASE_URL="postgresql://postgres:password@localhost:5432/memovault?schema=public"

# JWT
JWT_SECRET="dev-secret-key-change-in-production"

# WebSocket
WS_PORT=3001
NEXT_PUBLIC_WS_URL="ws://localhost:3001"

# S3/MinIO (可选)
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="memovault-blobs"
S3_REGION="us-east-1"
```

### 生产环境 (.env.production)

```env
# 使用强密码和真实的 JWT 密钥
DATABASE_URL="postgresql://user:strong-password@prod-db:5432/memovault?schema=public"
JWT_SECRET="生成一个强随机字符串"
WS_PORT=3001
NEXT_PUBLIC_WS_URL="wss://your-domain.com"
```

---

## 运行开发服务器

### 方法 1: 使用 Next.js 开发服务器（推荐用于前端开发）

```bash
# 开发模式（仅 HTTP，无 WebSocket）
npm run dev
```

访问 http://localhost:3000

### 方法 2: 使用自定义服务器（包含 WebSocket 支持）

MemoVault 使用自定义 Next.js 服务器来支持 WebSocket。

#### 启动开发服务器

```bash
# 开发模式（包含 WebSocket）
npm run dev:full

# 生产模式
npm run build
npm start
```

**注意**: WebSocket 服务器需要先编译 TypeScript。如果遇到模块找不到的错误，请先运行 `npm run build`。

### 方法 2: 使用 Docker（推荐用于生产）

#### Docker Compose 配置

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: memovault
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  app:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/memovault?schema=public
      - JWT_SECRET=your-super-secret-key
      - WS_PORT=3001
      - NEXT_PUBLIC_WS_URL=ws://localhost:3001
      - S3_ENDPOINT=http://minio:9000
      - S3_ACCESS_KEY=minioadmin
      - S3_SECRET_KEY=minioadmin
      - S3_BUCKET=memovault-blobs
    depends_on:
      - postgres
      - minio

volumes:
  postgres_data:
  minio_data:
```

#### 启动 Docker 环境

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 停止服务
docker-compose down
```

---

## 项目结构说明

### 核心模块

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   ├── graph/             # 知识图谱页面
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 主页
│
├── components/            # React 组件
│   ├── layout/           # 布局组件
│   ├── editor/           # 编辑器组件
│   ├── graph/            # 图谱组件
│   └── search/           # 搜索组件
│
├── lib/                  # 客户端库
│   ├── db.ts            # Dexie.js 本地数据库
│   ├── crypto.ts        # 加密/解密
│   ├── sync.ts          # Y.js 同步引擎
│   └── search.ts        # Orama 搜索
│
└── server/              # 服务端代码
    ├── socket.ts        # WebSocket 服务器
    ├── auth.ts          # JWT 认证
    └── storage.ts       # S3 存储服务
```

### 数据流

```
用户操作
   ↓
UI 组件
   ↓
Dexie.js (IndexedDB) ← 本地优先，第一真理
   ↓
Y.js (CRDT)
   ↓
WebSocket
   ↓
服务器
   ↓
PostgreSQL (元数据) + S3 (加密 Blob)
```

---

## 开发工作流

### 1. 创建新功能

```bash
# 创建功能分支
git checkout -b feature/your-feature

# 开发功能
# ... 编写代码 ...

# 提交更改
git add .
git commit -m "feat: add your feature"
```

### 2. 测试

```bash
# 运行 TypeScript 检查
npx tsc --noEmit

# 运行 ESLint
npm run lint

# 运行测试（如果配置了）
npm test
```

### 3. 数据库变更

```bash
# 修改 prisma/schema.prisma 后

# 开发环境：直接推送
npx prisma db push

# 生产环境：创建迁移
npx prisma migrate dev --name describe_your_change
```

### 4. 调试

#### 查看浏览器控制台

所有模块都有详细的日志输出：

- `[DB]` - 本地数据库操作
- `[Crypto]` - 加密/解密操作
- `[Sync]` - 同步引擎状态
- `[WS]` - WebSocket 连接状态

#### 查看 Prisma Studio

```bash
npx prisma studio
```

#### 查看 WebSocket 连接

在浏览器开发者工具中：

1. 打开 Network 标签
2. 筛选 WS (WebSocket)
3. 查看连接状态和消息

---

## 常见问题

### Q: WebSocket 连接失败

**A:** 检查以下项目：

1. 确认自定义服务器正在运行
2. 检查 `NEXT_PUBLIC_WS_URL` 环境变量
3. 确认防火墙没有阻止 3001 端口
4. 查看浏览器控制台错误信息

### Q: 数据库连接失败

**A:** 检查以下项目：

1. 确认 PostgreSQL 正在运行
2. 验证 `DATABASE_URL` 连接字符串
3. 确认数据库用户有足够权限
4. 运行 `npx prisma db push` 同步 schema

### Q: 加密/解密失败

**A:** 检查以下项目：

1. 确认密钥管理器已初始化
2. 验证用户密码正确
3. 检查浏览器是否支持 Web Crypto API
4. 查看控制台错误堆栈

### Q: TypeScript 类型错误

**A:** 运行以下命令：

```bash
# 重新生成 Prisma Client
npx prisma generate

# 清理并重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

---

## 生产部署

### 1. 构建应用

```bash
npm run build
```

### 2. 环境变量

确保在生产环境设置所有必需的环境变量：

```env
DATABASE_URL="生产数据库连接"
JWT_SECRET="强随机字符串"
WS_PORT=3001
NEXT_PUBLIC_WS_URL="wss://your-domain.com"
S3_ENDPOINT="S3 端点"
S3_ACCESS_KEY="S3 访问密钥"
S3_SECRET_KEY="S3 密钥"
S3_BUCKET="S3 存储桶"
```

### 3. 使用 PM2 运行（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start server.js --name memovault

# 查看日志
pm2 logs memovault

# 重启应用
pm2 restart memovault
```

### 4. 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # HTTP 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Next.js 应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## 安全建议

1. **JWT 密钥**: 使用强随机字符串，至少 32 字符
2. **数据库密码**: 使用强密码，定期更换
3. **HTTPS**: 生产环境必须使用 HTTPS
4. **CORS**: 严格配置 CORS 策略
5. **速率限制**: 实现 API 速率限制
6. **输入验证**: 验证所有用户输入
7. **依赖更新**: 定期更新依赖包

---

## 下一步

- [ ] 实现 API 路由（登录、上传 Blob）
- [ ] 实现知识图谱可视化（Cytoscape.js）
- [ ] 实现全文搜索（Orama）
- [ ] 添加单元测试
- [ ] 添加 E2E 测试
- [ ] 编写 API 文档
- [ ] 性能优化

---

## 联系方式

如有问题，请提交 Issue 或联系开发团队。
