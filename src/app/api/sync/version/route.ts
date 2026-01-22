/**
 * 同步版本检查 API 路由
 * 检查云端数据的版本
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/server/auth';

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// ============================================================================
// 内存存储（生产环境应使用数据库）
// ============================================================================

const syncDataStore: Map<string, { data: string; version: number; timestamp: number }> = new Map();

// ============================================================================
// GET /api/sync/version
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // 1. 验证认证
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = await verifyToken(token);
    const userId = decoded.userId;

    // 2. 获取查询参数
    const { searchParams } = new URL(request.url);
    const requestUserId = searchParams.get('userId');

    // 3. 验证用户 ID
    if (requestUserId !== userId) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // 4. 查找数据
    const syncData = syncDataStore.get(userId);

    if (!syncData) {
      return NextResponse.json(
        { version: null, message: 'No data found' },
        { status: 200 }
      );
    }

    // 5. 返回版本信息
    return NextResponse.json({
      version: syncData.version,
      timestamp: syncData.timestamp,
    });
  } catch (error) {
    console.error('[Sync] Version check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
