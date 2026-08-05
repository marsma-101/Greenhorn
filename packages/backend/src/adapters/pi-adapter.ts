import { EngineAdapter, registry } from './base';
import type {
  EngineStatus,
  EngineChatRequest,
  EngineChatResponse,
  EngineDefinition,
} from '@greenhorn/shared';

// ✅ 已确认（2026-08-05 PM+用户验收）：不可误改（P0-3 思维链修复 + undici chunk 解码修复）
export class PIAdapter extends EngineAdapter {
  constructor(config: EngineDefinition) {
    super(config);
  }

  async getStatus(): Promise<EngineStatus> {
    try {
      const res = await fetch('http://127.0.0.1:1001/api/health', {
        signal: AbortSignal.timeout(3000),
      });
      const running = res.ok;
      return this.buildStatus(true, running, {
        version: '0.1.0',
      });
    } catch {
      return this.buildStatus(true, false);
    }
  }

  async *chat(request: EngineChatRequest): AsyncGenerator<EngineChatResponse> {
    const url = 'http://127.0.0.1:1001/api/chat';
    try {
      // 取最后一条 user 消息作为 prompt；没有 user 消息则直接报错
      const lastUserIndex = request.messages.map(m => m.role).lastIndexOf('user');
      if (lastUserIndex === -1) {
        yield {
          engineId: this.engineId,
          messageId: `err-${Date.now()}`,
          content: '',
          done: true,
          error: '没有用户消息',
        };
        return;
      }
      const prompt = request.messages[lastUserIndex].content;

      // history = 除最后一条 user 消息外的其他消息，保持 role/content 原值
      const history = request.messages
        .filter((_, i) => i !== lastUserIndex)
        .map(m => ({ role: m.role, content: m.content }));

      // 从后端配置接口获取 context（失败则各字段留空字符串）
      let context = { provider: '', model: '', apiKey: '', baseUrl: '' };
      try {
        const configRes = await fetch('http://127.0.0.1:1001/api/config', {
          signal: AbortSignal.timeout(3000),
        });
        if (configRes.ok) {
          const config = await configRes.json() as any;
          context = {
            provider: config.provider || '',
            model: config.model || '',
            apiKey: config.apiKey || '',
            baseUrl: config.baseUrl || '',
          };
        }
      } catch {
        // 忽略，context 保持空字符串
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          context,
          messages: history,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 4096,
        }),
      });

      if (!res.ok) {
        // 尽量读取错误详情（json 或 text），只报状态码不便于排查
        let detail = '';
        try {
          const errorText = await res.text();
          try {
            const parsed = JSON.parse(errorText);
            detail = parsed.message || errorText;
          } catch {
            detail = errorText;
          }
        } catch {
          // 读取失败则忽略
        }
        yield {
          engineId: this.engineId,
          messageId: `err-${Date.now()}`,
          content: '',
          done: true,
          error: detail ? `PI returned ${res.status}: ${detail}` : `PI returned ${res.status}`,
        };
        return;
      }

      if (!res.body) {
        yield {
          engineId: this.engineId,
          messageId: `err-${Date.now()}`,
          content: '',
          done: true,
          error: 'No response body',
        };
        return;
      }

      const body = res.body;
      for await (const chunk of body as any) {
        // 注意：undici 的 for-await chunk 是 Uint8Array，String(chunk) 会得到字节数字串，
        // 必须用 TextDecoder 正确解码为文本
        const text = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk as Uint8Array);
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'text') {
                yield {
                  engineId: this.engineId,
                  messageId: `msg-${Date.now()}`,
                  content: parsed.content || '',
                  done: false,
                };
              } else if (parsed.type === 'thinking') {
                yield {
                  engineId: this.engineId,
                  messageId: `msg-${Date.now()}`,
                  content: '',
                  thinking: parsed.content || '',
                  done: false,
                };
              } else if (parsed.type === 'error') {
                yield {
                  engineId: this.engineId,
                  messageId: `err-${Date.now()}`,
                  content: '',
                  done: true,
                  error: parsed.message || 'PI chat error',
                };
                return;
              } else if (parsed.type === 'done') {
                yield {
                  engineId: this.engineId,
                  messageId: `msg-${Date.now()}`,
                  content: '',
                  done: true,
                };
                return;
              }
              // 其他未知事件类型：解析成功但忽略
            } catch {
              // 解析失败的行跳过
            }
          }
        }
      }

      yield {
        engineId: this.engineId,
        messageId: `msg-${Date.now()}`,
        content: '',
        done: true,
      };
    } catch (err: any) {
      yield {
        engineId: this.engineId,
        messageId: `err-${Date.now()}`,
        content: '',
        done: true,
        error: err.message || 'PI connection failed',
      };
    }
  }
}

import { ENGINES } from '@greenhorn/shared/constants';
const piConfig = ENGINES.find(e => e.id === 'pi')!;
registry.register(new PIAdapter(piConfig));
