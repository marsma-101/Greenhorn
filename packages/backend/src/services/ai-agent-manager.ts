/**
 * AI-Agent Manager
 * 
 * 统一管理 ai-agent 目录结构：
 * ai-agent/
 *   ├── pi/
 *   │   ├── data/
 *   │   │   ├── sessions/      # PI 原生会话
 *   │   │   ├── prompts/       # 提示词模板
 *   │   │   └── skills/        # 技能库
 *   │   └── program/           # PI 程序副本
 *   ├── hermes/
 *   │   └── ...
 *   └── ...
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import path from 'path';
import os from 'os';

export interface EngineDataPaths {
  /** 引擎根目录: ai-agent/<engine>/ */
  engineDir: string;
  /** 引擎数据目录: ai-agent/<engine>/data/ */
  dataDir: string;
  /** 会话目录: ai-agent/<engine>/data/sessions/ */
  sessionsDir: string;
  /** 提示词目录: ai-agent/<engine>/data/prompts/ */
  promptsDir: string;
  /** 技能目录: ai-agent/<engine>/data/skills/ */
  skillsDir: string;
  /** 程序目录: ai-agent/<engine>/program/ */
  programDir: string;
  /** 配置目录: ai-agent/<engine>/data/config/ */
  configDir: string;
}

export interface EngineStatusInfo {
  id: string;
  installed: boolean;
  installPath?: string;
  dataPath?: string;
  version?: string;
  canDetect: boolean;
  detectionNote?: string;
}

export interface LocationCheckResult {
  onCDrive: boolean;
  projectRoot: string;
  warning: string | null;
}

/**
 * 查找 GreenHorn 项目根目录（start.bat 所在目录）
 */
export function findGreenHornRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(path.join(dir, 'start.bat')) || existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const PROJECT_ROOT = findGreenHornRoot();

/**
 * 获取 ai-agent 根目录
 */
export function getAiAgentRoot(): string {
  const root = path.join(PROJECT_ROOT, 'ai-agent');
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  return root;
}

/**
 * 检查程序位置（是否在 C 盘）
 */
export function checkProjectLocation(): LocationCheckResult {
  const drive = path.parse(PROJECT_ROOT).root;
  const onCDrive = drive.toLowerCase().startsWith('c:');
  
  return {
    onCDrive,
    projectRoot: PROJECT_ROOT,
    warning: onCDrive
      ? '⚠️ GreenHorn 安装在 C 盘，可能导致数据空间不足。建议移动到 D/E 盘。'
      : null,
  };
}

/**
 * 获取引擎数据路径
 */
export function getEnginePaths(engineId: string): EngineDataPaths {
  const aiRoot = getAiAgentRoot();
  const engineDir = path.join(aiRoot, engineId);
  const dataDir = path.join(engineDir, 'data');
  const sessionsDir = path.join(dataDir, 'sessions');
  const promptsDir = path.join(dataDir, 'prompts');
  const skillsDir = path.join(dataDir, 'skills');
  const programDir = path.join(engineDir, 'program');
  const configDir = path.join(dataDir, 'config');

  return {
    engineDir,
    dataDir,
    sessionsDir,
    promptsDir,
    skillsDir,
    programDir,
    configDir,
  };
}

/**
 * 确保引擎目录结构存在
 */
export function ensureEngineDirs(engineId: string): EngineDataPaths {
  const paths = getEnginePaths(engineId);
  
  const dirs = [
    paths.engineDir,
    paths.dataDir,
    paths.sessionsDir,
    paths.promptsDir,
    paths.skillsDir,
    paths.programDir,
    paths.configDir,
  ];
  
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
  
  return paths;
}

/**
 * 获取所有已安装的引擎
 */
export function getInstalledEngines(): string[] {
  const aiRoot = getAiAgentRoot();
  if (!existsSync(aiRoot)) return [];
  
  return readdirSync(aiRoot).filter(name => {
    const dirPath = path.join(aiRoot, name);
    const stat = require('fs').statSync(dirPath);
    return stat.isDirectory();
  });
}

/**
 * 引擎检测配置
 */
interface EngineDetectionConfig {
  /** 引擎 ID */
  id: string;
  /** 引擎名称 */
  name: string;
  /** 可检测的安装位置（优先级从高到低） */
  installPaths: string[];
  /** 安装标记文件（任一存在即认为已安装） */
  markerFiles: string[];
  /** 检测备注 */
  note?: string;
}

