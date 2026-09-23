export type MarketType = 'crypto_futures' | 'crypto_spot' | 'tradfi';
export type TradingProfile = 'scalp' | 'daytrade' | 'intraday' | 'swing';

export interface TickerData {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  name: string;
  marketType: MarketType;
  price: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  
  // Moving Average & Trend Deviations
  ma24h?: number;                   // 24h Simple/Weighted Moving Average price
  ma24hDeviationPct?: number;       // % deviation: ((price - ma24h) / ma24h) * 100
  
  // Futures / Advanced Metrics
  openInterest: number;             // USDT or Contract volume
  openInterestChange24h: number;     // % change
  openInterestChange1h: number;      // % change
  fundingRate: number;              // e.g. 0.0001 (0.01% atual / ciclo)
  fundingRateDaily: number;         // e.g. 0.0003 (0.03% diário - 3 ciclos)
  fundingRateAnnualized: number;    // % annualized
  fundingRateAnalysis?: {
    status: 'EXTREME_POSITIVE' | 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'EXTREME_NEGATIVE';
    pressure: 'PRESSÃO COMPRADORA EXTREMA (RISCO LONG FLUSH)' | 'PRESSÃO COMPRADORA MODERADA' | 'NEUTRO / EQUILIBRADO' | 'PRESSÃO VENDEDORA MODERADA' | 'PRESSÃO VENDEDORA EXTREMA (POTENCIAL SHORT SQUEEZE)';
    bias: 'BUY' | 'SELL' | 'NEUTRAL';
    description: string;
  };
  cvd: number;                      // Cumulative Volume Delta (USDT)
  cvdDelta: number;                 // Variação / Delta líquido da vela mais recente (USDT)
  cvdDeltaPercent: number;          // Variação / Delta % do volume taker (+/- %)
  cvdDirection: 'BUY' | 'SELL' | 'NEUTRAL';
  takerBuyRatio: number;            // 0.0 to 1.0
  
  // Technical Indicators
  fibonacci: {
    fib0?: number;                  // 0.0 level (End of range / 0)
    fib236?: number;                // 0.236 level
    fib382?: number;                // 0.382 level
    fib50: number;                  // 0.50 level
    fib618: number;                 // 0.618 level (Golden Pocket)
    fib68: number;                  // 0.68 level
    fib786?: number;                // 0.786 level
    fib100?: number;                // 1.0 (100%) level (Start of range / 1)
    swingHigh: number;
    swingLow: number;
    inGoldenPocket: boolean;        // Is price in [0.618 - 0.68]
    trend?: 'UP' | 'DOWN';          // 'UP' (LL 1 -> HH 0) or 'DOWN' (HH 1 -> LL 0)
    point1Price?: number;           // Price at point 1 (Swing Start)
    point0Price?: number;           // Price at point 0 (Swing End)
    point1Label?: string;           // e.g. '1 (739.89)' or '1 (713.10)'
    point0Label?: string;           // e.g. '0 (713.10)' or '0 (728.50)'
    point1Type?: 'HH' | 'LL';       // Point 1 structure type
    point0Type?: 'HH' | 'LL';       // Point 0 structure type
  };
  
  rangeProfile: {
    vah: number;                    // Value Area High
    val: number;                    // Value Area Low
    poc: number;                    // Point of Control
    inValueArea: boolean;
  };
  
  keyLevels: {
    support1: number;
    support2: number;
    resistance1: number;
    resistance2: number;
    structureBreak: 'BULLISH' | 'BEARISH' | 'NONE';
    hasSinglePrintFVG: boolean;
    fvgZone?: { top: number; bottom: number; type: 'BULLISH' | 'BEARISH' };
  };
  
  // Institutional Order Flow & Trapped Traders
  longShortData?: LongShortRatioData;
  trappedTraders?: TrappedTradersData;
  
  // Confluence & Signal
  confluenceScore: number;          // 0 to 100
  signalType: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  signalReason: string;
  confluenceFactors: string[];
  
  updatedAt: number;                // timestamp
}

export interface LongShortRatioData {
  symbol: string;
  globalRatio: number;               // Long / Short ratio of all accounts (e.g. 1.85)
  longAccountPct: number;            // % of long accounts (e.g. 64.9%)
  shortAccountPct: number;           // % of short accounts (e.g. 35.1%)
  topTraderAccountRatio: number;     // Top trader accounts ratio
  topTraderPositionRatio: number;    // Top trader positions ratio (weighted by volume)
  topTraderLongPositionPct: number;  // % of top trader positions in Long
  topTraderShortPositionPct: number; // % of top trader positions in Short
  takerRatio: number;                // Taker Buy / Taker Sell volume ratio
  takerBuyVolUsd: number;            // Taker Buy volume in USD
  takerSellVolUsd: number;           // Taker Sell volume in USD
  timestamp: number;
}

