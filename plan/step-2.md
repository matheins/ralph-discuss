# Step 2: AI Integration Layer - Detailed Implementation Plan

## Overview

This plan designs a pluggable, extensible AI provider abstraction layer for the ralph-discuss application. Building on Step 1's foundation, this step creates a robust integration layer supporting OpenAI, Anthropic, and Ollama providers with unified interfaces, authentication management, rate limiting, and comprehensive error handling.

---

## Architecture Overview

```
src/lib/ai/
├── core/
│   ├── types.ts              # Extended type definitions
│   └── errors.ts             # Custom error classes
├── providers/
│   ├── base.ts               # Abstract provider interface
│   ├── registry.ts           # Provider registration system
│   ├── openai.ts             # OpenAI provider implementation
│   ├── anthropic.ts          # Anthropic provider implementation
│   └── ollama.ts             # Ollama provider implementation
├── rate-limiting/
│   ├── token-bucket.ts       # Token bucket algorithm
│   └── rate-limiter.ts       # Provider-specific rate limiter
├── auth/
│   └── manager.ts            # Authentication management
├── utils/
│   ├── retry.ts              # Retry logic with exponential backoff
│   └── message-normalizer.ts # Message format normalization
└── index.ts                  # Public API exports
```

---

## Implementation Steps

### Step 2.1: Extended Type Definitions

**File:** `src/lib/ai/core/types.ts`

**Purpose:** Define comprehensive TypeScript interfaces for the provider abstraction layer.

**Key Types to Define:**

| Type | Purpose |
|------|---------|
| `ProviderId` | Union type: `'openai' \| 'anthropic' \| 'ollama'` |
| `AuthStatus` | `'valid' \| 'invalid' \| 'missing' \| 'unknown'` |
| `ConnectionStatus` | `'connected' \| 'disconnected' \| 'checking'` |
| `ProviderConfig` | Provider initialization configuration |
| `ProviderState` | Runtime provider state |
| `ModelCapabilities` | Feature flags (streaming, vision, toolCalling, etc.) |
| `ModelInfo` | Complete model information with capabilities and costs |
| `NormalizedMessage` | Unified message format across providers |
| `GenerationRequest` | Unified request parameters |
| `GenerationResponse` | Unified response with usage statistics |
| `StreamOptions` | Streaming callbacks (onChunk, onStart, onComplete, onError) |
| `RateLimitConfig` | Rate limit settings per provider |
| `RateLimitState` | Current rate limit status |
| `ProviderErrorCode` | Typed error codes (AUTH_ERROR, RATE_LIMIT, etc.) |
| `ProviderError` | Structured error with retry information |

**Technical Decisions:**
- **ModelCapabilities** includes: `streaming`, `structuredOutput`, `toolCalling`, `vision`, `maxContextTokens`, `maxOutputTokens`
- **NormalizedMessage** supports both string content and content blocks (for future multimodal)
- **GenerationResponse** includes `finishReason`: `'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error'`

**Implementation:**

