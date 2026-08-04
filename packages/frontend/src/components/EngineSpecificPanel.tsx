import React, { useState, useEffect } from 'react';
import type { EngineDefinition } from '@greenhorn/shared/constants';
import { useApp, type EngineConfig } from '../context/AppContext';

interface EngineSpecificPanelProps {
  engine: EngineDefinition;
  engineConfig: EngineConfig;
  onConfigChange: (patch: Partial<EngineConfig>) => void;
  onClose: () => void;
}

export default function EngineSpecificPanel({
  engine,
  engineConfig,
  onConfigChange,
  onClose,
}: EngineSpecificPanelProps) {
  const { useSVG } = useApp();

  const specific = engineConfig.engineSpecific || {};

  const updateSpecific = (key: string, value: any) => {
    onConfigChange({
      engineSpecific: { ...specific, [key]: value },
    });
  };

  // ===== Hermes MoA Panel =====
  if (engine.id === 'hermes') {
    return (
      <SpecificPanelFrame title="Hermes 专属配置" engine={engine} onClose={onClose} useSVG={useSVG}>
        <Section title="MoA (Mixture of Agents)">
          <Field label="子智能体数量" hint="多个专家协作完成任务">
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => updateSpecific('moaAgents', n)}
                  style={pillStyle(specific.moaAgents === n)}
                >
                  {n} 个
                </button>
              ))}
            </div>
          </Field>
          <Field label="聚合策略" hint="子 Agent 结果如何合并">
            <div style={{ display: 'flex', gap: '6px' }}>
              {['vote', 'concat', 'best'].map(s => (
                <button
                  key={s}
                  onClick={() => updateSpecific('moaStrategy', s)}
                  style={pillStyle(specific.moaStrategy === s)}
                >
                  {s === 'vote' ? '投票' : s === 'concat' ? '拼接' : '最佳'}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        <Section title="Hermes 系统配置">
          <Field label="系统提示词前缀" hint="添加到每次对话开头">
            <input
              type="text"
              value={specific.systemPrefix || ''}
              onChange={(e) => updateSpecific('systemPrefix', e.target.value)}
              placeholder="例如：你是一名资深全栈工程师..."
              style={inputStyle}
            />
          </Field>
          <Field label="记忆轮数" hint="保留最近 N 轮对话上下文">
            <div style={{ display: 'flex', gap: '6px' }}>
              {[5, 10, 20, 50].map(n => (
                <button
                  key={n}
                  onClick={() => updateSpecific('memoryRounds', n)}
                  style={pillStyle(specific.memoryRounds === n)}
                >
                  {n} 轮
                </button>
              ))}
            </div>
          </Field>
          <Field label="自动压缩" hint="上下文过长时自动总结压缩">
            <Toggle
              checked={specific.autoCompaction ?? true}
              onChange={(v) => updateSpecific('autoCompaction', v)}
            />
          </Field>
        </Section>
      </SpecificPanelFrame>
    );
  }

  // ===== Codex Approval Panel =====
  if (engine.id === 'codex') {
    return (
      <SpecificPanelFrame title="Codex 专属配置" engine={engine} onClose={onClose} useSVG={useSVG}>
        <Section title="审批模式">
          <Field label="工具调用审批" hint="Codex 执行操作前是否需要确认">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { id: 'auto', label: '⚡ 自动执行', desc: '所有操作自动完成，无需确认' },
                { id: 'confirm', label: '✓ 关键操作确认', desc: '文件写入、命令执行前弹窗确认' },
                { id: 'strict', label: '🔒 全部审批', desc: '每个操作都需手动确认' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => updateSpecific('approvalMode', m.id)}
                  style={{
                    ...radioStyle,
                    borderColor: specific.approvalMode === m.id ? 'var(--c-accent)' : 'var(--c-border)',
                    background: specific.approvalMode === m.id ? 'var(--c-accent-soft)' : 'var(--c-surface-2)',
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: specific.approvalMode === m.id ? 600 : 400 }}>{m.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>{m.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </Field>
        </Section>

        <Section title="Codex 系统配置">
          <Field label="最大工具调用轮次" hint="单次对话中工具调用最大次数">
            <input
              type="number"
              min={1}
              max={100}
              value={specific.maxToolRounds || 30}
              onChange={(e) => updateSpecific('maxToolRounds', parseInt(e.target.value) || 30)}
              style={inputStyle}
            />
          </Field>
          <Field label="文件操作路径限制" hint="限制 Codex 可操作的目录（可选）">
            <input
              type="text"
              value={specific.allowedPaths || ''}
              onChange={(e) => updateSpecific('allowedPaths', e.target.value)}
              placeholder="留空表示无限制，例如：~/projects"
              style={inputStyle}
            />
          </Field>
        </Section>
      </SpecificPanelFrame>
    );
  }

  // ===== Reasonix Fleet Panel =====
  if (engine.id === 'reasonix') {
    return (
      <SpecificPanelFrame title="Reasonix 专属配置" engine={engine} onClose={onClose} useSVG={useSVG}>
        <Section title="Fleet 模式">
          <Field label="启用 Fleet 模式" hint="多模型路由，自动选择最优模型">
            <Toggle
              checked={specific.fleetEnabled ?? false}
              onChange={(v) => updateSpecific('fleetEnabled', v)}
            />
          </Field>
          {specific.fleetEnabled && (
            <>
              <Field label="主模型" hint="主力推理模型">
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['deepseek-reasoner', 'deepseek-chat'].map(m => (
                    <button
                      key={m}
                      onClick={() => updateSpecific('fleetPrimary', m)}
                      style={pillStyle(specific.fleetPrimary === m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="回退模型" hint="主模型失败时使用">
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['deepseek-chat', 'deepseek-reasoner'].map(m => (
                    <button
                      key={m}
                      onClick={() => updateSpecific('fleetFallback', m)}
                      style={pillStyle(specific.fleetFallback === m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}
        </Section>

        <Section title="Reasonix 推理配置">
          <Field label="推理深度" hint="控制思维链长度">
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'quick', label: '快速' },
                { id: 'balanced', label: '平衡' },
                { id: 'deep', label: '深度' },
              ].map(l => (
                <button
                  key={l.id}
                  onClick={() => updateSpecific('reasoningDepth', l.id)}
                  style={pillStyle(specific.reasoningDepth === l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </Field>
        </Section>
      </SpecificPanelFrame>
    );
  }

  // ===== Default: no specific panel =====
  return null;
}

// ===== Helper Components =====

function SpecificPanelFrame({
  title, engine, onClose, useSVG, children,
}: {
  title: string;
  engine: EngineDefinition;
  onClose: () => void;
  useSVG: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--c-surface-2)',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--c-border)',
      padding: '12px',
      margin: '8px 0',
      maxWidth: '560px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--c-border-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{engine.emoji}</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--c-text)' }}>{title}</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '1rem',
            cursor: 'pointer',
            color: 'var(--c-text-muted)',
            padding: '2px 6px',
          }}
        >×</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--c-accent)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--c-text-soft)', marginBottom: '4px' }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: '0.6875rem', color: 'var(--c-text-muted)', marginTop: '3px' }}>{hint}</div>}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        border: 'none',
        background: checked ? 'var(--c-accent)' : 'var(--c-surface-3)',
        position: 'relative',
        cursor: 'pointer',
        padding: 0,
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute',
        top: '2px',
        left: checked ? '22px' : '2px',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

// ===== Shared Styles =====
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--c-border)',
  background: 'var(--c-surface-1)',
  color: 'var(--c-text)',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '5px 10px',
    borderRadius: '12px',
    border: active ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
    background: active ? 'var(--c-accent-soft)' : 'var(--c-surface-1)',
    color: active ? 'var(--c-accent)' : 'var(--c-text)',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    fontWeight: active ? 600 : 400,
    transition: 'all 0.15s',
  };
}

const radioStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--c-border)',
  background: 'var(--c-surface-2)',
  color: 'var(--c-text)',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
};