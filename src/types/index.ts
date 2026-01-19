// Re-export AI types
export type {
  ProviderId,
  AuthStatus,
  ConnectionStatus,
  ProviderConfig,
  ProviderState,
  ModelCapabilities,
  ModelInfo,
  NormalizedMessage,
  GenerationRequest,
  GenerationResponse,
  StreamOptions,
  RateLimitConfig,
  RateLimitState,
  ProviderErrorCode,
  ProviderError,
} from '@/lib/ai';

// Discussion types
export interface DiscussionMessage {
  id: string;
  role: 'model-a' | 'model-b' | 'system';
  content: string;
  modelId: string;
  modelName: string;
  providerId: string;
  timestamp: number;
  isConsensusCheck?: boolean;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs?: number;
}

export interface DiscussionState {
  status: 'idle' | 'running' | 'consensus' | 'max-iterations' | 'error';
  messages: DiscussionMessage[];
  currentTurn: 'model-a' | 'model-b';
  iteration: number;
  consensusSolution?: string;
  error?: string;
}

export interface DiscussionConfig {
  prompt: string;
  modelA: {
    id: string;
    name: string;
    providerId: string;
  };
  modelB: {
    id: string;
    name: string;
    providerId: string;
  };
  maxIterations: number;
  temperature: number;
}

// API types
export interface StartDiscussionRequest {
  prompt: string;
  modelAId: string;
  modelAProviderId: string;
  modelBId: string;
  modelBProviderId: string;
  maxIterations?: number;
  temperature?: number;
}

export interface StreamEvent {
  type: 'message-start' | 'content' | 'message-end' | 'consensus' | 'error' | 'done';
  data: {
    content?: string;
    role?: 'model-a' | 'model-b';
    modelId?: string;
    providerId?: string;
    consensusSolution?: string;
    error?: string;
  };
}
