import { describe, it, expect } from 'vitest';
import { computeGoldenPocketStats } from '../src/utils/goldenPocketStats';
import type { TradeSignal } from '../src/types';

/**
 * C-02 (FASE 0) — comportamento de `computeGoldenPocketStats`.
 *
 * O contrato: o win-rate só existe sobre desfechos RESOLVIDOS (lucro ou stop).
 * Sem amostra resolvida o resultado é `null` — nunca um percentual de fallback
 * (o antigo 74%) e nunca uma curva de resultados com pnlPct literais.
 */

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

function sig(over: Partial<TradeSignal> = {}): TradeSignal {
  return {
    id: 'sig-gp',
    symbol: 'BTCUSDT',
    marketType: 'crypto_futures',
    signalType: 'STRONG_LONG',
    direction: 'LONG',
    strategyCategory: 'INTRADAY',
    entryZone: [100, 100],
    currentPrice: 100,
    stopLoss: 97,
    target1: 106,
    target2: 110,
    riskRewardRatio: 2.5,
    confluenceScore: 80,
    confluenceFactors: [],
    timeframe: '15m',
    validationStatus: 'CONFIRMED',
    validationStage: 'VALIDADO',
    candle1mConfirmed: true,
    candle5mConfirmed: true,
    createdAt: NOW,
    status: 'ACTIVE',
    ...over
  };
}

describe('C-02 — estatísticas Golden Pocket sem fabricação', () => {
  it('sem sinais: winRate null, zero contagens e série vazia', () => {
    const stats = computeGoldenPocketStats('BTCUSDT', []);
    expect(stats.winRate).toBeNull();
    expect(stats.totalAlerts).toBe(0);
    expect(stats.profitableCount).toBe(0);
    expect(stats.stoppedCount).toBe(0);
    expect(stats.activeCount).toBe(0);
    expect(stats.recentOutcomes).toEqual([]);
    expect(stats.symbol).toBe('BTCUSDT');
  });

  it('sinais ainda ativos não pontuam: winRate continua null', () => {
    // pnl dentro da faixa neutra (±1%) ⇒ nenhum desfecho resolvido
    const signals = [
      sig({ currentPrice: 100.4, createdAt: NOW }),
      sig({ currentPrice: 99.7, createdAt: NOW + 1000 })
    ];
    const stats = computeGoldenPocketStats('BTCUSDT', signals);
    expect(stats.winRate).toBeNull();
    expect(stats.activeCount).toBe(2);
    expect(stats.totalAlerts).toBe(0);
  });

  it('1 lucro + 1 stop ⇒ winRate 50 sobre a base real', () => {
    const signals = [
      sig({ status: 'TARGET_REACHED', currentPrice: 106 }),
      sig({ status: 'STOPPED_OUT', currentPrice: 96 })
    ];
    const stats = computeGoldenPocketStats('BTCUSDT', signals);
    expect(stats.totalAlerts).toBe(2);
    expect(stats.profitableCount).toBe(1);
    expect(stats.stoppedCount).toBe(1);
    expect(stats.winRate).toBe(50);
  });

  it('lucro por faixa de preço conta, mesmo sem status resolvido', () => {
    // LONG com +3% (>= 1.2) ⇒ lucro; STOPPED_OUT ⇒ stop
    const signals = [
      sig({ status: 'ACTIVE', currentPrice: 103 }),
      sig({ status: 'STOPPED_OUT', currentPrice: 96 })
    ];
    const stats = computeGoldenPocketStats('BTCUSDT', signals);
    expect(stats.profitableCount).toBe(1);
    expect(stats.stoppedCount).toBe(1);
    expect(stats.winRate).toBe(50);
  });

  it('SHORT lucra quando o preço cai (sinal do pnl invertido por direção)', () => {
    const short = sig({
      signalType: 'STRONG_SHORT',
      direction: 'SHORT',
      status: 'ACTIVE',
      currentPrice: 96 // -4% vs entrada 100 ⇒ pnl +4%
    });
    const stats = computeGoldenPocketStats('BTCUSDT', [short]);
    expect(stats.profitableCount).toBe(1);
    expect(stats.winRate).toBe(100);
  });

  it('amostra só de lucros devolve 100 — nunca um fallback como 74', () => {
    const signals = [
      sig({ status: 'TARGET_REACHED' }),
      sig({ status: 'TARGET_REACHED' }),
      sig({ status: 'ACTIVE', currentPrice: 102.5 })
    ];
    const stats = computeGoldenPocketStats('BTCUSDT', signals);
    expect(stats.winRate).toBe(100);
    expect(stats.activeCount).toBe(0);
  });

  it('a série de desfechos é limitada a 8, sem padding sintético', () => {
    const signals = Array.from({ length: 10 }, (_, i) =>
      sig({ status: 'TARGET_REACHED', createdAt: NOW + i * 60_000 })
    );
    const stats = computeGoldenPocketStats('BTCUSDT', signals);
    expect(stats.recentOutcomes.length).toBe(8);
    // são os 8 ÚLTIMOS desfechos (janela deslizante sobre o que aconteceu)
    expect(stats.recentOutcomes[0].timestamp).toBe(NOW + 2 * 60_000);
    expect(stats.recentOutcomes[7].timestamp).toBe(NOW + 9 * 60_000);
    // pnl dos desfechos é o real (TARGET_REACHED com preço de entrada ⇒ 0%)
    expect(stats.recentOutcomes.every(o => o.profitable)).toBe(true);
  });

  it('status resolvido vence a faixa de preço na classificação', () => {
    // TARGET_REACHED com preço abaixo da entrada: conta como lucro (status manda)
    const signals = [sig({ status: 'TARGET_REACHED', currentPrice: 95 })];
    const stats = computeGoldenPocketStats('BTCUSDT', signals);
    expect(stats.profitableCount).toBe(1);
    expect(stats.stoppedCount).toBe(0);
    expect(stats.winRate).toBe(100);
  });
});
