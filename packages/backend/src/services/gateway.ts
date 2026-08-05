/**
 * 统一模型网关（OpenAI 兼容）
 * 将各供应商的模型请求统一转换为 OpenAI 兼容格式，转发到对应上游
 */
import { Request, Response } from 'express';
import { MODEL_PROVIDERS } from '../routes/model-providers';
import { getKey } from './keyvault';

interface ResolvedModel {
  providerId: string;
  modelId: string;
}

/**
 * 解析模型标识：
 * - 形如 "deepseek/deepseek-chat"（含 '/'）→ 按 providerId/modelId 拆分
 * - 否则在所有供应商的 models 中按 id 匹配
 * 找不到对应供应商返回 null
 */
export function resolveProvider(model: string): ResolvedModel | null {
  if (!model) return null;
  if (model.includes('/')) {
    // 完整标识：providerId/modelId
    const slashIndex = model.indexOf('/');
    const providerId = model.slice(0, slashIndex);
    const modelId = model.slice(slashIndex + 1);
    // 供应商必须存在于预设清单中，模型 id 允许是未预设的新模型
    const provider = MODEL_PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      return { providerId, modelId };
    }
    return null;
  }
  // 直接使用模型 id：在所有供应商中查找
  for (const provider of MODEL_PROVIDERS) {
    if (provider.models.some(m => m.id === model)) {
      return { providerId: provider.id, modelId: model };
    }
  }
  return null;
}

/**
 * 构造上游 chat/completions 地址：
 * url 以 '/v1' 结尾 → 直接拼接 '/chat/completions'；否则 → 拼接 '/v1/chat/completions'
 */
export function buildUpstreamUrl(provider: { url: string }): string {
  const base = provider.url.replace(/\/+$/, '');
  if (base.endsWith('/v1')) {
    return base + '/chat/completions';
  }
  return base + '/v1/chat/completions';
}

/** 列出网关支持的所有模型（含密钥状态，供前端展示） */
export function listGatewayModels(): Array<{
  providerId: string;
  providerName: string;
  registerUrl: string;
  hasKey: boolean;
  models: Array<{ id: string; name: string }>;
}> {
  return MODEL_PROVIDERS.map(provider => ({
    providerId: provider.id,
    providerName: provider.name,
    registerUrl: provider.registerUrl,
    hasKey: !!getKey(provider.id),
    models: provider.models.map(m => ({ id: m.id, name: m.name })),
  }));
}

/**
 * OpenAI 兼容的 chat/completions 代理
 * 支持流式（SSE）与非流式两种响应模式
 */
export async function proxyChatCompletions(req: Request, res: Response): Promise<void> {
  try {
    // 解析请求体（any 收窄后访问字段）
    const body: any = req.body;
    const model: string = typeof body.model === 'string' ? body.model : '';
    const messages: any = body.messages;
    const stream: boolean = !!body.stream;
    const temperature: any = body.temperature;
    const maxTokens: any = body.max_tokens;

    // 定位模型所属供应商
    const resolved = resolveProvider(model);
    if (!resolved) {
      res.status(400).json({ error: { message: '未知模型: ' + model } });
      return;
    }
    const provider = MODEL_PROVIDERS.find(p => p.id === resolved.providerId)!;
    const apiKey = getKey(resolved.providerId);

    // ollama 为本机服务，无需 API Key；其余供应商必须已配置密钥
    if (provider.id !== 'ollama' && !apiKey) {
      res.status(401).json({
        error: { message: '请先在「密钥管理」中配置 ' + provider.name + ' 的 API Key' },
      });
      return;
    }

    // 构造请求头与请求体（保留原始值，stream 原样透传）
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = 'Bearer ' + apiKey;
    }
    const payload: any = {
      model: resolved.modelId,
      messages,
      stream,
      temperature,
      max_tokens: maxTokens,
    };

    // 转发到上游
    const response = await fetch(buildUpstreamUrl(provider), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    // 上游返回非 2xx：透传上游 error.message
    if (!response.ok) {
      let upstreamMessage = '上游服务错误';
      try {
        const errBody: any = await response.json();
        if (errBody && errBody.error && typeof errBody.error.message === 'string') {
          upstreamMessage = errBody.error.message;
        }
      } catch {
        // 上游响应体无法解析为 JSON，使用默认错误信息
      }
      res.status(response.status).json({ error: { message: upstreamMessage } });
      return;
    }

    // 流式响应：设置 SSE 头，逐块转发上游响应体
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (response.body) {
        for await (const chunk of response.body as any) {
          res.write(chunk);
        }
      }
      res.end();
      return;
    }

    // 非流式：直接返回上游 JSON
    const data: any = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || '服务器错误' } });
  }
}
