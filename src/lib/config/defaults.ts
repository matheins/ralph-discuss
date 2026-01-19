import type {
  ModelParametersConfig,
  DiscussionSettingsConfig,
  ProvidersConfig,
  UIConfig,
  AppConfig,
} from './types';

// ============================================================================
// Parameter Bounds (for validation and UI sliders)
// ============================================================================

export const PARAMETER_BOUNDS = {
  // Model parameters
  temperature: { min: 0, max: 2, step: 0.1 },
  maxTokensPerTurn: { min: 256, max: 8192, step: 256 },
  topP: { min: 0, max: 1, step: 0.05 },
  frequencyPenalty: { min: 0, max: 2, step: 0.1 },
  presencePenalty: { min: 0, max: 2, step: 0.1 },

  // Discussion settings
  maxIterations: { min: 2, max: 20, step: 1 },
  turnTimeoutSeconds: { min: 30, max: 300, step: 30 },
  totalTimeoutMinutes: { min: 1, max: 30, step: 1 },
  minRoundsBeforeConsensus: { min: 1, max: 5, step: 1 },
} as const;

// ============================================================================
// Default Model Parameters
// ============================================================================

export const DEFAULT_MODEL_PARAMETERS: ModelParametersConfig = {
  temperature: 0.7,
  maxTokensPerTurn: 2048,
  topP: 1.0,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

// ============================================================================
// Default Discussion Settings
// ============================================================================

export const DEFAULT_DISCUSSION_SETTINGS: DiscussionSettingsConfig = {
  maxIterations: 10,
  turnTimeoutSeconds: 120,
  totalTimeoutMinutes: 15,
  minRoundsBeforeConsensus: 2,
  requireBothConsensus: true,
  autoScrollEnabled: true,
  showTokenUsage: false,
  showTimings: false,
};

// ============================================================================
// Default Provider Configuration
// ============================================================================

export const DEFAULT_PROVIDERS_CONFIG: ProvidersConfig = {
  openai: {
    providerId: 'openai',
    enabled: true,
    defaultModel: 'gpt-4o',
  },
  anthropic: {
    providerId: 'anthropic',
    enabled: true,
    defaultModel: 'claude-sonnet-4-20250514',
  },
  ollama: {
    providerId: 'ollama',
    enabled: false,
    baseUrl: 'http://localhost:11434',
  },
};

// ============================================================================
// Default UI Configuration
// ============================================================================

export const DEFAULT_UI_CONFIG: UIConfig = {
  theme: 'system',
  compactMode: false,
  soundEnabled: false,
};

// ============================================================================
// Full Default Configuration
// ============================================================================

export const DEFAULT_APP_CONFIG: Omit<AppConfig, 'apiKeys'> = {
  modelParameters: DEFAULT_MODEL_PARAMETERS,
  discussionSettings: DEFAULT_DISCUSSION_SETTINGS,
  providers: DEFAULT_PROVIDERS_CONFIG,
  ui: DEFAULT_UI_CONFIG,
};

// ============================================================================
// Model Parameter Presets
// ============================================================================

export type PresetName = 'creative' | 'balanced' | 'precise' | 'deterministic';

export interface ParameterPreset {
  name: PresetName;
  values: Partial<ModelParametersConfig>;
}

export const MODEL_PARAMETER_PRESETS: Record<PresetName, ParameterPreset> = {
  creative: {
    name: 'creative',
    values: {
      temperature: 1.2,
      topP: 0.95,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
    },
  },
  balanced: {
    name: 'balanced',
    values: {
      temperature: 0.7,
      topP: 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0,
    },
  },
  precise: {
    name: 'precise',
    values: {
      temperature: 0.3,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
    },
  },
  deterministic: {
    name: 'deterministic',
    values: {
      temperature: 0,
      topP: 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0,
    },
  },
};
