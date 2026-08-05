import { EngineAdapter, registry } from './base';
import type {
  EngineStatus,
  EngineChatRequest,
  EngineChatResponse,
  EngineDefinition,
} from '@greenhorn/shared';
import { spawn, execSync } from 'child_process';
import path from 'path';
import { mkdirSync, existsSync } from 'fs';
import { findGreenHornRoot } from '../services/ai-agent-manager';

const OPENCODE_DEFAULT_PORT = 4000;

// ✅ 已测通（2026-08-04 线 C 验收）：OpenCode v1.18 Server API（POST /session + POST /session/:id/message）
// ✅ 已确认（2026-08-05 PM+用户验收）：不可误改
// 免费模型走 OpenCode Zen（opencode/*-free），无需任何 API Key，零 Key 对话验证通过
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
      // 官方健康检查端点 /global/health（旧版 /api/health 兼容）
      const res = await fetch(`${this.baseUrl}/global/health`, {
        signal: AbortSignal.timeout(3000),
      });
      running = res.ok;
    } catch {
      try {
        const res = await fetch(`${this.baseUrl}/api/health`, {
          signal: AbortSignal.timeout(2000),
        });
        running = res.ok;
      } catch {
        running = false;
      }
    }

    return this.buildStatus(cmdInstalled, running, {
      capabilities: this.getCapabilities(),
    });
  }

  async *chat(request: EngineChatRequest): AsyncGenerator<EngineChatResponse> {
    try {
      const running = await this.ensureRunning();
      if (!running) {
        yield {
          engineId: this.engineId,
          messageId: `err-${Date.now()}`,
          content: '',
          done: true,
          error: 'OpenCode 服务未启动，且自动启动失败。请手动运行 `opencode serve --port 4000` 后重试',
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

      const model = this.resolveModel(request);

      const response = await fetch(`${this.baseUrl}/session/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parts: [{ type: 'text', text: lastUserMessage.content }],
          model,
        }),
      });

      if (!response.ok) {
        let detail = '';
        try {
          const errData = await response.json() as any;
          detail = errData.error || errData.message || JSON.stringify(errData);
        } catch {
          detail = await response.text();
        }
        yield {
          engineId: this.engineId,
          messageId: `err-${Date.now()}`,
          content: '',
          done: true,
          error: `OpenCode 返回 ${response.status}: ${detail || '未知错误'}`,
        };
        return;
      }

      const data = await response.json() as any;
      yield this.parseMessageResponse(data);
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

  private resolveModel(request: EngineChatRequest): { providerID: string; modelID: string } {
    const DEFAULT_MODEL = 'deepseek-v4-flash-free';
    const DEFAULT_PROVIDER = 'opencode';

    let raw: string | undefined = (request as any).model;
    if (!raw && this.config.defaultModel) {
      raw = this.config.defaultModel;
    }
    if (!raw) {
      return { providerID: DEFAULT_PROVIDER, modelID: DEFAULT_MODEL };
    }

    // 支持 "provider/model" 或 "model" 两种格式
    if (raw.includes('/')) {
      const [providerID, modelID] = raw.split('/');
      return { providerID: providerID || DEFAULT_PROVIDER, modelID: modelID || DEFAULT_MODEL };
    }
    return { providerID: DEFAULT_PROVIDER, modelID: raw };
  }

  private parseMessageResponse(data: any): EngineChatResponse {
    const messageId = `msg-${Date.now()}`;
    const parts: any[] = data.parts || [];
    let content = '';
    let thinking = '';
    const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];

    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      if (part.type === 'text' && typeof part.text === 'string') {
        content += part.text;
      } else if (part.type === 'reasoning' && typeof part.text === 'string') {
        thinking += part.text;
      } else if (part.type === 'tool' && part.state) {
        toolCalls.push({
          id: part.id || `tool-${Date.now()}`,
          name: part.state.title || part.tool || 'unknown',
          arguments: part.state.input || {},
        });
      }
    }

    const done = data.info?.finish === 'stop' || data.info?.finish === 'length' || parts.length > 0;

    return {
      engineId: this.engineId,
      messageId,
      content,
      thinking: thinking || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      done: true,
    };
  }

  private async createSession(): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/session`, {
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

  /**
   * 确保 OpenCode serve 在运行；未运行时尝试自动启动
   */
  private async ensureRunning(): Promise<boolean> {
    if (await this.checkRunning()) {
      return true;
    }

    // 未定位到 opencode 可执行文件则无法自动启动
    if (!this.resolveOpenCodeExecutable()) {
      return false;
    }

    try {
      if (!this.spawnServe()) {
        return false;
      }
      // 等待服务就绪（最多 30 秒，首次启动需初始化 DB）
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        if (await this.checkRunning()) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 定位 opencode 真实可执行文件（原生 exe），绕开 Windows 下 npm 的 .cmd shim
   * shim 用 shell:true 启动时路径会被截断（如报 `'oaming' 不是内部或外部命令`），
   * 因此直接定位 npm 全局包里的 opencode.exe，用 shell:false 启动。
   * 找不到时返回 null（表示未安装，无法自动启动）。
   */
  private resolveOpenCodeExecutable(): string | null {
    // a. npm 全局前缀（默认 C:\Users\<用户>\AppData\Roaming\npm）下的真实包路径
    const appdata = process.env.APPDATA;
    if (appdata) {
      const globalExe = path.join(
        appdata,
        'npm',
        'node_modules',
        'opencode-ai',
        'bin',
        'opencode.exe'
      );
      if (existsSync(globalExe)) {
        return globalExe;
      }
    }

    // b. 通过 `where opencode` 拿到 shim 路径，取其目录（npm 全局 bin 目录）反推真实包路径
    try {
      const whereOut = execSync('where opencode', { encoding: 'utf8' }).toString();
      const firstLine = whereOut.split(/\r?\n/)[0]?.trim();
      if (firstLine) {
        const shimDir = path.dirname(firstLine);
        const exeFromShim = path.join(
          shimDir,
          '..',
          'node_modules',
          'opencode-ai',
          'bin',
          'opencode.exe'
        );
        if (existsSync(exeFromShim)) {
          return exeFromShim;
        }
      }
    } catch {
      // where 命令失败（如 opencode 未安装），静默忽略，继续后续候选
    }

    // c. 项目内相对路径（本地开发时安装在工作区 node_modules）
    const localExe = path.join(
      process.cwd(),
      'node_modules',
      'opencode-ai',
      'bin',
      'opencode.exe'
    );
    if (existsSync(localExe)) {
      return localExe;
    }

    // d. 所有候选都不存在
    return null;
  }

  /**
   * 后台启动 opencode serve，XDG 目录重定向到 GreenHorn 项目内（避免 Bun 在 ~/.local 符号链接路径上的 EPERM 问题）
   * @returns 是否成功发起 spawn（exe 未找到或 spawn 失败返回 false）
   */
  private spawnServe(): boolean {
    const exe = this.resolveOpenCodeExecutable();
    if (!exe) {
      console.error('[GreenHorn] 未找到 opencode 可执行文件（opencode-ai/bin/opencode.exe），无法自动启动 serve');
      return false;
    }

    const root = findGreenHornRoot();
    const xdgBase = path.join(root, '.opencode');
    mkdirSync(path.join(xdgBase, 'data'), { recursive: true });
    mkdirSync(path.join(xdgBase, 'state'), { recursive: true });
    mkdirSync(path.join(xdgBase, 'config'), { recursive: true });

    // 直接启动真实 exe（原生可执行文件，无需 node 运行），shell:false 绕开 .cmd shim 的路径截断问题
    const child = spawn(
      exe,
      ['serve', '--port', String(this.port)],
      {
        detached: true,
        shell: false,
        stdio: 'ignore',
        env: {
          ...process.env,
          XDG_DATA_HOME: path.join(xdgBase, 'data'),
          XDG_STATE_HOME: path.join(xdgBase, 'state'),
          XDG_CONFIG_HOME: path.join(xdgBase, 'config'),
        },
        windowsHide: true,
      }
    );
    child.on('error', (err) => {
      console.error(`[GreenHorn] OpenCode serve 自动启动失败: ${err.message}`);
    });
    child.unref();
    return true;
  }

  private async checkRunning(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/global/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

import { ENGINES } from '@greenhorn/shared/constants';
const opencodeConfig = ENGINES.find(e => e.id === 'opencode')!;
registry.register(new OpenCodeAdapter(opencodeConfig));
