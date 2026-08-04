import { EngineAdapter, registry } from './base';
import type {
  EngineStatus,
  EngineChatRequest,
  EngineChatResponse,
  EngineDefinition,
} from '@greenhorn/shared';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { getAiAgentRoot } from '../services/ai-agent-manager';

export class CodexAdapter extends EngineAdapter {
  private process: ChildProcess | null = null;
  private messageId: number = 0;
  private initialized: boolean = false;

  constructor(config: EngineDefinition) {
    super(config);
  }

  async getStatus(): Promise<EngineStatus> {
    let cmdInstalled = false;

    try {
      execSync('where codex', { stdio: 'pipe', timeout: 3000 });
      cmdInstalled = true;
    } catch {
      // 尝试检查 ai-agent 目录
      const aiAgentRoot = getAiAgentRoot();
      const codexDir = path.join(aiAgentRoot, 'codex', 'program');
      if (fs.existsSync(codexDir)) {
        const codexBin = path.join(codexDir, 'codex-cli', 'bin', 'codex.js');
        if (fs.existsSync(codexBin)) {
          cmdInstalled = true;
        }
      }
    }

    return this.buildStatus(cmdInstalled, false, {
      capabilities: this.getCapabilities(),
    });
  }

  async *chat(request: EngineChatRequest): AsyncGenerator<EngineChatResponse> {
    let codexCliPath = '';
    const aiAgentRoot = getAiAgentRoot();
    const codexDir = path.join(aiAgentRoot, 'codex', 'program');

    // 查找 Codex 可执行路径
    const codexBin = path.join(codexDir, 'codex-cli', 'bin', 'codex.js');
    if (fs.existsSync(codexBin)) {
      codexCliPath = codexBin;
    } else {
      try {
        execSync('where codex', { stdio: 'pipe', timeout: 3000 });
        codexCliPath = 'codex';
      } catch {
        yield {
          engineId: this.engineId,
          messageId: `err-${Date.now()}`,
          content: '',
          done: true,
          error: 'Codex 未安装，请先安装 Codex 引擎',
        };
        return;
      }
    }

    try {
      const result = await this.runCodexOneshot(codexCliPath, request);
      yield* this.parseCodexResult(result);
    } catch (err: any) {
      yield {
        engineId: this.engineId,
        messageId: `err-${Date.now()}`,
        content: '',
        done: true,
        error: `Codex 对话失败: ${err.message}`,
      };
    }
  }

  private async runCodexOneshot(codexPath: string, request: EngineChatRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      const lastUserMessage = request.messages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) {
        reject(new Error('没有用户消息'));
        return;
      }

      // 构建对话 prompt（包含 system prompt 和历史）
      const promptParts: string[] = [];
      if (request.systemPrompt) {
        promptParts.push(`System: ${request.systemPrompt}`);
      }
      for (const msg of request.messages) {
        if (msg.role === 'user') {
          promptParts.push(`User: ${msg.content}`);
        } else if (msg.role === 'assistant') {
          promptParts.push(`Assistant: ${msg.content}`);
        }
      }
      const fullPrompt = promptParts.join('\n\n');

      const args = ['command', 'exec', fullPrompt];

      const child = spawn('node', [codexPath, ...args], {
        cwd: path.dirname(codexPath),
        timeout: 300000,
        shell: false,
        windowsVerbatimArguments: false,
        env: {
          ...process.env,
          CODEX_HOME: path.join(getAiAgentRoot(), 'codex', 'data'),
        },
      });

      let output = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        output += data.toString('utf-8');
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      child.on('close', (code: number) => {
        if (code === 0) {
          resolve(output.trim() || 'Codex processed your request.');
        } else {
          const errMsg = stderr.trim() || output.trim() || `Codex exited with code ${code}`;
          reject(new Error(errMsg));
        }
      });

