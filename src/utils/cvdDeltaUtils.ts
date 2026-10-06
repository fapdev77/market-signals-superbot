import { TickerData, OrderBookLevel } from '../types';

export type AggressionDominance = 
  | 'EXTREME_BUY'
  | 'STRONG_BUY'
  | 'MODERATE_BUY'
  | 'BALANCED'
  | 'MODERATE_SELL'
  | 'STRONG_SELL'
  | 'EXTREME_SELL';

export type OrderFlowDivergenceType = 
  | 'CONVERGENT_BULLISH'
  | 'CONVERGENT_BEARISH'
  | 'PASSIVE_ABSORPTION_BUY'
  | 'PASSIVE_ABSORPTION_SELL'
  | 'EXHAUSTION_BULLISH'
  | 'EXHAUSTION_BEARISH'
  | 'BALANCED_FLOW';

export type OBICategory = 
  | 'STRONG_BID_IMBALANCE'
  | 'MODERATE_BID_IMBALANCE'
  | 'BALANCED'
  | 'MODERATE_ASK_IMBALANCE'
  | 'STRONG_ASK_IMBALANCE';

export interface OrderBookImbalanceResult {
  bidsVolumeUsd: number;
  asksVolumeUsd: number;
  totalVolumeUsd: number;
  imbalanceRatioRaw: number;  // (Bids - Asks) / (Bids + Asks) -> from -1.0 to +1.0
  imbalancePct: number;       // ((Bids - Asks) / (Bids + Asks)) * 100 -> from -100% to +100%
  bidPercentage: number;      // 0 to 100%
  askPercentage: number;      // 0 to 100%
  bias: 'BUY' | 'SELL' | 'NEUTRAL';
  category: OBICategory;
  label: string;
  intensityScore: number;     // 0 to 100
}

export interface CvdDeltaMetrics {
  totalTakerVolumeUsd: number;
  takerBuyVolumeUsd: number;
  takerSellVolumeUsd: number;
  netCvdDeltaUsd: number;
  takerBuyRatioPct: number;
  takerSellRatioPct: number;
  cvdDeltaPercent: number;
  cvdDirection: 'BUY' | 'SELL' | 'NEUTRAL';
  aggressionDominance: AggressionDominance;
  aggressionDominanceLabel: string;
  volumeDeltaSpeedUsdPerMin: number;
  institutionalRatio: number;
}

export interface OrderFlowDivergenceResult {
  divergenceType: OrderFlowDivergenceType;
  divergenceLabel: string;
  divergenceDescription: string;
  bias: 'BUY' | 'SELL' | 'NEUTRAL';
  divergenceScore: number; // -100 (Max Bearish) to +100 (Max Bullish)
}

export interface CvdDeltaDataPoint {
  timestamp: number;
  timeLabel: string;
  price: number;
  takerBuyUsd: number;
  takerSellUsd: number;
  deltaUsd: number;
  cumulativeCvdUsd: number;
  takerRatio: number;
}

/**
 * Computes taker buy vs sell breakdown, net delta, and aggression metrics from a ticker.
 */
