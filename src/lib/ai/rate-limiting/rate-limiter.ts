import type { ProviderId, RateLimitConfig, RateLimitState } from '../core/types';
import { RateLimitError } from '../core/errors';
import { TokenBucket } from './token-bucket';

// Default rate limits per provider
const DEFAULT_RATE_LIMITS: Record<ProviderId, RateLimitConfig> = {
  openai: {
    requestsPerMinute: 500,
    tokensPerMinute: 30000,
    maxConcurrent: 10,
    burstAllowance: 50,
  },
  anthropic: {
    requestsPerMinute: 50,
    tokensPerMinute: 40000,
    maxConcurrent: 5,
    burstAllowance: 10,
  },
  ollama: {
    requestsPerMinute: 1000,
    maxConcurrent: 2,
    burstAllowance: 10,
  },
};

export class ProviderRateLimiter {
  private readonly providerId: ProviderId;
  private readonly config: RateLimitConfig;
  private readonly requestBucket: TokenBucket;
  private readonly tokenBucket?: TokenBucket;
  private currentConcurrent = 0;

  constructor(providerId: ProviderId, config?: Partial<RateLimitConfig>) {
    this.providerId = providerId;
    this.config = {
      ...DEFAULT_RATE_LIMITS[providerId],
      ...config,
    };

    // Request rate limiter (requests per second = requestsPerMinute / 60)
    const requestsPerSecond = this.config.requestsPerMinute / 60;
    this.requestBucket = new TokenBucket(
      requestsPerSecond,
      this.config.burstAllowance
    );

    // Optional token rate limiter
    if (this.config.tokensPerMinute) {
      const tokensPerSecond = this.config.tokensPerMinute / 60;
      this.tokenBucket = new TokenBucket(tokensPerSecond, tokensPerSecond * 10);
    }
  }

  acquire(estimatedTokens?: number): void {
    // Check concurrent limit
    if (this.currentConcurrent >= this.config.maxConcurrent) {
      throw new RateLimitError(
        this.providerId,
        1000,
        `Maximum concurrent requests (${this.config.maxConcurrent}) reached`
      );
    }

    // Check request rate limit
    if (!this.requestBucket.tryConsume(1)) {
      const waitTime = this.requestBucket.getTimeUntilAvailable(1);
      throw new RateLimitError(
        this.providerId,
        waitTime,
        'Request rate limit exceeded'
      );
    }

    // Check token rate limit if applicable
    if (this.tokenBucket && estimatedTokens) {
      if (!this.tokenBucket.tryConsume(estimatedTokens)) {
        const waitTime = this.tokenBucket.getTimeUntilAvailable(estimatedTokens);
        throw new RateLimitError(
          this.providerId,
          waitTime,
          'Token rate limit exceeded'
        );
      }
    }

    this.currentConcurrent++;
  }

  release(_actualTokens?: number): void {
    this.currentConcurrent = Math.max(0, this.currentConcurrent - 1);
    // Note: actualTokens could be used to adjust token bucket, but we use estimated only
  }

  getState(): RateLimitState {
    return {
      availableRequests: this.requestBucket.getAvailableTokens(),
      availableTokens: this.tokenBucket?.getAvailableTokens(),
      currentConcurrent: this.currentConcurrent,
      nextRequestInMs: this.requestBucket.getTimeUntilAvailable(1),
      isLimited:
        this.currentConcurrent >= this.config.maxConcurrent ||
        !this.requestBucket.hasTokens(1),
    };
  }

  reset(): void {
    this.requestBucket.reset();
    this.tokenBucket?.reset();
    this.currentConcurrent = 0;
  }
}

// Singleton manager for all provider rate limiters
class RateLimiterManager {
  private limiters = new Map<ProviderId, ProviderRateLimiter>();

  get(providerId: ProviderId): ProviderRateLimiter {
    let limiter = this.limiters.get(providerId);
    if (!limiter) {
      limiter = new ProviderRateLimiter(providerId);
      this.limiters.set(providerId, limiter);
    }
    return limiter;
  }

  configure(providerId: ProviderId, config: Partial<RateLimitConfig>): void {
    const limiter = new ProviderRateLimiter(providerId, config);
    this.limiters.set(providerId, limiter);
  }

  getAllStates(): Record<ProviderId, RateLimitState> {
    const states: Partial<Record<ProviderId, RateLimitState>> = {};
    for (const [id, limiter] of this.limiters) {
      states[id] = limiter.getState();
    }
    return states as Record<ProviderId, RateLimitState>;
  }

  reset(providerId?: ProviderId): void {
    if (providerId) {
      this.limiters.get(providerId)?.reset();
    } else {
      for (const limiter of this.limiters.values()) {
        limiter.reset();
      }
    }
  }
}

export const rateLimiterManager = new RateLimiterManager();
