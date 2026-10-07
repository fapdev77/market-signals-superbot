import { describe, it, expect } from 'vitest';
import { 
  scanRSIDivergence, 
  findMarketPivots, 
  detectRSIDivergencesFromKlines 
} from '../src/utils/rsiDivergenceUtils.js';
import type { KlineCandle, TickerData } from '../src/types.js';

describe('Épico I2: Detecção de Divergências com Pivôs Fractais Reais e RSI de Wilder', () => {
  function makeCandle(close: number, high?: number, low?: number, index = 0): KlineCandle {
    const h = high ?? close * 1.01;
    const l = low ?? close * 0.99;
    return {
      timestamp: 1600000000000 + index * 60000 * 15,
      open: close,
      high: h,
      low: l,
      close,
      volume: 1000,
      takerBuyVolume: 500
    };
  }

  it('T2.1: Identifica pivôs fractais reais (máximas e mínimas locais)', () => {
    // Série com fundo na barra 3 e topo na barra 7
    const highs = [100, 98, 95, 92, 94, 98, 102, 108, 104, 101];
    const lows =  [ 98, 94, 91, 88, 90, 94,  99, 104, 100,  97];
    const rsiSeries = [40, 35, 30, 25, 32, 45, 55, 68, 60, 52];

    const pivots = findMarketPivots(highs, lows, rsiSeries, 2, 2, 0);

    const lowPivot = pivots.find(p => p.type === 'LOW');
    const highPivot = pivots.find(p => p.type === 'HIGH');

    expect(lowPivot).toBeDefined();
    expect(lowPivot?.price).toBe(88); // low at index 3

    expect(highPivot).toBeDefined();
    expect(highPivot?.price).toBe(108); // high at index 7
  });

  it('T2.2: Detecta Divergência Regular Altista (Preço faz Fundo Menor, RSI faz Fundo Maior em Sobrevenda)', () => {
    // 30 candles: 15 de aquecimento do RSI, depois swing low 1 (80), repique (95) e swing low 2 (77)
    const warmup = [100, 102, 101, 99, 100, 98, 97, 95, 94, 92, 90, 88, 86, 85, 84]; // 15 velas
    const swing1 = [83, 81, 80, 82, 85]; // fundo em 80 (index 17)
    const rally  = [88, 92, 95, 93, 90]; // repique em 95 (index 22)
    const swing2 = [85, 82, 79, 78, 77]; // fundo menor em 77 (index 29)
    const closes = [...warmup, ...swing1, ...rally, ...swing2];

    const klines: KlineCandle[] = closes.map((c, i) => makeCandle(c, c * 1.005, c * 0.995, i));

    const analysis = detectRSIDivergencesFromKlines(klines);

    expect(analysis.divergenceType).toBe('REGULAR_BULLISH');
    expect(analysis.bias).toBe('BULLISH');
    expect(analysis.confidence).toBeGreaterThanOrEqual(65);
    // Com 30 velas o RSI é medido; `null` aqui seria regressão do fail-closed.
    if (analysis.rsiCurrent == null || analysis.rsiPrevSwing == null) {
      throw new Error('RSI de Wilder deveria estar medido com 30 velas');
    }
    expect(analysis.rsiCurrent).toBeGreaterThan(analysis.rsiPrevSwing);
    expect(analysis.priceCurrent).toBeLessThan(analysis.pricePrevSwing);
  });

  it('T2.3: Detecta Divergência Regular Baixista (Preço faz Topo Maior, RSI faz Topo Menor em Sobrecompra)', () => {
    // 30 candles: 15 de aquecimento do RSI, depois swing high 1 (120), correção (105) e swing high 2 (124)
    const warmup = [100, 98, 99, 101, 100, 102, 103, 105, 106, 108, 110, 112, 114, 115, 116];
    const swing1 = [117, 119, 120, 118, 115]; // topo em 120 (index 17)
    const dip    = [112, 108, 105, 107, 110]; // recuo em 105 (index 22)
    const swing2 = [115, 118, 121, 123, 124]; // topo maior em 124 (index 29)
    const closes = [...warmup, ...swing1, ...dip, ...swing2];

    const klines: KlineCandle[] = closes.map((c, i) => makeCandle(c, c * 1.005, c * 0.995, i));

    const analysis = detectRSIDivergencesFromKlines(klines);

    expect(analysis.divergenceType).toBe('REGULAR_BEARISH');
    expect(analysis.bias).toBe('BEARISH');
    expect(analysis.confidence).toBeGreaterThanOrEqual(65);
    // Com 30 velas o RSI é medido; `null` aqui seria regressão do fail-closed.
    if (analysis.rsiCurrent == null || analysis.rsiPrevSwing == null) {
      throw new Error('RSI de Wilder deveria estar medido com 30 velas');
    }
    expect(analysis.rsiCurrent).toBeLessThan(analysis.rsiPrevSwing);
    expect(analysis.priceCurrent).toBeGreaterThan(analysis.pricePrevSwing);
  });

  it('T2.4: Ausência de Divergência quando Preço e Momentum estão alinhados', () => {
    // Tendência de alta limpa e harmônica
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
    const klines: KlineCandle[] = closes.map((c, i) => makeCandle(c, c * 1.01, c * 0.99, i));

    const analysis = detectRSIDivergencesFromKlines(klines);

    expect(analysis.divergenceType).toBe('NO_DIVERGENCE');
    expect(analysis.bias).toBe('NEUTRAL');
  });

  it('T2.5: Fail-closed com klines insuficientes (< 15 barras)', () => {
    const closes = [100, 101, 102, 103, 104];
    const klines: KlineCandle[] = closes.map((c, i) => makeCandle(c, c * 1.01, c * 0.99, i));

    const analysis = detectRSIDivergencesFromKlines(klines);

    expect(analysis.divergenceType).toBe('NO_DIVERGENCE');
    expect(analysis.confidence).toBe(50);
  });

  it('T2.6: scanRSIDivergence aceita klines reais e substitui cálculo sintético', () => {
    const warmup = [100, 102, 101, 99, 100, 98, 97, 95, 94, 92, 90, 88, 86, 85, 84];
    const swing1 = [83, 81, 80, 82, 85];
    const rally  = [88, 92, 95, 93, 90];
    const swing2 = [85, 82, 79, 78, 77];
    const closes = [...warmup, ...swing1, ...rally, ...swing2];

    const klines: KlineCandle[] = closes.map((c, i) => makeCandle(c, c * 1.005, c * 0.995, i));

    const mockTicker = {
      symbol: 'BTCUSDT',
      price: 77,
      priceChangePercent24h: -5.0,
      cvdDirection: 'BUY' as const
    } as TickerData;

    const result = scanRSIDivergence(mockTicker, '15m', klines);

    expect(result.divergenceType).toBe('REGULAR_BULLISH');
    expect(result.bias).toBe('BULLISH');
  });
});
