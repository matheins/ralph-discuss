import type { PresetName } from '@/lib/config/defaults';

// ============================================================================
// Section Labels and Descriptions
// ============================================================================

export const SETTINGS_SECTIONS = {
  apiKeys: {
    title: 'API Keys',
    description: 'Configure API keys for AI providers. Keys are stored securely and never shared.',
    icon: 'key',
  },
  modelParameters: {
    title: 'Model Parameters',
    description: 'Adjust how the AI models generate responses.',
    icon: 'sliders',
  },
  discussionSettings: {
    title: 'Discussion Settings',
    description: 'Configure discussion behavior and safety limits.',
    icon: 'message-square',
  },
  providers: {
    title: 'Providers',
    description: 'Enable or disable AI providers and configure endpoints.',
    icon: 'server',
  },
  ui: {
    title: 'Appearance',
    description: 'Customize the look and feel of the application.',
    icon: 'palette',
  },
} as const;

// ============================================================================
// Parameter Labels and Help Text
// ============================================================================

export const PARAMETER_LABELS = {
  // Model Parameters
  temperature: {
    label: 'Temperature',
    description: 'Controls randomness. Lower values make output more focused and deterministic.',
    tooltip: '0 = deterministic, 1 = balanced, 2 = very creative',
  },
  maxTokensPerTurn: {
    label: 'Max Tokens per Turn',
    description: 'Maximum length of each model response.',
    tooltip: 'Higher values allow longer responses but cost more',
  },
  topP: {
    label: 'Top P (Nucleus Sampling)',
    description: 'Alternative to temperature. Considers tokens with top P probability mass.',
    tooltip: '1.0 = consider all tokens, 0.1 = only top 10% probability',
  },
  frequencyPenalty: {
    label: 'Frequency Penalty',
    description: 'Reduces repetition of frequently used tokens.',
    tooltip: '0 = no penalty, 2 = strong penalty for repetition',
  },
  presencePenalty: {
    label: 'Presence Penalty',
    description: 'Encourages discussing new topics.',
    tooltip: '0 = no penalty, 2 = strong push for new topics',
  },

  // Discussion Settings
  maxIterations: {
    label: 'Maximum Rounds',
    description: 'Safety limit on discussion length to prevent runaway conversations.',
    tooltip: 'Discussion stops after this many rounds if no consensus',
  },
  turnTimeoutSeconds: {
    label: 'Turn Timeout',
    description: 'Maximum time to wait for a single model response.',
    tooltip: 'In seconds. Increase for slower models or complex prompts',
  },
  totalTimeoutMinutes: {
    label: 'Total Timeout',
    description: 'Maximum total discussion time.',
    tooltip: 'In minutes. Prevents extremely long discussions',
  },
  minRoundsBeforeConsensus: {
    label: 'Minimum Rounds',
    description: 'Models must discuss for at least this many rounds before consensus can be reached.',
    tooltip: 'Prevents premature agreement on first exchange',
  },
  requireBothConsensus: {
    label: 'Require Unanimous Consensus',
    description: 'Both models must agree for consensus to be reached.',
    tooltip: 'If disabled, consensus is reached when either model agrees',
  },
  autoScrollEnabled: {
    label: 'Auto-scroll',
    description: 'Automatically scroll to latest content during discussion.',
  },
  showTokenUsage: {
    label: 'Show Token Usage',
    description: 'Display token counts for each turn.',
  },
  showTimings: {
    label: 'Show Timings',
    description: 'Display response times for each turn.',
  },
} as const;

// ============================================================================
// Provider Labels
// ============================================================================

export const PROVIDER_LABELS = {
  openai: {
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4 Turbo, and other OpenAI models',
    keyPlaceholder: 'sk-...',
    keyHint: 'Get your API key from platform.openai.com',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Claude Opus 4, Claude Sonnet, and other Claude models',
    keyPlaceholder: 'sk-ant-...',
    keyHint: 'Get your API key from console.anthropic.com',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  ollama: {
    name: 'Ollama (Local)',
    description: 'Run models locally with Ollama',
    baseUrlPlaceholder: 'http://localhost:11434',
    baseUrlHint: 'Default: http://localhost:11434',
    setupUrl: 'https://ollama.ai/download',
  },
} as const;

// ============================================================================
// Preset Labels
// ============================================================================

export const PRESET_LABELS: Record<PresetName, { name: string; description: string }> = {
  creative: {
    name: 'Creative',
    description: 'Higher temperature for varied, creative responses',
  },
  balanced: {
    name: 'Balanced',
    description: 'Default settings for general discussions',
  },
  precise: {
    name: 'Precise',
    description: 'Lower temperature for focused, consistent responses',
  },
  deterministic: {
    name: 'Deterministic',
    description: 'Zero temperature for reproducible outputs',
  },
};

// ============================================================================
// Status Labels
// ============================================================================

export const STATUS_LABELS = {
  apiKey: {
    configured: 'Configured',
    notConfigured: 'Not Configured',
    valid: 'Valid',
    invalid: 'Invalid',
    validating: 'Validating...',
    fromEnv: 'From Environment',
    fromRuntime: 'User Provided',
  },
  provider: {
    available: 'Available',
    unavailable: 'Unavailable',
    checking: 'Checking...',
    disabled: 'Disabled',
  },
};
