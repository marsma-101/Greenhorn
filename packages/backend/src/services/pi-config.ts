/**
 * PI 配置服务
 * 管理 PI 的数据目录和配置读写
 * 
 * PM 需求：数据目录可自选，避免 C 盘占满
 * PI 原生支持环境变量 PI_CODING_AGENT_DIR 覆盖配置目录路径
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_PI_DIR = path.join(os.homedir(), '.pi', 'agent');
const CONFIG_FILE = 'pi-config.json';

interface PiDataPaths {
  /** PI 源码存放路径 */
  sourcePath: string;
  /** PI 配置数据存放路径 */
  configPath: string;
}

/**
 * 获取当前配置的数据目录
 */
function getPersistedPaths(): PiDataPaths | null {
  try {
    const configPath = path.join(process.cwd(), '.data', CONFIG_FILE);
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    }
  } catch {
    // 忽略
  }
  return null;
}

/**
 * 保存数据目录配置
 */
function persistPaths(paths: PiDataPaths): void {
  const dataDir = path.join(process.cwd(), '.data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  writeFileSync(path.join(dataDir, CONFIG_FILE), JSON.stringify(paths, null, 2), 'utf-8');
}

/**
 * 初始化数据目录
 * 在 GreenHorn 启动时调用，设置 PI_CODING_AGENT_DIR 环境变量
 */
export function initDataPaths(): PiDataPaths {
  const persisted = getPersistedPaths();
  
  if (persisted) {
    // 用户已配置过，注入环境变量
    if (persisted.configPath) {
      process.env.PI_CODING_AGENT_DIR = persisted.configPath;
    }
    return persisted;
  }
  
  // 默认路径
  const defaultPaths: PiDataPaths = {
    sourcePath: path.join(os.homedir(), 'GreenHorn', 'pi-source'),
    configPath: DEFAULT_PI_DIR,
  };
  
  return defaultPaths;
}

/**
 * 更新数据目录配置
 */
export function updateDataPaths(paths: PiDataPaths): void {
  persistPaths(paths);
  if (paths.configPath) {
    process.env.PI_CODING_AGENT_DIR = paths.configPath;
  }
}

/**
 * 检测 C 盘是否有旧配置
 */
export function detectOldConfig(): { exists: boolean; path: string } {
  const oldPath = DEFAULT_PI_DIR;
  return {
    exists: existsSync(oldPath),
    path: oldPath,
  };
}

/**
 * 获取当前生效的数据目录路径
 */
export function getCurrentPaths(): PiDataPaths {
  return getPersistedPaths() || {
    sourcePath: path.join(os.homedir(), 'GreenHorn', 'pi-source'),
    configPath: process.env.PI_CODING_AGENT_DIR || DEFAULT_PI_DIR,
  };
}