import type { PromptInjectionMode } from './engines';

export const APP_NAME = 'GreenHorn';
export const APP_VERSION = '0.1.2';
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
  homepageUrl?: string;
}

export type Platform = 'win32' | 'linux' | 'darwin';

export interface EngineDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  status: 'ready' | 'installing' | 'missing';
  detectCmd?: string;
  detectCmdAliases?: string[];
  detectRequiredCommands?: string[];
  launchCmd?: string;
  launchCmdByPlatform?: Partial<Record<Platform, string>>;
  promptInjectionMode: PromptInjectionMode;
  draftPromptFlag?: string;
  draftPromptEnvVar?: string;
  homepageUrl?: string;
  capabilities: string[];
  requiresApiKey?: boolean;
  apiKeyLabel?: string;
  apiKeyHint?: string;
  apiKeyRegisterUrl?: string;
  defaultProvider?: string;
  defaultModel?: string;
  configGuideNote?: string;
}

export const ENGINES: EngineDefinition[] = [
  {
    id: 'pi',
    name: 'PI',
    description: '轻量级编程助手，专注代码开发',
    emoji: '🍍',
    status: 'ready',
    detectCmd: 'pi',
    launchCmd: 'pi',
    promptInjectionMode: 'http-api',
    homepageUrl: 'https://github.com/PineappleCake/pi-coding-agent',
    capabilities: ['chat', 'streaming', 'thinking'],
  },
  {
    id: 'hermes',
    name: 'Hermes',
    description: '全平台自主智能体，可运行脚本操作文件',
    emoji: '🔥',
    status: 'missing',
    detectCmd: 'hermes',
    launchCmd: 'hermes --tui',
    promptInjectionMode: 'hermes-query',
    homepageUrl: 'https://github.com/NousResearch/hermes',
    capabilities: ['chat', 'streaming', 'thinking', 'tools', 'code', 'filesystem'],
    requiresApiKey: false,
    configGuideNote: 'Hermes 为本地引擎，首次使用需自动配置，无需 API Key',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: '编程专家，Anthropic 出品，代码能力强',
    emoji: '🟠',
    status: 'missing',
    detectCmd: 'claude',
    launchCmd: 'claude',
    promptInjectionMode: 'http-api',
    homepageUrl: 'https://docs.anthropic.com/claude',
    capabilities: ['chat', 'streaming', 'thinking', 'tools', 'code', 'filesystem'],
    requiresApiKey: true,
    apiKeyLabel: 'ANTHROPIC_API_KEY',
    apiKeyHint: '在 Anthropic Console 创建 API Key 后粘贴',
    apiKeyRegisterUrl: 'https://console.anthropic.com/settings/keys',
    defaultProvider: 'anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
    configGuideNote: 'Claude Code 需要 ANTHROPIC_API_KEY 才能运行，必须配置后才能开始对话',
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'OpenAI 编程助手，与 ChatGPT 同源',
    emoji: '⚡',
    status: 'missing',
    detectCmd: 'codex',
    launchCmd: 'codex',
    promptInjectionMode: 'http-sse',
    homepageUrl: 'https://codex.ai',
    capabilities: ['chat', 'streaming', 'thinking', 'tools', 'code', 'filesystem', 'browser'],
    requiresApiKey: true,
    apiKeyLabel: 'OpenAI API Key',
    apiKeyHint: '在 OpenAI Platform 创建 API Key 后粘贴',
    apiKeyRegisterUrl: 'https://platform.openai.com/api-keys',
    defaultProvider: 'openai',
    defaultModel: 'codex',
    configGuideNote: 'Codex 需要 OpenAI API Key 才能运行，必须配置后才能开始对话',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: '开源编程助手，内置 Zen 免费模型',
    emoji: '📝',
    status: 'missing',
    detectCmd: 'opencode',
    launchCmd: 'opencode',
    promptInjectionMode: 'http-sse',
    homepageUrl: 'https://opencode.ai',
    capabilities: ['chat', 'streaming', 'thinking', 'tools', 'code', 'filesystem'],
    requiresApiKey: false,
    defaultProvider: 'opencode',
    defaultModel: 'deepseek-v4-flash-free',
    configGuideNote: 'OpenCode 内置 Zen 免费模型（如 deepseek-v4-flash-free），无需 API Key 即可对话，零成本开箱即用',
  },
  {
    id: 'reasonix',
    name: 'Reasonix',
    description: 'DeepSeek 专用，推理能力强',
    emoji: '💡',
    status: 'missing',
    detectCmd: 'reasonix',
    launchCmd: 'reasonix',
    promptInjectionMode: 'http-sse',
    homepageUrl: 'https://reasonix.ai',
    capabilities: ['chat', 'streaming', 'thinking', 'tools', 'code', 'filesystem'],
    requiresApiKey: true,
    apiKeyLabel: 'DEEPSEEK_API_KEY',
    apiKeyHint: '在 DeepSeek Platform 创建 API Key 后粘贴',
    apiKeyRegisterUrl: 'https://platform.deepseek.com/api_keys',
    defaultProvider: 'deepseek',
    defaultModel: 'deepseek-reasoner',
    configGuideNote: 'Reasonix 需要 DEEPSEEK_API_KEY 才能运行，必须配置后才能开始对话',
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    description: '本地 AI 智能体，可自主执行任务',
    emoji: '🦞',
    status: 'missing',
    detectCmd: 'openclaw',
    launchCmd: 'openclaw',
    promptInjectionMode: 'cli-oneshot',
    homepageUrl: 'https://github.com/openclaw/openclaw',
    capabilities: ['chat', 'streaming', 'thinking', 'tools', 'code', 'filesystem', 'browser'],
    requiresApiKey: false,
    configGuideNote: 'OpenClaw 为本地智能体，通过 openclaw run 单次执行对话，无需 API Key',
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