import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

// 供应商 → 模型映射
const PROVIDER_MODELS: Record<string, Array<{ id: string; name: string }>> = {
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek V3' },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1' },
  ],
  ollama: [
    { id: 'qwen3.5:9b', name: 'Qwen3.5 (9B)' },
    { id: 'qwen3.5:32b', name: 'Qwen3.5 (32B)' },
    { id: 'llama3.1:8b', name: 'Llama 3.1 (8B)' },
  ],
  tongyi: [
    { id: 'qwen-max', name: 'Qwen Max' },
    { id: 'qwen-plus', name: 'Qwen Plus' },
    { id: 'qwen-turbo', name: 'Qwen Turbo' },
  ],
  zhipu: [
    { id: 'glm-4-plus', name: 'GLM-4 Plus' },
    { id: 'glm-4-air', name: 'GLM-4-Air' },
  ],
  doubao: [
    { id: 'doubao-1.5-pro-256k', name: '豆包 Pro (256K)' },
    { id: 'doubao-1.5-lite-32k', name: '豆包 Lite (32K)' },
  ],
  moonshot: [
    { id: 'moonshot-v1-8k', name: 'Moonshot v1 (8K)' },
    { id: 'moonshot-v1-32k', name: 'Moonshot v1 (32K)' },
    { id: 'moonshot-v1-128k', name: 'Moonshot v1 (128K)' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'o1-mini', name: 'o1-mini' },
  ],
};

// 供应商 → 默认 baseUrl（包含 API 版本路径，chat-engine 会在后面加 /chat/completions）
const PROVIDER_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1',
  ollama: 'http://localhost:11434/v1',
  tongyi: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  moonshot: 'https://api.moonshot.cn/v1',
  openai: 'https://api.openai.com/v1',
};

// 供应商 → 注册/获取 Key 的链接
const PROVIDER_REGISTER_URLS: Record<string, string> = {
  deepseek: 'https://platform.deepseek.com/api_keys',
  tongyi: 'https://help.aliyun.com/zh/model-studio/getting-started/first-api-call-to-qwen',
  zhipu: 'https://open.bigmodel.cn/usercenter/apikeys',
  doubao: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
  moonshot: 'https://platform.moonshot.cn/console/api-keys',
  openai: 'https://platform.openai.com/api-keys',
  // Ollama 无需注册，没有链接
};

