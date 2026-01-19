# Step 5: Configuration & Settings - Detailed Implementation Plan

## Overview

The Configuration & Settings system provides secure API key management, customizable model parameters, and adjustable discussion settings. This step builds upon the AI Integration Layer (Step 2), Conversation Engine (Step 3), and Web UI (Step 4) to create a complete, user-configurable experience.

---

## Architecture Overview

```
src/
├── app/
│   ├── api/
│   │   ├── config/
│   │   │   ├── route.ts              # GET/POST app configuration
│   │   │   └── validate/route.ts     # Validate API keys
│   │   └── providers/
│   │       └── status/route.ts       # Provider availability status
│   └── settings/
│       └── page.tsx                  # Dedicated settings page (optional)
├── components/
│   └── settings/
│       ├── settings-panel.tsx        # Main settings panel component
│       ├── settings-dialog.tsx       # Modal wrapper for settings
│       ├── api-key-input.tsx         # Secure API key input field
│       ├── provider-status.tsx       # Provider connection status
│       ├── model-parameters.tsx      # Temperature, max tokens controls
│       ├── discussion-settings.tsx   # Max rounds, timeouts, consensus
│       └── settings-section.tsx      # Reusable section wrapper
├── hooks/
│   ├── use-settings.ts               # Settings state management
│   ├── use-provider-status.ts        # Provider availability check
│   └── use-local-storage.ts          # LocalStorage persistence helper
├── lib/
│   ├── config/
│   │   ├── types.ts                  # Configuration type definitions
│   │   ├── defaults.ts               # Default configuration values
│   │   ├── schema.ts                 # Zod validation schemas
│   │   └── env.ts                    # Environment variable helpers
│   └── server/
│       └── config-manager.ts         # Server-side config management
└── config/
    └── settings-constants.ts         # Settings UI constants
```

---

## Implementation Steps

---

### Step 5.1: Configuration Type Definitions

**File:** `src/lib/config/types.ts`

**Purpose:** Define all TypeScript interfaces for application configuration.

```typescript
import type { ProviderId } from '@/lib/ai';

// ============================================================================
// API Key Configuration
// ============================================================================

export interface ApiKeyConfig {
  openai?: string;
  anthropic?: string;
  // Ollama doesn't require API key
}

export interface ApiKeyStatus {
  providerId: ProviderId;
  isConfigured: boolean;
  isValid: boolean | null;  // null = not yet validated
  lastValidated: number | null;
  errorMessage?: string;
}

// ============================================================================
// Model Parameters Configuration
// ============================================================================

export interface ModelParametersConfig {
  temperature: number;           // 0.0 - 2.0, default 0.7
  maxTokensPerTurn: number;      // 256 - 8192, default 2048
  topP: number;                  // 0.0 - 1.0, default 1.0
  frequencyPenalty: number;      // 0.0 - 2.0, default 0.0
  presencePenalty: number;       // 0.0 - 2.0, default 0.0
}

// ============================================================================
// Discussion Settings Configuration
// ============================================================================

export interface DiscussionSettingsConfig {
  maxIterations: number;                // 1 - 50, default 10
  turnTimeoutSeconds: number;           // 30 - 300, default 120
  totalTimeoutMinutes: number;          // 5 - 60, default 30
  minRoundsBeforeConsensus: number;     // 1 - 5, default 1
  requireBothConsensus: boolean;        // default true
  autoScrollEnabled: boolean;           // default true
  showTokenUsage: boolean;              // default true
  showTimings: boolean;                 // default true
}

// ============================================================================
// Provider Configuration
// ============================================================================

export interface ProviderConfig {
  providerId: ProviderId;
  enabled: boolean;
  baseUrl?: string;              // For Ollama custom URL
  defaultModel?: string;
}

export interface ProvidersConfig {
  openai: ProviderConfig;
  anthropic: ProviderConfig;
  ollama: ProviderConfig;
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

export interface UIConfig {
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  soundEnabled: boolean;
}

// ============================================================================
// Settings Update Types
// ============================================================================

export type SettingsSection =
  | 'apiKeys'
  | 'modelParameters'
  | 'discussionSettings'
  | 'providers'
  | 'ui';

export interface SettingsUpdate<T extends SettingsSection> {
  section: T;
  values: Partial<AppConfig[T]>;
}

// ============================================================================
// Validation Result
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface ApiKeyValidationResult {
  providerId: ProviderId;
  isValid: boolean;
  modelsAvailable?: number;
  errorMessage?: string;
  validatedAt: number;
}
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Separate config sections** | Modular updates, easier validation, clear organization |
| **Nullable `isValid` for API keys** | Distinguish between "not checked" vs "checked and invalid" |
| **Numeric ranges as comments** | Self-documenting, guides UI slider bounds |
| **`UIConfig` separate section** | UI preferences distinct from functional settings |
| **Generic `SettingsUpdate<T>`** | Type-safe partial updates per section |

---

### Step 5.2: Default Configuration Values

**File:** `src/lib/config/defaults.ts`

**Purpose:** Centralized default values for all configuration options.

```typescript
import type {
  AppConfig,
  ModelParametersConfig,
  DiscussionSettingsConfig,
  ProvidersConfig,
  UIConfig,
} from './types';

// ============================================================================
// Model Parameters Defaults
// ============================================================================

export const DEFAULT_MODEL_PARAMETERS: ModelParametersConfig = {
  temperature: 0.7,
  maxTokensPerTurn: 2048,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
};

// ============================================================================
// Discussion Settings Defaults
// ============================================================================

export const DEFAULT_DISCUSSION_SETTINGS: DiscussionSettingsConfig = {
  maxIterations: 10,
  turnTimeoutSeconds: 120,
  totalTimeoutMinutes: 30,
  minRoundsBeforeConsensus: 1,
  requireBothConsensus: true,
  autoScrollEnabled: true,
  showTokenUsage: true,
  showTimings: true,
};

// ============================================================================
// Provider Defaults
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
    enabled: true,
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2',
  },
};

// ============================================================================
// UI Defaults
// ============================================================================

export const DEFAULT_UI_CONFIG: UIConfig = {
  theme: 'system',
  compactMode: false,
  soundEnabled: false,
};

// ============================================================================
// Full App Config Defaults
// ============================================================================

export const DEFAULT_APP_CONFIG: AppConfig = {
  apiKeys: {},
  modelParameters: DEFAULT_MODEL_PARAMETERS,
  discussionSettings: DEFAULT_DISCUSSION_SETTINGS,
  providers: DEFAULT_PROVIDERS_CONFIG,
  ui: DEFAULT_UI_CONFIG,
};

// ============================================================================
// Parameter Bounds (for validation and UI)
// ============================================================================

export const PARAMETER_BOUNDS = {
  temperature: { min: 0, max: 2, step: 0.1 },
  maxTokensPerTurn: { min: 256, max: 8192, step: 256 },
  topP: { min: 0, max: 1, step: 0.05 },
  frequencyPenalty: { min: 0, max: 2, step: 0.1 },
  presencePenalty: { min: 0, max: 2, step: 0.1 },
  maxIterations: { min: 1, max: 50, step: 1 },
  turnTimeoutSeconds: { min: 30, max: 300, step: 10 },
  totalTimeoutMinutes: { min: 5, max: 60, step: 5 },
  minRoundsBeforeConsensus: { min: 1, max: 5, step: 1 },
} as const;

// ============================================================================
// Preset Configurations
// ============================================================================