export interface LiquidationEvent {
  symbol: string;
  side: 'BUY' | 'SELL';              // BUY = Short liquidated (forced buy), SELL = Long liquidated (forced sell)
  price: number;
  qty: number;
  usdValue: number;
  timestamp: number;
}

export interface LiquidationSummary {
  totalBuyLiqUSD: number;            // Shorts forced to buy (Short Liquidations)
  totalSellLiqUSD: number;           // Longs forced to sell (Long Liquidations)
  netLiqUSD: number;                 // buyLiq - sellLiq
  recentEvents: LiquidationEvent[];
  lastSpikeAt?: number;
}

export interface TrappedTradersData {
  status: 'TRAPPED_LONGS' | 'TRAPPED_SHORTS' | 'BALANCED';
  trappedIndex: number;              // 0 to 100 (Trapped Traders Index - TTI)
  trappedSide: 'LONG' | 'SHORT' | 'NONE';
  trappedPriceZone: [number, number]; // [min, max] zone where aggressive traders are trapped
  trappedPocPrice: number;           // VWAP / POC of the trap candle cluster
  trappedVolumeUSD: number;          // Estimated trapped open interest / volume in USD
  absorptionRatio: number;           // 0 to 100% (Wyckoff Effort vs Result absorption score)
  divergenceType: 'BEARISH_ABSORPTION' | 'BULLISH_ABSORPTION' | 'NONE';
  crowdSentiment: 'EXTREME_GREED' | 'BULLISH_CROWD' | 'NEUTRAL' | 'BEARISH_CROWD' | 'EXTREME_FEAR';
  smartMoneyBias: 'ACCUMULATING_SHORTS' | 'ACCUMULATING_LONGS' | 'NEUTRAL';
  confluenceVerdict: string;         // Human readable institutional diagnostic
  liquidationsSummary: LiquidationSummary;
  updatedAt: number;
}

export interface OrderBookLevel {
  price: number;
  qty: number;
  totalQty: number;
  totalUsd: number;
  deviationPct: number;
  isWall?: boolean;
}

export interface OrderBookDepthData {
  symbol: string;
  timestamp: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPct: number;
  midPrice: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  totalDepthUsd: number;
  imbalancePct: number;       // e.g. +24.5% (bids outweigh asks) or -18.2%
  imbalanceRatio: number;     // bids / asks ratio
  pressureLabel: string;      // e.g. "PRESSÃO COMPRADORA FORTE"
  pressureBias: 'BUY' | 'SELL' | 'NEUTRAL';
  whaleWalls: {
    bidWall?: OrderBookLevel;
    askWall?: OrderBookLevel;
  };
}

export interface KlineCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  takerBuyVolume: number;
  quoteVolume?: number;
}

export type StrategyCategory = 'SCALP' | 'DAY_TRADE' | 'INTRADAY' | 'SWING' | 'POSITION' | 'COUNTER_TRADE' | 'CUSTOM';

export interface TradeSignal {
  id: string;
  symbol: string;
  marketType: MarketType;
  signalType: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  direction: 'LONG' | 'SHORT';
  strategyCategory?: StrategyCategory;
  entryZone: [number, number];       // [min, max]
  currentPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskRewardRatio: number;
  confluenceScore: number;
  confluenceFactors: string[];
  timeframe: string;
  aiReview?: string;
  aiConfidence?: number;            // 0 to 100
  
  // 1m & 5m Multi-Timeframe Signal Validation
  validationStatus: 'PENDING_VALIDATION' | 'CONFIRMED' | 'REJECTED_SPIKE' | 'REJECTED_BACKTEST';
  validationStage: string;           // e.g. "Sustentado em 1m / Confirmado em 5m"
  candle1mConfirmed: boolean;
  candle5mConfirmed: boolean;
  backtestConfidence?: number;
  backtestWinRate?: number;
  backtestProfitFactor?: number;
  validationDetails?: {
    sustainSeconds: number;
    candle5mDirection: 'LONG' | 'SHORT' | 'NEUTRAL';
    spikeDetected: boolean;
    rejectionReason?: string;
  };

