/**
 * MemoVault 根布局
 * 包含全局样式和元数据
 */

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MemoVault - 隐私优先的个人知识库',
  description: '本地优先、端到端加密的个人知识管理系统',
  keywords: ['知识库', '笔记', '隐私', '加密', 'Local-First'],
  authors: [{ name: 'MemoVault Team' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b82f6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