export function computeCvdDeltaMetrics(ticker: TickerData): CvdDeltaMetrics {
  if (!ticker) {
    return {
      totalTakerVolumeUsd: 0,
      takerBuyVolumeUsd: 0,
      takerSellVolumeUsd: 0,
      netCvdDeltaUsd: 0,
      takerBuyRatioPct: 50,
      takerSellRatioPct: 50,
      cvdDeltaPercent: 0,
      cvdDirection: 'NEUTRAL',
      aggressionDominance: 'BALANCED',
      aggressionDominanceLabel: 'Equilíbrio Taker (Fluxo Neutro)',
      volumeDeltaSpeedUsdPerMin: 0,
      institutionalRatio: 1
    };
  }

  // 1. Determine Buy Ratio
  let buyRatio: number;
  if (typeof ticker.takerBuyRatio === 'number' && !isNaN(ticker.takerBuyRatio)) {
    buyRatio = Math.max(0.05, Math.min(0.95, ticker.takerBuyRatio));
  } else if (typeof ticker.cvdDeltaPercent === 'number' && ticker.cvdDeltaPercent !== 0) {
    buyRatio = Math.max(0.1, Math.min(0.9, 0.5 + (ticker.cvdDeltaPercent / 200)));
  } else if (ticker.cvdDirection === 'BUY') {
    buyRatio = 0.55;
  } else if (ticker.cvdDirection === 'SELL') {
    buyRatio = 0.45;
  } else {
    buyRatio = 0.50;
  }

  const sellRatio = 1 - buyRatio;

  // Approximate 24h taker trading volume (~45-55% of total quote volume is typically taker execution in crypto futures)
  const estimatedTakerShare = 0.52;
  const rawQuoteVol = ticker.quoteVolume24h || (ticker.volume24h ? ticker.volume24h * ticker.price : 1000000);
  const totalTakerVolumeUsd = rawQuoteVol * estimatedTakerShare;

  const takerBuyVolumeUsd = totalTakerVolumeUsd * buyRatio;
  const takerSellVolumeUsd = totalTakerVolumeUsd * sellRatio;

  // Net delta: if ticker.cvd is provided and aligned with direction, use it, else compute directly from taker buy - sell
  let netCvdDeltaUsd = takerBuyVolumeUsd - takerSellVolumeUsd;
  if (typeof ticker.cvd === 'number' && ticker.cvd !== 0) {
    if ((buyRatio > 0.5 && ticker.cvd > 0) || (buyRatio < 0.5 && ticker.cvd < 0) || (buyRatio === 0.5)) {
      netCvdDeltaUsd = ticker.cvd;
    }
  }

  const takerBuyRatioPct = Number((buyRatio * 100).toFixed(2));
  const takerSellRatioPct = Number((sellRatio * 100).toFixed(2));
  const cvdDeltaPercent = Number(((buyRatio - sellRatio) * 100).toFixed(2));

  let cvdDirection: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  if (ticker.cvdDirection) {
    cvdDirection = ticker.cvdDirection;
  } else if (takerBuyRatioPct >= 51.5 || netCvdDeltaUsd > 100000) {
    cvdDirection = 'BUY';
  } else if (takerBuyRatioPct <= 48.5 || netCvdDeltaUsd < -100000) {
    cvdDirection = 'SELL';
  }

  // Dominance level
  let aggressionDominance: AggressionDominance = 'BALANCED';
  let aggressionDominanceLabel = 'Equilíbrio Taker (Fluxo Neutro)';

  if (takerBuyRatioPct >= 65) {
    aggressionDominance = 'EXTREME_BUY';
    aggressionDominanceLabel = 'Agressão Compradora Extrema (Taker Squeeze)';
  } else if (takerBuyRatioPct >= 55) {
    aggressionDominance = 'STRONG_BUY';
    aggressionDominanceLabel = 'Forte Agressão Compradora (Taker Buy)';
  } else if (takerBuyRatioPct >= 51.5) {
    aggressionDominance = 'MODERATE_BUY';
    aggressionDominanceLabel = 'Leve Agressão Compradora';
  } else if (takerBuyRatioPct <= 35) {
    aggressionDominance = 'EXTREME_SELL';
    aggressionDominanceLabel = 'Agressão Vendedora Extrema (Taker Cascade)';
  } else if (takerBuyRatioPct <= 45) {
    aggressionDominance = 'STRONG_SELL';
    aggressionDominanceLabel = 'Forte Agressão Vendedora (Taker Sell)';
  } else if (takerBuyRatioPct <= 48.5) {
    aggressionDominance = 'MODERATE_SELL';
    aggressionDominanceLabel = 'Leve Agressão Vendedora';
  }

  const volumeDeltaSpeedUsdPerMin = Math.abs(netCvdDeltaUsd) / (24 * 60);
  const institutionalRatio = takerSellVolumeUsd > 0 ? Number((takerBuyVolumeUsd / takerSellVolumeUsd).toFixed(2)) : 1;

  return {
    totalTakerVolumeUsd,
    takerBuyVolumeUsd,
    takerSellVolumeUsd,
    netCvdDeltaUsd,
    takerBuyRatioPct,
    takerSellRatioPct,
    cvdDeltaPercent,
    cvdDirection,
    aggressionDominance,
    aggressionDominanceLabel,
    volumeDeltaSpeedUsdPerMin,
    institutionalRatio
  };
}

/**
 * Classifies the divergence between passive Limit order book depth and active Taker CVD aggression.
 */
