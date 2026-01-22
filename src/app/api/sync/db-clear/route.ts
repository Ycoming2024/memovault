/**
 * 清空云端数据 API 路由（使用 PostgreSQL）
 * 删除用户在云端的所有数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// ============================================================================
// DELETE /api/sync/db-clear
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    // 1. 验证认证
    const authResult = await authenticateRequest(request.headers.get('authorization'));
    if (!authResult) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const { userId } = authResult;

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
    const deleted = await prisma.userSyncData.deleteMany({
      where: { userId },
    });

    console.log(`[Sync] Cleared ${deleted.count} records for user ${userId}`);

    // 5. 返回成功
    return NextResponse.json({
      success: true,
      message: deleted > 0 ? 'Data cleared successfully' : 'No data found to clear',
      count: deleted.count,
    });
  } catch (error) {
    console.error('[Sync] Clear error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
