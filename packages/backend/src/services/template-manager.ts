/**
 * Prompt 模板管理服务
 * 数据持久化到 ai-agent/<engine>/data/prompts/ 目录
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getEnginePaths } from './ai-agent-manager';

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

function getPromptsDir(): string {
  const { promptsDir } = getEnginePaths('pi');
  if (!existsSync(promptsDir)) {
    mkdirSync(promptsDir, { recursive: true });
  }
  return promptsDir;
}

function templatePath(id: string): string {
  return path.join(getPromptsDir(), `${id}.json`);
}

export function listTemplates(): PromptTemplate[] {
  const dir = getPromptsDir();
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const raw = readFileSync(path.join(dir, f), 'utf-8');
          return JSON.parse(raw) as PromptTemplate;
        } catch {
          return null;
        }
      })
      .filter((t): t is PromptTemplate => t !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

export function getTemplate(id: string): PromptTemplate | null {
  try {
    const raw = readFileSync(templatePath(id), 'utf-8');
    return JSON.parse(raw) as PromptTemplate;
  } catch {
    return null;
  }
}

export function createTemplate(payload: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>): PromptTemplate {
  const now = new Date().toISOString();
  const template: PromptTemplate = {
    id: randomUUID(),
    ...payload,
    createdAt: now,
    updatedAt: now,
  };
  writeFileSync(templatePath(template.id), JSON.stringify(template, null, 2), 'utf-8');
  return template;
}

export function updateTemplate(id: string, payload: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>): PromptTemplate | null {
  const existing = getTemplate(id);
  if (!existing) return null;
  const updated: PromptTemplate = {
    ...existing,
    ...payload,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(templatePath(id), JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

export function deleteTemplate(id: string): boolean {
  try {
    unlinkSync(templatePath(id));
    return true;
  } catch {
    return false;
  }
}

export function listCategories(): string[] {
  const templates = listTemplates();
  const categories = new Set<string>();
  templates.forEach(t => {
    if (t.category?.trim()) categories.add(t.category.trim());
  });
  return Array.from(categories).sort();
}
