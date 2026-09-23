import { PortfolioPosition, PortfolioRiskSummary, SectorRiskExposure, MarketSector, TradeSignal, TickerData } from '../types';

export const SECTOR_METADATA: Record<MarketSector, { name: string; description: string; color: string; defaultBeta: number }> = {
  ALL: { name: 'Todos os Setores', description: 'Visão agregada global', color: '#6366f1', defaultBeta: 1.0 },
  FAVORITES: { name: 'Favoritos', description: 'Ativos selecionados', color: '#f59e0b', defaultBeta: 1.0 },
  L1_L2: { name: 'Layer 1 & Layer 2', description: 'Infraestrutura blockchain, smart contracts e rollups', color: '#3b82f6', defaultBeta: 1.15 },
  DEFI: { name: 'DeFi & Lending', description: 'Protocolos de liquidez, DEXs, oráculos e RWAs', color: '#10b981', defaultBeta: 1.3 },
  AI: { name: 'Inteligência Artificial', description: 'Redes descentralizadas de GPU, agentes e computação', color: '#8b5cf6', defaultBeta: 1.65 },
  MEME: { name: 'Meme & High Beta', description: 'Ativos de alta volatilidade e especulação comunitária', color: '#f43f5e', defaultBeta: 2.1 },
  TRADFI: { name: 'TradFi & Macro', description: 'Ouro, commodities, treasuries e índices globais', color: '#eab308', defaultBeta: 0.25 }
};

export const ASSET_SECTOR_MAP: Record<string, { sector: MarketSector; name: string; tag: string; beta: number }> = {
  BTCUSDT: { sector: 'L1_L2', name: 'Bitcoin', tag: 'Store of Value / L1', beta: 1.0 },
  ETHUSDT: { sector: 'L1_L2', name: 'Ethereum', tag: 'Smart Contracts L1', beta: 1.15 },
  SOLUSDT: { sector: 'L1_L2', name: 'Solana', tag: 'High-Performance L1', beta: 1.4 },
  BNBUSDT: { sector: 'L1_L2', name: 'BNB Chain', tag: 'Exchange Ecosystem', beta: 0.95 },
  XRPUSDT: { sector: 'L1_L2', name: 'Ripple', tag: 'Payment Settlement', beta: 1.1 },
  AVAXUSDT: { sector: 'L1_L2', name: 'Avalanche', tag: 'Subnet L1', beta: 1.35 },
  SUIUSDT: { sector: 'L1_L2', name: 'Sui Network', tag: 'Move VM L1', beta: 1.45 },
  APTUSDT: { sector: 'L1_L2', name: 'Aptos', tag: 'Move VM L1', beta: 1.4 },
  ARBUSDT: { sector: 'L1_L2', name: 'Arbitrum', tag: 'Ethereum L2 Rollup', beta: 1.3 },
  OPUSDT: { sector: 'L1_L2', name: 'Optimism', tag: 'OP Stack L2', beta: 1.35 },
  SEIUSDT: { sector: 'L1_L2', name: 'Sei Network', tag: 'Trading L1', beta: 1.4 },
  TIAUSDT: { sector: 'L1_L2', name: 'Celestia', tag: 'Modular DA', beta: 1.5 },

  // DEFI
  LINKUSDT: { sector: 'DEFI', name: 'Chainlink', tag: 'Oracle Infrastructure', beta: 1.2 },
  AAVEUSDT: { sector: 'DEFI', name: 'Aave', tag: 'Lending & Borrowing', beta: 1.3 },
  UNIUSDT: { sector: 'DEFI', name: 'Uniswap', tag: 'DEX AMM Leader', beta: 1.25 },
  MKRUSDT: { sector: 'DEFI', name: 'Maker / Sky', tag: 'RWA & Stablecoin', beta: 1.05 },
  PENDLEUSDT: { sector: 'DEFI', name: 'Pendle', tag: 'Yield Tokenization', beta: 1.4 },
  INJUSDT: { sector: 'DEFI', name: 'Injective', tag: 'Derivatives DeFi', beta: 1.35 },

  // AI
  NEARUSDT: { sector: 'AI', name: 'NEAR Protocol', tag: 'User-Owned AI & L1', beta: 1.5 },
  RENDERUSDT: { sector: 'AI', name: 'Render Network', tag: 'Decentralized GPU', beta: 1.65 },
  FETUSDT: { sector: 'AI', name: 'Artificial Superintelligence', tag: 'Autonomous AI Agents', beta: 1.75 },
  TAOUSDT: { sector: 'AI', name: 'Bittensor', tag: 'Subnet Intelligence', beta: 1.8 },

  // MEMES
  DOGEUSDT: { sector: 'MEME', name: 'Dogecoin', tag: 'OG Meme Leader', beta: 1.8 },
  SHIBUSDT: { sector: 'MEME', name: 'Shiba Inu', tag: 'Ecosystem Meme', beta: 1.9 },
  PEPEUSDT: { sector: 'MEME', name: 'Pepe', tag: 'High Beta Cult Meme', beta: 2.3 },
  WIFUSDT: { sector: 'MEME', name: 'Dogwifhat', tag: 'Solana Meme', beta: 2.2 },
  BONKUSDT: { sector: 'MEME', name: 'Bonk', tag: 'Solana Ecosystem Meme', beta: 2.1 },
  FLOKIUSDT: { sector: 'MEME', name: 'Floki', tag: 'Community Meme', beta: 2.0 },

  // TRADFI
  XAUUSDT: { sector: 'TRADFI', name: 'Gold / Ouro', tag: 'Physical Commodity', beta: 0.15 },
  PAXGUSDT: { sector: 'TRADFI', name: 'Pax Gold', tag: 'Tokenized Gold', beta: 0.15 }
};

