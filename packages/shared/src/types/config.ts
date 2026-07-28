/**
 * 配置相关类型
 * 遵循 PM 架构修正：只读/写 PI 的 auth.json 和 models.json
 * 不做独立的配置管理系统
 */

export interface AppConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl: string;
  theme: 'light' | 'dark' | 'system';
  showHelp: boolean;
}

export interface PiPiAuthConfig {
  [provider: string]: {
    apiKey?: string;
    baseUrl?: string;
  };
}

export interface PiModelConfig {
  defaultProvider?: string;
  defaultModel?: string;
  models?: Array<{
    provider: string;
    model: string;
    enabled: boolean;
  }>;
}

export interface ModelProvider {
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

export interface Model {
  id: string;
  name: string;
  description: string;
  features: string[];
}

export interface PiDetectionResult {
  installed: boolean;
  path?: string;
  version?: string;
}