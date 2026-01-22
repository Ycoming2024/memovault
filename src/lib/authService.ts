/**
 * 客户端认证服务
 * 处理用户注册、登录和密码验证
 */

import { deriveAuthHash } from './crypto';
import { userStore } from './userStore';

export interface AuthResult {
  success: boolean;
  data?: {
    token: string;
    userId: string;
    email: string;
    salt: number[];
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 注册新用户
 */
export async function registerUser(email: string, password: string): Promise<AuthResult> {
  try {
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: { code: 'INVALID_EMAIL', message: '邮箱格式不正确' },
      };
    }

    // 验证密码强度
    if (password.length < 8) {
      return {
        success: false,
        error: { code: 'WEAK_PASSWORD', message: '密码至少需要 8 个字符' },
      };
    }

    // 检查邮箱是否已存在
    const exists = await userStore.exists(email);
    if (exists) {
      return {
        success: false,
        error: { code: 'EMAIL_EXISTS', message: '该邮箱已被注册' },
      };
    }

    // 生成盐值
    const salt = crypto.getRandomValues(new Uint8Array(32));

    // 派生认证哈希
    const authHash = await deriveAuthHash(password, salt);

    // 保存用户到 IndexedDB
    const user = await userStore.create(email, authHash, salt);

    // 调用服务端 API 生成 Token（发送 userId）
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        email, 
        password,
        userId: user.userId, // 发送客户端生成的 userId
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error,
      };
    }

    return {
      success: true,
      data: {
        token: data.data.token,
        userId: user.userId,
        email: user.email,
        salt: user.salt,
      },
    };
  } catch (error) {
    console.error('[AuthService] Register error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '注册失败，请稍后重试' },
    };
  }
}

/**
 * 用户登录
 */
export async function loginUser(email: string, password: string): Promise<AuthResult> {
  try {
    // 获取用户
    const user = await userStore.get(email);
    if (!user) {
      return {
        success: false,
        error: { code: 'USER_NOT_FOUND', message: '用户不存在，请先注册' },
      };
    }

    // 将盐值从数组转换为 Uint8Array
    const saltBytes = new Uint8Array(user.salt);

    // 派生认证哈希
    const authHash = await deriveAuthHash(password, saltBytes);

    // 验证密码
    if (user.authHash !== authHash) {
      return {
        success: false,
        error: { code: 'INVALID_PASSWORD', message: '密码错误' },
      };
    }

    // 调用服务端 API 生成 Token（发送 userId）
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        email, 
        password,
        userId: user.userId, // 发送客户端存储的 userId
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error,
      };
    }

    return {
      success: true,
      data: {
        token: data.data.token,
        userId: user.userId,
        email: user.email,
        salt: user.salt,
      },
    };
  } catch (error) {
    console.error('[AuthService] Login error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '登录失败，请稍后重试' },
    };
  }
}

/**
 * 登出
 */
export function logoutUser() {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  localStorage.removeItem('email');
  localStorage.removeItem('salt');
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('token');
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser() {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const email = localStorage.getItem('email');
  const salt = localStorage.getItem('salt');

  if (!token || !userId || !email || !salt) {
    return null;
  }

  return {
    token,
    userId,
    email,
    salt: JSON.parse(salt),
  };
}
