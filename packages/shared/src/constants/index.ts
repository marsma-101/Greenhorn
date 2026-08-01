export const APP_NAME = 'GreenHorn';
export const APP_VERSION = '0.1.0';
export const DEFAULT_PORT = 1001;
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_CONTEXT_LENGTH = 4096;

export interface EngineInfo {
  id: string;
  name: string;
  description: string;
  emoji: string;
  status: 'ready' | 'installing' | 'missing';
}

export const ENGINES: EngineInfo[] = [
  {
    id: 'pi',
    name: 'PI',
    description: '轻量级编程助手，专注代码开发',
    emoji: '🍍',
    status: 'ready',
  },
  {
    id: 'hermes',
    name: 'Hermes',
    description: '全平台自主智能体，可运行脚本操作文件',
    emoji: '🔥',
    status: 'missing',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: '编程专家，Anthropic 出品，代码能力强',
    emoji: '🟠',
    status: 'missing',
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'OpenAI 编程助手，与 ChatGPT 同源',
    emoji: '⚡',
    status: 'missing',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: '开源编程助手，功能全面',
    emoji: '📝',
    status: 'missing',
  },
  {
    id: 'reasonix',
    name: 'Reasonix',
    description: 'DeepSeek 专用，推理能力强',
    emoji: '💡',
    status: 'missing',
  },
];

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