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
  fundingRate: number;              // e.g. 0.0001 (0.01%)
  fundingRateAnnualized: number;    // % annualized
  cvd: number;                      // Cumulative Volume Delta (USDT)
  cvdDirection: 'BUY' | 'SELL' | 'NEUTRAL';
  takerBuyRatio: number;            // 0.0 to 1.0
  
  // Technical Indicators
  fibonacci: {
    fib50: number;                  // 0.50 level
    fib618: number;                 // 0.618 level (Golden Pocket)
    fib68: number;                  // 0.68 level
    swingHigh: number;
    swingLow: number;
    inGoldenPocket: boolean;        // Is price in [0.618 - 0.68]
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
}

export interface TradeSignal {
  id: string;
  symbol: string;
  marketType: MarketType;
  signalType: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  direction: 'LONG' | 'SHORT';
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

  createdAt: number;
  status: 'ACTIVE' | 'TARGET_REACHED' | 'STOPPED_OUT' | 'EXPIRED';
}

export interface IndicatorWeights {
  volumeSurgeWeight: number;        // default 15
  openInterestWeight: number;       // default 20
  fundingRateWeight: number;        // default 10
  cvdImbalanceWeight: number;       // default 20
  fibonacciZoneWeight: number;      // default 15
  rangePocWeight: number;           // default 10
  supportResistanceWeight: number; // default 10
  minRiskRewardRatio: number;       // default 2.5
  volumeProfileRange: number;       // default 20
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