      child.on('error', (err: Error) => {
        reject(new Error(`Failed to start Codex: ${err.message}`));
      });
    });
  }

  private async *parseCodexResult(result: string): AsyncGenerator<EngineChatResponse> {
    const messageId = `msg-${Date.now()}`;
    
    // 尝试解析 JSON-RPC 格式的输出
    try {
      const lines = result.split('\n').filter(Boolean);
      let hasContent = false;

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          
          // JSON-RPC 响应
          if (json.result !== undefined) {
            if (typeof json.result === 'string' && json.result.trim()) {
              hasContent = true;
              yield {
                engineId: this.engineId,
                messageId,
                content: json.result,
                done: false,
              };
            }
          }
          
          // 通知事件
          if (json.method === 'notifications' && json.params?.event) {
            const event = json.params.event;
            
            if (event.type === 'item' && event.item) {
              const item = event.item;
              
              if (item.type === 'agentMessage') {
                const textParts = (item.content || [])
                  .filter((c: any) => c.type === 'text')
                  .map((c: any) => c.text)
                  .join('');
                if (textParts) {
                  hasContent = true;
                  yield {
                    engineId: this.engineId,
                    messageId,
                    content: textParts,
                    done: false,
                  };
                }
              } else if (item.type === 'agentReasoning') {
                const reasoning = (item.content || [])
                  .filter((c: any) => c.type === 'text')
                  .map((c: any) => c.text)
                  .join('');
                if (reasoning) {
                  yield {
                    engineId: this.engineId,
                    messageId,
                    content: '',
                    thinking: reasoning,
                    done: false,
                  };
                }
              } else if (item.type === 'functionCall') {
                yield {
                  engineId: this.engineId,
                  messageId,
                  content: '',
                  done: false,
                  toolCalls: [{
                    id: item.id || `tool-${Date.now()}`,
                    name: item.name || 'unknown',
                    arguments: item.arguments || item.input || {},
                  }],
                };
              }
            }
            
            if (event.type === 'item' && event.item?.type === 'turnComplete') {
              yield {
                engineId: this.engineId,
                messageId,
                content: '',
                done: true,
              };
              return;
            }
          }
        } catch {
          // 非 JSON 行，作为普通文本输出
          if (line.trim()) {
            hasContent = true;
            yield {
              engineId: this.engineId,
              messageId,
              content: line + '\n',
              done: false,
            };
          }
        }
      }

      if (!hasContent) {
        yield {
          engineId: this.engineId,
          messageId,
          content: result.trim(),
          done: false,
        };
      }

      yield {
        engineId: this.engineId,
        messageId,
        content: '',
        done: true,
      };
    } catch {
      // 纯文本输出
      yield {
        engineId: this.engineId,
        messageId,
        content: result,
        done: false,
      };
      yield {
        engineId: this.engineId,
        messageId,
        content: '',
        done: true,
      };
    }
  }

  private sendJsonRpc(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin || !this.process.stdout) {
        reject(new Error('Codex app-server not started'));
        return;
      }

      const id = ++this.messageId;
      const request = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }) + '\n';

      const buffer: string[] = [];
      const onData = (data: Buffer) => {
        buffer.push(data.toString('utf-8'));
        const responseStr = buffer.join('');
        try {
          const response = JSON.parse(responseStr);
          if (response.id === id) {
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
            this.process?.stdout?.removeListener('data', onData);
          }
        } catch {
          // 等待更多数据
        }
      };

      this.process.stdout.on('data', onData);
      this.process.stdin.write(request);
    });
  }

  async startAppServer(codexPath: string): Promise<void> {
    if (this.process) {
      return;
    }

    const aiAgentRoot = getAiAgentRoot();
    const codexDataDir = path.join(aiAgentRoot, 'codex', 'data');
    fs.mkdirSync(codexDataDir, { recursive: true });

    this.process = spawn('node', [codexPath, 'app-server'], {
      cwd: path.dirname(codexPath),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CODEX_HOME: codexDataDir,
      },
    });

    // 等待 app-server 启动
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Codex app-server 启动超时')), 10000);
      
      const onData = () => {
        clearTimeout(timeout);
        resolve();
        this.process?.stdout?.removeListener('data', onData);
      };
      
      this.process!.stdout!.once('data', onData);
    });

    // 初始化握手
    const result = await this.sendJsonRpc('initialize', {
      clientInfo: { name: 'GreenHorn', version: '1.0' },
    });
    
    this.initialized = true;
  }

  stopAppServer(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.initialized = false;
    }
  }
}

import { ENGINES } from '@greenhorn/shared/constants';
const codexConfig = ENGINES.find(e => e.id === 'codex')!;
registry.register(new CodexAdapter(codexConfig));