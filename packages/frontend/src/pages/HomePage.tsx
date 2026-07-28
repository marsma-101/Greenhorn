import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { APP_NAME, ENGINES } from '@greenhorn/shared/constants';

export default function HomePage() {
  const navigate = useNavigate();
  const [piStatus, setPiStatus] = useState<'checking' | 'ready' | 'missing'>('checking');
  const [showWelcome, setShowWelcome] = useState(true);
  
  // 检测 PI 是否已安装
  useEffect(() => {
    fetch('/api/pi/check')
      .then(res => res.json())
      .then(data => setPiStatus(data.installed ? 'ready' : 'missing'))
      .catch(() => setPiStatus('missing'));
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      {/* 首次欢迎弹窗 */}
      {showWelcome && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-xl">
            <div className="text-center">
              <div className="text-4xl mb-4">🎉</div>
              <h2 className="text-xl font-semibold mb-2">欢迎来到 {APP_NAME}！</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                只需 3 步就能开始：<br />
                ① 选一个智能体<br />
                ② 等它自动安装好<br />
                ③ 开始对话！
              </p>
              <button
                onClick={() => setShowWelcome(false)}
                className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors"
              >
                好的，开始吧！
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 品牌标识 */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
          🍃 {APP_NAME}
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          选择你的 AI 智能体，开始对话
        </p>
      </div>
      
      {/* 引擎卡片 */}
      <div className="w-full max-w-md space-y-4">
        <div
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/chat')}
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">{ENGINES.PI.name}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                {ENGINES.PI.description}
              </p>
            </div>
            <span className={`px-2 py-1 text-xs rounded-full ${
              piStatus === 'ready'
                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                : piStatus === 'checking'
                ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}>
              {piStatus === 'ready' ? '已就绪' : piStatus === 'checking' ? '检测中...' : '未安装'}
            </span>
          </div>
        </div>
        
        {/* 更多引擎占位 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 opacity-50">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">🔧 更多引擎 · 开发中...</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                敬请期待更多开源智能体接入
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* 帮助入口 */}
      <div className="mt-8">
        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm underline">
          怎么用？
        </button>
      </div>
    </div>
  );
}