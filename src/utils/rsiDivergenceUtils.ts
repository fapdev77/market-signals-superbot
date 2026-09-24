import { TickerData, RSIDivergenceItem, RSIDivergenceType } from '../types';

/**
 * Calculates theoretical risk-to-reward ratio.
 */
function calculateRiskReward(currentPrice: number, target: number, stopLoss: number): number {
  const potentialGain = Math.abs(target - currentPrice);
  const potentialLoss = Math.abs(currentPrice - stopLoss);
  if (potentialLoss <= 0.000001) return 2.0;
  const rr = potentialGain / potentialLoss;
  return parseFloat(Math.min(9.9, Math.max(0.5, rr)).toFixed(2));
}

/**
 * Estimates synthetic multi-timeframe RSI based on price action,
 * 24h change, moving average deviations, and swing positions.
 */
export function estimateRSI(ticker: TickerData, timeframe: string = '1h'): { current: number; prevSwing: number } {
  const price = ticker.price || 100;
  const changePct = ticker.priceChangePercent24h || 0;
  const devPct = ticker.ma24hDeviationPct || (changePct * 0.4);
  const cvdDir = ticker.cvdDirection;
  const inGP = ticker.fibonacci?.inGoldenPocket;

  // Base multiplier by timeframe
  let tfMultiplier = 1.0;
  if (timeframe === '15m') tfMultiplier = 1.25;
  if (timeframe === '4h') tfMultiplier = 0.85;
  if (timeframe === '1D') tfMultiplier = 0.70;

  // Derive RSI with mean-reverting momentum bounds (10 - 90)
  let rawRsi = 50 + (changePct * 2.8 * tfMultiplier) + (devPct * 1.5);
  if (cvdDir === 'BUY') rawRsi += 3.5;
  if (cvdDir === 'SELL') rawRsi -= 3.5;
  if (inGP && changePct < 0) rawRsi -= 4; // oversold compression
  if (inGP && changePct > 0) rawRsi += 4; // overbought compression

  const currentRsi = Math.max(8, Math.min(92, Math.round(rawRsi * 10) / 10));

  // Determine previous swing RSI based on structure
  let prevSwingRsi = 50;
  if (currentRsi >= 65) {
    // Current is high: previous swing was even higher (Regular Bearish) or lower (Hidden Bearish)
    prevSwingRsi = Math.min(95, currentRsi + (changePct > 2 ? 8 : -6));
  } else if (currentRsi <= 35) {
    // Current is low: previous swing was lower (Regular Bullish) or higher (Hidden Bullish)
    prevSwingRsi = Math.max(5, currentRsi + (changePct < -2 ? -8 : 7));
  } else {
    prevSwingRsi = Math.max(10, Math.min(90, 50 - (changePct * 1.2)));
  }

  return { current: currentRsi, prevSwing: Math.round(prevSwingRsi * 10) / 10 };
}

/**
 * Detects whether an asset exhibits a Regular or Hidden RSI Divergence.
 */
