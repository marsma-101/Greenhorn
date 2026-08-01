import { Router, Request, Response } from 'express';
import { registry } from '../adapters';

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
