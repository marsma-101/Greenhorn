import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { chatRouter } from './routes/chat';
import { configRouter } from './routes/config';
import { verifyRouter } from './routes/verify';
import { modelProvidersRouter } from './routes/model-providers';
import { piCheckRouter } from './routes/pi-check';
import { dataDirRouter } from './routes/data-dir';
import { ollamaRouter } from './routes/ollama';
import { errorHandler } from './middleware/errorHandler';
import { initDataPaths } from './services/pi-config';
import { DEFAULT_PORT } from '@greenhorn/shared/constants';

const app: Express = express();
const PORT = process.env.PORT || DEFAULT_PORT;

// 初始化数据目录（启动时设置 PI_CODING_AGENT_DIR）
initDataPaths();

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

// 生产环境下 serve 前端静态文件
if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 错误处理
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ GreenHorn 后端服务已启动: http://localhost:${PORT}`);
});

export default app;