export function classifyOrderFlowDivergence(
  ticker: TickerData,
  bookImbalancePct: number
): OrderFlowDivergenceResult {
  const deltaMetrics = computeCvdDeltaMetrics(ticker);
  const isBookBidHeavy = bookImbalancePct >= 8;
  const isBookAskHeavy = bookImbalancePct <= -8;
  const isCvdBuying = deltaMetrics.takerBuyRatioPct >= 52 || deltaMetrics.cvdDirection === 'BUY';
  const isCvdSelling = deltaMetrics.takerBuyRatioPct <= 48 || deltaMetrics.cvdDirection === 'SELL';

  // 1. Convergent Bullish: Both Limit Depth and Taker Market Orders are bullish
  if (isBookBidHeavy && isCvdBuying) {
    return {
      divergenceType: 'CONVERGENT_BULLISH',
      divergenceLabel: 'Convergência Compradora Total',
      divergenceDescription: 'Muralhas de suporte no book + agressão compradora taker ativa no mercado.',
      bias: 'BUY',
      divergenceScore: 85
    };
  }

  // 2. Convergent Bearish: Both Limit Depth and Taker Market Orders are bearish
  if (isBookAskHeavy && isCvdSelling) {
    return {
      divergenceType: 'CONVERGENT_BEARISH',
      divergenceLabel: 'Convergência Vendedora Total',
      divergenceDescription: 'Muralhas de resistência no book + agressão vendedora taker ativa desovando posições.',
      bias: 'SELL',
      divergenceScore: -85
    };
  }

  // 3. Passive Absorption BUY: Book is heavy Ask (Resistance) but aggressive Buyers are absorbing all liquidity
  if (isBookAskHeavy && isCvdBuying) {
    return {
      divergenceType: 'PASSIVE_ABSORPTION_BUY',
      divergenceLabel: 'Absorção Compradora Institucional',
      divergenceDescription: 'Compradores taker agredindo agressivamente as muralhas passivas de venda.',
      bias: 'BUY',
      divergenceScore: 65
    };
  }

  // 4. Passive Absorption SELL: Book is heavy Bid (Support) but aggressive Sellers are hammering into support
  if (isBookBidHeavy && isCvdSelling) {
    return {
      divergenceType: 'PASSIVE_ABSORPTION_SELL',
      divergenceLabel: 'Absorção Vendedora / Despejo Ativo',
      divergenceDescription: 'Vendedores taker consumindo a liquidez passiva de compra no bid.',
      bias: 'SELL',
      divergenceScore: -65
    };
  }

  // 5. Mild Divergence or Balanced Flow
  if (isCvdBuying) {
    return {
      divergenceType: 'CONVERGENT_BULLISH',
      divergenceLabel: 'Pressão Compradora Taker',
      divergenceDescription: 'Fluxo ativo favorável com dominância de compradores a mercado.',
      bias: 'BUY',
      divergenceScore: 40
    };
  }

  if (isCvdSelling) {
    return {
      divergenceType: 'CONVERGENT_BEARISH',
      divergenceLabel: 'Pressão Vendedora Taker',
      divergenceDescription: 'Fluxo ativo com dominância de vendedores a mercado.',
      bias: 'SELL',
      divergenceScore: -40
    };
  }

  return {
    divergenceType: 'BALANCED_FLOW',
    divergenceLabel: 'Fluxo de Ordens Neutro & Balanceado',
    divergenceDescription: 'Takers e makers em equilíbrio sem divergência direcional significativa.',
    bias: 'NEUTRAL',
    divergenceScore: 0
  };
}

/**
 * Generates continuous time-series buckets for the comparative CVD Delta curve overlay.
 */