export const MODEL_PARAMETER_PRESETS = {
  creative: {
    name: 'Creative',
    description: 'Higher temperature for more varied responses',
    values: {
      temperature: 1.2,
      topP: 0.95,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
    },
  },
  balanced: {
    name: 'Balanced',
    description: 'Default settings for general use',
    values: {
      temperature: 0.7,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
    },
  },
  precise: {
    name: 'Precise',
    description: 'Lower temperature for more focused responses',
    values: {
      temperature: 0.3,
      topP: 0.9,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
    },
  },
  deterministic: {
    name: 'Deterministic',
    description: 'Most consistent, reproducible outputs',
    values: {
      temperature: 0.0,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
    },
  },
} as const;

export type PresetName = keyof typeof MODEL_PARAMETER_PRESETS;
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Separate defaults per section** | Individual sections can be reset independently |
| **`PARAMETER_BOUNDS` object** | Single source for validation + UI slider configuration |
| **Named presets** | User-friendly quick configuration, common use cases |
| **`as const` for bounds** | Enables TypeScript inference of literal types |

---

### Step 5.3: Zod Validation Schemas

**File:** `src/lib/config/schema.ts`

**Purpose:** Runtime validation for configuration values using Zod.

```typescript
import { z } from 'zod';
import { PARAMETER_BOUNDS } from './defaults';

// ============================================================================
// API Key Schemas
// ============================================================================

export const openaiApiKeySchema = z
  .string()
  .regex(/^sk-[a-zA-Z0-9]{20,}$/, 'Invalid OpenAI API key format')
  .optional();

export const anthropicApiKeySchema = z
  .string()
  .regex(/^sk-ant-[a-zA-Z0-9-]{20,}$/, 'Invalid Anthropic API key format')
  .optional();

export const apiKeysSchema = z.object({
  openai: openaiApiKeySchema,
  anthropic: anthropicApiKeySchema,
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
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Zod for validation** | Runtime type checking, good error messages, TypeScript inference |
| **Bounds from defaults** | Single source of truth for validation rules |
| **Regex for API key format** | Quick client-side validation before server check |
| **Partial schemas** | Support incremental updates without full object |
| **`validateConfig` helper** | Consistent error format across all validations |

---

### Step 5.4: Environment Variable Helpers

**File:** `src/lib/config/env.ts`

**Purpose:** Securely access environment variables with fallbacks.

```typescript
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
    return '•'.repeat(key.length);
  }
  return `${key.slice(0, 4)}${'•'.repeat(key.length - 8)}${key.slice(-4)}`;
}

/**
 * Check if a key is masked (contains bullet characters).
 */
export function isKeyMasked(key: string): boolean {
  return key.includes('•');
}
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Server-side only check** | Prevents accidental client-side env access |
| **Config source tracking** | UI can show where value comes from |
| **Priority system** | Runtime > Environment > Default is intuitive |
| **Key masking utility** | Security - never show full keys in UI |
| **`isKeyMasked` helper** | Detect if user is trying to save masked value |

---

### Step 5.5: Server-Side Configuration Manager

**File:** `src/lib/server/config-manager.ts`

**Purpose:** Manage configuration state on the server, including API key validation.

