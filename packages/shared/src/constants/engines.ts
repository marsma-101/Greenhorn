export interface EngineCapability {
  id: string;
  name: string;
  description: string;
  level: 'basic' | 'intermediate' | 'advanced';
  supported: boolean;
}

export interface EngineStatus {
  engineId: string;
  installed: boolean;
  running: boolean;
  version?: string;
  pid?: number;
  uptime?: number;
  capabilities: string[];
  lastCheck?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface EngineChatRequest {
  engineId: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  sessionId?: string;
}

export interface EngineChatResponse {
  engineId: string;
  sessionId?: string;
  messageId: string;
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  done: boolean;
  error?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export const ENGINE_CAPABILITIES: EngineCapability[] = [
  { id: 'chat', name: '对话', description: '基础对话能力', level: 'basic', supported: true },
  { id: 'streaming', name: '流式输出', description: '逐字输出回复', level: 'basic', supported: true },
  { id: 'thinking', name: '思考过程', description: '展示推理步骤', level: 'intermediate', supported: false },
  { id: 'tools', name: '工具调用', description: '调用外部工具/API', level: 'intermediate', supported: false },
  { id: 'code', name: '代码执行', description: '执行代码/脚本', level: 'advanced', supported: false },
  { id: 'filesystem', name: '文件操作', description: '读写文件系统', level: 'advanced', supported: false },
  { id: 'browser', name: '浏览器控制', description: '控制浏览器操作', level: 'advanced', supported: false },
  { id: 'planning', name: '任务规划', description: '自主规划多步骤任务', level: 'advanced', supported: false },
];
