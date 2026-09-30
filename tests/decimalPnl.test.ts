import { describe, it, expect } from 'vitest';
import { dAdd, dMul, dSub, dDiv } from '../server/utils/decimal.js';
import { resolvePosition, type PositionState } from '../server/services/positionResolution.js';

/**
 * 6.5.1 / CA-5.1 — aritmética decimal exata no caminho de PnL.
 *
 * Valores escolhidos empiricalmente para QUEBRAR em IEEE-754 (verificados em Node):
 *   - stop com slippage (LONG):  0.04*(1-0.1/100)/... → -60.040000000000006 (exato: -60.04)
 *   - stop com slippage (SHORT): 0.2*(1+0.05/100)     → -100.19999999999997 (exato: -100.2)
 *   - perna parcial TP1:         0.5*(0.1-0.090045)/0.1*100 → 4.97750000000001 (exato: 4.9775)
 *   - total multi-perna:         4.9775 + (-50.05)    → -45.07249999999999 (exato: -45.0725)
 * A implementação decimal (escala 1e8) precisa fechar EXATAMENTE nesses valores.
 */

function basePosition(overrides: Partial<PositionState> = {}): PositionState {
  return {
    direction: 'LONG',
    entryPrice: 0.1,
    stopLoss: 0.04,
    target1: 0.16,
    target2: 0.22,
    isBreakevenActive: false,
    partialTaken: false,
    ...overrides
  };
}

describe('6.5.1 — aritmética decimal exata (CA-5.1)', () => {
  it('dAdd(0.1, 0.2) === 0.3 (caso canônico do CA-5.1)', () => {
    expect(dAdd(0.1, 0.2)).toBe(0.3);
  });

  it('soma de pernas arbitrária fecha exata em decimal', () => {
    // 0.1 + 0.2 + 0.3 em float dá 0.6000000000000001; em decimal fecha 0.6.
    expect(dAdd(dAdd(0.1, 0.2), 0.3)).toBe(0.6);
  });

  it('LONG: PnL do stop com slippage fecha exato (-60.04, não -60.040000000000006)', () => {
    const res = resolvePosition({
      position: basePosition(),
      high: 0.0399,
      low: 0.0399,
      slippagePct: 0.1
    });
    expect(res.hasClosedFull).toBe(true);
    // fill = 0.04*(1-0.1/100) = 0.03996; pnl = (0.03996-0.1)/0.1*100 = -60.04
    expect(res.exitLegs[0].price).toBe(0.03996);
    expect(res.grossPnlPct).toBe(-60.04);
  });

  it('SHORT: PnL do stop com slippage fecha exato (-100.2, não -100.19999999999997)', () => {
    const res = resolvePosition({
      position: basePosition({ direction: 'SHORT', entryPrice: 0.1, stopLoss: 0.2, target1: 0.09, target2: 0.06 }),
      high: 0.2002,
      low: 0.2002,
      slippagePct: 0.1
    });
    expect(res.hasClosedFull).toBe(true);
    expect(res.exitLegs[0].price).toBe(0.2002);
    expect(res.grossPnlPct).toBe(-100.2);
  });

  it('multi-perna (TP1 parcial + runner no stop): cada perna e o total fecham exatos', () => {
    // Barra 1: TP1 do SHORT atingido → perna parcial (50%)
    const first = resolvePosition({
      position: basePosition({ direction: 'SHORT', entryPrice: 0.1, stopLoss: 0.2, target1: 0.09, target2: 0.06 }),
      high: 0.0899,
      low: 0.0899,
      slippagePct: 0.05
    });
    expect(first.hasPartialClose).toBe(true);
    // fill = 0.09*(1+0.05/100) = 0.090045; perna = 0.5*(0.1-0.090045)/0.1*100 = 4.9775
    expect(first.exitLegs[0].price).toBe(0.090045);
    expect(first.grossPnlPct).toBe(4.9775);

    // Barra 2: stop no breakeven (após TP1 o stop vira o preço de entrada) estourado → runner fecha
    // fill = 0.1*(1+0.05/100) = 0.10005; perna = 0.5*(0.1-0.10005)/0.1*100 = -0.025
    const second = resolvePosition({
      position: first.nextPositionState,
      high: 0.2001,
      low: 0.2001,
      slippagePct: 0.05
    });
    expect(second.hasClosedFull).toBe(true);
    expect(second.grossPnlPct).toBe(-0.025);
    expect(second.isWin).toBe(false);

    // Total exato das pernas (4.9775 + (-0.025) = 4.9525); em float a soma carrega ruído
    expect(dAdd(first.grossPnlPct, second.grossPnlPct)).toBe(4.9525);
  });

  it('R consistente: PnL decimal dividido pelo risco unitário fecha exato', () => {
    const res = resolvePosition({
      position: basePosition(),
      high: 0.0399,
      low: 0.0399,
      slippagePct: 0.1
    });
    // risco unitário = |entry-stop| = 0.06 → R = -60.04% / (0.06/0.1*100 %) = -1.00666...
    const riskPct = dMul(dDiv(dSub(0.1, 0.04), 0.1), 100); // 60 exato
    expect(riskPct).toBe(60);
    // dDiv trunca na escala 1e8: -60.04/60 = -1.00066666 (exato infinito: -1.000666…)
    expect(dDiv(res.grossPnlPct, riskPct)).toBeCloseTo(-60.04 / 60, 6);
  });
});
