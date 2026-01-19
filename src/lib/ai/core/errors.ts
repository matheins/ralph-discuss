import type { ProviderError, ProviderErrorCode, ProviderId } from './types';

export class AIProviderError extends Error implements ProviderError {
  public readonly code: ProviderErrorCode;
  public readonly providerId: ProviderId;
  public readonly statusCode?: number;
  public readonly retryable: boolean;
  public readonly retryAfterMs?: number;
  public readonly originalError?: unknown;

  constructor(params: ProviderError) {
    super(params.message);
    this.name = 'AIProviderError';
    this.code = params.code;
    this.providerId = params.providerId;
    this.statusCode = params.statusCode;
    this.retryable = params.retryable;
    this.retryAfterMs = params.retryAfterMs;
    this.originalError = params.originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AIProviderError);
    }
  }

  static fromUnknown(error: unknown, providerId: ProviderId): AIProviderError {
    if (error instanceof AIProviderError) {
      return error;
    }
    const message = error instanceof Error ? error.message : String(error);
    return new AIProviderError({
      code: 'UNKNOWN',
      message,
      providerId,
      retryable: false,
      originalError: error,
    });
  }
}

export class AuthenticationError extends AIProviderError {
  constructor(providerId: ProviderId, message?: string) {
    super({
      code: 'AUTH_ERROR',
      message: message || `Authentication failed for provider: ${providerId}`,
      providerId,
      statusCode: 401,
      retryable: false,
    });
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends AIProviderError {
  constructor(providerId: ProviderId, retryAfterMs: number, message?: string) {
    super({
      code: 'RATE_LIMIT',
      message: message || `Rate limit exceeded for provider: ${providerId}`,
      providerId,
      statusCode: 429,
      retryable: true,
      retryAfterMs,
    });
    this.name = 'RateLimitError';
  }
}

export class ConnectionError extends AIProviderError {
  constructor(providerId: ProviderId, message?: string) {
    super({
      code: 'CONNECTION_ERROR',
      message: message || `Failed to connect to provider: ${providerId}`,
      providerId,
      retryable: true,
      retryAfterMs: 5000,
    });
    this.name = 'ConnectionError';
  }
}

export class ModelNotFoundError extends AIProviderError {
  constructor(providerId: ProviderId, modelId: string) {
    super({
      code: 'MODEL_NOT_FOUND',
      message: `Model "${modelId}" not found for provider: ${providerId}`,
      providerId,
      statusCode: 404,
      retryable: false,
    });
    this.name = 'ModelNotFoundError';
  }
}

export class TimeoutError extends AIProviderError {
  constructor(providerId: ProviderId, timeoutMs: number) {
    super({
      code: 'TIMEOUT',
      message: `Request timed out after ${timeoutMs}ms for provider: ${providerId}`,
      providerId,
      retryable: true,
      retryAfterMs: 1000,
    });
    this.name = 'TimeoutError';
  }
}

export function mapProviderError(error: unknown, providerId: ProviderId): AIProviderError {
  if (error instanceof AIProviderError) {
    return error;
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new ConnectionError(providerId, 'Network request failed');
  }

  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    const message = (error as { message?: string }).message || 'Unknown error';

    switch (status) {
      case 401:
        return new AuthenticationError(providerId, message);
      case 429:
        const retryAfter = extractRetryAfter(error);
        return new RateLimitError(providerId, retryAfter, message);
      case 404:
        return new AIProviderError({
          code: 'MODEL_NOT_FOUND',
          message,
          providerId,
          statusCode: 404,
          retryable: false,
        });
      case 400:
        return new AIProviderError({
          code: 'VALIDATION_ERROR',
          message,
          providerId,
          statusCode: 400,
          retryable: false,
        });
      default:
        return new AIProviderError({
          code: 'PROVIDER_ERROR',
          message,
          providerId,
          statusCode: status,
          retryable: status >= 500,
          originalError: error,
        });
    }
  }

  return AIProviderError.fromUnknown(error, providerId);
}

function extractRetryAfter(error: unknown): number {
  const DEFAULT_RETRY_MS = 60000;

  if (error && typeof error === 'object') {
    const headers = (error as { headers?: Record<string, string> }).headers;
    if (headers?.['retry-after']) {
      const seconds = parseInt(headers['retry-after'], 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
    }
    const retryAfterMs = (error as { retryAfterMs?: number }).retryAfterMs;
    if (typeof retryAfterMs === 'number') {
      return retryAfterMs;
    }
  }

  return DEFAULT_RETRY_MS;
}
