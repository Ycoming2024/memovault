/**
 * MemoVault WebSocket 服务器
 * 集成到 Next.js 自定义服务器
 * 
 * 核心原则：
 * 1. 用户只能加入自己的房间（基于 User ID）
 * 2. 使用 JWT Token 进行认证
 * 3. 转发 Y.js 更新到所有连接的客户端
 * 4. 不存储任何实际内容，仅转发加密的 CRDT 更新
 */

import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from './auth';
import * as Y from 'yjs';

// ============================================================================
// 类型定义
// ============================================================================

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  clientId?: string;
  roomName?: string;
}

interface Room {
  name: string;
  userId: string;
  doc: Y.Doc;
  clients: Set<AuthenticatedWebSocket>;
}

// ============================================================================
// 配置常量
// ============================================================================

const WS_CONFIG = {
  port: parseInt(process.env.WS_PORT || '3001', 10),
  heartbeatInterval: 30000, // 30 秒心跳间隔
  maxRoomSize: 100, // 每个房间最大客户端数
};

// ============================================================================
// WebSocket 服务器类
// ============================================================================

class MemoVaultWebSocketServer {
  private wss: WebSocketServer | null = null;
  private rooms: Map<string, Room> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * 启动 WebSocket 服务器
   */
  start(server?: any): void {
    try {
      this.wss = new WebSocketServer({
        server,
        port: server ? undefined : WS_CONFIG.port,
      });

      console.log(`[WS] WebSocket server started on port ${WS_CONFIG.port}`);

      // 设置连接处理
      this.wss.on('connection', this.handleConnection.bind(this));

      // 启动心跳检测
      this.startHeartbeat();

      // 优雅关闭
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
    } catch (error) {
      console.error('[WS] Failed to start WebSocket server:', error);
      throw error;
    }
  }

  /**
   * 处理新连接
   */
  private async handleConnection(ws: WebSocket, req: any): Promise<void> {
    const authenticatedWs = ws as AuthenticatedWebSocket;

    // 解析 URL 参数
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const userId = url.searchParams.get('userId');
    const roomName = url.searchParams.get('room') || `user-${userId}`;

    console.log(`[WS] New connection attempt: userId=${userId}, room=${roomName}`);

    // 验证认证
    if (!token || !userId) {
      console.warn('[WS] Connection rejected: Missing token or userId');
      this.sendError(ws, 'AUTH_ERROR', 'Missing authentication credentials');
      ws.close(1008, 'Authentication failed');
      return;
    }

    // 验证 JWT Token
    try {
      const decoded = await verifyToken(token);
      if (decoded.userId !== userId) {
        console.warn('[WS] Connection rejected: Token userId mismatch');
        this.sendError(ws, 'AUTH_ERROR', 'Token userId mismatch');
        ws.close(1008, 'Authentication failed');
        return;
      }
    } catch (error) {
      console.error('[WS] Connection rejected: Invalid token', error);
      this.sendError(ws, 'AUTH_ERROR', 'Invalid token');
      ws.close(1008, 'Authentication failed');
      return;
    }

    // 获取或创建房间
    let room = this.rooms.get(roomName);
    if (!room) {
      room = this.createRoom(roomName, userId);
    } else {
      // 验证用户是否可以加入此房间
      if (room.userId !== userId) {
        console.warn(`[WS] Connection rejected: User ${userId} cannot join room ${roomName}`);
        this.sendError(ws, 'AUTH_ERROR', 'Access denied to this room');
        ws.close(1003, 'Access denied');
        return;
      }
    }

    // 检查房间容量
    if (room.clients.size >= WS_CONFIG.maxRoomSize) {
      console.warn(`[WS] Connection rejected: Room ${roomName} is full`);
      this.sendError(ws, 'SYNC_ERROR', 'Room is full');
      ws.close(1013, 'Room is full');
      return;
    }

    // 设置连接属性
    authenticatedWs.userId = userId;
    authenticatedWs.clientId = this.generateClientId();
    authenticatedWs.roomName = roomName;

    // 添加到房间
    room.clients.add(authenticatedWs);
    console.log(`[WS] Client connected: userId=${userId}, clientId=${authenticatedWs.clientId}, room=${roomName}`);

    // 发送连接成功消息
    this.sendMessage(authenticatedWs, 'CONNECTED', {
      clientId: authenticatedWs.clientId,
      roomName,
    });

    // 设置消息处理
    ws.on('message', (data: Buffer) => this.handleMessage(authenticatedWs, data, room));

    // 设置关闭处理
    ws.on('close', () => this.handleClose(authenticatedWs, room));

    // 设置错误处理
    ws.on('error', (error) => {
      console.error(`[WS] WebSocket error for client ${authenticatedWs.clientId}:`, error);
    });

    // 发送当前文档状态（如果需要）
    this.sendInitialState(authenticatedWs, room);
  }

