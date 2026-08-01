import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { APP_NAME, ENGINES } from '@greenhorn/shared/constants';
import type { EngineInfo } from '@greenhorn/shared/constants';
import { useApp } from '../context/AppContext';
import { IconLeaf, IconSparkles, IconPlus } from '../components/icons';
import EngineInstallModal from '../components/EngineInstallModal';

interface EngineStatus {
  id: string;
  installed: boolean;
  installPath?: string;
  dataPath?: string;
  version?: string;
  canDetect: boolean;
  detectionNote?: string;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { useSVG } = useApp();
  const [engines, setEngines] = useState<EngineInfo[]>(
    ENGINES.map(e => ({ ...e }))
  );
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [installingEngine, setInstallingEngine] = useState<EngineInfo | null>(null);

  useEffect(() => {
    fetch('/api/engines/status')
      .then(res => res.json())
      .then((data: { engines: EngineStatus[]; location: { warning: string | null } }) => {
        if (data.location?.warning) {
          setLocationWarning(data.location.warning);
        }
        setEngines(prev =>
          prev.map(e => {
            const status = data.engines.find((s: EngineStatus) => s.id === e.id);
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

  const handleEngineClick = (engine: EngineInfo) => {
    if (engine.status === 'ready') {
      navigate(`/chat?engine=${engine.id}`);
    } else {
      setInstallingEngine(engine);
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
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '0 1rem',
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

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--c-accent)',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          letterSpacing: 'var(--font-tracking)',
        }}>
          {useSVG ? <IconLeaf size={36} /> : <span>🍃</span>}
          {APP_NAME}
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--c-text-soft)', fontFamily: 'var(--font-display)' }}>
          选择一个智能体来对话
        </p>
      </div>

      <div className="w-full max-w-2xl" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '0.75rem',
      }}>
        {engines.map(engine => {
          const status = getStatusLabel(engine.status);
          const isReady = engine.status === 'ready';
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
                  </h3>
                  <p style={{ color: 'var(--c-text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', lineHeight: 1.5 }}>
                    {engine.description}
                  </p>
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

      <div style={{ marginTop: '2rem' }}>
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
                <span>未安装的引擎会自动引导安装</span>
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
    </div>
  );
}
