// Provider types (aligned with AI SDK)
export type ProviderId = 'openai' | 'anthropic' | 'ollama';

export interface ModelConfig {
  id: string;
  name: string;
  providerId: ProviderId;
  description?: string;
}

// Discussion types
export interface DiscussionMessage {
  id: string;
  role: 'model-a' | 'model-b' | 'system';
  content: string;
  modelId: string;
  modelName: string;
  timestamp: number;
  isConsensusCheck?: boolean;
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
  modelA: ModelConfig;
  modelB: ModelConfig;
  maxIterations: number;
  temperature: number;
}

// API types
export interface StartDiscussionRequest {
  prompt: string;
  modelAId: string;
  modelBId: string;
  maxIterations?: number;
  temperature?: number;
}

export interface StreamEvent {
  type: 'message-start' | 'content' | 'message-end' | 'consensus' | 'error' | 'done';
  data: {
    content?: string;
    role?: 'model-a' | 'model-b';
    modelId?: string;
    consensusSolution?: string;
    error?: string;
  };
}
