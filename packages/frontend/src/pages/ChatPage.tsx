import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PI_SAMPLE_QUESTIONS = [
  '帮我写一个 Python 函数，计算斐波那契数列',
  '解释一下 React 的 useEffect 怎么用',
  '这段代码有什么问题？帮我调试一下',
  '用 SQL 实现一个简单的用户表增删改查',
];

const OLLAMA_SAMPLE_QUESTIONS = [
  '用中文介绍一下自己',
  '讲一个有趣的历史故事',
  '给我推荐 5 本好书',
  '解释一下相对论',
];

const SAMPLE_QUESTIONS: Record<string, string[]> = {
  pi: PI_SAMPLE_QUESTIONS,
  ollama: OLLAMA_SAMPLE_QUESTIONS,
};

const EMPTY_STATE: Record<string, { icon: string; title: string; subtitle: string }> = {
  pi: { icon: '🧑‍💻', title: '开始编码吧！', subtitle: 'PI 智能体已就绪，输入你的编码需求' },
  ollama: { icon: '🦙', title: '开始对话吧！', subtitle: 'Ollama 本地模型已就绪，开始聊天' },
};

interface Config {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
}

export default function ChatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const provider = searchParams.get('provider') || 'pi';
  const PROVIDER_NAMES: Record<string, string> = {
    pi: 'PI · 编码智能体',
    ollama: 'Ollama · 本地模型',
    deepseek: 'DeepSeek',
    tongyi: '通义千问',
    zhipu: '智谱 GLM',
    doubao: '豆包',
    moonshot: 'Kimi',
    openai: 'OpenAI',
  };
  const engineName = PROVIDER_NAMES[provider] || provider;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{role: string; content: string}>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState('');
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [typingFast, setTypingFast] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [config, setConfig] = useState<Config>({
    provider: 'deepseek',
    model: 'deepseek-chat',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
  });

  const isFirstVisit = messages.length === 0;
  const emptyState = EMPTY_STATE[provider] || { icon: '🍃', title: '开始对话吧！', subtitle: '输入你的问题开始' };
  const sampleQuestions = SAMPLE_QUESTIONS[provider] || PI_SAMPLE_QUESTIONS;
  
  // 加载当前配置，加载完前禁用输入
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then((data: Config) => {
        setConfig(data);
        setConfigLoaded(true);
      })
      .catch(() => {
        setConfigLoaded(true); // 加载失败也放行，允许用户使用默认配置
      });
  }, []);
  
  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingContent, showThinking]);
  
  // 获取对话配置
  const getChatConfig = () => {
    if (provider === 'ollama') {
      return {
        baseUrl: 'http://localhost:11434',
        model: 'qwen3.5:9b',
        provider: 'ollama',
        apiKey: '',
      };
    }
    return {
      baseUrl: config.baseUrl,
      model: config.model,
      provider: config.provider,
      apiKey: config.apiKey,
    };
  };
  
  const handleSend = async (text?: string) => {
    const userMessage = (text || input).trim();
    if (!userMessage || isStreaming || !configLoaded) return;
    
    // 创建新的 AbortController
    const controller = new AbortController();
    abortRef.current = controller;
    
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsStreaming(true);
    setShowThinking(true);
    setThinkingContent('');
    setThinkingExpanded(true);
    
    const chatConfig = getChatConfig();
    
    // 构建历史消息
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage,
          messages: history,
          context: {
            baseUrl: chatConfig.baseUrl,
            model: chatConfig.model,
            provider: chatConfig.provider,
            apiKey: chatConfig.apiKey,
          },
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
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // 用户主动停止，不显示错误
        return;
      }
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ 出了点小问题，请再试一次' }]);
    } finally {
      setIsStreaming(false);
      setShowThinking(false);
      setThinkingContent('');
      setThinkingExpanded(false);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <div className="flex flex-col h-screen">
      {/* 顶部导航 */}
      <header className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-green-600 dark:text-green-400 font-semibold">🍃 GreenHorn</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{engineName}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTypingFast(!typingFast)}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              typingFast
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
            title={typingFast ? '加速输出：开' : '加速输出：关'}
          >
            {typingFast ? '⚡ 加速' : '⚡'}
          </button>
          <button onClick={() => navigate('/settings')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl" title="设置">
            ⚙️
          </button>
        </div>
      </header>
      
      {/* 消息区域 */}
      <div className={`flex-1 overflow-y-auto px-4 py-6 ${typingFast ? 'typing-fast' : ''}`}>
        <div className="max-w-3xl mx-auto space-y-4">
          {/* 空状态 - 首次访问 */}
          {isFirstVisit && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">{emptyState.icon}</div>
              <h2 className="text-2xl font-bold mb-2">{emptyState.title}</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8">
                {emptyState.subtitle}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {sampleQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    disabled={isStreaming}
                    className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-left text-sm hover:border-green-300 dark:hover:border-green-700 hover:shadow-sm transition-all disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* 消息列表 */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-green-500 text-white rounded-br-md'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-bl-md'
              }`}>
                <p className={`whitespace-pre-wrap ${
                  i === messages.length - 1 && isStreaming && msg.role === 'assistant' ? 'typing-cursor' : ''
                }`}>
                  {msg.content}
                </p>
              </div>
            </div>
          ))}
          
          {/* 思考过程 - 可折叠卡片 */}
          {showThinking && thinkingContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md overflow-hidden">
                <button
                  onClick={() => setThinkingExpanded(!thinkingExpanded)}
                  className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span>🧠</span>
                    <span>思考过程</span>
                    <span className="animate-pulse text-xs">● 进行中</span>
                  </div>
                  <span>{thinkingExpanded ? '▲ 收起' : '▼ 展开'}</span>
                </button>
                {thinkingExpanded && (
                  <div className="px-4 pb-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                      {thinkingContent}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 思考中无内容时的占位 */}
          {showThinking && !thinkingContent && (
            <div className="flex justify-start">
              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2 text-gray-400">
                  <span>🧠</span>
                  <span>思考中</span>
                  <span className="animate-pulse">...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* 输入区域 */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800 flex-shrink-0">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={configLoaded ? "输入你的问题..." : "正在加载配置..."}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
            disabled={isStreaming || !configLoaded}
          />
          <button
            onClick={isStreaming ? handleStop : () => handleSend()}
            disabled={!input.trim() && !isStreaming}
            className={`px-6 py-2.5 rounded-xl transition-colors ${
              isStreaming
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white'
            }`}
          >
            {isStreaming ? '⏹ 停止' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}