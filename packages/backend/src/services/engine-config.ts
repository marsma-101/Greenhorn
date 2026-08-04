import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

export interface EngineConfig {
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
  persona?: string;
  provider?: string;
  engineSpecific?: Record<string, any>;
}

export interface EngineConfigs {
  [engineId: string]: EngineConfig;
}

function getConfigDir(): string {
  const dir = process.env.GREENHORN_CONFIG_DIR ||
    path.join(os.homedir(), '.greenhorn');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getConfigPath(): string {
  return path.join(getConfigDir(), 'engine-configs.json');
}

function readAll(): EngineConfigs {
  try {
    const p = getConfigPath();
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return {};
}

function writeAll(configs: EngineConfigs): void {
  writeFileSync(getConfigPath(), JSON.stringify(configs, null, 2), 'utf-8');
}

export function readEngineConfig(engineId: string): EngineConfig {
  const all = readAll();
  return all[engineId] || {};
}

export function writeEngineConfig(engineId: string, config: EngineConfig): void {
  const all = readAll();
  all[engineId] = { ...all[engineId], ...config };
  writeAll(all);
}

export function readAllEngineConfigs(): EngineConfigs {
  return readAll();
}