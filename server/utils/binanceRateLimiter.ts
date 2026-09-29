/**
 * Binance Weight & Backoff Controller (Phase 2.1)
 * Monitors 429 (Too Many Requests), 418 (IP Banned / Teapot), and x-mbx-used-weight headers.
 * Applies exponential backoff and prevents IP bans.
 */

export interface RateLimitState {
  usedWeight1m: number;
  maxWeight1m: number;
  isThrottled: boolean;
  throttleUntil: number;
  backoffFactor: number;
  consecutiveRateErrors: number;
}

const state: RateLimitState = {
  usedWeight1m: 0,
  maxWeight1m: 1200,
  isThrottled: false,
  throttleUntil: 0,
  backoffFactor: 1,
  consecutiveRateErrors: 0
};

export class BinanceRateLimiter {
  /**
   * Returns current rate limit state
   */
  static getState(): Readonly<RateLimitState> {
    const now = Date.now();
    if (state.isThrottled && now >= state.throttleUntil) {
      state.isThrottled = false;
      state.backoffFactor = Math.max(1, state.backoffFactor - 1);
    }
    return { ...state };
  }

  /**
   * Updates used weight from Binance response headers (x-mbx-used-weight-1m or x-mbx-used-weight)
   */
  static updateFromHeaders(headers: Record<string, string | string[] | undefined>) {
    if (!headers) return;

    const usedWeight = headers['x-mbx-used-weight-1m'] || headers['x-mbx-used-weight'];
    if (usedWeight) {
      const parsed = parseInt(String(usedWeight), 10);
      if (!isNaN(parsed)) {
        state.usedWeight1m = parsed;
        // If weight > 85% of limit (1020 / 1200), preemptively throttle
        if (state.usedWeight1m >= 1000) {
          state.isThrottled = true;
          state.throttleUntil = Math.max(state.throttleUntil, Date.now() + 10000);
        }
      }
    }

    const retryAfter = headers['retry-after'];
    if (retryAfter) {
      const seconds = parseInt(String(retryAfter), 10);
      if (!isNaN(seconds) && seconds > 0) {
        BinanceRateLimiter.triggerBackoff(429, seconds * 1000);
      }
    }
  }

  /**
   * Triggers backoff when status code 429 or 418 is encountered
   */
  static triggerBackoff(status: number, explicitCooldownMs?: number) {
    state.consecutiveRateErrors++;
    state.isThrottled = true;

    // Exponential backoff: 5s, 15s, 45s, up to 120s
    const baseCooldown = explicitCooldownMs || (status === 418 ? 60000 : 5000);
    const exponent = Math.min(4, state.consecutiveRateErrors);
    const cooldown = explicitCooldownMs || Math.min(180000, baseCooldown * Math.pow(2, exponent));

    state.throttleUntil = Date.now() + cooldown;
    state.backoffFactor = Math.min(8, state.backoffFactor * 2);

    console.warn(
      `⚠️ [BinanceRateLimiter] HTTP ${status} detectado! Ativando backoff exponencial por ${Math.round(cooldown / 1000)}s. Erros consecutivos: ${state.consecutiveRateErrors}.`
    );
  }

  /**
   * Resets rate error count on successful live requests
   */
  static recordSuccess() {
    if (state.consecutiveRateErrors > 0) {
      state.consecutiveRateErrors = 0;
    }
  }

  /**
   * Checks if outbound requests to Binance are currently permitted
   */
  static isAllowed(): boolean {
    const now = Date.now();
    if (state.isThrottled) {
      if (now >= state.throttleUntil) {
        state.isThrottled = false;
        return true;
      }
      return false;
    }
    return true;
  }

  /**
   * Returns remaining ms until throttle expires (0 if not throttled)
   */
  static getRemainingCooldownMs(): number {
    const now = Date.now();
    return Math.max(0, state.throttleUntil - now);
  }

  /**
   * R-5: throws a descriptive error when Binance calls must not proceed
   * (preventive cooldown against 429/418). Used by every limiter-aware caller
   * so that "silently hitting the API anyway" becomes impossible.
   */
  static assertAllowed(): void {
    if (!BinanceRateLimiter.isAllowed()) {
      const remaining = Math.round(BinanceRateLimiter.getRemainingCooldownMs() / 1000);
      throw new Error(
        `Binance API em cooldown preventivo contra 429/418 (${remaining}s restantes).`
      );
    }
  }
}
