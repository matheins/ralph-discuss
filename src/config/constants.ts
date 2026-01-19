export const APP_CONFIG = {
  name: 'ralph-discuss',
  description: 'Iterative AI discussions for optimal solutions',
} as const;

export const DISCUSSION_DEFAULTS = {
  maxIterations: 10,
  temperature: 0.7,
  maxTokensPerResponse: 2048,
} as const;

export const MODEL_COLORS = {
  'model-a': {
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    accent: 'bg-blue-500',
  },
  'model-b': {
    bg: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    accent: 'bg-amber-500',
  },
} as const;
