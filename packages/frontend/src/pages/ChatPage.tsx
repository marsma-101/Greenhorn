import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApp, type EngineConfig } from '../context/AppContext';
import {
  IconPaperclip, IconBulb, IconBolt, IconX, IconDocument,
  IconSparkles, IconTerminal, IconSearch, IconBrowser,
  IconCode, IconFolder, IconTool, IconChevronDown, IconCheck
} from '../components/icons';
import { ENGINES } from '@greenhorn/shared/constants';
import type { EngineDefinition, PromptTemplate, Skill } from '@greenhorn/shared';
import EngineConfigGuide from '../components/EngineConfigGuide';
import EngineSpecificPanel from '../components/EngineSpecificPanel';

const THINKING_LEVELS = [
  { id: 'off', name: '关闭' },
  { id: 'low', name: '低' },
  { id: 'medium', name: '中' },
  { id: 'high', name: '高' },
];

const TEMP_PRESETS = [
  { value: 0.3, label: '精确' },
  { value: 0.7, label: '平衡' },
  { value: 1.0, label: '创意' },
];

const PERSONA_OPTIONS = [
  { id: '', name: '默认' },
  { id: '通用助手，友好、简洁、全面', name: '通用助手' },
  { id: '代码专家，专注代码、调试、最佳实践', name: '代码专家' },
  { id: '翻译助手，专业翻译、多语言互译', name: '翻译助手' },
  { id: '教师模式，循循善诱、详细解释', name: '教师模式' },
];

const SAMPLE_QUESTIONS = [
  '帮我写一个 Python 函数，计算斐波那契数列',
  '解释一下 React 的 useEffect 怎么用',
  '这段代码有什么问题？帮我调试一下',
  '用 SQL 实现一个简单的用户表增删改查',
];

