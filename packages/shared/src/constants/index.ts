export const APP_NAME = 'GreenHorn';
export const APP_VERSION = '0.1.0';
export const DEFAULT_PORT = 3000;
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_CONTEXT_LENGTH = 4096;

export const ENGINES = {
  PI: {
    id: 'pi',
    name: 'PI · 编码智能体',
    description: '帮你写代码、读代码、改代码',
    defaultModel: 'deepseek/deepseek-chat',
  },
} as const;

export const PROVIDERS = {
  DEEPSEEK: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  OLLAMA: {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434',
    models: ['qwen3.5:9b'],
  },
} as const;

export const ERROR_MESSAGES = {
  NETWORK: '网络好像连不上了，等一等再试试',
  INVALID_KEY: 'Key 好像不对哦，检查有没有复制完整？',
  INSTALL_FAILED: '安装失败了，可能是网络问题，再试一次？',
  GENERIC: '出了点小问题，请再试一次',
} as const;