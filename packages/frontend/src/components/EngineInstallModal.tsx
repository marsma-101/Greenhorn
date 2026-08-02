import { useState, useEffect, useRef } from 'react';
import type { EngineDefinition } from '@greenhorn/shared/constants';
import { useApp } from '../context/AppContext';
import { IconCheck, IconSparkles } from './icons';

interface EngineSourceInfo {
  id: string;
  name: string;
  description: string;
  dependencies: string;
  localSource: string | null;
  githubUrls: string[];
  hasLocal: boolean;
}

interface InstallProgress {
  stage: string;
  message: string;
  percent: number;
}

interface InstallResult {
  success: boolean;
  engineId: string;
  installPath: string;
  message: string;
  progress: InstallProgress[];
}

interface EngineInstallModalProps {
  engine: EngineDefinition;
  onClose: () => void;
  onInstalled: (engineId: string) => void;
}

type InstallStage = 'info' | 'configuring' | 'installing' | 'done' | 'error';

export default function EngineInstallModal({ engine, onClose, onInstalled }: EngineInstallModalProps) {
  const { useSVG } = useApp();
  const [sourceInfo, setSourceInfo] = useState<EngineSourceInfo | null>(null);
  const [stage, setStage] = useState<InstallStage>('info');
  const [progress, setProgress] = useState<InstallProgress[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<InstallResult | null>(null);
  const [installMethod, setInstallMethod] = useState<'local' | 'remote'>('local');
  const [reinstall, setReinstall] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/engines/${engine.id}/source`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSourceInfo(data.source);
          if (!data.source.hasLocal) {
            setInstallMethod('remote');
          }
        }
      })
      .catch(() => {
        setErrorMessage('无法获取引擎信息');
      });
  }, [engine.id]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stage === 'info') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [stage, onClose]);

  const startInstall = async () => {
    if (!sourceInfo) return;

    setStage('installing');
    setProgress([]);
    setCurrentStep(0);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/engines/${engine.id}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useLocalSource: installMethod === 'local',
          reinstall,
        }),
      });

      const data: InstallResult = await response.json();
      setResult(data);

      if (data.success) {
        setStage('done');
        if (data.progress.length > 0) {
          setProgress(data.progress);
          setCurrentStep(data.progress.length - 1);
        }
        onInstalled(engine.id);
      } else {
        setStage('error');
        setErrorMessage(data.message || '安装失败');
      }
    } catch (err: any) {
      setStage('error');
      setErrorMessage(err.message || '网络错误');
    }
  };

  const retryInstall = () => {
    setStage('info');
    setProgress([]);
    setCurrentStep(0);
    setErrorMessage('');
    setResult(null);
  };

  const getStageIcon = (stageType: string) => {
    const stageIcons: Record<string, { emoji: string; label: string }> = {
      checking: { emoji: '🔍', label: '检查环境' },
      cloning: { emoji: '📥', label: '拉取源码' },
      installing: { emoji: '⚙️', label: '安装依赖' },
      configuring: { emoji: '🔧', label: '配置环境' },
      done: { emoji: '✅', label: '安装完成' },
      error: { emoji: '❌', label: '安装失败' },
    };
    return stageIcons[stageType] || { emoji: '⏳', label: stageType };
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
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && stage === 'info') {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="paper-card"
        style={{
          padding: '1.5rem',
          maxWidth: '480px',
          width: '100%',
          margin: '0 1rem',
          maxHeight: '90vh',
          overflow: 'auto',
          animation: 'slideUp 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '2rem' }}>{engine.emoji}</span>
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{engine.name}</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>{engine.description}</p>
            </div>
          </div>
          {stage === 'info' && (
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
          )}
        </div>

        {/* Stage: Info - Installation options */}
        {stage === 'info' && sourceInfo && (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--c-text-soft)' }}>
                安装方式
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sourceInfo.hasLocal && (
                  <button
                    onClick={() => setInstallMethod('local')}
                    className="engine-card"
                    style={{
                      padding: '12px 16px',
                      borderColor: installMethod === 'local' ? 'var(--c-accent)' : 'var(--c-border-soft)',
                      borderWidth: installMethod === 'local' ? '2px' : '1px',
                      background: installMethod === 'local' ? 'var(--c-accent-soft)' : 'var(--c-surface-1)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>📦 本地安装</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)', marginTop: '2px' }}>
                          从本地源码复制（推荐，速度快）
                        </div>
                      </div>
                      {installMethod === 'local' && <span style={{ color: 'var(--c-accent)' }}>✓</span>}
                    </div>
                  </button>
                )}
                <button
                  onClick={() => setInstallMethod('remote')}
                  className="engine-card"
                  style={{
                    padding: '12px 16px',
                    borderColor: installMethod === 'remote' ? 'var(--c-accent)' : 'var(--c-border-soft)',
                    borderWidth: installMethod === 'remote' ? '2px' : '1px',
                    background: installMethod === 'remote' ? 'var(--c-accent-soft)' : 'var(--c-surface-1)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>☁️ 远程下载</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)', marginTop: '2px' }}>
                        从 GitHub 拉取源码（支持镜像降级）
                      </div>
                    </div>
                    {installMethod === 'remote' && <span style={{ color: 'var(--c-accent)' }}>✓</span>}
                  </div>
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--c-text-soft)' }}>
                引擎信息
              </h3>
              <div style={{ background: 'var(--c-surface-2)', borderRadius: 'var(--r-md)', padding: '12px 16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--c-text-muted)' }}>引擎名称</span>
                  <span style={{ fontWeight: 500 }}>{sourceInfo.name}</span>
                  <span style={{ color: 'var(--c-text-muted)' }}>依赖类型</span>
                  <span>{sourceInfo.dependencies}</span>
                  {sourceInfo.localSource && (
                    <>
                      <span style={{ color: 'var(--c-text-muted)' }}>本地路径</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.6875rem' }}>{sourceInfo.localSource}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={reinstall}
                onChange={(e) => setReinstall(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ color: 'var(--c-text-muted)' }}>强制重新安装（覆盖已有版本）</span>
            </label>

            <button
              onClick={startInstall}
              className="btn-primary"
              style={{ width: '100%', padding: '10px 16px', fontSize: '0.9375rem' }}
            >
              {useSVG ? <IconSparkles size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} /> : '🚀 '}
              开始安装
            </button>
          </>
        )}

        {/* Stage: Installing */}
        {stage === 'installing' && (
          <>
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
                {useSVG ? <IconSparkles size={40} /> : '⚙️'}
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>正在安装 {engine.name}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--c-text-muted)' }}>
                {progress[currentStep]?.message || '正在准备...'}
              </p>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ background: 'var(--c-surface-2)', borderRadius: 'var(--r-full)', height: '8px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--c-accent), var(--c-accent-dim))',
                    borderRadius: 'var(--r-full)',
                    transition: 'width 0.3s ease-out',
                    width: `${progress[currentStep]?.percent || 10}%`,
                  }}
                />
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--c-text-muted)', marginTop: '4px' }}>
                {progress[currentStep]?.percent || 0}%
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {progress.map((step, idx) => {
                const { emoji, label } = getStageIcon(step.stage);
                const isDone = idx < currentStep;
                const isCurrent = idx === currentStep;
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: 'var(--r-sm)',
                      background: isCurrent ? 'var(--c-accent-soft)' : 'transparent',
                      opacity: isDone ? 1 : isCurrent ? 1 : 0.5,
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>
                      {isDone ? '✅' : emoji}
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: isCurrent ? 500 : 400 }}>
                      {label}
                    </span>
                    {isCurrent && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>
                        {step.percent}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Stage: Done */}
        {stage === 'done' && result && (
          <>
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎉</div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--c-accent)' }}>
                安装完成！
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--c-text-muted)' }}>
                {result.message}
              </p>
            </div>

            <div style={{ background: 'var(--c-surface-2)', borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--c-text-muted)' }}>安装路径</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{result.installPath}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'var(--c-surface-2)',
                  border: 'none',
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                关闭
              </button>
              <button
                onClick={() => onClose()}
                className="btn-primary"
                style={{ flex: 1, padding: '10px 16px' }}
              >
                开始对话 →
              </button>
            </div>
          </>
        )}

        {/* Stage: Error */}
        {stage === 'error' && (
          <>
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>😔</div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: '#ef4444' }}>
                安装失败
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--c-text-muted)', whiteSpace: 'pre-line' }}>
                {errorMessage}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'var(--c-surface-2)',
                  border: 'none',
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                取消
              </button>
              <button
                onClick={retryInstall}
                className="btn-primary"
                style={{ flex: 1, padding: '10px 16px' }}
              >
                重试
              </button>
            </div>
          </>
        )}

        {/* Loading state */}
        {!sourceInfo && stage === 'info' && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '1.5rem' }}>⏳</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--c-text-muted)' }}>加载引擎信息...</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