export function scanRSIDivergence(ticker: TickerData, timeframe: string = '1h'): RSIDivergenceItem {
  const price = ticker.price || 1;
  const fib = ticker.fibonacci;
  const key = ticker.keyLevels;
  const cvd = ticker.cvdDirection;
  const trapped = ticker.trappedTraders;
  const changePct = ticker.priceChangePercent24h || 0;

  const { current: rsiCurrent, prevSwing: rsiPrevSwing } = estimateRSI(ticker, timeframe);

  const swingH = fib?.swingHigh || ticker.high24h || price * 1.04;
  const swingL = fib?.swingLow || ticker.low24h || price * 0.96;

  // Divergence logic identification
  let divergenceType: RSIDivergenceType = 'NO_DIVERGENCE';
  let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let confidence = 50;
  const confluences: string[] = [];
  let verdict = 'Sem divergência de momentum significativa no momento.';

  // Price points
  let priceCurrent = price;
  let pricePrevSwing = price;

  // Case 1: REGULAR BULLISH (Price Lower Low + RSI Higher Low)
  // Highly likely when price is near low, change is negative or near support, but RSI isn't dropping as deep
  const isNearSupportOrGP = (price <= (fib?.fib618 || swingL * 1.02)) || (key?.support1 && price <= key.support1 * 1.015);
  const isOversoldOrRebounding = rsiCurrent <= 38 || (rsiCurrent > rsiPrevSwing && rsiPrevSwing <= 32);

  if ((isNearSupportOrGP || changePct < -0.8) && rsiCurrent > rsiPrevSwing && rsiPrevSwing <= 38) {
    divergenceType = 'REGULAR_BULLISH';
    bias = 'BULLISH';
    pricePrevSwing = swingL * 1.01;
    priceCurrent = price;
    confidence = 72;
    verdict = 'Divergência Altista Regular: Preço testando fundo enquanto o RSI forma fundo ascendente (Exaustão Vendedora).';
    confluences.push('Fundo ascendente no RSI (14) em zona de sobrevenda.');
    if (fib?.inGoldenPocket) {
      confidence += 12;
      confluences.push('Confluência direta com Golden Pocket de Fibonacci (0.618 - 0.68).');
    }
    if (cvd === 'BUY' || trapped?.status === 'TRAPPED_SHORTS') {
      confidence += 10;
      confluences.push('Absorção passiva detectada no Order Flow (Trapped Shorts).');
    }
    if (key?.support1 && price <= key.support1 * 1.01) {
      confidence += 6;
      confluences.push(`Defesa no suporte diário $${key.support1}.`);
    }
  }

  // Case 2: REGULAR BEARISH (Price Higher High + RSI Lower High)
  // Highly likely when price is near high, change is positive, but RSI is losing steam
  const isNearResistance = (price >= (fib?.fib236 || swingH * 0.985)) || (key?.resistance1 && price >= key.resistance1 * 0.985);
  const isOverboughtOrTiring = rsiCurrent >= 62 || (rsiCurrent < rsiPrevSwing && rsiPrevSwing >= 68);

  if ((isNearResistance || changePct > 0.8) && rsiCurrent < rsiPrevSwing && rsiPrevSwing >= 62 && divergenceType === 'NO_DIVERGENCE') {
    divergenceType = 'REGULAR_BEARISH';
    bias = 'BEARISH';
    pricePrevSwing = swingH * 0.99;
    priceCurrent = price;
    confidence = 74;
    verdict = 'Divergência Baixista Regular: Preço renovando topo sem confirmação de momentum no RSI (Exaustão Compradora).';
    confluences.push('Topo descendente no RSI (14) em região de sobrecompra.');
    if (trapped?.status === 'TRAPPED_LONGS') {
      confidence += 12;
      confluences.push('Traders presos no topo (Trapped Longs) aguardando liquidação.');
    }
    if (cvd === 'SELL') {
      confidence += 8;
      confluences.push('Delta CVD negativo com agressões vendedoras crescentes.');
    }
    if (key?.resistance1 && price >= key.resistance1 * 0.99) {
      confidence += 6;
      confluences.push(`Rejeição próxima à resistência $${key.resistance1}.`);
    }
  }

  // Case 3: HIDDEN BULLISH (Price Higher Low + RSI Lower Low - Trend Continuation)
  if (divergenceType === 'NO_DIVERGENCE' && changePct >= 0 && rsiCurrent < rsiPrevSwing && rsiCurrent <= 48) {
    divergenceType = 'HIDDEN_BULLISH';
    bias = 'BULLISH';
    pricePrevSwing = swingL;
    priceCurrent = price;
    confidence = 66;
    verdict = 'Divergência Oculta de Alta: Preço sustenta fundo mais alto enquanto RSI resfria (Pullback saudável).';
    confluences.push('Reset de RSI durante tendência primária de alta.');
    if (fib?.trend === 'UP') {
      confidence += 10;
      confluences.push('Estrutura macro de topos e fundos ascendentes confirmada.');
    }
  }

  // Case 4: HIDDEN BEARISH (Price Lower High + RSI Higher High - Trend Continuation)
  if (divergenceType === 'NO_DIVERGENCE' && changePct < 0 && rsiCurrent > rsiPrevSwing && rsiCurrent >= 52) {
    divergenceType = 'HIDDEN_BEARISH';
    bias = 'BEARISH';
    pricePrevSwing = swingH;
    priceCurrent = price;
    confidence = 65;
    verdict = 'Divergência Oculta de Baixa: Repique técnico do RSI em tendência de baixa estrutural.';
    confluences.push('Alívio do RSI para nova pernada de distribuição.');
    if (fib?.trend === 'DOWN') {
      confidence += 10;
      confluences.push('Estrutura macro de topos e fundos descendentes.');
    }
  }

  // Fallback if no specific divergence
  if (divergenceType === 'NO_DIVERGENCE') {
    pricePrevSwing = price * 0.99;
    confluences.push('Momentum oscilando alinhado com a ação de preço.');
  }

  confidence = Math.min(98, Math.max(35, confidence));

  // Trade setups
  const isBull = bias === 'BULLISH';
  const isBear = bias === 'BEARISH';

  const entryZone: [number, number] = isBull
    ? [price * 0.996, price * 1.002]
    : isBear
    ? [price * 0.998, price * 1.004]
    : [price * 0.995, price * 1.005];

  const stopLoss = isBull
    ? (key?.support1 ? Math.min(key.support1 * 0.995, price * 0.985) : price * 0.982)
    : isBear
    ? (key?.resistance1 ? Math.max(key.resistance1 * 1.005, price * 1.015) : price * 1.018)
    : price * 0.99;

  const target1 = isBull
    ? (ticker.rangeProfile?.poc || key?.resistance1 || price * 1.025)
    : (ticker.rangeProfile?.poc || key?.support1 || price * 0.975);

  const target2 = isBull
    ? (key?.resistance2 || swingH || price * 1.045)
    : (key?.support2 || swingL || price * 0.955);

  const riskRewardRatio = calculateRiskReward(price, target1, stopLoss);

  const divergenceSlope = parseFloat((((rsiCurrent - rsiPrevSwing) / (rsiPrevSwing || 1)) * 100).toFixed(1));

  return {
    id: `${ticker.symbol}_RSI_${timeframe}`,
    symbol: ticker.symbol,
    ticker,
    timeframe,
    divergenceType,
    bias,
    rsiCurrent,
    rsiPrevSwing,
    priceCurrent,
    pricePrevSwing,
    divergenceSlope,
    confidence,
    status: divergenceType !== 'NO_DIVERGENCE' ? 'ACTIVE' : 'EXHAUSTED',
    isOverbought: rsiCurrent >= 70,
    isOversold: rsiCurrent <= 30,
    entryZone,
    stopLoss,
    target1,
    target2,
    riskRewardRatio,
    confluences,
    verdict,
    detectedAt: Date.now()
  };
}

