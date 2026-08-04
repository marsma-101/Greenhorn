import { useState, useEffect } from 'react';
import type { EngineDefinition } from '@greenhorn/shared/constants';
import { useApp, type EngineConfig } from '../context/AppContext';
import { IconSparkles, IconCheck, IconExternalLink, IconX, IconKey } from './icons';

interface EngineConfigGuideProps {
  engine: EngineDefinition;
  initialConfig?: EngineConfig;
  onClose: () => void;
  onConfigured: (config: EngineConfig) => void;
  variant?: 'modal' | 'inline';
}

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  'claude-code': ['claude-sonnet-4-20250514', 'claude-3.5-sonnet', 'claude-3-haiku'],
  codex: ['codex', 'codex-1', 'gpt-4o'],
  opencode: ['opus', 'sonnet', 'haiku'],
  reasonix: ['deepseek-reasoner', 'deepseek-chat'],
};

const PROVIDER_OPTIONS: Record<string, { id: string; name: string; url: string }[]> = {
  'claude-code': [
    { id: 'anthropic', name: 'Anthropic', url: 'https://api.anthropic.com' },
  ],
  codex: [
    { id: 'openai', name: 'OpenAI', url: 'https://api.openai.com' },
  ],
  opencode: [
    { id: 'opencode', name: 'OpenCode', url: 'https://api.opencode.ai' },
  ],
  reasonix: [
    { id: 'deepseek', name: 'DeepSeek', url: 'https://api.deepseek.com' },
  ],
};

