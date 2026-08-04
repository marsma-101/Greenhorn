import { EngineAdapter, registry } from './base';
import type {
  EngineStatus,
  EngineChatRequest,
  EngineChatResponse,
  EngineDefinition,
} from '@greenhorn/shared';
import { execSync } from 'child_process';

const OPENCODE_DEFAULT_PORT = 4000;

export class OpenCodeAdapter extends EngineAdapter {
  private port: number;
  private baseUrl: string;

  constructor(config: EngineDefinition, port: number = OPENCODE_DEFAULT_PORT) {
    super(config);
    this.port = port;
    this.baseUrl = `http://127.0.0.1:${port}`;
  }

  async getStatus(): Promise<EngineStatus> {
    let cmdInstalled = false;

    try {
      execSync('where opencode', { stdio: 'pipe', timeout: 3000 });
      cmdInstalled = true;
    } catch {
      cmdInstalled = false;
    }

    let running = false;
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      running = res.ok;
    } catch {
      running = false;
    }

    return this.buildStatus(cmdInstalled, running, {
      capabilities: this.getCapabilities(),
    });
  }

  async *chat(request: EngineChatRequest): AsyncGenerator<EngineChatResponse> {
    try {
      const isRunning = await this.checkRunning();
      if (!isRunning) {
        yield {
          engineId: this.engineId,
          messageId: `err-${Date.now()}`,
          content: '',
          done: true,
          error: 'OpenCode 服务未启动，请运行 `opencode serve` 启动服务',
        };
        return;
      }

      const sessionId = request.sessionId || await this.createSession();
      if (!sessionId) {
        yield {
          engineId: this.engineId,
          messageId: `err-${Date.now()}`,
          content: '',
          done: true,
          error: '创建 OpenCode 会话失败',
        };
        return;
      }

      const lastUserMessage = request.messages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) {
        yield {
          engineId: this.engineId,
          messageId: `err-${Date.now()}`,
          content: '',
          done: true,
          error: '没有用户消息',
        };
        return;
      }

      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: lastUserMessage.content,
          type: 'user',
        }),
      });

      if (!response.ok) {
        yield {
          engineId: this.engineId,
          messageId: `err-${Date.now()}`,
          content: '',
          done: true,
          error: `OpenCode 返回 ${response.status}`,
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
        error: `OpenCode 连接失败: ${err.message}`,
      };
    }
  }

  private async checkRunning(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async createSession(): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'build' }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        return data.id || data.sessionId || null;
      }
      return null;
    } catch {
      return null;
    }
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
                case 'text-delta': {
                  const delta = data.delta || data.content || '';
                  if (delta) {
                    yield {
                      engineId: this.engineId,
                      messageId,
                      content: delta,
                      done: false,
                    };
                  }
                  break;
                }

                case 'reasoning-delta': {
                  const delta = data.delta || data.content || '';
                  if (delta) {
                    yield {
                      engineId: this.engineId,
                      messageId,
                      content: '',
                      thinking: delta,
                      done: false,
                    };
                  }
                  break;
                }

                case 'tool-call': {
                  yield {
                    engineId: this.engineId,
                    messageId,
                    content: '',
                    done: false,
                    toolCalls: [{
                      id: data.toolName || `tool-${Date.now()}`,
                      name: data.toolName || 'unknown',
                      arguments: data.args || data.input || {},
                    }],
                  };
                  break;
                }

                case 'tool-result': {
                  break;
                }

                case 'finish': {
                  yield {
                    engineId: this.engineId,
                    messageId,
                    content: '',
                    done: true,
                  };
                  return;
                }

                case 'provider-error': {
                  yield {
                    engineId: this.engineId,
                    messageId,
                    content: '',
                    done: true,
                    error: data.error || data.message || 'Provider 错误',
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
const opencodeConfig = ENGINES.find(e => e.id === 'opencode')!;
registry.register(new OpenCodeAdapter(opencodeConfig));