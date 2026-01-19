// ============================================================================
// Configuration Types
// ============================================================================

// API Key Configuration
export interface ApiKeyConfig {
  openai?: string;
  anthropic?: string;
}

export interface ApiKeyStatus {
  providerId: string;
  isConfigured: boolean;
  isValid: boolean | null;
  lastValidated: number | null;
  errorMessage?: string;
}

export interface ApiKeyValidationResult {
  providerId: string;
  isValid: boolean;
  errorMessage?: string;
  modelsAvailable?: number;
  validatedAt: number;
}

// ============================================================================
// Model Parameters Configuration
// ============================================================================

export interface ModelParametersConfig {
  temperature: number;
  maxTokensPerTurn: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

// ============================================================================
// Discussion Settings Configuration
// ============================================================================

export interface DiscussionSettingsConfig {
  maxIterations: number;
  turnTimeoutSeconds: number;
  totalTimeoutMinutes: number;
  minRoundsBeforeConsensus: number;
  requireBothConsensus: boolean;
  autoScrollEnabled: boolean;
  showTokenUsage: boolean;
  showTimings: boolean;
}

// ============================================================================
// Provider Configuration
// ============================================================================

export interface ProviderConfig {
  providerId: 'openai' | 'anthropic' | 'ollama';
  enabled: boolean;
  baseUrl?: string;
  defaultModel?: string;
}

export interface ProvidersConfig {
  openai: ProviderConfig;
  anthropic: ProviderConfig;
  ollama: ProviderConfig;
}

// ============================================================================
// UI Configuration
// ============================================================================

export interface UIConfig {
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  soundEnabled: boolean;
}

// ============================================================================
// Full Application Configuration
// ============================================================================

export interface AppConfig {
  apiKeys: ApiKeyConfig;
  modelParameters: ModelParametersConfig;
  discussionSettings: DiscussionSettingsConfig;
  providers: ProvidersConfig;
  ui: UIConfig;
}

// ============================================================================
// Settings Section Type
// ============================================================================

export type SettingsSection =
  | 'apiKeys'
  | 'modelParameters'
  | 'discussionSettings'
  | 'providers'
  | 'ui';
