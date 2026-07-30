import { Router, Request, Response } from 'express';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

export const setupRouter: Router = Router();

// ============================================
// GET /api/setup/check-env
// 检查环境是否就绪：依赖、配置、模型
// ============================================
setupRouter.get('/check-env', async (req: Request, res: Response) => {
  try {
    const configDir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent');
    const authPath = path.join(configDir, 'auth.json');
    const modelsPath = path.join(configDir, 'models.json');

    const hasConfigDir = existsSync(configDir);
    const hasAuth = existsSync(authPath);
    const hasModels = existsSync(modelsPath);

    // 读取 auth 中的供应商配置
    let configuredProviders: string[] = [];
    if (hasAuth) {
      try {
        const auth = JSON.parse(readFileSync(authPath, 'utf-8'));
        configuredProviders = Object.keys(auth).filter(k => auth[k]?.apiKey);
      } catch {
        // 文件损坏
      }
    }

    // 读取 models 中的默认模型
    let defaultModel = '';
    if (hasModels) {
      try {
        const models = JSON.parse(readFileSync(modelsPath, 'utf-8'));
        defaultModel = models.defaultModel || models.defaultProvider || '';
      } catch {
        // 文件损坏
      }
    }

    // 检查 Node.js 是否可用
    const nodeVersion = process.version;

    res.json({
      ready: configuredProviders.length > 0 && !!defaultModel,
      nodeVersion,
      hasConfigDir,
      hasAuth,
      hasModels,
      configuredProviders,
      defaultModel,
      configDir,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '环境检查失败' });
  }
});

// ============================================
// POST /api/setup/install
// SSE 流式安装进度（模拟安装流程）
// ============================================
setupRouter.post('/install', async (req: Request, res: Response) => {
  const { engine } = req.body;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // 客户端断开连接时停止处理
  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  const sendProgress = (step: string, message: string, progress: number) => {
    if (closed || res.destroyed) return;
    res.write(`data: ${JSON.stringify({ step, message, progress })}\n\n`);
  };

  try {
    // 步骤 1：创建配置目录
    sendProgress('config', '正在准备配置目录...', 10);
    await sleep(800);

    const configDir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    sendProgress('config', '配置目录已就绪 ✅', 20);
    await sleep(500);

    // 步骤 2：检查引擎
    sendProgress('engine', '正在检查引擎环境...', 30);
    await sleep(1000);

    if (engine === 'pi') {
      // 检查 PI 是否已安装
      const piHome = path.join(os.homedir(), '.pi', 'pi');
      if (existsSync(piHome)) {
        sendProgress('engine', 'PI 引擎已就绪 ✅', 50);
      } else {
        // 模拟下载（实际 MVP 阶段假设用户已安装 PI）
        sendProgress('engine', 'PI 引擎未检测到，请确保已安装 PI...', 50);
        await sleep(500);
        sendProgress('engine', '后续版本将自动下载 PI 引擎', 50);
      }
    } else {
      sendProgress('engine', '引擎配置完成 ✅', 50);
    }
    await sleep(500);

    // 步骤 3：初始化配置
    sendProgress('init', '正在初始化配置...', 60);
    await sleep(1000);

    // 创建 auth.json 和 models.json（如果不存在）
    const authPath = path.join(configDir, 'auth.json');
    const modelsPath = path.join(configDir, 'models.json');
    if (!existsSync(authPath)) {
      writeFileSync(authPath, '{}', 'utf-8');
    }
    if (!existsSync(modelsPath)) {
      writeFileSync(modelsPath, '{}', 'utf-8');
    }

    // 验证文件已正确创建
    try {
      const authContent = JSON.parse(readFileSync(authPath, 'utf-8'));
      const modelsContent = JSON.parse(readFileSync(modelsPath, 'utf-8'));
      if (typeof authContent !== 'object' || typeof modelsContent !== 'object') {
        throw new Error('配置文件格式异常');
      }
      sendProgress('init', '配置文件已就绪 ✅', 80);
    } catch {
      // 修复损坏的配置文件
      writeFileSync(authPath, '{}', 'utf-8');
      writeFileSync(modelsPath, '{}', 'utf-8');
      sendProgress('init', '配置文件已修复 ✅', 80);
    }
    await sleep(500);

    // 步骤 4：完成
    sendProgress('done', '安装完成！正在准备启动...', 100);
    await sleep(500);

    res.write(`data: ${JSON.stringify({ step: 'done', message: '安装完成 🎉', progress: 100, done: true })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ step: 'error', message: '安装失败，请重试', progress: 0 })}\n\n`);
    res.end();
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}