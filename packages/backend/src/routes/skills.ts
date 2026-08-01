import { Router, Request, Response } from 'express';
import { listSkills, getSkill, createSkill, updateSkill, deleteSkill, Skill } from '../services/skill-manager';
import { scanExternalFolder, importSkillFile, checkSkillSafety, importFromUrl } from '../services/skill-scanner';

export const skillsRouter: Router = Router();

function validateSkill(body: Partial<Skill>): { valid: boolean; message?: string } {
  if (!body.name?.trim()) return { valid: false, message: '技能名称不能为空' };
  if (!body.prompt?.trim()) return { valid: false, message: '技能 Prompt 不能为空' };
  if (!body.trigger?.trim()) return { valid: false, message: '触发词不能为空（可填 alwaysOn）' };
  return { valid: true };
}

// GET /api/skills
skillsRouter.get('/skills', (req: Request, res: Response) => {
  try {
    let skills = listSkills();
    const { q } = req.query;
    if (typeof q === 'string' && q.trim()) {
      const keyword = q.toLowerCase();
      skills = skills.filter(
        s =>
          s.name.toLowerCase().includes(keyword) ||
          (s.description || '').toLowerCase().includes(keyword) ||
          s.trigger.toLowerCase().includes(keyword)
      );
    }
    res.json({ success: true, skills });
  } catch (error) {
    console.error('Error listing skills:', error);
    res.status(500).json({ success: false, message: '读取技能失败' });
  }
});

// GET /api/skills/:id
skillsRouter.get('/skills/:id', (req: Request, res: Response) => {
  try {
    const skill = getSkill(String(req.params.id));
    if (!skill) {
      res.status(404).json({ success: false, message: '技能不存在' });
      return;
    }
    res.json({ success: true, skill });
  } catch (error) {
    console.error('Error reading skill:', error);
    res.status(500).json({ success: false, message: '读取技能失败' });
  }
});

// POST /api/skills
skillsRouter.post('/skills', (req: Request, res: Response) => {
  try {
    const validation = validateSkill(req.body);
    if (!validation.valid) {
      res.status(400).json({ success: false, message: validation.message });
      return;
    }
    const skill = createSkill({
      name: req.body.name.trim(),
      description: req.body.description?.trim() || '',
      prompt: req.body.prompt,
      trigger: req.body.trigger.trim(),
      enabled: req.body.enabled !== false,
    });
    res.json({ success: true, skill });
  } catch (error) {
    console.error('Error creating skill:', error);
    res.status(500).json({ success: false, message: '创建技能失败' });
  }
});

// PUT /api/skills/:id
skillsRouter.put('/skills/:id', (req: Request, res: Response) => {
  try {
    const validation = validateSkill(req.body);
    if (!validation.valid) {
      res.status(400).json({ success: false, message: validation.message });
      return;
    }
    const updated = updateSkill(String(req.params.id), {
      name: req.body.name?.trim(),
      description: req.body.description?.trim() || '',
      prompt: req.body.prompt,
      trigger: req.body.trigger?.trim(),
      enabled: req.body.enabled,
    });
    if (!updated) {
      res.status(404).json({ success: false, message: '技能不存在' });
      return;
    }
    res.json({ success: true, skill: updated });
  } catch (error) {
    console.error('Error updating skill:', error);
    res.status(500).json({ success: false, message: '更新技能失败' });
  }
});

// DELETE /api/skills/:id
skillsRouter.delete('/skills/:id', (req: Request, res: Response) => {
  try {
    const ok = deleteSkill(String(req.params.id));
    if (!ok) {
      res.status(404).json({ success: false, message: '技能不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting skill:', error);
    res.status(500).json({ success: false, message: '删除技能失败' });
  }
});

// POST /api/skills/scan - 扫描外部文件夹
skillsRouter.post('/skills/scan', (req: Request, res: Response) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath || typeof folderPath !== 'string') {
      res.status(400).json({ success: false, message: '文件夹路径不能为空' });
      return;
    }

    const results = scanExternalFolder(folderPath);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error scanning folder:', error);
    res.status(500).json({ success: false, message: '扫描文件夹失败' });
  }
});

// POST /api/skills/import - 导入技能文件
skillsRouter.post('/skills/import', (req: Request, res: Response) => {
  try {
    const { sourcePath } = req.body;
    if (!sourcePath || typeof sourcePath !== 'string') {
      res.status(400).json({ success: false, message: '源路径不能为空' });
      return;
    }

    const skill = importSkillFile(sourcePath);
    if (!skill) {
      res.status(400).json({ success: false, message: '导入失败，文件格式不正确' });
      return;
    }

    res.json({ success: true, skill });
  } catch (error) {
    console.error('Error importing skill:', error);
    res.status(500).json({ success: false, message: '导入技能失败' });
  }
});

// POST /api/skills/check-safety - 检查技能安全性
skillsRouter.post('/skills/check-safety', (req: Request, res: Response) => {
  try {
    const result = checkSkillSafety(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error checking safety:', error);
    res.status(500).json({ success: false, message: '安全检测失败' });
  }
});

// POST /api/skills/import-url - 从 URL 导入
skillsRouter.post('/skills/import-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, message: 'URL 不能为空' });
      return;
    }

    const skill = await importFromUrl(url);
    if (!skill) {
      res.status(500).json({ success: false, message: '从 URL 导入失败' });
      return;
    }

    res.json({ success: true, skill });
  } catch (error) {
    console.error('Error importing from URL:', error);
    res.status(500).json({ success: false, message: 'URL 导入失败' });
  }
});
