import { AIProviderError } from '../core/errors';

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

function calculateDelay(attempt: number, config: RetryConfig, retryAfterMs?: number): number {
  if (retryAfterMs && retryAfterMs > 0) {
    return Math.min(retryAfterMs, config.maxDelayMs);
  }

  let delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  delay = Math.min(delay, config.maxDelayMs);

  if (config.jitter) {
    // Add 0-50% random jitter
    const jitterFactor = 0.5 + Math.random() * 0.5;
    delay = Math.floor(delay * jitterFactor);
  }

  return delay;
}

function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof AIProviderError) {
    return error.retryable;
  }

  // Network errors are typically retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Check HTTP status codes
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    return status >= 500 || status === 429;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const isRetryable = fullConfig.isRetryable ?? defaultIsRetryable;

  let lastError: unknown;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= fullConfig.maxRetries || !isRetryable(error)) {
        throw error;
      }

      const retryAfterMs = error instanceof AIProviderError ? error.retryAfterMs : undefined;
      const delay = calculateDelay(attempt, fullConfig, retryAfterMs);

      fullConfig.onRetry?.(error, attempt + 1, delay);

      await sleep(delay);
    }
  }

  throw lastError;
}

export function createRetryWrapper(
  config: Partial<RetryConfig>
): <T>(fn: () => Promise<T>) => Promise<T> {
  return <T>(fn: () => Promise<T>) => withRetry(fn, config);
}
