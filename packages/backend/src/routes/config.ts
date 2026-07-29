import { Router, Request, Response } from 'express';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

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
    const currentModel = models.defaultModel || 'deepseek-chat';
    const currentAuth = auth[currentProvider] || {};
    
    res.json({
      provider: currentProvider,
      model: currentModel,
      apiKey: currentAuth.apiKey || '',
      baseUrl: currentAuth.baseUrl || 'https://api.deepseek.com',
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
      baseUrl: baseUrl || `https://api.${provider}.com`,
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