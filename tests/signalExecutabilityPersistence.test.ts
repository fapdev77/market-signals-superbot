import { describe, it, expect } from 'vitest';
import { saveSignal, getRecentSignals } from '../server/db.js';
import type { TradeSignal } from '../src/types.js';

/**
 * 6.5.2/6.5.3 — persistência da executabilidade em trade_signals.
 *
 * Garante:
 *  (1) round-trip dos campos novos (suggested_quantity, executable, non_executable_reason,
 *      estimated_slippage_pct, execution_book_available) — se o INSERT estiver desalinhado
 *      (colunas × placeholders), o sql.js lança e este teste falha;
 *  (2) linha LEGADO (colunas nulas) mapeia para `undefined` (executabilidade DESCONHECIDA),
 *      nunca para um veredito falso.
 */

function baseSignal(id: string, createdAt: number): TradeSignal {
  return {
    id,
    symbol: 'EXECUSDT',
    marketType: 'crypto_futures',
    signalType: 'LONG',
    direction: 'LONG',
    strategyCategory: 'INTRADAY',
    entryZone: [100, 100.5],
    currentPrice: 100,
    stopLoss: 98,
    target1: 104,
    target2: 108,
    riskRewardRatio: 4,
    confluenceScore: 80,
    confluenceFactors: ['exec-test'],
    timeframe: '15m',
    validationStatus: 'CONFIRMED',
    validationStage: 'VALIDADO',
    candle1mConfirmed: true,
    candle5mConfirmed: true,
    createdAt,
    status: 'ACTIVE'
  };
}

describe('6.5.2/6.5.3 — executabilidade persistida', () => {
  it('salva e relê sinal com veredito de executabilidade completo', async () => {
    const createdAt = Date.now();
    const signal = {
      ...baseSignal('EXEC-FULL-1', createdAt),
      suggestedQuantity: 0.001,
      executable: false,
      nonExecutableReason: 'Notional 40 abaixo do mínimo do exchange (50).',
      estimatedSlippagePct: 0.21,
      executionBookAvailable: true
    };
    await saveSignal(signal);

    const all = await getRecentSignals(500, 'ALL');
    const reloaded = all.find(s => s.id === 'EXEC-FULL-1');
    expect(reloaded).toBeDefined();
    expect(reloaded!.suggestedQuantity).toBe(0.001);
    expect(reloaded!.executable).toBe(false);
    expect(reloaded!.nonExecutableReason).toBe('Notional 40 abaixo do mínimo do exchange (50).');
    expect(reloaded!.estimatedSlippagePct).toBe(0.21);
    expect(reloaded!.executionBookAvailable).toBe(true);
  });

  it('sinal executável (true) sobrevive ao round-trip', async () => {
    const createdAt = Date.now();
    const signal = {
      ...baseSignal('EXEC-OK-1', createdAt),
      suggestedQuantity: 0.002,
      executable: true
    };
    await saveSignal(signal);

    const all = await getRecentSignals(500, 'ALL');
    const reloaded = all.find(s => s.id === 'EXEC-OK-1');
    expect(reloaded).toBeDefined();
    expect(reloaded!.executable).toBe(true);
    expect(reloaded!.nonExecutableReason).toBeUndefined();
  });

  it('linha legado sem os campos novos relê como executabilidade DESCONHECIDA (undefined)', async () => {
    const createdAt = Date.now();
    await saveSignal(baseSignal('EXEC-LEGACY-1', createdAt));

    const all = await getRecentSignals(500, 'ALL');
    const reloaded = all.find(s => s.id === 'EXEC-LEGACY-1');
    expect(reloaded).toBeDefined();
    expect(reloaded!.executable).toBeUndefined();
    expect(reloaded!.suggestedQuantity).toBeUndefined();
    expect(reloaded!.nonExecutableReason).toBeUndefined();
    expect(reloaded!.estimatedSlippagePct).toBeUndefined();
    expect(reloaded!.executionBookAvailable).toBeUndefined();
  });
});
