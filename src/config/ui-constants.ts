// ============================================================================
// Model Display Configuration
// ============================================================================

export const MODEL_COLORS = {
  'model-a': {
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    accent: 'bg-blue-500',
    avatar: 'bg-blue-100 dark:bg-blue-900',
  },
  'model-b': {
    bg: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    accent: 'bg-amber-500',
    avatar: 'bg-amber-100 dark:bg-amber-900',
  },
} as const;

export const CONSENSUS_COLORS = {
  reached: {
    bg: 'bg-green-50 dark:bg-green-950',
    border: 'border-green-300 dark:border-green-700',
    text: 'text-green-800 dark:text-green-200',
    icon: 'text-green-600 dark:text-green-400',
  },
  pending: {
    bg: 'bg-gray-50 dark:bg-gray-900',
    border: 'border-gray-200 dark:border-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
  },
  failed: {
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
  },
} as const;

// ============================================================================
// Animation Configuration
// ============================================================================

export const ANIMATIONS = {
  streamingDots: 'animate-pulse',
  fadeIn: 'animate-in fade-in duration-300',
  slideUp: 'animate-in slide-in-from-bottom-2 duration-300',
} as const;

// ============================================================================
// Layout Configuration
// ============================================================================

export const LAYOUT = {
  maxMessageWidth: 'max-w-3xl',
  containerPadding: 'px-4 md:px-6 lg:px-8',
  messageGap: 'space-y-4',
  sectionGap: 'space-y-6',
} as const;

// ============================================================================
// Discussion Defaults
// ============================================================================

export const DISCUSSION_DEFAULTS = {
  maxIterations: 10,
  temperature: 0.7,
  maxTokensPerTurn: 2048,
  minPromptLength: 10,
  maxPromptLength: 10000,
} as const;

// ============================================================================
// Provider Display Names
// ============================================================================

export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama (Local)',
} as const;

// ============================================================================
// Status Messages
// ============================================================================

export const STATUS_MESSAGES: Record<string, string> = {
  idle: 'Ready to start discussion',
  initializing: 'Initializing discussion...',
  'model-a-turn': 'Model A is thinking...',
  'model-b-turn': 'Model B is responding...',
  'consensus-check-a': 'Model A evaluating consensus...',
  'consensus-check-b': 'Model B evaluating consensus...',
  completed: 'Discussion completed',
  error: 'An error occurred',
  aborted: 'Discussion aborted',
} as const;
