import { describe, it, expect } from 'vitest';
import {
  evaluatePendingEntry,
  entryWaitCandlesFor,
  ENTRY_MAX_WAIT_CANDLES,
  type PendingEntrySignal
} from '../server/services/pendingEntryLifecycle.js';
import { KlineCandle } from '../src/types.js';

/**
 * 6.7.3 — ciclo de vida do sinal PENDING_ENTRY (aprovação D1–D8 de 2026-09-30):
 *
 *   PENDING_ENTRY ──(toque da zona + confirmEntry)──► ACTIVE  [ENTRY no preço do preenchimento]
 *        ├── sem toque em N candles ──► terminal ENTRY_NOT_FILLED (não-evento p/ R — D4)
 *        └── invalidação antes do toque ──► terminal ENTRY_INVALIDATED
 *
 * Emissão NUNCA grava ENTRY; o preço de preenchimento é clamp(close_1m, entryMin, entryMax) (D3).
 * Apenas 1m é consumido aqui (o toque é intracandle via high/low).
 */

function candle(openTime: number, o: number, h: number, l: number, c: number): KlineCandle {
  return { timestamp: openTime, open: o, high: h, low: l, close: c, volume: 1, takerBuyVolume: 0.6 } as KlineCandle;
}

function pendingSignal(overrides: Partial<PendingEntrySignal> = {}): PendingEntrySignal {
  return {
    id: 'pend-1',
    direction: 'LONG',
    entryZone: [100, 100.5],
    stopLoss: 98,
    target1: 104,
    target2: 108,
    strategyCategory: 'SCALP',
    createdAt: 1_000_000,
    ...overrides
  };
}

// confirmEntry fake: controlado por teste (o toque é da vida; a confirmação é do motor).
const confirmAlways = () => ({ confirmed: true, reasons: [] });
const denyAlways = () => ({ confirmed: false, reasons: ['R2 body: negado'] });

describe('6.7.3 — transição para ACTIVE (toque + confirmação)', () => {
  it('candle toca a zona e confirmEntry confirma ⇒ ACTIVE com fill clamp(close, min, max) (D3)', () => {
    // candle fecha acima da zona mas o low toca 100.2 ∈ [100, 100.5]
    const candles = [candle(1_000_000, 100.4, 100.8, 100.2, 100.7)];
    const r = evaluatePendingEntry({
      signal: pendingSignal(),
      candles1m: candles,
      confirm: confirmAlways,
      now: 1_100_000
    });
    expect(r.transition).toBe('ACTIVATED');
    expect(r.entryPrice).toBe(100.5); // clamp(100.7, 100, 100.5)
    expect(r.fillCandleOpenTime).toBe(1_000_000);
  });

  it('candle cruza a zona inteira ⇒ fill no close clamped para dentro', () => {
    const candles = [candle(1_000_000, 101, 102, 99, 103)];
    const r = evaluatePendingEntry({
      signal: pendingSignal(),
      candles1m: candles,
      confirm: confirmAlways,
      now: 1_100_000
    });
    expect(r.transition).toBe('ACTIVATED');
    expect(r.entryPrice).toBe(100.5); // clamp(103, 100, 100.5)
  });

  it('toque + confirmação negada ⇒ permanece PENDING (sem transição)', () => {
    const candles = [candle(1_000_000, 100.4, 100.8, 100.2, 100.7)];
    const r = evaluatePendingEntry({
      signal: pendingSignal(),
      candles1m: candles,
      confirm: denyAlways,
      now: 1_100_000
    });
    expect(r.transition).toBe('NONE');
    expect(r.entryPrice).toBeUndefined();
  });

  it('confirmação ok mas preço NÃO tocou a zona ⇒ PENDING (R6 é condição do ciclo)', () => {
    const candles = [candle(1_000_000, 101, 101.5, 100.9, 101.2)]; // low 100.9 > 100.5 (fora)
    const r = evaluatePendingEntry({
      signal: pendingSignal(),
      candles1m: candles,
      confirm: confirmAlways,
      now: 1_100_000
    });
    expect(r.transition).toBe('NONE');
  });

  it('SHORT: toque pela parte alta da zona também preenche com clamp', () => {
    const candles = [candle(1_000_000, 100.8, 101.0, 100.3, 100.6)]; // high 101 ≥ 100 (toca)
    const r = evaluatePendingEntry({
      signal: pendingSignal({ direction: 'SHORT', entryZone: [100, 100.5] }),
      candles1m: candles,
      confirm: confirmAlways,
      now: 1_100_000
    });
    expect(r.transition).toBe('ACTIVATED');
    expect(r.entryPrice).toBe(100.5); // clamp(100.6, 100, 100.5)
  });
});

describe('6.7.3 — expiração por candles (D5: multiplicador por categoria)', () => {
  it('ENTRY_MAX_WAIT_CANDLES base = 3 (1m) para SCALP', () => {
    expect(ENTRY_MAX_WAIT_CANDLES).toBe(3);
    expect(entryWaitCandlesFor('SCALP')).toBe(3);
  });

  it('multiplicador por timeframe: SWING/POSITION esperam mais candles que SCALP', () => {
    expect(entryWaitCandlesFor('SWING')).toBeGreaterThan(entryWaitCandlesFor('SCALP'));
    expect(entryWaitCandlesFor('POSITION')).toBeGreaterThan(entryWaitCandlesFor('SWING'));
    expect(entryWaitCandlesFor('DAY_TRADE')).toBeGreaterThanOrEqual(3);
  });

  it('sem toque por N candles ⇒ terminal ENTRY_NOT_FILLED, sem preço de preenchimento', () => {
    // SCALP: N=3. Quatro candles 1m sem toque.
    const candles = [1, 2, 3, 4].map(i => candle(1_000_000 + (i - 1) * 60_000, 101, 101.5, 100.9, 101.2));
    const r = evaluatePendingEntry({
      signal: pendingSignal(),
      candles1m: candles,
      confirm: confirmAlways,
      now: 1_300_000
    });
    expect(r.transition).toBe('ENTRY_NOT_FILLED');
    expect(r.entryPrice).toBeUndefined();
  });

  it('toque no 3º candle ainda ativa (dentro da janela)', () => {
    const candles = [
      candle(1_000_000, 101, 101.5, 100.9, 101.2),
      candle(1_060_000, 101.2, 101.6, 100.95, 101.3),
      candle(1_120_000, 101.3, 101.7, 100.1, 101.2) // toca a zona no 3º
    ];
    const r = evaluatePendingEntry({
      signal: pendingSignal(),
      candles1m: candles,
      confirm: confirmAlways,
      now: 1_200_000
    });
    expect(r.transition).toBe('ACTIVATED');
    expect(r.entryPrice).toBe(100.5);
  });
});

describe('6.7.3 — invalidação antes do toque', () => {
  it('movimento adverso além do stop antes de tocar a zona ⇒ ENTRY_INVALIDATED', () => {
    // LONG: candle inteiro abaixo do stop (98) sem tocar a zona
    const candles = [candle(1_000_000, 97.5, 97.9, 97.0, 97.2)];
    const r = evaluatePendingEntry({
      signal: pendingSignal(),
      candles1m: candles,
      confirm: confirmAlways,
      now: 1_100_000
    });
    expect(r.transition).toBe('ENTRY_INVALIDATED');
    expect(r.entryPrice).toBeUndefined();
  });
});
