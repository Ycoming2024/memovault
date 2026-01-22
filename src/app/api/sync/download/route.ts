/**
 * 同步下载 API 路由
 * 从云端下载用户数据
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
// GET /api/sync/download
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
        { error: 'No data found for this user' },
        { status: 404 }
      );
    }

    console.log(`[Sync] Downloaded data for user ${userId}, version ${syncData.version}`);

    // 5. 返回数据
    return NextResponse.json({
      data: syncData.data,
      version: syncData.version,
      timestamp: syncData.timestamp,
    });
  } catch (error) {
    console.error('[Sync] Download error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
