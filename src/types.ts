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
  /** A-04 (FASE 1): horas REALMENTE cobertas pela janela da média (pode ser < 24). */
  ma24hWindowHours?: number;
  /** A-04: `true` quando a série de velas cobre 24h por inteiro. */
  ma24hComplete?: boolean;
  /** A-04: proveniência da média móvel (velas reais de 24h, janela parcial ou OHLC de 24h). */
  ma24hSource?: 'KLINES_24H' | 'KLINES_PARTIAL' | 'EXCHANGE_24H_OHLC';
  /** A-04: intervalo MEDIDO das velas que alimentaram os indicadores (ex.: '15m'). */
  measuredInterval?: string;
  
  // Futures / Advanced Metrics
  openInterest: number;             // USDT or Contract volume
  openInterestChange24h: number;     // % change
  openInterestChange1h: number;      // % change
  fundingRate: number;              // e.g. 0.0001 (0.01% atual / ciclo)
  fundingIntervalHours?: number;    // e.g. 8 (standard), 4 or 2 hours depending on contract
  fundingRateDaily: number;         // e.g. 0.0003 (0.03% diário)
  fundingRateAnnualized: number;    // % annualized
  fundingRateAnalysis?: {
    status: 'EXTREME_POSITIVE' | 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'EXTREME_NEGATIVE' | 'UNAVAILABLE';
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
    /** A-03: estrutura derivada de pivôs fractais (não da ordem dos extremos). */
    structure?: 'UPTREND' | 'DOWNTREND' | 'RANGE';
    /** A-03: proveniência das âncoras do Fibonacci. */
    structureSource?: 'FRACTAL_PIVOTS' | 'INSUFFICIENT_PIVOTS';
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
  confluenceScore: number;          // 0 to 99 — A-01: força de confluência, nunca satura em 100
  /**
   * A-01 (FASE 1): direção do desequilíbrio de confluência. O `confluenceScore`
   * mede apenas FORÇA; a direção vive aqui, para que um LONG e um SHORT de mesma
   * magnitude não sejam indistinguíveis.
   */
  scoreDirection?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  /** A-01: pontuação bruta (`bullishPoints - bearishPoints`) que originou o score. */
  netConfluencePoints?: number;
  /** A-01: versão do modelo de score (`SCORING_MODEL.version`). */
  scoringModelVersion?: number;
  signalType: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  signalReason: string;
  confluenceFactors: string[];
  
  // Provenance & Quality Metrics (Phase 1)
  dataQuality?: {
    isLive: boolean;
    isDegraded: boolean;
    lastPriceAgeMs: number;
    source: 'WS' | 'REST' | 'CACHE' | 'SYNTHETIC' | 'STALE';
    /** Factors whose upstream feed was unavailable this tick (Phase 2.5.2). Never scored as neutral. */
    unavailableFactors?: string[];
  };

  /** TradFi trading session if instrument is TRADIFI_PERPETUAL (M1.6 / Phase 5). */
  tradfiSession?: 'REGULAR' | 'PRE_MARKET' | 'AFTER_MARKET' | 'OVERNIGHT' | 'NO_TRADING';

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
  /** True only when ALLOW_SYNTHETIC_DATA=true forced a modelled estimate instead of real events. */
  isSimulated?: boolean;
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
  /**
   * FASE 0 (C-07): proveniência obrigatória do livro.
   * `EXCHANGE` = book real da Binance; `SIMULATED` = gerado (fallback) — a UI
   * DEVE rotular, para que um livro sintético nunca passe por real.
   */
  source: 'EXCHANGE' | 'SIMULATED';
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
  /**
   * A-06 (FASE 1): proveniência do `takerBuyVolume`.
   * `false` = o campo veio ausente/inválido da exchange — o valor NÃO foi medido
   * (é 0 por ausência, não por dado) e não deve pontuar CVD/confluência.
   * `undefined` é tratado como disponível, para compatibilidade com fixtures antigas.
   */
  takerBuyVolumeAvailable?: boolean;
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
  ttlMinutes?: number;              // Duração do TTL configurada em minutos
  expiresAt?: number;               // Timestamp exato em que o sinal perde validade (createdAt + ttl)
  expirationReason?: string;        // Razão de encerramento (ex: "TTL Expirado", "Stop Loss", "Alvo 2", "Invalidação Técnica")
  isBreakevenActive?: boolean;      // True se atingiu Alvo 1 e o Stop Loss foi movido para o preço de entrada
  status: 'ACTIVE' | 'PENDING_ENTRY' | 'TARGET_REACHED' | 'STOPPED_OUT' | 'EXPIRED';

  /** TradFi trading session at time of signal generation (M1.6 / Phase 5). */
  tradfiSession?: 'REGULAR' | 'PRE_MARKET' | 'AFTER_MARKET' | 'OVERNIGHT' | 'NO_TRADING';

  /**
   * R-2: proveniência do sinal. `DEMO` só é gravado quando o sinal nasceu de dado
   * sintético (ALLOW_SYNTHETIC_DATA='true'); ausente em registros anteriores = `LIVE`.
   */
  origin?: DataOrigin;

  /** 6.5.2: quantidade sugerida pelo RiskManager já arredondada para baixo ao stepSize. */
  suggestedQuantity?: number;
  /** 6.5.2/6.5.3: sinal executável segundo os filtros do exchange e o slippage estimado. */
  executable?: boolean;
  /** Motivo quando `executable: false` (minQty, notional mínimo ou slippage acima do limite). */
  nonExecutableReason?: string;
  /** 6.5.3: slippage estimado pela profundidade do book (%). Ausente quando o book não é real. */
  estimatedSlippagePct?: number;
  /** 6.5.3: o book usado na estimativa era real (REST/limiter)? TradFi não tem depth real. */
  executionBookAvailable?: boolean;
}

