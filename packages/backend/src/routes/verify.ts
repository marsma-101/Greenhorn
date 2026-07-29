import { Router, Request, Response } from 'express';
import { verifyApiKey } from '../services/chat-engine';

export const verifyRouter: Router = Router();

verifyRouter.post('/verify', async (req: Request, res: Response) => {
  const { provider, apiKey, baseUrl, modelId } = req.body;
  
  // Ollama 不需要验证（本地运行）
  if (provider === 'ollama' || baseUrl?.includes('localhost:11434')) {
    res.json({ success: true, message: 'Ollama 本地连接免验证', latency: 0 });
    return;
  }
  
  if (!apiKey) {
    res.json({ success: false, message: 'Key 好像不对哦，检查有没有复制完整？' });
    return;
  }
  
  // 默认配置
  const model = modelId || 'deepseek-chat';
  const url = baseUrl || 'https://api.deepseek.com';
  
  const result = await verifyApiKey(apiKey, url, model);
  res.json(result);
});