export function generateCvdDeltaSeries(
  ticker: TickerData,
  count: number = 24
): CvdDeltaDataPoint[] {
  const result: CvdDeltaDataPoint[] = [];
  const metrics = computeCvdDeltaMetrics(ticker);
  const now = Date.now();
  const stepMs = 5 * 60 * 1000; // 5m buckets
  const basePrice = ticker.price || 100;

  const totalCvd = metrics.netCvdDeltaUsd;
  const biasFactor = metrics.cvdDirection === 'BUY' ? 1 : metrics.cvdDirection === 'SELL' ? -1 : 0;
  const buyRatio = metrics.takerBuyRatioPct / 100;

  let rollingCvd = totalCvd * 0.15 * (1 - biasFactor * 0.5);
  const bucketVol = metrics.totalTakerVolumeUsd / (count * 4);

  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - 1 - i) * stepMs;
    const progress = (i + 1) / count;
    
    // Deterministic pseudo-variation
    const noise = Math.sin((i * 1.7) + (ticker.price % 7)) * 0.15;
    const currentBuyRatio = Math.max(0.15, Math.min(0.85, buyRatio + noise * (1 - progress)));
    const currentSellRatio = 1 - currentBuyRatio;

    const takerBuyUsd = bucketVol * currentBuyRatio * (0.85 + progress * 0.3);
    const takerSellUsd = bucketVol * currentSellRatio * (0.85 + progress * 0.3);
    const deltaUsd = takerBuyUsd - takerSellUsd;

    rollingCvd += deltaUsd;

    const timeDate = new Date(timestamp);
    const timeLabel = `${String(timeDate.getHours()).padStart(2, '0')}:${String(timeDate.getMinutes()).padStart(2, '0')}`;

    result.push({
      timestamp,
      timeLabel,
      price: basePrice * (1 + (biasFactor * progress * 0.015) + noise * 0.005),
      takerBuyUsd,
      takerSellUsd,
      deltaUsd,
      cumulativeCvdUsd: rollingCvd,
      takerRatio: currentBuyRatio
    });
  }

  return result;
}

/**
 * Computes the real-time Order Book Imbalance (OBI) percentage as (Bids - Asks) / (Bids + Asks).
 */
