/**
 * 密钥统一管理（Key Vault）
 * 将各模型供应商的 API Key 集中存储在本地文件（~/.greenhorn/keyvault.json）
 * 该目录位于用户主目录，天然不会进入 git 仓库，避免密钥泄露
 */
// ✅ 已确认（2026-08-05 PM+用户验收）：不可误改
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

/** 单个供应商的密钥记录 */
export interface KeyEntry {
  apiKey: string;
  updatedAt: string;
}

/** 密钥库结构：providerId -> 密钥记录 */
export interface KeyVault {
  [providerId: string]: KeyEntry;
}

/** 配置文件所在目录：与 engine-configs 保持一致 */
function getConfigDir(): string {
  return process.env.GREENHORN_CONFIG_DIR ||
    path.join(os.homedir(), '.greenhorn');
}

function getKeyVaultPath(): string {
  return path.join(getConfigDir(), 'keyvault.json');
}

/** 读取密钥库，异常时静默返回空对象 */
function readAll(): KeyVault {
  try {
    const p = getKeyVaultPath();
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf-8')) as KeyVault;
    }
  } catch {
    // 读取异常（文件损坏等）静默忽略
  }
  return {};
}

function writeAll(vault: KeyVault): void {
  const dir = getConfigDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(getKeyVaultPath(), JSON.stringify(vault, null, 2), 'utf-8');
}

/** 读取指定供应商的 API Key，无则返回 null */
export function getKey(providerId: string): string | null {
  const entry = readAll()[providerId];
  return entry && entry.apiKey ? entry.apiKey : null;
}

/** 写入指定供应商的 API Key（空字符串视为删除） */
export function setKey(providerId: string, apiKey: string): void {
  const vault = readAll();
  if (!apiKey) {
    // 空字符串视为删除
    delete vault[providerId];
  } else {
    vault[providerId] = { apiKey, updatedAt: new Date().toISOString() };
  }
  writeAll(vault);
}

/** 删除指定供应商的密钥 */
export function deleteKey(providerId: string): void {
  const vault = readAll();
  if (vault[providerId]) {
    delete vault[providerId];
    writeAll(vault);
  }
}

/** 返回密钥库的全部内容 */
export function listKeys(): KeyVault {
  return readAll();
}

/** 密钥脱敏：长度 > 6 时显示 前3字符 + '***' + 后4字符，否则只显示 '***' */
export function maskKey(apiKey: string): string {
  if (!apiKey) return '***';
  if (apiKey.length > 6) {
    return apiKey.slice(0, 3) + '***' + apiKey.slice(-4);
  }
  return '***';
}
