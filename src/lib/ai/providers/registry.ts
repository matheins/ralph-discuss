import type { ProviderId, ModelInfo, ProviderState } from '../core/types';
import type { AIProvider } from './base';
import { ModelNotFoundError } from '../core/errors';

interface ProviderEntry {
  provider: AIProvider;
  registeredAt: number;
}

interface RegistryConfig {
  autoInitialize: boolean;
  apiKeys?: Partial<Record<ProviderId, string>>;
}

class ProviderRegistry {
  private providers = new Map<ProviderId, ProviderEntry>();
  private config: RegistryConfig = { autoInitialize: true };
  private static instance: ProviderRegistry | null = null;

  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  configure(config: Partial<RegistryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async register(provider: AIProvider): Promise<void> {
    const existing = this.providers.get(provider.id);
    if (existing) {
      await existing.provider.dispose();
    }

    if (this.config.autoInitialize) {
      const apiKey = this.config.apiKeys?.[provider.id];
      await provider.initialize(apiKey);
    }

    this.providers.set(provider.id, {
      provider,
      registeredAt: Date.now(),
    });
  }

  async unregister(providerId: ProviderId): Promise<void> {
    const entry = this.providers.get(providerId);
    if (entry) {
      await entry.provider.dispose();
      this.providers.delete(providerId);
    }
  }

  get(providerId: ProviderId): AIProvider {
    const entry = this.providers.get(providerId);
    if (!entry) {
      throw new Error(`Provider "${providerId}" is not registered`);
    }
    return entry.provider;
  }

  getOptional(providerId: ProviderId): AIProvider | undefined {
    return this.providers.get(providerId)?.provider;
  }

  has(providerId: ProviderId): boolean {
    return this.providers.has(providerId);
  }

  getAll(): AIProvider[] {
    return Array.from(this.providers.values()).map((e) => e.provider);
  }

  getRegisteredIds(): ProviderId[] {
    return Array.from(this.providers.keys());
  }

  async getAllStates(): Promise<ProviderState[]> {
    const states = await Promise.all(this.getAll().map((p) => p.getState()));
    return states;
  }

  async findProviderForModel(modelId: string): Promise<AIProvider | undefined> {
    for (const provider of this.getAll()) {
      if (await provider.hasModel(modelId)) {
        return provider;
      }
    }
    return undefined;
  }

  async getModelInfo(modelId: string): Promise<ModelInfo> {
    const provider = await this.findProviderForModel(modelId);
    if (!provider) {
      throw new ModelNotFoundError('openai' as ProviderId, modelId);
    }

    const info = await provider.getModelInfo(modelId);
    if (!info) {
      throw new ModelNotFoundError(provider.id, modelId);
    }

    return info;
  }

  async getAllModels(): Promise<ModelInfo[]> {
    const modelLists = await Promise.all(
      this.getAll().map((p) => p.getAvailableModels().catch(() => []))
    );
    return modelLists.flat();
  }

  async dispose(): Promise<void> {
    await Promise.all(
      Array.from(this.providers.values()).map((e) => e.provider.dispose())
    );
    this.providers.clear();
  }

  static reset(): void {
    if (ProviderRegistry.instance) {
      ProviderRegistry.instance.dispose();
      ProviderRegistry.instance = null;
    }
  }
}

export const providerRegistry = ProviderRegistry.getInstance();
export { ProviderRegistry };

export function getProvider(providerId: ProviderId): AIProvider {
  return providerRegistry.get(providerId);
}

export async function getAllModels(): Promise<ModelInfo[]> {
  return providerRegistry.getAllModels();
}
