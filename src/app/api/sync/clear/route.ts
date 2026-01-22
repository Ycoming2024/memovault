/**
 * 清空云端数据 API 路由
 * 删除用户在云端的所有数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/server/auth';

// ============================================================================
// 内存存储（生产环境应使用数据库）
// ============================================================================

const syncDataStore: Map<string, { data: string; version: number; timestamp: number }> = new Map();

// ============================================================================
// DELETE /api/sync/clear
// ============================================================================

export async function DELETE(request: NextRequest) {
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

    // 2. 解析请求体
    const body = await request.json();
    const { userId: requestUserId } = body;

    // 3. 验证用户 ID
    if (requestUserId !== userId) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // 4. 删除数据
    const deleted = syncDataStore.delete(userId);

    console.log(`[Sync] Cleared data for user ${userId}, deleted: ${deleted}`);

    // 5. 返回成功
    return NextResponse.json({
      success: true,
      message: deleted ? 'Data cleared successfully' : 'No data found to clear',
    });
  } catch (error) {
    console.error('[Sync] Clear error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
