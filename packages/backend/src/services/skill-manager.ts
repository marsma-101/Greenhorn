/**
 * Skill 技能管理服务
 * 数据持久化到 ai-agent/<engine>/data/skills/ 目录
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getEnginePaths } from './ai-agent-manager';

export interface Skill {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  trigger: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function getSkillsDir(): string {
  const { skillsDir } = getEnginePaths('pi');
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
  }
  return skillsDir;
}

function skillPath(id: string): string {
  return path.join(getSkillsDir(), `${id}.json`);
}

export function listSkills(): Skill[] {
  const dir = getSkillsDir();
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const raw = readFileSync(path.join(dir, f), 'utf-8');
          return JSON.parse(raw) as Skill;
        } catch {
          return null;
        }
      })
      .filter((s): s is Skill => s !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

export function getSkill(id: string): Skill | null {
  try {
    const raw = readFileSync(skillPath(id), 'utf-8');
    return JSON.parse(raw) as Skill;
  } catch {
    return null;
  }
}

export function createSkill(payload: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>): Skill {
  const now = new Date().toISOString();
  const skill: Skill = {
    id: randomUUID(),
    ...payload,
    createdAt: now,
    updatedAt: now,
  };
  writeFileSync(skillPath(skill.id), JSON.stringify(skill, null, 2), 'utf-8');
  return skill;
}

export function updateSkill(id: string, payload: Partial<Omit<Skill, 'id' | 'createdAt'>>): Skill | null {
  const existing = getSkill(id);
  if (!existing) return null;
  const updated: Skill = {
    ...existing,
    ...payload,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(skillPath(id), JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

export function deleteSkill(id: string): boolean {
  try {
    unlinkSync(skillPath(id));
    return true;
  } catch {
    return false;
  }
}
