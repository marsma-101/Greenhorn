/**
 * 统一模型网关 API 路由
 * 提供 OpenAI 兼容的 /v1/chat/completions 代理与模型列表接口
 */
// ✅ 已确认（2026-08-05 PM+用户验收）：不可误改
import { Router, Request, Response } from 'express';
import { proxyChatCompletions, listGatewayModels } from '../services/gateway';

export const gatewayRouter: Router = Router();

// POST /v1/chat/completions 或 /api/gateway/chat/completions - OpenAI 兼容代理
gatewayRouter.post('/chat/completions', proxyChatCompletions);

// GET /v1/models 或 /api/gateway/models - 网关支持的模型列表
gatewayRouter.get('/models', (_req: Request, res: Response) => {
  res.json({ success: true, providers: listGatewayModels() });
});