```typescript
import { validateApiKeyFormat } from '@/lib/config/schema';
import {
  getOpenAIApiKey,
  getAnthropicApiKey,
  getOllamaBaseUrl,
  maskApiKey,
} from '@/lib/config/env';
import type {
  ApiKeyConfig,
  ApiKeyStatus,
  ApiKeyValidationResult,
  AppConfig,
} from '@/lib/config/types';
import { DEFAULT_APP_CONFIG } from '@/lib/config/defaults';

// ============================================================================
// In-Memory Runtime Config Cache
// ============================================================================

// Note: In production, consider using Redis or database for persistence
let runtimeApiKeys: ApiKeyConfig = {};

// Validation cache (expires after 5 minutes)
const validationCache = new Map<string, { result: ApiKeyValidationResult; expiresAt: number }>();
const VALIDATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// API Key Management
// ============================================================================

export function setRuntimeApiKey(providerId: 'openai' | 'anthropic', key: string): void {
  runtimeApiKeys[providerId] = key;
  // Clear validation cache when key changes
  validationCache.delete(providerId);
}

export function clearRuntimeApiKey(providerId: 'openai' | 'anthropic'): void {
  delete runtimeApiKeys[providerId];
  validationCache.delete(providerId);
}

export function getEffectiveApiKey(providerId: 'openai' | 'anthropic'): string | undefined {
  // Runtime keys take priority over environment variables
  const runtimeKey = runtimeApiKeys[providerId];
  if (runtimeKey) return runtimeKey;

  switch (providerId) {
    case 'openai':
      return getOpenAIApiKey();
    case 'anthropic':
      return getAnthropicApiKey();
    default:
      return undefined;
  }
}

export function getApiKeyStatus(providerId: 'openai' | 'anthropic'): ApiKeyStatus {
  const key = getEffectiveApiKey(providerId);
  const cached = validationCache.get(providerId);
  const isValidated = cached && cached.expiresAt > Date.now();

  return {
    providerId,
    isConfigured: !!key,
    isValid: isValidated ? cached.result.isValid : null,
    lastValidated: isValidated ? cached.result.validatedAt : null,
    errorMessage: isValidated && !cached.result.isValid ? cached.result.errorMessage : undefined,
  };
}

export function getMaskedApiKey(providerId: 'openai' | 'anthropic'): string | null {
  const key = getEffectiveApiKey(providerId);
  return key ? maskApiKey(key) : null;
}

// ============================================================================
// API Key Validation
// ============================================================================

export async function validateApiKey(
  providerId: 'openai' | 'anthropic'
): Promise<ApiKeyValidationResult> {
  const key = getEffectiveApiKey(providerId);

  if (!key) {
    return {
      providerId,
      isValid: false,
      errorMessage: 'API key not configured',
      validatedAt: Date.now(),
    };
  }

  // Check format first
  if (!validateApiKeyFormat(providerId, key)) {
    return {
      providerId,
      isValid: false,
      errorMessage: 'Invalid API key format',
      validatedAt: Date.now(),
    };
  }

  // Check cache
  const cached = validationCache.get(providerId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  // Validate by making a minimal API call
  try {
    const result = await performValidationRequest(providerId, key);

    // Cache the result
    validationCache.set(providerId, {
      result,
      expiresAt: Date.now() + VALIDATION_CACHE_TTL,
    });

    return result;
  } catch (error) {
    const errorResult: ApiKeyValidationResult = {
      providerId,
      isValid: false,
      errorMessage: error instanceof Error ? error.message : 'Validation failed',
      validatedAt: Date.now(),
    };

    // Cache negative results too (shorter TTL)
    validationCache.set(providerId, {
      result: errorResult,
      expiresAt: Date.now() + 60000, // 1 minute for failures
    });

    return errorResult;
  }
}

async function performValidationRequest(
  providerId: 'openai' | 'anthropic',
  key: string
): Promise<ApiKeyValidationResult> {
  const timestamp = Date.now();

  if (providerId === 'openai') {
    // Use models list endpoint for validation
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });

    if (response.status === 401) {
      return {
        providerId,
        isValid: false,
        errorMessage: 'Invalid API key',
        validatedAt: timestamp,
      };
    }

    if (!response.ok) {
      return {
        providerId,
        isValid: false,
        errorMessage: `API error: ${response.status}`,
        validatedAt: timestamp,
      };
    }

    const data = await response.json();
    return {
      providerId,
      isValid: true,
      modelsAvailable: data.data?.length || 0,
      validatedAt: timestamp,
    };
  }

  if (providerId === 'anthropic') {
    // Use messages endpoint with minimal request for validation
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    if (response.status === 401) {
      return {
        providerId,
        isValid: false,
        errorMessage: 'Invalid API key',
        validatedAt: timestamp,
      };
    }

    // Even 400 errors mean the key is valid (just bad request)
    if (response.status === 400 || response.ok) {
      return {
        providerId,
        isValid: true,
        validatedAt: timestamp,
      };
    }

    return {
      providerId,
      isValid: false,
      errorMessage: `API error: ${response.status}`,
      validatedAt: timestamp,
    };
  }

  return {
    providerId,
    isValid: false,
    errorMessage: 'Unknown provider',
    validatedAt: timestamp,
  };
}

// ============================================================================
// Ollama Status Check
// ============================================================================

export async function checkOllamaStatus(): Promise<{
  isAvailable: boolean;
  modelsAvailable: number;
  errorMessage?: string;
}> {
  try {
    const baseUrl = getOllamaBaseUrl();
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        isAvailable: false,
        modelsAvailable: 0,
        errorMessage: `Ollama returned ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      isAvailable: true,
      modelsAvailable: data.models?.length || 0,
    };
  } catch (error) {
    return {
      isAvailable: false,
      modelsAvailable: 0,
      errorMessage: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

// ============================================================================
// Full Configuration Assembly
// ============================================================================

export function getServerConfig(): Omit<AppConfig, 'apiKeys'> & {
  apiKeyStatus: Record<string, ApiKeyStatus>;
} {
  return {
    ...DEFAULT_APP_CONFIG,
    apiKeyStatus: {
      openai: getApiKeyStatus('openai'),
      anthropic: getApiKeyStatus('anthropic'),
    },
  };
}
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **In-memory runtime keys** | User-provided keys in session, not persisted to disk |
| **Validation caching** | Avoid repeated API calls; 5-minute TTL balances freshness |
| **Shorter TTL for failures** | Retry sooner when key was temporarily invalid |
| **Minimal validation requests** | Models list for OpenAI, tiny message for Anthropic |
| **Ollama timeout** | 5s timeout prevents blocking on unavailable local server |
| **Masked key exposure only** | Server never sends full keys to client |

---

### Step 5.6: Settings Constants

**File:** `src/config/settings-constants.ts`

**Purpose:** UI constants and labels for the settings interface.

```typescript
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
```

---

### Step 5.7: LocalStorage Persistence Hook

**File:** `src/hooks/use-local-storage.ts`

**Purpose:** Type-safe localStorage persistence with SSR support.

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseLocalStorageOptions<T> {
  key: string;
  defaultValue: T;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}

interface UseLocalStorageReturn<T> {
  value: T;
  setValue: (value: T | ((prev: T) => T)) => void;
  removeValue: () => void;
  isLoaded: boolean;
}

export function useLocalStorage<T>({
  key,
  defaultValue,
  serialize = JSON.stringify,
  deserialize = JSON.parse,
}: UseLocalStorageOptions<T>): UseLocalStorageReturn<T> {
  // State to track if we've loaded from localStorage
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize with default value (SSR-safe)
  const [storedValue, setStoredValue] = useState<T>(defaultValue);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(deserialize(item));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
    setIsLoaded(true);
  }, [key, deserialize]);

  // Update localStorage when value changes
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, serialize(valueToStore));

        // Dispatch storage event for other tabs
        window.dispatchEvent(
          new StorageEvent('storage', {
            key,
            newValue: serialize(valueToStore),
          })
        );
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, serialize, storedValue]
  );

  // Remove from localStorage
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(defaultValue);
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, defaultValue]);

  // Listen for changes in other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(deserialize(e.newValue));
        } catch (error) {
          console.warn(`Error parsing storage event for key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, deserialize]);

  return {
    value: storedValue,
    setValue,
    removeValue,
    isLoaded,
  };
}

// ============================================================================
// Typed Storage Keys
// ============================================================================

export const STORAGE_KEYS = {
  SETTINGS_MODEL_PARAMS: 'ralph-discuss:settings:model-params',
  SETTINGS_DISCUSSION: 'ralph-discuss:settings:discussion',
  SETTINGS_UI: 'ralph-discuss:settings:ui',
  LAST_MODELS: 'ralph-discuss:last-models',
  DISCUSSION_HISTORY: 'ralph-discuss:discussion-history',
} as const;
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **SSR-safe initialization** | Use default value during SSR, load from storage on mount |
| **`isLoaded` flag** | UI can show loading state until storage is read |
| **Cross-tab sync** | StorageEvent listener keeps tabs in sync |
| **Namespaced keys** | Prefix `ralph-discuss:` prevents collisions |
| **Custom serialize/deserialize** | Support complex types beyond JSON |

---

### Step 5.8: Settings State Management Hook

**File:** `src/hooks/use-settings.ts`

**Purpose:** Central settings state management with persistence and server sync.

```typescript
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalStorage, STORAGE_KEYS } from './use-local-storage';
import type {
  AppConfig,
  ModelParametersConfig,
  DiscussionSettingsConfig,
  UIConfig,
  ApiKeyStatus,
  SettingsSection,
} from '@/lib/config/types';
import {
  DEFAULT_MODEL_PARAMETERS,
  DEFAULT_DISCUSSION_SETTINGS,
  DEFAULT_UI_CONFIG,
  MODEL_PARAMETER_PRESETS,
  type PresetName,
} from '@/lib/config/defaults';
import {
  validateConfig,
  partialModelParametersSchema,
  partialDiscussionSettingsSchema,
} from '@/lib/config/schema';

// ============================================================================
// Settings Hook Return Type
// ============================================================================

interface UseSettingsReturn {
  // Model Parameters
  modelParams: ModelParametersConfig;
  updateModelParams: (updates: Partial<ModelParametersConfig>) => void;
  resetModelParams: () => void;
  applyPreset: (preset: PresetName) => void;

  // Discussion Settings
  discussionSettings: DiscussionSettingsConfig;
  updateDiscussionSettings: (updates: Partial<DiscussionSettingsConfig>) => void;
  resetDiscussionSettings: () => void;

  // UI Settings
  uiSettings: UIConfig;
  updateUiSettings: (updates: Partial<UIConfig>) => void;

  // API Key Status (from server)
  apiKeyStatus: Record<string, ApiKeyStatus>;
  refreshApiKeyStatus: () => Promise<void>;
  setApiKey: (providerId: 'openai' | 'anthropic', key: string) => Promise<boolean>;
  clearApiKey: (providerId: 'openai' | 'anthropic') => Promise<void>;
  validateApiKey: (providerId: 'openai' | 'anthropic') => Promise<boolean>;

  // General
  isLoading: boolean;
  validationErrors: Record<string, string>;
  resetAllSettings: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSettings(): UseSettingsReturn {
  // ============================================================================
  // Local Storage State
  // ============================================================================

  const {
    value: modelParams,
    setValue: setModelParams,
    isLoaded: modelParamsLoaded,
  } = useLocalStorage({
    key: STORAGE_KEYS.SETTINGS_MODEL_PARAMS,
    defaultValue: DEFAULT_MODEL_PARAMETERS,
  });

  const {
    value: discussionSettings,
    setValue: setDiscussionSettings,
    isLoaded: discussionSettingsLoaded,
  } = useLocalStorage({
    key: STORAGE_KEYS.SETTINGS_DISCUSSION,
    defaultValue: DEFAULT_DISCUSSION_SETTINGS,
  });

  const {
    value: uiSettings,
    setValue: setUiSettings,
    isLoaded: uiSettingsLoaded,
  } = useLocalStorage({
    key: STORAGE_KEYS.SETTINGS_UI,
    defaultValue: DEFAULT_UI_CONFIG,
  });

  // ============================================================================
  // Server State
  // ============================================================================

  const [apiKeyStatus, setApiKeyStatus] = useState<Record<string, ApiKeyStatus>>({});
  const [isLoadingServer, setIsLoadingServer] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch API key status on mount
  useEffect(() => {
    refreshApiKeyStatus();
  }, []);

  const refreshApiKeyStatus = useCallback(async () => {
    setIsLoadingServer(true);
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        setApiKeyStatus(data.apiKeyStatus || {});
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setIsLoadingServer(false);
    }
  }, []);

  // ============================================================================
  // Model Parameters
  // ============================================================================

  const updateModelParams = useCallback(
    (updates: Partial<ModelParametersConfig>) => {
      const result = validateConfig(partialModelParametersSchema, updates);
      if (!result.success) {
        setValidationErrors((prev) => ({ ...prev, ...result.errors }));
        return;
      }

      setValidationErrors((prev) => {
        const next = { ...prev };
        Object.keys(updates).forEach((key) => delete next[key]);
        return next;
      });

      setModelParams((prev) => ({ ...prev, ...updates }));
    },
    [setModelParams]
  );

  const resetModelParams = useCallback(() => {
    setModelParams(DEFAULT_MODEL_PARAMETERS);
  }, [setModelParams]);

  const applyPreset = useCallback(
    (preset: PresetName) => {
      const presetValues = MODEL_PARAMETER_PRESETS[preset].values;
      setModelParams((prev) => ({ ...prev, ...presetValues }));
    },
    [setModelParams]
  );

  // ============================================================================
  // Discussion Settings
  // ============================================================================

  const updateDiscussionSettings = useCallback(
    (updates: Partial<DiscussionSettingsConfig>) => {
      const result = validateConfig(partialDiscussionSettingsSchema, updates);
      if (!result.success) {
        setValidationErrors((prev) => ({ ...prev, ...result.errors }));
        return;
      }

      setValidationErrors((prev) => {
        const next = { ...prev };
        Object.keys(updates).forEach((key) => delete next[key]);
        return next;
      });

      setDiscussionSettings((prev) => ({ ...prev, ...updates }));
    },
    [setDiscussionSettings]
  );

  const resetDiscussionSettings = useCallback(() => {
    setDiscussionSettings(DEFAULT_DISCUSSION_SETTINGS);
  }, [setDiscussionSettings]);

  // ============================================================================
  // UI Settings
  // ============================================================================

  const updateUiSettings = useCallback(
    (updates: Partial<UIConfig>) => {
      setUiSettings((prev) => ({ ...prev, ...updates }));
    },
    [setUiSettings]
  );

  // ============================================================================
  // API Key Management
  // ============================================================================

  const setApiKey = useCallback(
    async (providerId: 'openai' | 'anthropic', key: string): Promise<boolean> => {
      try {
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'setApiKey', providerId, key }),
        });

        if (response.ok) {
          await refreshApiKeyStatus();
          return true;
        }

        const data = await response.json();
        setValidationErrors((prev) => ({
          ...prev,
          [`apiKey.${providerId}`]: data.error || 'Failed to set API key',
        }));
        return false;
      } catch (error) {
        setValidationErrors((prev) => ({
          ...prev,
          [`apiKey.${providerId}`]: 'Network error',
        }));
        return false;
      }
    },
    [refreshApiKeyStatus]
  );

  const clearApiKey = useCallback(
    async (providerId: 'openai' | 'anthropic'): Promise<void> => {
      try {
        await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clearApiKey', providerId }),
        });
        await refreshApiKeyStatus();
      } catch (error) {
        console.error('Failed to clear API key:', error);
      }
    },
    [refreshApiKeyStatus]
  );

  const validateApiKey = useCallback(
    async (providerId: 'openai' | 'anthropic'): Promise<boolean> => {
      try {
        const response = await fetch('/api/config/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId }),
        });

        const data = await response.json();
        await refreshApiKeyStatus();
        return data.isValid;
      } catch (error) {
        return false;
      }
    },
    [refreshApiKeyStatus]
  );

  // ============================================================================
  // General
  // ============================================================================

  const isLoading = !modelParamsLoaded || !discussionSettingsLoaded || !uiSettingsLoaded || isLoadingServer;

  const resetAllSettings = useCallback(() => {
    setModelParams(DEFAULT_MODEL_PARAMETERS);
    setDiscussionSettings(DEFAULT_DISCUSSION_SETTINGS);
    setUiSettings(DEFAULT_UI_CONFIG);
    setValidationErrors({});
  }, [setModelParams, setDiscussionSettings, setUiSettings]);

  return {
    modelParams,
    updateModelParams,
    resetModelParams,
    applyPreset,

    discussionSettings,
    updateDiscussionSettings,
    resetDiscussionSettings,

    uiSettings,
    updateUiSettings,

    apiKeyStatus,
    refreshApiKeyStatus,
    setApiKey,
    clearApiKey,
    validateApiKey,

    isLoading,
    validationErrors,
    resetAllSettings,
  };
}
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Separate storage per section** | Independent persistence, smaller updates |
| **Validation before update** | Prevent invalid state, immediate feedback |
| **Server calls for API keys** | Keys never stored in localStorage (security) |
| **Refresh after key operations** | Keep UI in sync with server state |
| **Preset application** | Merges preset values with existing config |

