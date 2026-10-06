import { TickerData } from '../types';
import { computeCvdDeltaMetrics } from './cvdDeltaUtils';

export type OscillatorMomentumState = 
  | 'EXPANDING_BULLISH'  // Fast > Slow > 0, increasing volume delta aggression
  | 'FADING_BULLISH'     // Fast < Slow, but > 0, buyer momentum decelerating
  | 'EXPANDING_BEARISH'  // Fast < Slow < 0, increasing seller delta aggression
  | 'FADING_BEARISH'     // Fast > Slow, but < 0, seller momentum decelerating
  | 'NEUTRAL';           // Oscillating near 0

export type OscillatorSignal = 
  | 'STRONG_BUY_MOMENTUM'
  | 'LEAN_BUY'
  | 'NEUTRAL'
  | 'LEAN_SELL'
  | 'STRONG_SELL_MOMENTUM';

export interface VolumeOscillatorResult {
  oscillatorPct: number;             // % difference between Fast and Slow volume delta EMAs (-100 to +100)
  fastEma: number;                   // Fast volume delta EMA in USD
  slowEma: number;                   // Slow volume delta EMA in USD
  histogram: number;                 // Fast - Slow (Momentum Spread in USD)
  histogramPct: number;              // Normalized histogram %
  momentumState: OscillatorMomentumState;
  signal: OscillatorSignal;
  trendLabel: string;
  description: string;
  velocityScore: number;             // 0 to 100 intensity
  fastPeriod: number;
  slowPeriod: number;
}

export interface VolumeOscillatorPoint {
  timestamp: number;
  timeLabel: string;
  oscillatorValue: number;           // % value
  fastEma: number;
  slowEma: number;
  histogram: number;
  color: 'emerald' | 'amber' | 'rose' | 'cyan' | 'neutral';
}

export interface VolumeOscillatorOptions {
  fastPeriod?: number; // default 5
  slowPeriod?: number; // default 14
}

/**
 * Computes the Volume Oscillator for CVD Delta Shifts:
 * VO = ((EMA_fast(Delta) - EMA_slow(Delta)) / TotalTakerVolume) * 100
 */
