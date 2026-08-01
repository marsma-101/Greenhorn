import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import { existsSync } from 'fs';
import { chatRouter } from './routes/chat';
import { configRouter } from './routes/config';
import { verifyRouter } from './routes/verify';
import { modelProvidersRouter } from './routes/model-providers';
import { piCheckRouter } from './routes/pi-check';
import { dataDirRouter } from './routes/data-dir';
import { ollamaRouter } from './routes/ollama';
import { setupRouter } from './routes/setup';
import { sessionsRouter } from './routes/sessions';
import { settingsRouter } from './routes/settings';
import { templatesRouter } from './routes/templates';
import { skillsRouter } from './routes/skills';
import { enginesRouter } from './routes/engines';
import { errorHandler } from './middleware/errorHandler';
import { initDataPaths } from './services/pi-config';
import { DEFAULT_PORT } from '@greenhorn/shared/constants';
import { getAiAgentRoot, ensureEngineDirs } from './services/ai-agent-manager';

const app: Express = express();
const PORT = process.env.PORT || DEFAULT_PORT;

// 初始化数据目录（启动时设置 PI_CODING_AGENT_DIR）
initDataPaths();

// 初始化 ai-agent 目录结构
const aiAgentRoot = getAiAgentRoot();
console.log(`[GreenHorn] AI-Agent 根目录: ${aiAgentRoot}`);

// 中间件（必须在路由之前）
app.use(cors());
app.use(express.json());

// API 路由
app.use('/api/chat', chatRouter);
app.use('/api/config', configRouter);
app.use('/api/config', verifyRouter);
app.use('/api/model-providers', modelProvidersRouter);
app.use('/api/pi', piCheckRouter);
app.use('/api/data-dir', dataDirRouter);
app.use('/api/ollama', ollamaRouter);
app.use('/api/setup', setupRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/engines', enginesRouter);
app.use('/api', settingsRouter);
app.use('/api', templatesRouter);
app.use('/api', skillsRouter);

// serve 前端静态文件（如果已编译）
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// SPA fallback: 所有非 API 路由返回 index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return;
  const indexHtml = path.join(frontendDist, 'index.html');
  if (existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  }
});

// 错误处理
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ GreenHorn 后端服务已启动: http://localhost:${PORT}`);
});

export default app;