---

### Step 5.9: Provider Status Hook

**File:** `src/hooks/use-provider-status.ts`

**Purpose:** Check and monitor provider availability status.

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProviderId } from '@/lib/ai';

interface ProviderStatus {
  providerId: ProviderId;
  isAvailable: boolean;
  isChecking: boolean;
  modelsCount: number;
  errorMessage?: string;
  lastChecked: number | null;
}

interface UseProviderStatusReturn {
  statuses: Record<ProviderId, ProviderStatus>;
  checkProvider: (providerId: ProviderId) => Promise<void>;
  checkAllProviders: () => Promise<void>;
  isChecking: boolean;
}

const initialStatus = (providerId: ProviderId): ProviderStatus => ({
  providerId,
  isAvailable: false,
  isChecking: false,
  modelsCount: 0,
  lastChecked: null,
});

export function useProviderStatus(): UseProviderStatusReturn {
  const [statuses, setStatuses] = useState<Record<ProviderId, ProviderStatus>>({
    openai: initialStatus('openai'),
    anthropic: initialStatus('anthropic'),
    ollama: initialStatus('ollama'),
  });

  const [isChecking, setIsChecking] = useState(false);

  const checkProvider = useCallback(async (providerId: ProviderId) => {
    setStatuses((prev) => ({
      ...prev,
      [providerId]: { ...prev[providerId], isChecking: true },
    }));

    try {
      const response = await fetch(`/api/providers/status?provider=${providerId}`);
      const data = await response.json();

      setStatuses((prev) => ({
        ...prev,
        [providerId]: {
          providerId,
          isAvailable: data.isAvailable,
          isChecking: false,
          modelsCount: data.modelsCount || 0,
          errorMessage: data.errorMessage,
          lastChecked: Date.now(),
        },
      }));
    } catch (error) {
      setStatuses((prev) => ({
        ...prev,
        [providerId]: {
          providerId,
          isAvailable: false,
          isChecking: false,
          modelsCount: 0,
          errorMessage: 'Failed to check status',
          lastChecked: Date.now(),
        },
      }));
    }
  }, []);

  const checkAllProviders = useCallback(async () => {
    setIsChecking(true);
    await Promise.all([
      checkProvider('openai'),
      checkProvider('anthropic'),
      checkProvider('ollama'),
    ]);
    setIsChecking(false);
  }, [checkProvider]);

  // Check on mount
  useEffect(() => {
    checkAllProviders();
  }, [checkAllProviders]);

  return {
    statuses,
    checkProvider,
    checkAllProviders,
    isChecking,
  };
}
```

---

### Step 5.10: API Configuration Route

**File:** `src/app/api/config/route.ts`

**Purpose:** REST endpoint for configuration management.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  getServerConfig,
  setRuntimeApiKey,
  clearRuntimeApiKey,
  getMaskedApiKey,
  getApiKeyStatus,
} from '@/lib/server/config-manager';
import { validateApiKeyFormat } from '@/lib/config/schema';
import { isKeyMasked } from '@/lib/config/env';

// ============================================================================
// GET - Retrieve Configuration
// ============================================================================

export async function GET() {
  try {
    const config = getServerConfig();

    // Add masked API keys for display
    const maskedKeys = {
      openai: getMaskedApiKey('openai'),
      anthropic: getMaskedApiKey('anthropic'),
    };

    return NextResponse.json({
      ...config,
      maskedApiKeys: maskedKeys,
    });
  } catch (error) {
    console.error('Config GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve configuration' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Update Configuration
// ============================================================================

interface ConfigAction {
  action: 'setApiKey' | 'clearApiKey';
  providerId?: 'openai' | 'anthropic';
  key?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ConfigAction = await request.json();

    switch (body.action) {
      case 'setApiKey': {
        if (!body.providerId || !body.key) {
          return NextResponse.json(
            { error: 'Provider ID and key are required' },
            { status: 400 }
          );
        }

        // Reject masked keys (user didn't change it)
        if (isKeyMasked(body.key)) {
          return NextResponse.json(
            { error: 'Please enter a new API key' },
            { status: 400 }
          );
        }

        // Validate format
        if (!validateApiKeyFormat(body.providerId, body.key)) {
          return NextResponse.json(
            { error: 'Invalid API key format' },
            { status: 400 }
          );
        }

        setRuntimeApiKey(body.providerId, body.key);

        return NextResponse.json({
          success: true,
          status: getApiKeyStatus(body.providerId),
        });
      }

      case 'clearApiKey': {
        if (!body.providerId) {
          return NextResponse.json(
            { error: 'Provider ID is required' },
            { status: 400 }
          );
        }

        clearRuntimeApiKey(body.providerId);

        return NextResponse.json({
          success: true,
          status: getApiKeyStatus(body.providerId),
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Config POST error:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}
```

