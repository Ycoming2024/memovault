/**
 * 同步上传 API 路由
 * 将用户数据上传到云端
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/server/auth';

// ============================================================================
// 内存存储（生产环境应使用数据库）
// ============================================================================

const syncDataStore: Map<string, { data: string; version: number; timestamp: number }> = new Map();

// ============================================================================
// POST /api/sync/upload
// ============================================================================

export async function POST(request: NextRequest) {
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
    const { userId: requestUserId, data, version } = body;

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
    const existingData = syncDataStore.get(userId);
    if (existingData && existingData.version > version) {
      return NextResponse.json(
        { error: 'Version conflict: remote version is newer' },
        { status: 409 }
      );
    }

    // 6. 存储数据
    syncDataStore.set(userId, {
      data,
      version,
      timestamp: Date.now(),
    });

    console.log(`[Sync] Uploaded data for user ${userId}, version ${version}`);

    // 7. 返回成功
    return NextResponse.json({
      success: true,
      message: 'Data uploaded successfully',
      version,
    });
  } catch (error) {
    console.error('[Sync] Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
