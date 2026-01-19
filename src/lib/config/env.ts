// ============================================================================
// Environment Variable Access (Server-Side Only)
// ============================================================================

/**
 * Get an environment variable value.
 * This function should only be called on the server side.
 */
export function getEnvVar(key: string): string | undefined {
  if (typeof window !== 'undefined') {
    console.warn(`Attempted to access env var ${key} on client side`);
    return undefined;
  }
  return process.env[key];
}

/**
 * Get required environment variable, throws if not set.
 */
export function requireEnvVar(key: string): string {
  const value = getEnvVar(key);
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

// ============================================================================
// API Key Environment Variables
// ============================================================================

export const ENV_KEYS = {
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  OLLAMA_BASE_URL: 'OLLAMA_BASE_URL',
} as const;

export function getOpenAIApiKey(): string | undefined {
  return getEnvVar(ENV_KEYS.OPENAI_API_KEY);
}

export function getAnthropicApiKey(): string | undefined {
  return getEnvVar(ENV_KEYS.ANTHROPIC_API_KEY);
}

export function getOllamaBaseUrl(): string {
  return getEnvVar(ENV_KEYS.OLLAMA_BASE_URL) || 'http://localhost:11434';
}

// ============================================================================
// Configuration Source Priority
// ============================================================================

/**
 * Configuration values can come from multiple sources.
 * Priority (highest to lowest):
 * 1. Runtime settings (user-provided in UI)
 * 2. Environment variables
 * 3. Default values
 */
export type ConfigSource = 'runtime' | 'environment' | 'default';

export interface ConfigValue<T> {
  value: T;
  source: ConfigSource;
}

export function getConfigValue<T>(
  runtimeValue: T | undefined,
  envValue: T | undefined,
  defaultValue: T
): ConfigValue<T> {
  if (runtimeValue !== undefined) {
    return { value: runtimeValue, source: 'runtime' };
  }
  if (envValue !== undefined) {
    return { value: envValue, source: 'environment' };
  }
  return { value: defaultValue, source: 'default' };
}

// ============================================================================
// API Key Masking
// ============================================================================

/**
 * Mask an API key for display, showing only first 4 and last 4 characters.
 */
export function maskApiKey(key: string): string {
  if (key.length <= 12) {
    return '\u2022'.repeat(key.length);
  }
  return `${key.slice(0, 4)}${'\u2022'.repeat(key.length - 8)}${key.slice(-4)}`;
}

/**
 * Check if a key is masked (contains bullet characters).
 */
export function isKeyMasked(key: string): boolean {
  return key.includes('\u2022');
}
