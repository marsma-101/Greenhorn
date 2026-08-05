/**
 * 密钥管理 API 路由
 * 提供供应商密钥的查询、设置、删除接口，配合前端「密钥管理」页面使用
 */
import { Router, Request, Response } from 'express';
import { MODEL_PROVIDERS } from './model-providers';
import { getKey, setKey, deleteKey, maskKey } from '../services/keyvault';

export const keyvaultRouter: Router = Router();

// GET /api/keyvault - 返回所有供应商的密钥状态（脱敏展示）
keyvaultRouter.get('/', (req: Request, res: Response) => {
  try {
    const providers = MODEL_PROVIDERS.map(provider => {
      const isOllama = provider.id === 'ollama';
      const apiKey = isOllama ? null : getKey(provider.id);
      return {
        id: provider.id,
        name: provider.name,
        region: provider.region,
        registerUrl: provider.registerUrl,
        hasKey: isOllama ? false : !!apiKey,
        maskedKey: isOllama ? '' : apiKey ? maskKey(apiKey) : '',
        requiresKey: !isOllama,
      };
    });
    res.json({ success: true, providers });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || '服务器错误' });
  }
});

// PUT /api/keyvault/:providerId - 设置指定供应商的 API Key（空字符串视为删除）
keyvaultRouter.put('/:providerId', (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const pid = String(providerId);
    const provider = MODEL_PROVIDERS.find(p => p.id === pid);
    if (!provider) {
      res.status(404).json({ success: false, message: '未知供应商' });
      return;
    }
    const { apiKey } = req.body as { apiKey?: unknown };
    if (typeof apiKey !== 'string') {
      res.status(400).json({ success: false, message: 'apiKey 必须是字符串' });
      return;
    }
    setKey(pid, apiKey);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || '服务器错误' });
  }
});

// DELETE /api/keyvault/:providerId - 删除指定供应商的密钥
keyvaultRouter.delete('/:providerId', (req: Request, res: Response) => {
  try {
    deleteKey(String(req.params.providerId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || '服务器错误' });
  }
});
