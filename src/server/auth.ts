/**
 * MemoVault 认证服务
 * 基于 JWT (JSON Web Token)
 */

import { SignJWT, jwtVerify } from 'jose';

// ============================================================================
// 配置常量
// ============================================================================

const JWT_CONFIG = {
  algorithm: 'HS256' as const,
  expiresIn: '7d', // Token 有效期 7 天
  issuer: 'memovault',
  audience: 'memovault-users',
};

// ============================================================================
// 密钥管理
// ============================================================================

/**
 * 获取 JWT 签名密钥
 */
function getSigningKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
  return new TextEncoder().encode(secret);
}

// ============================================================================
// Token 生成
// ============================================================================

/**
 * 生成 JWT Token
 * 
 * @param payload - Token 载荷
 * @returns JWT Token 字符串
 */
export async function generateToken(payload: {
  userId: string;
  email: string;
}): Promise<string> {
  try {
    const secret = getSigningKey();
    
    const token = await new SignJWT({
      userId: payload.userId,
      email: payload.email,
    })
      .setProtectedHeader({ alg: JWT_CONFIG.algorithm })
      .setIssuedAt()
      .setExpirationTime(JWT_CONFIG.expiresIn)
      .setIssuer(JWT_CONFIG.issuer)
      .setAudience(JWT_CONFIG.audience)
      .sign(secret);

    return token;
  } catch (error) {
    console.error('[Auth] Error generating token:', error);
    throw new Error('Failed to generate token');
  }
}

// ============================================================================
// Token 验证
// ============================================================================

/**
 * 验证 JWT Token
 * 
 * @param token - JWT Token 字符串
 * @returns 解码后的载荷
 */
export async function verifyToken(token: string): Promise<{
  userId: string;
  email: string;
  iat: number;
  exp: number;
}> {
  try {
    const secret = getSigningKey();
    
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    });

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch (error) {
    console.error('[Auth] Token verification failed:', error);
    throw new Error('Invalid or expired token');
  }
}

/**
 * 检查 Token 是否即将过期
 * 
 * @param token - JWT Token 字符串
 * @param thresholdSeconds - 提前多少秒视为即将过期（默认 1 天）
 * @returns 是否即将过期
 */
export async function isTokenExpiringSoon(
  token: string,
  thresholdSeconds: number = 86400
): Promise<boolean> {
  try {
    const decoded = await verifyToken(token);
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    
    return timeUntilExpiry <= thresholdSeconds;
  } catch (error) {
    console.error('[Auth] Error checking token expiry:', error);
    return true; // 如果验证失败，视为已过期
  }
}

// ============================================================================
// 中间件辅助函数
// ============================================================================

/**
 * 从请求头中提取 Token
 * 
 * @param authHeader - Authorization 头
 * @returns Token 字符串或 null
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * 验证请求中的 Token
 * 
 * @param authHeader - Authorization 头
 * @returns 解码后的载荷或 null
 */
export async function authenticateRequest(
  authHeader: string | null
): Promise<{ userId: string; email: string } | null> {
  try {
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return null;
    }

    const decoded = await verifyToken(token);
    return {
      userId: decoded.userId,
      email: decoded.email,
    };
  } catch (error) {
    console.error('[Auth] Request authentication failed:', error);
    return null;
  }
}