export function computeOrderBookImbalance(
  bidsVolumeUsd: number, 
  asksVolumeUsd: number
): OrderBookImbalanceResult {
  const total = bidsVolumeUsd + asksVolumeUsd;
  if (total <= 0) {
    return {
      bidsVolumeUsd: 0,
      asksVolumeUsd: 0,
      totalVolumeUsd: 0,
      imbalanceRatioRaw: 0,
      imbalancePct: 0,
      bidPercentage: 50,
      askPercentage: 50,
      bias: 'NEUTRAL',
      category: 'BALANCED',
      label: 'Livro Equilibrado (0.0%)',
      intensityScore: 0
    };
  }

  const rawRatio = (bidsVolumeUsd - asksVolumeUsd) / total;
  const pct = Number((rawRatio * 100).toFixed(2));
  const bidPercentage = Number(((bidsVolumeUsd / total) * 100).toFixed(2));
  const askPercentage = Number(((asksVolumeUsd / total) * 100).toFixed(2));

  let bias: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let category: OBICategory = 'BALANCED';
  let label = `Livro Equilibrado (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;

  if (pct >= 25) {
    bias = 'BUY';
    category = 'STRONG_BID_IMBALANCE';
    label = `Forte Desequilíbrio Bid (+${pct.toFixed(1)}%)`;
  } else if (pct >= 5) {
    bias = 'BUY';
    category = 'MODERATE_BID_IMBALANCE';
    label = `Moderado Desequilíbrio Bid (+${pct.toFixed(1)}%)`;
  } else if (pct <= -25) {
    bias = 'SELL';
    category = 'STRONG_ASK_IMBALANCE';
    label = `Forte Desequilíbrio Ask (${pct.toFixed(1)}%)`;
  } else if (pct <= -5) {
    bias = 'SELL';
    category = 'MODERATE_ASK_IMBALANCE';
    label = `Moderado Desequilíbrio Ask (${pct.toFixed(1)}%)`;
  }

  return {
    bidsVolumeUsd,
    asksVolumeUsd,
    totalVolumeUsd: total,
    imbalanceRatioRaw: rawRatio,
    imbalancePct: pct,
    bidPercentage,
    askPercentage,
    bias,
    category,
    label,
    intensityScore: Math.min(100, Math.round(Math.abs(pct)))
  };
}

/**
 * Computes Order Book Imbalance across multiple price deviation tiers.
 */
export function computeMultiTierOBI(
  bids: OrderBookLevel[],
  asks: OrderBookLevel[]
): Record<'0.5%' | '1%' | '2%' | '5%' | 'full', OrderBookImbalanceResult> {
  const getTierUsd = (levels: OrderBookLevel[], maxDev: number) => {
    if (!levels || levels.length === 0) return 0;
    const filtered = levels.filter(l => Math.abs(l.deviationPct) <= maxDev);
    return filtered[filtered.length - 1]?.totalUsd || filtered.reduce((acc, curr) => acc + curr.totalUsd, 0);
  };

  const fullBidUsd = bids && bids.length > 0 ? (bids[bids.length - 1]?.totalUsd || bids.reduce((a, c) => a + c.totalUsd, 0)) : 0;
  const fullAskUsd = asks && asks.length > 0 ? (asks[asks.length - 1]?.totalUsd || asks.reduce((a, c) => a + c.totalUsd, 0)) : 0;

  return {
    '0.5%': computeOrderBookImbalance(getTierUsd(bids, 0.5), getTierUsd(asks, 0.5)),
    '1%': computeOrderBookImbalance(getTierUsd(bids, 1.0), getTierUsd(asks, 1.0)),
    '2%': computeOrderBookImbalance(getTierUsd(bids, 2.0), getTierUsd(asks, 2.0)),
    '5%': computeOrderBookImbalance(getTierUsd(bids, 5.0), getTierUsd(asks, 5.0)),
    'full': computeOrderBookImbalance(fullBidUsd, fullAskUsd)
  };
}

export type CvdMomentumState = 
  | 'BULLISH_ACCELERATION'
  | 'BULLISH_DECELERATION'
  | 'BEARISH_ACCELERATION'
  | 'BEARISH_DECELERATION'
  | 'NEUTRAL_CONVERGENCE';

export interface VolumeOscillatorDataPoint {
  timestamp: number;
  timeLabel: string;
  oscillator: number;      // % momentum difference
  signal: number;          // smoothed signal line
  histogram: number;       // oscillator - signal
  deltaUsd: number;        // raw delta for bucket
  takerBuyUsd: number;
  takerSellUsd: number;
  fastMa: number;
  slowMa: number;
  state: CvdMomentumState;
  color: string;
}

export interface VolumeOscillatorResult {
  currentOscillator: number;
  currentSignal: number;
  currentHistogram: number;
  previousHistogram: number;
  momentumState: CvdMomentumState;
  momentumStateLabel: string;
  momentumStateDescription: string;
  trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  momentumIntensity: number; // 0 to 100%
  velocityUsdPerMin: number;
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  series: VolumeOscillatorDataPoint[];
}

/**
 * Calculates exponential moving average array.
 */
function calculateEMA(values: number[], period: number): number[] {
  if (!values || values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      prev = values[0];
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    ema.push(prev);
  }
  return ema;
}

/**
 * Classifies the momentum state based on current oscillator, signal, and histogram changes.
 */
export function classifyCvdMomentum(
  oscillator: number,
  signal: number,
  histogram: number,
  prevHistogram: number
): {
  state: CvdMomentumState;
  label: string;
  description: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  intensity: number;
  color: string;
} {
  const isPositiveOsc = oscillator >= 0;
  const isExpandingHist = Math.abs(histogram) >= Math.abs(prevHistogram);

  if (Math.abs(oscillator) < 0.2 && Math.abs(histogram) < 0.1) {
    return {
      state: 'NEUTRAL_CONVERGENCE',
      label: 'Convergência Neutra',
      description: 'Delta taker e oscilador em equilíbrio de fluxo com momentum estagnado.',
      direction: 'NEUTRAL',
      intensity: 10,
      color: '#94a3b8'
    };
  }

  if (isPositiveOsc) {
    if (histogram >= 0 && (histogram >= prevHistogram || isExpandingHist)) {
      return {
        state: 'BULLISH_ACCELERATION',
        label: 'Aceleração Compradora Forte',
        description: 'Pressão taker compradora em franca expansão de momentum (impulso institucional positivo).',
        direction: 'BULLISH',
        intensity: Math.min(100, Math.round(Math.abs(oscillator) * 12 + Math.abs(histogram) * 15)),
        color: '#10b981'
      };
    } else {
      return {
        state: 'BULLISH_DECELERATION',
        label: 'Exaustão Compradora (Desaceleração)',
        description: 'Fluxo ainda positivo, mas momentum comprador enfraquecendo e convergindo para venda.',
        direction: 'BULLISH',
        intensity: Math.max(20, Math.min(80, Math.round(Math.abs(oscillator) * 8))),
        color: '#0d9488'
      };
    }
  } else {
    if (histogram <= 0 && (histogram <= prevHistogram || isExpandingHist)) {
      return {
        state: 'BEARISH_ACCELERATION',
        label: 'Aceleração Vendedora Forte',
        description: 'Pressão taker vendedora acelerando rapidamente (despejo ativo a mercado).',
        direction: 'BEARISH',
        intensity: Math.min(100, Math.round(Math.abs(oscillator) * 12 + Math.abs(histogram) * 15)),
        color: '#f43f5e'
      };
    } else {
      return {
        state: 'BEARISH_DECELERATION',
        label: 'Exaustão Vendedora (Desaceleração)',
        description: 'Fluxo em território negativo, porém com perda de ímpeto vendedor e absorção iminente.',
        direction: 'BEARISH',
        intensity: Math.max(20, Math.min(80, Math.round(Math.abs(oscillator) * 8))),
        color: '#f97316'
      };
    }
  }
}

/**
 * Computes the CVD Volume Oscillator indicator measuring the momentum behind taker delta shifts.
 */
export function computeCvdVolumeOscillator(
  series: CvdDeltaDataPoint[],
  fastPeriod: number = 5,
  slowPeriod: number = 12,
  signalPeriod: number = 5
): VolumeOscillatorResult {
  if (!series || series.length === 0) {
    return {
      currentOscillator: 0,
      currentSignal: 0,
      currentHistogram: 0,
      previousHistogram: 0,
      momentumState: 'NEUTRAL_CONVERGENCE',
      momentumStateLabel: 'Convergência Neutra',
      momentumStateDescription: 'Sem dados suficientes para calcular oscilador de volume.',
      trendDirection: 'NEUTRAL',
      momentumIntensity: 0,
      velocityUsdPerMin: 0,
      fastPeriod,
      slowPeriod,
      signalPeriod,
      series: []
    };
  }

  const deltas = series.map(d => d.deltaUsd);
  const totalVolumes = series.map(d => Math.max(1000, (d.takerBuyUsd + d.takerSellUsd)));

  const fastEma = calculateEMA(deltas, fastPeriod);
  const slowEma = calculateEMA(deltas, slowPeriod);
  const volEma = calculateEMA(totalVolumes, slowPeriod);

  // Raw oscillator = (FastEMA - SlowEMA) / VolEMA * 100
  const rawOscillators: number[] = [];
  for (let i = 0; i < series.length; i++) {
    const vol = volEma[i] > 0 ? volEma[i] : 1000;
    const diff = fastEma[i] - slowEma[i];
    const oscVal = Number(((diff / vol) * 100).toFixed(2));
    rawOscillators.push(oscVal);
  }

  const signalLine = calculateEMA(rawOscillators, signalPeriod);

  const oscillatorSeries: VolumeOscillatorDataPoint[] = [];

  for (let i = 0; i < series.length; i++) {
    const osc = rawOscillators[i];
    const sig = signalLine[i];
    const hist = Number((osc - sig).toFixed(2));
    const prevHist = i > 0 ? oscillatorSeries[i - 1].histogram : hist;

    const classification = classifyCvdMomentum(osc, sig, hist, prevHist);

    oscillatorSeries.push({
      timestamp: series[i].timestamp,
      timeLabel: series[i].timeLabel,
      oscillator: osc,
      signal: Number(sig.toFixed(2)),
      histogram: hist,
      deltaUsd: series[i].deltaUsd,
      takerBuyUsd: series[i].takerBuyUsd,
      takerSellUsd: series[i].takerSellUsd,
      fastMa: Number(fastEma[i].toFixed(2)),
      slowMa: Number(slowEma[i].toFixed(2)),
      state: classification.state,
      color: classification.color
    });
  }

  const last = oscillatorSeries[oscillatorSeries.length - 1];
  const secondLast = oscillatorSeries.length > 1 ? oscillatorSeries[oscillatorSeries.length - 2] : last;

  const currentClassification = classifyCvdMomentum(
    last.oscillator,
    last.signal,
    last.histogram,
    secondLast.histogram
  );

  // Delta momentum velocity in USD/min
  const deltaShift = Math.abs(last.deltaUsd - secondLast.deltaUsd);
  const velocityUsdPerMin = Math.round(deltaShift / 5);

  return {
    currentOscillator: last.oscillator,
    currentSignal: last.signal,
    currentHistogram: last.histogram,
    previousHistogram: secondLast.histogram,
    momentumState: currentClassification.state,
    momentumStateLabel: currentClassification.label,
    momentumStateDescription: currentClassification.description,
    trendDirection: currentClassification.direction,
    momentumIntensity: currentClassification.intensity,
    velocityUsdPerMin,
    fastPeriod,
    slowPeriod,
    signalPeriod,
    series: oscillatorSeries
  };
}


