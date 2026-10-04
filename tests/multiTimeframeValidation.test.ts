/**
 * CRÍTICO-2 (auditoria) — a validação multi-timeframe precisa medir 1m e 5m REAIS.
 *
 * Antes desta correção, `buildTradeSignal` derivava as checagens rotuladas "1m" e "5m" do
 * array `klines` dos indicadores — que é 15m no live e 1m no backtest. Isso significava:
 *
 *   - no LIVE, "confirmação de 1m" media a última vela de 15m (e o limiar de pavio de 55%
 *     era aplicado sobre a amplitude de 15m);
 *   - "confirmação de 5m" era o `open` de 5 barras atrás do mesmo array — 75 minutos no
 *     live, e quase a mesma medição da checagem de 1m (dupla contagem);
 *   - live e backtest divergiam silenciosamente nesse filtro. O teste de paridade antigo
 *     (`liveBacktestParity.test.ts`) NÃO pegava isso porque alimentava as mesmas velas
 *     dos dois lados, o que mascara exatamente o defeito.
 *
 * Estes testes existem para travar a semântica: cada checagem tem de ler o timeframe que
 * o rótulo declara, e a ausência dos timeframes tem de falhar fechada.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildTradeSignal } from '../server/signalEngine.js';
import type { IndicatorWeights, KlineCandle, TickerData } from '../src/types.js';

const weights: IndicatorWeights = {
  volumeSurgeWeight: 20,
  openInterestWeight: 20,
  fundingRateWeight: 15,
  cvdImbalanceWeight: 20,
  fibonacciZoneWeight: 15,
  rangePocWeight: 15,
  supportResistanceWeight: 15,
  trappedTradersWeight: 25,
  rsiDivergenceWeight: 20,
  volumeProfileRange: 24,
  minRiskRewardRatio: 2.0
};

/** Vela neutra, sem pavio dominante, para não disparar spike por acidente. */
const flatCandle = (timestamp: number, price: number): KlineCandle => ({
  timestamp,
  open: price,
  high: price + 10,
  low: price - 10,
  close: price + 5,
  volume: 100,
  takerBuyVolume: 60
});

/** Vela de 1m que sobe (confirma LONG) sem pavio dominante. */
const up1m = (timestamp: number, price: number): KlineCandle => ({
  timestamp,
  open: price,
  high: price + 25,
  low: price - 5,
  close: price + 20,
  volume: 100,
  takerBuyVolume: 60
});

/** Vela de 5m que sobe (confirma tendência LONG). */
const up5m = (timestamp: number, price: number): KlineCandle => ({
  timestamp,
  open: price,
  high: price + 120,
  low: price - 10,
  close: price + 100,
  volume: 500,
  takerBuyVolume: 300
});

const ticker = (): TickerData => ({
  symbol: 'BTCUSDT',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  name: 'Bitcoin',
  marketType: 'crypto_futures',
  price: 90000,
  priceChangePercent24h: 3.5,
  high24h: 91000,
  low24h: 88000,
  volume24h: 10000,
  quoteVolume24h: 900000000,
  openInterest: 50000,
  openInterestChange24h: 5,
  openInterestChange1h: 2,
  fundingRate: 0.0001,
  fundingRateDaily: 0.0003,
  fundingRateAnnualized: 0.1,
  fundingRateAnalysis: { status: 'NEUTRAL', pressure: 'NEUTRO / EQUILIBRADO', bias: 'NEUTRAL', description: '' },
  cvd: 2000000,
  cvdDelta: 500000,
  cvdDeltaPercent: 15,
  cvdDirection: 'BUY',
  takerBuyRatio: 0.62,
  fibonacci: { fib50: 89500, fib618: 89000, fib68: 88800, swingHigh: 91000, swingLow: 88000, inGoldenPocket: true },
  rangeProfile: { vah: 90500, val: 89200, poc: 89800, inValueArea: true },
  keyLevels: {
    support1: 89200,
    support2: 88000,
    resistance1: 90500,
    resistance2: 91500,
    structureBreak: 'BULLISH',
    hasSinglePrintFVG: false
  },
  confluenceScore: 85,
  signalType: 'LONG',
  signalReason: 'Golden pocket + CVD Bullish',
  confluenceFactors: ['Golden Pocket', 'CVD Buy', 'Open Interest'],
  updatedAt: Date.now()
});

/** Klines de análise (o timeframe dos indicadores — irrelevante para a validação MTF). */
const analysisKlines = (): KlineCandle[] =>
  Array.from({ length: 20 }, (_, i) => flatCandle(1_000_000 + i * 900_000, 90000 + i * 20));

