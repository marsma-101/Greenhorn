/**
 * 模型供应商预设配置
 * MVP 阶段硬编码，后续版本支持从配置文件覆盖
 * 
 * 数据来源：PM 提供（2026-07-28）
 */
import { Router, Request, Response } from 'express';

interface Model {
  id: string;
  name: string;
  description: string;
  features: string[];
}

interface ModelProvider {
  id: string;
  name: string;
  description: string;
  url: string;
  registerUrl: string;
  models: Model[];
  isBuiltin: boolean;
  region: 'china' | 'global';
  recommendLevel: 'recommended' | 'alternative' | 'advanced';
}

export const MODEL_PROVIDERS: ModelProvider[] = [
  // ⭐ 推荐级
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: '国产最强开源模型，中文理解力强，价格便宜',
    url: 'https://api.deepseek.com',
    registerUrl: 'https://platform.deepseek.com/api-keys',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', description: '最新对话模型，综合能力强', features: ['中文强', '便宜', '适合日常'] },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: '深度推理模型，擅长复杂分析', features: ['推理强', '数学强', '代码强'] },
    ],
    isBuiltin: true,
    region: 'china',
    recommendLevel: 'recommended',
  },
  {
    id: 'ollama',
    name: 'Ollama（本机运行）',
    description: '本地运行开源模型，完全免费，无需 API Key',
    url: 'http://localhost:11434',
    registerUrl: 'https://ollama.com/download',
    models: [
      { id: 'qwen3.5:9b', name: 'Qwen3.5 (9B)', description: '通义千问本地版，中文能力强', features: ['中文强', '免费', '本地运行'] },
      { id: 'qwen3.5:32b', name: 'Qwen3.5 (32B)', description: '大杯本地模型，效果更好但吃配置', features: ['中文强', '免费', '高配置要求'] },
      { id: 'llama3.1:8b', name: 'Llama 3.1 (8B)', description: 'Meta 开源模型，英文场景强', features: ['英文强', '免费', '轻量'] },
    ],
    isBuiltin: false,
    region: 'china',
    recommendLevel: 'recommended',
  },
  // 🥈 替代级
  {
    id: 'tongyi',
    name: '通义千问（阿里云）',
    description: '阿里云出品，中文理解力强，免费额度多',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    registerUrl: 'https://dashscope.console.aliyun.com/',
    models: [
      { id: 'qwen-max', name: 'Qwen Max', description: '通义千问最强版', features: ['中文强', '免费额度', '综合'] },
      { id: 'qwen-plus', name: 'Qwen Plus', description: '通义千问增强版，性价比高', features: ['中文强', '性价比高'] },
      { id: 'qwen-turbo', name: 'Qwen Turbo', description: '通义千问快速版，响应快', features: ['速度快', '便宜'] },
    ],
    isBuiltin: false,
    region: 'china',
    recommendLevel: 'alternative',
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    description: '清华系大模型，GLM 系列口碑好',
    url: 'https://open.bigmodel.cn/api/paas/v4',
    registerUrl: 'https://open.bigmodel.cn/usercenter/api-keys',
    models: [
      { id: 'glm-4-plus', name: 'GLM-4 Plus', description: '智谱最新最强模型', features: ['中文强', '推理强'] },
      { id: 'glm-4-air', name: 'GLM-4-Air', description: '轻量版，性价比之选', features: ['速度快', '便宜'] },
    ],
    isBuiltin: false,
    region: 'china',
    recommendLevel: 'alternative',
  },
  {
    id: 'doubao',
    name: '豆包（火山引擎）',
    description: '字节跳动出品，响应速度快',
    url: 'https://ark.cn-beijing.volces.com/api/v3',
    registerUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    models: [
      { id: 'doubao-1.5-pro-256k', name: '豆包 Pro (256K)', description: '超长上下文，可处理整本书', features: ['超长上下文', '速度快'] },
      { id: 'doubao-1.5-lite-32k', name: '豆包 Lite (32K)', description: '轻量版，响应极快', features: ['速度快', '便宜'] },
    ],
    isBuiltin: false,
    region: 'china',
    recommendLevel: 'alternative',
  },
  // 🥉 进阶级
  {
    id: 'moonshot',
    name: '月之暗面 Kimi',
    description: '长上下文能力强，适合文档分析',
    url: 'https://api.moonshot.cn/v1',
    registerUrl: 'https://platform.moonshot.cn/console/api-keys',
    models: [
      { id: 'moonshot-v1-8k', name: 'Moonshot v1 (8K)', description: '基础版', features: ['长上下文'] },
      { id: 'moonshot-v1-32k', name: 'Moonshot v1 (32K)', description: '增强版', features: ['长上下文', '文档分析'] },
      { id: 'moonshot-v1-128k', name: 'Moonshot v1 (128K)', description: '超长版', features: ['超长上下文'] },
    ],
    isBuiltin: false,
    region: 'china',
    recommendLevel: 'advanced',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: '全球最强模型，国内需特殊网络环境',
    url: 'https://api.openai.com/v1',
    registerUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI 最新旗舰模型', features: ['综合最强', '多模态'] },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '轻量版，速度快价格低', features: ['速度快', '便宜'] },
      { id: 'o1-mini', name: 'o1-mini', description: '深度推理模型', features: ['推理强', '数学强'] },
    ],
    isBuiltin: false,
    region: 'global',
    recommendLevel: 'advanced',
  },
];

export const modelProvidersRouter: Router = Router();

// GET /api/model-providers - 返回所有供应商
modelProvidersRouter.get('/', (req: Request, res: Response) => {
  res.json(MODEL_PROVIDERS);
});

// GET /api/model-providers/:id - 返回单个供应商详情
modelProvidersRouter.get('/:id', (req: Request, res: Response) => {
  const provider = MODEL_PROVIDERS.find(p => p.id === req.params.id);
  if (!provider) {
    res.status(404).json({ success: false, message: '未找到该模型供应商' });
    return;
  }
  res.json(provider);
});