/**
 * 技能扫描器
 * 扫描外部文件夹、导入技能文件、安全检测
 */
import { existsSync, readdirSync, readFileSync, copyFileSync, mkdirSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getEnginePaths } from './ai-agent-manager';
import { Skill } from './skill-manager';

export interface ScanResult {
  path: string;
  name: string;
  type: 'skill' | 'unknown';
  description?: string;
}

export interface SafetyCheckResult {
  safe: boolean;
  warnings: string[];
  hasScripts: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * 扫描外部文件夹中的技能文件
 */
export function scanExternalFolder(folderPath: string): ScanResult[] {
  const results: ScanResult[] = [];

  if (!existsSync(folderPath)) {
    return results;
  }

  try {
    const files = readdirSync(folderPath);
    
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stat = require('fs').statSync(filePath);
      
      if (stat.isDirectory()) {
        // 检查目录中是否有 skill.json
        const skillJsonPath = path.join(filePath, 'skill.json');
        if (existsSync(skillJsonPath)) {
          try {
            const data = JSON.parse(readFileSync(skillJsonPath, 'utf-8'));
            results.push({
              path: filePath,
              name: data.name || path.basename(filePath),
              type: 'skill',
              description: data.description,
            });
          } catch {
            // 忽略解析错误
          }
        }
      } else if (file.endsWith('.json') && file !== 'skill.json') {
        // 尝试解析单个 skill 文件
        try {
          const data = JSON.parse(readFileSync(filePath, 'utf-8'));
          if (data.prompt || data.trigger) {
            results.push({
              path: filePath,
              name: data.name || file.replace('.json', ''),
              type: 'skill',
              description: data.description,
            });
          }
        } catch {
          // 不是有效的 skill 文件
        }
      }
    }
  } catch {
    // 扫描失败
  }

  return results;
}

/**
 * 检查技能安全性
 */
export function checkSkillSafety(skill: Partial<Skill>): SafetyCheckResult {
  const warnings: string[] = [];
  let hasScripts = false;
  let riskLevel: 'low' | 'medium' | 'high' = 'low';

  // 检查是否包含脚本执行
  const prompt = (skill.prompt || '').toLowerCase();
  const scriptKeywords = ['shell', 'bash', 'command', 'execute', 'run', 'script', 'cmd'];
  
  for (const keyword of scriptKeywords) {
    if (prompt.includes(keyword)) {
      hasScripts = true;
      warnings.push(`技能 Prompt 中可能包含脚本执行指令（关键词: ${keyword}）`);
      break;
    }
  }

  // 检查是否有危险操作
  const dangerousKeywords = ['delete', 'remove', 'drop', 'truncate', 'rm -rf', 'format', 'shutdown'];
  for (const keyword of dangerousKeywords) {
    if (prompt.includes(keyword)) {
      warnings.push(`技能可能包含危险操作: ${keyword}`);
      riskLevel = 'high';
    }
  }

  // 检查是否有网络请求
  const networkKeywords = ['curl', 'wget', 'http://', 'https://', 'fetch', 'download'];
  for (const keyword of networkKeywords) {
    if (prompt.includes(keyword)) {
      warnings.push(`技能可能包含网络请求: ${keyword}`);
      if (riskLevel === 'low') riskLevel = 'medium';
    }
  }

  // 根据警告数量调整风险等级
  if (warnings.length >= 3) riskLevel = 'high';
  else if (warnings.length >= 1 && riskLevel === 'low') riskLevel = 'medium';

  return {
    safe: riskLevel !== 'high',
    warnings,
    hasScripts,
    riskLevel,
  };
}

/**
 * 从外部文件夹导入技能
 */
export function importSkillFile(sourcePath: string): Skill | null {
  try {
    let skillData: Partial<Skill>;

    if (existsSync(path.join(sourcePath, 'skill.json'))) {
      // 目录结构
      const data = JSON.parse(readFileSync(path.join(sourcePath, 'skill.json'), 'utf-8'));
      skillData = {
        name: data.name || path.basename(sourcePath),
        description: data.description || '',
        prompt: data.prompt || '',
        trigger: data.trigger || 'manual',
      };
    } else if (sourcePath.endsWith('.json')) {
      // 单文件
      const data = JSON.parse(readFileSync(sourcePath, 'utf-8'));
      skillData = {
        name: data.name || path.basename(sourcePath, '.json'),
        description: data.description || '',
        prompt: data.prompt || '',
        trigger: data.trigger || 'manual',
      };
    } else {
      return null;
    }

    // 保存到 ai-agent/pi/data/skills/
    const { skillsDir } = getEnginePaths('pi');
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true });
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const skill: Skill = {
      id,
      name: skillData.name || '未命名技能',
      description: skillData.description || '',
      prompt: skillData.prompt || '',
      trigger: skillData.trigger || 'manual',
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    const targetPath = path.join(skillsDir, `${id}.json`);
    require('fs').writeFileSync(targetPath, JSON.stringify(skill, null, 2), 'utf-8');

    return skill;
  } catch {
    return null;
  }
}

/**
 * 从 URL 导入技能（占位实现）
 */
export async function importFromUrl(url: string): Promise<Skill | null> {
  try {
    // 实际实现需要下载文件，这里创建一个占位技能
    const id = randomUUID();
    const now = new Date().toISOString();
    const { skillsDir } = getEnginePaths('pi');
    
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true });
    }

    const skill: Skill = {
      id,
      name: `从 ${url} 导入的技能`,
      description: `远程导入的技能`,
      prompt: `请访问 ${url} 获取技能详情`,
      trigger: 'manual',
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    const targetPath = path.join(skillsDir, `${id}.json`);
    require('fs').writeFileSync(targetPath, JSON.stringify(skill, null, 2), 'utf-8');

    return skill;
  } catch {
    return null;
  }
}