```typescript
import type { LanguageModel } from 'ai';

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderId = 'openai' | 'anthropic' | 'ollama';

export type AuthStatus = 'valid' | 'invalid' | 'missing' | 'unknown';

export type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  requiresApiKey: boolean;
  apiKeyEnvVar?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

export interface ProviderState {
  id: ProviderId;
  authStatus: AuthStatus;
  connectionStatus: ConnectionStatus;
  availableModels: ModelInfo[];
  rateLimitState: RateLimitState;
  lastError?: ProviderError;
}

// ============================================================================
// Model Types
// ============================================================================

export interface ModelCapabilities {
  streaming: boolean;
  structuredOutput: boolean;
  toolCalling: boolean;
  vision: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  providerId: ProviderId;
  description?: string;
  capabilities: ModelCapabilities;
  inputCostPer1M?: number;
  outputCostPer1M?: number;
  deprecated?: boolean;
}

// ============================================================================
// Message Types (Normalized Format)
// ============================================================================

export type NormalizedRole = 'system' | 'user' | 'assistant' | 'tool';

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; imageUrl: string; mimeType?: string }
  | { type: 'tool_call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool_result'; toolCallId: string; result: unknown };

export interface NormalizedMessage {
  role: NormalizedRole;
  content: string | ContentBlock[];
  metadata?: {
    modelId?: string;
    providerId?: ProviderId;
    timestamp?: number;
  };
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface GenerationRequest {
  modelId: string;
  providerId?: ProviderId;
  messages: NormalizedMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  abortSignal?: AbortSignal;
}

export interface StreamOptions {
  onChunk?: (chunk: string) => void;
  onStart?: () => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: ProviderError) => void;
}

export interface GenerationResponse {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  modelId: string;
  providerId: ProviderId;
  durationMs: number;
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error';
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute?: number;
  maxConcurrent: number;
  burstAllowance?: number;
}

export interface RateLimitState {
  availableRequests: number;
  availableTokens?: number;
  currentConcurrent: number;
  nextRequestInMs: number;
  isLimited: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export type ProviderErrorCode =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'QUOTA_EXCEEDED'
  | 'MODEL_NOT_FOUND'
  | 'CONTENT_FILTER'
  | 'CONTEXT_LENGTH'
  | 'CONNECTION_ERROR'
  | 'TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN';

export interface ProviderError {
  code: ProviderErrorCode;
  message: string;
  providerId: ProviderId;
  statusCode?: number;
  retryable: boolean;
  retryAfterMs?: number;
  originalError?: unknown;
}
```

---

### Step 2.2: Custom Error Classes

**File:** `src/lib/ai/core/errors.ts`

**Purpose:** Provide typed error classes for consistent error handling across providers.

**Error Classes to Implement:**

| Class | Error Code | Retryable | Use Case |
|-------|-----------|-----------|----------|
| `AIProviderError` | (base class) | varies | Base for all AI errors |
| `AuthenticationError` | `AUTH_ERROR` | No | Invalid/missing API key |
| `RateLimitError` | `RATE_LIMIT` | Yes | Rate limit exceeded |
| `ConnectionError` | `CONNECTION_ERROR` | Yes | Network/server issues |
| `ModelNotFoundError` | `MODEL_NOT_FOUND` | No | Model doesn't exist |
| `TimeoutError` | `TIMEOUT` | Yes | Request timed out |

**Key Function:** `mapProviderError(error: unknown, providerId: ProviderId): AIProviderError`
- Maps provider-specific errors (HTTP status codes, error messages) to unified error types
- Extracts `retry-after` headers for rate limit errors
- Preserves original error for debugging

**Technical Decisions:**
- All errors extend base `AIProviderError` which implements `ProviderError` interface
- `retryable` property indicates if operation can be retried
- `retryAfterMs` provides hint for retry timing

**Implementation:**

