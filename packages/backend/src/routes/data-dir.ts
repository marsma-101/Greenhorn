import { Router, Request, Response } from 'express';
import { getCurrentPaths, updateDataPaths, detectOldConfig } from '../services/pi-config';

export const dataDirRouter: Router = Router();

// GET /api/data-dir - 获取当前数据目录配置
dataDirRouter.get('/', (req: Request, res: Response) => {
  const paths = getCurrentPaths();
  const oldConfig = detectOldConfig();
  res.json({
    ...paths,
    hasOldConfig: oldConfig.exists,
    oldConfigPath: oldConfig.path,
  });
});

// PUT /api/data-dir - 更新数据目录配置
dataDirRouter.put('/', (req: Request, res: Response) => {
  const { sourcePath, configPath } = req.body;
  
  if (!sourcePath || !configPath) {
    res.status(400).json({ success: false, message: '请填写完整的路径信息' });
    return;
  }
  
  updateDataPaths({ sourcePath, configPath });
  res.json({ success: true, message: '数据目录已更新' });
});