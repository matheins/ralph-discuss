import { z } from 'zod';
import { PARAMETER_BOUNDS } from './defaults';

// ============================================================================
// API Keys Schema
// ============================================================================

export const apiKeysSchema = z.object({
  openai: z.string().optional(),
  anthropic: z.string().optional(),
});

// ============================================================================
// Model Parameters Schema
// ============================================================================

const { temperature, maxTokensPerTurn, topP, frequencyPenalty, presencePenalty } = PARAMETER_BOUNDS;

export const modelParametersSchema = z.object({
  temperature: z
    .number()
    .min(temperature.min, `Temperature must be at least ${temperature.min}`)
    .max(temperature.max, `Temperature must be at most ${temperature.max}`),
  maxTokensPerTurn: z
    .number()
    .int('Max tokens must be an integer')
    .min(maxTokensPerTurn.min, `Max tokens must be at least ${maxTokensPerTurn.min}`)
    .max(maxTokensPerTurn.max, `Max tokens must be at most ${maxTokensPerTurn.max}`),
  topP: z
    .number()
    .min(topP.min, `Top P must be at least ${topP.min}`)
    .max(topP.max, `Top P must be at most ${topP.max}`),
  frequencyPenalty: z
    .number()
    .min(frequencyPenalty.min, `Frequency penalty must be at least ${frequencyPenalty.min}`)
    .max(frequencyPenalty.max, `Frequency penalty must be at most ${frequencyPenalty.max}`),
  presencePenalty: z
    .number()
    .min(presencePenalty.min, `Presence penalty must be at least ${presencePenalty.min}`)
    .max(presencePenalty.max, `Presence penalty must be at most ${presencePenalty.max}`),
});

// ============================================================================
// Discussion Settings Schema
// ============================================================================

const { maxIterations, turnTimeoutSeconds, totalTimeoutMinutes, minRoundsBeforeConsensus } = PARAMETER_BOUNDS;

export const discussionSettingsSchema = z.object({
  maxIterations: z
    .number()
    .int('Max iterations must be an integer')
    .min(maxIterations.min, `Max iterations must be at least ${maxIterations.min}`)
    .max(maxIterations.max, `Max iterations must be at most ${maxIterations.max}`),
  turnTimeoutSeconds: z
    .number()
    .int('Turn timeout must be an integer')
    .min(turnTimeoutSeconds.min, `Turn timeout must be at least ${turnTimeoutSeconds.min} seconds`)
    .max(turnTimeoutSeconds.max, `Turn timeout must be at most ${turnTimeoutSeconds.max} seconds`),
  totalTimeoutMinutes: z
    .number()
    .int('Total timeout must be an integer')
    .min(totalTimeoutMinutes.min, `Total timeout must be at least ${totalTimeoutMinutes.min} minutes`)
    .max(totalTimeoutMinutes.max, `Total timeout must be at most ${totalTimeoutMinutes.max} minutes`),
  minRoundsBeforeConsensus: z
    .number()
    .int('Min rounds must be an integer')
    .min(minRoundsBeforeConsensus.min)
    .max(minRoundsBeforeConsensus.max),
  requireBothConsensus: z.boolean(),
  autoScrollEnabled: z.boolean(),
  showTokenUsage: z.boolean(),
  showTimings: z.boolean(),
});

// ============================================================================
// Provider Config Schema
// ============================================================================

export const providerIdSchema = z.enum(['openai', 'anthropic', 'ollama']);

export const providerConfigSchema = z.object({
  providerId: providerIdSchema,
  enabled: z.boolean(),
  baseUrl: z.string().url('Invalid URL format').optional(),
  defaultModel: z.string().optional(),
});

export const providersConfigSchema = z.object({
  openai: providerConfigSchema,
  anthropic: providerConfigSchema,
  ollama: providerConfigSchema,
});

// ============================================================================
// UI Config Schema
// ============================================================================

export const uiConfigSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  compactMode: z.boolean(),
  soundEnabled: z.boolean(),
});

// ============================================================================
// Full App Config Schema
// ============================================================================

export const appConfigSchema = z.object({
  apiKeys: apiKeysSchema,
  modelParameters: modelParametersSchema,
  discussionSettings: discussionSettingsSchema,
  providers: providersConfigSchema,
  ui: uiConfigSchema,
});

// ============================================================================
// Partial Schemas (for updates)
// ============================================================================

export const partialModelParametersSchema = modelParametersSchema.partial();
export const partialDiscussionSettingsSchema = discussionSettingsSchema.partial();
export const partialProvidersConfigSchema = providersConfigSchema.partial();
export const partialUiConfigSchema = uiConfigSchema.partial();

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateConfig<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  }

  return { success: false, errors };
}

export function validateApiKeyFormat(providerId: string, key: string): boolean {
  switch (providerId) {
    case 'openai':
      return /^sk-[a-zA-Z0-9]{20,}$/.test(key);
    case 'anthropic':
      return /^sk-ant-[a-zA-Z0-9-]{20,}$/.test(key);
    case 'ollama':
      return true; // No key required
    default:
      return false;
  }
}