```typescript
import type { ProviderError, ProviderErrorCode, ProviderId } from './types';

export class AIProviderError extends Error implements ProviderError {
  public readonly code: ProviderErrorCode;
  public readonly providerId: ProviderId;
  public readonly statusCode?: number;
  public readonly retryable: boolean;
  public readonly retryAfterMs?: number;
  public readonly originalError?: unknown;

  constructor(params: ProviderError) {
    super(params.message);
    this.name = 'AIProviderError';
    this.code = params.code;
    this.providerId = params.providerId;
    this.statusCode = params.statusCode;
    this.retryable = params.retryable;
    this.retryAfterMs = params.retryAfterMs;
    this.originalError = params.originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AIProviderError);
    }
  }

  static fromUnknown(error: unknown, providerId: ProviderId): AIProviderError {
    if (error instanceof AIProviderError) {
      return error;
    }
    const message = error instanceof Error ? error.message : String(error);
    return new AIProviderError({
      code: 'UNKNOWN',
      message,
      providerId,
      retryable: false,
      originalError: error,
    });
  }
}

export class AuthenticationError extends AIProviderError {
  constructor(providerId: ProviderId, message?: string) {
    super({
      code: 'AUTH_ERROR',
      message: message || `Authentication failed for provider: ${providerId}`,
      providerId,
      statusCode: 401,
      retryable: false,
    });
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends AIProviderError {
  constructor(providerId: ProviderId, retryAfterMs: number, message?: string) {
    super({
      code: 'RATE_LIMIT',
      message: message || `Rate limit exceeded for provider: ${providerId}`,
      providerId,
      statusCode: 429,
      retryable: true,
      retryAfterMs,
    });
    this.name = 'RateLimitError';
  }
}

export class ConnectionError extends AIProviderError {
  constructor(providerId: ProviderId, message?: string) {
    super({
      code: 'CONNECTION_ERROR',
      message: message || `Failed to connect to provider: ${providerId}`,
      providerId,
      retryable: true,
      retryAfterMs: 5000,
    });
    this.name = 'ConnectionError';
  }
}

export class ModelNotFoundError extends AIProviderError {
  constructor(providerId: ProviderId, modelId: string) {
    super({
      code: 'MODEL_NOT_FOUND',
      message: `Model "${modelId}" not found for provider: ${providerId}`,
      providerId,
      statusCode: 404,
      retryable: false,
    });
    this.name = 'ModelNotFoundError';
  }
}

export class TimeoutError extends AIProviderError {
  constructor(providerId: ProviderId, timeoutMs: number) {
    super({
      code: 'TIMEOUT',
      message: `Request timed out after ${timeoutMs}ms for provider: ${providerId}`,
      providerId,
      retryable: true,
      retryAfterMs: 1000,
    });
    this.name = 'TimeoutError';
  }
}

export function mapProviderError(error: unknown, providerId: ProviderId): AIProviderError {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new ConnectionError(providerId, 'Network request failed');
  }

  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    const message = (error as { message?: string }).message || 'Unknown error';

    switch (status) {
      case 401:
        return new AuthenticationError(providerId, message);
      case 429:
        const retryAfter = extractRetryAfter(error);
        return new RateLimitError(providerId, retryAfter, message);
      case 404:
        return new AIProviderError({
          code: 'MODEL_NOT_FOUND',
          message,
          providerId,
          statusCode: 404,
          retryable: false,
        });
      case 400:
        return new AIProviderError({
          code: 'VALIDATION_ERROR',
          message,
          providerId,
          statusCode: 400,
          retryable: false,
        });
      default:
        return new AIProviderError({
          code: 'PROVIDER_ERROR',
          message,
          providerId,
          statusCode: status,
          retryable: status >= 500,
          originalError: error,
        });
    }
  }

  return AIProviderError.fromUnknown(error, providerId);
}

function extractRetryAfter(error: unknown): number {
  const DEFAULT_RETRY_MS = 60000;

  if (error && typeof error === 'object') {
    const headers = (error as { headers?: Record<string, string> }).headers;
    if (headers?.['retry-after']) {
      const seconds = parseInt(headers['retry-after'], 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
    }
    const retryAfterMs = (error as { retryAfterMs?: number }).retryAfterMs;
    if (typeof retryAfterMs === 'number') {
      return retryAfterMs;
    }
  }

  return DEFAULT_RETRY_MS;
}
```

---

### Step 2.3: Abstract Provider Interface

**File:** `src/lib/ai/providers/base.ts`

**Purpose:** Define the contract that all provider implementations must follow.

**Interface Methods:**