/**
 * R-2 — proveniência persistida:
 *  - `LIVE`: dado de mercado (REST/WS/cache);
 *  - `DEMO`: dado gerado localmente (só existe com ALLOW_SYNTHETIC_DATA='true').
 */
export type DataOrigin = 'LIVE' | 'DEMO';

/** Filtro das leituras. `ALL` é explícito e reservado ao motor, que gerencia tudo o que criou. */
export type OriginFilter = DataOrigin | 'ALL';

export type MarketRegimeType = 'CALM' | 'NORMAL' | 'VOLATILE' | 'EXTREME';

export interface SignalTtlSettings {
  scalpTtlMinutes: number;         // default 25 min (Scalp 5m)
  dayTradeTtlMinutes: number;      // default 90 min (Day Trade 15m)
  intradayTtlMinutes: number;      // default 240 min / 4h (Intraday 30m)
  swingTtlMinutes: number;         // default 1440 min / 24h (Swing 1h/4h)
  positionTtlMinutes: number;      // default 4320 min / 72h (Position 4h/1d)
  counterTradeTtlMinutes: number;  // default 60 min / 1h (Contra-Trade TTI)
  customTtlMinutes: number;        // default 120 min

  marketRegime: MarketRegimeType;  // CALM (1.5x), NORMAL (1.0x), VOLATILE (0.6x), EXTREME (0.4x)
  regimeMultiplier: number;        // Multiplicador contínuo de fine-tuning (0.3x a 2.5x)
  autoExpireEnabled: boolean;      // Se true, o motor expira automaticamente sinais que ultrapassam o TTL
  adverseMoveInvalidationPct: number; // Invalidação prévia se o preço se afastar adversamente (ex: 1.2%)
  breakevenOnTarget1: boolean;     // Se true, move Stop Loss para Breakeven ao atingir Alvo 1
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
  rsiDivergenceWeight?: number;
}