---

### Step 5.11: API Key Validation Route

**File:** `src/app/api/config/validate/route.ts`

**Purpose:** Validate API keys by making test requests to providers.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/server/config-manager';

export async function POST(request: NextRequest) {
  try {
    const { providerId } = await request.json();

    if (!providerId || !['openai', 'anthropic'].includes(providerId)) {
      return NextResponse.json(
        { error: 'Invalid provider ID' },
        { status: 400 }
      );
    }

    const result = await validateApiKey(providerId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { error: 'Validation failed' },
      { status: 500 }
    );
  }
}
```

---

### Step 5.12: Provider Status Route

**File:** `src/app/api/providers/status/route.ts`

**Purpose:** Check provider availability and model counts.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  validateApiKey,
  checkOllamaStatus,
  getApiKeyStatus,
} from '@/lib/server/config-manager';

export async function GET(request: NextRequest) {
  const providerId = request.nextUrl.searchParams.get('provider');

  if (!providerId) {
    return NextResponse.json(
      { error: 'Provider ID is required' },
      { status: 400 }
    );
  }

  try {
    if (providerId === 'ollama') {
      const status = await checkOllamaStatus();
      return NextResponse.json({
        providerId: 'ollama',
        isAvailable: status.isAvailable,
        modelsCount: status.modelsAvailable,
        errorMessage: status.errorMessage,
      });
    }

    if (providerId === 'openai' || providerId === 'anthropic') {
      const keyStatus = getApiKeyStatus(providerId);

      if (!keyStatus.isConfigured) {
        return NextResponse.json({
          providerId,
          isAvailable: false,
          modelsCount: 0,
          errorMessage: 'API key not configured',
        });
      }

      const validationResult = await validateApiKey(providerId);

      return NextResponse.json({
        providerId,
        isAvailable: validationResult.isValid,
        modelsCount: validationResult.modelsAvailable || 0,
        errorMessage: validationResult.errorMessage,
      });
    }

    return NextResponse.json(
      { error: 'Unknown provider' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Provider status error:', error);
    return NextResponse.json(
      { error: 'Failed to check provider status' },
      { status: 500 }
    );
  }
}
```

---

### Step 5.13: Settings Section Component

**File:** `src/components/settings/settings-section.tsx`

**Purpose:** Reusable wrapper for settings sections with consistent styling.

```typescript
'use client';

import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  onReset?: () => void;
  resetLabel?: string;
}

export function SettingsSection({
  title,
  description,
  children,
  onReset,
  resetLabel = 'Reset to Defaults',
}: SettingsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-1">{description}</CardDescription>
            )}
          </div>
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              {resetLabel}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
```

---

### Step 5.14: API Key Input Component

**File:** `src/components/settings/api-key-input.tsx`

**Purpose:** Secure input field for API keys with validation and masking.

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { ApiKeyStatus } from '@/lib/config/types';
import { PROVIDER_LABELS, STATUS_LABELS } from '@/config/settings-constants';

interface ApiKeyInputProps {
  providerId: 'openai' | 'anthropic';
  maskedKey: string | null;
  status: ApiKeyStatus | undefined;
  onSave: (key: string) => Promise<boolean>;
  onClear: () => Promise<void>;
  onValidate: () => Promise<boolean>;
  error?: string;
}

