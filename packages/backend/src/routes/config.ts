import { Router, Request, Response } from 'express';

export const configRouter: Router = Router();

// 读 PI 配置
configRouter.get('/', async (req: Request, res: Response) => {
  try {
    // TODO: 从 ~/.pi/agent/auth.json 和 models.json 读取真实配置
    // 当前返回模拟数据
    res.json({
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: '',
      baseUrl: 'https://api.deepseek.com',
      theme: 'light',
      showHelp: true,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '读取配置失败' });
  }
});

// 写 PI 配置
configRouter.put('/', async (req: Request, res: Response) => {
  try {
    const { provider, model, apiKey, baseUrl, theme, showHelp } = req.body;
    // TODO: 写入 ~/.pi/agent/auth.json 和 models.json
    // 写入 PI 的 auth.json: { "deepseek": { "apiKey": "...", "baseUrl": "..." } }
    // 写入 PI 的 models.json: { "defaultProvider": "...", "defaultModel": "..." }
    res.json({ success: true, message: '配置已保存' });
  } catch (error) {
    res.status(500).json({ success: false, message: '保存配置失败' });
  }
});