export function getAssetSectorAndBeta(symbol: string): { sector: MarketSector; sectorName: string; categoryTag: string; beta: number } {
  const upper = (symbol || '').toUpperCase();
  if (ASSET_SECTOR_MAP[upper]) {
    const item = ASSET_SECTOR_MAP[upper];
    return {
      sector: item.sector,
      sectorName: SECTOR_METADATA[item.sector]?.name || item.sector,
      categoryTag: item.tag,
      beta: item.beta
    };
  }

  // Fallback heuristics
  if (upper.includes('PEPE') || upper.includes('DOGE') || upper.includes('SHIB') || upper.includes('WIF') || upper.includes('BONK') || upper.includes('MEME')) {
    return { sector: 'MEME', sectorName: 'Meme & High Beta', categoryTag: 'Meme Token', beta: 2.0 };
  }
  if (upper.includes('AI') || upper.includes('GPT') || upper.includes('RENDER') || upper.includes('FET') || upper.includes('TAO')) {
    return { sector: 'AI', sectorName: 'Inteligência Artificial', categoryTag: 'AI Computing', beta: 1.65 };
  }
  if (upper.includes('AAVE') || upper.includes('UNI') || upper.includes('LINK') || upper.includes('SWAP') || upper.includes('FINANCE')) {
    return { sector: 'DEFI', sectorName: 'DeFi & Lending', categoryTag: 'DeFi Protocol', beta: 1.25 };
  }
  if (upper.includes('XAU') || upper.includes('GOLD') || upper.includes('SPX') || upper.includes('DJI') || upper.includes('NDX')) {
    return { sector: 'TRADFI', sectorName: 'TradFi & Macro', categoryTag: 'Macro Asset', beta: 0.2 };
  }

  return { sector: 'L1_L2', sectorName: 'Layer 1 & Layer 2', categoryTag: 'Layer 1 / Layer 2', beta: 1.2 };
}

/**
 * Recalculates metrics for a single position based on live market price
 */
