# ========================================
# MemoVault Docker 配置
# ========================================
#
# 用于构建和部署 MemoVault 应用
#
# 使用方法：
# 1. 构建镜像：docker build -t memovault .
# 2. 运行容器：docker run -p 3000:3000 memovault
#
# ========================================

# ========================================
# 阶段 1: 依赖安装
# ========================================
FROM node:18-alpine AS deps

# 安装 libc6-compat（兼容性）
RUN apk add --no-cache libc6-compat

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm ci

# ========================================
# 阶段 2: 构建应用
# ========================================
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 从依赖阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules

# 复制所有文件
COPY . .

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 编译 TypeScript 服务器代码
RUN npx tsc -p tsconfig.server.json

# 构建 Next.js 应用
RUN npm run build

# ========================================
# 阶段 3: 运行应用
# ========================================
FROM node:18-alpine AS runner

# 安装 dumb-init（正确处理信号）
RUN apk add --no-cache dumb-init

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 从构建阶段复制文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/ws-server.js ./ws-server.js

# 修改文件权限
RUN chown -R nextjs:nodejs /app

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npm start & node ws-server.js"]