```typescript
AIProvider {
  // Identity
  id: ProviderId
  name: string
  config: ProviderConfig

  // Lifecycle
  initialize(apiKey?: string): Promise<void>
  isInitialized(): boolean
  dispose(): Promise<void>

  // Authentication
  validateApiKey(apiKey?: string): Promise<AuthStatus>
  getAuthStatus(): AuthStatus
  setApiKey(apiKey: string): void

  // Connection
  checkConnection(): Promise<ConnectionStatus>
  getConnectionStatus(): ConnectionStatus

  // Models
  getAvailableModels(): Promise<ModelInfo[]>
  getModelInfo(modelId: string): Promise<ModelInfo | undefined>
  hasModel(modelId: string): Promise<boolean>
  getLanguageModel(modelId: string): LanguageModel

  // Generation
  generateText(request: GenerationRequest): Promise<GenerationResponse>
  streamText(request: GenerationRequest, options: StreamOptions): Promise<GenerationResponse>

  // State
  getState(): Promise<ProviderState>
}
```

**Abstract Base Class:** `BaseProvider`
- Provides shared implementation for common methods
- Subclasses override `_performKeyValidation()` for provider-specific logic
- Manages internal state (`_authStatus`, `_connectionStatus`, `_initialized`)

**Technical Decisions:**
- Interface + Abstract Class pattern enables both contract enforcement and code reuse
- Protected methods (`_performKeyValidation`) allow subclass customization
- `getLanguageModel()` returns AI SDK `LanguageModel` type for direct use with `generateText`/`streamText`

**Implementation:**

```typescript
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

  protected async _performKeyValidation(apiKey: string): Promise<boolean> {
    return apiKey.length > 0;
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
```

---

### Step 2.4: Provider Registry System

**File:** `src/lib/ai/providers/registry.ts`

**Purpose:** Central registration and lookup system for providers.

**Key Features:**

| Feature | Description |
|---------|-------------|
| Singleton Pattern | `ProviderRegistry.getInstance()` for global access |
| Auto-initialization | Optionally initialize providers on registration |
| Lifecycle Management | Dispose existing provider when re-registering |
| Model Discovery | `findProviderForModel(modelId)` searches all providers |
| State Aggregation | `getAllStates()` returns states for all providers |

**Key Methods:**
- `register(provider: AIProvider): Promise<void>` - Register/re-register provider
- `unregister(providerId: ProviderId): Promise<void>` - Remove provider
- `get(providerId: ProviderId): AIProvider` - Get provider (throws if not found)
- `getOptional(providerId: ProviderId): AIProvider | undefined` - Get without throwing
- `getAllModels(): Promise<ModelInfo[]>` - Aggregate models from all providers

**Exported Convenience Functions:**
- `getProvider(providerId)` - Alias for `providerRegistry.get()`
- `getAllModels()` - Alias for `providerRegistry.getAllModels()`

**Implementation:**

```typescript
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
      throw new ModelNotFoundError('unknown' as ProviderId, modelId);
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
```

---

### Step 2.5: OpenAI Provider Implementation

**File:** `src/lib/ai/providers/openai.ts`

**Purpose:** Concrete implementation for OpenAI models using `@ai-sdk/openai`.

**Static Model Registry:**

| Model ID | Name | Context | Vision | Cost (Input/Output per 1M) |
|----------|------|---------|--------|---------------------------|
| `gpt-4o` | GPT-4o | 128K | Yes | $2.50 / $10.00 |
| `gpt-4o-mini` | GPT-4o Mini | 128K | Yes | $0.15 / $0.60 |
| `gpt-4-turbo` | GPT-4 Turbo | 128K | Yes | $10.00 / $30.00 |
| `o1` | o1 | 200K | Yes | $15.00 / $60.00 |
| `o1-mini` | o1 Mini | 128K | No | $3.00 / $12.00 |

**Implementation Details:**
- Uses `createOpenAI({ apiKey })` for runtime key injection
- Falls back to default `openai` instance for env var keys
- Key validation prefix check: `sk-`
- Key validation via minimal API call to `gpt-4o-mini`

**Technical Decisions:**
- Allows unknown models (OpenAI has many models not in static list)
- Maps AI SDK finish reasons to normalized format
- Exports singleton `openaiProvider` for convenience

---

### Step 2.6: Anthropic Provider Implementation

**File:** `src/lib/ai/providers/anthropic.ts`

**Purpose:** Concrete implementation for Anthropic Claude models using `@ai-sdk/anthropic`.