export function enrichPosition(
  pos: Partial<PortfolioPosition> & {
    id: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    currentPrice: number;
    quantity: number;
    leverage: number;
  }
): PortfolioPosition {
  const { sector, categoryTag, beta } = getAssetSectorAndBeta(pos.symbol);
  const entryPrice = Math.max(0.0000001, pos.entryPrice);
  const currentPrice = Math.max(0.0000001, pos.currentPrice);
  const quantity = Math.max(0.000001, pos.quantity);
  const leverage = Math.max(1, pos.leverage || 1);

  const notionalUsd = quantity * currentPrice;
  const marginUsd = notionalUsd / leverage;

  const isLong = pos.direction === 'LONG';
  const priceDiff = isLong ? currentPrice - entryPrice : entryPrice - currentPrice;
  const unrealizedPnl = quantity * priceDiff;
  const unrealizedPnlPct = ((priceDiff) / entryPrice) * 100;
  const roePct = (unrealizedPnl / marginUsd) * 100;

  // Delta: Linear dollar exposure to +1% price change
  // Long = +Notional, Short = -Notional
  const deltaUsd = isLong ? notionalUsd : -notionalUsd;
  const betaWeightedDeltaUsd = deltaUsd * beta;

  // Gamma: Rate of acceleration of Delta / curvature.
  // In leveraged futures with stops, Gamma reflects the proximity convexity to stop loss or breakout
  // Standard approximation: Gamma = (Notional * Leverage * 0.01) / max(0.02, distToStopPct)
  const distToStop = pos.stopLoss 
    ? Math.abs(currentPrice - pos.stopLoss) / currentPrice 
    : 0.05;
  const effectiveDist = Math.max(0.015, distToStop);
  const gammaUsd = (notionalUsd * 0.01 * beta) / effectiveDist;

  // Max loss if stop hit
  let maxLossAtStopUsd: number | undefined;
  if (pos.stopLoss) {
    const stopDiff = isLong ? pos.stopLoss - entryPrice : entryPrice - pos.stopLoss;
    maxLossAtStopUsd = Math.abs(quantity * stopDiff);
  }

  return {
    id: pos.id,
    symbol: pos.symbol,
    direction: pos.direction,
    entryPrice,
    currentPrice,
    quantity,
    notionalUsd,
    marginUsd,
    leverage,
    stopLoss: pos.stopLoss,
    takeProfit1: pos.takeProfit1,
    takeProfit2: pos.takeProfit2,
    unrealizedPnl,
    unrealizedPnlPct,
    roePct,
    sector: pos.sector || sector,
    categoryTag: pos.categoryTag || categoryTag,
    beta: pos.beta || beta,
    deltaUsd,
    betaWeightedDeltaUsd,
    gammaUsd,
    maxLossAtStopUsd,
    openedAt: pos.openedAt || Date.now(),
    isSyntheticFromSignal: pos.isSyntheticFromSignal,
    notes: pos.notes
  };
}

/**
 * Calculates complete aggregate portfolio risk metrics across all positions
 */
