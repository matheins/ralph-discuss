import type { LanguageModel } from 'ai';
import type {
  ProviderId,
  ProviderConfig,
  ProviderState,
  ModelInfo,
  GenerationRequest,
  GenerationResponse,
  StreamOptions,
  AuthStatus,
  ConnectionStatus,
} from '../core/types';

export interface AIProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly config: ProviderConfig;

  initialize(apiKey?: string): Promise<void>;
  isInitialized(): boolean;
  dispose(): Promise<void>;

  validateApiKey(apiKey?: string): Promise<AuthStatus>;
  getAuthStatus(): AuthStatus;
  setApiKey(apiKey: string): void;

  checkConnection(): Promise<ConnectionStatus>;
  getConnectionStatus(): ConnectionStatus;

  getAvailableModels(): Promise<ModelInfo[]>;
  getModelInfo(modelId: string): Promise<ModelInfo | undefined>;
  hasModel(modelId: string): Promise<boolean>;
  getLanguageModel(modelId: string): LanguageModel;

  generateText(request: GenerationRequest): Promise<GenerationResponse>;
  streamText(request: GenerationRequest, options: StreamOptions): Promise<GenerationResponse>;

  getState(): Promise<ProviderState>;
}

export abstract class BaseProvider implements AIProvider {
  abstract readonly id: ProviderId;
  abstract readonly name: string;
  abstract readonly config: ProviderConfig;

  protected _authStatus: AuthStatus = 'unknown';
  protected _connectionStatus: ConnectionStatus = 'disconnected';
  protected _initialized = false;
  protected _apiKey: string | undefined;

  abstract initialize(apiKey?: string): Promise<void>;
  abstract dispose(): Promise<void>;

  isInitialized(): boolean {
    return this._initialized;
  }

  async validateApiKey(apiKey?: string): Promise<AuthStatus> {
    const keyToValidate = apiKey || this._apiKey;

    if (!this.config.requiresApiKey) {
      this._authStatus = 'valid';
      return 'valid';
    }

    if (!keyToValidate) {
      this._authStatus = 'missing';
      return 'missing';
    }

    try {
      const isValid = await this._performKeyValidation(keyToValidate);
      this._authStatus = isValid ? 'valid' : 'invalid';
      return this._authStatus;
    } catch {
      this._authStatus = 'invalid';
      return 'invalid';
    }
  }

  protected async _performKeyValidation(_apiKey: string): Promise<boolean> {
    return _apiKey.length > 0;
  }

  getAuthStatus(): AuthStatus {
    return this._authStatus;
  }

  setApiKey(apiKey: string): void {
    this._apiKey = apiKey;
    this._authStatus = 'unknown';
  }

  abstract checkConnection(): Promise<ConnectionStatus>;

  getConnectionStatus(): ConnectionStatus {
    return this._connectionStatus;
  }

  abstract getAvailableModels(): Promise<ModelInfo[]>;
  abstract getModelInfo(modelId: string): Promise<ModelInfo | undefined>;
  abstract hasModel(modelId: string): Promise<boolean>;
  abstract getLanguageModel(modelId: string): LanguageModel;

  abstract generateText(request: GenerationRequest): Promise<GenerationResponse>;
  abstract streamText(request: GenerationRequest, options: StreamOptions): Promise<GenerationResponse>;

  async getState(): Promise<ProviderState> {
    const models = await this.getAvailableModels().catch(() => []);

    return {
      id: this.id,
      authStatus: this._authStatus,
      connectionStatus: this._connectionStatus,
      availableModels: models,
      rateLimitState: {
        availableRequests: Infinity,
        currentConcurrent: 0,
        nextRequestInMs: 0,
        isLimited: false,
      },
    };
  }
}
