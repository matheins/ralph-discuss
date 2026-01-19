export const PROTOCOL = {
  // Markers for structured consensus responses
  CONSENSUS_MARKER: '[CONSENSUS_CHECK]',
  SOLUTION_MARKER: '[PROPOSED_SOLUTION]',
  REASONING_MARKER: '[REASONING]',
  CONFIDENCE_MARKER: '[CONFIDENCE]',

  // Retry configuration
  MAX_CONSENSUS_RETRIES: 2,

  // Turn structure
  INITIAL_TURN_ORDER: 'model-a' as const,
} as const;

export const ROLE_DESCRIPTIONS = {
  'model-a': 'You are Model A in this discussion.',
  'model-b': 'You are Model B in this discussion.',
} as const;

export const KEEP_ALIVE_INTERVAL_MS = 15000; // 15 seconds
