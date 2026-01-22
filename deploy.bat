@echo off
REM MemoVault 部署脚本 (Windows)
REM 用于快速部署到云服务器

echo =========================================
echo   MemoVault 部署脚本 (Windows)
echo =========================================
echo.

REM 检查环境变量文件
if not exist .env.local (
    echo ❌ 错误：.env.local 文件不存在
    echo 请先创建 .env.local 文件并配置环境变量
    pause
    exit /b 1
)

echo ✅ 环境变量文件存在
echo.

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误：Node.js 未安装
    echo 请先安装 Node.js 18+
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js 版本: %NODE_VERSION%
echo.

REM 检查 npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误：npm 未安装
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✅ npm 版本: %NPM_VERSION%
echo.

REM 询问部署目标
echo 请选择部署目标：
echo 1) Vercel (推荐)
echo 2) Netlify
echo 3) Railway
echo 4) Render
echo 5) DigitalOcean
echo 6) 阿里云
echo.
set /p choice="请输入选项 (1-6): "

if "%choice%"=="1" goto vercel
if "%choice%"=="2" goto netlify
if "%choice%"=="3" goto railway
if "%choice%"=="4" goto render
if "%choice%"=="5" goto digitalocean
if "%choice%"=="6" goto aliyun

echo ❌ 无效选项
pause
exit /b 1

:vercel
echo.
echo 🚀 部署到 Vercel...

REM 检查 Vercel CLI
where vercel >nul 2>nul
if %errorlevel% neq 0 (
    echo 安装 Vercel CLI...
    call npm install -g vercel
)

REM 登录
echo 请登录 Vercel...
call vercel login

REM 部署
echo 部署到 Vercel...
call vercel --prod

echo.
echo ✅ 部署完成！
echo 请访问 Vercel 控制台配置环境变量
goto end

:netlify
echo.
echo 🚀 部署到 Netlify...

REM 检查 Netlify CLI
where netlify >nul 2>nul
if %errorlevel% neq 0 (
    echo 安装 Netlify CLI...
    call npm install -g netlify-cli
)

REM 登录
echo 请登录 Netlify...
call netlify login

REM 构建
echo 构建项目...
call npm run build

REM 部署
echo 部署到 Netlify...
call netlify deploy --prod --dir=.next

echo.
echo ✅ 部署完成！
echo 请访问 Netlify 控制台配置环境变量
goto end

:railway
echo.
echo 🚀 部署到 Railway...

REM 检查 Railway CLI
where railway >nul 2>nul
if %errorlevel% neq 0 (
    echo 安装 Railway CLI...
    call npm install -g @railway/cli
)

REM 登录
echo 请登录 Railway...
call railway login

REM 初始化项目
echo 初始化 Railway 项目...
call railway init

REM 部署
echo 部署到 Railway...
call railway up

echo.
echo ✅ 部署完成！
echo 请访问 Railway 控制台配置环境变量
goto end

:render
echo.
echo 🚀 部署到 Render...

REM 检查 Render CLI
where render >nul 2>nul
if %errorlevel% neq 0 (
    echo 安装 Render CLI...
    call npm install -g @render/cli
)

REM 登录
echo 请登录 Render...
call render login

REM 部署
echo 部署到 Render...
call render deploy

echo.
echo ✅ 部署完成！
echo 请访问 Render 控制台配置环境变量
goto end

:digitalocean
echo.
echo 🚀 部署到 DigitalOcean...
echo.
echo 请按照以下步骤操作：
echo 1. 在 DigitalOcean 控制台创建 Droplet
echo 2. SSH 连接到 Droplet
echo 3. 运行以下命令：
echo.
echo    # 更新系统
echo    apt update ^&^& apt upgrade -y
echo.
echo    # 安装 Node.js
echo    curl -fsSL https://deb.nodesource.com/setup_18.x ^| bash
echo    apt install -y nodejs
echo.
echo    # 安装 PM2
echo    npm install -g pm2
echo.
echo    # 克隆项目
echo    git clone ^<your-repo-url^> memovault
echo    cd memovault
echo.
echo    # 安装依赖
echo    npm install
echo.
echo    # 编译 TypeScript
echo    npx tsc -p tsconfig.server.json
echo.
echo    # 配置环境变量
echo    nano .env.local
echo.
echo    # 启动应用
echo    pm2 start npm run dev --name 'memovault-app'
echo    pm2 start node ws-server.js --name 'memovault-ws'
echo.
echo    # 配置 Nginx 反向代理
echo    nano /etc/nginx/sites-available/memovault
echo.
echo ✅ DigitalOcean 部署指南已显示
goto end

:aliyun
echo.
echo 🚀 部署到阿里云...
echo.
echo 请按照以下步骤操作：
echo 1. 登录阿里云控制台
echo 2. 创建 OSS Bucket
echo 3. 创建 PostgreSQL 实例
echo 4. 配置环境变量
echo 5. 使用 Vercel/Netlify 部署应用
echo.
echo 环境变量配置：
echo DATABASE_URL='postgresql://user:password@rm-xxxxx.rds.aliyuncs.com:3433/memovault'
echo S3_ENDPOINT='https://your-endpoint.oss-cn-hangzhou.aliyuncs.com'
echo S3_ACCESS_KEY='your-access-key'
echo S3_SECRET_KEY='your-secret-key'
echo S3_BUCKET='memovault-blobs'
echo.
echo ✅ 阿里云部署指南已显示
goto end

:end
echo.
echo =========================================
echo   部署完成！
echo =========================================
echo.
echo 下一步：
echo 1. 在云平台控制台配置环境变量
echo 2. 确保数据库连接正常
echo 3. 测试应用功能
echo.
echo 详细部署指南请查看 DEPLOYMENT_GUIDE.md
echo.
pause