describe('CRÍTICO-2: a validação multi-timeframe usa velas reais de 1m e 5m', () => {
  let originalStopCap: string | undefined;

  beforeEach(() => {
    // Isola o stop cap: o objetivo aqui é a validação MTF, não o dimensionamento do stop.
    originalStopCap = process.env.MAX_STOP_PCT_INTRADAY;
    process.env.MAX_STOP_PCT_INTRADAY = '50';
  });

  afterEach(() => {
    if (originalStopCap === undefined) delete process.env.MAX_STOP_PCT_INTRADAY;
    else process.env.MAX_STOP_PCT_INTRADAY = originalStopCap;
  });

  it('NÃO confirma quando não há velas de 1m/5m — falha fechada', () => {
    const signal = buildTradeSignal(ticker(), analysisKlines(), 2.0, 'INTRADAY');

    expect(signal).not.toBeNull();
    expect(signal!.validationStatus).not.toBe('CONFIRMED');
    expect(signal!.candle1mConfirmed).toBe(false);
    expect(signal!.candle5mConfirmed).toBe(false);
    expect(signal!.validationStage).toContain('NÃO confirmado');
  });

  it('NÃO confirma quando só um dos dois timeframes foi fornecido', () => {
    const so1m = buildTradeSignal(ticker(), analysisKlines(), 2.0, 'INTRADAY', undefined, undefined, undefined, undefined, undefined, {
      klines1m: [up1m(1_000_000, 90000)],
      klines5m: []
    });
    expect(so1m).not.toBeNull();
    expect(so1m!.validationStatus).not.toBe('CONFIRMED');

    const so5m = buildTradeSignal(ticker(), analysisKlines(), 2.0, 'INTRADAY', undefined, undefined, undefined, undefined, undefined, {
      klines1m: [],
      klines5m: [up5m(1_000_000, 90000)]
    });
    expect(so5m).not.toBeNull();
    expect(so5m!.validationStatus).not.toBe('CONFIRMED');
  });

  it('CONFirma com 1m e 5m reais alinhados na direção do sinal', () => {
    const signal = buildTradeSignal(ticker(), analysisKlines(), 2.0, 'INTRADAY', undefined, undefined, undefined, undefined, undefined, {
      klines1m: [up1m(1_000_000, 90000)],
      klines5m: [up5m(1_000_000, 90000)]
    });

    expect(signal).not.toBeNull();
    expect(signal!.candle1mConfirmed).toBe(true);
    expect(signal!.candle5mConfirmed).toBe(true);
    expect(signal!.validationStatus).toBe('CONFIRMED');
    expect(signal!.validationStage).toContain('5m');
  });

  it('REJEITA spike pelo pavio da vela de 1m (não pela de 15m)', () => {
    const spike1m: KlineCandle = {
      timestamp: 1_000_000,
      open: 90000,
      close: 90050,
      high: 91000, // pavio superior: 950 de uma amplitude de 1000
      low: 90000,
      volume: 5000,
      takerBuyVolume: 2000
    };

    const signal = buildTradeSignal(ticker(), analysisKlines(), 2.0, 'INTRADAY', undefined, undefined, undefined, undefined, undefined, {
      klines1m: [spike1m],
      klines5m: [up5m(1_000_000, 90000)]
    });

    expect(signal).not.toBeNull();
    expect(signal!.validationDetails?.spikeDetected).toBe(true);
    expect(signal!.validationStatus).toBe('REJECTED_SPIKE');
    expect(signal!.validationStage).toContain('1m');
  });

  it('a confirmação de 5m depende da vela de 5m, não de 5 barras de 1m atrás', () => {
    // Regressão do defeito original: com 5 velas de 1m e uma 5m CONTRÁRIA, o sinal
    // antigo confirmava (open de 5 barras atrás > close). Agora a 5m manda.
    const c1 = flatCandle(1_000_000, 89900);
    const c2 = flatCandle(1_060_000, 89950);
    const c3 = flatCandle(1_120_000, 90000);
    const c4 = flatCandle(1_180_000, 90050);
    const c5 = flatCandle(1_240_000, 90100);

    const contra5m: KlineCandle = {
      timestamp: 1_300_000,
      open: 90200,
      high: 90210,
      low: 89900,
      close: 90000, // fecha ABAIXO da abertura → tendência de 5m BAIXA
      volume: 500,
      takerBuyVolume: 300
    };

    const signal = buildTradeSignal(ticker(), [c1, c2, c3, c4, c5], 2.0, 'INTRADAY', undefined, undefined, undefined, undefined, undefined, {
      klines1m: [c5],
      klines5m: [contra5m]
    });

    expect(signal).not.toBeNull();
    // A 1m subiu (confirma direção), mas a 5m real caiu → NÃO pode ser CONFIRMED.
    expect(signal!.candle1mConfirmed).toBe(true);
    expect(signal!.candle5mConfirmed).toBe(false);
    expect(signal!.validationStatus).not.toBe('CONFIRMED');
  });
});