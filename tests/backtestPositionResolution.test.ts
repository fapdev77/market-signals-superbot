import { describe, it, expect } from 'vitest';
import { resolveBacktestPosition } from '../server/services/BacktestEngine.js';

/**
 * R-9 — Parcial + runner no backtest (fidelidade ao live).
 *
 * Antes: o TP1 apenas ativava o breakeven, mas o PnL continuava calculado
 * sobre a posição CHEIA até o TP2 (ou até o close voltar ao TP1). O live
 * realiza 50% no TP1 e carrega o runner. Agora `resolveBacktestPosition`
 * modela exatamente isso:
 *
 *   - TP1 tocado → realiza 50% ao preço de TP1 (com slippage), move o stop
 *     para a entrada (breakeven) e mantém 50% até TP2 ou breakeven;
 *   - se stop e alvo tocam no mesmo candle, o STOP prevalece (regra 2.3);
 *   - stop pós-breakeven ≈ entrada: perda total ≈ 0 − taxas (a perna realizada
 *     em TP1 compensa a perna parada);
 *   - candle em que a posição foi aberta não resolve pela mesma barra.
 */

const baseCandle = {
  timestamp: 1_000,
  open: 100,
  high: 110,
  low: 90,
  close: 105,
  volume: 10,
  takerBuyVolume: 5
};

const longPos = {
  direction: 'LONG' as const,
  entryPrice: 100,
  entryTime: 0,
  stopLoss: 90,
  target1: 110,
  target2: 120,
  openedThisCandle: false
};

const slipPct = 0.02; // 0.02%

