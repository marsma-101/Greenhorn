import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { APP_NAME, APP_VERSION, ENGINES } from '@greenhorn/shared/constants';
import type { EngineDefinition } from '@greenhorn/shared/constants';
import { useApp } from '../context/AppContext';
import { IconLeaf, IconSparkles, IconPlus, IconExternalLink } from '../components/icons';
import EngineInstallModal from '../components/EngineInstallModal';
import EngineConfigGuide from '../components/EngineConfigGuide';

interface EngineStatus {
  engineId: string;
  installed: boolean;
  running: boolean;
  version?: string;
  pid?: number;
  uptime?: number;
  capabilities: string[];
  lastCheck?: string;
}

interface EnvStatus {
  nodeReady: boolean;
  nodeVersion: string;
  depsReady: boolean;
  enginesDirReady: boolean;
  error?: string;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { useSVG, engineConfigs, loadEngineConfig } = useApp();
  const [engines, setEngines] = useState<EngineDefinition[]>(
    ENGINES.map(e => ({ ...e }))
  );
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [installingEngine, setInstallingEngine] = useState<EngineDefinition | null>(null);
  const [confirmEngine, setConfirmEngine] = useState<EngineDefinition | null>(null);
  const [configEngine, setConfigEngine] = useState<EngineDefinition | null>(null);

