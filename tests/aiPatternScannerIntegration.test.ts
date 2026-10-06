import { describe, it, expect } from 'vitest';
import { 
  scanTickerForPatterns, 
  getTopDetectedPattern, 
  scanAllTickersForPatterns 
} from '../src/utils/aiPatternScanner.js';
import type { TickerData, KlineCandle } from '../src/types.js';

describe('Épico P5: Integração do AI Pattern Scanner com Motores Geométricos (TDD)', () => {
  function makeCandle(close: number, high?: number, low?: number, index = 0, volume = 1000): KlineCandle {
    const h = high ?? close * 1.004;
    const l = low ?? close * 0.996;
    return {
      timestamp: 1600000000000 + index * 60000 * 15,
      open: close,
      high: h,
      low: l,
      close,
      volume,
      takerBuyVolume: volume * 0.55
    };
  }

  function makeMockTicker(symbol: string, price: number): TickerData {
    return {
      symbol,
      baseAsset: symbol.replace('USDT', ''),
      quoteAsset: 'USDT',
      name: symbol,
      marketType: 'crypto_futures',
      price,
      priceChangePercent24h: 1.5,
      high24h: price * 1.05,
      low24h: price * 0.95,
      volume24h: 10000000,
      quoteVolume24h: 10000000 * price,
      openInterest: 5000000,
      openInterestChange24h: 2.5,
      openInterestChange1h: 0.8,
      fundingRate: 0.0001,
      fundingRateDaily: 0.0003,
      fundingRateAnnualized: 10.95,
      cvd: 1500000,
      cvdDelta: 50000,
      cvdDeltaPercent: 1.2,
      cvdDirection: 'BUY',
      takerBuyRatio: 0.54,
      fibonacci: {
        swingHigh: price * 1.05,
        swingLow: price * 0.95,
        fib50: price,
        fib618: price * 0.98,
        fib68: price * 0.975,
        inGoldenPocket: false
      },
      rangeProfile: {
        vah: price * 1.02,
        val: price * 0.98,
        poc: price * 1.005,
        inValueArea: true
      },
      keyLevels: {
        support1: price * 0.97,
        support2: price * 0.95,
        resistance1: price * 1.03,
        resistance2: price * 1.05,
        structureBreak: 'BULLISH',
        hasSinglePrintFVG: false
      },
      confluenceScore: 75,
      signalType: 'LONG',
      signalReason: 'Bullish Momentum',
      confluenceFactors: ['CVD Positivo', 'Estrutura de Alta'],
      updatedAt: Date.now()
    };
  }

  it('T5.1: Detecta Double Bottom geométrico real quando klines são fornecidos', () => {
    // 30 velas formando padrão W com fundo 1 em ~100, neckline em ~110, fundo 2 em ~100.5
    const closes = [
      115, 112, 108, 105, 102, 101, 100, 102, 104, 106, 108, 109, 110, 109, 108, 110,
      107, 105, 103, 102, 101.5, 101, 101.2, 102, 104, 105, 106, 107, 108, 108.5
    ];
    const klines = closes.map((c, i) => makeCandle(c, c * 1.005, c * 0.995, i));
    const ticker = makeMockTicker('BTCUSDT', 108.5);

    const patterns = scanTickerForPatterns(ticker, klines);
    const doubleBottom = patterns.find(p => p.type === 'DOUBLE_BOTTOM');

    expect(doubleBottom).toBeDefined();
    if (!doubleBottom) return;

    expect(doubleBottom.bias).toBe('BULLISH');
    expect(doubleBottom.category).toBe('REVERSAL');
    expect(doubleBottom.breakoutTriggerPrice).toBeGreaterThan(108);
    expect(doubleBottom.measuredMoveTarget).toBeGreaterThan(115);
    expect(doubleBottom.suggestedStopLoss).toBeLessThan(102);
    expect(doubleBottom.riskRewardRatio).toBeGreaterThan(1.0);
    expect(doubleBottom.confidence).toBeGreaterThanOrEqual(70);
    expect(doubleBottom.technicalRationale.some(r => r.includes('W') || r.includes('Neckline'))).toBe(true);
  });

  it('T5.2: Detecta Bull Flag geométrico real com mastro e canal de consolidação', () => {
    const closes = [
      100, 100.5, 100.2, 100.4,
      104, 108, 112, 116, 119, 120, // Mastro
      119, 118.5, 118, 117.5, 117, 116.5, 116, 115.5, 115, 114.5, 115, 115.5, 116, 117, 118 // Bandeira
    ];
    const klines = closes.map((c, i) => makeCandle(c, c * 1.004, c * 0.996, i, i >= 4 && i <= 9 ? 5000 : 800));
    const ticker = makeMockTicker('ETHUSDT', 118);

    const patterns = scanTickerForPatterns(ticker, klines);
    const bullFlag = patterns.find(p => p.type === 'BULL_FLAG');

    expect(bullFlag).toBeDefined();
    if (!bullFlag) return;

    expect(bullFlag.bias).toBe('BULLISH');
    expect(bullFlag.category).toBe('CONTINUATION');
    expect(bullFlag.poleOrBaseHeightPct).toBeGreaterThan(15);
    expect(bullFlag.measuredMoveTarget).toBeGreaterThan(130);
    expect(bullFlag.suggestedStopLoss).toBeLessThan(116);
  });

  it('T5.3: Detecta Triângulo Ascendente geométrico a partir de klines', () => {
    const candles: KlineCandle[] = [
      makeCandle(95, 100, 95, 0),
      makeCandle(105, 110, 103, 1),
      makeCandle(102, 106, 100, 2),
      makeCandle(108, 110.1, 104, 3),
      makeCandle(106, 108, 104.5, 4),
      makeCandle(109, 110.2, 107, 5),
      makeCandle(108, 109, 107.5, 6),
      makeCandle(109.8, 110.1, 108, 7)
    ];
    const ticker = makeMockTicker('SOLUSDT', 109.8);

    const patterns = scanTickerForPatterns(ticker, candles);
    const triangle = patterns.find(p => p.type === 'ASCENDING_TRIANGLE');

    expect(triangle).toBeDefined();
    if (!triangle) return;

    expect(triangle.bias).toBe('BULLISH');
    expect(triangle.category).toBe('BREAKOUT');
    expect(triangle.breakoutTriggerPrice).toBeCloseTo(110.1, 0);
  });

  it('T5.4: Fallback gracioso quando klines não são passados', () => {
    const ticker = makeMockTicker('BNBUSDT', 300);
    // Sem passar klines
    const patterns = scanTickerForPatterns(ticker);
    expect(Array.isArray(patterns)).toBe(true);
  });

  it('T5.5: getTopDetectedPattern retorna o padrão de maior confiança', () => {
    const closes = [
      115, 112, 108, 105, 102, 101, 100, 102, 104, 106, 108, 109, 110, 109, 108, 110,
      107, 105, 103, 102, 101.5, 101, 101.2, 102, 104, 105, 106, 107, 108, 108.5
    ];
    const klines = closes.map((c, i) => makeCandle(c, c * 1.005, c * 0.995, i));
    const ticker = makeMockTicker('BTCUSDT', 108.5);

    const topPattern = getTopDetectedPattern(ticker, klines);
    expect(topPattern).not.toBeNull();
    if (!topPattern) return;

    expect(topPattern.confidence).toBeGreaterThanOrEqual(70);
  });

  it('T5.6: scanAllTickersForPatterns aceita mapa opcional de klines', () => {
    const tickerA = makeMockTicker('BTCUSDT', 100);
    const tickerB = makeMockTicker('ETHUSDT', 200);

    const klinesA = [
      100, 101, 102, 104, 108, 112, 116, 119, 120,
      119, 118, 117, 116, 115, 114.5, 115, 116, 117, 118
    ].map((c, i) => makeCandle(c, c * 1.004, c * 0.996, i));

    const map = new Map<string, KlineCandle[]>();
    map.set('BTCUSDT', klinesA);

    const results = scanAllTickersForPatterns([tickerA, tickerB], map);
    expect(results).toBeInstanceOf(Map);
  });
});
