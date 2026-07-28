import { Router, Request, Response } from 'express';

export const piCheckRouter: Router = Router();

// GET /api/pi/check - 检测本机 PI 是否已安装
piCheckRouter.get('/', async (req: Request, res: Response) => {
  try {
    // TODO: 实际检测 PI 是否存在
    // 1. 检查环境变量 PI_PATH 或默认路径 ~/.pi/agent/
    // 2. 检查目录是否存在
    // 3. 检查 package.json 确认版本
    // 当前返回模拟数据
    res.json({ installed: true, path: '~/.pi/agent', version: '0.1.0' });
  } catch (error) {
    res.json({ installed: false, path: undefined, version: undefined });
  }
});