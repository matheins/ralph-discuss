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
