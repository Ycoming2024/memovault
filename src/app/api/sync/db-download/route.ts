/**
 * 同步下载 API 路由（使用 PostgreSQL）
 * 从云端数据库下载用户数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/sync/db-download
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
        { error: 'No data found for this user' },
        { status: 404 }
      );
    }

    console.log(`[Sync] Downloaded data for user ${userId}, version ${syncData.version}`);

    // 5. 返回数据
    return NextResponse.json({
      data: syncData.data,
      version: syncData.version.toString(),
      timestamp: syncData.createdAt.getTime(),
    });
  } catch (error) {
    console.error('[Sync] Download error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