  createdAt: number;                // Data e hora de identificação do sinal
  validatedAt?: number;             // Data e hora de validação/confirmação
  rejectedAt?: number;              // Data e hora de rejeição/descarte
  status: 'ACTIVE' | 'TARGET_REACHED' | 'STOPPED_OUT' | 'EXPIRED';
}

export type StrategyKey = 'scalp' | 'daytrade' | 'intraday' | 'swing' | 'position' | 'counter' | 'custom';

export interface StrategyConfigItem {
  key: StrategyKey;
  label: string;
  enabled: boolean;
  category: StrategyCategory;
  timeframe: string;
  candles: number;
  minRiskRewardRatio: number;
  volumeSurgeWeight: number;
  openInterestWeight: number;
  fundingRateWeight: number;
  cvdImbalanceWeight: number;
  fibonacciZoneWeight: number;
  rangePocWeight: number;
  supportResistanceWeight: number;
  volumeProfileRange: number;
  trappedTradersWeight?: number;
}

export interface IndicatorWeights {
  activeStrategy?: 'scalp' | 'daytrade' | 'intraday' | 'swing' | 'position' | 'counter' | 'custom';
  strategyLabel?: string;
  multiStrategyMode?: boolean;       // Se true, roda todas as estratégias habilitadas concorrentemente
  enabledStrategies?: StrategyKey[];  // Lista de estratégias ativas em paralelo no motor
  strategyConfigs?: Partial<Record<StrategyKey, StrategyConfigItem>>;
  volumeSurgeWeight: number;        // default 15
  openInterestWeight: number;       // default 20
  fundingRateWeight: number;        // default 10
  cvdImbalanceWeight: number;       // default 20
  fibonacciZoneWeight: number;      // default 15
  rangePocWeight: number;           // default 10
  supportResistanceWeight: number; // default 10
  trappedTradersWeight?: number;    // default 25 (para contra-trade / fade de absorção)
  minRiskRewardRatio: number;       // default 2.5
  volumeProfileRange: number;       // default 50 (resolução em linhas/bins de preço)
  volumeProfileTimeframe?: string;  // default '30m'
  volumeProfileCandles?: number;    // default 48 (48 * 30m = 24h)
}

export interface AIReviewResponse {
  symbol: string;
  decision: 'CONFIRM' | 'ADJUST' | 'REJECT';
  reasoning: string;
  recommendedDirection: 'LONG' | 'SHORT' | 'NEUTRAL';
  entryZone: [number, number];
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  confidenceScore: number;
  modelUsed: string;
  timestamp: number;
}

export interface AIAuditReport {
  timestamp: number;
  marketOverview: string;
  topOpportunities: string[];
  riskWarnings: string[];
  suggestedWeightAdjustments: IndicatorWeights;
  modelUsed: string;
}

export interface BotState {
  isMonitoring: boolean;
  activeTickersCount: number;
  lastTickTime: number;
  ticksProcessed: number;
  signalsGenerated24h: number;
  weights: IndicatorWeights;
  aiModels: AIModelConfig[];
  aiAnalysisEnabled: boolean;
}

export interface AILogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  type: 'TEST_CONNECTION' | 'SIGNAL_REVIEW' | 'MARKET_AUDIT' | 'CHAT_AGENT' | 'MODEL_CONFIG';
  provider: 'gemini' | 'local' | 'openai' | 'openrouter' | 'anthropic' | 'system';
  modelId: string;
  modelName?: string;
  message: string;
  durationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costEstimate?: number;
  details?: {
    fullPrompt?: string;
    fullResponse?: string;
    promptSnippet?: string;
    outputSnippet?: string;
    apiUrl?: string;
    apiKeyPresent?: boolean;
    errorStack?: string;
    diagnosticSteps?: string[];
    [key: string]: unknown;
  };
}

export type AIProvider = 'gemini' | 'openai' | 'openrouter' | 'anthropic' | 'local';

export interface AIModelConfig {
  id: string;
  name: string;
  provider: AIProvider;
  modelId: string;
  apiKey?: string;
  apiUrl?: string;
  isActive: boolean;
  isFallback: boolean;
  priority: number;
  rateLimit: {
    maxReqPerMinute: number;
    maxReqPerDay: number;
  };
  parameters: {
    temperature: number;
    maxTokens: number;
    topP?: number;
    topK?: number;
    systemInstruction?: string;
  };
}

export interface BacktestConfig {
  symbol: string;
  days: number;
  profile: TradingProfile;
  weights: IndicatorWeights;
}

export interface EquityPoint {
  time: number;
  balance: number;
  drawdown: number;
}