const PERSONA_TEMPLATES = [
  { id: 'general', name: '通用助手', desc: '友好、简洁、全面' },
  { id: 'coder', name: '代码专家', desc: '专注代码、调试、最佳实践' },
  { id: 'translator', name: '翻译助手', desc: '专业翻译、多语言互译' },
  { id: 'teacher', name: '教师模式', desc: '循循善诱、详细解释' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('deepseek');
  const [model, setModel] = useState('deepseek-chat');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [showHelp, setShowHelp] = useState(true);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'verifying' | 'success' | 'fail'>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [persona, setPersona] = useState('');
  const [hideThinkingBlock, setHideThinkingBlock] = useState(false);
  
  // 加载当前配置
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setProvider(data.provider || 'deepseek');
        setModel(data.model || 'deepseek-chat');
        setApiKey(data.apiKey || '');
        setTheme(data.theme || 'light');
        setShowHelp(data.showHelp !== false);
      })
      .catch(() => {});
  }, []);

  // 加载 settings.json
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setPersona(data.persona || '');
        setHideThinkingBlock(data.hideThinkingBlock || false);
      })
      .catch(() => {});
  }, []);
  
  // 供应商切换时自动切换模型和 URL
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const models = PROVIDER_MODELS[newProvider];
    if (models && models.length > 0) {
      setModel(models[0].id);
    }
    // Ollama 不需要 API Key
    if (newProvider === 'ollama') {
      setApiKey('sk-ollama-local');
    }
  };
  
  // 当前供应商的模型列表
  const currentModels = PROVIDER_MODELS[provider] || PROVIDER_MODELS.deepseek;
  const currentBaseUrl = PROVIDER_URLS[provider] || PROVIDER_URLS.deepseek;
  
  const handleVerify = async () => {
    if (!apiKey) return;
    setVerifyStatus('verifying');
    try {
      const res = await fetch('/api/config/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, baseUrl: currentBaseUrl, modelId: model }),
      });
      const data = await res.json();
      setVerifyStatus(data.success ? 'success' : 'fail');
      setTimeout(() => setVerifyStatus('idle'), 3000);
    } catch {
      setVerifyStatus('fail');
      setTimeout(() => setVerifyStatus('idle'), 3000);
    }
  };
  
  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const [configRes, settingsRes] = await Promise.all([
        fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            model,
            apiKey: provider === 'ollama' ? '' : apiKey,
            baseUrl: currentBaseUrl,
            theme,
            showHelp,
          }),
        }),
        fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            persona,
            hideThinkingBlock,
          }),
        }),
      ]);
      
      const configData = await configRes.json();
      const settingsData = await settingsRes.json();
      
      if (configData.success && settingsData.success) {
        setSaveStatus('success');
      } else {
        setSaveStatus('error');
      }
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          ← 返回
        </button>
        <h1 className="text-xl font-semibold">设置</h1>
      </div>
      
      {/* ⚙️ 模型设置 */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
        <h2 className="font-semibold mb-4">⚙️ 模型</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
              模型提供商
              {showHelp && (
                <span className="ml-1 text-gray-300 cursor-help group relative" title="选择 AI 模型供应商，不同供应商的模型能力不同">
                  (?)
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                    选择 AI 模型供应商，不同供应商的模型能力不同
                  </span>
                </span>
              )}
            </label>
            <select
              value={provider}
              onChange={e => handleProviderChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="ollama">Ollama（本机运行）</option>
              <option value="tongyi">通义千问（阿里云）</option>
              <option value="zhipu">智谱 AI</option>
              <option value="doubao">豆包（火山引擎）</option>
              <option value="moonshot">月之暗面 Kimi</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
              模型
              {showHelp && (
                <span className="ml-1 text-gray-300 cursor-help group relative" title="不同模型能力有差异，推荐选标有 ⭐ 的模型">
                  (?)
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                    不同模型能力有差异，推荐选标有 ⭐ 的模型
                  </span>
                </span>
              )}
            </label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {currentModels.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
              API Key
              {showHelp && (
                <span className="ml-1 text-gray-300 cursor-help group relative" title="API Key 就像密码，用来验证你的身份。从供应商官网获取后粘贴到这里">
                  (?)
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                    API Key 就像密码，用来验证你的身份。从供应商官网获取后粘贴到这里
                  </span>
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={provider === 'ollama' ? 'Ollama 无需 API Key' : '粘贴你的 API Key 到这里'}
                disabled={provider === 'ollama'}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              />
              <button
                onClick={handleVerify}
                disabled={!apiKey || verifyStatus === 'verifying' || provider === 'ollama'}
                className="px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm transition-colors"
              >
                {verifyStatus === 'verifying' ? '验证中...' : '验证连接'}
              </button>
            </div>
            {verifyStatus === 'success' && (
              <p className="mt-1 text-sm text-green-600">✅ 连接正常！</p>
            )}
            {verifyStatus === 'fail' && (
              <p className="mt-1 text-sm text-red-500">❌ Key 好像不对哦，检查有没有复制完整？</p>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
              API 地址
              {showHelp && (
                <span className="ml-1 text-gray-300 cursor-help group relative" title="API 服务器地址，选择供应商后自动填入，一般不需要手动修改">
                  (?)
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                    API 服务器地址，选择供应商后自动填入，一般不需要手动修改
                  </span>
                </span>
              )}
            </label>
            <input
              type="text"
              value={currentBaseUrl}
              readOnly
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">根据选中的供应商自动填入</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">
              {provider === 'ollama' ? (
                'Ollama 本机运行，无需 API Key'
              ) : (
                <>
                  还没有 Key？
                  <a href={PROVIDER_REGISTER_URLS[provider] || PROVIDER_REGISTER_URLS.deepseek} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline ml-1">
                    去官网获取
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
      </section>
      
      {/* 🎨 外观 */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
        <h2 className="font-semibold mb-4">🎨 外观</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">主题</span>
            <div className="flex gap-2">
              {(['浅色', '深色', '跟随系统'] as const).map(t => {
                const value = t === '浅色' ? 'light' : t === '深色' ? 'dark' : 'system';
                return (
                  <button
                    key={t}
                    onClick={() => setTheme(value)}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                      theme === value ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">显示帮助说明</span>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                showHelp ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${
                showHelp ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      </section>
      
      {/* 🤖 智能体设定 */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
        <h2 className="font-semibold mb-4">🤖 智能体设定</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">
              角色描述
              {showHelp && (
                <span className="ml-1 text-gray-300 cursor-help group relative" title="告诉 AI 应该扮演什么角色，影响所有回答的风格">
                  (?)
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                    告诉 AI 应该扮演什么角色，影响所有回答的风格
                  </span>
                </span>
              )}
            </label>
            <textarea
              value={persona}
              onChange={e => setPersona(e.target.value)}
              placeholder="你是一个 Python 专家，擅长后端开发和 API 设计"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">预设模板（点击选择）</p>
            <div className="flex flex-wrap gap-2">
              {PERSONA_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setPersona(`${t.name}，${t.desc}`)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    persona === `${t.name}，${t.desc}`
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-green-300'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 🧠 思考过程 */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
        <h2 className="font-semibold mb-4">🧠 思考过程</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm">显示 AI 的"内心想法"</span>
              <p className="text-xs text-gray-400 mt-0.5">关闭后不再显示思考过程卡片，对话更简洁</p>
            </div>
            <button
              onClick={() => setHideThinkingBlock(!hideThinkingBlock)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                hideThinkingBlock ? 'bg-gray-300 dark:bg-gray-600' : 'bg-green-500'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${
                hideThinkingBlock ? 'translate-x-0.5' : 'translate-x-6'
              }`} />
            </button>
          </div>
        </div>
      </section>
      
      {/* 保存按钮（带反馈） */}
      <button
        onClick={handleSave}
        disabled={saveStatus === 'saving'}
        className={`w-full px-4 py-2 rounded-xl transition-colors text-white ${
          saveStatus === 'success'
            ? 'bg-green-500'
            : saveStatus === 'error'
            ? 'bg-red-500'
            : 'bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600'
        }`}
      >
        {saveStatus === 'saving' ? '⏳ 保存中...' :
         saveStatus === 'success' ? '✅ 已保存！' :
         saveStatus === 'error' ? '❌ 保存失败，再试一次' :
         '保存设置'}
      </button>
      
      {/* 高级设置入口 */}
      <div className="mt-6">
        <button
          onClick={() => navigate('/settings/advanced')}
          className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors flex items-center justify-center gap-2"
        >
          <span>🔧</span>
          <span>高级设置</span>
        </button>
      </div>
      
      {/* 关于 */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-4 mt-4">
        <h2 className="font-semibold mb-4">📦 关于</h2>
        <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex justify-between">
            <span>GreenHorn 版本</span>
            <span>v0.1.0</span>
          </div>
          <div className="flex justify-between">
            <span>底层引擎</span>
            <span>PI (v0.50.2)</span>
          </div>
          <div className="mt-2">
            <a href="https://github.com/MARSMA-101/GreenHorn" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline text-xs">
              查看更新日志 →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}