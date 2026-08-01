import { Router, Request, Response } from 'express';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listCategories,
  PromptTemplate,
} from '../services/template-manager';

export const templatesRouter: Router = Router();

function validateTemplate(body: Partial<PromptTemplate>): { valid: boolean; message?: string } {
  if (!body.name?.trim()) return { valid: false, message: '模板名称不能为空' };
  if (!body.category?.trim()) return { valid: false, message: '模板分类不能为空' };
  if (!body.content?.trim()) return { valid: false, message: '模板内容不能为空' };
  return { valid: true };
}

// GET /api/templates
// GET /api/templates?category=xxx&q=search
templatesRouter.get('/templates', (req: Request, res: Response) => {
  try {
    let templates = listTemplates();
    const { category, q } = req.query;
    if (typeof category === 'string' && category.trim()) {
      templates = templates.filter(t => t.category.toLowerCase() === category.toLowerCase());
    }
    if (typeof q === 'string' && q.trim()) {
      const keyword = q.toLowerCase();
      templates = templates.filter(
        t =>
          t.name.toLowerCase().includes(keyword) ||
          (t.description || '').toLowerCase().includes(keyword) ||
          t.content.toLowerCase().includes(keyword)
      );
    }
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({ success: false, message: '读取模板失败' });
  }
});

// GET /api/templates/categories
templatesRouter.get('/templates/categories', (_req: Request, res: Response) => {
  try {
    res.json({ success: true, categories: listCategories() });
  } catch (error) {
    console.error('Error listing categories:', error);
    res.status(500).json({ success: false, message: '读取分类失败' });
  }
});

// GET /api/templates/:id
templatesRouter.get('/templates/:id', (req: Request, res: Response) => {
  try {
    const template = getTemplate(String(req.params.id));
    if (!template) {
      res.status(404).json({ success: false, message: '模板不存在' });
      return;
    }
    res.json({ success: true, template });
  } catch (error) {
    console.error('Error reading template:', error);
    res.status(500).json({ success: false, message: '读取模板失败' });
  }
});

// POST /api/templates
templatesRouter.post('/templates', (req: Request, res: Response) => {
  try {
    const validation = validateTemplate(req.body);
    if (!validation.valid) {
      res.status(400).json({ success: false, message: validation.message });
      return;
    }
    const template = createTemplate({
      name: req.body.name.trim(),
      category: req.body.category.trim(),
      content: req.body.content,
      description: req.body.description?.trim() || '',
    });
    res.json({ success: true, template });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, message: '创建模板失败' });
  }
});

// PUT /api/templates/:id
templatesRouter.put('/templates/:id', (req: Request, res: Response) => {
  try {
    const validation = validateTemplate(req.body);
    if (!validation.valid) {
      res.status(400).json({ success: false, message: validation.message });
      return;
    }
    const updated = updateTemplate(String(req.params.id), {
      name: req.body.name?.trim(),
      category: req.body.category?.trim(),
      content: req.body.content,
      description: req.body.description?.trim() || '',
    });
    if (!updated) {
      res.status(404).json({ success: false, message: '模板不存在' });
      return;
    }
    res.json({ success: true, template: updated });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ success: false, message: '更新模板失败' });
  }
});

// DELETE /api/templates/:id
templatesRouter.delete('/templates/:id', (req: Request, res: Response) => {
  try {
    const ok = deleteTemplate(String(req.params.id));
    if (!ok) {
      res.status(404).json({ success: false, message: '模板不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, message: '删除模板失败' });
  }
});
