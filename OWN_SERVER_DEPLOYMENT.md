# 🖥️ MemoVault 自有服务器部署指南

> **小白友好！** 使用你自己的服务器部署 MemoVault 应用。

---

## 📋 目录

1. [前置条件](#前置条件)
2. [服务器准备](#服务器准备)
3. [数据库配置](#数据库配置)
4. [文件存储配置](#文件存储配置)
5. [应用部署](#应用部署)
6. [Nginx 反向代理](#nginx-反向代理)
7. [SSL 证书配置](#ssl-证书配置)
8. [PM2 进程管理](#pm2-进程管理)
9. [防火墙配置](#防火墙配置)
10. [测试部署](#测试部署)
11. [常见问题](#常见问题)

---

## 前置条件

### 服务器要求

- **操作系统**：Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- **内存**：至少 2GB RAM
- **存储**：至少 20GB 磁盘空间
- **网络**：稳定的网络连接
- **域名**：一个已解析到服务器 IP 的域名（可选）

### 本地要求

- **SSH 客户端**：用于连接服务器
- **Git**：用于克隆项目
- **文本编辑器**：用于编辑配置文件

---

## 服务器准备

### 1. 连接到服务器

```bash
# 使用 SSH 连接到服务器
ssh root@your-server-ip

# 或使用密钥
ssh -i /path/to/your-key.pem root@your-server-ip
```

### 2. 更新系统

```bash
# Ubuntu/Debian
apt update && apt upgrade -y

# CentOS/RHEL
yum update -y
```

### 3. 安装 Node.js 18+

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | bash
apt install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash
yum install -y nodejs

# 验证安装
node --version
npm --version
```

### 4. 安装 PM2（进程管理器）

```bash
npm install -g pm2

# 验证安装
pm2 --version
```

### 5. 安装 Nginx（反向代理）

```bash
# Ubuntu/Debian
apt install -y nginx

# CentOS/RHEL
yum install -y nginx

# 启动 Nginx
systemctl start nginx
systemctl enable nginx

# 验证安装
nginx -v
```

### 6. 安装 Git

```bash
# Ubuntu/Debian
apt install -y git

# CentOS/RHEL
yum install -y git

# 验证安装
git --version
```

---

## 数据库配置

### 1. 安装 PostgreSQL

```bash
# Ubuntu/Debian
apt install -y postgresql postgresql-contrib

# CentOS/RHEL
yum install -y postgresql-server postgresql-contrib
postgresql-setup initdb

# 启动 PostgreSQL
systemctl start postgresql
systemctl enable postgresql
```

### 2. 创建数据库和用户

```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 在 PostgreSQL 命令行中执行以下命令
CREATE DATABASE memovault;
CREATE USER memovault WITH PASSWORD 'your-strong-password-123';
GRANT ALL PRIVILEGES ON DATABASE memovault TO memovault;
\q

# 测试连接
psql -h localhost -U memovault -d memovault -W
```

### 3. 配置 PostgreSQL 远程访问（可选）

```bash
# 编辑 PostgreSQL 配置文件
nano /etc/postgresql/*/main/postgresql.conf

# 修改以下行
listen_addresses = '*'

# 编辑 pg_hba.conf
nano /etc/postgresql/*/main/pg_hba.conf

# 添加以下行（允许远程连接）
host    all             all             0.0.0.0/0               md5

# 重启 PostgreSQL
systemctl restart postgresql
```

### 4. 配置防火墙（PostgreSQL 端口 5432）

```bash
# Ubuntu (UFW)
ufw allow 5432/tcp

# CentOS (firewalld)
firewall-cmd --permanent --add-port=5432/tcp
firewall-cmd --reload
```

---

## 文件存储配置

### 选项 1：使用 MinIO（推荐）

#### 安装 MinIO

```bash
# 下载 MinIO
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
mv minio /usr/local/bin/

# 创建数据目录
mkdir -p /data/minio

# 创建 MinIO 用户
useradd -r minio -s /sbin/nologin
chown minio:minio /data/minio
```

#### 配置 MinIO

```bash
# 创建 MinIO 配置文件
nano /etc/default/minio

# 添加以下内容
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_VOLUMES="/data/minio"
MINIO_OPTS="--address :9000 --console-address :9001"
```

#### 创建 MinIO 服务

```bash
# 创建 systemd 服务文件
nano /etc/systemd/system/minio.service

# 添加以下内容
[Unit]
Description=MinIO
Documentation=https://docs.min.io
Wants=network-online.target
After=network-online.target
AssertFileIsExecutable=/usr/local/bin/minio

[Service]
WorkingDirectory=/usr/local/sbin/

User=minio
Group=minio
EnvironmentFile=-/etc/default/minio
ExecStart=/usr/local/bin/minio server $MINIO_OPTS $MINIO_VOLUMES

# Let systemd restart this service always
Restart=always

# Specifies the maximum file descriptor number that can be opened by this process
LimitNOFILE=65536

# Disable timeout logic and wait until process is stopped
TimeoutStopSec=infinity
SendSIGKILL=no

[Install]
WantedBy=multi-user.target
```

#### 启动 MinIO

```bash
# 重载 systemd
systemctl daemon-reload

# 启动 MinIO
systemctl start minio
systemctl enable minio

# 验证运行
systemctl status minio
```

#### 访问 MinIO 控制台

- **控制台地址**：http://your-server-ip:9001
- **默认用户名**：minioadmin
- **默认密码**：minioadmin123

#### 创建存储桶

1. 登录 MinIO 控制台
2. 点击 "Buckets" → "Create Bucket"
3. 输入存储桶名称：`memovault-blobs`
4. 点击 "Create Bucket"

### 选项 2：使用 AWS S3

如果你有 AWS S3 账号，可以直接使用 AWS S3。

1. 登录 AWS 控制台
2. 进入 S3 服务
3. 创建存储桶：`memovault-blobs`
4. 创建 IAM 用户并授予 S3 访问权限
5. 获取 Access Key 和 Secret Key

---

## 应用部署

### 1. 克隆项目

```bash
# 创建应用目录
mkdir -p /var/www/memovault
cd /var/www/memovault

# 克隆项目（替换为你的 GitHub 仓库）
git clone https://github.com/your-username/memovault.git .

# 或上传本地项目
# 使用 scp 或 rsync 上传项目文件
```

### 2. 安装依赖

```bash
cd /var/www/memovault

# 安装依赖
npm install

# 或使用 yarn
# yarn install
```

### 3. 编译 TypeScript 服务器代码

```bash
# 编译 WebSocket 服务器
npx tsc -p tsconfig.server.json
```

### 4. 配置环境变量

```bash
# 创建 .env.local 文件
nano /var/www/memovault/.env.local

# 添加以下内容
# 数据库配置
DATABASE_URL="postgresql://memovault:your-strong-password-123@localhost:5432/memovault?schema=public"

# JWT 配置（生成强随机密钥）
JWT_SECRET="your-super-secret-key-change-in-production-12345678"

# WebSocket 配置
WS_PORT=3001
NEXT_PUBLIC_WS_URL="wss://your-domain.com"

# S3/MinIO 配置
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin123"
S3_BUCKET="memovault-blobs"
S3_REGION="us-east-1"

# Node 环境
NODE_ENV="production"

# Next.js 端口
PORT=3000
```

### 5. 构建应用

```bash
cd /var/www/memovault

# 构建应用
npm run build
```

### 6. 使用 PM2 启动应用

```bash
# 启动 Next.js 应用
pm2 start npm --name "memovault-app" -- start

# 启动 WebSocket 服务器
pm2 start node --name "memovault-ws" -- ws-server.js

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 设置开机自启
pm2 startup
pm2 save
```

---

## Nginx 反向代理

### 1. 创建 Nginx 配置文件

```bash
# 创建 Nginx 配置文件
nano /etc/nginx/sites-available/memovault
```

### 2. 添加配置内容

```nginx
# HTTP 重定向到 HTTPS（可选）
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Let's Encrypt 验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # 其他请求重定向到 HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 配置
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL 证书配置（见 SSL 证书配置部分）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Next.js 应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 服务器
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态文件缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. 启用配置

```bash
# 创建符号链接
ln -s /etc/nginx/sites-available/memovault /etc/nginx/sites-enabled/

# 删除默认配置（可选）
rm /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 重载 Nginx
systemctl reload nginx
```

---

## SSL 证书配置

### 使用 Let's Encrypt（免费）

#### 1. 安装 Certbot

```bash
# Ubuntu/Debian
apt install -y certbot python3-certbot-nginx

# CentOS/RHEL
yum install -y certbot python3-certbot-nginx
```

#### 2. 获取 SSL 证书

```bash
# 自动配置 Nginx
certbot --nginx -d your-domain.com -d www.your-domain.com

# 或手动获取证书
certbot certonly --nginx -d your-domain.com -d www.your-domain.com
```

#### 3. 自动续期

```bash
# 测试续期
certbot renew --dry-run

# 添加自动续期任务
crontab -e

# 添加以下行（每天凌晨 3 点检查续期）
0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

---

## PM2 进程管理

### 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs

# 查看特定应用的日志
pm2 logs memovault-app

# 重启应用
pm2 restart all

# 停止应用
pm2 stop all

# 启动应用
pm2 start all

# 删除应用
pm2 delete all

# 监控
pm2 monit
```

### PM2 配置文件

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [
    {
      name: 'memovault-app',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/memovault',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'memovault-ws',
      script: 'node',
      args: 'ws-server.js',
      cwd: '/var/www/memovault',
      env: {
        NODE_ENV: 'production',
        WS_PORT: 3001
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

使用配置文件启动：

```bash
# 使用配置文件启动
pm2 start ecosystem.config.js

# 保存配置
pm2 save
```

---

## 防火墙配置

### Ubuntu (UFW)

```bash
# 启用 UFW
ufw enable

# 允许 SSH
ufw allow 22/tcp

# 允许 HTTP
ufw allow 80/tcp

# 允许 HTTPS
ufw allow 443/tcp

# 允许 PostgreSQL（如果需要远程访问）
ufw allow 5432/tcp

# 查看状态
ufw status
```

### CentOS (firewalld)

```bash
# 启用 firewalld
systemctl start firewalld
systemctl enable firewalld

# 允许 SSH
firewall-cmd --permanent --add-service=ssh

# 允许 HTTP
firewall-cmd --permanent --add-service=http

# 允许 HTTPS
firewall-cmd --permanent --add-service=https

# 允许 PostgreSQL（如果需要远程访问）
firewall-cmd --permanent --add-port=5432/tcp

# 重载防火墙
firewall-cmd --reload

# 查看状态
firewall-cmd --list-all
```

---

## 测试部署

### 1. 测试应用访问

```bash
# 测试 HTTP
curl -I http://your-domain.com

# 测试 HTTPS
curl -I https://your-domain.com

# 测试健康检查
curl https://your-domain.com/api/health
```

### 2. 测试 WebSocket 连接

```bash
# 使用 wscat 测试 WebSocket
npm install -g wscat
wscat -c wss://your-domain.com/ws
```

### 3. 测试数据库连接

```bash
# 测试 PostgreSQL 连接
psql -h localhost -U memovault -d memovault -W
```

### 4. 测试文件存储

```bash
# 测试 MinIO 连接
curl -I http://localhost:9000/minio/health/live
```

---

## 常见问题

### Q1: 应用无法启动

**检查步骤：**
```bash
# 查看 PM2 日志
pm2 logs

# 查看应用错误
pm2 logs --err

# 检查端口是否被占用
netstat -tulpn | grep :3000
netstat -tulpn | grep :3001
```

### Q2: Nginx 502 Bad Gateway

**解决方法：**
```bash
# 检查应用是否运行
pm2 status

# 检查 Nginx 配置
nginx -t

# 查看错误日志
tail -f /var/log/nginx/error.log
```

### Q3: WebSocket 连接失败

**解决方法：**
```bash
# 检查 WebSocket 服务器是否运行
pm2 status memovault-ws

# 检查端口是否开放
netstat -tulpn | grep :3001

# 检查 Nginx 配置
cat /etc/nginx/sites-available/memovault | grep -A 10 "location /ws"
```

### Q4: SSL 证书错误

**解决方法：**
```bash
# 检查证书状态
certbot certificates

# 续期证书
certbot renew

# 重载 Nginx
systemctl reload nginx
```

### Q5: 数据库连接失败

**解决方法：**
```bash
# 检查 PostgreSQL 是否运行
systemctl status postgresql

# 测试连接
psql -h localhost -U memovault -d memovault -W

# 检查防火墙
ufw status | grep 5432
```

### Q6: 文件上传失败

**解决方法：**
```bash
# 检查 MinIO 是否运行
systemctl status minio

# 测试 MinIO 连接
curl -I http://localhost:9000/minio/health/live

# 检查存储桶权限
# 登录 MinIO 控制台检查存储桶策略
```

---

## 维护和监控

### 1. 查看应用日志

```bash
# PM2 日志
pm2 logs

# Nginx 访问日志
tail -f /var/log/nginx/access.log

# Nginx 错误日志
tail -f /var/log/nginx/error.log

# PostgreSQL 日志
tail -f /var/log/postgresql/postgresql-*.log
```

### 2. 更新应用

```bash
# 进入应用目录
cd /var/www/memovault

# 拉取最新代码
git pull

# 安装依赖
npm install

# 重新构建
npm run build

# 重启应用
pm2 restart all
```

### 3. 备份数据库

```bash
# 备份 PostgreSQL 数据库
pg_dump -U memovault memovault > backup_$(date +%Y%m%d_%H%M%S).sql

# 恢复数据库
psql -U memovault memovault < backup_20240101_120000.sql
```

### 4. 监控服务器资源

```bash
# 查看系统资源
htop

# 查看磁盘使用
df -h

# 查看内存使用
free -h

# 查看网络连接
netstat -tulpn
```

---

## 🎉 部署完成！

部署完成后，你的应用应该可以通过以下方式访问：

**HTTP：**
- 应用：http://your-domain.com
- WebSocket：ws://your-domain.com/ws

**HTTPS：**
- 应用：https://your-domain.com
- WebSocket：wss://your-domain.com/ws

---

## 📚 相关文档

- 📖 查看 [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) 获取其他平台部署指南
- 📖 查看 [`QUICK_DEPLOY.md`](QUICK_DEPLOY.md) 获取快速部署指南
- 📖 查看 [`DEPLOYMENT_RESOURCES.md`](DEPLOYMENT_RESOURCES.md) 获取部署资源清单

---

**祝你部署顺利！** 🚀
