import { Router, Request, Response } from 'express';
import type { SendMessageRequest } from '@greenhorn/shared/types/chat';

export const chatRouter: Router = Router();

chatRouter.post('/', async (req: Request, res: Response) => {
  const { prompt, sessionId, context } = req.body as SendMessageRequest;

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // 发送开始事件
  res.write(
    `data: ${JSON.stringify({ type: 'text', content: '你好！我是 AI 助手，让我想想...' })}\n\n`,
  );

  // 模拟思考过程
  setTimeout(() => {
    res.write(
      `data: ${JSON.stringify({ type: 'thinking', content: '好的，让我先看看这个问题的上下文...' })}\n\n`,
    );
  }, 500);

  // 模拟回复
  setTimeout(() => {
    res.write(
      `data: ${JSON.stringify({
        type: 'text',
        content: `你说了: "${prompt}"\n\n这是一个模拟回复。在后续版本中，这里会调用 PI 引擎生成真实的回复。`,
      })}\n\n`,
    );
    res.write(
      `data: ${JSON.stringify({ type: 'done', reason: 'complete' })}\n\n`,
    );
    res.end();
  }, 1500);

  // 处理客户端断开
  req.on('close', () => {
    // 清理资源
    res.end();
  });
});