  useEffect(() => {
    fetch('/api/engines/status')
      .then(res => res.json())
      .then((data: { engines: EngineStatus[]; location: { warning: string | null } }) => {
        if (data.location?.warning) {
          setLocationWarning(data.location.warning);
        }
        setEngines(prev =>
          prev.map(e => {
            const status = data.engines.find((s: EngineStatus) => s.engineId === e.id);
            if (status) {
              return { ...e, status: status.installed ? 'ready' : 'missing' };
            }
            return e;
          })
        );
      })
      .catch(() => {
        // 保持静态状态
      });

    fetch('/api/setup/check-env')
      .then(res => res.json())
      .then((data: { ready: boolean; nodeVersion: string; hasConfigDir: boolean }) => {
        setEnvStatus({
          nodeReady: true,
          nodeVersion: data.nodeVersion || '未知',
          depsReady: data.hasConfigDir,
          enginesDirReady: true,
        });
      })
      .catch(() => {
        setEnvStatus({
          nodeReady: true,
          nodeVersion: process.version,
          depsReady: true,
          enginesDirReady: true,
        });
      });
  }, []);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready':
        return { text: '已就绪', className: 'status-tag ready' };
      case 'installing':
        return { text: '安装中', className: 'status-tag checking' };
      default:
        return { text: '未安装', className: 'status-tag missing' };
    }
  };

  const installedCount = engines.filter(e => e.status === 'ready').length;

  const handleEngineClick = (engine: EngineDefinition) => {
    if (engine.status === 'ready') {
      if (engine.requiresApiKey) {
        const config = engineConfigs[engine.id];
        if (!config?.apiKey) {
          setConfigEngine(engine);
          return;
        }
      }
      navigate(`/chat?engine=${engine.id}`);
    } else {
      setConfirmEngine(engine);
    }
  };

  const handleConfigured = () => {
    if (configEngine) {
      navigate(`/chat?engine=${configEngine.id}`);
      setConfigEngine(null);
    }
  };

  const handleConfirmInstall = () => {
    if (confirmEngine) {
      setInstallingEngine(confirmEngine);
      setConfirmEngine(null);
    }
  };

  const handleEngineInstalled = (engineId: string) => {
    setEngines(prev =>
      prev.map(e => (e.id === engineId ? { ...e, status: 'ready' } : e))
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      minHeight: '100vh',
      padding: '0 1rem 2rem',
      background: 'var(--c-bg-page)',
    }}>
      {showWelcome && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <div className="paper-card" style={{ padding: '2rem', maxWidth: '320px', width: '100%', margin: '0 1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {useSVG ? <IconSparkles size={40} /> : <span>🎉</span>}
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>欢迎来到 {APP_NAME}！</h2>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.8 }}>
                只需 3 步就能开始：<br />
                ① 选一个智能体<br />
                ② 等它自动安装好<br />
                ③ 开始对话！
              </p>
              <button
                onClick={() => setShowWelcome(false)}
                className="btn-primary"
                style={{ width: '100%', padding: '8px 16px' }}
              >
                好的，开始吧！
              </button>
            </div>
          </div>
        </div>
      )}

      {locationWarning && (
        <div style={{
          background: 'var(--c-warning-bg, #fff3cd)',
          border: '1px solid var(--c-warning-border, #ffc107)',
          borderRadius: 'var(--r-md)',
          padding: '12px 16px',
          marginBottom: '1rem',
          maxWidth: '600px',
          width: '100%',
          textAlign: 'center',
        }}>
          <span style={{ color: 'var(--c-warning-text, #856404)', fontSize: '0.875rem' }}>
            {locationWarning}
          </span>
        </div>
      )}

      {/* 项目介绍区块 */}
      <div className="paper-card" style={{
        marginTop: '1.5rem',
        padding: '1.25rem 1.5rem',
        maxWidth: '700px',
        width: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
          {useSVG ? <IconLeaf size={20} /> : <span>🍃</span>}
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--c-accent)',
            letterSpacing: 'var(--font-tracking)',
          }}>
            {APP_NAME}
          </h1>
          <span style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>v{APP_VERSION}</span>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--c-text-soft)', marginBottom: '0.75rem', lineHeight: 1.6 }}>
          一个网页就能使用多个 AI 智能体 · 本地运行 · 数据不外传
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.75rem' }}>
          {ENGINES.map(e => (
            <span key={e.id} style={{
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              background: e.status === 'ready' ? 'var(--c-success-bg, #d1fae5)' : 'var(--c-bg-hover)',
              color: e.status === 'ready' ? 'var(--c-success-text, #059669)' : 'var(--c-text-muted)',
              fontWeight: e.status === 'ready' ? 600 : 400,
            }}>
              {e.emoji} {e.name} {e.status === 'ready' ? '✅' : ''}
            </span>
          ))}
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--c-text-muted)' }}>
          本地已安装：<span style={{ color: 'var(--c-text)', fontWeight: 600 }}>{installedCount}</span> / {ENGINES.length} 个智能体
        </div>
      </div>

      {/* 引擎卡片网格 */}
      <div style={{ textAlign: 'center', margin: '1.5rem 0 1rem' }}>
        <h2 style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--c-text)',
          fontFamily: 'var(--font-display)',
        }}>
          选择一个智能体来对话
        </h2>
      </div>

      <div className="w-full max-w-2xl" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '0.75rem',
      }}>
        {engines.map(engine => {
          const status = getStatusLabel(engine.status);
          const isReady = engine.status === 'ready';
          const caps = engine.capabilities || [];
          return (
            <div
              key={engine.id}
              className="engine-card"
              onClick={() => handleEngineClick(engine)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1.125rem' }}>{engine.emoji}</span>
                    {engine.name}
                    {engine.homepageUrl && (
                      <a
                        href={engine.homepageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          color: 'var(--c-text-muted)',
                          fontSize: '0.75rem',
                          textDecoration: 'none',
                          transition: 'color var(--dur-fast)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--c-accent)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--c-text-muted)'}
                        title="查看官方文档"
                      >
                        {useSVG ? <IconExternalLink size={12} /> : '🔗'}
                      </a>
                    )}
                  </h3>
                  <p style={{ color: 'var(--c-text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', lineHeight: 1.5 }}>
                    {engine.description}
                  </p>
                  {/* Capability tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '6px' }}>
                    {caps.slice(0, 4).map(cap => {
                      const capLabels: Record<string, string> = {
                        chat: '💬', streaming: '⚡', thinking: '🧠', tools: '🔧',
                        code: '💻', filesystem: '📁', browser: '🌐', planning: '📋',
                      };
                      return (
                        <span key={cap} style={{
                          fontSize: '0.625rem',
                          padding: '1px 5px',
                          borderRadius: '6px',
                          background: 'var(--c-bg-hover)',
                          color: 'var(--c-text-muted)',
                        }}>
                          {capLabels[cap] || cap}
                        </span>
                      );
                    })}
                    {caps.length > 4 && (
                      <span style={{ fontSize: '0.625rem', color: 'var(--c-text-muted)' }}>+{caps.length - 4}</span>
                    )}
                  </div>
                </div>
                <span className={status.className} style={{ flexShrink: 0, marginLeft: '8px' }}>
                  {status.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '1rem' }}>
        <div
          className="engine-card"
          style={{
            opacity: 0.7,
            cursor: 'default',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {useSVG ? <IconPlus size={18} /> : <span>➕</span>}
          <span style={{ fontSize: '0.875rem', color: 'var(--c-text-muted)' }}>更多引擎 · 开发中</span>
        </div>
      </div>

      {/* 依赖环境状态 */}
      {envStatus && (
        <div className="paper-card" style={{
          marginTop: '2rem',
          padding: '1rem 1.25rem',
          maxWidth: '700px',
          width: '100%',
        }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--c-text)' }}>
            📦 运行环境状态
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <EnvItem
              icon="🟢"
              label="Node.js"
              value={envStatus.nodeVersion}
              ok={envStatus.nodeReady}
              helpUrl="https://nodejs.org/dist/"
            />
            <EnvItem
              icon="📦"
              label="依赖包"
              value={envStatus.depsReady ? '已安装' : '未安装'}
              ok={envStatus.depsReady}
              helpUrl="#"
              helpText={envStatus.depsReady ? '' : '请重新运行 start.bat'}
            />
            <EnvItem
              icon="🤖"
              label="引擎目录"
              value={envStatus.enginesDirReady ? '已就绪' : '未就绪'}
              ok={envStatus.enginesDirReady}
              helpUrl="#"
              helpText={envStatus.enginesDirReady ? '' : '请重新运行 start.bat'}
            />
          </div>
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <button
          onClick={() => setShowGuide(true)}
          style={{
            color: 'var(--c-text-muted)',
            fontSize: '0.875rem',
            textDecoration: 'underline',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'color var(--dur-fast)',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--c-text-soft)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--c-text-muted)'}
        >
          怎么用？
        </button>
      </div>

      {/* 引擎安装确认弹窗 */}
      {confirmEngine && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <div className="paper-card" style={{ padding: '1.5rem', maxWidth: '340px', width: '100%', margin: '0 1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                {confirmEngine.emoji}
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                安装 {confirmEngine.name}？
              </h3>
              <p style={{ color: 'var(--c-text-muted)', fontSize: '0.8125rem', lineHeight: 1.6 }}>
                是否拉取并安装「{confirmEngine.name}」智能体？
                {confirmEngine.description}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setConfirmEngine(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--c-border)',
                  background: 'var(--c-bg-hover)',
                  color: 'var(--c-text)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                否
              </button>
              <button
                onClick={handleConfirmInstall}
                className="btn-primary"
                style={{ flex: 1, padding: '10px' }}
              >
                是，安装
              </button>
            </div>
          </div>
        </div>
      )}

      {showGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setShowGuide(false)}
        >
          <div
            className="paper-card"
            style={{ padding: '2rem', maxWidth: '320px', width: '100%', margin: '0 1rem' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>使用指南</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--c-text-muted)' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <span style={{ color: 'var(--c-accent)', fontWeight: 700 }}>1.</span>
                <span>选择一个智能体引擎卡片</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <span style={{ color: 'var(--c-accent)', fontWeight: 700 }}>2.</span>
                <span>未安装的引擎会先询问是否安装</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <span style={{ color: 'var(--c-accent)', fontWeight: 700 }}>3.</span>
                <span>在对话页面输入问题，AI 实时回复</span>
              </div>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="btn-primary"
              style={{ marginTop: '1rem', width: '100%', padding: '8px 16px' }}
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {installingEngine && (
        <EngineInstallModal
          engine={installingEngine}
          onClose={() => setInstallingEngine(null)}
          onInstalled={handleEngineInstalled}
        />
      )}

      {configEngine && (
        <EngineConfigGuide
          engine={configEngine}
          initialConfig={engineConfigs[configEngine.id]}
          onClose={() => setConfigEngine(null)}
          onConfigured={handleConfigured}
          variant="modal"
        />
      )}
    </div>
  );
}

function EnvItem({ icon, label, value, ok, helpUrl, helpText }: {
  icon: string;
  label: string;
  value: string;
  ok: boolean;
  helpUrl?: string;
  helpText?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      borderRadius: 'var(--r-md)',
      background: ok ? 'var(--c-success-bg, #f0fdf4)' : 'var(--c-error-bg, #fef2f2)',
      fontSize: '0.8125rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{ok ? icon : '❌'}</span>
        <span style={{ color: 'var(--c-text)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: ok ? 'var(--c-success-text, #059669)' : 'var(--c-error-text, #dc2626)', fontWeight: 500 }}>
          {value}
        </span>
        {!ok && helpUrl && (
          <a
            href={helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--c-accent)',
              fontSize: '0.75rem',
              textDecoration: 'none',
            }}
          >
            手动下载
          </a>
        )}
        {!ok && helpText && !helpUrl && (
          <span style={{ color: 'var(--c-text-muted)', fontSize: '0.75rem' }}>
            {helpText}
          </span>
        )}
      </div>
    </div>
  );
}
