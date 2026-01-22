#!/bin/bash

# MemoVault 部署脚本
# 用于快速部署到云服务器

set -e  # 遇到错误立即退出

echo "========================================="
echo "  MemoVault 部署脚本"
echo "========================================="
echo ""

# 检查环境变量
if [ ! -f .env.local ]; then
    echo "❌ 错误：.env.local 文件不存在"
    echo "请先创建 .env.local 文件并配置环境变量"
    exit 1
fi

echo "✅ 环境变量文件存在"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误：Node.js 未安装"
    echo "请先安装 Node.js 18+"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误：npm 未安装"
    exit 1
fi

echo "✅ npm 版本: $(npm --version)"
echo ""

# 询问部署目标
echo "请选择部署目标："
echo "1) Vercel (推荐)"
echo "2) Netlify"
echo "3) Railway"
echo "4) Render"
echo "5) DigitalOcean"
echo "6) 阿里云"
echo ""
read -p "请输入选项 (1-6): " choice

case $choice in
    1)
        echo ""
        echo "🚀 部署到 Vercel..."
        
        # 检查 Vercel CLI
        if ! command -v vercel &> /dev/null; then
            echo "安装 Vercel CLI..."
            npm install -g vercel
        fi
        
        # 登录
        echo "请登录 Vercel..."
        vercel login
        
        # 部署
        echo "部署到 Vercel..."
        vercel --prod
        
        echo ""
        echo "✅ 部署完成！"
        echo "请访问 Vercel 控制台配置环境变量"
        ;;
        
    2)
        echo ""
        echo "🚀 部署到 Netlify..."
        
        # 检查 Netlify CLI
        if ! command -v netlify &> /dev/null; then
            echo "安装 Netlify CLI..."
            npm install -g netlify-cli
        fi
        
        # 登录
        echo "请登录 Netlify..."
        netlify login
        
        # 构建
        echo "构建项目..."
        npm run build
        
        # 部署
        echo "部署到 Netlify..."
        netlify deploy --prod --dir=.next
        
        echo ""
        echo "✅ 部署完成！"
        echo "请访问 Netlify 控制台配置环境变量"
        ;;
        
    3)
        echo ""
        echo "🚀 部署到 Railway..."
        
        # 检查 Railway CLI
        if ! command -v railway &> /dev/null; then
            echo "安装 Railway CLI..."
            npm install -g @railway/cli
        fi
        
        # 登录
        echo "请登录 Railway..."
        railway login
        
        # 初始化项目
        echo "初始化 Railway 项目..."
        railway init
        
        # 部署
        echo "部署到 Railway..."
        railway up
        
        echo ""
        echo "✅ 部署完成！"
        echo "请访问 Railway 控制台配置环境变量"
        ;;
        
    4)
        echo ""
        echo "🚀 部署到 Render..."
        
        # 检查 Render CLI
        if ! command -v render &> /dev/null; then
            echo "安装 Render CLI..."
            npm install -g @render/cli
        fi
        
        # 登录
        echo "请登录 Render..."
        render login
        
        # 部署
        echo "部署到 Render..."
        render deploy
        
        echo ""
        echo "✅ 部署完成！"
        echo "请访问 Render 控制台配置环境变量"
        ;;
        
    5)
        echo ""
        echo "🚀 部署到 DigitalOcean..."
        echo ""
        echo "请按照以下步骤操作："
        echo "1. 在 DigitalOcean 控制台创建 Droplet"
        echo "2. SSH 连接到 Droplet"
        echo "3. 运行以下命令："
        echo ""
        echo "   # 更新系统"
        echo "   apt update && apt upgrade -y"
        echo ""
        echo "   # 安装 Node.js"
        echo "   curl -fsSL https://deb.nodesource.com/setup_18.x | bash"
        echo "   apt install -y nodejs"
        echo ""
        echo "   # 安装 PM2"
        echo "   npm install -g pm2"
        echo ""
        echo "   # 克隆项目"
        echo "   git clone <your-repo-url> memovault"
        echo "   cd memovault"
        echo ""
        echo "   # 安装依赖"
        echo "   npm install"
        echo ""
        echo "   # 编译 TypeScript"
        echo "   npx tsc -p tsconfig.server.json"
        echo ""
        echo "   # 配置环境变量"
        echo "   nano .env.local"
        echo ""
        echo "   # 启动应用"
        echo "   pm2 start npm run dev --name 'memovault-app'"
        echo "   pm2 start node ws-server.js --name 'memovault-ws'"
        echo ""
        echo "   # 配置 Nginx 反向代理"
        echo "   nano /etc/nginx/sites-available/memovault"
        echo ""
        echo "✅ DigitalOcean 部署指南已显示"
        ;;
        
    6)
        echo ""
        echo "🚀 部署到阿里云..."
        echo ""
        echo "请按照以下步骤操作："
        echo "1. 登录阿里云控制台"
        echo "2. 创建 OSS Bucket"
        echo "3. 创建 PostgreSQL 实例"
        echo "4. 配置环境变量"
        echo "5. 使用 Vercel/Netlify 部署应用"
        echo ""
        echo "环境变量配置："
        echo "DATABASE_URL='postgresql://user:password@rm-xxxxx.rds.aliyuncs.com:3433/memovault'"
        echo "S3_ENDPOINT='https://your-endpoint.oss-cn-hangzhou.aliyuncs.com'"
        echo "S3_ACCESS_KEY='your-access-key'"
        echo "S3_SECRET_KEY='your-secret-key'"
        echo "S3_BUCKET='memovault-blobs'"
        echo ""
        echo "✅ 阿里云部署指南已显示"
        ;;
        
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac

echo ""
echo "========================================="
echo "  部署完成！"
echo "========================================="
echo ""
echo "下一步："
echo "1. 在云平台控制台配置环境变量"
echo "2. 确保数据库连接正常"
echo "3. 测试应用功能"
echo ""
echo "详细部署指南请查看 DEPLOYMENT_GUIDE.md"
echo ""
