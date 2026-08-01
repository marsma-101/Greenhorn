import { Router, Request, Response } from 'express';
import { existsSync } from 'fs';
import { detectAllEngines, detectEngineById, checkProjectLocation, ensureEngineDirs, getEnginePaths, getAiAgentRoot } from '../services/ai-agent-manager';
import { engineInstaller, ENGINE_SOURCES } from '../services/engine-installer';

export const enginesRouter: Router = Router();

// GET /api/engines/status - 获取所有引擎状态
enginesRouter.get('/status', (_req: Request, res: Response) => {
  try {
    const engines = detectAllEngines();
    const location = checkProjectLocation();
    
    res.json({
      engines: engines.map(e => ({
        id: e.id,
        installed: e.installed,
        installPath: e.installPath,
        dataPath: e.dataPath,
        version: e.version,
        canDetect: e.canDetect,
        detectionNote: e.detectionNote,
      })),
      location: {
        onCDrive: location.onCDrive,
        projectRoot: location.projectRoot,
        warning: location.warning,
      },
      aiAgentRoot: getAiAgentRoot(),
    });
  } catch (error) {
    console.error('Error detecting engines:', error);
    res.status(500).json({ success: false, message: '获取引擎状态失败' });
  }
});

// GET /api/engines/status/:id - 获取单个引擎状态
enginesRouter.get('/status/:id', (req: Request, res: Response) => {
  try {
    const engineId = String(req.params.id);
    const status = detectEngineById(engineId);
    
    if (!status) {
      return res.status(404).json({ success: false, message: `引擎 ${engineId} 不存在` });
    }
    
    res.json({
      id: status.id,
      installed: status.installed,
      installPath: status.installPath,
      dataPath: status.dataPath,
      version: status.version,
      canDetect: status.canDetect,
      detectionNote: status.detectionNote,
    });
  } catch (error) {
    console.error('Error detecting engine:', error);
    res.status(500).json({ success: false, message: '获取引擎状态失败' });
  }
});

// POST /api/engines/:id/init - 初始化引擎目录结构
enginesRouter.post('/:id/init', (req: Request, res: Response) => {
  try {
    const engineId = String(req.params.id);
    const paths = ensureEngineDirs(engineId);
    
    res.json({
      success: true,
      engineId,
      paths: {
        engineDir: paths.engineDir,
        dataDir: paths.dataDir,
        sessionsDir: paths.sessionsDir,
        promptsDir: paths.promptsDir,
        skillsDir: paths.skillsDir,
        programDir: paths.programDir,
        configDir: paths.configDir,
      },
    });
  } catch (error) {
    console.error('Error initializing engine:', error);
    res.status(500).json({ success: false, message: '初始化引擎目录失败' });
  }
});

// GET /api/engines/:id/paths - 获取引擎路径
enginesRouter.get('/:id/paths', (req: Request, res: Response) => {
  try {
    const engineId = String(req.params.id);
    const paths = getEnginePaths(engineId);
    
    res.json({
      success: true,
      engineId,
      paths: {
        engineDir: paths.engineDir,
        dataDir: paths.dataDir,
        sessionsDir: paths.sessionsDir,
        promptsDir: paths.promptsDir,
        skillsDir: paths.skillsDir,
        programDir: paths.programDir,
        configDir: paths.configDir,
      },
    });
  } catch (error) {
    console.error('Error getting engine paths:', error);
    res.status(500).json({ success: false, message: '获取引擎路径失败' });
  }
});

// GET /api/engines/location - 获取程序位置检查结果
enginesRouter.get('/location', (_req: Request, res: Response) => {
  try {
    const location = checkProjectLocation();
    res.json(location);
  } catch (error) {
    console.error('Error checking location:', error);
    res.status(500).json({ success: false, message: '检查位置失败' });
  }
});

// GET /api/engines/ai-agent-root - 获取 ai-agent 根目录
enginesRouter.get('/ai-agent-root', (_req: Request, res: Response) => {
  try {
    res.json({ root: getAiAgentRoot() });
  } catch (error) {
    console.error('Error getting ai-agent root:', error);
    res.status(500).json({ success: false, message: '获取 ai-agent 根目录失败' });
  }
});

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
  } catch (error) {
    console.error('Error getting engine sources:', error);
    res.status(500).json({ success: false, message: '获取引擎源列表失败' });
  }
});

// GET /api/engines/list - 获取引擎安装列表
enginesRouter.get('/list', (_req: Request, res: Response) => {
  try {
    const engines = engineInstaller.listAvailableEngines();
    res.json({ success: true, engines });
  } catch (error) {
    console.error('Error listing engines:', error);
    res.status(500).json({ success: false, message: '获取引擎列表失败' });
  }
});

// POST /api/engines/:id/install - 安装引擎
enginesRouter.post('/:id/install', async (req: Request, res: Response) => {
  try {
    const engineId = String(req.params.id);
    const { useLocalSource, reinstall } = req.body || {};

    const source = ENGINE_SOURCES[engineId];
    if (!source) {
      return res.status(404).json({
        success: false,
        message: `未知引擎: ${engineId}`,
      });
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

// GET /api/engines/:id/source - 获取引擎源信息
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
      },
    });
  } catch (error) {
    console.error('Error getting engine source:', error);
    res.status(500).json({ success: false, message: '获取引擎源信息失败' });
  }
});
