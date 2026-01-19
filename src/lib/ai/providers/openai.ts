import { createOpenAI, openai as defaultOpenAI } from '@ai-sdk/openai';
import { generateText as aiGenerateText, streamText as aiStreamText, type LanguageModel } from 'ai';
import { BaseProvider } from './base';
import { mapProviderError, AIProviderError } from '../core/errors';
import type {
  ProviderId,
  ProviderConfig,
  ModelInfo,
  ModelCapabilities,
  GenerationRequest,
  GenerationResponse,
  StreamOptions,
  ConnectionStatus,
} from '../core/types';

// Static model registry for OpenAI
const OPENAI_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    providerId: 'openai',
    description: 'Most capable OpenAI model for complex tasks',
    capabilities: {
      streaming: true,
      structuredOutput: true,
      toolCalling: true,
      vision: true,
      maxContextTokens: 128000,
      maxOutputTokens: 16384,
    },
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    providerId: 'openai',
    description: 'Fast and cost-effective for simpler tasks',
    capabilities: {
      streaming: true,
      structuredOutput: true,
      toolCalling: true,
      vision: true,
      maxContextTokens: 128000,
      maxOutputTokens: 16384,
    },
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    providerId: 'openai',
    description: 'Previous generation flagship model',
    capabilities: {
      streaming: true,
      structuredOutput: true,
      toolCalling: true,
      vision: true,
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
    },
    inputCostPer1M: 10.0,
    outputCostPer1M: 30.0,
  },
  {
    id: 'o1',
    name: 'o1',
    providerId: 'openai',
    description: 'Reasoning model for complex problems',
    capabilities: {
      streaming: true,
      structuredOutput: true,
      toolCalling: false,
      vision: true,
      maxContextTokens: 200000,
      maxOutputTokens: 100000,
    },
    inputCostPer1M: 15.0,
    outputCostPer1M: 60.0,
  },
  {
    id: 'o1-mini',
    name: 'o1 Mini',
    providerId: 'openai',
    description: 'Faster reasoning model',
    capabilities: {
      streaming: true,
      structuredOutput: true,
      toolCalling: false,
      vision: false,
      maxContextTokens: 128000,
      maxOutputTokens: 65536,
    },
    inputCostPer1M: 3.0,
    outputCostPer1M: 12.0,
  },
];

export class OpenAIProvider extends BaseProvider {
  readonly id: ProviderId = 'openai';
  readonly name = 'OpenAI';
  readonly config: ProviderConfig = {
    id: 'openai',
    name: 'OpenAI',
    requiresApiKey: true,
    apiKeyEnvVar: 'OPENAI_API_KEY',
  };

  private openaiInstance: ReturnType<typeof createOpenAI> | typeof defaultOpenAI = defaultOpenAI;

  async initialize(apiKey?: string): Promise<void> {
    if (apiKey) {
      this._apiKey = apiKey;
      this.openaiInstance = createOpenAI({ apiKey });
    } else {
      const envKey = process.env.OPENAI_API_KEY;
      if (envKey) {
        this._apiKey = envKey;
        this.openaiInstance = defaultOpenAI;
      }
    }

    this._initialized = true;
    await this.validateApiKey();
  }

  async dispose(): Promise<void> {
    this._initialized = false;
    this._authStatus = 'unknown';
    this._connectionStatus = 'disconnected';
  }

  protected async _performKeyValidation(apiKey: string): Promise<boolean> {
    if (!apiKey.startsWith('sk-')) {
      return false;
    }

    try {
      const testInstance = createOpenAI({ apiKey });
      await aiGenerateText({
        model: testInstance('gpt-4o-mini'),
        prompt: 'Hi',
      });
      return true;
    } catch (error) {
      const mapped = mapProviderError(error, this.id);
      if (mapped.code === 'AUTH_ERROR') {
        return false;
      }
      // Other errors (rate limit, etc.) mean the key is likely valid
      return true;
    }
  }

  async checkConnection(): Promise<ConnectionStatus> {
    this._connectionStatus = 'checking';
    try {
      if (this._authStatus === 'valid') {
        this._connectionStatus = 'connected';
      } else {
        const status = await this.validateApiKey();
        this._connectionStatus = status === 'valid' ? 'connected' : 'disconnected';
      }
    } catch {
      this._connectionStatus = 'disconnected';
    }
    return this._connectionStatus;
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    return OPENAI_MODELS.filter((m) => !m.deprecated);
  }

  async getModelInfo(modelId: string): Promise<ModelInfo | undefined> {
    return OPENAI_MODELS.find((m) => m.id === modelId);
  }

  async hasModel(modelId: string): Promise<boolean> {
    // OpenAI has many models, allow unknown ones
    const known = OPENAI_MODELS.some((m) => m.id === modelId);
    return known || modelId.startsWith('gpt-') || modelId.startsWith('o1');
  }

  getLanguageModel(modelId: string): LanguageModel {
    return this.openaiInstance(modelId);
  }

  async generateText(request: GenerationRequest): Promise<GenerationResponse> {
    const startTime = Date.now();

    try {
      const model = this.getLanguageModel(request.modelId);
      const messages = this.convertMessages(request);

      const result = await aiGenerateText({
        model,
        messages,
        system: request.systemPrompt,
        temperature: request.temperature,
        // maxTokens is handled by the model defaults
        stopSequences: request.stopSequences,
        abortSignal: request.abortSignal,
      });

      return {
        text: result.text,
        usage: {
          promptTokens: result.usage?.inputTokens ?? 0,
          completionTokens: result.usage?.outputTokens ?? 0,
          totalTokens: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
        },
        modelId: request.modelId,
        providerId: this.id,
        durationMs: Date.now() - startTime,
        finishReason: this.mapFinishReason(result.finishReason),
      };
    } catch (error) {
      throw mapProviderError(error, this.id);
    }
  }

  async streamText(
    request: GenerationRequest,
    options: StreamOptions
  ): Promise<GenerationResponse> {
    const startTime = Date.now();
    let fullText = '';

    try {
      const model = this.getLanguageModel(request.modelId);
      const messages = this.convertMessages(request);

      options.onStart?.();

      const result = aiStreamText({
        model,
        messages,
        system: request.systemPrompt,
        temperature: request.temperature,
        // maxTokens is handled by the model defaults
        stopSequences: request.stopSequences,
        abortSignal: request.abortSignal,
      });

      for await (const chunk of result.textStream) {
        fullText += chunk;
        options.onChunk?.(chunk);
      }

      const finalResult = await result;
      const [usage, finishReason] = await Promise.all([
        finalResult.usage,
        finalResult.finishReason,
      ]);

      options.onComplete?.(fullText);

      return {
        text: fullText,
        usage: {
          promptTokens: usage?.inputTokens ?? 0,
          completionTokens: usage?.outputTokens ?? 0,
          totalTokens: (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0),
        },
        modelId: request.modelId,
        providerId: this.id,
        durationMs: Date.now() - startTime,
        finishReason: this.mapFinishReason(finishReason),
      };
    } catch (error) {
      const mappedError = mapProviderError(error, this.id);
      options.onError?.(mappedError);
      throw mappedError;
    }
  }

  private convertMessages(request: GenerationRequest) {
    return request.messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: typeof m.content === 'string' ? m.content : m.content.map((c) => c.type === 'text' ? c.text : '').join(''),
    }));
  }

  private mapFinishReason(reason?: string): GenerationResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content-filter':
        return 'content_filter';
      case 'tool-calls':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }
}

export const openaiProvider = new OpenAIProvider();
