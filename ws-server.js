/**
 * MemoVault WebSocket 服务器（独立运行）
 * 仅运行 WebSocket 服务器，不包含 Next.js HTTP 服务器
 * 
 * 使用方法：
 * 1. 先运行 `npm run dev` 启动 Next.js 开发服务器（端口 3000）
 * 2. 然后运行 `node ws-server.js` 启动 WebSocket 服务器（端口 3001）
 */

// 加载环境变量（必须在导入其他模块之前）
require('dotenv').config({ path: '.env.local' });

const http = require('http');

// 导入编译后的 WebSocket 服务器模块
const { setupWebSocketServer } = require('./dist/server/socket');

// 创建一个简单的 HTTP 服务器用于 WebSocket 升级
const httpServer = http.createServer((req, res) => {
  // 这个 HTTP 服务器仅用于 WebSocket 升级
  res.writeHead(200);
  res.end('WebSocket server is running');
});

// 启动 WebSocket 服务器
setupWebSocketServer(httpServer);

// 监听端口 3001
const PORT = process.env.WS_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`> WebSocket server on ws://localhost:${PORT}`);
  console.log(`> Ready on http://localhost:${PORT}`);
  console.log('> WebSocket server is running independently');
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('[WS] SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('[WS] HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[WS] SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('[WS] HTTP server closed');
    process.exit(0);
  });
});
