import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ChatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const provider = searchParams.get('provider') || 'pi';
  const engineName = provider === 'ollama' ? 'Ollama · 本地模型' : 'PI · 编码智能体';
  
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{role: string; content: string}>>([
    { role: 'assistant', content: '💬 你好！我是 AI 助手，有什么可以帮你？' }
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  const [isAborted, setIsAborted] = useState(false);
  
  // 获取当前配置
  const getChatConfig = () => {
    if (provider === 'ollama') {
      return {
        baseUrl: 'http://localhost:11434',
        model: 'qwen3.5:9b',
        provider: 'ollama',
      };
    }
    return {
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      provider: 'deepseek',
    };
  };
  
  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    
    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsStreaming(true);
    setShowThinking(true);
    setIsAborted(false);
    
    const config = getChatConfig();
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage,
          context: {
            baseUrl: config.baseUrl,
            model: config.model,
            provider: config.provider,
          },
        }),
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
                assistantContent += data.content;
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
              } else if (data.type === 'done') {
                setShowThinking(false);
              } else if (data.type === 'error') {
                setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${data.message}` }]);
                setIsAborted(true);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ 出了点小问题，请再试一次' }]);
    } finally {
      setIsStreaming(false);
      setShowThinking(false);
    }
  };
  
  const handleStop = () => {
    setIsAborted(true);
    setIsStreaming(false);
    setShowThinking(false);
  };
  
  return (
    <div className="flex flex-col h-screen">
      {/* 顶部导航 */}
      <header className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-green-600 dark:text-green-400 font-semibold">🍃 GreenHorn</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{engineName}</span>
        </div>
        <button onClick={() => navigate('/settings')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl" title="设置">
          ⚙️
        </button>
      </header>
      
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-green-500 text-white rounded-br-md'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-bl-md'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {showThinking && (
          <div className="flex justify-start">
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-gray-400">
                <span>🧠</span>
                <span>思考中</span>
                <span className="animate-pulse">...</span>
              </div>
            </div>
          </div>
        )}
        {isAborted && (
          <div className="flex justify-start">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400">
              ⏹ 已停止
            </div>
          </div>
        )}
      </div>
      
      {/* 输入区域 */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入你的问题..."
            className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400"
            disabled={isStreaming}
          />
          <button
            onClick={isStreaming ? handleStop : handleSend}
            disabled={!input.trim() && !isStreaming}
            className={`px-6 py-2 rounded-xl transition-colors ${
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