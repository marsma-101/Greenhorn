import { Router, Request, Response } from 'express';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

export const settingsRouter: Router = Router();

function getSettingsPath(): string {
  const dir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent');
  return path.join(dir, 'settings.json');
}

const DEFAULT_SETTINGS = {
  hideThinkingBlock: false,
  defaultThinkingLevel: 'off' as 'off' | 'low' | 'medium' | 'high',
  quietStartup: false,
  sessionDir: '~/.pi/agent/sessions',
  compaction: {
    enabled: false,
    reserveTokens: 4096,
  },
  persona: '',
};

function readSettings(): typeof DEFAULT_SETTINGS {
  try {
    const filePath = getSettingsPath();
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      return { ...DEFAULT_SETTINGS, ...data };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

function writeSettings(settings: typeof DEFAULT_SETTINGS): void {
  const dir = path.dirname(getSettingsPath());
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
}

// GET /api/settings
settingsRouter.get('/settings', (_req: Request, res: Response) => {
  try {
    const settings = readSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({ success: false, message: '读取设置失败' });
  }
});

// PUT /api/settings
settingsRouter.put('/settings', (req: Request, res: Response) => {
  try {
    const current = readSettings();
    const updated = { ...current, ...req.body };
    if (req.body.compaction) {
      updated.compaction = { ...current.compaction, ...req.body.compaction };
    }
    writeSettings(updated);
    res.json({ success: true, ...updated });
  } catch (error) {
    console.error('Error writing settings:', error);
    res.status(500).json({ success: false, message: '保存设置失败' });
  }
});
