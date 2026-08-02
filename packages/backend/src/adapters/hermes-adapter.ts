import { EngineAdapter, registry } from './base';
import type {
  EngineStatus,
  EngineChatRequest,
  EngineChatResponse,
  EngineDefinition,
} from '@greenhorn/shared';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getAiAgentRoot } from '../services/ai-agent-manager';

const HERMES_DEFAULT_PORT = 9119;

export class HermesAdapter extends EngineAdapter {
  private port: number;

  constructor(config: EngineDefinition, port: number = HERMES_DEFAULT_PORT) {
    super(config);
    this.port = port;
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

      const child = spawn(hermesCli, args, {
        cwd: path.dirname(hermesCli),
        timeout: 300000,
        shell: false,
        windowsVerbatimArguments: false,
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
          resolve(output.trim() || 'Hermes processed your request.');
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

import { ENGINES } from '@greenhorn/shared/constants';
const hermesConfig = ENGINES.find(e => e.id === 'hermes')!;
registry.register(new HermesAdapter(hermesConfig));