export function ApiKeyInput({
  providerId,
  maskedKey,
  status,
  onSave,
  onClear,
  onValidate,
  error,
}: ApiKeyInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const labels = PROVIDER_LABELS[providerId];

  const handleSave = useCallback(async () => {
    if (!inputValue.trim()) return;

    setIsSaving(true);
    const success = await onSave(inputValue);
    setIsSaving(false);

    if (success) {
      setInputValue('');
      setIsEditing(false);
    }
  }, [inputValue, onSave]);

  const handleValidate = useCallback(async () => {
    setIsValidating(true);
    await onValidate();
    setIsValidating(false);
  }, [onValidate]);

  const handleClear = useCallback(async () => {
    await onClear();
    setInputValue('');
    setIsEditing(false);
  }, [onClear]);

  const getStatusBadge = () => {
    if (!status) return null;

    if (status.isValid === null && status.isConfigured) {
      return <Badge variant="secondary">{STATUS_LABELS.apiKey.configured}</Badge>;
    }

    if (status.isValid === true) {
      return <Badge className="bg-green-100 text-green-800">{STATUS_LABELS.apiKey.valid}</Badge>;
    }

    if (status.isValid === false && status.isConfigured) {
      return <Badge variant="destructive">{STATUS_LABELS.apiKey.invalid}</Badge>;
    }

    return <Badge variant="outline">{STATUS_LABELS.apiKey.notConfigured}</Badge>;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{labels.name}</Label>
        {getStatusBadge()}
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {labels.description}
      </p>

      {isEditing || !maskedKey ? (
        <div className="space-y-2">
          <Input
            type="password"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={labels.keyPlaceholder}
            className={error ? 'border-red-500' : ''}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <p className="text-xs text-gray-400">
            {labels.keyHint}{' '}
            <a
              href={labels.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Get API key
            </a>
          </p>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!inputValue.trim() || isSaving} size="sm">
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            {maskedKey && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input value={maskedKey} disabled className="font-mono" />
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Change
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Clear
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleValidate}
            disabled={isValidating}
          >
            {isValidating ? 'Validating...' : 'Validate Key'}
          </Button>
        </div>
      )}
    </div>
  );
}
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Password input type** | Prevents shoulder surfing, standard security practice |
| **Edit mode toggle** | Don't show input by default if key exists |
| **Masked key display** | User sees key is configured without exposure |
| **External link to get key** | Helpful onboarding, reduces friction |

---

### Step 5.15: Provider Status Component

**File:** `src/components/settings/provider-status.tsx`

**Purpose:** Display provider connection status with refresh capability.

```typescript
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PROVIDER_LABELS, STATUS_LABELS } from '@/config/settings-constants';
import type { ProviderId } from '@/lib/ai';

interface ProviderStatusProps {
  providerId: ProviderId;
  isAvailable: boolean;
  isChecking: boolean;
  modelsCount: number;
  errorMessage?: string;
  onRefresh: () => void;
}

export function ProviderStatus({
  providerId,
  isAvailable,
  isChecking,
  modelsCount,
  errorMessage,
  onRefresh,
}: ProviderStatusProps) {
  const labels = PROVIDER_LABELS[providerId];

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className={`w-2 h-2 rounded-full ${
            isChecking
              ? 'bg-yellow-500 animate-pulse'
              : isAvailable
              ? 'bg-green-500'
              : 'bg-red-500'
          }`}
        />
        <div>
          <p className="font-medium">{labels.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isChecking
              ? STATUS_LABELS.provider.checking
              : isAvailable
              ? `${modelsCount} models available`
              : errorMessage || STATUS_LABELS.provider.unavailable}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={isAvailable ? 'default' : 'secondary'}>
          {isChecking
            ? STATUS_LABELS.provider.checking
            : isAvailable
            ? STATUS_LABELS.provider.available
            : STATUS_LABELS.provider.unavailable}
        </Badge>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isChecking}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
```

---

### Step 5.16: Model Parameters Component

**File:** `src/components/settings/model-parameters.tsx`

**Purpose:** Sliders and inputs for model generation parameters.

```typescript
'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ModelParametersConfig } from '@/lib/config/types';
import { PARAMETER_BOUNDS, MODEL_PARAMETER_PRESETS, type PresetName } from '@/lib/config/defaults';
import { PARAMETER_LABELS, PRESET_LABELS } from '@/config/settings-constants';

interface ModelParametersProps {
  values: ModelParametersConfig;
  onChange: (updates: Partial<ModelParametersConfig>) => void;
  onApplyPreset: (preset: PresetName) => void;
  errors?: Record<string, string>;
}

export function ModelParameters({
  values,
  onChange,
  onApplyPreset,
  errors = {},
}: ModelParametersProps) {
  return (
    <div className="space-y-6">
      {/* Presets */}
      <div className="space-y-2">
        <Label>Quick Presets</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MODEL_PARAMETER_PRESETS) as PresetName[]).map((preset) => (
            <TooltipProvider key={preset}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onApplyPreset(preset)}
                  >
                    {PRESET_LABELS[preset].name}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{PRESET_LABELS[preset].description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>

      {/* Temperature */}
      <ParameterSlider
        id="temperature"
        value={values.temperature}
        onChange={(v) => onChange({ temperature: v })}
        bounds={PARAMETER_BOUNDS.temperature}
        labels={PARAMETER_LABELS.temperature}
        error={errors.temperature}
      />

      {/* Max Tokens */}
      <ParameterSlider
        id="maxTokensPerTurn"
        value={values.maxTokensPerTurn}
        onChange={(v) => onChange({ maxTokensPerTurn: v })}
        bounds={PARAMETER_BOUNDS.maxTokensPerTurn}
        labels={PARAMETER_LABELS.maxTokensPerTurn}
        error={errors.maxTokensPerTurn}
        showInput
      />

      {/* Top P */}
      <ParameterSlider
        id="topP"
        value={values.topP}
        onChange={(v) => onChange({ topP: v })}
        bounds={PARAMETER_BOUNDS.topP}
        labels={PARAMETER_LABELS.topP}
        error={errors.topP}
      />

      {/* Frequency Penalty */}
      <ParameterSlider
        id="frequencyPenalty"
        value={values.frequencyPenalty}
        onChange={(v) => onChange({ frequencyPenalty: v })}
        bounds={PARAMETER_BOUNDS.frequencyPenalty}
        labels={PARAMETER_LABELS.frequencyPenalty}
        error={errors.frequencyPenalty}
      />

      {/* Presence Penalty */}
      <ParameterSlider
        id="presencePenalty"
        value={values.presencePenalty}
        onChange={(v) => onChange({ presencePenalty: v })}
        bounds={PARAMETER_BOUNDS.presencePenalty}
        labels={PARAMETER_LABELS.presencePenalty}
        error={errors.presencePenalty}
      />
    </div>
  );
}

// ============================================================================
// Parameter Slider Subcomponent
// ============================================================================

interface ParameterSliderProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  bounds: { min: number; max: number; step: number };
  labels: { label: string; description: string; tooltip?: string };
  error?: string;
  showInput?: boolean;
}

function ParameterSlider({
  id,
  value,
  onChange,
  bounds,
  labels,
  error,
  showInput = false,
}: ParameterSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Label htmlFor={id} className="cursor-help">
                {labels.label}
              </Label>
            </TooltipTrigger>
            {labels.tooltip && (
              <TooltipContent>
                <p>{labels.tooltip}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <Badge variant="secondary" className="font-mono">
          {value}
        </Badge>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {labels.description}
      </p>
      <div className="flex items-center gap-4">
        <Slider
          id={id}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={bounds.min}
          max={bounds.max}
          step={bounds.step}
          className="flex-1"
        />
        {showInput && (
          <Input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            min={bounds.min}
            max={bounds.max}
            step={bounds.step}
            className="w-24"
          />
        )}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
```

---

### Step 5.17: Discussion Settings Component

**File:** `src/components/settings/discussion-settings.tsx`

**Purpose:** Controls for discussion behavior and safety limits.

