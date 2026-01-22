/**
 * MemoVault 自定义服务器
 * 集成 Next.js 和 WebSocket 服务器
 * 
 * 功能：
 * - 提供 Next.js HTTP 服务
 * - 集成 WebSocket 服务器用于实时同步
 * - 支持开发和生产环境
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// 注意：WebSocket 服务器需要 TypeScript 编译
// 在生产环境中，应该使用编译后的 .js 文件
// 开发环境中，我们需要先编译 TypeScript 或使用 ts-node

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// 创建 Next.js 应用
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // 创建 HTTP 服务器
  const server = createServer(async (req, res) => {
    try {
      // 解析 URL
      const parsedUrl = parse(req.url, true);
      
      // 处理 Next.js 请求
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // 注意：WebSocket 服务器需要先编译 TypeScript
  // 在开发环境中，先运行 TypeScript 编译器
  // 或者使用 ts-node 运行
  
  // 设置 WebSocket 服务器（需要编译后的模块）
  try {
    const { setupWebSocketServer } = require('./dist/server/socket');
    setupWebSocketServer(server);
    console.log(`> WebSocket server on ws://${hostname}:${process.env.WS_PORT || '3001'}`);
  } catch (error) {
    console.warn('WebSocket server not available. Run "npm run build" first or use ts-node for development.');
    console.warn('For development without WebSocket, the app will still work in offline mode.');
  }

  // 启动服务器
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
