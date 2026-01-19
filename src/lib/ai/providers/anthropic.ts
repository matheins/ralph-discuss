import { createAnthropic, anthropic as defaultAnthropic } from '@ai-sdk/anthropic';
import { generateText as aiGenerateText, streamText as aiStreamText, type LanguageModel } from 'ai';
import { BaseProvider } from './base';
import { mapProviderError } from '../core/errors';
import type {
  ProviderId,
  ProviderConfig,
  ModelInfo,
  GenerationRequest,
  GenerationResponse,
  StreamOptions,
  ConnectionStatus,
} from '../core/types';

// Static model registry for Anthropic
const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    providerId: 'anthropic',
    description: 'Most capable Claude model for complex tasks',
    capabilities: {
      streaming: true,
      structuredOutput: true,
      toolCalling: true,
      vision: true,
      maxContextTokens: 200000,
      maxOutputTokens: 32000,
    },
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    providerId: 'anthropic',
    description: 'Balanced performance and cost',
    capabilities: {
      streaming: true,
      structuredOutput: true,
      toolCalling: true,
      vision: true,
      maxContextTokens: 200000,
      maxOutputTokens: 64000,
    },
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    providerId: 'anthropic',
    description: 'Fast and efficient for simpler tasks',
    capabilities: {
      streaming: true,
      structuredOutput: true,
      toolCalling: true,
      vision: true,
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
    },
    inputCostPer1M: 0.8,
    outputCostPer1M: 4.0,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet (v2)',
    providerId: 'anthropic',
    description: 'Previous generation balanced model',
    capabilities: {
      streaming: true,
      structuredOutput: true,
      toolCalling: true,
      vision: true,
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
    },
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
];

export class AnthropicProvider extends BaseProvider {
  readonly id: ProviderId = 'anthropic';
  readonly name = 'Anthropic';
  readonly config: ProviderConfig = {
    id: 'anthropic',
    name: 'Anthropic',
    requiresApiKey: true,
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
  };

  private anthropicInstance: ReturnType<typeof createAnthropic> | typeof defaultAnthropic = defaultAnthropic;

  async initialize(apiKey?: string): Promise<void> {
    if (apiKey) {
      this._apiKey = apiKey;
      this.anthropicInstance = createAnthropic({ apiKey });
    } else {
      const envKey = process.env.ANTHROPIC_API_KEY;
      if (envKey) {
        this._apiKey = envKey;
        this.anthropicInstance = defaultAnthropic;
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
    if (!apiKey.startsWith('sk-ant-')) {
      return false;
    }

    try {
      const testInstance = createAnthropic({ apiKey });
      await aiGenerateText({
        model: testInstance('claude-3-5-haiku-20241022'),
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
    return ANTHROPIC_MODELS.filter((m) => !m.deprecated);
  }

  async getModelInfo(modelId: string): Promise<ModelInfo | undefined> {
    return ANTHROPIC_MODELS.find((m) => m.id === modelId);
  }

  async hasModel(modelId: string): Promise<boolean> {
    const known = ANTHROPIC_MODELS.some((m) => m.id === modelId);
    return known || modelId.startsWith('claude-');
  }

  getLanguageModel(modelId: string): LanguageModel {
    return this.anthropicInstance(modelId);
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
      case 'end_turn':
        return 'stop';
      case 'length':
      case 'max_tokens':
        return 'length';
      case 'content-filter':
        return 'content_filter';
      case 'tool_use':
      case 'tool-calls':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }
}

export const anthropicProvider = new AnthropicProvider();
