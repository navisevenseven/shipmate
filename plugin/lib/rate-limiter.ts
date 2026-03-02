/**
 * Token bucket rate limiter.
 *
 * Default: 30 tool calls/min per session, burst up to 10 calls/sec.
 * On limit hit: throws RateLimitError (caller should return cached data or error with retry hint).
 */

export class RateLimitError extends Error {
  public retry_after_ms: number;

  constructor(retry_after_ms: number) {
    super(`Rate limit exceeded. Retry after ${Math.ceil(retry_after_ms / 1000)}s.`);
    this.name = "RateLimitError";
    this.retry_after_ms = retry_after_ms;
  }
}

export class RateLimiter {
  private tokens: number;
  private last_refill: number;
  private readonly max_tokens: number;
  private readonly refill_rate: number; // tokens per millisecond

  /**
   * @param max_tokens Maximum tokens in the bucket (burst capacity)
   * @param refill_per_minute How many tokens refill per minute
   */
  constructor(max_tokens = 10, refill_per_minute = 30) {
    this.max_tokens = max_tokens;
    this.tokens = max_tokens;
    this.last_refill = Date.now();
    this.refill_rate = refill_per_minute / 60_000;
  }

  /** Attempt to consume a token. Throws RateLimitError if no tokens available. */
  consume(): void {
    this.refill();

    if (this.tokens < 1) {
      const time_for_one_token = 1 / this.refill_rate;
      throw new RateLimitError(Math.ceil(time_for_one_token));
    }

    this.tokens -= 1;
  }

  /** Check if a call can be made without consuming a token. */
  canConsume(): boolean {
    this.refill();
    return this.tokens >= 1;
  }

  /** Current available tokens (for debugging/logging). */
  get availableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.last_refill;
    this.tokens = Math.min(this.max_tokens, this.tokens + elapsed * this.refill_rate);
    this.last_refill = now;
  }
}