export function calculatePortfolioRisk(
  positions: PortfolioPosition[],
  portfolioEquity: number = 10000
): PortfolioRiskSummary {
  const equity = Math.max(100, portfolioEquity);
  
  if (positions.length === 0) {
    return {
      portfolioEquity: equity,
      grossNotionalUsd: 0,
      netDeltaUsd: 0,
      betaWeightedDeltaUsd: 0,
      portfolioBeta: 0,
      effectiveLeverage: 0,
      marginUtilizationPct: 0,
      totalUnrealizedPnlUsd: 0,
      totalUnrealizedPnlPct: 0,
      maxStopLossLossUsd: 0,
      maxStopLossLossPct: 0,
      portfolioGammaUsd: 0,
      gammaRiskLevel: 'LOW',
      var95DailyUsd: 0,
      var99DailyUsd: 0,
      directionalBias: 'NEUTRAL',
      sectorBreakdown: []
    };
  }

  let grossNotionalUsd = 0;
  let totalMarginUsd = 0;
  let netDeltaUsd = 0;
  let betaWeightedDeltaUsd = 0;
  let totalUnrealizedPnlUsd = 0;
  let maxStopLossLossUsd = 0;
  let portfolioGammaUsd = 0;

  // Sector breakdown collector
  const sectorMap: Record<MarketSector, {
    sector: MarketSector;
    positionsCount: number;
    grossNotionalUsd: number;
    netDeltaUsd: number;
    betaWeightedDeltaUsd: number;
    unrealizedPnlUsd: number;
    weightedBetaSum: number;
    longNotionalUsd: number;
    shortNotionalUsd: number;
  }> = {
    L1_L2: { sector: 'L1_L2', positionsCount: 0, grossNotionalUsd: 0, netDeltaUsd: 0, betaWeightedDeltaUsd: 0, unrealizedPnlUsd: 0, weightedBetaSum: 0, longNotionalUsd: 0, shortNotionalUsd: 0 },
    DEFI: { sector: 'DEFI', positionsCount: 0, grossNotionalUsd: 0, netDeltaUsd: 0, betaWeightedDeltaUsd: 0, unrealizedPnlUsd: 0, weightedBetaSum: 0, longNotionalUsd: 0, shortNotionalUsd: 0 },
    AI: { sector: 'AI', positionsCount: 0, grossNotionalUsd: 0, netDeltaUsd: 0, betaWeightedDeltaUsd: 0, unrealizedPnlUsd: 0, weightedBetaSum: 0, longNotionalUsd: 0, shortNotionalUsd: 0 },
    MEME: { sector: 'MEME', positionsCount: 0, grossNotionalUsd: 0, netDeltaUsd: 0, betaWeightedDeltaUsd: 0, unrealizedPnlUsd: 0, weightedBetaSum: 0, longNotionalUsd: 0, shortNotionalUsd: 0 },
    TRADFI: { sector: 'TRADFI', positionsCount: 0, grossNotionalUsd: 0, netDeltaUsd: 0, betaWeightedDeltaUsd: 0, unrealizedPnlUsd: 0, weightedBetaSum: 0, longNotionalUsd: 0, shortNotionalUsd: 0 },
    ALL: { sector: 'ALL', positionsCount: 0, grossNotionalUsd: 0, netDeltaUsd: 0, betaWeightedDeltaUsd: 0, unrealizedPnlUsd: 0, weightedBetaSum: 0, longNotionalUsd: 0, shortNotionalUsd: 0 },
    FAVORITES: { sector: 'FAVORITES', positionsCount: 0, grossNotionalUsd: 0, netDeltaUsd: 0, betaWeightedDeltaUsd: 0, unrealizedPnlUsd: 0, weightedBetaSum: 0, longNotionalUsd: 0, shortNotionalUsd: 0 }
  };

  positions.forEach(p => {
    grossNotionalUsd += p.notionalUsd;
    totalMarginUsd += p.marginUsd;
    netDeltaUsd += p.deltaUsd;
    betaWeightedDeltaUsd += p.betaWeightedDeltaUsd;
    totalUnrealizedPnlUsd += p.unrealizedPnl;
    portfolioGammaUsd += p.gammaUsd;

    if (p.maxLossAtStopUsd) {
      maxStopLossLossUsd += p.maxLossAtStopUsd;
    } else {
      // Default fallback: 3% adverse move
      maxStopLossLossUsd += p.notionalUsd * 0.03;
    }

    const sec = sectorMap[p.sector] || sectorMap.L1_L2;
    sec.positionsCount += 1;
    sec.grossNotionalUsd += p.notionalUsd;
    sec.netDeltaUsd += p.deltaUsd;
    sec.betaWeightedDeltaUsd += p.betaWeightedDeltaUsd;
    sec.unrealizedPnlUsd += p.unrealizedPnl;
    sec.weightedBetaSum += p.beta * p.notionalUsd;

    if (p.direction === 'LONG') {
      sec.longNotionalUsd += p.notionalUsd;
    } else {
      sec.shortNotionalUsd += p.notionalUsd;
    }
  });

  const effectiveLeverage = equity > 0 ? grossNotionalUsd / equity : 0;
  const marginUtilizationPct = equity > 0 ? (totalMarginUsd / equity) * 100 : 0;
  const totalUnrealizedPnlPct = equity > 0 ? (totalUnrealizedPnlUsd / equity) * 100 : 0;
  const maxStopLossLossPct = equity > 0 ? (maxStopLossLossUsd / equity) * 100 : 0;

  // Aggregate portfolio beta (weighted by notional)
  const portfolioBeta = grossNotionalUsd > 0
    ? Math.abs(betaWeightedDeltaUsd / (netDeltaUsd || 1))
    : 1.0;

  // Parametric Value at Risk (1-day)
  // Assuming BTC daily vol ~ 3.5%, portfolio daily vol = 3.5% * portfolioBeta
  const assumedDailyBtcVol = 0.035;
  const portfolioDailyVol = assumedDailyBtcVol * Math.max(0.2, portfolioBeta);
  // VaR 95% = 1.645 * Vol * Net Delta; VaR 99% = 2.326 * Vol * Net Delta
  const absDelta = Math.abs(betaWeightedDeltaUsd);
  const var95DailyUsd = absDelta * portfolioDailyVol * 1.645;
  const var99DailyUsd = absDelta * portfolioDailyVol * 2.326;

  // Directional Bias
  const deltaRatio = equity > 0 ? netDeltaUsd / equity : 0;
  let directionalBias: PortfolioRiskSummary['directionalBias'] = 'NEUTRAL';
  if (deltaRatio >= 0.5) directionalBias = 'HEAVY_LONG';
  else if (deltaRatio >= 0.15) directionalBias = 'MODERATE_LONG';
  else if (deltaRatio <= -0.5) directionalBias = 'HEAVY_SHORT';
  else if (deltaRatio <= -0.15) directionalBias = 'MODERATE_SHORT';

  // Gamma Risk Level
  // Ratio of Gamma to Equity
  const gammaToEquity = equity > 0 ? portfolioGammaUsd / equity : 0;
  let gammaRiskLevel: PortfolioRiskSummary['gammaRiskLevel'] = 'LOW';
  if (gammaToEquity > 0.4) gammaRiskLevel = 'HIGH';
  else if (gammaToEquity > 0.2) gammaRiskLevel = 'ELEVATED';
  else if (gammaToEquity > 0.08) gammaRiskLevel = 'MODERATE';

  // Build sector list (only sectors with exposure)
  const activeSectors: MarketSector[] = ['L1_L2', 'DEFI', 'AI', 'MEME', 'TRADFI'];
  const sectorBreakdown: SectorRiskExposure[] = activeSectors
    .map(secKey => {
      const data = sectorMap[secKey];
      const grossNotionalPct = grossNotionalUsd > 0 ? (data.grossNotionalUsd / grossNotionalUsd) * 100 : 0;
      const avgBeta = data.grossNotionalUsd > 0 ? data.weightedBetaSum / data.grossNotionalUsd : SECTOR_METADATA[secKey].defaultBeta;
      return {
        sector: secKey,
        sectorName: SECTOR_METADATA[secKey].name,
        positionsCount: data.positionsCount,
        grossNotionalUsd: data.grossNotionalUsd,
        grossNotionalPct,
        netDeltaUsd: data.netDeltaUsd,
        betaWeightedDeltaUsd: data.betaWeightedDeltaUsd,
        unrealizedPnlUsd: data.unrealizedPnlUsd,
        avgBeta,
        longNotionalUsd: data.longNotionalUsd,
        shortNotionalUsd: data.shortNotionalUsd,
        concentrationWarning: grossNotionalPct >= 40 && data.positionsCount > 0
      };
    })
    .filter(s => s.positionsCount > 0 || s.grossNotionalUsd > 0)
    .sort((a, b) => b.grossNotionalUsd - a.grossNotionalUsd);

  return {
    portfolioEquity: equity,
    grossNotionalUsd,
    netDeltaUsd,
    betaWeightedDeltaUsd,
    portfolioBeta,
    effectiveLeverage,
    marginUtilizationPct,
    totalUnrealizedPnlUsd,
    totalUnrealizedPnlPct,
    maxStopLossLossUsd,
    maxStopLossLossPct,
    portfolioGammaUsd,
    gammaRiskLevel,
    var95DailyUsd,
    var99DailyUsd,
    directionalBias,
    sectorBreakdown
  };
}

