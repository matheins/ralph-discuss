import {
  modelParametersSchema,
  discussionSettingsSchema,
  validateConfig,
  validateApiKeyFormat,
} from '@/lib/config/schema';
import {
  DEFAULT_MODEL_PARAMETERS,
  DEFAULT_DISCUSSION_SETTINGS,
} from '@/lib/config/defaults';

describe('Configuration Schemas', () => {
  describe('modelParametersSchema', () => {
    it('validates correct default parameters', () => {
      const result = modelParametersSchema.safeParse(DEFAULT_MODEL_PARAMETERS);
      expect(result.success).toBe(true);
    });

    it('rejects temperature below minimum', () => {
      const result = modelParametersSchema.safeParse({
        ...DEFAULT_MODEL_PARAMETERS,
        temperature: -0.5,
      });
      expect(result.success).toBe(false);
    });

    it('rejects temperature above maximum', () => {
      const result = modelParametersSchema.safeParse({
        ...DEFAULT_MODEL_PARAMETERS,
        temperature: 2.5,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer maxTokensPerTurn', () => {
      const result = modelParametersSchema.safeParse({
        ...DEFAULT_MODEL_PARAMETERS,
        maxTokensPerTurn: 1024.5,
      });
      expect(result.success).toBe(false);
    });

    it('validates edge case values (minimums)', () => {
      const edgeCase = {
        temperature: 0,
        maxTokensPerTurn: 256,
        topP: 0,
        frequencyPenalty: 0,
        presencePenalty: 0,
      };
      const result = modelParametersSchema.safeParse(edgeCase);
      expect(result.success).toBe(true);
    });

    it('validates maximum values', () => {
      const maxCase = {
        temperature: 2,
        maxTokensPerTurn: 8192,
        topP: 1,
        frequencyPenalty: 2,
        presencePenalty: 2,
      };
      const result = modelParametersSchema.safeParse(maxCase);
      expect(result.success).toBe(true);
    });
  });

  describe('discussionSettingsSchema', () => {
    it('validates correct default settings', () => {
      const result = discussionSettingsSchema.safeParse(DEFAULT_DISCUSSION_SETTINGS);
      expect(result.success).toBe(true);
    });

    it('rejects maxIterations below minimum', () => {
      const result = discussionSettingsSchema.safeParse({
        ...DEFAULT_DISCUSSION_SETTINGS,
        maxIterations: 1, // Minimum is 2
      });
      expect(result.success).toBe(false);
    });

    it('rejects maxIterations above maximum', () => {
      const result = discussionSettingsSchema.safeParse({
        ...DEFAULT_DISCUSSION_SETTINGS,
        maxIterations: 100, // Maximum is 20
      });
      expect(result.success).toBe(false);
    });

    it('validates boolean settings', () => {
      const result = discussionSettingsSchema.safeParse({
        ...DEFAULT_DISCUSSION_SETTINGS,
        requireBothConsensus: false,
        autoScrollEnabled: false,
        showTokenUsage: true,
        showTimings: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-integer timeout values', () => {
      const result = discussionSettingsSchema.safeParse({
        ...DEFAULT_DISCUSSION_SETTINGS,
        turnTimeoutSeconds: 120.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('validateApiKeyFormat', () => {
    it('validates OpenAI key format', () => {
      expect(validateApiKeyFormat('openai', 'sk-test1234567890123456')).toBe(true);
      expect(validateApiKeyFormat('openai', 'invalid')).toBe(false);
      expect(validateApiKeyFormat('openai', '')).toBe(false);
    });

    it('validates Anthropic key format', () => {
      expect(validateApiKeyFormat('anthropic', 'sk-ant-test1234567890123456')).toBe(true);
      expect(validateApiKeyFormat('anthropic', 'sk-test')).toBe(false);
      expect(validateApiKeyFormat('anthropic', '')).toBe(false);
    });

    it('always returns true for Ollama (no key required)', () => {
      expect(validateApiKeyFormat('ollama', '')).toBe(true);
      expect(validateApiKeyFormat('ollama', 'anything')).toBe(true);
    });

    it('returns false for unknown providers', () => {
      expect(validateApiKeyFormat('unknown', 'key')).toBe(false);
    });
  });

  describe('validateConfig helper', () => {
    it('returns success with valid data', () => {
      const result = validateConfig(modelParametersSchema, DEFAULT_MODEL_PARAMETERS);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(DEFAULT_MODEL_PARAMETERS);
      }
    });

    it('returns errors with invalid data', () => {
      const result = validateConfig(modelParametersSchema, {
        temperature: -1,
        maxTokensPerTurn: 'not-a-number',
        topP: 0.5,
        frequencyPenalty: 0,
        presencePenalty: 0,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(Object.keys(result.errors).length).toBeGreaterThan(0);
      }
    });

    it('provides field-specific error messages', () => {
      const result = validateConfig(modelParametersSchema, {
        ...DEFAULT_MODEL_PARAMETERS,
        temperature: 10,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.temperature).toBeDefined();
      }
    });
  });
});