export interface BacktestDiagnostic {
  strengths: string[];
  weaknesses: string[];
  weightAnalysis: string[];
  suggestions: string[];
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  pnlPct: number;
  pnlValue: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  isWin: boolean;
  durationMinutes: number;
}

export interface BacktestResult {
  id: string;
  symbol: string;
  profile: TradingProfile;
  strategyId: string;
  startTime: number;
  endTime: number;
  totalCandlesTested: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  netProfit: number;
  avgWinPct: number;
  avgLossPct: number;
  avgRiskReward: number;
  avgDurationMinutes: number;
  equityCurve: EquityPoint[];
  diagnostic: BacktestDiagnostic;
  config: BacktestConfig;
  createdAt: number;
  trades?: BacktestTrade[];
  sharpeRatio?: number;
  sortinoRatio?: number;
  makerTakerFeePct?: number;
  slippagePct?: number;
  grossProfit?: number;
  totalFeesPaid?: number;
}

export interface LiquidityBucket {
  priceMin: number;
  priceMax: number;
  priceCenter: number;
  volume: number;
  density: number; // 0.0 to 1.0
  isHighVolumeNode: boolean;
  isLowVolumeNode: boolean;
  isSupplyZone: boolean;
  isDemandZone: boolean;
  isPOC: boolean;
}

export interface LiquidityHeatmapData {
  buckets: LiquidityBucket[];
  pocBucket: LiquidityBucket | null;
  topSupplyCluster: { min: number; max: number; volume: number } | null;
  topDemandCluster: { min: number; max: number; volume: number } | null;
  maxBucketVolume: number;
}

export interface AIPersona {
  id: string;
  name: string;
  description: string;
  systemPromptAddendum: string;
  riskTolerance: 'HIGH' | 'MEDIUM' | 'LOW';
  preferredTimeframes: string[];
  minRRRatio: number;
}

export interface AutoTuneIteration {
  iteration: number;
  winRate: number;
  profitFactor: number;
  netProfit: number;
  maxDrawdown: number;
  fitnessScore: number;
  weights: IndicatorWeights;
}

export interface AutoTuneResult {
  symbol: string;
  profile: TradingProfile;
  iterations: number;
  bestWeights: IndicatorWeights;
  initialResult: BacktestResult;
  bestResult: BacktestResult;
  fitnessHistory: AutoTuneIteration[];
  tuningSummary: string;
  createdAt: number;
}

// ============================================
// MARKET SCREENER & DYNAMIC UNIVERSE TYPES
// ============================================

export type MarketSector = 'ALL' | 'FAVORITES' | 'L1_L2' | 'DEFI' | 'MEME' | 'AI' | 'TRADFI';

export type ScreenerMode = 'HYBRID' | 'FAVORITES_ONLY' | 'TOP_SCREENER';

export interface ScreenerAsset {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  name: string;
  price: number;
  priceChangePercent24h: number;
  volume24h: number;
  quoteVolume24h: number;
  high24h: number;
  low24h: number;
  openInterest: number;
  openInterestChange1h: number;
  openInterestChange24h: number;
  fundingRate: number;
  fundingRateAnnualized: number;
  rvol: number;                     // Relative Volume vs standard
  compositeScore: number;           // 0 to 100 ranking score
  isFavorite: boolean;              // User pinned/favorite
  isMonitored: boolean;             // Currently in the active 4s scan universe
  monitoringReason: 'FAVORITE' | 'SCREENER_TOP' | 'ACTIVE_TRADE' | 'TRADFI_MACRO' | 'NONE';
  sector: MarketSector;
  categoryTag?: string;
  lastScannedAt: number;
}

export interface ScreenerSettings {
  mode: ScreenerMode;
  maxMonitoredDynamicAssets: number; // e.g. 6 to 12
  minVolume24hUsd: number;           // e.g. 25_000_000
  rescanIntervalMinutes: number;     // e.g. 15, 30, 60
  includeMemes: boolean;
  minPriceChangeFilter: number;      // e.g. 0% or 1.5%
  weights: {
    rvolWeight: number;              // 0 to 100
    oiChangeWeight: number;          // 0 to 100
    priceMomentumWeight: number;     // 0 to 100
    fundingAnomalyWeight: number;    // 0 to 100
  };
  lastRescanTimestamp: number;
}