  /**
   * 处理消息
   */
  private handleMessage(
    ws: AuthenticatedWebSocket,
    data: Buffer,
    room: Room
  ): void {
    try {
      // 解析消息（Y.js 二进制格式）
      const update = new Uint8Array(data);

      // 验证更新
      if (update.length === 0) {
        console.warn('[WS] Received empty update');
        return;
      }

      // 应用更新到文档
      Y.applyUpdate(room.doc, update);

      // 广播更新到其他客户端
      this.broadcast(room, update, ws);

      console.log(`[WS] Update processed and broadcasted: clientId=${ws.clientId}, room=${room.name}`);
    } catch (error) {
      console.error('[WS] Error handling message:', error);
      this.sendError(ws, 'SYNC_ERROR', 'Failed to process update');
    }
  }

  /**
   * 处理连接关闭
   */
  private handleClose(ws: AuthenticatedWebSocket, room: Room): void {
    console.log(`[WS] Client disconnected: userId=${ws.userId}, clientId=${ws.clientId}, room=${ws.roomName}`);

    // 从房间移除
    room.clients.delete(ws);

    // 如果房间为空，清理房间
    if (room.clients.size === 0) {
      this.cleanupRoom(room.name);
    }
  }

  /**
   * 创建房间
   */
  private createRoom(name: string, userId: string): Room {
    const doc = new Y.Doc();
    
    // 监听文档更新（用于日志）
    doc.on('update', (update: Uint8Array, _origin: any) => {
      console.log(`[WS] Document updated: room=${name}, size=${update.length} bytes`);
    });

    const room: Room = {
      name,
      userId,
      doc,
      clients: new Set(),
    };

    this.rooms.set(name, room);
    console.log(`[WS] Room created: ${name}`);
    
    return room;
  }

  /**
   * 清理房间
   */
  private cleanupRoom(roomName: string): void {
    const room = this.rooms.get(roomName);
    if (room) {
      room.doc.destroy();
      this.rooms.delete(roomName);
      console.log(`[WS] Room cleaned up: ${roomName}`);
    }
  }

  /**
   * 广播消息到房间内的其他客户端
   */
  private broadcast(
    room: Room,
    data: Uint8Array,
    excludeWs?: AuthenticatedWebSocket
  ): void {
    room.clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (error) {
          console.error(`[WS] Error broadcasting to client ${client.clientId}:`, error);
        }
      }
    });
  }

  /**
   * 发送初始状态
   */
  private sendInitialState(ws: AuthenticatedWebSocket, room: Room): void {
    try {
      // 获取文档状态
      const state = Y.encodeStateAsUpdate(room.doc);
      
      if (state.length > 0) {
        ws.send(state);
        console.log(`[WS] Initial state sent: clientId=${ws.clientId}, size=${state.length} bytes`);
      }
    } catch (error) {
      console.error('[WS] Error sending initial state:', error);
    }
  }

  /**
   * 发送消息
   */
  private sendMessage(
    ws: WebSocket,
    type: string,
    payload?: unknown
  ): void {
    try {
      const message = JSON.stringify({
        type,
        timestamp: Date.now(),
        payload,
      });
      ws.send(message);
    } catch (error) {
      console.error('[WS] Error sending message:', error);
    }
  }

  /**
   * 发送错误消息
   */
  private sendError(ws: WebSocket, code: string, message: string): void {
    this.sendMessage(ws, 'ERROR', {
      code,
      message,
    });
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss?.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, WS_CONFIG.heartbeatInterval);
  }

  /**
   * 生成客户端 ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取房间统计信息
   */
  getStats(): { totalRooms: number; totalClients: number } {
    let totalClients = 0;
    this.rooms.forEach((room) => {
      totalClients += room.clients.size;
    });

    return {
      totalRooms: this.rooms.size,
      totalClients,
    };
  }

  /**
   * 关闭服务器
   */
  shutdown(): void {
    console.log('[WS] Shutting down WebSocket server...');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // 清理所有房间
    this.rooms.forEach((room) => {
      room.clients.forEach((client) => {
        client.close(1001, 'Server shutting down');
      });
      room.doc.destroy();
    });
    this.rooms.clear();

    // 关闭服务器
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    console.log('[WS] WebSocket server shut down');
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const wsServer = new MemoVaultWebSocketServer();

// ============================================================================
// 导出用于 Next.js 自定义服务器的函数
// ============================================================================

export function setupWebSocketServer(server: any): void {
  wsServer.start(server);
}

export function getWebSocketServer(): MemoVaultWebSocketServer {
  return wsServer;
}