**Static Model Registry:**

| Model ID | Name | Context | Output | Cost (Input/Output per 1M) |
|----------|------|---------|--------|---------------------------|
| `claude-opus-4-20250514` | Claude Opus 4 | 200K | 32K | $15.00 / $75.00 |
| `claude-sonnet-4-20250514` | Claude Sonnet 4 | 200K | 64K | $3.00 / $15.00 |
| `claude-3-5-haiku-20241022` | Claude 3.5 Haiku | 200K | 8K | $0.80 / $4.00 |
| `claude-3-5-sonnet-20241022` | Claude 3.5 Sonnet (v2) | 200K | 8K | $3.00 / $15.00 |

**Implementation Details:**
- Uses `createAnthropic({ apiKey })` for runtime key injection
- Key validation prefix check: `sk-ant-`
- Handles Anthropic-specific finish reasons (`end_turn`, `max_tokens`, `tool_use`)

**Technical Decisions:**
- Identical structure to OpenAI provider for consistency
- Different finish reason mapping (Anthropic uses different terminology)

---

### Step 2.7: Ollama Provider Implementation

**File:** `src/lib/ai/providers/ollama.ts`

**Purpose:** Concrete implementation for local Ollama models with dynamic model discovery.

**Key Differences from Cloud Providers:**
- **No API key required** - local server
- **Dynamic model discovery** - fetches from running Ollama server
- **Connection checking** - validates server availability

**Implementation Details:**

| Feature | Implementation |
|---------|----------------|
| Default URL | `http://localhost:11434` |
| Model Discovery | `GET /api/tags` endpoint |
| Connection Check | 5-second timeout on `/api/tags` |
| Capability Inference | Parse model name/family for vision, tool calling |
| Context Length | Infer from parameter size (7B=8K, 70B=128K) |

**Model Discovery Flow:**
1. `checkConnection()` - verify server is running
2. `refreshModels()` - fetch models from `/api/tags`
3. `parseOllamaModel()` - convert to `ModelInfo` format
4. `inferCapabilities()` - guess capabilities from model metadata

**Technical Decisions:**
- Uses `ollama-ai-provider-v2` package (community maintained)
- Graceful handling when Ollama not running (empty model list, no crash)
- `refreshModels()` called on `getAvailableModels()` to catch new downloads

---

### Step 2.8: Token Bucket Rate Limiter

**File:** `src/lib/ai/rate-limiting/token-bucket.ts`

**Purpose:** Implement token bucket algorithm for rate limiting.

**Algorithm:**
1. Bucket has `maxTokens` capacity
2. Tokens refill at `tokensPerSecond` rate
3. Each request consumes tokens
4. If insufficient tokens, request is delayed/rejected

**Class: `TokenBucket`**
```typescript
constructor(tokensPerSecond: number, maxTokens?: number)
tryConsume(count?: number): boolean
getTimeUntilAvailable(count?: number): number
getAvailableTokens(): number
hasTokens(count?: number): boolean
reset(): void
```

**Technical Decisions:**
- Burst capacity via `maxTokens` parameter
- Time-based refill calculation on each operation
- No background timers (lazy refill)

**Implementation:**

```typescript
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(tokensPerSecond: number, maxTokens?: number) {
    this.maxTokens = maxTokens ?? tokensPerSecond;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.refillRate = tokensPerSecond / 1000;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  tryConsume(count: number = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  getTimeUntilAvailable(count: number = 1): number {
    this.refill();
    if (this.tokens >= count) {
      return 0;
    }
    const tokensNeeded = count - this.tokens;
    return Math.ceil(tokensNeeded / this.refillRate);
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  hasTokens(count: number = 1): boolean {
    this.refill();
    return this.tokens >= count;
  }

  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}
```

---

### Step 2.9: Provider Rate Limiter

**File:** `src/lib/ai/rate-limiting/rate-limiter.ts`

**Purpose:** Provider-aware rate limiting with concurrent request tracking.

**Default Rate Limits:**

