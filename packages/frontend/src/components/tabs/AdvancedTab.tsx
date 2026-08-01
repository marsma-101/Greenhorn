import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

export default function AdvancedTab() {
  const { settings, updateSettings, settingsLoaded } = useApp();
  const [thinkingLevel, setThinkingLevel] = useState(settings.defaultThinkingLevel);
  const [quietStartup, setQuietStartup] = useState(settings.quietStartup);
  const [compactionEnabled, setCompactionEnabled] = useState(settings.compaction.enabled);
  const [reserveTokens, setReserveTokens] = useState(settings.compaction.reserveTokens);
  const [sessionDir, setSessionDir] = useState(settings.sessionDir);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settingsLoaded) {
      setThinkingLevel(settings.defaultThinkingLevel);
      setQuietStartup(settings.quietStartup);
      setCompactionEnabled(settings.compaction.enabled);
      setReserveTokens(settings.compaction.reserveTokens);
      setSessionDir(settings.sessionDir);
    }
  }, [settingsLoaded, settings.defaultThinkingLevel, settings.quietStartup, settings.compaction, settings.sessionDir]);

  const handleSave = async () => {
    await updateSettings({
      defaultThinkingLevel: thinkingLevel,
      quietStartup,
      sessionDir,
      compaction: { enabled: compactionEnabled, reserveTokens },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 space-y-5">
      {/* Thinking Level */}
      <div>
        <label className="block text-xs text-[oklch(50%_0.02_145)] dark:text-[oklch(65%_0.02_145)] mb-1.5">默认思考级别</label>
        <select
          value={thinkingLevel}
          onChange={e => setThinkingLevel(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[oklch(85%_0.01_145)] dark:border-[oklch(30%_0.01_145)] bg-[oklch(95%_0.005_145)] dark:bg-[oklch(20%_0.005_145)] text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(70%_0.1_145)]"
        >
          <option value="off">关闭</option>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
        </select>
      </div>

      {/* Quiet Startup */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-[oklch(25%_0.02_145)] dark:text-[oklch(85%_0.02_145)]">安静启动</span>
          <p className="text-xs text-[oklch(55%_0.015_145)] mt-0.5">启动时不自动打开浏览器</p>
        </div>
        <button
          onClick={() => setQuietStartup(!quietStartup)}
          className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
            quietStartup ? 'bg-[oklch(62%_0.15_145)]' : 'bg-[oklch(75%_0.01_145)]'
          }`}
        >
          <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${
            quietStartup ? 'translate-x-5' : 'translate-x-0.5'
          }`} style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }} />
        </button>
      </div>

      {/* Session Directory */}
      <div>
        <label className="block text-xs text-[oklch(50%_0.02_145)] dark:text-[oklch(65%_0.02_145)] mb-1.5">会话保存目录</label>
        <input
          type="text"
          value={sessionDir}
          onChange={e => setSessionDir(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[oklch(85%_0.01_145)] dark:border-[oklch(30%_0.01_145)] bg-[oklch(95%_0.005_145)] dark:bg-[oklch(20%_0.005_145)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[oklch(70%_0.1_145)]"
        />
      </div>

      {/* Compaction */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-sm text-[oklch(25%_0.02_145)] dark:text-[oklch(85%_0.02_145)]">上下文压缩</span>
            <p className="text-xs text-[oklch(55%_0.015_145)] mt-0.5">长对话自动压缩历史</p>
          </div>
          <button
            onClick={() => setCompactionEnabled(!compactionEnabled)}
            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
              compactionEnabled ? 'bg-[oklch(62%_0.15_145)]' : 'bg-[oklch(75%_0.01_145)]'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${
              compactionEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`} style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }} />
          </button>
        </div>
        {compactionEnabled && (
          <div>
            <label className="block text-xs text-[oklch(50%_0.02_145)] dark:text-[oklch(65%_0.02_145)] mb-1">保留 Token 数</label>
            <input
              type="number"
              value={reserveTokens}
              onChange={e => setReserveTokens(Number(e.target.value))}
              min={512}
              step={512}
              className="w-full px-3 py-2 rounded-lg border border-[oklch(85%_0.01_145)] dark:border-[oklch(30%_0.01_145)] bg-[oklch(95%_0.005_145)] dark:bg-[oklch(20%_0.005_145)] text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(70%_0.1_145)]"
            />
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        className={`w-full px-3 py-2 rounded-lg text-white text-sm transition-opacity ${
          saved ? 'bg-[oklch(55%_0.15_145)]' : 'bg-[oklch(62%_0.15_145)] hover:opacity-90'
        }`}
      >
        {saved ? '✅ 已保存' : '保存'}
      </button>
    </div>
  );
}
