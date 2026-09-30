/**
 * Shared Position Resolution Engine (M2.4 - Phase 5; 6.5.1 decimal)
 *
 * Implements the single authoritative position resolution rules for both
 * live monitoring (`TickProcessor`) and historical simulation (`BacktestEngine`):
 *  1. Stop-first: if high/low breach both stop and targets on the same bar/candle,
 *     the stop-loss executes first.
 *  2. TP1: 50% partial execution at Target 1, moving stop-loss to breakeven (entry price).
 *  3. TP2: Runner closes the remaining 50% (or full size if no partial).
 *  4. Pure function: fully deterministic, testable, and reusable.
 *
 * 6.5.1 (G-12): todo o caminho de PnL usa aritmética decimal exata (`server/utils/decimal.ts`).
 * Antes, pernas como 0.5*(0.1-0.090045)/0.1*100 davam 4.97750000000001 em IEEE-754; em
 * decimal fecham exatamente 4.9775 (CA-5.1). Sem `toFixed` aqui (CA-5.2).
 */

import { dAdd, dDiv, dMul, dRound, dSub } from '../utils/decimal.js';

export interface PositionState {
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  isBreakevenActive: boolean;
  partialTaken: boolean;
}

export interface ResolvePositionParams {
  position: PositionState;
  high: number;
  low: number;
  currentPrice?: number;
  slippagePct?: number;
}

export interface PositionExitLeg {
  leg: 'FULL' | 'PARTIAL' | 'RUNNER';
  price: number;
  size: number; // fraction of position (0..1)
}

export interface PositionResolutionResult {
  hasClosedFull: boolean;
  hasPartialClose: boolean;
  exitLegs: PositionExitLeg[];
  isWin: boolean;
  grossPnlPct: number;
  nextPositionState: PositionState;
}

/** Preço de execução com slippage adverso: LONG vende mais baixo, SHORT compra mais alto. */
function slipFill(price: number, slippagePct: number, isLong: boolean): number {
  const adj = dMul(price, dSub(1, dDiv(slippagePct, 100)));
  return isLong ? adj : dAdd(price, dMul(price, dDiv(slippagePct, 100)));
}

/** PnL % de uma perna: LONG (fill−entry)/entry; SHORT (entry−fill)/entry, escalado por size. */
function legPnlPct(fillPrice: number, entryPrice: number, size: number, isLong: boolean): number {
  const diff = isLong ? dSub(fillPrice, entryPrice) : dSub(entryPrice, fillPrice);
  return dMul(dDiv(dMul(diff, 100), entryPrice), size);
}

export function resolvePosition(params: ResolvePositionParams): PositionResolutionResult {
  const { position, high, low, slippagePct = 0 } = params;
  const isLong = position.direction === 'LONG';
  const currentStop = position.stopLoss;
  const partialTaken = position.partialTaken;
  const isBreakevenActive = position.isBreakevenActive;

  // 1. Check Stop Condition
  const stopBreached = isLong ? low <= currentStop : high >= currentStop;

  // 2. Check Target Conditions
  const target1Breached = !partialTaken && (isLong ? high >= position.target1 : low <= position.target1);
  const target2Breached = isLong ? high >= position.target2 : low <= position.target2;

  // ---- STOP-FIRST RULE ----
  // If stop is breached, it takes absolute precedence over any target touch
  if (stopBreached) {
    const fillPrice = slipFill(currentStop, slippagePct, isLong);

    const legSize = partialTaken ? 0.5 : 1.0;
    const legType: 'FULL' | 'RUNNER' = partialTaken ? 'RUNNER' : 'FULL';

    const pnlPct = legPnlPct(fillPrice, position.entryPrice, legSize, isLong);

    return {
      hasClosedFull: true,
      hasPartialClose: false,
      exitLegs: [{ leg: legType, price: fillPrice, size: legSize }],
      isWin: partialTaken && pnlPct >= 0, // Win if partial was taken with profit and breakeven
      grossPnlPct: pnlPct,
      nextPositionState: {
        ...position,
        stopLoss: currentStop,
        isBreakevenActive,
        partialTaken
      }
    };
  }

  const exitLegs: PositionExitLeg[] = [];
  let grossPnlPct = 0;
  let nextPartialTaken = partialTaken;
  let nextBreakeven = isBreakevenActive;
  let nextStop = currentStop;
  let hasPartialClose = false;
  let hasClosedFull = false;

  // ---- TP1: 50% partial + breakeven stop ----
  if (target1Breached) {
    const t1Fill = slipFill(position.target1, slippagePct, isLong);

    exitLegs.push({ leg: 'PARTIAL', price: t1Fill, size: 0.5 });
    grossPnlPct = dAdd(grossPnlPct, legPnlPct(t1Fill, position.entryPrice, 0.5, isLong));

    nextPartialTaken = true;
    nextBreakeven = true;
    nextStop = position.entryPrice;
    hasPartialClose = true;
  }

  // ---- TP2: runner full closure ----
  if (target2Breached) {
    const t2Fill = slipFill(position.target2, slippagePct, isLong);

    const runnerSize = nextPartialTaken ? 0.5 : 1.0;
    exitLegs.push({ leg: 'RUNNER', price: t2Fill, size: runnerSize });
    grossPnlPct = dAdd(grossPnlPct, legPnlPct(t2Fill, position.entryPrice, runnerSize, isLong));
    hasClosedFull = true;
  }

  const isWin = grossPnlPct > 0;

  return {
    hasClosedFull,
    hasPartialClose,
    exitLegs,
    isWin,
    grossPnlPct: dRound(grossPnlPct, 8),
    nextPositionState: {
      ...position,
      stopLoss: nextStop,
      isBreakevenActive: nextBreakeven,
      partialTaken: nextPartialTaken
    }
  };
}
