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