```typescript
'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import type { DiscussionSettingsConfig } from '@/lib/config/types';
import { PARAMETER_BOUNDS } from '@/lib/config/defaults';
import { PARAMETER_LABELS } from '@/config/settings-constants';

interface DiscussionSettingsProps {
  values: DiscussionSettingsConfig;
  onChange: (updates: Partial<DiscussionSettingsConfig>) => void;
  errors?: Record<string, string>;
}

export function DiscussionSettings({
  values,
  onChange,
  errors = {},
}: DiscussionSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Safety Limits */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Safety Limits
        </h4>

        {/* Max Iterations */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{PARAMETER_LABELS.maxIterations.label}</Label>
            <Badge variant="secondary">{values.maxIterations} rounds</Badge>
          </div>
          <p className="text-xs text-gray-500">{PARAMETER_LABELS.maxIterations.description}</p>
          <Slider
            value={[values.maxIterations]}
            onValueChange={([v]) => onChange({ maxIterations: v })}
            min={PARAMETER_BOUNDS.maxIterations.min}
            max={PARAMETER_BOUNDS.maxIterations.max}
            step={PARAMETER_BOUNDS.maxIterations.step}
          />
        </div>

        {/* Turn Timeout */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{PARAMETER_LABELS.turnTimeoutSeconds.label}</Label>
            <Badge variant="secondary">{values.turnTimeoutSeconds}s</Badge>
          </div>
          <p className="text-xs text-gray-500">{PARAMETER_LABELS.turnTimeoutSeconds.description}</p>
          <Slider
            value={[values.turnTimeoutSeconds]}
            onValueChange={([v]) => onChange({ turnTimeoutSeconds: v })}
            min={PARAMETER_BOUNDS.turnTimeoutSeconds.min}
            max={PARAMETER_BOUNDS.turnTimeoutSeconds.max}
            step={PARAMETER_BOUNDS.turnTimeoutSeconds.step}
          />
        </div>

        {/* Total Timeout */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{PARAMETER_LABELS.totalTimeoutMinutes.label}</Label>
            <Badge variant="secondary">{values.totalTimeoutMinutes} min</Badge>
          </div>
          <p className="text-xs text-gray-500">{PARAMETER_LABELS.totalTimeoutMinutes.description}</p>
          <Slider
            value={[values.totalTimeoutMinutes]}
            onValueChange={([v]) => onChange({ totalTimeoutMinutes: v })}
            min={PARAMETER_BOUNDS.totalTimeoutMinutes.min}
            max={PARAMETER_BOUNDS.totalTimeoutMinutes.max}
            step={PARAMETER_BOUNDS.totalTimeoutMinutes.step}
          />
        </div>
      </div>

      {/* Consensus Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Consensus Settings
        </h4>

        {/* Min Rounds */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{PARAMETER_LABELS.minRoundsBeforeConsensus.label}</Label>
            <Badge variant="secondary">{values.minRoundsBeforeConsensus}</Badge>
          </div>
          <p className="text-xs text-gray-500">{PARAMETER_LABELS.minRoundsBeforeConsensus.description}</p>
          <Slider
            value={[values.minRoundsBeforeConsensus]}
            onValueChange={([v]) => onChange({ minRoundsBeforeConsensus: v })}
            min={PARAMETER_BOUNDS.minRoundsBeforeConsensus.min}
            max={PARAMETER_BOUNDS.minRoundsBeforeConsensus.max}
            step={PARAMETER_BOUNDS.minRoundsBeforeConsensus.step}
          />
        </div>

        {/* Require Both Consensus */}
        <div className="flex items-center justify-between py-2">
          <div>
            <Label>{PARAMETER_LABELS.requireBothConsensus.label}</Label>
            <p className="text-xs text-gray-500">{PARAMETER_LABELS.requireBothConsensus.description}</p>
          </div>
          <Switch
            checked={values.requireBothConsensus}
            onCheckedChange={(v) => onChange({ requireBothConsensus: v })}
          />
        </div>
      </div>

      {/* Display Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Display Settings
        </h4>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label>{PARAMETER_LABELS.autoScrollEnabled.label}</Label>
            <p className="text-xs text-gray-500">{PARAMETER_LABELS.autoScrollEnabled.description}</p>
          </div>
          <Switch
            checked={values.autoScrollEnabled}
            onCheckedChange={(v) => onChange({ autoScrollEnabled: v })}
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label>{PARAMETER_LABELS.showTokenUsage.label}</Label>
            <p className="text-xs text-gray-500">{PARAMETER_LABELS.showTokenUsage.description}</p>
          </div>
          <Switch
            checked={values.showTokenUsage}
            onCheckedChange={(v) => onChange({ showTokenUsage: v })}
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label>{PARAMETER_LABELS.showTimings.label}</Label>
            <p className="text-xs text-gray-500">{PARAMETER_LABELS.showTimings.description}</p>
          </div>
          <Switch
            checked={values.showTimings}
            onCheckedChange={(v) => onChange({ showTimings: v })}
          />
        </div>
      </div>
    </div>
  );
}
```

---

### Step 5.18: Settings Panel Component

**File:** `src/components/settings/settings-panel.tsx`

**Purpose:** Main settings panel combining all settings sections.

```typescript
'use client';

import { useSettings } from '@/hooks/use-settings';
import { useProviderStatus } from '@/hooks/use-provider-status';
import { SettingsSection } from './settings-section';
import { ApiKeyInput } from './api-key-input';
import { ProviderStatus } from './provider-status';
import { ModelParameters } from './model-parameters';
import { DiscussionSettings } from './discussion-settings';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SETTINGS_SECTIONS } from '@/config/settings-constants';

export function SettingsPanel() {
  const {
    modelParams,
    updateModelParams,
    resetModelParams,
    applyPreset,
    discussionSettings,
    updateDiscussionSettings,
    resetDiscussionSettings,
    apiKeyStatus,
    setApiKey,
    clearApiKey,
    validateApiKey,
    isLoading,
    validationErrors,
  } = useSettings();

  const { statuses: providerStatuses, checkProvider } = useProviderStatus();

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="apiKeys" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="apiKeys">API Keys</TabsTrigger>
        <TabsTrigger value="providers">Providers</TabsTrigger>
        <TabsTrigger value="model">Model</TabsTrigger>
        <TabsTrigger value="discussion">Discussion</TabsTrigger>
      </TabsList>

      {/* API Keys Tab */}
      <TabsContent value="apiKeys" className="space-y-4 mt-4">
        <SettingsSection
          title={SETTINGS_SECTIONS.apiKeys.title}
          description={SETTINGS_SECTIONS.apiKeys.description}
        >
          <div className="space-y-6">
            <ApiKeyInput
              providerId="openai"
              maskedKey={apiKeyStatus.openai?.isConfigured ? '••••••••' : null}
              status={apiKeyStatus.openai}
              onSave={(key) => setApiKey('openai', key)}
              onClear={() => clearApiKey('openai')}
              onValidate={() => validateApiKey('openai')}
              error={validationErrors['apiKey.openai']}
            />
            <ApiKeyInput
              providerId="anthropic"
              maskedKey={apiKeyStatus.anthropic?.isConfigured ? '••••••••' : null}
              status={apiKeyStatus.anthropic}
              onSave={(key) => setApiKey('anthropic', key)}
              onClear={() => clearApiKey('anthropic')}
              onValidate={() => validateApiKey('anthropic')}
              error={validationErrors['apiKey.anthropic']}
            />
          </div>
        </SettingsSection>
      </TabsContent>

      {/* Providers Tab */}
      <TabsContent value="providers" className="space-y-4 mt-4">
        <SettingsSection
          title={SETTINGS_SECTIONS.providers.title}
          description={SETTINGS_SECTIONS.providers.description}
        >
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <ProviderStatus
              providerId="openai"
              isAvailable={providerStatuses.openai.isAvailable}
              isChecking={providerStatuses.openai.isChecking}
              modelsCount={providerStatuses.openai.modelsCount}
              errorMessage={providerStatuses.openai.errorMessage}
              onRefresh={() => checkProvider('openai')}
            />
            <ProviderStatus
              providerId="anthropic"
              isAvailable={providerStatuses.anthropic.isAvailable}
              isChecking={providerStatuses.anthropic.isChecking}
              modelsCount={providerStatuses.anthropic.modelsCount}
              errorMessage={providerStatuses.anthropic.errorMessage}
              onRefresh={() => checkProvider('anthropic')}
            />
            <ProviderStatus
              providerId="ollama"
              isAvailable={providerStatuses.ollama.isAvailable}
              isChecking={providerStatuses.ollama.isChecking}
              modelsCount={providerStatuses.ollama.modelsCount}
              errorMessage={providerStatuses.ollama.errorMessage}
              onRefresh={() => checkProvider('ollama')}
            />
          </div>
        </SettingsSection>
      </TabsContent>

      {/* Model Parameters Tab */}
      <TabsContent value="model" className="space-y-4 mt-4">
        <SettingsSection
          title={SETTINGS_SECTIONS.modelParameters.title}
          description={SETTINGS_SECTIONS.modelParameters.description}
          onReset={resetModelParams}
        >
          <ModelParameters
            values={modelParams}
            onChange={updateModelParams}
            onApplyPreset={applyPreset}
            errors={validationErrors}
          />
        </SettingsSection>
      </TabsContent>

      {/* Discussion Settings Tab */}
      <TabsContent value="discussion" className="space-y-4 mt-4">
        <SettingsSection
          title={SETTINGS_SECTIONS.discussionSettings.title}
          description={SETTINGS_SECTIONS.discussionSettings.description}
          onReset={resetDiscussionSettings}
        >
          <DiscussionSettings
            values={discussionSettings}
            onChange={updateDiscussionSettings}
            errors={validationErrors}
          />
        </SettingsSection>
      </TabsContent>
    </Tabs>
  );
}
```