| Provider | Requests/min | Tokens/min | Max Concurrent | Burst |
|----------|-------------|-----------|----------------|-------|
| OpenAI | 500 | 30,000 | 10 | 50 |
| Anthropic | 50 | 40,000 | 5 | 10 |
| Ollama | 1000 | - | 2 | - |

**Class: `ProviderRateLimiter`**
- `acquire(estimatedTokens?)` - Get permission (throws `RateLimitError` if limited)
- `release(actualTokens?)` - Release slot after request
- `getState(): RateLimitState` - Current status

**Singleton: `rateLimiterManager`**
- `get(providerId)` - Get/create limiter for provider
- `configure(providerId, config)` - Update limits
- `getAllStates()` - Aggregate state

**Technical Decisions:**
- Concurrent request limit for CPU/GPU-bound Ollama (2)
- Higher limits for cloud APIs (10 for OpenAI)
- Token-based limiting optional (some APIs only limit requests)

---

### Step 2.10: Retry Logic with Exponential Backoff

**File:** `src/lib/ai/utils/retry.ts`

**Purpose:** Automatic retry for transient failures.

**Default Configuration:**
| Setting | Default | Description |
|---------|---------|-------------|
| `maxRetries` | 3 | Maximum retry attempts |
| `initialDelayMs` | 1000 | First retry delay |
| `maxDelayMs` | 30000 | Maximum delay cap |
| `backoffMultiplier` | 2 | Exponential factor |
| `jitter` | true | Random variance (0-50%) |

**Formula:** `delay = min(initialDelay * (multiplier ^ attempt), maxDelay) * jitterFactor`

**Main Function:** `withRetry<T>(fn: () => Promise<T>, config?): Promise<T>`

**Default Retryable Conditions:**
- `AIProviderError` with `retryable: true`
- Network/fetch errors
- HTTP 5xx errors
- HTTP 429 (rate limit)

**Technical Decisions:**
- Jitter prevents thundering herd on coordinated retries
- Respects `retryAfterMs` from `RateLimitError`
- Callback `onRetry` for logging/monitoring

**Implementation:**

```typescript
import { AIProviderError } from '../core/errors';

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

function calculateDelay(attempt: number, config: RetryConfig, retryAfterMs?: number): number {
  if (retryAfterMs && retryAfterMs > 0) {
    return Math.min(retryAfterMs, config.maxDelayMs);
  }

  let delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  delay = Math.min(delay, config.maxDelayMs);

  if (config.jitter) {
    const jitterFactor = 0.5 + Math.random() * 0.5;
    delay = Math.floor(delay * jitterFactor);
  }

  return delay;
}

function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof AIProviderError) {
    return error.retryable;
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    return status >= 500 || status === 429;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const isRetryable = fullConfig.isRetryable ?? defaultIsRetryable;

  let lastError: unknown;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= fullConfig.maxRetries || !isRetryable(error)) {
        throw error;
      }

      const retryAfterMs = error instanceof AIProviderError ? error.retryAfterMs : undefined;
      const delay = calculateDelay(attempt, fullConfig, retryAfterMs);

      fullConfig.onRetry?.(error, attempt + 1, delay);

      await sleep(delay);
    }
  }

  throw lastError;
}

export function createRetryWrapper(config: Partial<RetryConfig>): <T>(fn: () => Promise<T>) => Promise<T> {
  return <T>(fn: () => Promise<T>) => withRetry(fn, config);
}
```

---

### Step 2.11: Message Format Normalizer

**File:** `src/lib/ai/utils/message-normalizer.ts`

**Purpose:** Normalize message formats across provider expectations.

**Main Function:** `normalizeMessagesForProvider(messages, providerId, systemPrompt?)`

**Provider-Specific Handling:**

| Provider | Special Requirements |
|----------|---------------------|
| Anthropic | System must be first; messages must alternate user/assistant; first non-system must be user |
| OpenAI | Flexible, minimal normalization |
| Ollama | Follows OpenAI format |

