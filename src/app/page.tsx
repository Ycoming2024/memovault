/**
 * MemoVault 主页
 * 登录页面或应用入口
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Lock, Shield, Zap } from 'lucide-react';
import { registerUser, loginUser } from '@/lib/authService';

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError('');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = isRegister 
        ? await registerUser(email, password)
        : await loginUser(email, password);

      if (result.success && result.data) {
        // 保存 Token 到 localStorage
        localStorage.setItem('token', result.data.token);
        localStorage.setItem('userId', result.data.userId);
        localStorage.setItem('email', result.data.email);
        
        // 保存盐值用于加密
        localStorage.setItem('salt', JSON.stringify(result.data.salt));
        
        // 登录/注册成功后重定向到应用
        router.push('/app');
      } else {
        setError(result.error?.message || '操作失败');
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* 头部 */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <FileText className="w-16 h-16 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            MemoVault
          </h1>
          <p className="text-lg text-slate-600">
            隐私优先的个人知识库
          </p>
        </div>

        {/* 特性卡片 */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <FeatureCard
            icon={<Lock className="w-8 h-8" />}
            title="端到端加密"
            description="所有数据在本地加密，服务器零知悉"
          />
          <FeatureCard
            icon={<Shield className="w-8 h-8" />}
            title="本地优先"
            description="数据存储在本地，离线也能使用"
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8" />}
            title="实时同步"
            description="使用 CRDT 技术，多端无缝同步"
          />
        </div>

        {/* 登录表单 */}
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 text-center">
                {isRegister ? '创建账号' : '欢迎回来'}
              </h2>
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {isRegister ? '已有账号？登录' : '没有账号？注册'}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}
            
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700 mb-2"
                >
                  邮箱
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700 mb-2"
                >
                  密码
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                />
                <p className="text-xs text-slate-500 mt-1">密码至少需要 8 个字符</p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                {isLoading ? (isRegister ? '注册中...' : '登录中...') : (isRegister ? '注册' : '登录')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <a
                href="#"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                忘记密码？
              </a>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 text-center">
              <p className="text-sm text-slate-600">
                还没有账号？{' '}
                <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                  注册
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* 页脚 */}
        <div className="mt-12 text-center text-sm text-slate-500">
          <p>© 2024 MemoVault. All rights reserved.</p>
          <p className="mt-2">
            <a href="#" className="hover:text-slate-700">隐私政策</a>
            {' · '}
            <a href="#" className="hover:text-slate-700">服务条款</a>
            {' · '}
            <a href="#" className="hover:text-slate-700">开源代码</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3 mb-3 text-blue-600">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        {title}
      </h3>
      <p className="text-slate-600 text-sm">
        {description}
      </p>
    </div>
  );
}
