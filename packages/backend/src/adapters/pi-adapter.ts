import { EngineAdapter, registry } from './base';
import type {
  EngineStatus,
  EngineChatRequest,
  EngineChatResponse,
  EngineDefinition,
} from '@greenhorn/shared';

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
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: this.formatMessages(request.messages, request.systemPrompt),
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 4096,
          stream: request.stream ?? true,
          session_id: request.sessionId,
        }),
      });

      if (!res.ok) {
        yield {
          engineId: this.engineId,
          messageId: `err-${Date.now()}`,
          content: '',
          done: true,
          error: `PI returned ${res.status}`,
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
        const text = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield {
                engineId: this.engineId,
                messageId: `msg-${Date.now()}`,
                content: '',
                done: true,
              };
              return;
            }
            try {
              const parsed = JSON.parse(data);
              yield {
                engineId: this.engineId,
                messageId: parsed.id || `msg-${Date.now()}`,
                content: parsed.content || parsed.delta || '',
                thinking: parsed.thinking,
                done: false,
              };
            } catch {
              yield {
                engineId: this.engineId,
                messageId: `msg-${Date.now()}`,
                content: data,
                done: false,
              };
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
