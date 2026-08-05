import { EngineAdapter, registry } from './base';
import type {
  EngineStatus,
  EngineChatRequest,
  EngineChatResponse,
  EngineDefinition,
} from '@greenhorn/shared';
import { spawn, execSync } from 'child_process';

// OpenClaw 本地网关（WebSocket 端口）
const OPENCLAW_GATEWAY_PORT = 18789;

export class OpenClawAdapter extends EngineAdapter {
  constructor(config: EngineDefinition) {
    super(config);
  }

  async getStatus(): Promise<EngineStatus> {
    let installed = false;
    try {
      execSync('where openclaw', { stdio: 'pipe', timeout: 3000 });
      installed = true;
    } catch {
      installed = false;
    }

    let running = false;
    if (installed) {
      // 探测本地网关端口是否有响应（WebSocket 端点对 HTTP 探测也可能返回升级响应，说明端口在监听）
      try {
        await fetch(`http://127.0.0.1:${OPENCLAW_GATEWAY_PORT}/`, {
          signal: AbortSignal.timeout(2000),
        });
        running = true;
      } catch {
        running = false;
      }
    }

    return this.buildStatus(installed, running, {
      capabilities: this.getCapabilities(),
    });
  }

  async *chat(request: EngineChatRequest): AsyncGenerator<EngineChatResponse> {
    if (!this.findOpenClawCli()) {
      yield {
        engineId: this.engineId,
        messageId: `err-${Date.now()}`,
        content: '',
        done: true,
        error: 'OpenClaw CLI 未找到，请先安装 OpenClaw 引擎',
      };
      return;
    }

    try {
      const prompt = this.buildPrompt(request);
      const result = await this.runOpenClawOneshot(prompt, request);

      yield {
        engineId: this.engineId,
        messageId: `msg-${Date.now()}`,
        content: result,
        done: true,
      };
    } catch (err: any) {
      yield {
        engineId: this.engineId,
        messageId: `err-${Date.now()}`,
        content: '',
        done: true,
        error: `OpenClaw 对话失败: ${err.message}`,
      };
    }
  }

  private findOpenClawCli(): string | null {
    try {
      execSync('where openclaw', { stdio: 'pipe', timeout: 3000 });
      return 'openclaw';
    } catch {
      return null;
    }
  }

  private buildPrompt(request: EngineChatRequest): string {
    const parts: string[] = [];

    if (request.systemPrompt) {
      parts.push(`[System] ${request.systemPrompt}`);
    }

    const messages = request.messages || [];
    for (const msg of messages) {
      if (msg.role === 'user') {
        parts.push(`[User] ${msg.content}`);
      } else if (msg.role === 'assistant') {
        parts.push(`[Assistant] ${msg.content}`);
      } else if (msg.role === 'system') {
        parts.push(`[System] ${msg.content}`);
      }
    }

    return parts.join('\n\n');
  }

  private async runOpenClawOneshot(
    prompt: string,
    request: EngineChatRequest
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['run', prompt];

      const child = spawn('openclaw', args, {
        timeout: 300000,
        shell: false,
        windowsVerbatimArguments: false,
        env: { ...process.env },
      });

      let output = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout | null = null;

      // 5 分钟超时保护
      timeoutId = setTimeout(() => {
        child.kill();
        reject(new Error('OpenClaw 执行超时（5分钟）'));
      }, 300000);

      child.stdout?.on('data', (data: Buffer) => {
        output += data.toString('utf-8');
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      child.on('close', (code: number) => {
        if (timeoutId) clearTimeout(timeoutId);

        if (code === 0) {
          resolve(output.trim() || 'OpenClaw 处理完成。');
        } else {
          const errMsg = stderr.trim() || output.trim() || `OpenClaw 退出码 ${code}`;
          reject(new Error(errMsg));
        }
      });

      child.on('error', (err: Error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(new Error(`启动 OpenClaw 失败: ${err.message}`));
      });
    });
  }
}

import { ENGINES } from '@greenhorn/shared/constants';
const openclawConfig = ENGINES.find(e => e.id === 'openclaw')!;
registry.register(new OpenClawAdapter(openclawConfig));