/**
 * Stress test / macro shock simulation
 * Simulates an across-the-board market shock in % (e.g. -10%, -5%, +5%, +10%)
 */
export function simulatePortfolioShock(
  positions: PortfolioPosition[],
  portfolioEquity: number,
  shockPct: number
): {
  shockPct: number;
  estimatedPnlUsd: number;
  estimatedPnlPct: number;
  newEquity: number;
  stoppedOutCount: number;
  positionsOutcome: Array<{
    symbol: string;
    direction: 'LONG' | 'SHORT';
    assetShiftPct: number;
    pnlImpactUsd: number;
    stoppedOut: boolean;
  }>;
} {
  let estimatedPnlUsd = 0;
  let stoppedOutCount = 0;

  const positionsOutcome = positions.map(pos => {
    // Asset shift = market shock * position beta
    const assetShiftPct = shockPct * pos.beta;
    const isLong = pos.direction === 'LONG';
    const rawPriceShift = pos.currentPrice * (assetShiftPct / 100);
    const simulatedPrice = Math.max(0.000001, pos.currentPrice + rawPriceShift);

    // Check if stop loss would trigger
    let stoppedOut = false;
    let positionPnl = 0;

    if (pos.stopLoss) {
      if (isLong && simulatedPrice <= pos.stopLoss) {
        stoppedOut = true;
        // PnL capped at stop loss
        const stopDiff = pos.stopLoss - pos.entryPrice;
        positionPnl = pos.quantity * stopDiff;
      } else if (!isLong && simulatedPrice >= pos.stopLoss) {
        stoppedOut = true;
        const stopDiff = pos.entryPrice - pos.stopLoss;
        positionPnl = pos.quantity * stopDiff;
      }
    }

    if (!stoppedOut) {
      const pnlDiff = isLong ? simulatedPrice - pos.entryPrice : pos.entryPrice - simulatedPrice;
      positionPnl = pos.quantity * pnlDiff;
    } else {
      stoppedOutCount++;
    }

    // Impact relative to current unrealized PnL
    const pnlImpactUsd = positionPnl - pos.unrealizedPnl;
    estimatedPnlUsd += pnlImpactUsd;

    return {
      symbol: pos.symbol,
      direction: pos.direction,
      assetShiftPct,
      pnlImpactUsd,
      stoppedOut
    };
  });

  const estimatedPnlPct = portfolioEquity > 0 ? (estimatedPnlUsd / portfolioEquity) * 100 : 0;
  const newEquity = Math.max(0, portfolioEquity + estimatedPnlUsd);

  return {
    shockPct,
    estimatedPnlUsd,
    estimatedPnlPct,
    newEquity,
    stoppedOutCount,
    positionsOutcome
  };
}

