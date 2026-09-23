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
  
  // Confluence & Signal
  confluenceScore: number;          // 0 to 100
  signalType: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  signalReason: string;
  confluenceFactors: string[];
  
  updatedAt: number;                // timestamp
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

export type StrategyCategory = 'SCALP' | 'DAY_TRADE' | 'INTRADAY' | 'SWING' | 'POSITION' | 'CUSTOM';

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

export type StrategyKey = 'scalp' | 'daytrade' | 'intraday' | 'swing' | 'position' | 'custom';

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
}

export interface IndicatorWeights {
  activeStrategy?: 'scalp' | 'daytrade' | 'intraday' | 'swing' | 'position' | 'custom';
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

