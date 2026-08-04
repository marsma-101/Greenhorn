import { EngineAdapter, registry } from './base';
import type {
  EngineStatus,
  EngineChatRequest,
  EngineChatResponse,
  EngineDefinition,
} from '@greenhorn/shared';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getAiAgentRoot, getEnginePaths } from '../services/ai-agent-manager';

const HERMES_DEFAULT_PORT = 9119;

export interface HermesSessionInfo {
  id: string;
  title: string;
  time: string;
  messageCount: number;
}

export interface HermesConfig {
  model?: {
    default?: string;
    base_url?: string;
    provider?: string;
  };
  agent?: {
    max_turns?: number;
    reasoning_effort?: string;
  };
  terminal?: {
    env_type?: string;
    cwd?: string;
  };
  toolsets?: string[];
  mcp_servers?: Record<string, any>;
  skills?: {
    disabled?: string[];
  };
}

export class HermesAdapter extends EngineAdapter {
  private port: number;

  constructor(config: EngineDefinition, port: number = HERMES_DEFAULT_PORT) {
    super(config);
    this.port = port;
  }

  async getStatus(): Promise<EngineStatus> {
    const aiAgentRoot = getAiAgentRoot();
    const hermesDir = path.join(aiAgentRoot, 'hermes');
    const hermesCli = path.join(hermesDir, 'program', '.venv', 'Scripts', 'hermes.exe');

    let installed = false;
    if (fs.existsSync(hermesCli)) {
      installed = true;
    } else {
      try {
        execSync('where hermes', { stdio: 'pipe', timeout: 3000 });
        installed = true;
      } catch {
        installed = false;
      }
    }

    let running = false;
    let version: string | undefined;
    let pid: number | undefined;

    if (installed) {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/api/status`, {
          signal: AbortSignal.timeout(3000),
        });
        const data = await res.json() as any;
        running = data.gateway_running ?? res.ok;
        version = data.version;
        pid = data.gateway_pid;
      } catch {
        running = false;
      }
    }

    return this.buildStatus(installed, running, {
      version,
      pid,
      capabilities: this.getCapabilities(),
    });
  }

  async *chat(request: EngineChatRequest): AsyncGenerator<EngineChatResponse> {
    const aiAgentRoot = getAiAgentRoot();
    const hermesDir = path.join(aiAgentRoot, 'hermes');
    const hermesCli = this.findHermesCli(hermesDir);

    if (!hermesCli) {
      yield {
        engineId: this.engineId,
        messageId: `err-${Date.now()}`,
        content: '',
        done: true,
        error: 'Hermes CLI 未找到，请先安装 Hermes 引擎',
      };
      return;
    }

    try {
      const prompt = this.buildPrompt(request);
      const result = await this.runHermesOneshot(hermesCli, prompt, request);

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
        error: `Hermes 对话失败: ${err.message}`,
      };
    }
  }

  private findHermesCli(hermesDir: string): string | null {
    const venvCli = path.join(hermesDir, 'program', '.venv', 'Scripts', 'hermes.exe');
    if (fs.existsSync(venvCli)) {
      return venvCli;
    }

    try {
      execSync('where hermes', { stdio: 'pipe', timeout: 3000 });
      return 'hermes';
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

  private async runHermesOneshot(
    hermesCli: string,
    prompt: string,
    request: EngineChatRequest
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['-z', prompt];

      // 添加模型参数（如果有）
      const model = (request as any).model;
      if (model) {
        args.push('--model', model);
      }

      const child = spawn(hermesCli, args, {
        cwd: path.dirname(hermesCli) === '' ? undefined : path.dirname(hermesCli),
        timeout: 300000,
        shell: false,
        windowsVerbatimArguments: false,
        // 不重定向 HOME / HERMES_HOME，避免锁文件冲突
        env: {
          ...process.env,
        },
      });

      let output = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout | null = null;

      // 5 分钟超时保护
      timeoutId = setTimeout(() => {
        child.kill();
        reject(new Error('Hermes 执行超时（5分钟）'));
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
          resolve(output.trim() || 'Hermes 处理完成。');
        } else {
          const errMsg = stderr.trim() || output.trim() || `Hermes 退出码 ${code}`;
          reject(new Error(errMsg));
        }
      });

      child.on('error', (err: Error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(new Error(`启动 Hermes 失败: ${err.message}`));
      });
    });
  }

  // ============ 会话管理 ============

  async listSessions(): Promise<HermesSessionInfo[]> {
    const aiAgentRoot = getAiAgentRoot();
    const hermesDir = path.join(aiAgentRoot, 'hermes');
    const hermesHome = this.findHermesHome(hermesDir);

    // 尝试从 Hermes 原生会话目录读取
    const hermesSessionsDir = path.join(hermesHome, 'sessions');
    if (fs.existsSync(hermesSessionsDir)) {
      try {
        const files = fs.readdirSync(hermesSessionsDir).filter(f => f.endsWith('.jsonl'));
        const sessions: HermesSessionInfo[] = [];

        for (const file of files) {
          try {
            const filePath = path.join(hermesSessionsDir, file);
            const stat = fs.statSync(filePath);
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.trim().split('\n').filter(Boolean);
            
            // 解析 JSONL 获取第一条和最后一条消息
            let title = '新对话';
            let messageCount = 0;
            let firstTime = stat.mtime.toISOString();

            for (const line of lines) {
              try {
                const event = JSON.parse(line);
                if (event.type === 'message' && event.message?.role === 'user') {
                  messageCount++;
                  if (title === '新对话') {
                    title = event.message.content?.[0]?.text?.slice(0, 30) || '新对话';
                  }
                }
              } catch {
                // 跳过无效行
              }
            }

            const sessionId = file.replace('.jsonl', '');
            sessions.push({
              id: sessionId,
              title,
              time: firstTime,
              messageCount,
            });
          } catch {
            // 跳过损坏的文件
          }
        }

        sessions.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        return sessions;
      } catch {
        // 读取失败，返回空列表
      }
    }

    return [];
  }

  async loadSession(sessionId: string): Promise<any | null> {
    const aiAgentRoot = getAiAgentRoot();
    const hermesDir = path.join(aiAgentRoot, 'hermes');
    const hermesHome = this.findHermesHome(hermesDir);

    const hermesSessionsDir = path.join(hermesHome, 'sessions');
    const filePath = path.join(hermesSessionsDir, `${sessionId}.jsonl`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const messages: Array<{ role: string; content: string; timestamp: string }> = [];

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.type === 'message' && event.message?.role) {
            const textContent = event.message.content
              ?.map((c: any) => c.text || '')
              .join('') || '';
            messages.push({
              role: event.message.role,
              content: textContent,
              timestamp: new Date(event.message.timestamp || Date.now()).toISOString(),
            });
          }
        } catch {
          // 跳过无效行
        }
      }

      return { id: sessionId, messages };
    } catch {
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const aiAgentRoot = getAiAgentRoot();
    const hermesDir = path.join(aiAgentRoot, 'hermes');
    const hermesHome = this.findHermesHome(hermesDir);

    const hermesSessionsDir = path.join(hermesHome, 'sessions');
    const filePath = path.join(hermesSessionsDir, `${sessionId}.jsonl`);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  // ============ 配置管理 ============

  async readConfig(): Promise<HermesConfig | null> {
    const aiAgentRoot = getAiAgentRoot();
    const hermesDir = path.join(aiAgentRoot, 'hermes');
    const hermesHome = this.findHermesHome(hermesDir);

    const configPath = path.join(hermesHome, 'config.yaml');
    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return this.parseSimpleYaml(content);
    } catch {
      return null;
    }
  }

  async writeConfig(config: HermesConfig): Promise<boolean> {
    const aiAgentRoot = getAiAgentRoot();
    const hermesDir = path.join(aiAgentRoot, 'hermes');
    const hermesHome = this.findHermesHome(hermesDir);

    try {
      // 确保目录存在
      fs.mkdirSync(hermesHome, { recursive: true });

      const configPath = path.join(hermesHome, 'config.yaml');
      const yaml = this.generateSimpleYaml(config);
      fs.writeFileSync(configPath, yaml, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  async readEnv(): Promise<Record<string, string>> {
    const aiAgentRoot = getAiAgentRoot();
    const hermesDir = path.join(aiAgentRoot, 'hermes');
    const hermesHome = this.findHermesHome(hermesDir);

    const envPath = path.join(hermesHome, '.env');
    const result: Record<string, string> = {};

    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        const lines = content.trim().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key, ...rest] = trimmed.split('=');
            result[key.trim()] = rest.join('=').trim();
          }
        }
      } catch {
        // 读取失败
      }
    }

    return result;
  }

  async writeEnv(entries: Record<string, string>): Promise<boolean> {
    const aiAgentRoot = getAiAgentRoot();
    const hermesDir = path.join(aiAgentRoot, 'hermes');
    const hermesHome = this.findHermesHome(hermesDir);

    try {
      fs.mkdirSync(hermesHome, { recursive: true });
      const envPath = path.join(hermesHome, '.env');
      const content = Object.entries(entries)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n') + '\n';
      fs.writeFileSync(envPath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  // ============ 私有方法 ============

  private findHermesHome(hermesDir: string): string {
    // 优先使用 ai-agent 目录
    const aiAgentRoot = getAiAgentRoot();
    const aiAgentHermesHome = path.join(aiAgentRoot, 'hermes', 'data');
    if (fs.existsSync(aiAgentHermesHome)) {
      return aiAgentHermesHome;
    }

    // 否则使用用户目录
    const defaultHome = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes');
    fs.mkdirSync(defaultHome, { recursive: true });
    return defaultHome;
  }

  private parseSimpleYaml(content: string): HermesConfig {
    const config: HermesConfig = {};
    const lines = content.split('\n');
    let currentSection: string | null = null;
    let currentSubSection: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        if (!trimmed) {
          currentSection = null;
          currentSubSection = null;
        }
        continue;
      }

      const indent = line.length - line.trimStart().length;

      if (indent === 0 && trimmed.endsWith(':')) {
        currentSection = trimmed.slice(0, -1).trim();
        currentSubSection = null;
      } else if (indent === 2 && trimmed.endsWith(':')) {
        currentSubSection = trimmed.slice(0, -1).trim();
      } else if (trimmed.includes(':')) {
        const colonIdx = trimmed.indexOf(':');
        const key = trimmed.slice(0, colonIdx).trim();
        let value = trimmed.slice(colonIdx + 1).trim();

        // 去除引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        if (currentSection === 'model') {
          config.model = config.model || {};
          (config.model as any)[key] = value;
        } else if (currentSection === 'agent') {
          config.agent = config.agent || {};
          (config.agent as any)[key] = key === 'max_turns' ? parseInt(value) || value : value;
        } else if (currentSection === 'terminal') {
          config.terminal = config.terminal || {};
          (config.terminal as any)[key] = value;
        } else if (currentSection === 'skills') {
          config.skills = config.skills || {};
          if (key === 'disabled') {
            config.skills.disabled = value.split(',').map(s => s.trim());
          }
        }
      }
    }

    return config;
  }

  private generateSimpleYaml(config: HermesConfig): string {
    const lines: string[] = [];

    if (config.model) {
      lines.push('model:');
      if (config.model.default) lines.push(`  default: "${config.model.default}"`);
      if (config.model.base_url) lines.push(`  base_url: "${config.model.base_url}"`);
      if (config.model.provider) lines.push(`  provider: "${config.model.provider}"`);
    }

    if (config.agent) {
      lines.push('agent:');
      if (config.agent.max_turns) lines.push(`  max_turns: ${config.agent.max_turns}`);
      if (config.agent.reasoning_effort) lines.push(`  reasoning_effort: "${config.agent.reasoning_effort}"`);
    }

    if (config.terminal) {
      lines.push('terminal:');
      if (config.terminal.env_type) lines.push(`  env_type: "${config.terminal.env_type}"`);
      if (config.terminal.cwd) lines.push(`  cwd: "${config.terminal.cwd}"`);
    }

    if (config.toolsets && config.toolsets.length > 0) {
      lines.push('toolsets:');
      for (const ts of config.toolsets) {
        lines.push(`  - ${ts}`);
      }
    }

    if (config.skills?.disabled && config.skills.disabled.length > 0) {
      lines.push('skills:');
      lines.push(`  disabled: "${config.skills.disabled.join(',')}"`);
    }

    return lines.join('\n') + '\n';
  }
}

import { ENGINES } from '@greenhorn/shared/constants';
const hermesConfig = ENGINES.find(e => e.id === 'hermes')!;
registry.register(new HermesAdapter(hermesConfig));