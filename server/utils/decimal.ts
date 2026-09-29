/**
 * Minimal fixed-point decimal arithmetic (Phase 3.4).
 *
 * Money and position-size maths in this codebase used raw IEEE-754 doubles, so expressions like
 * `entry + risk * 1.5` accumulate representation error and a chain of PnL additions can end up a cent or
 * two away from the exact value. These helpers do the arithmetic on scaled integers (8 decimal places)
 * so the result is exact for the magnitudes a trading account deals with.
 *
 * This is intentionally a small internal utility rather than a new dependency: the project has no
 * decimal library today and adding one is a separate decision. If more financial maths moves server-side
 * (fills, PnL ledgers, fee accounting), replacing this module with a full decimal library is the right
 * follow-up — the call sites are already isolated behind these functions.
 *
 * Range note: values are scaled by 1e8 into a BigInt. Inputs beyond ~9e10 lose sub-cent precision, which
 * is far outside the range of prices, quantities and balances used here.
 */

const DECIMALS = 8;
const SCALE_FACTOR = 10n ** BigInt(DECIMALS);
const HALF = SCALE_FACTOR / 2n;

function scale(value: number): bigint {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`decimal: expected a finite number, received ${value}`);
  }
  return BigInt(Math.round(value * Number(SCALE_FACTOR)));
}

function unscale(scaled: bigint): number {
  return Number(scaled) / Number(SCALE_FACTOR);
}

/** Exact addition. */
export function dAdd(a: number, b: number): number {
  return unscale(scale(a) + scale(b));
}

/** Exact subtraction. */
export function dSub(a: number, b: number): number {
  return unscale(scale(a) - scale(b));
}

/** Exact multiplication. */
export function dMul(a: number, b: number): number {
  return unscale((scale(a) * scale(b)) / SCALE_FACTOR);
}

/** Exact division. Throws on a zero divisor rather than returning Infinity. */
export function dDiv(a: number, b: number): number {
  const divisor = scale(b);
  if (divisor === 0n) {
    throw new Error('decimal: division by zero');
  }
  return unscale((scale(a) * SCALE_FACTOR) / divisor);
}

/** Rounds half-away-from-zero to the given number of decimal places. */
export function dRound(value: number, decimals: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  const step = 10n ** BigInt(Math.max(0, DECIMALS - Math.max(0, Math.trunc(decimals))));
  const scaled = scale(value);
  const rounded = ((scaled + (scaled < 0n ? -(step / 2n) : (step / 2n))) / step) * step;
  return unscale(rounded);
}

/** Clamps a value into [min, max]. */
export function dClamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
