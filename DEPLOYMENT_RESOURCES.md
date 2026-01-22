# 📦 MemoVault 部署资源清单

> **小白友好！** 这里包含了部署 MemoVault 到云服务器所需的所有资源和配置文件。

---

## 📚 文档列表

### 1. **部署指南**
- 📄 [`DEPLOYMENT_README.md`](DEPLOYMENT_README.md) - 部署资源总览（本文档）
- 📄 [`QUICK_DEPLOY.md`](QUICK_DEPLOY.md) - 5 分钟快速部署到 Vercel
- 📄 [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) - 详细的部署指南（支持多个平台）

### 2. **环境变量配置**
- 📄 [`.env.production.example`](.env.production.example) - 生产环境配置模板（详细）
- 📄 [`.env.example`](.env.example) - 开发环境配置模板

### 3. **部署脚本**
- 📄 [`deploy.sh`](deploy.sh) - Linux/Mac 部署脚本
- 📄 [`deploy.bat`](deploy.bat) - Windows 部署脚本

### 4. **平台配置文件**
- 📄 [`vercel.json`](vercel.json) - Vercel 平台配置
- 📄 [`netlify.toml`](netlify.toml) - Netlify 平台配置
- 📄 [`railway.json`](railway.json) - Railway 平台配置
- 📄 [`render.yaml`](render.yaml) - Render 平台配置
- 📄 [`docker-compose.yml`](docker-compose.yml) - Docker Compose 配置
- 📄 [`Dockerfile`](Dockerfile) - Docker 配置
- 📄 [`.dockerignore`](.dockerignore) - Docker 忽略文件

### 5. **健康检查**
- 📄 [`src/app/api/health/route.ts`](src/app/api/health/route.ts) - 健康检查 API 端点

---

## 🚀 快速开始

### 方式 1：使用部署脚本（推荐）

**Windows 用户：**
```bash
# 运行部署脚本
deploy.bat
```

**Linux/Mac 用户：**
```bash
# 添加执行权限
chmod +x deploy.sh

# 运行部署脚本
./deploy.sh
```

### 方式 2：手动部署

#### 1. 准备项目

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 文件
```

#### 2. 推送到 GitHub

```bash
# 初始化 Git 仓库
git init
git add .
git commit -m "Initial commit"

# 添加远程仓库
git remote add origin https://github.com/your-username/memovault.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

#### 3. 部署到云平台

选择一个云平台并按照对应的配置文件部署：

- **Vercel**（推荐）：使用 [`vercel.json`](vercel.json)
- **Netlify**：使用 [`netlify.toml`](netlify.toml)
- **Railway**：使用 [`railway.json`](railway.json)
- **Render**：使用 [`render.yaml`](render.yaml)
- **Docker**：使用 [`Dockerfile`](Dockerfile) 和 [`docker-compose.yml`](docker-compose.yml)

---

## 📖 详细部署指南

### Vercel 部署

1. **安装 Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **部署项目**
   ```bash
   vercel --prod
   ```

4. **配置环境变量**
   - 在 Vercel 控制台中添加环境变量
   - 参考 [`.env.production.example`](.env.production.example)

5. **重新部署**
   ```bash
   vercel --prod
   ```

### Netlify 部署

1. **安装 Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **登录 Netlify**
   ```bash
   netlify login
   ```

3. **构建项目**
   ```bash
   npm run build
   ```

4. **部署项目**
   ```bash
   netlify deploy --prod --dir=.next
   ```

5. **配置环境变量**
   - 在 Netlify 控制台中添加环境变量
   - 参考 [`.env.production.example`](.env.production.example)

### Railway 部署

1. **安装 Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **登录 Railway**
   ```bash
   railway login
   ```

3. **初始化项目**
   ```bash
   railway init
   ```

4. **部署项目**
   ```bash
   railway up
   ```

5. **配置环境变量**
   - 在 Railway 控制台中添加环境变量
   - 参考 [`.env.production.example`](.env.production.example)

### Render 部署

1. **安装 Render CLI**
   ```bash
   npm install -g @render/cli
   ```

2. **登录 Render**
   ```bash
   render login
   ```

3. **部署项目**
   ```bash
   render deploy
   ```

4. **配置环境变量**
   - 在 Render 控制台中添加环境变量
   - 参考 [`render.yaml`](render.yaml)

### Docker 部署

1. **构建 Docker 镜像**
   ```bash
   docker build -t memovault .
   ```

2. **运行 Docker 容器**
   ```bash
   docker run -p 3000:3000 -p 3001:3001 memovault
   ```

3. **使用 Docker Compose**
   ```bash
   # 启动所有服务
   docker-compose up -d

   # 查看日志
   docker-compose logs -f

   # 停止所有服务
   docker-compose down
   ```

---

## 🔧 环境变量配置