---

### Step 5.19: Settings Dialog Component

**File:** `src/components/settings/settings-dialog.tsx`

**Purpose:** Modal wrapper for the settings panel.

```typescript
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SettingsPanel } from './settings-panel';

interface SettingsDialogProps {
  trigger?: React.ReactNode;
}

export function SettingsDialog({ trigger }: SettingsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure API keys, model parameters, and discussion settings.
          </DialogDescription>
        </DialogHeader>
        <SettingsPanel />
      </DialogContent>
    </Dialog>
  );
}
```

---

### Step 5.20: Environment Variables Template

**File:** `.env.example`

**Purpose:** Document required environment variables for deployment.

```bash
# =============================================================================
# AI Provider API Keys
# =============================================================================

# OpenAI API Key (required for OpenAI models)
# Get your key at: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...

# Anthropic API Key (required for Claude models)
# Get your key at: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-...

# =============================================================================
# Ollama Configuration (Optional)
# =============================================================================

# Ollama Base URL (default: http://localhost:11434)
# Change if running Ollama on a different host/port
OLLAMA_BASE_URL=http://localhost:11434

# =============================================================================
# Application Settings (Optional)
# =============================================================================

# Node environment
NODE_ENV=development

# Next.js server URL (for absolute URL generation)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Files to Create Summary

| File | Type | Description |
|------|------|-------------|
| `src/lib/config/types.ts` | Types | Configuration type definitions |
| `src/lib/config/defaults.ts` | Config | Default configuration values |
| `src/lib/config/schema.ts` | Validation | Zod validation schemas |
| `src/lib/config/env.ts` | Utility | Environment variable helpers |
| `src/lib/server/config-manager.ts` | Server | Server-side config management |
| `src/config/settings-constants.ts` | Config | UI constants and labels |
| `src/hooks/use-local-storage.ts` | Hook | LocalStorage persistence |
| `src/hooks/use-settings.ts` | Hook | Settings state management |
| `src/hooks/use-provider-status.ts` | Hook | Provider availability check |
| `src/app/api/config/route.ts` | API Route | Configuration endpoint |
| `src/app/api/config/validate/route.ts` | API Route | API key validation |
| `src/app/api/providers/status/route.ts` | API Route | Provider status check |
| `src/components/settings/settings-section.tsx` | Component | Section wrapper |
| `src/components/settings/api-key-input.tsx` | Component | Secure API key input |
| `src/components/settings/provider-status.tsx` | Component | Provider status display |
| `src/components/settings/model-parameters.tsx` | Component | Model parameter controls |
| `src/components/settings/discussion-settings.tsx` | Component | Discussion settings |
| `src/components/settings/settings-panel.tsx` | Component | Main settings panel |
| `src/components/settings/settings-dialog.tsx` | Component | Modal wrapper |
| `.env.example` | Config | Environment variables template |

**Total: 20 files**

---

## Key Technical Decisions Summary

| Decision | Rationale |
|----------|-----------|
| **API keys never in localStorage** | Security - keys stored only in server memory or env |
| **Validation caching (5 min)** | Balance freshness vs API rate limits |
| **Zod for validation** | Runtime type checking, clear error messages |
| **Config source tracking** | UI shows where value comes from (env/runtime/default) |
| **Key masking** | Display confirmation without exposing full key |
| **Preset configurations** | Quick setup for common use cases |
| **Cross-tab sync** | StorageEvent keeps multiple tabs in sync |
| **Minimal validation requests** | Use cheap endpoints (models list) to verify keys |
| **SSR-safe localStorage** | Load from storage only after mount |
| **Tabbed settings panel** | Organized, not overwhelming for users |

---

## Verification Steps

### Manual Testing Checklist

| Category | Check |
|----------|-------|
| **API Keys** | Can enter and save OpenAI key |
| **API Keys** | Can enter and save Anthropic key |
| **API Keys** | Key validation works correctly |
| **API Keys** | Masked key displays after save |
| **API Keys** | Can clear saved key |
| **API Keys** | Environment keys take effect |
| **Providers** | Status check shows availability |
| **Providers** | Ollama status works when running |
| **Providers** | Refresh updates status |
| **Model Params** | Sliders update values |
| **Model Params** | Presets apply correctly |
| **Model Params** | Values persist after refresh |
| **Discussion** | Safety limits configurable |
| **Discussion** | Toggle switches work |
| **Discussion** | Settings persist after refresh |
| **General** | Settings dialog opens/closes |
| **General** | Reset to defaults works |
| **General** | Cross-tab sync works |

### Security Verification

| Check | Expected Behavior |
|-------|-------------------|
| API keys in network tab | Only masked keys sent to client |
| localStorage inspection | No API keys stored |
| Console logging | No keys logged |
| Error messages | Don't expose key values |

---

## Dependencies on Previous Steps

This step requires completion of:

1. **Step 1**: Project setup, shadcn/ui components installed
2. **Step 2**: AI provider layer (`@/lib/ai` exports, `ProviderId` type)
3. **Step 3**: Discussion engine types (`DiscussionOptions`)
4. **Step 4**: Web UI integration point (settings button in header)

**Required shadcn/ui components:**
- dialog, tabs, slider, switch, input, label, button, badge, card, skeleton, tooltip

**New npm dependencies:**
- `zod` - Runtime validation
