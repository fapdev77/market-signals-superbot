import { describe, it, expect } from 'vitest';
import { buildTradeSignal } from '../server/signalEngine.js';
import type { TickerData, KlineCandle } from '../src/types.js';

describe('Épico 2: Stops e Alvos Dinâmicos Baseados em ATR e Volatilidade (TDD)', () => {
  function makeMockTicker(symbol: string, price: number): TickerData {
    return {
      symbol,
      baseAsset: symbol.replace('USDT', ''),
      quoteAsset: 'USDT',
      name: symbol,
      marketType: 'crypto_futures',
      price,
      priceChangePercent24h: 2.0,
      high24h: price * 1.05,
      low24h: price * 0.95,
      volume24h: 50000000,
      quoteVolume24h: 50000000 * price,
      openInterest: 25000000,
      openInterestChange24h: 3.5,
      openInterestChange1h: 1.2,
      fundingRate: 0.0001,
      fundingRateDaily: 0.0003,
      fundingRateAnnualized: 10.95,
      cvd: 3500000,
      cvdDelta: 120000,
      cvdDeltaPercent: 2.5,
      cvdDirection: 'BUY',
      takerBuyRatio: 0.55,
      fibonacci: {
        swingHigh: price * 1.06,
        swingLow: price * 0.94,
        fib50: price,
        fib618: price * 0.975,
        fib68: price * 0.97,
        inGoldenPocket: false
      },
      rangeProfile: {
        vah: price * 1.03,
        val: price * 0.97,
        poc: price * 1.005,
        inValueArea: true
      },
      keyLevels: {
        support1: price * 0.985,
        support2: price * 0.96,
        resistance1: price * 1.025,
        resistance2: price * 1.06,
        structureBreak: 'BULLISH',
        hasSinglePrintFVG: false
      },
      confluenceScore: 82,
      signalType: 'STRONG_LONG',
      signalReason: 'High Confluence Momentum',
      confluenceFactors: ['CVD Positivo', 'Volume Surge', 'BOS Bullish'],
      updatedAt: Date.now()
    };
  }

  function makeKlinesWithAtr(basePrice: number, candleRange: number, count: number = 20): KlineCandle[] {
    return Array.from({ length: count }, (_, i) => {
      const p = basePrice + (i - 10) * (candleRange * 0.1);
      return {
        timestamp: 1600000000000 + i * 60000 * 15,
        open: p,
        high: p + candleRange * 0.5,
        low: p - candleRange * 0.5,
        close: p + candleRange * 0.2,
        volume: 5000,
        takerBuyVolume: 2700
      };
    });
  }

  it('T2.1: Adapta a distância do stop proporcionalmente ao ATR do ativo', () => {
    const price = 1000;
    const ticker = makeMockTicker('BTCUSDT', price);

    // Cenário A: Baixa Volatilidade (Range da vela = $5, ATR ~ $5)
    const lowVolKlines = makeKlinesWithAtr(price, 5);
    const lowVolSignal = buildTradeSignal(ticker, lowVolKlines, 2.5, 'DAY_TRADE');

    // Cenário B: Alta Volatilidade (Range da vela = $30, ATR ~ $30)
    const highVolKlines = makeKlinesWithAtr(price, 30);
    const highVolSignal = buildTradeSignal(ticker, highVolKlines, 2.5, 'DAY_TRADE');

    expect(lowVolSignal).not.toBeNull();
    expect(highVolSignal).not.toBeNull();
    if (!lowVolSignal || !highVolSignal) return;

    const lowVolStopDistance = Math.abs(price - lowVolSignal.stopLoss);
    const highVolStopDistance = Math.abs(price - highVolSignal.stopLoss);

    // O stop no cenário de alta volatilidade deve ser substancialmente maior
    expect(highVolStopDistance).toBeGreaterThan(lowVolStopDistance * 1.8);
  });

  it('T2.2: Aplica multiplicadores de ATR distintos por perfil (SCALP < SWING)', () => {
    const price = 500;
    const ticker = makeMockTicker('BNBUSDT', price);
    const klines = makeKlinesWithAtr(price, 10);

    const scalpSignal = buildTradeSignal(ticker, klines, 1.2, 'SCALP');
    const swingSignal = buildTradeSignal(ticker, klines, 1.2, 'SWING');

    expect(scalpSignal).not.toBeNull();
    expect(swingSignal).not.toBeNull();
    if (!scalpSignal || !swingSignal) return;

    const scalpStopDist = Math.abs(price - scalpSignal.stopLoss);
    const swingStopDist = Math.abs(price - swingSignal.stopLoss);

    expect(scalpStopDist).toBeLessThan(swingStopDist);
  });

  it('T2.3: Garante relação R:R mínima institucional (Target 1 >= 1.5R e Target 2 >= 2.5R)', () => {
    const price = 100;
    const ticker = makeMockTicker('SOLUSDT', price);
    // Suporte e resistência artificialmente muito colados na entrada
    ticker.keyLevels.resistance1 = 100.2; // Apenas +0.2%
    ticker.keyLevels.resistance2 = 100.4; // Apenas +0.4%

    const klines = makeKlinesWithAtr(price, 2);
    const signal = buildTradeSignal(ticker, klines, 2.5, 'INTRADAY');

    expect(signal).not.toBeNull();
    if (!signal) return;

    const risk = Math.abs(price - signal.stopLoss);
    const reward1 = Math.abs(signal.target1 - price);
    const reward2 = Math.abs(signal.target2 - price);

    expect(reward1 / risk).toBeGreaterThanOrEqual(1.49);
    expect(reward2 / risk).toBeGreaterThanOrEqual(2.49);
    expect(signal.riskRewardRatio).toBeGreaterThanOrEqual(1.49);
  });
});
