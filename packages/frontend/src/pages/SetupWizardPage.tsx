import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', desc: '国产最强', badge: '推荐首选', url: 'https://api.deepseek.com/v1', registerUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'tongyi', name: '通义千问', desc: '阿里云', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', registerUrl: 'https://help.aliyun.com/zh/model-studio/getting-started/first-api-call-to-qwen' },
  { id: 'zhipu', name: '智谱 GLM', desc: '清华系', url: 'https://open.bigmodel.cn/api/paas/v4', registerUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },
  { id: 'doubao', name: '豆包', desc: '火山引擎', url: 'https://ark.cn-beijing.volces.com/api/v3', registerUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey' },
  { id: 'moonshot', name: 'Kimi', desc: '长上下文', url: 'https://api.moonshot.cn/v1', registerUrl: 'https://platform.moonshot.cn/console/api-keys' },
  { id: 'openai', name: 'OpenAI', desc: '国际主流', url: 'https://api.openai.com/v1', registerUrl: 'https://platform.openai.com/api-keys' },
  { id: 'ollama', name: 'Ollama', desc: '本机免费，零 Key 备选', logo: '🦙', url: 'http://localhost:11434/v1', registerUrl: '' },
];

const PROVIDER_MODELS: Record<string, Array<{ id: string; name: string; desc: string; recommended?: boolean }>> = {
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek V3', desc: '综合能力强', recommended: true },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1', desc: '推理强' },
  ],
  tongyi: [
    { id: 'qwen-max', name: 'Qwen Max', desc: '最强的通义千问', recommended: true },
    { id: 'qwen-plus', name: 'Qwen Plus', desc: '性价比之选' },
    { id: 'qwen-turbo', name: 'Qwen Turbo', desc: '快速响应' },
  ],
  zhipu: [
    { id: 'glm-4-plus', name: 'GLM-4 Plus', desc: '最新最强', recommended: true },
    { id: 'glm-4-air', name: 'GLM-4-Air', desc: '轻量高效' },
  ],
  doubao: [
    { id: 'doubao-1.5-pro-256k', name: '豆包 Pro (256K)', desc: '超长上下文', recommended: true },
    { id: 'doubao-1.5-lite-32k', name: '豆包 Lite (32K)', desc: '轻量版' },
  ],
  moonshot: [
    { id: 'moonshot-v1-8k', name: 'Moonshot v1 (8K)', desc: '标准版', recommended: true },
    { id: 'moonshot-v1-32k', name: 'Moonshot v1 (32K)', desc: '更长上下文' },
    { id: 'moonshot-v1-128k', name: 'Moonshot v1 (128K)', desc: '超长上下文' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', desc: '最新多模态', recommended: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: '轻量实惠' },
    { id: 'o1-mini', name: 'o1-mini', desc: '推理优化' },
  ],
  ollama: [
    { id: 'qwen3.5:9b', name: 'Qwen3.5 (9B)', desc: '国产开源', recommended: true },
    { id: 'llama3.1:8b', name: 'Llama 3.1 (8B)', desc: 'Meta 开源' },
  ],
};

type SetupStep = 'welcome' | 'install' | 'model' | 'done';

