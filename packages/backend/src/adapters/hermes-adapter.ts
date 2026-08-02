import { EngineAdapter, registry } from './base';
import type {
  EngineStatus,
  EngineChatRequest,
  EngineChatResponse,
} from '@greenhorn/shared';
import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getAiAgentRoot } from '../services/ai-agent-manager';

const HERMES_DEFAULT_PORT = 9119;

export class HermesAdapter extends EngineAdapter {
  private port: number;

  constructor(port: number = HERMES_DEFAULT_PORT) {
    super('hermes', 'Hermes', '全平台自主智能体');
    this.port = port;
  }

  getCapabilities(): string[] {
    return ['chat', 'streaming', 'thinking', 'tools', 'code', 'filesystem'];
  }

  async getStatus(): Promise<EngineStatus> {
    try {
      const res = await fetch(`http://127.0.0.1:${this.port}/api/status`, {
        signal: AbortSignal.timeout(3000),
      });
      const data = await res.json() as any;
      return this.buildStatus(true, data.gateway_running ?? res.ok, {
        version: data.version,
        pid: data.gateway_pid,
      });
    } catch {
      return this.buildStatus(false, false);
    }
  }

  async *chat(request: EngineChatRequest): AsyncGenerator<EngineChatResponse> {
    try {
      const aiAgentRoot = getAiAgentRoot();
      const hermesDir = path.join(aiAgentRoot, 'hermes');
      const hermesCli = path.join(hermesDir, 'program', '.venv', 'Scripts', 'hermes.exe');

      if (!fs.existsSync(hermesCli)) {
        yield {
          engineId: this.engineId,
          messageId: `err-${Date.now()}`,
          content: '',
          done: true,
          error: `Hermes CLI not found at ${hermesDir}. Is Hermes installed?`,
        };
        return;
      }

      // Build prompt with system context and conversation history
      const prompt = this.buildPrompt(request);

      // Use Hermes oneshot mode: hermes -z "prompt"
      const result = await this.runHermesOneshot(hermesCli, prompt);

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
        error: err.message || 'Hermes connection failed. Is Hermes installed?',
      };
    }
  }

  private buildPrompt(request: EngineChatRequest): string {
    const parts: string[] = [];

    // Add system prompt if present
    if (request.systemPrompt) {
      parts.push(`[System Instruction] ${request.systemPrompt}`);
    }

    // Add conversation history
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

  private runHermesOneshot(hermesCli: string, prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['-z', prompt];

      // 为 oneshot 创建独立可写环境，避免日志锁文件冲突
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-oneshot-'));

      const child = spawn(hermesCli, args, {
        cwd: path.dirname(hermesCli),
        timeout: 300000,
        env: {
          ...process.env,
          HERMES_HOME: tempDir,
          HERMES_DATA_DIR: tempDir,
          HERMES_LOG_DIR: path.join(tempDir, 'logs'),
          HOME: tempDir,
          APP_DATA: tempDir,
        },
        shell: false,
        windowsVerbatimArguments: false,
      });

      let output = '';
      let stderr = '';
      let lockError = false;

      child.stdout?.on('data', (data: Buffer) => {
        output += data.toString('utf-8');
      });

      child.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString('utf-8');
        stderr += chunk;
        if (chunk.includes('Permission denied') || chunk.includes('__agent.lock')) {
          lockError = true;
        }
      });

      child.on('close', async (code: number) => {
        // 清理临时目录
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {}

        if (code === 0) {
          resolve(output.trim() || 'Hermes processed your request.');
        } else if (lockError) {
          // 锁文件冲突：尝试终止占用的 Hermes 网关进程后重试
          try {
            await new Promise<void>((innerResolve) => {
              exec('taskkill /f /im hermes.exe 2>nul', () => innerResolve());
            });
            // 等待进程退出
            await new Promise(r => setTimeout(r, 500));
            // 重试一次
            const result = await this.runHermesOneshot(hermesCli, prompt);
            resolve(result);
          } catch (retryErr: any) {
            reject(new Error(`Hermes 锁文件冲突，重试失败: ${retryErr.message || retryErr}`));
          }
        } else {
          const errMsg = stderr.trim() || output.trim() || `Hermes exited with code ${code}`;
          reject(new Error(errMsg));
        }
      });

      child.on('error', (err: Error) => {
        reject(new Error(`Failed to start Hermes: ${err.message}`));
      });
    });
  }
}

registry.register(new HermesAdapter());
