import type {
  EngineStatus,
  EngineChatRequest,
  EngineChatResponse,
  ChatMessage,
  PromptInjectionMode,
  EngineDefinition,
} from '@greenhorn/shared';

// ✅ 已测通（2026-08-03 验收）：多引擎适配层基类（S1 全部 6 引擎 adapter 基于此类，标准 EngineChatResponse 输出）
export abstract class EngineAdapter {
  engineId: string;
  name: string;
  description: string;
  promptInjectionMode: PromptInjectionMode;
  config: EngineDefinition;

  constructor(config: EngineDefinition) {
    this.engineId = config.id;
    this.name = config.name;
    this.description = config.description;
    this.promptInjectionMode = config.promptInjectionMode;
    this.config = config;
  }

  abstract getStatus(): Promise<EngineStatus>;
  abstract chat(request: EngineChatRequest): AsyncGenerator<EngineChatResponse>;

  buildStatus(
    installed: boolean,
    running: boolean,
    extras: Partial<EngineStatus> = {}
  ): EngineStatus {
    return {
      engineId: this.engineId,
      installed,
      running,
      capabilities: this.getCapabilities(),
      lastCheck: new Date().toISOString(),
      ...extras,
    };
  }

  getCapabilities(): string[] {
    return this.config.capabilities || ['chat', 'streaming'];
  }

  formatMessages(messages: ChatMessage[], systemPrompt?: string): ChatMessage[] {
    const formatted: ChatMessage[] = [];
    if (systemPrompt) {
      formatted.push({ role: 'system', content: systemPrompt });
    }
    formatted.push(...messages);
    return formatted;
  }
}

export class EngineAdapterRegistry {
  private adapters: Map<string, EngineAdapter> = new Map();

  register(adapter: EngineAdapter) {
    this.adapters.set(adapter.engineId, adapter);
  }

  get(engineId: string): EngineAdapter | undefined {
    return this.adapters.get(engineId);
  }

  getAll(): EngineAdapter[] {
    return Array.from(this.adapters.values());
  }

  async getAllStatuses(): Promise<EngineStatus[]> {
    const results = await Promise.all(
      this.getAll().map(a => a.getStatus().catch(() => a.buildStatus(false, false)))
    );
    return results;
  }
}

export const registry = new EngineAdapterRegistry();
