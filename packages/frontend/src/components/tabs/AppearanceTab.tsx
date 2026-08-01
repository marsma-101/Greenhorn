import { useState, useEffect } from 'react';
import { useApp, UIStyle } from '../../context/AppContext';

const STYLES: { id: UIStyle; name: string; desc: string }[] = [
  { id: 'default', name: '默认', desc: 'GreenHorn 绿色系' },
  { id: 'claude', name: 'Claude 风格', desc: '暖米色 + 陶土橙' },
  { id: 'doubao', name: '豆包风格', desc: '科技蓝 + 浅灰白' },
];

export default function AppearanceTab() {
  const { settings, settingsLoaded, updateSettings, uiStyle, setUIStyle } = useApp();
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [hideThinking, setHideThinking] = useState(settings.hideThinkingBlock);
  const [style, setStyle] = useState<UIStyle>(uiStyle);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settingsLoaded) {
      setHideThinking(settings.hideThinkingBlock);
      setStyle(settings.uiStyle || 'default');
    }
  }, [settingsLoaded, settings.hideThinkingBlock, settings.uiStyle]);

  useEffect(() => {
    // Live preview style
    setUIStyle(style);
  }, [style]);

  const handleSave = async () => {
    // Save theme to config
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme }),
    });
    await updateSettings({ hideThinkingBlock: hideThinking, uiStyle: style });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 space-y-5">
      {/* UI Style */}
      <div>
        <label className="block text-xs mb-2" style={{ color: 'var(--c-text-muted)' }}>界面风格</label>
        <select
          value={style}
          onChange={e => setStyle(e.target.value as UIStyle)}
          className="ui-select"
        >
          {STYLES.map(s => (
            <option key={s.id} value={s.id}>{s.name}（{s.desc}）</option>
          ))}
        </select>
      </div>

      {/* Theme */}
      <div>
        <label className="block text-xs mb-2" style={{ color: 'var(--c-text-muted)' }}>主题</label>
        <div className="flex gap-2">
          {(['浅色', '深色', '跟随系统'] as const).map(t => {
            const value = t === '浅色' ? 'light' : t === '深色' ? 'dark' : 'system';
            const isActive = theme === value;
            return (
              <button
                key={t}
                onClick={() => setTheme(value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--r-md)',
                  fontSize: '0.75rem',
                  transition: 'all var(--dur-fast)',
                  background: isActive ? 'var(--c-bg-save)' : 'var(--c-bg-session-item)',
                  color: isActive ? 'var(--c-text-inverse)' : 'var(--c-text)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Thinking toggle */}
      <div className="flex items-center justify-between" style={{ gap: 'var(--s-3)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--c-text)' }}>显示思考过程</span>
          <p style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)', marginTop: '2px' }}>
            关闭后对话更简洁
          </p>
        </div>
        <button
          onClick={() => setHideThinking(!hideThinking)}
          style={{
            width: '44px',
            height: '24px',
            borderRadius: 'var(--r-full)',
            transition: 'background-color var(--dur-md)',
            background: hideThinking ? 'var(--c-bg-session-item)' : 'var(--c-bg-save)',
            position: 'relative',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="显示思考过程"
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              background: 'var(--c-text-inverse)',
              borderRadius: '50%',
              position: 'absolute',
              top: '2px',
              transition: 'transform var(--dur-md) var(--ease-out-expo)',
              transform: hideThinking ? 'translateX(2px)' : 'translateX(22px)',
              boxShadow: 'var(--sh-sm)',
            }}
          />
        </button>
      </div>

      <button
        onClick={handleSave}
        className={`btn-save ${saved ? 'success' : ''}`}
      >
        {saved ? '已保存' : '保存'}
      </button>
    </div>
  );
}
