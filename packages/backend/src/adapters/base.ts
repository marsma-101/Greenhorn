import type {
  EngineStatus,
  EngineChatRequest,
  EngineChatResponse,
  ChatMessage,
} from '@greenhorn/shared';

export abstract class EngineAdapter {
  engineId: string;
  name: string;
  description: string;

  constructor(engineId: string, name: string, description: string) {
    this.engineId = engineId;
    this.name = name;
    this.description = description;
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
    return ['chat', 'streaming'];
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
