import { BaseProvider } from './base';
import type { LanguageModel } from 'ai';
import type {
  ProviderId,
  ProviderConfig,
  ModelInfo,
  GenerationRequest,
  GenerationResponse,
  StreamOptions,
  ConnectionStatus,
} from '../core/types';
import { ConnectionError } from '../core/errors';

// Ollama provider - placeholder implementation
// Requires ollama-ai-provider package when Ollama support is needed

export class OllamaProvider extends BaseProvider {
  readonly id: ProviderId = 'ollama';
  readonly name = 'Ollama (Local)';
  readonly config: ProviderConfig = {
    id: 'ollama',
    name: 'Ollama',
    requiresApiKey: false,
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  };

  private discoveredModels: ModelInfo[] = [];
  private baseUrl: string;

  constructor(baseUrl?: string) {
    super();
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  async initialize(_apiKey?: string): Promise<void> {
    this._initialized = true;
    this._authStatus = 'valid'; // Ollama doesn't require auth
    await this.refreshModels();
  }

  async dispose(): Promise<void> {
    this._initialized = false;
    this._connectionStatus = 'disconnected';
    this.discoveredModels = [];
  }

  async checkConnection(): Promise<ConnectionStatus> {
    this._connectionStatus = 'checking';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        this._connectionStatus = 'connected';
        await this.refreshModels();
      } else {
        this._connectionStatus = 'disconnected';
      }
    } catch {
      this._connectionStatus = 'disconnected';
    }
    return this._connectionStatus;
  }

  private async refreshModels(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        this.discoveredModels = [];
        return;
      }

      const data = await response.json();
      const models = data.models || [];

      this.discoveredModels = models.map((m: { name: string; size?: number; details?: { family?: string } }) => ({
        id: m.name,
        name: m.name,
        providerId: 'ollama' as ProviderId,
        description: `Local model (${formatSize(m.size || 0)})`,
        capabilities: this.inferCapabilities(m),
      }));

      this._connectionStatus = 'connected';
    } catch {
      this.discoveredModels = [];
      this._connectionStatus = 'disconnected';
    }
  }

  private inferCapabilities(model: { name: string; details?: { family?: string } }): ModelInfo['capabilities'] {
    const name = model.name.toLowerCase();
    const family = model.details?.family?.toLowerCase() || '';

    return {
      streaming: true,
      structuredOutput: false,
      toolCalling: false,
      vision: name.includes('vision') || name.includes('llava'),
      maxContextTokens: this.inferContextLength(name),
      maxOutputTokens: 4096,
    };
  }

  private inferContextLength(modelName: string): number {
    if (modelName.includes('70b')) return 128000;
    if (modelName.includes('32k')) return 32000;
    if (modelName.includes('7b')) return 8192;
    return 8192;
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    if (this._connectionStatus !== 'connected') {
      await this.refreshModels();
    }
    return this.discoveredModels;
  }

  async getModelInfo(modelId: string): Promise<ModelInfo | undefined> {
    return this.discoveredModels.find((m) => m.id === modelId);
  }

  async hasModel(modelId: string): Promise<boolean> {
    return this.discoveredModels.some((m) => m.id === modelId);
  }

  getLanguageModel(_modelId: string): LanguageModel {
    // This would require the ollama-ai-provider package
    throw new Error('Ollama provider not fully implemented. Install ollama-ai-provider package.');
  }

  async generateText(_request: GenerationRequest): Promise<GenerationResponse> {
    throw new ConnectionError(this.id, 'Ollama provider not fully implemented');
  }

  async streamText(
    _request: GenerationRequest,
    _options: StreamOptions
  ): Promise<GenerationResponse> {
    throw new ConnectionError(this.id, 'Ollama provider not fully implemented');
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return 'Unknown size';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export const ollamaProvider = new OllamaProvider();
