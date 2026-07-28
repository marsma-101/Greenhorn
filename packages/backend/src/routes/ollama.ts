import { Router, Request, Response } from 'express';

export const ollamaRouter: Router = Router();

interface OllamaModel {
  name: string;
  model: string;
  size: number;
  modified_at: string;
  digest: string;
  details?: {
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaCheckResult {
  installed: boolean;
  running: boolean;
  models: Array<{ name: string; size: string }>;
  error?: string;
}

// GET /api/ollama/check - 检测本机 Ollama 是否安装并运行
ollamaRouter.get('/check', async (req: Request, res: Response) => {
  const result: OllamaCheckResult = {
    installed: false,
    running: false,
    models: [],
  };
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch('http://localhost:11434/api/tags', {
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      result.installed = true;
      result.running = true;
      const data = await response.json() as { models?: OllamaModel[] };
      result.models = (data.models || []).map((m: OllamaModel) => ({
        name: m.name,
        size: formatSize(m.size),
      }));
    } else {
      result.installed = true;
      result.running = false;
      result.error = 'Ollama 服务未运行';
    }
  } catch (error: any) {
    if (error?.name === 'AbortError' || error?.code === 'ECONNREFUSED') {
      result.installed = false;
      result.running = false;
      result.error = 'Ollama 未安装或未运行';
    } else {
      result.installed = false;
      result.running = false;
      result.error = '检测失败';
    }
  }
  
  res.json(result);
});

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}