import { EngineAdapter, registry } from './base';
import type {
  EngineStatus,
  EngineChatRequest,
  EngineChatResponse,
  EngineDefinition,
  ChatMessage,
} from '@greenhorn/shared';
import { execSync } from 'child_process';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export class ClaudeCodeAdapter extends EngineAdapter {
  constructor(config: EngineDefinition) {
    super(config);
  }

  async getStatus(): Promise<EngineStatus> {
    const hasKey = !!process.env.ANTHROPIC_API_KEY;
    let hasCmd = false;

    try {
      execSync('where claude', { stdio: 'pipe', timeout: 3000 });
      hasCmd = true;
    } catch {
      hasCmd = false;
    }

    const installed = hasKey;
    const running = hasKey;

    return this.buildStatus(installed, running, {
      capabilities: this.getCapabilities(),
    });
  }

  async *chat(request: EngineChatRequest): AsyncGenerator<EngineChatResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      yield {
        engineId: this.engineId,
        messageId: `err-${Date.now()}`,
        content: '',
        done: true,
        error: 'ANTHROPIC_API_KEY 未设置，请在设置中配置 API Key',
      };
      return;
    }

    const model = (request as any).model || 'claude-sonnet-4.6';
    const system = request.systemPrompt || '';

    const messages = this.formatClaudeMessages(request.messages);

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'anthropic-version': '2023-06-01',
          ...(request.maxTokens ? { 'anthropic-max-tokens': String(request.maxTokens) } : {}),
        },
        body: JSON.stringify({
          model,
          system,
          messages,
          stream: true,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          thinking: { type: 'adaptive' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield {
          engineId: this.engineId,
          messageId: `err-${Date.now()}`,
          content: '',
          done: true,
          error: `Claude API 返回 ${response.status}: ${errorText}`,
        };
        return;
      }

      if (!response.body) {
        yield {
          engineId: this.engineId,
          messageId: `err-${Date.now()}`,
          content: '',
          done: true,
          error: '无响应体',
        };
        return;
      }

      yield* this.parseSSEStream(response.body);
    } catch (err: any) {
      yield {
        engineId: this.engineId,
        messageId: `err-${Date.now()}`,
        content: '',
        done: true,
        error: `Claude Code 连接失败: ${err.message}`,
      };
    }
  }

  private formatClaudeMessages(messages: ChatMessage[]): Array<{ role: string; content: Array<{ type: string; text: string }> }> {
    return messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role,
        content: [{ type: 'text', text: m.content }],
      }));
  }

  private async *parseSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<EngineChatResponse> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let currentEvent = '';

    const messageId = `msg-${Date.now()}`;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            currentEvent = '';
            continue;
          }

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              switch (currentEvent) {
                case 'message_start':
                  break;

                case 'content_block_start':
                  break;

                case 'content_block_delta': {
                  const delta = data.delta;
                  if (delta?.type === 'thinking_delta' && delta.thinking) {
                    yield {
                      engineId: this.engineId,
                      messageId,
                      content: '',
                      thinking: delta.thinking,
                      done: false,
                    };
                  } else if (delta?.type === 'text_delta' && delta.text) {
                    yield {
                      engineId: this.engineId,
                      messageId,
                      content: delta.text,
                      done: false,
                    };
                  }
                  break;
                }

                case 'content_block_stop':
                  break;

                case 'message_delta':
                  break;

                case 'message_stop': {
                  yield {
                    engineId: this.engineId,
                    messageId,
                    content: '',
                    done: true,
                  };
                  return;
                }

                default:
                  break;
              }
            } catch {
              // 解析失败跳过
            }
          }
        }
      }

      yield {
        engineId: this.engineId,
        messageId,
        content: '',
        done: true,
      };
    } catch (err: any) {
      yield {
        engineId: this.engineId,
        messageId,
        content: '',
        done: true,
        error: `SSE 流读取错误: ${err.message}`,
      };
    }
  }
}

import { ENGINES } from '@greenhorn/shared/constants';
const claudeConfig = ENGINES.find(e => e.id === 'claude-code')!;
registry.register(new ClaudeCodeAdapter(claudeConfig));