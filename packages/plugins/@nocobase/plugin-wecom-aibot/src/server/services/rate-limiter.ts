/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

/**
 * Token bucket rate limiter used by the outbound service.
 * WeCom allows at most 30 messages per minute per conversation; the bucket is
 * configured per bot with a safe threshold below the official limit (default 25/min).
 */
export class TokenBucket {
  private tokens: number;
  private lastRefillAt = Date.now();

  constructor(private ratePerMinute: number) {
    this.tokens = ratePerMinute;
  }

  /** Update the rate when bot configuration changes. */
  setRate(ratePerMinute: number): void {
    this.ratePerMinute = Math.max(1, ratePerMinute);
    this.tokens = Math.min(this.tokens, this.ratePerMinute);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillAt;
    if (elapsed <= 0) {
      return;
    }
    const refillAmount = (elapsed / 60000) * this.ratePerMinute;
    this.tokens = Math.min(this.ratePerMinute, this.tokens + refillAmount);
    this.lastRefillAt = now;
  }

  tryTake(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Milliseconds until the next token becomes available. */
  msUntilNextToken(): number {
    this.refill();
    if (this.tokens >= 1) {
      return 0;
    }
    const missing = 1 - this.tokens;
    return Math.ceil((missing / this.ratePerMinute) * 60000);
  }
}

export default TokenBucket;
