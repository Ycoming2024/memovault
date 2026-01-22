/**
 * 同步版本检查 API 路由（使用 PostgreSQL）
 * 检查云端数据的版本
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/sync/db-version
// ============================================================================

export async function GET(request: NextRequest) {
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
    const syncData = await prisma.userSyncData.findUnique({
      where: { userId },
    });

    if (!syncData) {
      return NextResponse.json(
        { version: null, message: 'No data found' },
        { status: 200 }
      );
    }

    // 5. 返回版本信息
    return NextResponse.json({
      version: syncData.version.toString(),
      timestamp: syncData.createdAt.getTime(),
    });
  } catch (error) {
    console.error('[Sync] Version check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
