/**
 * 健康检查 API 端点
 * 
 * 用于监控应用状态和健康检查
 * 
 * 端点：GET /api/health
 * 
 * 返回：
 * - status: "ok" | "error"
 * - timestamp: 当前时间戳
 * - uptime: 应用运行时间（秒）
 * - version: 应用版本
 * - environment: 运行环境
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 获取应用版本
 */
function getVersion(): string {
  try {
    const packageJson = require('../../../package.json');
    return packageJson.version || '1.0.0';
  } catch (error) {
    return '1.0.0';
  }
}

/**
 * 获取应用运行时间
 */
function getUptime(): number {
  return process.uptime();
}

/**
 * 获取运行环境
 */
function getEnvironment(): string {
  return process.env.NODE_ENV || 'development';
}

/**
 * GET /api/health
 * 
 * 返回应用健康状态
 */
export async function GET() {
  try {
    const version = getVersion();
    const uptime = getUptime();
    const environment = getEnvironment();

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      version,
      environment,
      uptime_formatted: formatUptime(uptime),
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[Health Check] Error:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * 格式化运行时间
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
