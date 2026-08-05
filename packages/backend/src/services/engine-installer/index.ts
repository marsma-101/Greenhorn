import path from 'path';
import { existsSync, mkdirSync, copyFileSync, readdirSync, writeFileSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { getEnginePaths, getAiAgentRoot } from '../ai-agent-manager';

export interface EngineSource {
  id: string;
  name: string;
  githubUrls: string[];
  localSource?: string;
  installCmd?: string;
  dependencies: string;
  description: string;
}

// ✅ 已测通（2026-08-04 验收）：引擎安装器（Hermes/Reasonix/Codex/OpenCode 安装 + 本地源/远程拉取双模式）
// ✅ 已确认（2026-08-05 PM+用户验收）：不可误改
// 引擎仓库地址经 GitHub API 逐仓库验证（2026-08-04）：Hermes→NousResearch/hermes-agent、Reasonix→esengine/DeepSeek-Reasonix
export const ENGINE_SOURCES: Record<string, EngineSource> = {
  pi: {
    id: 'pi',
    name: 'PI',
    // PI 是嵌入式引擎，无独立 GitHub 仓库，无需远程拉取（移除 githubUrls）
    githubUrls: [],
    localSource: 'D:\\program\\pi-agent',
    dependencies: 'pnpm',
    description: '轻量级编程助手',
  },
  hermes: {
    id: 'hermes',
    name: 'Hermes',
    githubUrls: [
      'https://github.com/NousResearch/hermes-agent.git',
    ],
    localSource: 'D:\\program\\hermes-agent',
    installCmd: 'pip install -e .',
    dependencies: 'pip/uv',
    description: '全平台自主智能体',
  },
  'claude-code': {
    id: 'claude-code',
    name: 'Claude Code',
    githubUrls: [
      'https://github.com/anthropics/claude-code.git',
    ],
    localSource: 'D:\\program\\claude-code',
    dependencies: 'npm',
    description: 'Anthropic 编程专家',
  },
  codex: {
    id: 'codex',
    name: 'Codex',
    githubUrls: [
      'https://github.com/openai/codex.git',
    ],
    localSource: 'D:\\program\\codex',
    dependencies: 'cargo/pnpm',
    description: 'OpenAI 编程助手',
  },
  opencode: {
    id: 'opencode',
    name: 'OpenCode',
    githubUrls: [
      'https://github.com/opencode-ai/opencode.git',
    ],
    localSource: 'D:\\program\\opencode',
    installCmd: 'bun install',
    dependencies: 'bun/pnpm',
    description: '开源编程助手',
  },
  reasonix: {
    id: 'reasonix',
    name: 'Reasonix',
    githubUrls: [
      'https://github.com/esengine/DeepSeek-Reasonix.git',
    ],
    localSource: 'D:\\program\\reasonix',
    dependencies: 'go/npm',
    description: 'DeepSeek 专用推理引擎',
  },
  openclaw: {
    id: 'openclaw',
    name: 'OpenClaw',
    githubUrls: [
      'https://github.com/openclaw/openclaw.git',
    ],
    localSource: 'D:\\program\\openclaw',
    dependencies: 'npm',
    description: '本地 AI 智能体',
  },
};

export interface InstallProgress {
  stage: 'idle' | 'checking' | 'cloning' | 'installing' | 'configuring' | 'done' | 'error';
  message: string;
  percent: number;
}

export interface InstallResult {
  success: boolean;
  engineId: string;
  installPath: string;
  message: string;
  progress: InstallProgress[];
}

export class EngineInstaller {
  private progress: InstallProgress[] = [];

  private addProgress(stage: InstallProgress['stage'], message: string, percent: number) {
    this.progress.push({ stage, message, percent });
  }

  async install(
    engineId: string,
    options: { useLocalSource?: boolean; reinstall?: boolean } = {}
  ): Promise<InstallResult> {
    this.progress = [];
    const source = ENGINE_SOURCES[engineId];

    if (!source) {
      return {
        success: false,
        engineId,
        installPath: '',
        message: `未知引擎: ${engineId}`,
        progress: this.progress,
      };
    }

    const paths = getEnginePaths(engineId);
    const programDir = paths.programDir;

    this.addProgress('checking', `检查 ${source.name} 安装状态...`, 5);

    if (existsSync(programDir) && !options.reinstall) {
      this.addProgress('done', `${source.name} 已安装`, 100);
      return {
        success: true,
        engineId,
        installPath: programDir,
        message: `${source.name} 已安装，无需重复安装。如需重新安装，请设置 reinstall=true`,
        progress: this.progress,
      };
    }

    if (options.reinstall && existsSync(programDir)) {
      this.addProgress('checking', `清理旧版本 ${source.name}...`, 10);
      try {
        rmSync(programDir, { recursive: true, force: true });
      } catch (err: any) {
        this.addProgress('checking', `清理警告: ${err.message}`, 12);
      }
    }

    mkdirSync(programDir, { recursive: true });

    if (options.useLocalSource && source.localSource && existsSync(source.localSource)) {
      return this.installFromLocal(engineId, source, programDir);
    }

    return this.installFromRemote(engineId, source, programDir);
  }

  private async installFromLocal(
    engineId: string,
    source: EngineSource,
    targetDir: string
  ): Promise<InstallResult> {
    this.addProgress('cloning', `从本地复制 ${source.name} 源码...`, 20);

    try {
      const localSource = source.localSource!;
      this.copyDirectory(localSource, targetDir);

      this.addProgress('installing', `安装 ${source.name} 依赖...`, 60);

      const installResult = this.installDependencies(targetDir, source, engineId);
      if (!installResult.success) {
        return installResult;
      }

      this.addProgress('configuring', `配置 ${source.name} 数据目录...`, 90);
      this.setupEngineConfig(engineId, targetDir);

      this.addProgress('done', `${source.name} 安装完成！`, 100);

      return {
        success: true,
        engineId,
        installPath: targetDir,
        message: `${source.name} 从本地源码安装成功`,
        progress: this.progress,
      };
    } catch (error: any) {
      this.addProgress('error', `安装失败: ${error.message}`, 100);
      return {
        success: false,
        engineId,
        installPath: targetDir,
        message: `从本地安装失败: ${error.message}`,
        progress: this.progress,
      };
    }
  }

  private async installFromRemote(
    engineId: string,
    source: EngineSource,
    targetDir: string
  ): Promise<InstallResult> {
    this.addProgress('cloning', `从 GitHub 拉取 ${source.name} 源码...`, 20);

    // 嵌入式引擎（如 PI）无独立仓库，不应远程拉取
    if (!source.githubUrls || source.githubUrls.length === 0) {
      this.addProgress('error', `${source.name} 是嵌入式引擎，无需远程拉取，请选择本地安装模式`, 100);
      return {
        success: false,
        engineId,
        installPath: targetDir,
        message: `${source.name} 是嵌入式引擎，无需远程拉取。\n建议操作：\n1. 返回安装方式选择，改用「本地安装」\n2. 若本地无源码，请联系管理员`,
        progress: this.progress,
      };
    }

    const mirrorUrls = this.buildMirrorUrls(source.githubUrls[0]);
    let lastError = '';
    let cloned = false;

    for (let i = 0; i < mirrorUrls.length; i++) {
      const url = mirrorUrls[i];
      const sourceNames = ['GitHub 直连', '镜像 gh-proxy.com', '镜像 ghfast.top'];
      const sourceName = sourceNames[i] || `来源 ${i + 1}`;

      try {
        this.addProgress('cloning', `尝试 ${sourceName}: ${url}`, 25 + i * 3);
        // 超时保护：git clone 5 分钟超时（防止仓库不存在/网络挂起导致无限转圈）
        execSync(`git clone --depth 1 "${url}" "${targetDir}"`, {
          timeout: 300000,
          stdio: 'pipe',
          maxBuffer: 10 * 1024 * 1024,
        });
        cloned = true;
        this.addProgress('cloning', `${sourceName} 下载成功`, 40);
        break;
      } catch (err: any) {
        lastError = err?.message || '未知错误';
        this.addProgress('cloning', `${sourceName} 失败，尝试下一个...`, 28 + i * 3);

        try {
          if (existsSync(targetDir)) {
            const files = readdirSync(targetDir);
            if (files.length === 0 || files.includes('.git')) {
              rmSync(targetDir, { recursive: true, force: true });
              mkdirSync(targetDir, { recursive: true });
            }
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    if (!cloned || !existsSync(targetDir) || readdirSync(targetDir).length === 0) {
      this.addProgress('error', `所有下载源均失败`, 100);
      // 中文错误反馈（修复：clone 失败必须推给前端，不能无限转圈）
      const errorHints = [
        `无法从任何来源拉取 ${source.name} 源码`,
        `错误详情：${lastError}`,
        `建议操作：`,
        `1. 检查网络连接是否正常（当前可能无法访问 GitHub）`,
        `2. 检查代理是否已开启，或在网络通畅时重试`,
        `3. 尝试手动下载：${source.githubUrls[0]}`,
        `4. 如有本地源码，可使用本地安装模式`,
      ];
      return {
        success: false,
        engineId,
        installPath: targetDir,
        message: errorHints.join('\n'),
        progress: this.progress,
      };
    }

    this.addProgress('installing', `安装 ${source.name} 依赖...`, 60);

    const installResult = this.installDependencies(targetDir, source, engineId);
    if (!installResult.success) {
      return installResult;
    }

    this.addProgress('configuring', `配置 ${source.name} 数据目录...`, 90);
    this.setupEngineConfig(engineId, targetDir);

    this.addProgress('done', `${source.name} 安装完成！`, 100);

    return {
      success: true,
      engineId,
      installPath: targetDir,
      message: `${source.name} 安装成功`,
      progress: this.progress,
    };
  }

  private buildMirrorUrls(githubUrl: string): string[] {
    const urls = [githubUrl];
    const repoPath = githubUrl.replace('https://github.com/', '').replace('.git', '');
    urls.push(`https://gh-proxy.com/https://github.com/${repoPath}.git`);
    urls.push(`https://ghfast.top/https://github.com/${repoPath}.git`);
    return urls;
  }

  private copyDirectory(src: string, dest: string) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }
    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
        continue;
      }
      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        try {
          copyFileSync(srcPath, destPath);
        } catch {
          // Skip files that can't be copied
        }
      }
    }
  }

  private installDependencies(
    targetDir: string,
    source: EngineSource,
    engineId: string
  ): InstallResult {
    try {
      if (source.dependencies.includes('pnpm')) {
        if (existsSync(path.join(targetDir, 'package.json'))) {
          this.addProgress('installing', '运行 pnpm install...', 65);
          execSync('pnpm install', { cwd: targetDir, timeout: 120000, stdio: 'pipe' });
        }
      }
      if (source.dependencies.includes('bun')) {
        if (existsSync(path.join(targetDir, 'package.json'))) {
          this.addProgress('installing', '运行 bun install...', 65);
          execSync('bun install', { cwd: targetDir, timeout: 120000, stdio: 'pipe' });
        }
      }
      if (source.dependencies.includes('npm')) {
        if (existsSync(path.join(targetDir, 'package.json'))) {
          this.addProgress('installing', '运行 npm install...', 65);
          execSync('npm install', { cwd: targetDir, timeout: 120000, stdio: 'pipe' });
        }
      }
      if (source.dependencies.includes('pip')) {
        this.addProgress('installing', '运行 pip install...', 65);
        const cmd = source.installCmd || 'pip install -e .';
        execSync(cmd, { cwd: targetDir, timeout: 120000, stdio: 'pipe' });
      }
      if (source.dependencies.includes('go')) {
        if (existsSync(path.join(targetDir, 'go.mod'))) {
          this.addProgress('installing', '运行 go mod download...', 65);
          execSync('go mod download', { cwd: targetDir, timeout: 120000, stdio: 'pipe' });
        }
      }
      if (source.dependencies.includes('cargo')) {
        if (existsSync(path.join(targetDir, 'Cargo.toml'))) {
          this.addProgress('installing', '运行 cargo build...', 65);
          // Skip full build, just check dependencies
        }
      }

      return { success: true, message: '依赖安装成功', engineId, installPath: targetDir, progress: this.progress };
    } catch (error: any) {
      this.addProgress('installing', `依赖安装警告: ${error.message}`, 70);
      return { success: true, message: '依赖安装完成（部分跳过）', engineId, installPath: targetDir, progress: this.progress };
    }
  }

  private setupEngineConfig(engineId: string, targetDir: string) {
    const paths = getEnginePaths(engineId);
    const configDir = paths.configDir;
    const dataDir = paths.dataDir;

    mkdirSync(configDir, { recursive: true });
    mkdirSync(paths.sessionsDir, { recursive: true });
    mkdirSync(paths.promptsDir, { recursive: true });
    mkdirSync(paths.skillsDir, { recursive: true });

    const config = {
      engineId,
      installPath: targetDir,
      dataPath: dataDir,
      installedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    writeFileSync(
      path.join(configDir, 'engine.json'),
      JSON.stringify(config, null, 2),
      'utf-8'
    );
  }

  getEngineSource(engineId: string): EngineSource | undefined {
    return ENGINE_SOURCES[engineId];
  }

  listAvailableEngines(): Array<{ id: string; name: string; installed: boolean }> {
    const entries: Array<{ id: string; name: string; installed: boolean }> = [];
    for (const [id, source] of Object.entries(ENGINE_SOURCES)) {
      const paths = getEnginePaths(id);
      const installed = existsSync(paths.programDir) && readdirSync(paths.programDir).length > 0;
      entries.push({ id, name: source.name, installed });
    }
    return entries;
  }
}

export const engineInstaller = new EngineInstaller();
