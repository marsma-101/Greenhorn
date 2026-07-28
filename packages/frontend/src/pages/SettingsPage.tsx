import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('deepseek');
  const [model, setModel] = useState('deepseek-chat');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [showHelp, setShowHelp] = useState(true);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'verifying' | 'success' | 'fail'>('idle');
  
  const handleVerify = async () => {
    if (!apiKey) return;
    setVerifyStatus('verifying');
    try {
      const res = await fetch('/api/config/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await res.json();
      setVerifyStatus(data.success ? 'success' : 'fail');
    } catch {
      setVerifyStatus('fail');
    }
  };
  
  const handleSave = async () => {
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, apiKey, theme, showHelp }),
    });
  };
  
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          ← 返回
        </button>
        <h1 className="text-xl font-semibold">设置</h1>
      </div>
      
      {/* ⚙️ 模型设置 */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
        <h2 className="font-semibold mb-4">⚙️ 模型</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">模型提供商</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="ollama">Ollama（本机运行）</option>
              <option value="tongyi">通义千问（阿里云）</option>
              <option value="zhipu">智谱 AI</option>
              <option value="doubao">豆包（火山引擎）</option>
              <option value="moonshot">月之暗面 Kimi</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">模型</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="deepseek-chat">DeepSeek V3</option>
              <option value="deepseek-reasoner">DeepSeek R1</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
              API Key
              <span className="ml-1 text-gray-300 cursor-help" title="API Key 就像密码，用来验证你的身份。">(?)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="粘贴你的 API Key 到这里"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={handleVerify}
                disabled={!apiKey || verifyStatus === 'verifying'}
                className="px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm transition-colors"
              >
                {verifyStatus === 'verifying' ? '验证中...' : '验证连接'}
              </button>
            </div>
            {verifyStatus === 'success' && (
              <p className="mt-1 text-sm text-green-600">✅ 连接正常！</p>
            )}
            {verifyStatus === 'fail' && (
              <p className="mt-1 text-sm text-red-500">❌ Key 好像不对哦，检查有没有复制完整？</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400">
              还没有 Key？<a href="https://platform.deepseek.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline">去 DeepSeek 官网获取</a>
            </p>
          </div>
        </div>
      </section>
      
      {/* 🎨 外观 */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
        <h2 className="font-semibold mb-4">🎨 外观</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">主题</span>
            <div className="flex gap-2">
              {(['浅色', '深色', '跟随系统'] as const).map(t => {
                const value = t === '浅色' ? 'light' : t === '深色' ? 'dark' : 'system';
                return (
                  <button
                    key={t}
                    onClick={() => setTheme(value)}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                      theme === value ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">显示帮助说明</span>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                showHelp ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${
                showHelp ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      </section>
      
      {/* 保存按钮 */}
      <button
        onClick={handleSave}
        className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors"
      >
        保存设置
      </button>
      
      {/* 高级设置入口 */}
      <div className="mt-6">
        <button
          onClick={() => navigate('/settings/advanced')}
          className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors flex items-center justify-center gap-2"
        >
          <span>🔧</span>
          <span>高级设置</span>
          <span className="text-xs text-gray-400 ml-1">即将上线</span>
        </button>
      </div>
      
      {/* 关于 */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-4 mt-4">
        <h2 className="font-semibold mb-4">📦 关于</h2>
        <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex justify-between">
            <span>GreenHorn 版本</span>
            <span>v0.1.0</span>
          </div>
          <div className="flex justify-between">
            <span>底层引擎</span>
            <span>PI (v0.50.2)</span>
          </div>
          <div className="mt-2">
            <a href="https://github.com/MARSMA-101/GreenHorn" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline text-xs">
              查看更新日志 →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}