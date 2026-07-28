/**
 * 引擎适配器接口 - 所有引擎（PI、OpenClaw、Hermes等）都需要实现此接口
 * 
 * 遵循架构修正：不管理会话（各引擎自己管），只做对话和配置
 */

export interface EngineAdapter {
  readonly name: string;
  readonly version: string;
  readonly description: string;

  /** 发送消息，返回流式事件 */
  sendMessage(prompt: string, context: SessionContext): AsyncIterable<ChatEvent>;
  
  /** 读取引擎配置 */
  getConfig(): EngineConfig;
  
  /** 更新引擎配置 */
  updateConfig(config: Partial<EngineConfig>): Promise<void>;
  
  /** 检测引擎是否可用 */
  isAvailable(): Promise<boolean>;
}

export interface SessionContext {
  sessionId?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export type ChatEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_call'; name: string; input: any; id: string }
  | { type: 'tool_result'; name: string; output: any; id: string }
  | { type: 'done'; reason: 'complete' | 'abort' | 'error' }
  | { type: 'error'; message: string; code?: string };

export interface EngineConfig {
  defaultModel: string;
  availableModels: string[];
  baseUrl: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
}

export interface EngineRegistration {
  id: string;
  name: string;
  adapter: new () => EngineAdapter;
  config: EngineConfig;
}