import { Router, Request, Response } from 'express';
import { verifyApiKey } from '../services/chat-engine';

export const verifyRouter: Router = Router();

verifyRouter.post('/verify', async (req: Request, res: Response) => {
  const { provider, apiKey, baseUrl, modelId } = req.body;
  
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