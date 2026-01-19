// ============================================================================
// Core Types
// ============================================================================
export type {
  ProviderId,
  AuthStatus,
  ConnectionStatus,
  ProviderConfig,
  ProviderState,
  ModelCapabilities,
  ModelInfo,
  NormalizedRole,
  ContentBlock,
  NormalizedMessage,
  GenerationRequest,
  StreamOptions,
  GenerationResponse,
  RateLimitConfig,
  RateLimitState,
  ProviderErrorCode,
  ProviderError,
} from './core/types';

// ============================================================================
// Errors
// ============================================================================
export {
  AIProviderError,
  AuthenticationError,
  RateLimitError,
  ConnectionError,
  ModelNotFoundError,
  TimeoutError,
  mapProviderError,
} from './core/errors';

// ============================================================================
// Provider Interface
// ============================================================================
export type { AIProvider } from './providers/base';
export { BaseProvider } from './providers/base';

// ============================================================================
// Registry
// ============================================================================
export {
  providerRegistry,
  ProviderRegistry,
  getProvider,
  getAllModels,
} from './providers/registry';

// ============================================================================
// Built-in Providers
// ============================================================================
export { OpenAIProvider, openaiProvider } from './providers/openai';
export { AnthropicProvider, anthropicProvider } from './providers/anthropic';
export { OllamaProvider, ollamaProvider } from './providers/ollama';

// ============================================================================
// Rate Limiting
// ============================================================================
export { TokenBucket } from './rate-limiting/token-bucket';
export { ProviderRateLimiter, rateLimiterManager } from './rate-limiting/rate-limiter';

// ============================================================================
// Utilities
// ============================================================================
export { withRetry, createRetryWrapper, type RetryConfig } from './utils/retry';
export {
  createMessage,
  normalizeMessagesForProvider,
  toNormalizedMessages,
} from './utils/message-normalizer';

// ============================================================================
// Auth
// ============================================================================
export { authManager, AuthManager } from './auth/manager';

// ============================================================================
// Initialization Helper
// ============================================================================
import type { ProviderId } from './core/types';
import { providerRegistry } from './providers/registry';
import { openaiProvider } from './providers/openai';
import { anthropicProvider } from './providers/anthropic';
import { ollamaProvider } from './providers/ollama';
import { authManager } from './auth/manager';

export interface InitializeAIOptions {
  apiKeys?: Partial<Record<ProviderId, string>>;
  ollamaBaseUrl?: string;
  autoInitialize?: boolean;
  providers?: ProviderId[];
}

export async function initializeAI(options: InitializeAIOptions = {}): Promise<void> {
  const {
    apiKeys = {},
    autoInitialize = true,
    providers = ['openai', 'anthropic'],
  } = options;

  // Configure registry
  providerRegistry.configure({
    autoInitialize,
    apiKeys,
  });

  // Initialize auth manager
  authManager.initialize();

  // Override with provided keys
  for (const [providerId, key] of Object.entries(apiKeys)) {
    if (key) {
      authManager.setApiKey(providerId as ProviderId, key);
    }
  }

  // Register requested providers
  if (providers.includes('openai')) {
    await providerRegistry.register(openaiProvider);
  }
  if (providers.includes('anthropic')) {
    await providerRegistry.register(anthropicProvider);
  }
  if (providers.includes('ollama')) {
    await providerRegistry.register(ollamaProvider);
  }
}

// ============================================================================
// Convenience Function
// ============================================================================
export async function generate(
  modelId: string,
  prompt: string,
  options: {
    providerId?: ProviderId;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  } = {}
): Promise<string> {
  const { providerId, temperature, maxTokens, systemPrompt } = options;

  // Find provider for model
  let provider;
  if (providerId) {
    provider = providerRegistry.get(providerId);
  } else {
    provider = await providerRegistry.findProviderForModel(modelId);
    if (!provider) {
      throw new Error(`No provider found for model: ${modelId}`);
    }
  }

  const response = await provider.generateText({
    modelId,
    messages: [{ role: 'user', content: prompt }],
    systemPrompt,
    temperature,
    maxTokens,
  });

  return response.text;
}
