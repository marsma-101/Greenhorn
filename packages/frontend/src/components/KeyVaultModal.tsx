// ✅ 已确认（2026-08-05 PM+用户验收）：不可误改
import { useState, useEffect } from 'react';

interface KeyVaultProvider {
  id: string;
  name: string;
  region: string;
  registerUrl: string;
  hasKey: boolean;
  maskedKey?: string;
  requiresKey: boolean;
}

interface KeyVaultResponse {
  success: boolean;
  providers?: KeyVaultProvider[];
  message?: string;
}

interface KeyVaultModalProps {
  onClose: () => void;
}

export default function KeyVaultModal({ onClose }: KeyVaultModalProps) {
  const [providers, setProviders] = useState<KeyVaultProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const loadProviders = () => {
    setLoading(true);
    setLoadError('');
    fetch('/api/keyvault')
      .then(res => res.json())
      .then((data: KeyVaultResponse) => {
        if (data.success) {
          setProviders(data.providers || []);
        } else {
          setLoadError(data.message || '加载失败');
        }
      })
      .catch(() => {
        setLoadError('无法加载密钥配置，请检查后端服务是否已启动');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSave = async (provider: KeyVaultProvider) => {
    const apiKey = (apiKeys[provider.id] || '').trim();
    if (!apiKey || savingId) return;
    setSavingId(provider.id);
    setActionError('');
    try {
      const res = await fetch(`/api/keyvault/${provider.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const data: KeyVaultResponse = await res.json();
      if (data.success) {
        setApiKeys(prev => ({ ...prev, [provider.id]: '' }));
        loadProviders();
      } else {
        setActionError(data.message || '保存失败');
      }
    } catch {
      setActionError('保存失败，请检查网络连接');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (provider: KeyVaultProvider) => {
    if (savingId) return;
    setSavingId(provider.id);
    setActionError('');
    try {
      const res = await fetch(`/api/keyvault/${provider.id}`, { method: 'DELETE' });
      const data: KeyVaultResponse = await res.json();
      if (data.success) {
        loadProviders();
      } else {
        setActionError(data.message || '删除失败');
      }
    } catch {
      setActionError('删除失败，请检查网络连接');
    } finally {
      setSavingId(null);
    }
  };

  const renderStatus = (provider: KeyVaultProvider) => {
    if (provider.hasKey) {
      return (
        <span style={{ color: 'var(--c-success-text, #059669)', fontSize: '0.75rem', fontWeight: 500 }}>
          {provider.maskedKey ? `已配置 ${provider.maskedKey}` : '已配置'}
        </span>
      );
    }
    return (
      <span style={{ color: 'var(--c-text-muted)', fontSize: '0.75rem' }}>
        {provider.requiresKey ? '未配置' : '无需密钥'}
      </span>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="paper-card"
        style={{
          padding: '1.5rem',
          maxWidth: '480px',
          width: '100%',
          margin: '0 1rem',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>🔑 密钥管理</h2>
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
          >
            ×
          </button>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--c-text-muted)', marginBottom: '1rem' }}>
          配置一次，全部引擎通用
        </p>

        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--c-text-muted)' }}>加载中...</p>
          </div>
        )}

        {!loading && loadError && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--c-error-text, #dc2626)' }}>{loadError}</p>
            <button
              onClick={loadProviders}
              className="btn-primary"
              style={{ marginTop: '0.75rem', padding: '8px 16px' }}
            >
              重试
            </button>
          </div>
        )}

        {!loading && !loadError && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {providers.map(provider => {
                const needsKey = provider.requiresKey && !provider.hasKey;
                const isSaving = savingId === provider.id;
                return (
                  <div
                    key={provider.id}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--c-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{provider.name}</span>
                        {renderStatus(provider)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        {provider.hasKey && (
                          <button
                            onClick={() => handleDelete(provider)}
                            disabled={isSaving}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 'var(--r-sm)',
                              border: '1px solid var(--c-border)',
                              background: 'var(--c-bg-hover)',
                              color: 'var(--c-error-text, #dc2626)',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              opacity: isSaving ? 0.6 : 1,
                            }}
                          >
                            {isSaving ? '处理中...' : '删除'}
                          </button>
                        )}
                        <a
                          href={provider.registerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: 'var(--c-accent)',
                            fontSize: '0.75rem',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          获取密钥 →
                        </a>
                      </div>
                    </div>
                    {needsKey && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <input
                          type="password"
                          placeholder="粘贴 API Key"
                          value={apiKeys[provider.id] || ''}
                          onChange={e => setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSave(provider);
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '8px 12px',
                            borderRadius: 'var(--r-md)',
                            border: '1px solid var(--c-border)',
                            background: 'var(--c-surface-1)',
                            color: 'var(--c-text)',
                            fontSize: '0.8125rem',
                          }}
                        />
                        <button
                          onClick={() => handleSave(provider)}
                          disabled={isSaving || !(apiKeys[provider.id] || '').trim()}
                          className="btn-primary"
                          style={{
                            padding: '8px 16px',
                            fontSize: '0.8125rem',
                            opacity: isSaving || !(apiKeys[provider.id] || '').trim() ? 0.6 : 1,
                          }}
                        >
                          {isSaving ? '保存中...' : '保存'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {actionError && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--c-error-text, #dc2626)', marginTop: '0.75rem' }}>
                {actionError}
              </p>
            )}

            <button
              onClick={onClose}
              className="btn-primary"
              style={{ marginTop: '1rem', width: '100%', padding: '10px 16px' }}
            >
              关闭
            </button>
          </>
        )}
      </div>
    </div>
  );
}