**Helper Functions:**
- `createMessage(role, content, metadata?)` - Create normalized message
- `toNormalizedMessages(aiSdkMessages, providerId, modelId?)` - Convert from AI SDK format

**Technical Decisions:**
- Anthropic's alternating requirement handled by merging consecutive same-role messages
- Empty messages filtered out
- Content blocks (array) converted to string (text blocks concatenated)

---

### Step 2.12: Authentication Manager

**File:** `src/lib/ai/auth/manager.ts`

**Purpose:** Centralized API key management with runtime updates.

**Key Sources:**
- `'environment'` - From `process.env`
- `'runtime'` - Set via `setApiKey()`
- `'none'` - Not configured

**Environment Variable Mapping:**
| Provider | Env Var |
|----------|---------|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Ollama | (none required) |

**Singleton: `authManager`**
- `initialize()` - Load from environment
- `getApiKey(providerId)` - Get current key
- `setApiKey(providerId, key)` - Set runtime key (updates provider)
- `getAuthStatus(providerId, forceValidate?)` - Validate with caching (5 min)
- `getMaskedKey(providerId)` - For UI display (`****abcd`)

**Technical Decisions:**
- 5-minute validation cache to avoid repeated API calls
- Setting key resets validation status
- Synchronizes with provider when key changes

---

### Step 2.13: Public API Exports

**File:** `src/lib/ai/index.ts`

**Purpose:** Clean public API and initialization helper.

**Exported Categories:**
1. **Types** - All interfaces and type aliases
2. **Errors** - All error classes and `mapProviderError`
3. **Provider Interface** - `AIProvider`, `BaseProvider`
4. **Registry** - `providerRegistry`, `getProvider`, `getAllModels`
5. **Built-in Providers** - `openaiProvider`, `anthropicProvider`, `ollamaProvider`
6. **Rate Limiting** - `TokenBucket`, `ProviderRateLimiter`, `rateLimiterManager`
7. **Utilities** - `withRetry`, `normalizeMessagesForProvider`, etc.
8. **Auth** - `authManager`

**Initialization Helper:**
```typescript
async function initializeAI(options?: {
  apiKeys?: Partial<Record<ProviderId, string>>;
  ollamaBaseUrl?: string;
  autoInitialize?: boolean;
}): Promise<void>
```

**Convenience Function:**
```typescript
async function generate(
  modelId: string,
  prompt: string,
  options?: { providerId?, temperature?, maxTokens?, systemPrompt? }
): Promise<string>
```

---

### Step 2.14: Update Application Types

**File:** `src/types/index.ts` (update from Step 1)

**Changes:**
- Re-export AI types from `@/lib/ai`
- Add `providerId` to `DiscussionMessage`
- Add `tokenUsage` and `durationMs` to `DiscussionMessage`
- Update `DiscussionConfig` to include `providerId` for each model
- Update `StartDiscussionRequest` to include provider IDs

---

## Dependencies

**New Packages to Install:**
```bash
npm install ollama-ai-provider-v2
```

**Already from Step 1:**
- `ai` (Vercel AI SDK core)
- `@ai-sdk/openai`
- `@ai-sdk/anthropic`

---

## Environment Variables

**Update `.env.local.example`:**
```env
# OpenAI (required for OpenAI models)
OPENAI_API_KEY=sk-your-openai-key-here

# Anthropic (required for Claude models)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# Ollama (optional - for local models)
OLLAMA_BASE_URL=http://localhost:11434
```

---

## Verification Steps

### 2.15.1: Unit Tests
Create `src/lib/ai/__tests__/providers.test.ts`:
- Test provider registration
- Test model availability
- Test error mapping
- Test rate limiter

### 2.15.2: Integration Tests
Create `src/lib/ai/__tests__/integration.test.ts`:
- Test text generation with each provider (requires API keys)
- Test streaming callbacks
- Test retry logic

### 2.15.3: Manual Verification Checklist