export default function SetupWizardPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<SetupStep>('welcome');
  const [installProgress, setInstallProgress] = useState(0);
  const [installMessage, setInstallMessage] = useState('');
  const [installDone, setInstallDone] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [skipSetup, setSkipSetup] = useState(false);

  // 检查环境
  useEffect(() => {
    fetch('/api/setup/check-env')
      .then(res => res.json())
      .then(data => {
        if (data.ready) {
          setSkipSetup(true);
        }
      })
      .catch(() => {});
  }, []);

  if (skipSetup) {
    return null; // 由 App.tsx 处理跳转
  }

  // 开始安装
  const startInstall = () => {
    setCurrentStep('install');
    setInstallProgress(0);
    
    // 改用 POST
    fetch('/api/setup/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine: 'pi' }),
    }).then(async (response) => {
      const reader = response.body?.getReader();
      if (!reader) return;
      
      const decoder = new TextDecoder();
      let buffer = '';
      
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
              setInstallProgress(data.progress);
              setInstallMessage(data.message);
              if (data.done) {
                setInstallDone(true);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }).catch(() => {
      setInstallMessage('出了点小问题，点下一步继续');
      setInstallDone(true);
    });
  };

  // 验证连接
  const verifyConnection = async () => {
    if (!selectedProvider || !apiKey) {
      setVerifyStatus('error');
      setVerifyMessage('请输入 API Key');
      return;
    }
    
    setVerifyStatus('verifying');
    setVerifyMessage('');
    
    try {
      const res = await fetch('/api/config/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider, apiKey, baseUrl: apiUrl }),
      });
      const data = await res.json();
      
      if (data.success) {
        setVerifyStatus('success');
        setVerifyMessage('连接成功！');
      } else {
        setVerifyStatus('error');
        setVerifyMessage(data.message || 'Key 好像不对哦，检查有没有复制完整');
      }
    } catch {
      setVerifyStatus('error');
      setVerifyMessage('网络连接失败，检查网络后重试');
    }
  };

  // 完成设置
  const finishSetup = () => {
    navigate('/chat');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* 步骤指示器 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['welcome', 'install', 'model', 'done'] as SetupStep[]).map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === step
                  ? 'bg-green-500 text-white'
                  : ['install', 'model', 'done'].indexOf(step) < ['welcome', 'install', 'model', 'done'].indexOf(currentStep)
                  ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
                  : 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
              }`}>
                {['install', 'model', 'done'].indexOf(step) < ['welcome', 'install', 'model', 'done'].indexOf(currentStep) ? '✓' : i + 1}
              </div>
              {i < 3 && <div className="w-8 h-0.5 bg-gray-200 dark:bg-gray-700" />}
            </div>
          ))}
        </div>
        
        {/* 步骤 1：欢迎 + 选引擎 */}
        {currentStep === 'welcome' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm">
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">🍃</div>
              <h1 className="text-2xl font-bold mb-2">欢迎来到 GreenHorn！</h1>
              <p className="text-gray-500 dark:text-gray-400">
                选一个智能体，3 步就能开始使用
              </p>
            </div>
            
            <div
              className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800 cursor-pointer hover:shadow-md transition-shadow"
              onClick={startInstall}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">📦 PI · 编码智能体</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    帮你写代码、读代码、改代码
                  </p>
                </div>
                <span className="px-3 py-1 bg-green-500 text-white text-xs rounded-full">推荐</span>
              </div>
              <div className="mt-4">
                <span className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg inline-block transition-colors">
                  开始使用 →
                </span>
              </div>
            </div>
            
            <div className="mt-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700 opacity-60">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">🔧 更多引擎 · 开发中...</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    敬请期待更多开源智能体接入
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <button
                onClick={() => window.open('https://github.com/marsma-101/Greenhorn', '_blank')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm underline"
              >
                怎么用？
              </button>
            </div>
          </div>
        )}
        
        {/* 步骤 2：安装进度 */}
        {currentStep === 'install' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm">
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">📦</div>
              <h2 className="text-xl font-semibold mb-2">安装 PI · 编码智能体</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {installMessage || '正在准备...'}
              </p>
            </div>
            
            {/* 大进度条 */}
            <div className="mb-8">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${installProgress}%` }}
                />
              </div>
              <div className="text-right text-sm text-gray-500 mt-1">
                {installProgress}%
              </div>
            </div>
            
            {/* 安装详情 */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={installProgress >= 20 ? 'text-green-500' : 'text-gray-300'}>
                  {installProgress >= 20 ? '✅' : '⬜'}
                </span>
                <span className={installProgress >= 20 ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400'}>
                  配置目录
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={installProgress >= 50 ? 'text-green-500' : 'text-gray-300'}>
                  {installProgress >= 50 ? '✅' : '⬜'}
                </span>
                <span className={installProgress >= 50 ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400'}>
                  引擎准备
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={installProgress >= 80 ? 'text-green-500' : 'text-gray-300'}>
                  {installProgress >= 80 ? '✅' : '⬜'}
                </span>
                <span className={installProgress >= 80 ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400'}>
                  初始化配置
                </span>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <button
                onClick={() => setCurrentStep('model')}
                disabled={!installDone}
                className={`px-6 py-2 rounded-xl transition-colors ${
                  installDone
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {installDone ? '配置模型 →' : '安装中...'}
              </button>
            </div>
          </div>
        )}
        
        {/* 步骤 3：模型配置 */}
        {currentStep === 'model' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm">
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">🔗</div>
              <h2 className="text-xl font-semibold mb-2">连接 AI 模型</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                选择模型供应商，填入 API Key 就能开始对话
              </p>
            </div>
            
            {/* 供应商选择 */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">选择供应商</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProvider(p.id);
                      setSelectedModel(null);
                      setApiUrl(p.url);
                      setVerifyStatus('idle');
                      setVerifyMessage('');
                    }}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      selectedProvider === p.id
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{p.desc}</div>
                    {p.badge && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-[10px] rounded">
                        {p.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* 模型选择 */}
            {selectedProvider && PROVIDER_MODELS[selectedProvider] && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">选择模型</h3>
                <div className="space-y-2">
                  {PROVIDER_MODELS[selectedProvider].map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(m.id);
                        setVerifyStatus('idle');
                        setVerifyMessage('');
                      }}
                      className={`w-full p-3 rounded-xl text-left border transition-all flex items-center justify-between ${
                        selectedModel === m.id
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-sm">{m.name}</div>
                        <div className="text-xs text-gray-400">{m.desc}</div>
                      </div>
                      {m.recommended && (
                        <span className="text-xs text-green-600 dark:text-green-400">⭐ 推荐</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* API Key 输入 */}
            {selectedProvider && selectedModel && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">填写 API Key</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">API Key</label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKey}
                          onChange={e => {
                            setApiKey(e.target.value);
                            setVerifyStatus('idle');
                          }}
                          placeholder="粘贴你的 API Key..."
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <button
                          onClick={() => navigator.clipboard.writeText(apiKey)}
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                          title="复制"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">API 地址</label>
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-500">
                        <span className="flex-1">{apiUrl}</span>
                        <span className="text-green-500 text-xs">✅ 已预填</span>
                      </div>
                    </div>
                    
                    {/* 注册链接 */}
                    {(() => {
                      const provider = PROVIDERS.find(p => p.id === selectedProvider);
                      return provider?.registerUrl ? (
                        <div className="text-sm">
                          <span className="text-gray-400">还没有 Key？</span>
                          <button
                            onClick={() => window.open(provider.registerUrl, '_blank')}
                            className="ml-1 text-green-600 hover:text-green-700 underline"
                          >
                            去 {provider.name} 官网获取 API Key
                          </button>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
                
                {/* 验证连接 */}
                <div className="text-center">
                  <button
                    onClick={verifyConnection}
                    disabled={verifyStatus === 'verifying'}
                    className={`px-6 py-2 rounded-xl transition-colors ${
                      verifyStatus === 'success'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    {verifyStatus === 'verifying'
                      ? '验证中...'
                      : verifyStatus === 'success'
                      ? '✅ 连接正常'
                      : '验证连接'}
                  </button>
                  {verifyStatus === 'error' && (
                    <p className="mt-2 text-sm text-red-500">{verifyMessage}</p>
                  )}
                  {verifyStatus === 'success' && (
                    <p className="mt-2 text-sm text-green-600">{verifyMessage}</p>
                  )}
                </div>
              </div>
            )}
            
            {/* 底部按钮 */}
            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep('install')}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                ← 返回
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep('done')}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  先跳过，后面再说
                </button>
                <button
                  onClick={() => {
                    // 保存配置
                    if (selectedProvider && apiKey) {
                      fetch('/api/config', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          provider: selectedProvider,
                          model: selectedModel,
                          apiKey,
                          baseUrl: apiUrl,
                        }),
                      }).catch(() => {});
                    }
                    setCurrentStep('done');
                  }}
                  className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors"
                >
                  完成配置
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* 步骤 4：完成 */}
        {currentStep === 'done' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2">准备好了！</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              所有配置已完成，开始你的第一段对话吧
            </p>
            <button
              onClick={finishSetup}
              className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-lg transition-colors"
            >
              开始对话 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}