export default function EngineConfigGuide({
  engine,
  initialConfig,
  onClose,
  onConfigured,
  variant = 'modal',
}: EngineConfigGuideProps) {
  const { useSVG, saveEngineConfig } = useApp();
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '');
  const [provider, setProvider] = useState(initialConfig?.provider || engine.defaultProvider || '');
  const [model, setModel] = useState(initialConfig?.model || engine.defaultModel || '');
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl || '');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const providers = PROVIDER_OPTIONS[engine.id] || [];
  const modelSuggestions = MODEL_SUGGESTIONS[engine.id] || [];

  useEffect(() => {
    if (!baseUrl && provider && providers.length > 0) {
      const p = providers.find(x => x.id === provider);
      if (p) setBaseUrl(p.url);
    }
  }, [provider]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError(`请填写 ${engine.apiKeyLabel || 'API Key'}`);
      return;
    }
    if (!provider) {
      setError('请选择服务供应商');
      return;
    }
    if (!model.trim()) {
      setError('请填写模型名称');
      return;
    }

    setSaving(true);
    setError('');

    const config: EngineConfig = {
      ...(initialConfig || {}),
      apiKey: apiKey.trim(),
      provider,
      model: model.trim(),
      baseUrl: baseUrl.trim(),
      temperature: initialConfig?.temperature ?? 0.7,
      thinkingLevel: initialConfig?.thinkingLevel ?? 'off',
    };

    try {
      await saveEngineConfig(engine.id, config);
      setSaved(true);
      setTimeout(() => {
        onConfigured(config);
      }, 600);
    } catch {
      setError('保存失败，请重试');
      setSaving(false);
    }
  };

  const content = (
    <div style={{
      padding: variant === 'modal' ? '1.5rem' : '1rem',
      maxWidth: variant === 'modal' ? '480px' : '100%',
      width: '100%',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
        <span style={{ fontSize: '2.5rem' }}>{engine.emoji}</span>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{engine.name}</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--c-text-muted)' }}>{engine.description}</p>
        </div>
        {variant === 'modal' && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--c-text-muted)',
              padding: '4px 8px',
            }}
          >×</button>
        )}
      </div>

      {/* Notice */}
      <div style={{
        background: 'var(--c-warning-bg, #fff7ed)',
        border: '1px solid var(--c-warning-border, #fdba74)',
        borderRadius: 'var(--r-md)',
        padding: '12px 16px',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
      }}>
        <span style={{ fontSize: '1.125rem', flexShrink: 0 }}>⚠️</span>
        <div style={{ fontSize: '0.8125rem', lineHeight: 1.6, color: 'var(--c-warning-text, #9a3412)' }}>
          <strong style={{ display: 'block', marginBottom: '2px' }}>必须配置 API Key 才能使用</strong>
          {engine.configGuideNote}
        </div>
      </div>

      {saved ? (
        <div style={{
          textAlign: 'center',
          padding: '1.5rem 0',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--c-success-text, #059669)' }}>
            配置保存成功！
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--c-text-muted)' }}>
            正在跳转对话界面...
          </p>
        </div>
      ) : (
        <>
          {/* API Key */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              marginBottom: '6px',
              color: 'var(--c-text-soft)',
            }}>
              {engine.apiKeyLabel || 'API Key'} <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`请输入你的 ${engine.apiKeyLabel || 'API Key'}`}
                style={{
                  width: '100%',
                  padding: '10px 36px 10px 12px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--c-border)',
                  background: 'var(--c-surface-2)',
                  color: 'var(--c-text)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color var(--dur-fast)',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--c-accent)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--c-border)'}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--c-text-muted)',
                  padding: '4px',
                  fontSize: '0.75rem',
                }}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>
                {engine.apiKeyHint}
              </span>
              {engine.apiKeyRegisterUrl && (
                <a
                  href={engine.apiKeyRegisterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.75rem',
                    color: 'var(--c-accent)',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {useSVG ? <IconExternalLink size={11} /> : ''}
                  获取 Key →
                </a>
              )}
            </div>
          </div>

          {/* Provider */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              marginBottom: '6px',
              color: 'var(--c-text-soft)',
            }}>
              服务供应商
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {providers.map(p => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--r-md)',
                    border: provider === p.id ? '2px solid var(--c-accent)' : '1px solid var(--c-border)',
                    background: provider === p.id ? 'var(--c-accent-soft)' : 'var(--c-surface-2)',
                    color: provider === p.id ? 'var(--c-accent)' : 'var(--c-text)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: provider === p.id ? 600 : 400,
                    transition: 'all var(--dur-fast)',
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              marginBottom: '6px',
              color: 'var(--c-text-soft)',
            }}>
              模型 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="输入模型名称"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--c-border)',
                background: 'var(--c-surface-2)',
                color: 'var(--c-text)',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color var(--dur-fast)',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--c-accent)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--c-border)'}
            />
            {modelSuggestions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)', marginRight: '4px' }}>常用：</span>
                {modelSuggestions.map(m => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      border: '1px solid var(--c-border)',
                      background: 'var(--c-bg-hover)',
                      color: 'var(--c-text-muted)',
                      fontSize: '0.6875rem',
                      cursor: 'pointer',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Base URL (optional) */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              marginBottom: '6px',
              color: 'var(--c-text-soft)',
            }}>
              API 地址 <span style={{ fontWeight: 400, color: 'var(--c-text-muted)', fontSize: '0.75rem' }}>（可选，默认用供应商地址）</span>
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--c-border)',
                background: 'var(--c-surface-2)',
                color: 'var(--c-text)',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
                transition: 'border-color var(--dur-fast)',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--c-accent)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--c-border)'}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #ef4444',
              borderRadius: 'var(--r-md)',
              padding: '8px 12px',
              marginBottom: '1rem',
              fontSize: '0.8125rem',
              color: '#dc2626',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {variant === 'modal' && (
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--c-border)',
                  background: 'var(--c-surface-2)',
                  color: 'var(--c-text)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                稍后配置
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
              style={{
                flex: variant === 'modal' ? 1 : '1',
                padding: '10px 16px',
                fontSize: '0.875rem',
                opacity: saving ? 0.7 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {useSVG ? <IconCheck size={14} style={{ display: 'inline', marginRight: '6px' }} /> : '✅ '}
              {saving ? '保存中...' : '保存并开始对话'}
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (variant === 'modal') {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        backdropFilter: 'blur(4px)',
      }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="paper-card" style={{
          maxWidth: '520px',
          width: '100%',
          margin: '0 1rem',
          maxHeight: '90vh',
          overflow: 'auto',
          animation: 'slideUp 0.2s ease-out',
        }}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="paper-card" style={{ width: '100%', maxWidth: '520px', margin: '0 auto' }}>
      {content}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}