export interface ScreenerScanSummary {
  totalAssetsAvailable: number;
  totalMonitored: number;
  favoritesCount: number;
  dynamicCount: number;
  topGainer: { symbol: string; change: number };
  topVolume: { symbol: string; quoteVolume: number };
  topOiSurge: { symbol: string; oiChange: number };
  highestFundingRate: { symbol: string; rate: number };
  lastScanDurationMs: number;
  timestamp: number;
}

export interface UserPriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'CROSS_ABOVE' | 'CROSS_BELOW';
  note?: string;
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
  active: boolean;
}

export type AlertSoundProfile = 'SYNTH_CHIME' | 'RADAR_BEEP' | 'CRYSTAL_BELL' | 'CYBER_PULSE' | 'ZEN_GONG';

export interface AlertAudioConfig {
  enabled: boolean;
  volume: number; // 0 to 1
  profile: AlertSoundProfile;
}

// ============================================
// PORTFOLIO & RISK EXPOSURE DASHBOARD TYPES
// ============================================

export interface PortfolioPosition {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  notionalUsd: number;
  marginUsd: number;
  leverage: number;
  stopLoss?: number;
  takeProfit1?: number;
  takeProfit2?: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  roePct: number;
  sector: MarketSector;
  categoryTag?: string;
  beta: number;
  deltaUsd: number;
  betaWeightedDeltaUsd: number;
  gammaUsd: number;
  maxLossAtStopUsd?: number;
  openedAt: number;
  isSyntheticFromSignal?: boolean;
  notes?: string;
}

export interface SectorRiskExposure {
  sector: MarketSector;
  sectorName: string;
  positionsCount: number;
  grossNotionalUsd: number;
  grossNotionalPct: number;
  netDeltaUsd: number;
  betaWeightedDeltaUsd: number;
  unrealizedPnlUsd: number;
  avgBeta: number;
  longNotionalUsd: number;
  shortNotionalUsd: number;
  concentrationWarning: boolean;
}

export interface PortfolioRiskSummary {
  portfolioEquity: number;
  grossNotionalUsd: number;
  netDeltaUsd: number;
  betaWeightedDeltaUsd: number;
  portfolioBeta: number;
  effectiveLeverage: number;
  marginUtilizationPct: number;
  totalUnrealizedPnlUsd: number;
  totalUnrealizedPnlPct: number;
  maxStopLossLossUsd: number;
  maxStopLossLossPct: number;
  portfolioGammaUsd: number;
  gammaRiskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH';
  var95DailyUsd: number;
  var99DailyUsd: number;
  directionalBias: 'HEAVY_LONG' | 'MODERATE_LONG' | 'NEUTRAL' | 'MODERATE_SHORT' | 'HEAVY_SHORT';
  sectorBreakdown: SectorRiskExposure[];
}

// ==========================================
// SMART VOLUME SCREENER TYPES
// ==========================================

export type VolumeSpikeTimeframe = '1h' | '4h' | '1d';

export type VolumeAnomalyType = 
  | 'WHALE_ACCUMULATION'    // Strong price support/rise with high buy CVD and high volume
  | 'BREAKOUT_SURGE'        // Heavy volume breaking resistance with momentum
  | 'PANIC_DUMP'            // Aggressive selling volume breaking supports
  | 'EXHAUSTION_CLIMAX'     // Giant volume spike at extreme high/low with stalling price
  | 'UNUSUAL_EXPANSION';    // Relative volume spike without clear directional bias

export interface TimeframeVolumeMetrics {
  timeframe: VolumeSpikeTimeframe;
  rvol: number;                  // Relative volume vs baseline (e.g. 2.45 = 245% of average)
  volumeUsd: number;             // Estimated volume in USD for this timeframe
  baselineAvgUsd: number;        // Normal expected volume in USD
  isAnomaly: boolean;            // Whether rvol exceeds threshold
  deltaPressure: 'BUY' | 'SELL' | 'NEUTRAL';
  takerRatio: number;            // 0 to 1
  zScore: number;                // Statistical deviation standard deviations (e.g. +3.2σ)
  changePct: number;             // Price change in this timeframe window
}

export interface VolumeSpikeAlert {
  id: string;
  symbol: string;
  name: string;
  marketType: MarketType;
  currentPrice: number;
  priceChangePercent24h: number;
  timeframes: {
    '1h': TimeframeVolumeMetrics;
    '4h': TimeframeVolumeMetrics;
    '1d': TimeframeVolumeMetrics;
  };
  compositeRvol: number;         // Weighted multi-timeframe R-Vol
  maxRvol: number;               // Highest single R-Vol across 1h, 4h, 1d
  dominantTimeframe: VolumeSpikeTimeframe;
  anomalyType: VolumeAnomalyType;
  anomalyTitle: string;
  anomalyDescription: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  cvdDirection: 'BUY' | 'SELL' | 'NEUTRAL';
  cvdDeltaUsd: number;
  openInterestChange1h?: number;
  detectedAt: number;
  confluenceFactors: string[];
  investigationChecklist: string[];
}

