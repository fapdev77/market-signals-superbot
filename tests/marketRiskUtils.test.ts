import { describe, it, expect } from 'vitest';
import {
  calculateTickerVolatility,
  summarizeMarketVolatility
} from '../src/utils/volatilityUtils.js';
import {
  classifyAssetSector,
  computeSectorPerformanceSummary
} from '../src/utils/sectorPerformanceUtils.js';
import type { TickerData } from '../src/types.js';

describe('Épico 5: Métricas de Risco de Portfólio, Volatilidade e Setores (TDD)', () => {
  function makeMockTicker(symbol: string, price: number, high: number, low: number, changePct: number): TickerData {
    return {
      symbol,
      baseAsset: symbol.replace('USDT', ''),
      quoteAsset: 'USDT',
      name: symbol,
      marketType: 'crypto_futures',
      price,
      priceChangePercent24h: changePct,
      high24h: high,
      low24h: low,
      volume24h: 1000000,
      quoteVolume24h: 1000000 * price,
      openInterest: 5000000,
      openInterestChange24h: 2.0,
      openInterestChange1h: 0.5,
      fundingRate: 0.0001,
      fundingRateDaily: 0.0003,
      fundingRateAnnualized: 10.95,
      cvd: 1000000,
      cvdDelta: 50000,
      cvdDeltaPercent: 1.0,
      cvdDirection: 'BUY',
      takerBuyRatio: 0.52,
      fibonacci: { swingHigh: high, swingLow: low, fib50: price, fib618: price * 0.98, fib68: price * 0.975, inGoldenPocket: false },
      rangeProfile: { vah: price * 1.02, val: price * 0.98, poc: price, inValueArea: true },
      keyLevels: { support1: price * 0.97, support2: price * 0.95, resistance1: price * 1.03, resistance2: price * 1.05, structureBreak: 'NONE', hasSinglePrintFVG: false },
      confluenceScore: 70,
      signalType: 'LONG',
      signalReason: 'Test',
      confluenceFactors: [],
      updatedAt: Date.now()
    };
  }

  it('T5.1: Calcula ATR percentual e envelopes de movimento esperado 1D e 2D', () => {
    const btc = makeMockTicker('BTCUSDT', 50000, 52000, 48000, 2.5);
    const vol = calculateTickerVolatility(btc);

    expect(vol.estimatedAtr).toBeGreaterThan(0);
    expect(vol.atrPercent).toBeGreaterThan(0);
    expect(vol.expectedMove1D.upper).toBeGreaterThan(btc.price);
    expect(vol.expectedMove1D.lower).toBeLessThan(btc.price);
    expect(vol.expectedMove2D.upper).toBeGreaterThan(vol.expectedMove1D.upper);
    expect(vol.expectedMove2D.lower).toBeLessThan(vol.expectedMove1D.lower);
  });

  it('T5.2: Classifica regimes de volatilidade (SUPERNOVA vs COMPRESSION)', () => {
    // Ativo calmo (range 1%)
    const calm = makeMockTicker('USDCUSDT', 1.0, 1.005, 0.995, 0.1);
    const calmVol = calculateTickerVolatility(calm);
    expect(calmVol.volatilityRegime).toBe('COMPRESSION');

    // Ativo explosivo (range 15%)
    const meme = makeMockTicker('PEPEUSDT', 0.00001, 0.000012, 0.000009, 14.0);
    const memeVol = calculateTickerVolatility(meme);
    expect(memeVol.volatilityRegime).toBe('SUPERNOVA');
  });

  it('T5.3: Categoriza corretamente os ativos em seus respectivos setores de mercado', () => {
    expect(classifyAssetSector('BTCUSDT').sectorKey).toBe('L1_L2');
    expect(classifyAssetSector('ETHUSDT').sectorKey).toBe('L1_L2');
    expect(classifyAssetSector('UNIUSDT').sectorKey).toBe('DEFI');
    expect(classifyAssetSector('AAVEUSDT').sectorKey).toBe('DEFI');
    expect(classifyAssetSector('FETUSDT').sectorKey).toBe('AI');
    expect(classifyAssetSector('DOGEUSDT').sectorKey).toBe('MEME');
    expect(classifyAssetSector('PEPEUSDT').sectorKey).toBe('MEME');
    expect(classifyAssetSector('AXSUSDT').sectorKey).toBe('GAMING');
  });

  it('T5.4: Agrega performance setorial e identifica setor líder e volume de turnover', () => {
    const tickers = [
      makeMockTicker('BTCUSDT', 50000, 51000, 49000, 2.0),
      makeMockTicker('ETHUSDT', 3000, 3100, 2900, 3.5),
      makeMockTicker('UNIUSDT', 10, 11, 9, 8.0),
      makeMockTicker('DOGEUSDT', 0.15, 0.16, 0.14, 1.0)
    ];

    const performance = computeSectorPerformanceSummary(tickers);

    expect(performance.sectors.length).toBeGreaterThan(0);
    expect(performance.totalMarketTurnoverUsd).toBeGreaterThan(0);
    expect(performance.leadingSector).toBeDefined();
  });
});