export interface IndicatorWeights {
  activeStrategy?: 'scalp' | 'daytrade' | 'intraday' | 'swing' | 'position' | 'counter' | 'custom';
  strategyLabel?: string;
  multiStrategyMode?: boolean;       // Se true, roda todas as estratégias habilitadas concorrentemente
  enabledStrategies?: StrategyKey[];  // Lista de estratégias ativas em paralelo no motor
  strategyConfigs?: Partial<Record<StrategyKey, StrategyConfigItem>>;
  signalTtlSettings?: SignalTtlSettings; // Configuração e fine-tuning institucional de TTL
  volumeSurgeWeight: number;        // default 15
  openInterestWeight: number;       // default 20
  fundingRateWeight: number;        // default 10
  cvdImbalanceWeight: number;       // default 20
  fibonacciZoneWeight: number;      // default 15
  rangePocWeight: number;           // default 10
  supportResistanceWeight: number; // default 10
  trappedTradersWeight?: number;    // default 25 (para contra-trade / fade de absorção)
  rsiDivergenceWeight?: number;     // default 20 (para divergências de RSI)
  minRiskRewardRatio: number;       // default 2.5
  minConfluenceScore?: number;      // default 65
  volumeProfileRange: number;       // default 50 (resolução em linhas/bins de preço)
  maxStopLossAtrMultiple?: number;  // R-7: cap da distância do stop em múltiplos do ATR% (default 2.5)
  volumeProfileTimeframe?: string;  // default '30m'
  volumeProfileCandles?: number;    // default 48 (48 * 30m = 24h)
  /** A-02: peso do Fair Value Gap (default 10). Antes era um literal fora do Auto-Tuner. */
  fvgWeight?: number;
  /** A-02: idade máxima do FVG, em velas, para que ele pontue (default 12 ≈ 3h em 15m). */
  fvgMaxAgeCandles?: number;
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

/**
 * R-10: rolling walk-forward framing. Windows are derived from TIME (train → test, sliding by the
 * step), never from how many candles happened to be loaded, so the in-sample/out-of-sample boundary
 * is stable and the tuner can be restricted to the training slice alone.
 */
export interface WalkForwardOptions {
  /** In-sample (training) window length, in days. */
  trainDays?: number;
  /** Out-of-sample (validation) window length, in days. */
  testDays?: number;
  /** How far to slide between consecutive windows, in days (defaults to testDays). */
  stepDays?: number;
}

export interface BacktestConfig {
  symbol: string;
  days?: number;
  profile?: TradingProfile;
  weights: IndicatorWeights;
  seed?: number;
  /**
   * Analyse as of this timestamp instead of the wall clock (Phase 2.5.4). Pinning it makes a run
   * reproducible; when omitted the window is aligned to the candle boundary so repeated runs of the
   * same config select the same candles.
   */
  asOf?: number;
  /** R-10: rolling window framing for the walk-forward metrics. */
  walkForward?: WalkForwardOptions;
  /**
   * R-10 (internal): stop the simulation at this timestamp, so a candidate is scored on the training
   * slice only. Used by the auto-tuner to keep out-of-sample data out of parameter selection.
   */
  isOnlyUntil?: number;
  /**
   * 7.2 (D3/D8) — braço "com confirmação": quando `true`, o preenchimento passa pelo ciclo
   * PENDING_ENTRY usando as funções puras do live (`evaluatePendingEntry` + `confirmEntry`).
   * Ausente/false preserva o comportamento atual (fill no open do candle seguinte).
   */
  entryConfirmation?: boolean;
  /**
   * Risco por trade em %, aplicado só nesta execução. Ausente = o que o runtime tem em
   * vigor (`getRiskLimits().riskPerTradePct`). Não altera o runtime: existe para
   * reproduzir um cenário no backtest sem mexer na configuração global.
   */
  riskPerTradePct?: number;
  /**
   * P — limites do gate de risco de portfólio aplicados só nesta execução. Ausente =
   * `getRiskLimits()`, o mesmo que o live usa no caminho de emissão. Os campos presentes
   * sobrescrevem os do runtime; os ausentes são mantidos.
   */
  riskLimits?: Partial<BacktestRiskLimits>;
}

/** Limites de risco — espelha `RiskLimits` de `server/services/RiskManager.ts`. */
export interface BacktestRiskLimits {
  accountEquity: number;
  riskPerTradePct: number;
  maxConcurrentSignals: number;
  maxPortfolioRiskPct: number;
  maxSignalsPerCategory: number;
}

/** 7.2 — estatísticas por sinal emitido para a decisão da confirmação de entrada. */
export interface EntryConfirmationStats {
  enabled: boolean;
  signalsEmitted: number;
  entriesFilled: number;
  entriesNotFilled: number;
  entriesInvalidated: number;
  /** PnL em R por sinal emitido (0 para não preenchidos) — usado na expectativa/IC. */
  rPerSignal: number[];
  /**
   * 8.2.1 — chave DETERMINÍSTICA de cada sinal emitido, na mesma ordem de
   * `rPerSignal`. Permite parear os braços pelo MESMO sinal (mesmo `signalId`)
   * mesmo quando o conjunto de sinais diverge entre controle e confirmação.
   */
  signalKeys?: string[];
  fillMinutesSum: number;
  fillCount: number;
  limitation?: string;
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
  /** 8.0.1 — pernas (eventos de saída) desta posição: parcial+runner = 2. */
  legs?: number;
  /** 8.0.2 — decomposição de R da posição (bruto, taxas, slippage, funding, líq.). */
  rGross?: number;
  rFees?: number;
  rSlippage?: number;
  rFunding?: number;
  rNet?: number;
  /** 8.1 — score de confluência do sinal que abriu a posição (faixas do diagnóstico). */
  confluenceScore?: number;
  /** 8.1 — regime predominante na vela de emissão (tendência/lateral). */
  regime?: 'TREND_UP' | 'TREND_DOWN' | 'RANGE';
}

export interface BacktestResult {
  id: string;
  symbol: string;
  profile: TradingProfile;
  strategyId: string;
  startTime: number;
  endTime: number;
  /** `null` when a cached row predates persistence of the field (M8 recurrence). */
  totalCandlesTested: number | null;
  /** 8.0.1 — posições FECHADAS. Sinônimo explícito de `positionsClosed`. */
  totalTrades: number;
  /** 8.0.1 — eventos de saída (pernas) acumulados em todas as posições. */
  legs?: number;
  /** 8.0.1 — posições fechadas (win+loss). */
  positionsClosed?: number;
  /** 8.0.1 — entradas preenchidas (≤ sinais emitidos). */
  positionsFilled?: number;
  /** 8.0.1 — win rate por PERNA, rotulado à parte do win rate por posição. */
  winRatePerLeg?: number;
  /** 8.0.3 — posições ainda abertas no fim da janela (marca a mercado declarada). */
  openPositionsAtEnd?: number;
  /** 8.0.2 — médias da decomposição de R por posição fechada. */
  rDecomposition?: {
    rGross: number;
    rFees: number;
    rSlippage: number;
    rFunding: number;
    rNet: number;
    /** Custo médio (taxas+slippage+funding) em R por posição. */
    costAvgR: number;
    positions: number;
  };
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  /** Gross profit over gross loss. `null` when no loss was measured to divide by. */
  profitFactor: number | null;
  maxDrawdown: number;
  netProfit: number;
  /** `null` when there were no winning positions to average. */
  avgWinPct: number | null;
  /** `null` when there were no losing positions to average. */
  avgLossPct: number | null;
  /** Realised win/loss ratio. `null` when no loss was measured — never the preset target. */
  avgRiskReward: number | null;
  /** `null` when no position closed. */
  avgDurationMinutes: number | null;
  equityCurve: EquityPoint[];
  diagnostic: BacktestDiagnostic;
  config: BacktestConfig;
  createdAt: number;
  trades?: BacktestTrade[];
  /** 7.2 — métricas do braço de confirmação de entrada (preenchido nos dois braços). */
  entryConfirmation?: EntryConfirmationStats;
  /**
   * P — decisão do gate de risco no ponto de emissão, com os mesmos limites do live.
   * `evaluated` é o total de sinais; `allowed + blocked` tem de fechar nele.
   * `openAtEvaluation` é o maior tamanho do conjunto aberto que o gate enxergou
   * (0 enquanto o motor for single-position, que só emite quando está plano).
   */
  riskGate?: {
    evaluated: number;
    allowed: number;
    blocked: number;
    openAtEvaluation: number;
    reasons: string[];
    limits: BacktestRiskLimits;
  };
  sharpeRatio?: number;
  sortinoRatio?: number;
  /** M3 — whether Sharpe/Sortino were annualised, and on how many trades. */
  sharpeAnnualization?: {
    isAnnualized: boolean;
    tradesUsed: number;
    annualFactor: number | null;
  };
  makerTakerFeePct?: number;
  slippagePct?: number;
  grossProfit?: number;
  totalFeesPaid?: number;
  walkForward?: {
    inSampleWinRate: number;
    inSampleProfit: number;
    outOfSampleWinRate: number;
    outOfSampleProfit: number;
    /** Out-of-sample profit per trade divided by in-sample profit per trade. 0 when not computable. */
    overfitRatio: number;
    isRobust: boolean;
    /** R-10: rolling windows evaluated (train → test). */
    windows?: number;
    /** R-10: total trades taken after the initial training window (the validation slice). */
    outOfSampleTrades?: number;
    /** R-10: per-window out-of-sample breakdown. */
    windowResults?: Array<{
      index: number;
      isStart: number;
      oosStart: number;
      oosEnd: number;
      isTrades: number;
      oosTrades: number;
      oosWinRate: number;
      oosProfitPct: number;
    }>;
  };
  /** Confluence factors that could not be backtested on the available history (Phase 2.5.4). */
  disabledFactors?: string[];
  /** Cost/parameter assumptions baked into the simulation, surfaced so results are not over-read. */
  assumptions?: string[];
  /** True when any historical factor (OI, funding, long/short) has < 100% coverage (M2.2 / Phase 5). */
  reducedFactorSet?: boolean;
  /**
   * M7 — which factors the run could actually measure. `oiCoverageAvailable: false` means the
   * factor was never instrumented, which is different from "measured and found incomplete":
   * a 0% coverage from absent instrumentation must not read as a measurement.
   */
  factorCoverageAvailability?: {
    openInterest: boolean;
    longShort: boolean;
    funding: boolean;
  };
  /** Coverage % across historical factors (M2.2 / Phase 5). */
  factorCoverage?: {
    openInterest: number;
    funding: number;
    longShort: number;
  };
  /** 6.3.4 — % dos eventos de funding da janela cobertos por registros reais. */
  fundingCoverage?: number;
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
  /** `null` when the iteration closed no losing position to divide by. */
  profitFactor: number | null;
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
  /** R-10: scored on the training slice only (`isOnlyUntil`), never on the whole series. */
  initialResult: BacktestResult;
  /** R-10: the best training-slice candidate. */
  bestResult: BacktestResult;
  fitnessHistory: AutoTuneIteration[];
  tuningSummary: string;
  createdAt: number;
  /** R-10: honest validation of the chosen weights on the unseen remainder of the series. */
  oosValidation?: BacktestResult;
  /** R-10: timestamp the training slice ends at (parameters are only fitted before it). */
  trainedUntil?: number;
  /** M2.6: Final holdout validation with bootstrap confidence interval. */
  holdoutValidation?: {
    isRobust: boolean;
    trialsCount: number;
    confidenceInterval: {
      mean: number;
      lowerBound: number;
      upperBound: number;
    };
  };
}

// ============================================
// MARKET SCREENER & DYNAMIC UNIVERSE TYPES
// ============================================

export type MarketSector = 'ALL' | 'FAVORITES' | 'L1_L2' | 'DEFI' | 'MEME' | 'AI' | 'TRADFI' | 'STABLECOIN' | 'EXCLUDED';

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
  /** 6.4.4: null = indisponível (a UI mostra "n/d"); nunca derivado do nome. */
  openInterest: number | null;
  openInterestChange1h: number | null;
  openInterestChange24h: number | null;
  fundingRate: number | null;
  fundingRateAnnualized: number | null;
  /** RVOL real (média 20d do próprio símbolo); null fora do top-N. */
  rvol: number | null;
  /** 6.4.4: fatores que de fato compuseram o score. */
  availableFactors?: string[];
  compositeScore: number;           // 0 to 100 ranking score
  isFavorite: boolean;              // User pinned/favorite
  isMonitored: boolean;             // Currently in the active 4s scan universe
  isExcluded?: boolean;             // True if asset is in exclusion list (unmonitored/blacklisted)
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
  excludedSymbols: string[];         // Symbols explicitly excluded from dynamic monitoring/screener (e.g. USDTUSDC, USDGUSDT, PYUSDUSDT)
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
  excludedCount?: number;            // Total assets currently in the exclusion list
  // Phase 2.5.6: these leaders are derived from a completed scan. They stay undefined when no scan has
  // produced them, instead of being filled with invented symbols and rates.
  topGainer?: { symbol: string; change: number };
  topVolume?: { symbol: string; quoteVolume: number };
  topOiSurge?: { symbol: string; oiChange: number };
  highestFundingRate?: { symbol: string; rate: number };
  lastScanDurationMs: number;
  timestamp: number;
  /** True when the scan could not reach the exchange; leaders above are absent rather than simulated. */
  dataUnavailable?: boolean;
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
  /**
   * FASE 0 (C-09): procedência da posição.
   * `USER` = cadastrada pelo operador; `SIGNAL` = derivada de um sinal; `DEMO` = exemplo.
   * Nenhuma posição de demonstração deve se apresentar como real.
   */
  origin?: 'USER' | 'SIGNAL' | 'DEMO';
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
  /**
   * C-08: base do VaR. `PARAMETRIC_ASSUMED` = volatilidade diária PREMISSA
   * (não medida); `MEASURED` = volatilidade realizada fornecida pelo caller.
   */
  varBasis: 'PARAMETRIC_ASSUMED' | 'MEASURED';
  /** Volatilidade diária efetivamente usada no VaR (fração, ex.: 0.035 = 3.5%/dia). */
  varDailyVolUsed: number;
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
  deltaPressure: 'BUY' | 'SELL' | 'NEUTRAL' | 'UNKNOWN'; // 'UNKNOWN' = razão taker não medida no feed (exibir n/d)
  takerRatio: number | null;      // 0 to 1; null = não medido (nunca fabricar neutro 0.50)
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
// RSI DIVERGENCE TYPES
// ==========================================

export type RSIDivergenceType = 
  | 'REGULAR_BULLISH'   // Price: Lower Low, RSI: Higher Low (Reversão Altista)
  | 'REGULAR_BEARISH'   // Price: Higher High, RSI: Lower High (Reversão Baixista)
  | 'HIDDEN_BULLISH'    // Price: Higher Low, RSI: Lower Low (Continuação de Alta)
  | 'HIDDEN_BEARISH'    // Price: Lower High, RSI: Higher High (Continuação de Baixa)
  | 'NO_DIVERGENCE';

export type RSIDivergenceStatus = 'ACTIVE' | 'TRIGGERED' | 'EXHAUSTED' | 'INVALIDATED';

export interface RSIDivergenceItem {
  id: string;
  symbol: string;
  ticker: TickerData;
  timeframe: string; // '15m' | '1h' | '4h' | '1D'
  divergenceType: RSIDivergenceType;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  /** FASE 0 (C-01): `null` quando não há velas suficientes para o RSI de Wilder. */
  rsiCurrent: number | null; // 0-100
  rsiPrevSwing: number | null; // 0-100
  priceCurrent: number;
  pricePrevSwing: number;
  divergenceSlope: number;
  confidence: number; // 0-100
  status: RSIDivergenceStatus;
  isOverbought: boolean; // RSI >= 70
  isOversold: boolean; // RSI <= 30
  /** FASE 0 (C-01): `null` quando não há setup — nenhum nível direcional é fabricado sem divergência/histórico de velas. */
  entryZone: [number, number] | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
  riskRewardRatio: number | null;
  confluences: string[];
  verdict: string;
  detectedAt: number;
}


export type TerminalLayoutMode = 
  | 'modular_grid'      // Default multi-panel grid
  | 'scalper_pro'       // Chart + Depth + Volume Spikes + Fast Signals
  | 'quant_risk'        // Greeks exposure + VaR + Correlation + Heatmap
  | 'screener_pro';     // Smart Volume Screener + Radar Screener + Sinais

// CRÍTICO-1 (auditoria): `AutoTuneTargetObjective`, `StrategyAutoTuneMetrics`,
// `AutoTuneCandidate` e `AutoTuneRunResult` foram removidos. Eles descreviam o
// auto-tuner client-side FABRICADO (`src/utils/strategyAutoTuning.ts`), que sorteava
// vitória/derrota com `Math.sin` e tinha métricas com piso. O auto-tuning real é
// server-authoritative e produz `AutoTuneResult` (acima), com fatia de treino,
// validação fora-da-amostra, holdout intocado e IC95% por bootstrap.
// Não reintroduza tipos "de otimizador" aqui: estenda `AutoTuneResult`.

// ============================================
// PAPER TRADING SANDBOX TYPES
// ============================================

export type PaperOrderType = 'MARKET' | 'LIMIT' | 'STOP_MARKET';
export type PaperPositionSide = 'LONG' | 'SHORT';
export type PaperTradeExitReason = 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL_CLOSE' | 'LIQUIDATION' | 'PARTIAL_CLOSE';
export type PaperSourceType = 'MANUAL' | 'QUANT_SIGNAL' | 'AI_REVIEW';

export interface PaperFeeTier {
  id: string;
  name: string;
  makerFeePct: number; // e.g. 0.02 (%)
  takerFeePct: number; // e.g. 0.05 (%)
  description: string;
}

export interface PaperTradingSettings {
  initialBalance: number;
  feeTierId: string;
  customMakerFeePct?: number;
  customTakerFeePct?: number;
  slippagePct: number; // e.g. 0.02 (%)
  autoExecuteTpSl: boolean;
  soundAlerts: boolean;
}

export interface PaperOrder {
  id: string;
  symbol: string;
  baseAsset: string;
  side: PaperPositionSide;
  type: PaperOrderType;
  quantity: number;
  price?: number;        // Limit trigger or execution target price
  stopPrice?: number;    // Stop trigger price
  leverage: number;
  marginUsd: number;
  notionalUsd: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  createdAt: number;
  sourceType: PaperSourceType;
  sourceSignalId?: string;
  notes?: string;
}

export interface PaperPosition {
  id: string;
  symbol: string;
  baseAsset: string;
  side: PaperPositionSide;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  notionalUsd: number;
  marginUsd: number;
  leverage: number;
  liquidationPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  
  // Real-time PnL and Commission impact
  unrealizedPnlGross: number;
  unrealizedPnlNet: number;
  unrealizedRoePct: number;
  breakEvenPrice: number;
  entryFeePaidUsd: number;
  estimatedExitFeeUsd: number;
  totalEstimatedFeesUsd: number;
  