/**
 * Scans an array of tickers and generates full RSI divergence universe statistics.
 */
export function scanUniverseRSIDivergences(tickers: TickerData[], timeframe: string = '1h'): {
  items: RSIDivergenceItem[];
  bullishCount: number;
  bearishCount: number;
  regularCount: number;
  hiddenCount: number;
  avgRSI: number;
  topOpportunity: RSIDivergenceItem | null;
  marketCondition: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
} {
  const items = tickers.map(t => scanRSIDivergence(t, timeframe));

  // Sort with highest confidence active divergences first
  items.sort((a, b) => {
    const aHasDiv = a.divergenceType !== 'NO_DIVERGENCE' ? 1 : 0;
    const bHasDiv = b.divergenceType !== 'NO_DIVERGENCE' ? 1 : 0;
    if (aHasDiv !== bHasDiv) return bHasDiv - aHasDiv;
    return b.confidence - a.confidence;
  });

  const bullishCount = items.filter(i => i.bias === 'BULLISH' && i.divergenceType !== 'NO_DIVERGENCE').length;
  const bearishCount = items.filter(i => i.bias === 'BEARISH' && i.divergenceType !== 'NO_DIVERGENCE').length;
  const regularCount = items.filter(i => i.divergenceType === 'REGULAR_BULLISH' || i.divergenceType === 'REGULAR_BEARISH').length;
  const hiddenCount = items.filter(i => i.divergenceType === 'HIDDEN_BULLISH' || i.divergenceType === 'HIDDEN_BEARISH').length;

  const totalRsi = items.reduce((acc, curr) => acc + curr.rsiCurrent, 0);
  const avgRSI = items.length > 0 ? Math.round((totalRsi / items.length) * 10) / 10 : 50;

  const marketCondition = avgRSI >= 65 ? 'OVERBOUGHT' : avgRSI <= 35 ? 'OVERSOLD' : 'NEUTRAL';

  const topOpportunity = items.find(i => i.divergenceType !== 'NO_DIVERGENCE') || items[0] || null;

  return {
    items,
    bullishCount,
    bearishCount,
    regularCount,
    hiddenCount,
    avgRSI,
    topOpportunity,
    marketCondition
  };
}