export interface VolumeScreenerFilterOptions {
  timeframe: 'all' | VolumeSpikeTimeframe;
  minRvol: number;
  anomalyType: 'all' | VolumeAnomalyType;
  marketType: 'all' | MarketType;
  urgency: 'all' | 'HIGH' | 'MEDIUM';
  searchQuery: string;
  sortBy: 'rvol_desc' | 'volume_desc' | 'price_change_desc' | 'cvd_desc' | 'urgency_desc';
}


export type ChartPatternType = 
  | 'BULL_FLAG'
  | 'BEAR_FLAG'
  | 'FALLING_WEDGE'
  | 'RISING_WEDGE'
  | 'ASCENDING_TRIANGLE'
  | 'DESCENDING_TRIANGLE'
  | 'DOUBLE_BOTTOM'
  | 'DOUBLE_TOP'
  | 'CUP_AND_HANDLE'
  | 'HEAD_AND_SHOULDERS'
  | 'INVERSE_HEAD_AND_SHOULDERS';

export type PatternBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type PatternCategory = 'CONTINUATION' | 'REVERSAL' | 'BREAKOUT';
export type PatternStage = 'FORMING' | 'READY_BREAKOUT' | 'CONFIRMED' | 'NEAR_TARGET';

export interface DetectedChartPattern {
  id: string;
  type: ChartPatternType;
  name: string;
  shortName: string;
  iconName?: string;
  bias: PatternBias;
  category: PatternCategory;
  stage: PatternStage;
  confidence: number;                  // 0 to 100
  timeframe: string;                   // e.g. "15m - 1h"
  breakoutTriggerPrice: number;        // Price level that triggers or confirms pattern
  measuredMoveTarget: number;          // Theoretical price target after breakout
  targetGainPct: number;               // % distance to target
  suggestedStopLoss: number;           // Invalidation price
  riskRewardRatio: number;             // Reward / Risk (e.g. 2.8)
  poleOrBaseHeightPct?: number;        // Height of the impulse or pattern base
  summary: string;                     // Short executive summary
  technicalRationale: string[];        // Confluence factors validating the pattern
  keyLevelsConfluence: string;         // Level description (e.g. "Fib 0.618 + POC + Suporte 1")
}

// ==========================================
// TERMINAL LAYOUTS & AUTO-TUNER TYPES
// ==========================================

export type TerminalLayoutMode = 
  | 'modular_grid'      // Default multi-panel grid
  | 'scalper_pro'       // Chart + Depth + Volume Spikes + Fast Signals
  | 'quant_risk'        // Greeks exposure + VaR + Correlation + Heatmap
  | 'screener_pro';     // Smart Volume Screener + Radar Screener + Sinais

export type AutoTuneTargetObjective = 
  | 'MAX_SHARPE'        // Maximize Sharpe ratio with optimal risk-adjusted alpha
  | 'MAX_WIN_RATE'      // Maximize % of winning trades
  | 'MAX_PROFIT_FACTOR' // Maximize gross profit / gross loss
  | 'MIN_DRAWDOWN';     // Minimize equity volatility & max drawdown

export interface StrategyAutoTuneMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  winRate: number;              // 0 to 100
  profitFactor: number;
  maxDrawdownPct: number;
  expectedTrades24h: number;
  averageRiskReward: number;
  annualizedReturnPct: number;
  calmarRatio: number;
}

export interface AutoTuneCandidate {
  id: string;
  name: string;
  objective: AutoTuneTargetObjective;
  description: string;
  weights: IndicatorWeights;
  metrics: StrategyAutoTuneMetrics;
  improvementVsCurrent: {
    sharpeDeltaPct: number;
    winRateDelta: number;
    drawdownReductionPct: number;
    profitFactorDelta: number;
  };
  keyChanges: string[];
}

export interface AutoTuneRunResult {
  currentMetrics: StrategyAutoTuneMetrics;
  bestCandidate: AutoTuneCandidate;
  candidates: AutoTuneCandidate[];
  analyzedSignalsCount: number;
  simulatedIterations: number;
  optimizationDurationMs: number;
  timestamp: number;
  recommendations: string[];
}