const ENGINE_DETECTION_CONFIGS: EngineDetectionConfig[] = [
  {
    id: 'pi',
    name: 'PI',
    installPaths: [
      path.join(getAiAgentRoot(), 'pi', 'program'),
      process.env.PI_CODING_AGENT_DIR || '',
      path.join(os.homedir(), '.pi', 'agent'),
      path.join(os.homedir(), 'GreenHorn', 'pi-source'),
      path.join(os.homedir(), 'AppData', 'Local', 'pi', 'agent'),
    ].filter(Boolean) as string[],
    markerFiles: ['package.json', 'auth.json', 'models.json'],
  },
  {
    id: 'hermes',
    name: 'Hermes',
    installPaths: [
      path.join(getAiAgentRoot(), 'hermes', 'program'),
      path.join(os.homedir(), 'hermes'),
      path.join(os.homedir(), 'GreenHorn', 'hermes-source'),
    ],
    markerFiles: ['package.json'],
    note: 'Hermes 环境变量兼容性待验证',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    installPaths: [
      path.join(getAiAgentRoot(), 'claude-code', 'program'),
      path.join(os.homedir(), '.claude'),
    ],
    markerFiles: ['README.md', 'LICENSE.md', 'Script'],
    note: 'Claude Code 环境变量兼容性待验证',
  },
  {
    id: 'codex',
    name: 'Codex',
    installPaths: [
      path.join(getAiAgentRoot(), 'codex', 'program'),
      path.join(os.homedir(), '.codex'),
    ],
    markerFiles: ['package.json', 'README.md', 'Cargo.toml'],
    note: 'Codex 环境变量兼容性待验证',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    installPaths: [
      path.join(getAiAgentRoot(), 'opencode', 'program'),
      path.join(os.homedir(), 'opencode'),
    ],
    markerFiles: ['package.json'],
    note: 'OpenCode 环境变量兼容性待验证',
  },
  {
    id: 'reasonix',
    name: 'Reasonix',
    installPaths: [
      path.join(getAiAgentRoot(), 'reasonix', 'program'),
      path.join(os.homedir(), 'reasonix'),
    ],
    markerFiles: ['README.md', 'LICENSE', 'go.mod'],
    note: 'Reasonix 环境变量兼容性待验证',
  },
];

/**
 * 检测单个引擎的安装状态
 */
export function detectEngine(config: EngineDetectionConfig): EngineStatusInfo {
  const paths = config.installPaths.filter(p => p && p.length > 0);
  
  for (const installPath of paths) {
    for (const marker of config.markerFiles) {
      const markerPath = path.join(installPath, marker);
      if (existsSync(markerPath)) {
        let version: string | undefined;
        
        try {
          if (marker === 'package.json') {
            const pkg = JSON.parse(readFileSync(markerPath, 'utf-8'));
            version = pkg.version;
          }
        } catch {
          // ignore
        }
        
        return {
          id: config.id,
          installed: true,
          installPath,
          dataPath: getEnginePaths(config.id).dataDir,
          version,
          canDetect: true,
        };
      }
    }
  }
  
  return {
    id: config.id,
    installed: false,
    dataPath: getEnginePaths(config.id).dataDir,
    canDetect: true,
    detectionNote: config.note,
  };
}

/**
 * 检测所有引擎的安装状态
 */
export function detectAllEngines(): EngineStatusInfo[] {
  return ENGINE_DETECTION_CONFIGS.map(config => detectEngine(config));
}

/**
 * 根据 id 检测引擎
 */
export function detectEngineById(engineId: string): EngineStatusInfo | null {
  const config = ENGINE_DETECTION_CONFIGS.find(c => c.id === engineId);
  if (!config) return null;
  return detectEngine(config);
}

/**
 * 获取引擎检测配置列表
 */
export function getDetectionConfigs(): EngineDetectionConfig[] {
  return ENGINE_DETECTION_CONFIGS;
}

/**
 * cwd → 目录名映射
 */
export function cwdToDirName(cwd: string): string {
  return '--' + cwd.replace(/\\/g, '-').replace(/:/g, '-') + '--';
}

export { PROJECT_ROOT };