  openedAt: number;
  updatedAt: number;
  sourceType: PaperSourceType;
  sourceSignalId?: string;
  notes?: string;
}

export interface PaperTradeRecord {
  id: string;
  symbol: string;
  baseAsset: string;
  side: PaperPositionSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  notionalUsd: number;
  marginUsd: number;
  leverage: number;
  grossPnl: number;
  netPnl: number;
  roePct: number;
  feesPaid: number;
  slippageImpactUsd: number;
  exitReason: PaperTradeExitReason;
  openedAt: number;
  closedAt: number;
  durationMinutes: number;
  sourceType: PaperSourceType;
  sourceSignalId?: string;
  notes?: string;
}

export interface PaperAccountState {
  initialBalance: number;
  cashBalance: number;
  marginInUse: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalEquity: number;
  totalFeesPaid: number;
  netPnlPercentage: number;
  peakEquity: number;
  maxDrawdownPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  /** `null` when no losing trade closed, i.e. the factor was never measured (M8). */
  profitFactor: number | null;
  averageWin: number;
  averageLoss: number;
  positions: PaperPosition[];
  pendingOrders: PaperOrder[];
  tradeHistory: PaperTradeRecord[];
  settings: PaperTradingSettings;
  lastUpdatedAt: number;
}

// ============================================
// SYSTEM & DATABASE INSPECTOR TYPES
// ============================================

export interface SystemTableInfo {
  name: string;
  rowCount: number;
  description: string;
  columns: string[];
  estimatedSizeBytes: number;
  isClearable: boolean;
}

export interface SystemDatabaseStats {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  sqliteVersion: string;
  pageCount: number;
  pageSize: number;
  integrity: string;
  tables: SystemTableInfo[];
  totalRows: number;
  system: {
    heapUsedBytes: number;
    heapTotalBytes: number;
    rssBytes: number;
    uptimeSeconds: number;
    nodeVersion: string;
  };
  timestamp: number;
}

export interface ClientStorageItem {
  key: string;
  label: string;
  category: 'paper_trading' | 'alerts' | 'layout' | 'preferences' | 'cache' | 'other';
  sizeBytes: number;
  sizeFormatted: string;
  itemCount?: number;
  previewSummary: string;
}

export type FeedSource = 'WS' | 'REST' | 'CACHE' | 'SYNTHETIC';

export interface FeedResult<T> {
  value: T;
  source: FeedSource;
  fetchedAt: number;
  isDegraded: boolean;
  error?: string;
}





