import { describe, it, expect } from 'vitest';
import {
  resolvePosition,
  type PositionState,
  type PositionResolutionResult
} from '../server/services/positionResolution.js';

describe('M2.4 & CA-2.3: Shared position resolution logic between live and backtest', () => {
  const initialPosition: PositionState = {
    direction: 'LONG',
    entryPrice: 100,
    stopLoss: 95,
    target1: 105,
    target2: 110,
    isBreakevenActive: false,
    partialTaken: false
  };

  it('handles stop-first when candle touches both stop and target', () => {
    // Candle range: Low 94 (breaches stop 95) and High 106 (touches target1 105)
    const result = resolvePosition({
      position: initialPosition,
      high: 106,
      low: 94,
      currentPrice: 94,
      slippagePct: 0
    });

    expect(result.hasClosedFull).toBe(true);
    expect(result.exitLegs).toHaveLength(1);
    expect(result.exitLegs[0].leg).toBe('FULL');
    expect(result.exitLegs[0].price).toBe(95);
    expect(result.exitLegs[0].size).toBe(1.0);
    expect(result.isWin).toBe(false);
  });

  it('executes 50% partial at Target 1 and activates breakeven stop', () => {
    // Candle touches target 1 (high 106, low 98)
    const result = resolvePosition({
      position: initialPosition,
      high: 106,
      low: 98,
      currentPrice: 104,
      slippagePct: 0
    });

    expect(result.hasClosedFull).toBe(false);
    expect(result.hasPartialClose).toBe(true);
    expect(result.exitLegs).toHaveLength(1);
    expect(result.exitLegs[0].leg).toBe('PARTIAL');
    expect(result.exitLegs[0].price).toBe(105);
    expect(result.exitLegs[0].size).toBe(0.5);
    expect(result.nextPositionState.isBreakevenActive).toBe(true);
    expect(result.nextPositionState.partialTaken).toBe(true);
    expect(result.nextPositionState.stopLoss).toBe(100); // Breakeven moved to entry
  });

  it('closes remaining 50% runner at Target 2', () => {
    const afterPartialPosition: PositionState = {
      ...initialPosition,
      stopLoss: 100,
      isBreakevenActive: true,
      partialTaken: true
    };

    const result = resolvePosition({
      position: afterPartialPosition,
      high: 112,
      low: 101,
      currentPrice: 111,
      slippagePct: 0
    });

    expect(result.hasClosedFull).toBe(true);
    expect(result.exitLegs).toHaveLength(1);
    expect(result.exitLegs[0].leg).toBe('RUNNER');
    expect(result.exitLegs[0].price).toBe(110);
    expect(result.exitLegs[0].size).toBe(0.5);
    expect(result.isWin).toBe(true);
  });

  it('closes remaining 50% runner at breakeven when stop is hit after Target 1', () => {
    const afterPartialPosition: PositionState = {
      ...initialPosition,
      stopLoss: 100,
      isBreakevenActive: true,
      partialTaken: true
    };

    const result = resolvePosition({
      position: afterPartialPosition,
      high: 104,
      low: 99,
      currentPrice: 99,
      slippagePct: 0
    });

    expect(result.hasClosedFull).toBe(true);
    expect(result.exitLegs).toHaveLength(1);
    expect(result.exitLegs[0].leg).toBe('RUNNER');
    expect(result.exitLegs[0].price).toBe(100); // Breakeven price
    expect(result.exitLegs[0].size).toBe(0.5);
  });
});
