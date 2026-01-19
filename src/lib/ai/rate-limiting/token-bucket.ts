export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond

  constructor(tokensPerSecond: number, maxTokens?: number) {
    this.maxTokens = maxTokens ?? tokensPerSecond;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.refillRate = tokensPerSecond / 1000;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  tryConsume(count: number = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  getTimeUntilAvailable(count: number = 1): number {
    this.refill();
    if (this.tokens >= count) {
      return 0;
    }
    const tokensNeeded = count - this.tokens;
    return Math.ceil(tokensNeeded / this.refillRate);
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  hasTokens(count: number = 1): boolean {
    this.refill();
    return this.tokens >= count;
  }

  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}
