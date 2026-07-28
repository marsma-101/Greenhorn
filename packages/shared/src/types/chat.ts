/**
 * 对话相关类型
 * 遵循 PM 架构修正：不管理会话（PI 自己管）
 * 只保留发送消息和配置验证的请求/响应类型
 */

export interface SendMessageRequest {
  prompt: string;
  sessionId?: string;
  context?: {
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface VerifyConfigRequest {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  modelId?: string;
}

export interface VerifyConfigResponse {
  success: boolean;
  message: string;
  latency?: number;
}