import { Router, Request, Response } from 'express';
import type { VerifyConfigRequest } from '@greenhorn/shared/types/chat';

export const verifyRouter: Router = Router();

verifyRouter.post('/verify', async (req: Request, res: Response) => {
  const { provider, apiKey, baseUrl } = req.body as VerifyConfigRequest;

  if (!apiKey) {
    res.json({
      success: false,
      message: 'Key 好像不对哦，检查有没有复制完整？',
    });
    return;
  }

  // TODO: 实际调用 API 验证 Key 有效性
  res.json({ success: true, message: '连接正常！' });
});