| Category | Check | Status |
|----------|-------|--------|
| **Registration** | All three providers register successfully | |
| **Registration** | `getAllModels()` returns combined list | |
| **Auth** | OpenAI key validation works | |
| **Auth** | Anthropic key validation works | |
| **Auth** | Invalid keys rejected | |
| **Ollama** | Connection check passes when running | |
| **Ollama** | Connection check fails gracefully when not running | |
| **Ollama** | Models discovered dynamically | |
| **Generation** | `generateText` returns complete response | |
| **Generation** | `streamText` fires callbacks in order | |
| **Rate Limit** | Limiter prevents burst requests | |
| **Errors** | Network errors map to ConnectionError | |
| **Errors** | 401 maps to AuthenticationError | |
| **Errors** | 429 maps to RateLimitError | |

### 2.15.4: Development Server Test
```bash
npm run dev
# Open http://localhost:3000
# Check browser console for initialization errors
```

### 2.15.5: Build Verification
```bash
npm run build
# Ensure no TypeScript errors
```

---

## Files to Create/Modify Summary

| File | Action |
|------|--------|
| `src/lib/ai/core/types.ts` | Create |
| `src/lib/ai/core/errors.ts` | Create |
| `src/lib/ai/providers/base.ts` | Create |
| `src/lib/ai/providers/registry.ts` | Create |
| `src/lib/ai/providers/openai.ts` | Create |
| `src/lib/ai/providers/anthropic.ts` | Create |
| `src/lib/ai/providers/ollama.ts` | Create |
| `src/lib/ai/rate-limiting/token-bucket.ts` | Create |
| `src/lib/ai/rate-limiting/rate-limiter.ts` | Create |
| `src/lib/ai/utils/retry.ts` | Create |
| `src/lib/ai/utils/message-normalizer.ts` | Create |
| `src/lib/ai/auth/manager.ts` | Create |
| `src/lib/ai/index.ts` | Create |
| `src/types/index.ts` | Modify |
| `.env.local.example` | Modify |

---

## Key Technical Decisions Summary

| Decision | Rationale |
|----------|-----------|
| Interface + Abstract Class pattern | Contract enforcement + code reuse |
| Singleton ProviderRegistry | Single source of truth, global access |
| Static model registries for cloud providers | Known models with capabilities/costs |
| Dynamic model discovery for Ollama | Local models change frequently |
| Token bucket rate limiting | Industry standard, supports bursting |
| Per-provider rate limit defaults | Different APIs have different limits |
| Exponential backoff with jitter | Prevents thundering herd |
| 5-minute auth validation cache | Reduce redundant API calls |
| Provider-specific message normalization | Each API has different requirements |
| Error mapping with retry hints | Enables automatic recovery |

---

## Summary Checklist

| Step | Task | Status |
|------|------|--------|
| 2.1 | Create `src/lib/ai/core/types.ts` | Pending |
| 2.2 | Create `src/lib/ai/core/errors.ts` | Pending |
| 2.3 | Create `src/lib/ai/providers/base.ts` | Pending |
| 2.4 | Create `src/lib/ai/providers/registry.ts` | Pending |
| 2.5 | Create `src/lib/ai/providers/openai.ts` | Pending |
| 2.6 | Create `src/lib/ai/providers/anthropic.ts` | Pending |
| 2.7 | Create `src/lib/ai/providers/ollama.ts` | Pending |
| 2.8 | Create `src/lib/ai/rate-limiting/token-bucket.ts` | Pending |
| 2.9 | Create `src/lib/ai/rate-limiting/rate-limiter.ts` | Pending |
| 2.10 | Create `src/lib/ai/utils/retry.ts` | Pending |
| 2.11 | Create `src/lib/ai/utils/message-normalizer.ts` | Pending |
| 2.12 | Create `src/lib/ai/auth/manager.ts` | Pending |
| 2.13 | Create `src/lib/ai/index.ts` | Pending |
| 2.14 | Update `src/types/index.ts` | Pending |
| 2.15 | Run verification steps | Pending |
