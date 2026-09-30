import { describe, it, expect } from 'vitest';
import { calculateWsBackoff } from '../server/utils/wsUrl.js';

describe('M0.5: WebSocket reconnection backoff with jitter and 60s cap', () => {
  it('calculates initial backoff within reasonable range', () => {
    const delay = calculateWsBackoff(1, { baseMs: 1000, maxMs: 60000, jitter: 0.2 });
    // base: 1000 * 2^0 = 1000 +/- 20% -> between 800 and 1200
    expect(delay).toBeGreaterThanOrEqual(800);
    expect(delay).toBeLessThanOrEqual(1200);
  });

  it('exponentially scales with attempts', () => {
    const attempt1 = calculateWsBackoff(1, { baseMs: 1000, maxMs: 60000, jitter: 0 });
    const attempt2 = calculateWsBackoff(2, { baseMs: 1000, maxMs: 60000, jitter: 0 });
    const attempt3 = calculateWsBackoff(3, { baseMs: 1000, maxMs: 60000, jitter: 0 });
    const attempt4 = calculateWsBackoff(4, { baseMs: 1000, maxMs: 60000, jitter: 0 });

    expect(attempt1).toBe(1000);
    expect(attempt2).toBe(2000);
    expect(attempt3).toBe(4000);
    expect(attempt4).toBe(8000);
  });

  it('caps the delay at maxMs (60s)', () => {
    const hugeAttempt = calculateWsBackoff(15, { baseMs: 1000, maxMs: 60000, jitter: 0 });
    expect(hugeAttempt).toBe(60000);
  });

  it('adds jitter within bounds', () => {
    for (let i = 0; i < 20; i++) {
      const delay = calculateWsBackoff(3, { baseMs: 1000, maxMs: 60000, jitter: 0.25 });
      // 4000 +/- 25% -> 3000 to 5000
      expect(delay).toBeGreaterThanOrEqual(3000);
      expect(delay).toBeLessThanOrEqual(5000);
    }
  });
});
