import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useDebouncedCallback } from '../../utils/debounce';

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
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
};

const PROVIDER_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1',
  ollama: 'http://localhost:11434/v1',
  tongyi: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  moonshot: 'https://api.moonshot.cn/v1',
  openai: 'https://api.openai.com/v1',
};

const PROVIDER_REGISTER_URLS: Record<string, string> = {
  deepseek: 'https://platform.deepseek.com/api_keys',
  tongyi: 'https://help.aliyun.com/zh/model-studio/getting-started/first-api-call-to-qwen',
  zhipu: 'https://open.bigmodel.cn/usercenter/apikeys',
  doubao: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
  moonshot: 'https://platform.moonshot.cn/console/api-keys',
  openai: 'https://platform.openai.com/api-keys',
};

export default function ModelTab() {
  const { config, configLoaded, refreshConfig } = useApp();
  const [provider, setProvider] = useState(config.provider);
  const [model, setModel] = useState(config.model);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'verifying' | 'success' | 'fail'>('idle');

  useEffect(() => {
    if (configLoaded) {
      setProvider(config.provider);
      setModel(config.model);
      setApiKey(config.apiKey);
    }
  }, [configLoaded, config.provider, config.model, config.apiKey]);

  const currentModels = PROVIDER_MODELS[provider] || PROVIDER_MODELS.deepseek;
  const currentBaseUrl = PROVIDER_URLS[provider] || PROVIDER_URLS.deepseek;

  const performSave = async (p: string, m: string, k: string) => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: p, model: m,
          apiKey: p === 'ollama' ? '' : k,
          baseUrl: PROVIDER_URLS[p] || PROVIDER_URLS.deepseek,
        }),
      });
      const data = await res.json();
      setSaveStatus(data.success ? 'success' : 'error');
      if (data.success) refreshConfig();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const debouncedSaveKey = useDebouncedCallback((p: string, m: string, k: string) => {
    performSave(p, m, k);
  }, 800);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const models = PROVIDER_MODELS[newProvider];
    const newModel = models && models.length > 0 ? models[0].id : model;
    setModel(newModel);
    const newKey = newProvider === 'ollama' ? 'sk-ollama-local' : apiKey;
    setApiKey(newKey);
    performSave(newProvider, newModel, newKey);
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    performSave(provider, newModel, apiKey);
  };

  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    if (provider !== 'ollama') {
      debouncedSaveKey(provider, model, newKey);
    }
  };

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

  return (
    <div className="p-4 space-y-4">
      {saveStatus !== 'idle' && (
        <div style={{
          fontSize: '0.75rem',
          color: saveStatus === 'saving' ? 'var(--c-text-soft)' : saveStatus === 'error' ? 'var(--c-danger)' : 'var(--c-accent)',
          textAlign: 'right',
        }}>
          {saveStatus === 'saving' ? '保存中...' : saveStatus === 'error' ? '保存失败' : '✓ 已自动保存'}
        </div>
      )}

      {/* Provider */}
      <div>
        <label className="block text-xs text-[oklch(50%_0.02_145)] dark:text-[oklch(65%_0.02_145)] mb-1.5">模型提供商</label>
        <select
          value={provider}
          onChange={e => handleProviderChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[oklch(85%_0.01_145)] dark:border-[oklch(30%_0.01_145)] bg-[oklch(95%_0.005_145)] dark:bg-[oklch(20%_0.005_145)] text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(70%_0.1_145)]"
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

      {/* Model */}
      <div>
        <label className="block text-xs text-[oklch(50%_0.02_145)] dark:text-[oklch(65%_0.02_145)] mb-1.5">模型</label>
        <select
          value={model}
          onChange={e => handleModelChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[oklch(85%_0.01_145)] dark:border-[oklch(30%_0.01_145)] bg-[oklch(95%_0.005_145)] dark:bg-[oklch(20%_0.005_145)] text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(70%_0.1_145)]"
        >
          {currentModels.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* API Key */}
      <div>
        <label className="block text-xs text-[oklch(50%_0.02_145)] dark:text-[oklch(65%_0.02_145)] mb-1.5">API Key</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={e => handleApiKeyChange(e.target.value)}
            placeholder={provider === 'ollama' ? 'Ollama 无需 API Key' : '粘贴你的 API Key'}
            disabled={provider === 'ollama'}
            className="flex-1 px-3 py-2 rounded-lg border border-[oklch(85%_0.01_145)] dark:border-[oklch(30%_0.01_145)] bg-[oklch(95%_0.005_145)] dark:bg-[oklch(20%_0.005_145)] text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(70%_0.1_145)] disabled:opacity-50"
          />
          <button
            onClick={handleVerify}
            disabled={!apiKey || verifyStatus === 'verifying' || provider === 'ollama'}
            className="px-3 py-2 bg-[oklch(62%_0.15_145)] hover:opacity-90 disabled:opacity-40 text-white rounded-lg text-xs whitespace-nowrap transition-opacity"
          >
            {verifyStatus === 'verifying' ? '...' : '验证'}
          </button>
        </div>
        {verifyStatus === 'success' && <p className="mt-1 text-xs text-[oklch(55%_0.15_145)]">✅ 连接正常</p>}
        {verifyStatus === 'fail' && <p className="mt-1 text-xs text-[oklch(55%_0.2_25)]">❌ Key 不对，检查一下</p>}
        {provider !== 'ollama' && (
          <p className="mt-1 text-xs text-[oklch(55%_0.015_145)]">
            还没有 Key？
            <a href={PROVIDER_REGISTER_URLS[provider]} target="_blank" rel="noopener noreferrer" className="text-[oklch(55%_0.15_145)] hover:underline ml-1">去官网获取</a>
          </p>
        )}
      </div>
    </div>
  );
}
