import { describe, it, expect } from 'vitest';
import {
  calculateTimeframeVolumeMetrics,
  detectVolumeSpikeAlert
} from '../src/utils/volumeScreenerUtils.js';
import type { TickerData } from '../src/types.js';

describe('Épico 4: Detecção de Anomalias no Smart Volume Screener (TDD)', () => {
  function makeMockTicker(overrides: Partial<TickerData> = {}): TickerData {
    const price = overrides.price ?? 100;
    return {
      symbol: overrides.symbol ?? 'SOLUSDT',
      baseAsset: overrides.baseAsset ?? 'SOL',
      quoteAsset: 'USDT',
      name: 'Solana',
      marketType: 'crypto_futures',
      price,
      priceChangePercent24h: overrides.priceChangePercent24h ?? 2.5,
      high24h: overrides.high24h ?? price * 1.05,
      low24h: overrides.low24h ?? price * 0.95,
      volume24h: overrides.volume24h ?? 1000000,
      quoteVolume24h: overrides.quoteVolume24h ?? 100000000,
      openInterest: overrides.openInterest ?? 20000000,
      openInterestChange24h: overrides.openInterestChange24h ?? 5.0,
      openInterestChange1h: overrides.openInterestChange1h ?? 1.5,
      fundingRate: 0.0001,
      fundingRateDaily: 0.0003,
      fundingRateAnnualized: 10.95,
      cvd: overrides.cvd ?? 5000000,
      cvdDelta: overrides.cvdDelta ?? 200000,
      cvdDeltaPercent: overrides.cvdDeltaPercent ?? 5.0,
      cvdDirection: overrides.cvdDirection ?? 'BUY',
      takerBuyRatio: overrides.takerBuyRatio ?? 0.55,
      fibonacci: overrides.fibonacci ?? { swingHigh: price * 1.05, swingLow: price * 0.95, fib50: price, fib618: price * 0.98, fib68: price * 0.975, inGoldenPocket: false },
      rangeProfile: overrides.rangeProfile ?? { vah: price * 1.02, val: price * 0.98, poc: price, inValueArea: true },
      keyLevels: overrides.keyLevels ?? { support1: price * 0.97, support2: price * 0.95, resistance1: price * 1.03, resistance2: price * 1.05, structureBreak: 'BULLISH', hasSinglePrintFVG: false },
      confluenceScore: 78,
      signalType: 'LONG',
      signalReason: 'Volume Surge',
      confluenceFactors: [],
      updatedAt: Date.now()
    };
  }

  it('T4.1: Calcula R-Vol e métricas estatísticas em 1h, 4h e 1d', () => {
    const ticker = makeMockTicker({
      symbol: 'BTCUSDT',
      price: 60000,
      quoteVolume24h: 500000000,
      priceChangePercent24h: 3.5,
      openInterestChange1h: 2.0
    });

    const metrics = calculateTimeframeVolumeMetrics(ticker);

    expect(metrics['1h']).toBeDefined();
    expect(metrics['4h']).toBeDefined();
    expect(metrics['1d']).toBeDefined();

    expect(metrics['1h'].rvol).toBeGreaterThan(0);
    expect(metrics['1h'].volumeUsd).toBeGreaterThan(0);
    expect(metrics['1h'].baselineAvgUsd).toBeGreaterThan(0);
    expect(metrics['1h'].zScore).toBeDefined();
  });

  it('T4.2: Identifica anomalia BREAKOUT_SURGE quando há alta agressão compradora e quebra altista', () => {
    const ticker = makeMockTicker({
      symbol: 'ETHUSDT',
      priceChangePercent24h: 4.2,
      cvdDirection: 'BUY',
      takerBuyRatio: 0.60,
      keyLevels: {
        support1: 95,
        support2: 90,
        resistance1: 102,
        resistance2: 105,
        structureBreak: 'BULLISH',
        hasSinglePrintFVG: false
      }
    });

    const alert = detectVolumeSpikeAlert(ticker, 1.2);

    expect(alert).not.toBeNull();
    if (!alert) return;

    expect(alert.anomalyType).toBe('BREAKOUT_SURGE');
    expect(alert.cvdDirection).toBe('BUY');
    expect(alert.confluenceFactors.length).toBeGreaterThan(0);
  });

  it('T4.3: Identifica anomalia PANIC_DUMP quando há forte pressão vendedora e queda abrupta', () => {
    const ticker = makeMockTicker({
      symbol: 'DOGEUSDT',
      price: 0.15,
      priceChangePercent24h: -6.5,
      cvdDirection: 'SELL',
      takerBuyRatio: 0.38,
      keyLevels: {
        support1: 0.14,
        support2: 0.12,
        resistance1: 0.16,
        resistance2: 0.17,
        structureBreak: 'BEARISH',
        hasSinglePrintFVG: false
      }
    });

    const alert = detectVolumeSpikeAlert(ticker, 1.2);

    expect(alert).not.toBeNull();
    if (!alert) return;

    expect(alert.anomalyType).toBe('PANIC_DUMP');
    expect(alert.cvdDirection).toBe('SELL');
  });

  it('T4.4: Identifica anomalia WHALE_ACCUMULATION quando preço repousa no Golden Pocket com compras', () => {
    const ticker = makeMockTicker({
      symbol: 'SOLUSDT',
      priceChangePercent24h: 0.5,
      cvdDirection: 'BUY',
      takerBuyRatio: 0.54,
      openInterestChange1h: 3.5,
      keyLevels: {
        support1: 95,
        support2: 90,
        resistance1: 105,
        resistance2: 110,
        structureBreak: 'NONE',
        hasSinglePrintFVG: false
      },
      fibonacci: {
        swingHigh: 110,
        swingLow: 90,
        fib50: 100,
        fib618: 98,
        fib68: 97.5,
        inGoldenPocket: true
      }
    });

    const alert = detectVolumeSpikeAlert(ticker, 1.2);

    expect(alert).not.toBeNull();
    if (!alert) return;

    expect(alert.anomalyType).toBe('WHALE_ACCUMULATION');
    expect(alert.confluenceFactors.some(f => f.includes('Golden Pocket'))).toBe(true);
  });
});