/**
 * Converts an active TradeSignal into a simulated PortfolioPosition
 */
export function convertSignalToPosition(
  signal: TradeSignal,
  ticker?: TickerData,
  simulatedMarginUsd: number = 250,
  leverage: number = 10
): PortfolioPosition {
  const currentPrice = ticker?.price || signal.currentPrice || (signal.entryZone ? (signal.entryZone[0] + signal.entryZone[1]) / 2 : 100);
  const entryPrice = signal.entryZone ? (signal.entryZone[0] + signal.entryZone[1]) / 2 : currentPrice;
  const notionalUsd = simulatedMarginUsd * leverage;
  const quantity = notionalUsd / entryPrice;

  return enrichPosition({
    id: `pos-signal-${signal.id}`,
    symbol: signal.symbol,
    direction: signal.direction,
    entryPrice,
    currentPrice,
    quantity,
    leverage,
    stopLoss: signal.stopLoss,
    takeProfit1: signal.target1,
    takeProfit2: signal.target2,
    openedAt: signal.createdAt || Date.now(),
    isSyntheticFromSignal: true,
    notes: `Gerado a partir do Sinal ${signal.signalType} (${signal.timeframe} · Confluência ${signal.confluenceScore}%)`
  });
}

/**
 * Default initial sample positions for demonstration and testing if user has no positions yet
 */