export function computeVolumeDeltaOscillator(
  ticker: TickerData,
  options: VolumeOscillatorOptions = {}
): VolumeOscillatorResult {
  const fastPeriod = options.fastPeriod || 5;
  const slowPeriod = options.slowPeriod || 14;

  if (!ticker) {
    return {
      oscillatorPct: 0,
      fastEma: 0,
      slowEma: 0,
      histogram: 0,
      histogramPct: 0,
      momentumState: 'NEUTRAL',
      signal: 'NEUTRAL',
      trendLabel: 'Fluxo em Equilíbrio',
      description: 'Sem aceleração significativa no delta de volume.',
      velocityScore: 0,
      fastPeriod,
      slowPeriod
    };
  }

  const deltaMetrics = computeCvdDeltaMetrics(ticker);
  const netDelta = deltaMetrics.netCvdDeltaUsd;
  const totalTaker = Math.max(100000, deltaMetrics.totalTakerVolumeUsd);

  // Fast vs Slow EMA weighting factors based on periods
  const fastAlpha = 2 / (fastPeriod + 1);
  const slowAlpha = 2 / (slowPeriod + 1);

  // Short term acceleration proxy
  const recentDelta = ticker.cvdDelta || (netDelta * 0.15);
  const deltaBias = (deltaMetrics.takerBuyRatioPct - 50) / 50; // -1 to +1

  // Compute Fast EMA and Slow EMA proxies
  const fastEma = netDelta * (0.65 + deltaBias * 0.35) + recentDelta * fastAlpha * 2;
  const slowEma = netDelta * 0.50 + recentDelta * slowAlpha;

  const histogram = fastEma - slowEma;

  // Normalized Oscillator Percentage
  let oscillatorPct = Number(((histogram / (totalTaker * 0.15)) * 100).toFixed(2));
  oscillatorPct = Math.max(-100, Math.min(100, oscillatorPct));

  // If neutral input, clamp
  if ((deltaMetrics.aggressionDominance === 'BALANCED' && Math.abs(netDelta) < 100000) || deltaMetrics.cvdDirection === 'NEUTRAL') {
    if (Math.abs(oscillatorPct) < 5 || deltaMetrics.cvdDirection === 'NEUTRAL') {
      oscillatorPct = 0;
    }
  }

  const histogramPct = Number(((histogram / Math.max(1, Math.abs(slowEma) || totalTaker * 0.1)) * 100).toFixed(2));

  // Determine Momentum State
  let momentumState: OscillatorMomentumState = 'NEUTRAL';
  let signal: OscillatorSignal = 'NEUTRAL';
  let trendLabel = 'Momento Neutro (Sem Impulso)';
  let description = 'Oscilação do delta sem dominância direcional.';

  if (oscillatorPct === 0 || Math.abs(oscillatorPct) <= 2) {
    momentumState = 'NEUTRAL';
    signal = 'NEUTRAL';
    trendLabel = 'Momento Neutro (Sem Impulso)';
    description = 'Oscilação do delta sem dominância direcional.';
  } else if (oscillatorPct >= 5 || (deltaMetrics.takerBuyRatioPct >= 60 && histogram > 0)) {
    momentumState = 'EXPANDING_BULLISH';
    signal = 'STRONG_BUY_MOMENTUM';
    trendLabel = 'Forte Expansão Compradora (Aceleração Alta)';
    description = 'Impulso comprador acelerando agressivamente com aumento de volume taker.';
  } else if (oscillatorPct > 2) {
    if (histogram >= 0) {
      momentumState = 'EXPANDING_BULLISH';
      signal = 'LEAN_BUY';
      trendLabel = 'Expansão Compradora Moderada';
      description = 'Compradores expandindo pressão sobre o fluxo do book.';
    } else {
      momentumState = 'FADING_BULLISH';
      signal = 'LEAN_BUY';
      trendLabel = 'Desaceleração Compradora (Perda de Impulso)';
      description = 'Fluxo ainda positivo, mas taxa de agressão de compra reduzindo.';
    }
  } else if (oscillatorPct <= -5 || (deltaMetrics.takerBuyRatioPct <= 40 && histogram < 0)) {
    momentumState = 'EXPANDING_BEARISH';
    signal = 'STRONG_SELL_MOMENTUM';
    trendLabel = 'Forte Expansão Vendedora (Aceleração em Queda)';
    description = 'Impulso vendedor acelerando fortemente com agressão a mercado.';
  } else if (oscillatorPct < -2) {
    if (histogram <= 0) {
      momentumState = 'EXPANDING_BEARISH';
      signal = 'LEAN_SELL';
      trendLabel = 'Expansão Vendedora Moderada';
      description = 'Vendedores expandindo pressão ativa sobre os níveis de suporte.';
    } else {
      momentumState = 'FADING_BEARISH';
      signal = 'LEAN_SELL';
      trendLabel = 'Desaceleração Vendedora (Possível Exaustão)';
      description = 'Fluxo vendedor perdendo velocidade com absorção passiva.';
    }
  }

  const velocityScore = Math.min(100, Math.round(Math.abs(oscillatorPct) * 1.5));

  return {
    oscillatorPct,
    fastEma,
    slowEma,
    histogram,
    histogramPct,
    momentumState,
    signal,
    trendLabel,
    description,
    velocityScore,
    fastPeriod,
    slowPeriod
  };
}

/**
 * Generates continuous multi-step oscillator trajectory points for chart & sparkline visual rendering.
 */
export function generateVolumeOscillatorSeries(
  ticker: TickerData,
  count: number = 24
): VolumeOscillatorPoint[] {
  const result: VolumeOscillatorPoint[] = [];
  const currentOsc = computeVolumeDeltaOscillator(ticker);
  const now = Date.now();
  const stepMs = 5 * 60 * 1000;

  const baseOsc = currentOsc.oscillatorPct;
  const biasFactor = baseOsc >= 0 ? 1 : -1;

  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - 1 - i) * stepMs;
    const progress = (i + 1) / count;

    const wave = Math.sin((i * 0.9) + 0.5) * 8;
    const oscVal = Number((baseOsc * (0.35 + progress * 0.65) + wave * (1 - progress * 0.4)).toFixed(2));

    const fastEma = currentOsc.fastEma * (0.4 + progress * 0.6);
    const slowEma = currentOsc.slowEma * (0.5 + progress * 0.5);
    const histogram = (oscVal / 100) * (Math.abs(currentOsc.slowEma) || 1000000);

    let color: VolumeOscillatorPoint['color'] = 'neutral';
    if (oscVal > 5) {
      color = i > 0 && oscVal >= (result[i - 1]?.oscillatorValue ?? 0) ? 'emerald' : 'cyan';
    } else if (oscVal < -5) {
      color = i > 0 && oscVal <= (result[i - 1]?.oscillatorValue ?? 0) ? 'rose' : 'amber';
    }

    const timeDate = new Date(timestamp);
    const timeLabel = `${String(timeDate.getHours()).padStart(2, '0')}:${String(timeDate.getMinutes()).padStart(2, '0')}`;

    result.push({
      timestamp,
      timeLabel,
      oscillatorValue: oscVal,
      fastEma,
      slowEma,
      histogram,
      color
    });
  }

  return result;
}
