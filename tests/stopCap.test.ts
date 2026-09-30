import { describe, it, expect } from 'vitest';
import {
  enforceStopCap,
  getStopCapPct,
  STRATEGY_STOP_CAP_PCT,
  type StrategyCategoryLike
} from '../server/services/stopCap.js';

/**
 * 6.7.4 / CA-7.3 — teto do stop por estratégia (MAX_STOP_PCT).
 *
 * D7 (aprovado): defaults calibrados a partir do histórico (p25/p75 do stop por
 * categoria, ~288k velas 1m reais no DB) e sobreponíveis por env. Stop acima do
 * teto ⇒ sinal suprimido com motivo `STOP_TOO_WIDE` (sem lançar exceção).
 *
 * A "distância de stop" é |entry - stop| / entry, em % — a mesma noção de
 * `signalRiskPct` do RiskManager.
 */

describe('6.7.4 — teto por categoria (defaults calibrados, D7)', () => {
  it('SCALP é mais apertado que DAY_TRADE, que é mais apertado que SWING/POSITION', () => {
    const order: StrategyCategoryLike[] = ['SCALP', 'DAY_TRADE', 'INTRADAY', 'SWING', 'POSITION'];
    for (let i = 1; i < order.length; i++) {
      expect(STRATEGY_STOP_CAP_PCT[order[i - 1]]).toBeLessThanOrEqual(STRATEGY_STOP_CAP_PCT[order[i]]);
    }
  });

  it('getStopCapPct lê env com fallback para o default da categoria', () => {
    const original = process.env.MAX_STOP_PCT_SCALP;
    process.env.MAX_STOP_PCT_SCALP = '1.5';
    expect(getStopCapPct('SCALP')).toBe(1.5);
    if (original === undefined) delete process.env.MAX_STOP_PCT_SCALP; else process.env.MAX_STOP_PCT_SCALP = original;
    expect(getStopCapPct('SCALP')).toBe(STRATEGY_STOP_CAP_PCT.SCALP);
    // categoria desconhecida cai no teto de INTRADAY (fail-conservative)
    expect(getStopCapPct('CUSTOM')).toBeGreaterThan(0);
  });
});

describe('6.7.4 — enforceStopCap (CA-7.3)', () => {
  it('stop dentro do teto ⇒ permitido, sem motivo', () => {
    // INTRADAY: entry 100, stop 99 ⇒ 1% de distância
    const r = enforceStopCap({ strategyCategory: 'INTRADAY', entryPrice: 100, stopLoss: 99 });
    expect(r.allowed).toBe(true);
    expect(r.reason).toBeUndefined();
    expect(r.stopDistancePct).toBeCloseTo(1, 6);
  });

  it('stop LONG exatamente no teto ⇒ permitido (teto é inclusivo)', () => {
    const cap = getStopCapPct('INTRADAY');
    const r = enforceStopCap({ strategyCategory: 'INTRADAY', entryPrice: 100, stopLoss: 100 * (1 - cap / 100) });
    expect(r.allowed).toBe(true);
  });

  it('stop LONG acima do teto ⇒ suprimido com STOP_TOO_WIDE', () => {
    const cap = getStopCapPct('SCALP');
    const r = enforceStopCap({ strategyCategory: 'SCALP', entryPrice: 100, stopLoss: 100 * (1 - cap / 100 - 0.005) });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('STOP_TOO_WIDE');
    expect(r.stopDistancePct).toBeGreaterThan(cap);
  });

  it('stop SHORT acima do teto (stop acima do preço) ⇒ suprimido', () => {
    const cap = getStopCapPct('SCALP');
    const r = enforceStopCap({ strategyCategory: 'SCALP', entryPrice: 100, stopLoss: 100 * (1 + cap / 100 + 0.005) });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('STOP_TOO_WIDE');
  });

  it('preços inválidos ⇒ suprimido fail-closed (não deixa passar)', () => {
    expect(enforceStopCap({ strategyCategory: 'INTRADAY', entryPrice: 0, stopLoss: 99 }).allowed).toBe(false);
    expect(enforceStopCap({ strategyCategory: 'INTRADAY', entryPrice: NaN, stopLoss: 99 }).allowed).toBe(false);
  });
});