export function getInitialSeedPositions(tickers: TickerData[]): PortfolioPosition[] {
  const getPrice = (sym: string, fallback: number) => {
    const t = tickers.find(i => i.symbol === sym);
    return t ? t.price : fallback;
  };

  const seedConfigs: Array<{
    symbol: string;
    direction: 'LONG' | 'SHORT';
    entryRatio: number;
    margin: number;
    leverage: number;
    stopOffsetPct: number;
    tp1OffsetPct: number;
    notes: string;
  }> = [
    {
      symbol: 'BTCUSDT',
      direction: 'LONG',
      entryRatio: 0.988,
      margin: 1000,
      leverage: 10,
      stopOffsetPct: 0.02,
      tp1OffsetPct: 0.04,
      notes: 'Hedge core spot & rompimento de POC institucional'
    },
    {
      symbol: 'ETHUSDT',
      direction: 'LONG',
      entryRatio: 0.992,
      margin: 500,
      leverage: 10,
      stopOffsetPct: 0.025,
      tp1OffsetPct: 0.05,
      notes: 'Reversão em Golden Pocket Fibo 0.618'
    },
    {
      symbol: 'SOLUSDT',
      direction: 'LONG',
      entryRatio: 0.985,
      margin: 400,
      leverage: 8,
      stopOffsetPct: 0.03,
      tp1OffsetPct: 0.065,
      notes: 'Acúmulo de CVD positivo e expansão de Open Interest'
    },
    {
      symbol: 'LINKUSDT',
      direction: 'SHORT',
      entryRatio: 1.015,
      margin: 300,
      leverage: 5,
      stopOffsetPct: 0.028,
      tp1OffsetPct: 0.05,
      notes: 'Hedge tático de setor DeFi contra resistência semanal'
    },
    {
      symbol: 'PEPEUSDT',
      direction: 'LONG',
      entryRatio: 0.978,
      margin: 200,
      leverage: 5,
      stopOffsetPct: 0.045,
      tp1OffsetPct: 0.09,
      notes: 'Scalp de momentum de alta beta com rompimento de VAH'
    },
    {
      symbol: 'NEARUSDT',
      direction: 'SHORT',
      entryRatio: 1.02,
      margin: 250,
      leverage: 6,
      stopOffsetPct: 0.035,
      tp1OffsetPct: 0.06,
      notes: 'Arbitragem de Funding Rate extremo e divergência de CVD'
    }
  ];

  return seedConfigs.map((cfg, idx) => {
    const curPrice = getPrice(cfg.symbol, 100);
    const entryPrice = curPrice * cfg.entryRatio;
    const notional = cfg.margin * cfg.leverage;
    const quantity = notional / entryPrice;

    const isLong = cfg.direction === 'LONG';
    const stopLoss = isLong ? entryPrice * (1 - cfg.stopOffsetPct) : entryPrice * (1 + cfg.stopOffsetPct);
    const takeProfit1 = isLong ? entryPrice * (1 + cfg.tp1OffsetPct) : entryPrice * (1 - cfg.tp1OffsetPct);

    return enrichPosition({
      id: `seed-pos-${idx + 1}-${cfg.symbol.toLowerCase()}`,
      symbol: cfg.symbol,
      direction: cfg.direction,
      entryPrice,
      currentPrice: curPrice,
      quantity,
      leverage: cfg.leverage,
      stopLoss,
      takeProfit1,
      openedAt: Date.now() - (idx + 1) * 3600000 * 4,
      notes: cfg.notes
    });
  });
}
