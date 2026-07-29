import { Router, Request, Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';

export const piCheckRouter: Router = Router();

// PI 可能的安装路径
function getPiPaths(): string[] {
  const homeDir = os.homedir();
  return [
    // 环境变量指定路径
    process.env.PI_CODING_AGENT_DIR,
    // 默认路径
    path.join(homeDir, '.pi', 'agent'),
    path.join(homeDir, 'GreenHorn', 'pi-source'),
    // Windows 常见路径
    path.join(homeDir, 'AppData', 'Local', 'pi', 'agent'),
  ].filter(Boolean) as string[];
}

// GET /api/pi/check - 检测本机 PI 是否已安装
piCheckRouter.get('/', async (req: Request, res: Response) => {
  const paths = getPiPaths();
  
  for (const piPath of paths) {
    // 检查 package.json（PI 项目根目录标记）
    const pkgPath = path.join(piPath, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name?.includes('pi') || pkg.name?.includes('coding-agent')) {
          res.json({
            installed: true,
            path: piPath,
            version: pkg.version || 'unknown',
          });
          return;
        }
      } catch {
        // 忽略解析错误
      }
    }
    
    // 检查 auth.json 或 models.json（PI 配置目录标记）
    const authPath = path.join(piPath, 'auth.json');
    const modelsPath = path.join(piPath, 'models.json');
    if (existsSync(authPath) || existsSync(modelsPath)) {
      res.json({
        installed: true,
        path: piPath,
        version: 'unknown',
      });
      return;
    }
  }
  
  // 未找到
  res.json({ installed: false });
});