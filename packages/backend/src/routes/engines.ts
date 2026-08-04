import { Router, Request, Response } from 'express';
import { existsSync } from 'fs';
import { registry } from '../adapters';
import { readEngineConfig, writeEngineConfig, type EngineConfig } from '../services/engine-config';
import { engineInstaller, ENGINE_SOURCES } from '../services/engine-installer';

export const enginesRouter: Router = Router();

enginesRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const statuses = await registry.getAllStatuses();
    res.json({ engines: statuses });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

enginesRouter.get('/:engineId/status', async (req: Request, res: Response) => {
  try {
    const engineId = String(req.params.engineId);
    const adapter = registry.get(engineId);
    if (!adapter) {
      return res.status(404).json({ error: `Engine ${engineId} not found` });
    }
    const status = await adapter.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

enginesRouter.get('/:engineId/config', async (req: Request, res: Response) => {
  try {
    const engineId = String(req.params.engineId);
    const adapter = registry.get(engineId);
    if (!adapter) {
      return res.status(404).json({ error: `Engine ${engineId} not found` });
    }
    const config = readEngineConfig(engineId);
    res.json({ engineId, config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

enginesRouter.put('/:engineId/config', async (req: Request, res: Response) => {
  try {
    const engineId = String(req.params.engineId);
    const adapter = registry.get(engineId);
    if (!adapter) {
      return res.status(404).json({ error: `Engine ${engineId} not found` });
    }
    const config: EngineConfig = req.body.config || req.body;
    writeEngineConfig(engineId, config);
    res.json({ success: true, engineId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

enginesRouter.get('/:engineId/sessions', async (req: Request, res: Response) => {
  try {
    const engineId = String(req.params.engineId);
    const adapter = registry.get(engineId);
    if (!adapter) {
      return res.status(404).json({ error: `Engine ${engineId} not found` });
    }
    const sessions = await (adapter as any).listSessions?.() || [];
    res.json({ engineId, sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

enginesRouter.get('/:engineId/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const engineId = String(req.params.engineId);
    const sessionId = String(req.params.sessionId);
    const adapter = registry.get(engineId);
    if (!adapter) {
      return res.status(404).json({ error: `Engine ${engineId} not found` });
    }
    const session = await (adapter as any).loadSession?.(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ engineId, session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

enginesRouter.delete('/:engineId/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const engineId = String(req.params.engineId);
    const sessionId = String(req.params.sessionId);
    const adapter = registry.get(engineId);
    if (!adapter) {
      return res.status(404).json({ error: `Engine ${engineId} not found` });
    }
    const success = await (adapter as any).deleteSession?.(sessionId);
    res.json({ success: !!success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

enginesRouter.post('/:engineId/chat', async (req: Request, res: Response) => {
  try {
    const engineId = String(req.params.engineId);
    const adapter = registry.get(engineId);
    if (!adapter) {
      return res.status(404).json({ error: `Engine ${engineId} not found` });
    }

    const { messages, systemPrompt, temperature, maxTokens, sessionId, stream = true } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const generator = adapter.chat({
      engineId,
      messages,
      systemPrompt,
      temperature,
      maxTokens,
      stream,
      sessionId,
    });

    for await (const response of generator) {
      if (res.destroyed) break;

      if (response.error) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: response.error })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', reason: 'error' })}\n\n`);
        break;
      }

      if (response.thinking) {
        res.write(`data: ${JSON.stringify({ type: 'thinking', content: response.thinking })}\n\n`);
      }

      if (response.content) {
        res.write(`data: ${JSON.stringify({ type: 'text', content: response.content })}\n\n`);
      }

      if (response.done) {
        res.write(`data: ${JSON.stringify({ type: 'done', reason: 'complete' })}\n\n`);
        break;
      }
    }

    if (!res.destroyed) {
      res.end();
    }
  } catch (err: any) {
    if (!res.destroyed) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', reason: 'error' })}\n\n`);
      res.end();
    }
  }
});

enginesRouter.get('/', (_req: Request, res: Response) => {
  const engines = registry.getAll().map(a => ({
    id: a.engineId,
    name: a.name,
    description: a.description,
    capabilities: a.getCapabilities(),
  }));
  res.json({ engines });
});

// ✅ 已测通（2026-08-04 验收）：引擎安装 API（安装向导 UI 调用 /source 获取源信息、/install 发起安装）
// ⚠️ 注意：以下路由曾在 41cecf7 重写 engines.ts 时被误删，导致安装功能 404 转圈，本次已恢复（回归测试通过）

// GET /api/engines/sources - 获取所有引擎源信息
enginesRouter.get('/sources', (_req: Request, res: Response) => {
  try {
    const sources = Object.values(ENGINE_SOURCES).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      dependencies: s.dependencies,
      localSource: s.localSource || null,
      githubUrls: s.githubUrls,
      hasLocal: !!(s.localSource && existsSync(s.localSource)),
    }));
    res.json({ success: true, sources });
  } catch (error: any) {
    console.error('Error getting engine sources:', error);
    res.status(500).json({ success: false, message: '获取引擎源列表失败' });
  }
});

// GET /api/engines/:id/source - 获取引擎源信息（安装向导前置调用）
enginesRouter.get('/:id/source', (req: Request, res: Response) => {
  try {
    const engineId = String(req.params.id);
    const source = engineInstaller.getEngineSource(engineId);

    if (!source) {
      return res.status(404).json({ success: false, message: `未知引擎: ${engineId}` });
    }

    res.json({
      success: true,
      source: {
        id: source.id,
        name: source.name,
        description: source.description,
        githubUrls: source.githubUrls,
        localSource: source.localSource || null,
        dependencies: source.dependencies,
        hasLocal: !!(source.localSource && existsSync(source.localSource)),
      },
    });
  } catch (error: any) {
    console.error('Error getting engine source:', error);
    res.status(500).json({ success: false, message: '获取引擎源信息失败' });
  }
});

// POST /api/engines/:id/install - 安装引擎
enginesRouter.post('/:id/install', async (req: Request, res: Response) => {
  try {
    const engineId = String(req.params.id);
    const { useLocalSource, reinstall } = req.body || {};

    const source = ENGINE_SOURCES[engineId];
    if (!source) {
      return res.status(404).json({ success: false, message: `未知引擎: ${engineId}` });
    }

    const result = await engineInstaller.install(engineId, {
      useLocalSource: useLocalSource ?? true,
      reinstall: reinstall ?? false,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error installing engine:', error);
    res.status(500).json({
      success: false,
      message: `安装引擎失败: ${error.message}`,
    });
  }
});