describe('R-9 backtest partial + runner resolution', () => {
  it('does not resolve anything when no level is touched', () => {
    const result = resolveBacktestPosition(
      { ...baseCandle, high: 105, low: 95 }, // quiet candle
      longPos,
      { partialTaken: false, isBreakevenActive: false },
      slipPct
    );
    expect(result).toBeNull();
  });

  it('stop beats target when both are touched in the same candle', () => {
    const result = resolveBacktestPosition(
      baseCandle, // touches 90 (stop) and 110 (TP1) and 120 (TP2)
      longPos,
      { partialTaken: false, isBreakevenActive: false },
      slipPct
    );
    expect(result).not.toBeNull();
    expect(result!.exitPrice).toBeCloseTo(90 * (1 - slipPct / 100), 8);
    expect(result!.exitLegs).toEqual([{ leg: 'FULL', price: result!.exitPrice, size: 1 }]);
  });

  it('TP1 realizes 50% with slippage, activates breakeven, and keeps the runner open', () => {
    const result = resolveBacktestPosition(
      { ...baseCandle, high: 111, low: 95, close: 108 }, // touches TP1 only
      longPos,
      { partialTaken: false, isBreakevenActive: false },
      slipPct
    );
    expect(result).not.toBeNull();
    expect(result!.isWin).toBe(true);
    expect(result!.nextState.partialTaken).toBe(true);
    expect(result!.nextState.isBreakevenActive).toBe(true);
    expect(result!.nextState.stopLoss).toBe(100); // entry
    expect(result!.exitLegs).toHaveLength(1);
    expect(result!.exitLegs[0].leg).toBe('PARTIAL');
    expect(result!.exitLegs[0].size).toBe(0.5);
    expect(result!.exitLegs[0].price).toBeCloseTo(110 * (1 - slipPct / 100), 8);
  });

  it('full trade: TP1 partial then TP2 closes the runner — PnL ≈ 0.5·TP1 + 0.5·TP2 (± fees)', () => {
    // Leg 1: partial at TP1
    const leg1 = resolveBacktestPosition(
      { ...baseCandle, high: 111, low: 95, close: 108 },
      longPos,
      { partialTaken: false, isBreakevenActive: false },
      slipPct
    )!;

    // Leg 2: runner exits at TP2
    const leg2 = resolveBacktestPosition(
      { ...baseCandle, timestamp: 2_000, high: 121, low: 105, close: 119 },
      longPos,
      leg1.nextState,
      slipPct
    )!;

    expect(leg2.exitLegs).toHaveLength(1);
    expect(leg2.exitLegs[0].leg).toBe('RUNNER');
    expect(leg2.exitLegs[0].size).toBe(0.5);
    expect(leg2.exitLegs[0].price).toBeCloseTo(120 * (1 - slipPct / 100), 8);

    // grossPnlPct on each resolution covers ONLY that candle's legs; the
    // engine accumulates both candles' PnL on the balance.
    const grossPct = 0.5 * ((leg1.exitLegs[0].price - 100) / 100) * 100
                   + 0.5 * ((leg2.exitLegs[0].price - 100) / 100) * 100;
    expect(leg1.grossPnlPct + leg2.grossPnlPct).toBeCloseTo(grossPct, 8);
    expect(leg2.grossPnlPct).toBeCloseTo(0.5 * ((leg2.exitLegs[0].price - 100) / 100) * 100, 8);
    expect(leg2.isWin).toBe(true);
  });

  it('stop after breakeven nets ≈ half of TP1 minus fees (no full-loss disaster)', () => {
    // Leg 1: partial at TP1
    const leg1 = resolveBacktestPosition(
      { ...baseCandle, high: 111, low: 95, close: 108 },
      longPos,
      { partialTaken: false, isBreakevenActive: false },
      slipPct
    )!;

    // Leg 2: runner stopped at breakeven stop (100)
    const leg2 = resolveBacktestPosition(
      { ...baseCandle, timestamp: 2_000, high: 105, low: 99, close: 100 },
      longPos,
      leg1.nextState,
      slipPct
    )!;

    expect(leg2.exitLegs[0].leg).toBe('RUNNER');
    expect(leg2.exitLegs[0].price).toBeCloseTo(100 * (1 - slipPct / 100), 8);

    // Runner leg alone ≈ 0 (entry exit), the partial leg banked 0.5·TP1
    expect(leg2.grossPnlPct).toBeCloseTo(
      0.5 * ((leg2.exitLegs[0].price - 100) / 100) * 100, 8
    );
    // Total gross = partial leg + runner leg ≈ +5% (half of the +10% TP1 move)
    const totalGross = 0.5 * ((leg1.exitLegs[0].price - 100) / 100) * 100
                     + 0.5 * ((leg2.exitLegs[0].price - 100) / 100) * 100;
    expect(totalGross).toBeGreaterThan(4.5);
  });

  it('mirrors the logic for SHORT positions (stop above, targets below)', () => {
    const shortPos = {
      direction: 'SHORT' as const,
      entryPrice: 100,
      entryTime: 0,
      stopLoss: 110,
      target1: 90,
      target2: 80,
      openedThisCandle: false
    };

    // TP1 partial
    const leg1 = resolveBacktestPosition(
      { ...baseCandle, high: 105, low: 89, close: 92 },
      shortPos,
      { partialTaken: false, isBreakevenActive: false },
      slipPct
    )!;
    expect(leg1.exitLegs[0].leg).toBe('PARTIAL');
    expect(leg1.exitLegs[0].price).toBeCloseTo(90 * (1 + slipPct / 100), 8);
    expect(leg1.nextState.stopLoss).toBe(100);

    // Runner at TP2
    const leg2 = resolveBacktestPosition(
      { ...baseCandle, timestamp: 2_000, high: 95, low: 79, close: 81 },
      shortPos,
      leg1.nextState,
      slipPct
    )!;
    expect(leg2.exitLegs[0].leg).toBe('RUNNER');
    expect(leg2.exitLegs[0].price).toBeCloseTo(80 * (1 + slipPct / 100), 8);
    expect(leg2.isWin).toBe(true);
  });

  it('stop wins even when the breakeven stop and TP1 are touched together (stop-first rule)', () => {
    // After breakeven, stop = 100; a candle touching 100 and 110 resolves as stop.
    const result = resolveBacktestPosition(
      { ...baseCandle, high: 110, low: 100, close: 105 },
      longPos,
      { partialTaken: true, isBreakevenActive: true, stopLoss: 100 },
      slipPct
    )!;
    expect(result.exitLegs[0].leg).toBe('RUNNER');
    expect(result.exitLegs[0].price).toBeCloseTo(100 * (1 - slipPct / 100), 8);
  });

  it('does not resolve by the same candle the position was opened in', () => {
    const result = resolveBacktestPosition(
      baseCandle,
      { ...longPos, openedThisCandle: true },
      { partialTaken: false, isBreakevenActive: false },
      slipPct
    );
    expect(result).toBeNull();
  });
});
