/**
 * 用户登录 API 路由（Local-First 模式）
 * POST /api/auth/login
 * 
 * 注意：此版本仅用于生成 JWT Token
 * 用户验证在客户端完成
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateToken } from '@/server/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, userId } = body;

    // 验证输入
    if (!email || !password || !userId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: '邮箱、密码和用户 ID 不能为空' } },
        { status: 400 }
      );
    }

    // 生成 JWT Token（使用客户端提供的 userId）
    const token = await generateToken({
      userId,
      email,
    });

    // 返回 Token
    return NextResponse.json({
      success: true,
      data: {
        token,
        userId,
        email,
        message: '登录成功（Local-First 模式：数据存储在本地 IndexedDB）',
      },
    });
  } catch (error) {
    console.error('[API] Login error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '登录失败，请稍后重试' } },
      { status: 500 }
    );
  }
}