### 必需的环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:password@host:port/database` |
| `JWT_SECRET` | JWT 密钥（强随机字符串） | `your-super-secret-key-change-in-production-12345678` |
| `WS_PORT` | WebSocket 服务器端口 | `3001` |
| `NEXT_PUBLIC_WS_URL` | 客户端 WebSocket URL | `wss://your-domain.com` |

### 可选的环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `S3_ENDPOINT` | S3 端点 URL | `https://s3.amazonaws.com` |
| `S3_ACCESS_KEY` | S3 访问密钥 ID | `your-access-key` |
| `S3_SECRET_KEY` | S3 访问密钥 Secret | `your-secret-key` |
| `S3_BUCKET` | S3 存储桶名称 | `memovault-blobs` |
| `S3_REGION` | S3 区域 | `us-east-1` |
| `NODE_ENV` | Node 环境 | `production` |
| `PORT` | Next.js 端口 | `3000` |

### 生成强随机密钥

**Node.js：**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Python：**
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

**在线工具：**
- https://www.random.org/strings/

---

## 🧪 测试部署

### 1. 健康检查

```bash
# 测试健康检查端点
curl https://your-domain.com/api/health
```

**预期响应：**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "uptime_formatted": "1h"
}
```

### 2. 测试登录功能

访问你的应用 URL，测试：
- 注册新账号
- 登录应用
- 创建笔记

### 3. 测试同步功能

在不同设备上登录，测试：
- 创建笔记
- 检查是否同步

### 4. 测试文件上传

测试：
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

### Q5: 环境变量未生效

**解决方法：**
- 确保在平台控制台配置环境变量
- 重新部署应用
- 检查环境变量名称是否正确

---

## 📞 需要帮助？

- 📖 查看 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) 获取详细部署指南
- 📖 查看 [QUICK_DEPLOY.md](QUICK_DEPLOY.md) 获取快速部署指南
- 📖 查看 [README.md](README.md) 了解项目详情
- 📖 查看 [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) 了解集成指南
- 📖 查看 [QUICKSTART.md](QUICKSTART.md) 了解快速开始

---

## 🎯 推荐部署平台

### 初学者（推荐）

1. **Vercel** ⭐⭐⭐⭐⭐
   - 最简单的部署方式
   - 完全免费（个人项目）
   - 自动 HTTPS
   - 全球 CDN 加速

2. **Netlify** ⭐⭐⭐⭐
   - 部署简单
   - 免费额度高
   - 支持 WebSocket

### 有经验用户

3. **Railway** ⭐⭐⭐⭐
   - 支持 PostgreSQL
   - 支持 WebSocket
   - 免费额度高

4. **Render** ⭐⭐⭐⭐
   - 支持 PostgreSQL
   - 支持 WebSocket
   - 支持持久存储

### 高级用户

5. **DigitalOcean** ⭐⭐⭐⭐
   - 完全控制
   - 支持 PostgreSQL
   - 支持 S3 兼容存储

6. **Docker** ⭐⭐⭐⭐⭐
   - 跨平台部署
   - 容器化
   - 易于维护

---

## 🎉 部署成功！

部署完成后，你的应用应该可以通过以下方式访问：

**开发环境：**
- 应用：http://localhost:3000
- WebSocket：ws://localhost:3001

**生产环境：**
- 应用：https://your-domain.com
- WebSocket：wss://your-domain.com

---

## 📝 下一步

1. ✅ 部署应用
2. ✅ 配置数据库
3. ✅ 配置文件存储
4. ✅ 测试所有功能
5. ✅ 享受你的笔记应用！

---

## 📦 部署资源文件清单

### 文档文件
- ✅ `DEPLOYMENT_RESOURCES.md` - 部署资源清单（本文档）
- ✅ `DEPLOYMENT_README.md` - 部署资源总览
- ✅ `QUICK_DEPLOY.md` - 快速部署指南
- ✅ `DEPLOYMENT_GUIDE.md` - 详细部署指南

### 环境变量文件
- ✅ `.env.production.example` - 生产环境配置模板
- ✅ `.env.example` - 开发环境配置模板

### 部署脚本
- ✅ `deploy.sh` - Linux/Mac 部署脚本
- ✅ `deploy.bat` - Windows 部署脚本

### 平台配置文件
- ✅ `vercel.json` - Vercel 配置
- ✅ `netlify.toml` - Netlify 配置
- ✅ `railway.json` - Railway 配置
- ✅ `render.yaml` - Render 配置
- ✅ `docker-compose.yml` - Docker Compose 配置
- ✅ `Dockerfile` - Docker 配置
- ✅ `.dockerignore` - Docker 忽略文件

### API 端点
- ✅ `src/app/api/health/route.ts` - 健康检查 API 端点

---

**祝你部署顺利！** 🚀
