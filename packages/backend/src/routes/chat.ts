import { Router, Request, Response } from 'express';
import { streamChat } from '../services/chat-engine';

export const chatRouter: Router = Router();

chatRouter.post('/', async (req: Request, res: Response) => {
  const { prompt, context, messages: history } = req.body;
  
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ success: false, message: '请提供要发送的消息' });
    return;
  }
  
  // 从请求中获取配置
  const provider = context?.provider || 'deepseek';
  const model = context?.model || process.env.DEFAULT_MODEL || 'deepseek-chat';
  const apiKey = context?.apiKey || process.env.DEEPSEEK_API_KEY || '';
  const baseUrl = context?.baseUrl || process.env.API_BASE_URL || 'https://api.deepseek.com';
  
  // 判断是否为 Ollama（无需 API Key）
  const isOllama = provider === 'ollama' || baseUrl.includes('localhost:11434');
  
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  try {
    // 非 Ollama 且无 API Key 时返回提示
    if (!isOllama && !apiKey) {
      res.write(`data: ${JSON.stringify({ type: 'text', content: '💬 你好！我是 AI 助手。\n\n看起来还没有配置 API Key，请先去 [设置页面](/settings) 配置后再来对话。' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', reason: 'complete' })}\n\n`);
      res.end();
      return;
    }
    
    // 使用真实 API 调用，传入历史消息
    for await (const event of streamChat(prompt, history || [], { model, apiKey, baseUrl })) {
      if (res.destroyed) break;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    
    if (!res.destroyed) {
      res.end();
    }
  } catch (error) {
    console.error('Chat error:', error);
    if (!res.destroyed) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: '出了点小问题，请再试一次' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', reason: 'error' })}\n\n`);
      res.end();
    }
  }
  
  // 处理客户端断开
  req.on('close', () => {
    if (!res.destroyed) {
      res.end();
    }
  });
});