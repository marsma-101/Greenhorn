import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdvancedSettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    defaultThinkingLevel: 'off' as 'off' | 'low' | 'medium' | 'high',
    quietStartup: false,
    sessionDir: '~/.pi/agent/sessions',
    compaction: {
      enabled: false,
      reserveTokens: 4096,
    },
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSettings({
          defaultThinkingLevel: data.defaultThinkingLevel || 'off',
          quietStartup: data.quietStartup || false,
          sessionDir: data.sessionDir || '~/.pi/agent/sessions',
          compaction: {
            enabled: data.compaction?.enabled || false,
            reserveTokens: data.compaction?.reserveTokens || 4096,
          },
        });
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      setSaveStatus(data.success ? 'success' : 'error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/settings', { replace: true })} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          ← 返回设置
        </button>
        <h1 className="text-xl font-semibold">高级设置</h1>
      </div>

      <div className="space-y-4">
        {/* 🧠 默认思考级别 */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold mb-4">🧠 默认思考级别</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
                思考级别
                <span className="ml-1 text-xs text-gray-400">（影响 AI 思考的深度，级别越高回答越详细但越慢）</span>
              </label>
              <select
                value={settings.defaultThinkingLevel}
                onChange={e => setSettings(prev => ({ ...prev, defaultThinkingLevel: e.target.value as any }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="off">关闭（快速响应）</option>
                <option value="low">低（轻度思考）</option>
                <option value="medium">中（标准思考）</option>
                <option value="high">高（深度思考，较慢）</option>
              </select>
            </div>
          </div>
        </section>

        {/* 🚀 启动设置 */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold mb-4">🚀 启动设置</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm">静默启动（跳过欢迎页）</span>
                <p className="text-xs text-gray-400 mt-0.5">开启后启动时直接进入主界面</p>
              </div>
              <button
                onClick={() => setSettings(prev => ({ ...prev, quietStartup: !prev.quietStartup }))}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  settings.quietStartup ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${
                  settings.quietStartup ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
                会话存储路径
              </label>
              <input
                type="text"
                value={settings.sessionDir}
                onChange={e => setSettings(prev => ({ ...prev, sessionDir: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">会话文件存储位置，留空使用默认路径</p>
            </div>
          </div>
        </section>

        {/* 📦 上下文压缩 */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold mb-4">📦 上下文压缩</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm">自动压缩历史消息</span>
                <p className="text-xs text-gray-400 mt-0.5">开启后长对话会自动压缩，节省 Token</p>
              </div>
              <button
                onClick={() => setSettings(prev => ({
                  ...prev,
                  compaction: { ...prev.compaction, enabled: !prev.compaction.enabled }
                }))}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  settings.compaction.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${
                  settings.compaction.enabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            {settings.compaction.enabled && (
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
                  保留 Token 数
                </label>
                <input
                  type="number"
                  value={settings.compaction.reserveTokens}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    compaction: { ...prev.compaction, reserveTokens: parseInt(e.target.value) || 4096 }
                  }))}
                  min={1024}
                  max={32768}
                  step={512}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-400 mt-1">压缩后保留的上下文 Token 数（建议 2048-8192）</p>
              </div>
            )}
          </div>
        </section>

        {/* 保存 */}
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className={`w-full px-4 py-2 rounded-xl transition-colors text-white ${
            saveStatus === 'success'
              ? 'bg-green-500'
              : saveStatus === 'error'
              ? 'bg-red-500'
              : 'bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600'
          }`}
        >
          {saveStatus === 'saving' ? '⏳ 保存中...' :
           saveStatus === 'success' ? '✅ 已保存！' :
           saveStatus === 'error' ? '❌ 保存失败' :
           '保存高级设置'}
        </button>
      </div>
    </div>
  );
}
