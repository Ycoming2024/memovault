/**
 * 同步上传 API 路由（使用 PostgreSQL）
 * 将用户数据上传到云端数据库
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 标记为动态路由，避免静态生成错误
export const dynamic = 'force-dynamic';

// ============================================================================
// POST /api/sync/db-upload
// ============================================================================

export async function POST(request: NextRequest) {
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
    const { userId: requestUserId, data, version, deviceId } = body;

    // 3. 验证用户 ID
    if (requestUserId !== userId) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // 4. 验证数据
    if (!data || !version) {
      return NextResponse.json(
        { error: 'Missing required fields: data, version' },
        { status: 400 }
      );
    }

    // 5. 检查版本冲突
    const existingData = await prisma.userSyncData.findUnique({
      where: { userId },
    });

    if (existingData && existingData.version > BigInt(version)) {
      return NextResponse.json(
        { error: 'Version conflict: remote version is newer' },
        { status: 409 }
      );
    }

    // 6. 存储或更新数据
    const syncData = existingData
      ? await prisma.userSyncData.update({
          where: { userId },
          data: {
            data,
            version: BigInt(version),
            deviceId: deviceId || 'unknown',
            updatedAt: new Date(),
          },
        })
      : await prisma.userSyncData.create({
          data: {
            userId,
            data,
            version: BigInt(version),
            deviceId: deviceId || 'unknown',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

    // 7. 记录同步日志
    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch (e) {
      parsedData = { notes: [], files: [], keyMaterials: [] };
    }

    await prisma.syncLog.create({
      data: {
        userId,
        action: 'upload',
        status: 'success',
        notesCount: parsedData.notes?.length || 0,
        filesCount: parsedData.files?.length || 0,
        conflicts: 0,
      },
    });

    console.log(`[Sync] Uploaded data for user ${userId}, version ${version}`);

    // 8. 返回成功
    return NextResponse.json({
      success: true,
      message: 'Data uploaded successfully',
      version: syncData.version.toString(),
    });
  } catch (error) {
    console.error('[Sync] Upload error:', error);
    
    // 记录错误日志
    try {
      const authResult = await authenticateRequest(request.headers.get('authorization'));
      if (authResult) {
        await prisma.syncLog.create({
          data: {
            userId: authResult.userId,
            action: 'upload',
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    } catch (logError) {
      console.error('[Sync] Failed to log error:', logError);
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