const CAPABILITY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  chat: { label: '对话', icon: '💬', color: '#10b981' },
  streaming: { label: '流式', icon: '⚡', color: '#f59e0b' },
  thinking: { label: '思考', icon: '🧠', color: '#8b5cf6' },
  tools: { label: '工具', icon: '🔧', color: '#3b82f6' },
  code: { label: '代码', icon: '💻', color: '#06b6d4' },
  filesystem: { label: '文件', icon: '📁', color: '#84cc16' },
  browser: { label: '浏览器', icon: '🌐', color: '#ec4899' },
  planning: { label: '规划', icon: '📋', color: '#f97316' },
};

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    config, configLoaded, settings, updateSettings,
    currentSessionId, setCurrentSessionId,
    createNewSession, refreshSessions, useSVG,
    engineConfigs, loadEngineConfig, saveEngineConfig,
    engineStatuses,
  } = useApp();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [engineId, setEngineId] = useState(searchParams.get('engine') || 'pi');
  const [showEnginePicker, setShowEnginePicker] = useState(false);
  const [engineConfig, setEngineConfig] = useState<EngineConfig>({ temperature: 0.7, thinkingLevel: 'off' });
  const [engineStatus, setEngineStatus] = useState<{ installed: boolean; running: boolean } | null>(null);

  const currentEngine: EngineDefinition = ENGINES.find(e => e.id === engineId) || ENGINES[0];
  const capabilities = currentEngine.capabilities || [];

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState('');
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [typingFast, setTypingFast] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string; size: number }>>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showSkillsPicker, setShowSkillsPicker] = useState(false);
  const [showEngineSpecific, setShowEngineSpecific] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const templateBtnRef = useRef<HTMLButtonElement>(null);

  // Load engine config when engine changes
  useEffect(() => {
    loadEngineConfig(engineId).then(cfg => {
      setEngineConfig(cfg);
    });
    const status = engineStatuses.find(s => s.engineId === engineId);
    setEngineStatus(status ? { installed: status.installed, running: status.running } : null);
    setMessages([]);
    setCurrentSessionId(null);
  }, [engineId, engineStatuses]);

  // Read engine from URL param
  useEffect(() => {
    const urlEngine = searchParams.get('engine');
    if (urlEngine && urlEngine !== engineId) {
      setEngineId(urlEngine);
    }
  }, [searchParams]);

  const switchEngine = useCallback((newEngineId: string) => {
    setEngineId(newEngineId);
    setShowEnginePicker(false);
    navigate(`/chat?engine=${newEngineId}`, { replace: true });
  }, [navigate]);

  // Persist engine config changes
  const updateEngineConfig = useCallback(async (patch: Partial<EngineConfig>) => {
    const newConfig = { ...engineConfig, ...patch };
    setEngineConfig(newConfig);
    await saveEngineConfig(engineId, newConfig);
  }, [engineConfig, engineId, saveEngineConfig]);

  // Load messages when session changes
  useEffect(() => {
    if (!currentSessionId) {
      (async () => {
        const res = await fetch('/api/sessions');
        const data = await res.json();
        const list = data.sessions || [];
        if (list.length > 0) {
          setCurrentSessionId(list[0].id);
        } else {
          await createNewSession();
        }
      })();
      return;
    }

    setMessages([]);
    fetch(`/api/sessions/${currentSessionId}`)
      .then(res => res.json())
      .then(s => {
        if (s.success && s.session) {
          setMessages(s.session.messages || []);
        }
      })
      .catch(() => {});
  }, [currentSessionId]);

  // Load prompt templates and skills
  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(data => setTemplates(data.templates || []))
      .catch(() => setTemplates([]));
    fetch('/api/skills')
      .then(r => r.json())
      .then(data => setSkills((data.skills || []).filter((s: Skill) => s.enabled)))
      .catch(() => setSkills([]));
  }, []);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingContent, showThinking]);

  const isFirstVisit = messages.length === 0;

  const hasCapability = useCallback((cap: string) => capabilities.includes(cap), [capabilities]);

  const saveMessageToSession = async (role: string, content: string) => {
    if (!currentSessionId) return;
    try {
      await fetch(`/api/sessions/${currentSessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { role, content } }),
      });
      refreshSessions();
    } catch {
      // ignore
    }
  };

  const buildSystemPrompt = useCallback((): string | undefined => {
    const parts: string[] = [];
    const persona = engineConfig.persona || settings.enginePersonas?.[engineId] || settings.persona;
    if (persona) {
      parts.push(`你是一个${persona}。`);
    }
    if (uploadedFiles.length > 0) {
      const fileContext = uploadedFiles.map(f => {
        const truncated = f.content.length > 20000 ? f.content.slice(0, 20000) + '...(truncated)' : f.content;
        return `用户上传了文件 ${f.name}，内容如下：\n---\n${truncated}\n---`;
      }).join('\n\n');
      parts.push(fileContext);
    }
    return parts.length > 0 ? parts.join('\n\n') : undefined;
  }, [engineConfig.persona, settings.enginePersonas, settings.persona, uploadedFiles, engineId]);

  const handleSend = async (text?: string) => {
    const userMessage = (text || input).trim();
    if (!userMessage || isStreaming) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setInput('');
    const newUserMsg = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, newUserMsg]);
    await saveMessageToSession('user', userMessage);
    setIsStreaming(true);
    setShowThinking(true);
    setThinkingContent('');
    setThinkingExpanded(true);

    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const systemPrompt = buildSystemPrompt();
    const temperature = engineConfig.temperature ?? 0.7;
    const thinkingLevel = engineConfig.thinkingLevel ?? 'off';

    try {
      const response = await fetch(`/api/engines/${engineId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: userMessage }],
          systemPrompt,
          temperature,
          maxTokens: temperature > 0.7 ? 8192 : 4096,
          sessionId: currentSessionId || undefined,
          stream: true,
          thinkingLevel,
        }),
        signal: controller.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text') {
                assistantContent = data.content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  if (newMessages[newMessages.length - 1]?.role === 'assistant') {
                    newMessages[newMessages.length - 1] = { role: 'assistant', content: assistantContent };
                  } else {
                    newMessages.push({ role: 'assistant', content: assistantContent });
                  }
                  return newMessages;
                });
              } else if (data.type === 'thinking') {
                setShowThinking(true);
                setThinkingContent(data.content);
              } else if (data.type === 'done') {
                setShowThinking(false);
                setThinkingContent('');
                setThinkingExpanded(false);
              } else if (data.type === 'error') {
                setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${data.message}` }]);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      if (assistantContent) {
        await saveMessageToSession('assistant', assistantContent);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ 出了点小问题，请再试一次' }]);
    } finally {
      setIsStreaming(false);
      setShowThinking(false);
      setThinkingContent('');
      setThinkingExpanded(false);
      setUploadedFiles([]);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
    setShowThinking(false);
    setThinkingContent('');
    setThinkingExpanded(false);
  };

  const insertTemplate = (template: PromptTemplate) => {
    setInput(prev => {
      const sep = prev.length > 0 && !prev.endsWith('\n') ? '\n' : '';
      return prev + sep + template.content;
    });
    setShowTemplatePicker(false);
  };

  const insertSkill = (skill: Skill) => {
    setInput(prev => {
      const sep = prev.length > 0 && !prev.endsWith('\n') ? '\n' : '';
      return prev + sep + `# 技能：${skill.name}\n${skill.prompt}`;
    });
    setShowSkillsPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const MAX_FILE_SIZE = 500 * 1024;
  const ALLOWED_EXTENSIONS = ['.txt', '.md', '.json', '.js', '.ts', '.py', '.html', '.css', '.xml', '.yaml', '.yml', '.csv'];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        alert(`不支持的文件类型：${file.name}`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`文件过大：${file.name}（最大 500KB）`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedFiles(prev => [...prev, { name: file.name, content: reader.result as string, size: file.size }]);
      };
      reader.readAsText(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const hideThinkingBlock = settings.hideThinkingBlock;

  const statusText = engineStatus?.installed
    ? (engineStatus.running ? '运行中' : '已就绪')
    : '未安装';
  const statusColor = engineStatus?.installed
    ? (engineStatus.running ? '#10b981' : '#6b7280')
    : '#ef4444';

  // Check if engine requires API key but has no config
  const needsApiKey = currentEngine.requiresApiKey && !engineConfig?.apiKey;
  const isConfiguring = needsApiKey;

  if (isConfiguring) {
    return (
      <div className="flex flex-col h-full paper-card m-2 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[oklch(90%_0.01_145)] dark:border-[oklch(25%_0.01_145)] bg-[oklch(99%_0.003_145)] dark:bg-[oklch(20%_0.003_145)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.25rem' }}>{currentEngine.emoji}</span>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--c-text)' }}>
                {currentEngine.name}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--c-text-soft)' }}>
                配置 API Key 后才能使用
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--r-sm)',
              fontSize: '0.75rem',
              border: '1px solid var(--c-border-soft)',
              background: 'transparent',
              color: 'var(--c-text-soft)',
              cursor: 'pointer',
            }}
          >
            返回首页
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-8 flex items-center justify-center">
          <EngineConfigGuide
            engine={currentEngine}
            initialConfig={engineConfig}
            onClose={() => navigate('/')}
            onConfigured={() => { /* config saved, messages empty, engine ready */ }}
            variant="inline"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full paper-card m-2 rounded-2xl overflow-hidden">
      {/* Header with engine switcher */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[oklch(90%_0.01_145)] dark:border-[oklch(25%_0.01_145)] bg-[oklch(99%_0.003_145)] dark:bg-[oklch(20%_0.003_145)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '1.25rem' }}>{currentEngine.emoji}</span>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--c-text)', lineHeight: 1.2 }}>
              {currentEngine.name}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--c-text-soft)', lineHeight: 1.2 }}>
              {currentEngine.description}
            </div>
          </div>

          {/* Engine status badge */}
          {engineStatus && (
            <span style={{
              marginLeft: '8px',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.6875rem',
              background: engineStatus?.installed ? '#d1fae5' : '#fee2e2',
              color: statusColor,
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
              {statusText}
            </span>
          )}

          {/* Engine capabilities */}
          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
            {capabilities.slice(0, 5).map(cap => {
              const info = CAPABILITY_LABELS[cap];
              if (!info) return null;
              return (
                <span key={cap} title={info.label} style={{
                  fontSize: '0.625rem',
                  padding: '1px 6px',
                  borderRadius: '8px',
                  background: info.color + '18',
                  color: info.color,
                  fontWeight: 500,
                }}>
                  {info.icon} {info.label}
                </span>
              );
            })}
          </div>

          {/* Engine switcher */}
          <div style={{ position: 'relative', marginLeft: '8px' }}>
            <button
              onClick={() => setShowEnginePicker(v => !v)}
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--r-sm)',
                fontSize: '0.75rem',
                border: '1px solid var(--c-border-soft)',
                background: showEnginePicker ? 'var(--c-accent-soft)' : 'transparent',
                color: showEnginePicker ? 'var(--c-accent)' : 'var(--c-text-soft)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all var(--dur-fast)',
              }}
            >
              切换 <IconChevronDown size={12} />
            </button>
            {showEnginePicker && (
              <div
                className="frosted-panel"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  minWidth: 200,
                  borderRadius: 'var(--r-lg)',
                  border: '1px solid var(--c-border)',
                  padding: '4px',
                  zIndex: 30,
                  background: 'var(--c-surface-1)',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                {ENGINES.map(e => {
                  const status = engineStatuses.find(s => s.engineId === e.id);
                  const isActive = e.id === engineId;
                  return (
                    <button
                      key={e.id}
                      onClick={() => switchEngine(e.id)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: 'var(--r-sm)',
                        fontSize: '0.8125rem',
                        color: 'var(--c-text)',
                        background: isActive ? 'var(--c-accent-soft)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: isActive ? 600 : 400,
                      }}
                      onMouseEnter={ev => { if (!isActive) ev.currentTarget.style.backgroundColor = 'var(--c-bg-session-item)'; }}
                      onMouseLeave={ev => { if (!isActive) ev.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <span>{e.emoji}</span>
                      <span style={{ flex: 1 }}>{e.name}</span>
                      {status?.installed && (
                        <IconCheck size={12} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Engine-specific indicator */}
        {capabilities.includes('browser') && (
          <span style={{
            fontSize: '0.6875rem',
            color: '#ec4899',
            padding: '2px 8px',
            borderRadius: '8px',
            background: '#ec489918',
            fontWeight: 500,
          }}>
            ⚡ Pro
          </span>
        )}
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto px-6 py-8 ${typingFast ? 'typing-fast' : ''}`}>
        <div className="max-w-3xl mx-auto">
          {isFirstVisit && (
            <div className="text-center py-20">
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>
                {useSVG ? <IconBulb size={48} /> : currentEngine.emoji}
              </div>
              <h2 className="text-xl font-semibold mb-2 text-[oklch(30%_0.02_145)] dark:text-[oklch(85%_0.02_145)]">
                与 {currentEngine.name} 开始对话
              </h2>
              <p className="text-sm text-[oklch(55%_0.015_145)] mb-8">
                {engineConfig.model ? `模型：${engineConfig.model}` : '选择一个模型开始'}
                {engineConfig.persona ? ` · ${engineConfig.persona.split('，')[0]}` : ''}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {SAMPLE_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    disabled={isStreaming}
                    className="px-4 py-3 rounded-2xl border border-[oklch(88%_0.01_145)] dark:border-[oklch(28%_0.01_145)] text-left text-sm hover:border-[oklch(70%_0.08_145)] dark:hover:border-[oklch(40%_0.08_145)] hover:shadow-md transition-all disabled:opacity-50 text-[oklch(35%_0.02_145)] dark:text-[oklch(80%_0.02_145)] bg-[oklch(98%_0.003_145)] dark:bg-[oklch(19%_0.003_145)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex mb-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-[oklch(62%_0.15_145)] text-white rounded-br-md'
                  : 'bg-[oklch(98%_0.003_145)] dark:bg-[oklch(19%_0.003_145)] border border-[oklch(90%_0.01_145)] dark:border-[oklch(28%_0.01_145)] rounded-bl-md'
              }`} style={msg.role === 'assistant' ? { boxShadow: 'var(--shadow-sm)' } : undefined}>
                <p className={`whitespace-pre-wrap ${
                  i === messages.length - 1 && isStreaming && msg.role === 'assistant' ? 'typing-cursor' : ''
                } ${msg.role === 'user' ? 'text-white' : 'text-[oklch(25%_0.02_145)] dark:text-[oklch(85%_0.02_145)]'}`}>
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {/* Thinking block */}
          {!hideThinkingBlock && showThinking && thinkingContent && hasCapability('thinking') && (
            <div className="flex justify-start mb-4">
              <div className="thinking-card" style={{ maxWidth: '80%' }}>
                <button
                  onClick={() => setThinkingExpanded(!thinkingExpanded)}
                  style={{
                    width: '100%', padding: '8px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: '0.75rem', color: 'var(--c-text-muted)',
                    transition: 'color var(--dur-fast)', background: 'transparent', border: 'none', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {useSVG ? <IconBulb size={16} /> : <span>🧠</span>}
                    <span>思考过程</span>
                    <span className="animate-pulse text-[10px]">● 进行中</span>
                  </div>
                  <span>{thinkingExpanded ? '▲ 收起' : '▼ 展开'}</span>
                </button>
                {thinkingExpanded && (
                  <div style={{ padding: '0 16px 12px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--c-text-soft)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {thinkingContent}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!hideThinkingBlock && showThinking && !thinkingContent && hasCapability('thinking') && (
            <div className="flex justify-start mb-4">
              <div className="thinking-card" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>
                  {useSVG ? <IconBulb size={16} /> : <span>🧠</span>}
                  <span>思考中</span>
                  <span className="animate-pulse">...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area with capability-driven toolbar */}
      <div className="border-t border-[oklch(90%_0.01_145)] dark:border-[oklch(25%_0.01_145)] px-4 py-3 flex-shrink-0">
        {/* File preview */}
        {uploadedFiles.length > 0 && (
          <div className="max-w-3xl mx-auto mb-2 flex flex-wrap gap-2">
            {uploadedFiles.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[oklch(90%_0.08_145)] dark:bg-[oklch(25%_0.06_145)] text-[oklch(40%_0.1_145)] dark:text-[oklch(75%_0.1_145)] border border-[oklch(85%_0.06_145)] dark:border-[oklch(30%_0.06_145)]"
              >
                <span>📄</span>
                <span className="max-w-[120px] truncate">{f.name}</span>
                <span className="opacity-60">{(f.size / 1024).toFixed(1)}KB</span>
                <button onClick={() => removeFile(i)} className="ml-1 hover:text-[oklch(55%_0.2_25)]" title="移除">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Capability-driven toolbar */}
        <div className="max-w-3xl mx-auto mb-2 flex items-center gap-2 flex-wrap">
          {/* File upload - only for engines with filesystem or code capability */}
          {hasCapability('filesystem') && (
            <>
              <input
                type="file" ref={fileInputRef} onChange={handleFileSelect} multiple
                accept=".txt,.md,.json,.js,.ts,.py,.html,.css,.xml,.yaml,.yml,.csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()} disabled={isStreaming}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.75rem',
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  border: '1px solid var(--c-border-soft)', color: 'var(--c-text-soft)',
                  transition: 'border-color var(--dur-fast), color var(--dur-fast)',
                  background: 'transparent', cursor: 'pointer', opacity: isStreaming ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!isStreaming) { e.currentTarget.style.borderColor = 'var(--c-accent-dim)'; e.currentTarget.style.color = 'var(--c-accent)'; } }}
                onMouseLeave={e => { if (!isStreaming) { e.currentTarget.style.borderColor = 'var(--c-border-soft)'; e.currentTarget.style.color = 'var(--c-text-soft)'; } }}
                title="选择文件"
              >
                {useSVG ? <IconPaperclip size={14} /> : <span>📎</span>}
                文件
              </button>
            </>
          )}

          {/* Terminal button - code capability */}
          {hasCapability('code') && (
            <button disabled={isStreaming}
              style={{
                padding: '4px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.75rem',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                border: '1px solid var(--c-border-soft)', color: 'var(--c-text-soft)',
                background: 'transparent', cursor: 'pointer', opacity: isStreaming ? 0.5 : 1,
              }}
              title="终端"
            >
              {useSVG ? <IconTerminal size={14} /> : <span>💻</span>}
              终端
            </button>
          )}

          {/* Browser button - browser capability */}
          {hasCapability('browser') && (
            <button disabled={isStreaming}
              style={{
                padding: '4px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.75rem',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                border: '1px solid var(--c-border-soft)', color: 'var(--c-text-soft)',
                background: 'transparent', cursor: 'pointer', opacity: isStreaming ? 0.5 : 1,
              }}
              title="浏览器控制"
            >
              {useSVG ? <IconBrowser size={14} /> : <span>🌐</span>}
              浏览器
            </button>
          )}

          {/* Search button - planning capability */}
          {hasCapability('planning') && (
            <button disabled={isStreaming}
              style={{
                padding: '4px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.75rem',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                border: '1px solid var(--c-border-soft)', color: 'var(--c-text-soft)',
                background: 'transparent', cursor: 'pointer', opacity: isStreaming ? 0.5 : 1,
              }}
              title="联网搜索"
            >
              {useSVG ? <IconSearch size={14} /> : <span>🔍</span>}
              搜索
            </button>
          )}

          {/* Separator */}
          <div style={{ width: 1, height: 20, background: 'var(--c-border-soft)', margin: '0 4px' }} />

          {/* Model selector */}
          <select
            value={engineConfig.model || ''}
            onChange={e => updateEngineConfig({ model: e.target.value })}
            disabled={isStreaming}
            className="ui-select"
            style={{ padding: '4px 10px', fontSize: '0.75rem', width: 'auto', cursor: 'pointer' }}
          >
            <option value="">默认模型</option>
            {config.model && (
              <option value={config.model}>{config.model}</option>
            )}
            {engineConfig.provider && engineConfig.model && engineConfig.model !== config.model && (
              <option value={engineConfig.model}>{engineConfig.model}</option>
            )}
          </select>

          {/* Persona selector */}
          <select
            value={engineConfig.persona || ''}
            onChange={e => updateEngineConfig({ persona: e.target.value })}
            className="ui-select"
            style={{ padding: '4px 10px', fontSize: '0.75rem', width: 'auto', cursor: 'pointer' }}
          >
            {PERSONA_OPTIONS.map(p => (
              <option key={p.id} value={p.id}>身份: {p.name}</option>
            ))}
          </select>

          {/* Temperature control */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '4px 8px', borderRadius: 'var(--r-sm)',
            border: '1px solid var(--c-border-soft)', fontSize: '0.75rem',
            color: 'var(--c-text-soft)',
          }}>
            <span>🌡️</span>
            {TEMP_PRESETS.map(t => (
              <button
                key={t.value}
                onClick={() => updateEngineConfig({ temperature: t.value })}
                disabled={isStreaming}
                style={{
                  padding: '1px 6px', borderRadius: '4px', fontSize: '0.6875rem',
                  border: 'none', cursor: 'pointer',
                  background: engineConfig.temperature === t.value ? 'var(--c-accent-soft)' : 'transparent',
                  color: engineConfig.temperature === t.value ? 'var(--c-accent)' : 'var(--c-text-soft)',
                  fontWeight: engineConfig.temperature === t.value ? 600 : 400,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Thinking level */}
          {hasCapability('thinking') && (
            <select
              value={engineConfig.thinkingLevel || 'off'}
              onChange={e => updateEngineConfig({ thinkingLevel: e.target.value as any })}
              disabled={isStreaming}
              className="ui-select"
              style={{ padding: '4px 10px', fontSize: '0.75rem', width: 'auto', cursor: 'pointer' }}
              title="思考深度"
            >
              {THINKING_LEVELS.map(l => (
                <option key={l.id} value={l.id}>思考: {l.name}</option>
              ))}
            </select>
          )}

          {/* Speed toggle */}
          <button
            onClick={() => setTypingFast(!typingFast)}
            style={{
              padding: '4px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.75rem',
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              border: `1px solid ${typingFast ? 'var(--c-accent-dim)' : 'var(--c-border-soft)'}`,
              background: typingFast ? 'var(--c-accent-soft)' : 'transparent',
              color: typingFast ? 'var(--c-accent)' : 'var(--c-text-soft)',
              transition: 'all var(--dur-fast)', cursor: 'pointer',
            }}
            title="加速输出"
          >
            {useSVG ? <IconBolt size={14} /> : <span>⚡</span>}
            加速
          </button>

          {/* Template picker */}
          <div style={{ position: 'relative' }}>
            <button
              ref={templateBtnRef}
              onClick={() => setShowTemplatePicker(v => !v)} disabled={isStreaming}
              style={{
                padding: '4px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.75rem',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                border: `1px solid ${showTemplatePicker ? 'var(--c-accent-dim)' : 'var(--c-border-soft)'}`,
                background: showTemplatePicker ? 'var(--c-accent-soft)' : 'transparent',
                color: showTemplatePicker ? 'var(--c-accent)' : 'var(--c-text-soft)',
                transition: 'all var(--dur-fast)', cursor: 'pointer', opacity: isStreaming ? 0.5 : 1,
              }}
              title="插入提示词模板"
            >
              {useSVG ? <IconDocument size={14} /> : <span>📝</span>}
              模板
            </button>
            {showTemplatePicker && (
              <div
                className="frosted-panel"
                style={{
                  position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                  width: 280, maxHeight: 320, overflow: 'auto',
                  borderRadius: 'var(--r-lg)', border: '1px solid var(--c-border)',
                  padding: '8px', zIndex: 30,
                }}
              >
                {templates.length === 0 ? (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--c-text-soft)', padding: '12px' }}>
                    暂无模板
                  </div>
                ) : (
                  Array.from(new Set(templates.map(t => t.category))).sort().map(cat => (
                    <div key={cat} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--c-text-very-soft)', padding: '4px 8px' }}>{cat}</div>
                      {templates.filter(t => t.category === cat).map(t => (
                        <button key={t.id} onClick={() => insertTemplate(t)}
                          style={{
                            width: '100%', textAlign: 'left', padding: '6px 8px',
                            borderRadius: 'var(--r-sm)', fontSize: '0.8125rem',
                            color: 'var(--c-text)', background: 'transparent', border: 'none', cursor: 'pointer',
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-bg-session-item)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >{t.name}</button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Skills picker */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSkillsPicker(v => !v)} disabled={isStreaming}
              style={{
                padding: '4px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.75rem',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                border: `1px solid ${showSkillsPicker ? 'var(--c-accent-dim)' : 'var(--c-border-soft)'}`,
                background: showSkillsPicker ? 'var(--c-accent-soft)' : 'transparent',
                color: showSkillsPicker ? 'var(--c-accent)' : 'var(--c-text-soft)',
                transition: 'all var(--dur-fast)', cursor: 'pointer', opacity: isStreaming ? 0.5 : 1,
              }}
              title="插入技能"
            >
              {useSVG ? <IconSparkles size={14} /> : <span>🧰</span>}
              技能
            </button>
            {showSkillsPicker && (
              <div
                className="frosted-panel"
                style={{
                  position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                  width: 280, maxHeight: 320, overflow: 'auto',
                  borderRadius: 'var(--r-lg)', border: '1px solid var(--c-border)',
                  padding: '8px', zIndex: 30,
                }}
              >
                {skills.length === 0 ? (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--c-text-soft)', padding: '12px' }}>
                    暂无技能
                  </div>
                ) : (
                  skills.map(sk => (
                    <button key={sk.id} onClick={() => insertSkill(sk)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '6px 8px',
                        borderRadius: 'var(--r-sm)', fontSize: '0.8125rem',
                        color: 'var(--c-text)', background: 'transparent', border: 'none',
                        cursor: 'pointer', marginBottom: '4px',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-bg-session-item)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ fontWeight: 600 }}>{sk.name}</div>
                      {sk.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--c-text-soft)', marginTop: 2 }}>{sk.description}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Engine-specific panel toggle */}
          {(currentEngine.id === 'hermes' || currentEngine.id === 'codex' || currentEngine.id === 'reasonix') && (
            <button
              onClick={() => setShowEngineSpecific(v => !v)}
              style={{
                padding: '4px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.75rem',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                border: `1px solid ${showEngineSpecific ? 'var(--c-accent-dim)' : 'var(--c-border-soft)'}`,
                background: showEngineSpecific ? 'var(--c-accent-soft)' : 'transparent',
                color: showEngineSpecific ? 'var(--c-accent)' : 'var(--c-text-soft)',
                transition: 'all var(--dur-fast)', cursor: 'pointer',
              }}
              title="引擎专属设置"
            >
              {useSVG ? <IconTool size={14} /> : <span>⚙️</span>}
              引擎设置
            </button>
          )}
        </div>

        {/* Engine-specific panel */}
        {showEngineSpecific && (currentEngine.id === 'hermes' || currentEngine.id === 'codex' || currentEngine.id === 'reasonix') && (
          <div className="max-w-3xl mx-auto mb-2">
            <EngineSpecificPanel
              engine={currentEngine}
              engineConfig={engineConfig}
              onConfigChange={updateEngineConfig}
              onClose={() => setShowEngineSpecific(false)}
            />
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-2 max-w-3xl mx-auto">
          <input
            type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`向 ${currentEngine.name} 提问...`}
            className="input-glow"
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 'var(--r-md)',
              border: '1px solid var(--c-border-soft)', background: 'var(--c-surface-1)',
              fontSize: '0.875rem', outline: 'none', color: 'var(--c-text)',
            }}
            disabled={isStreaming}
          />
          <button
            onClick={isStreaming ? handleStop : () => handleSend()}
            disabled={!input.trim() && !isStreaming}
            style={{
              padding: '10px 24px', borderRadius: 'var(--r-md)', fontSize: '0.875rem',
              fontWeight: 500, border: 'none', cursor: 'pointer', color: '#fff',
              background: isStreaming ? 'var(--c-danger)' : 'var(--c-accent)',
              opacity: (!input.trim() && !isStreaming) ? 0.4 : 1,
              transition: 'opacity var(--dur-fast)',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
          >
            {isStreaming ? (
              <>
                {useSVG ? <IconX size={16} /> : <span>⏹</span>}
                停止
              </>
            ) : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}