import { Router, Request, Response } from 'express';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import { getKey } from '../services/keyvault';

export const configRouter: Router = Router();

// PI 配置文件路径
function getConfigDir(): string {
  return process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent');
}

function getAuthPath(): string {
  return path.join(getConfigDir(), 'auth.json');
}

function getModelsPath(): string {
  return path.join(getConfigDir(), 'models.json');
}

// 读取 auth.json
function readAuth(): Record<string, { apiKey?: string; baseUrl?: string }> {
  try {
    const authPath = getAuthPath();
    if (existsSync(authPath)) {
      return JSON.parse(readFileSync(authPath, 'utf-8'));
    }
  } catch {
    // 忽略
  }
  return {};
}

// 供应商 URL 映射（Ollama 特殊处理）
const PROVIDER_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1',
  ollama: 'http://localhost:11434/v1',
  tongyi: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  moonshot: 'https://api.moonshot.cn/v1',
  openai: 'https://api.openai.com/v1',
};

// 写入 auth.json
function writeAuth(auth: Record<string, { apiKey?: string; baseUrl?: string }>): void {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  writeFileSync(getAuthPath(), JSON.stringify(auth, null, 2), 'utf-8');
}

// 读取 models.json
function readModels(): Record<string, any> {
  try {
    const modelsPath = getModelsPath();
    if (existsSync(modelsPath)) {
      return JSON.parse(readFileSync(modelsPath, 'utf-8'));
    }
  } catch {
    // 忽略
  }
  return {};
}

// 写入 models.json
function writeModels(models: Record<string, any>): void {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  writeFileSync(getModelsPath(), JSON.stringify(models, null, 2), 'utf-8');
}

// GET /api/config - 读取当前配置
configRouter.get('/', async (req: Request, res: Response) => {
  try {
    const auth = readAuth();
    const models = readModels();
    
    // 从 auth.json 和 models.json 中提取当前配置
    const providers = Object.keys(auth);
    const currentProvider = models.defaultProvider || providers[0] || 'deepseek';
    const rawModel = models.defaultModel || 'deepseek-chat';
    // Strip provider prefix (PI format: "ollama/qwen3.5:9b" → "qwen3.5:9b")
    const currentModel = rawModel.includes('/') ? rawModel.split('/').pop()! : rawModel;
    const currentAuth = auth[currentProvider] || {};

    // ✅ 已测通（2026-08-05 阶段2 验收）：apiKey 回退到 Key Vault（引擎联动：keyvault 配一次，引擎自动可用）
    const apiKey = currentAuth.apiKey || getKey(currentProvider) || '';
    const baseUrl = currentAuth.baseUrl || PROVIDER_URLS[currentProvider] || 'https://api.deepseek.com';

    res.json({
      provider: currentProvider,
      model: currentModel,
      apiKey,
      baseUrl,
      theme: 'light',
      showHelp: true,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '读取配置失败' });
  }
});

// PUT /api/config - 保存配置
configRouter.put('/', async (req: Request, res: Response) => {
  try {
    const { provider, model, apiKey, baseUrl, theme, showHelp } = req.body;
    
    if (!provider) {
      res.status(400).json({ success: false, message: '请选择模型提供商' });
      return;
    }
    
    // 更新 auth.json
    const auth = readAuth();
    auth[provider] = {
      apiKey: apiKey || '',
      baseUrl: baseUrl || PROVIDER_URLS[provider] || `https://api.${provider}.com`,
    };
    writeAuth(auth);
    
    // 更新 models.json
    const models = readModels();
    models.defaultProvider = provider;
    models.defaultModel = model || 'default';
    writeModels(models);
    
    res.json({ success: true, message: '配置已保存！' });
  } catch (error) {
    res.status(500).json({ success: false, message: '保存配置失败，请检查文件权限' });
  }
});