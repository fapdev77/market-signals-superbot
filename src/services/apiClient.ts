import { AIModelConfig, BacktestResult, TickerData, TradeSignal } from '../types';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

export interface BotStatusResponse {
  isRunning: boolean;
  activeCount: number;
  lastExecution: number | null;
  totalExecutions: number;
  symbols: string[];
  weights: Record<string, number>;
  riskSettings?: {
    stopLossPct?: number;
    takeProfit1Pct?: number;
    takeProfit2Pct?: number;
    maxRiskPerTradePct?: number;
  };
}

export interface AIReviewResult {
  symbol: string;
  review: string;
  confidence: number;
  verdict: 'CONFIRMED' | 'REJECTED' | 'NEUTRAL';
  modelUsed: string;
  durationMs: number;
}

export interface AIAuditResult {
  symbol: string;
  audit: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  confidenceScore: number;
  actionableInsights: string[];
  durationMs: number;
  timestamp: string;
}

export interface AIChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface BacktestRunParams {
  symbol: string;
  days: number;
  profile: string;
  weights?: Record<string, number>;
  useCache?: boolean;
}

export interface BacktestTuneParams {
  symbol: string;
  days: number;
  profile: string;
  iterations?: number;
}

class ApiError extends Error {
  constructor(message: string, public status?: number, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson?.error) {
        errorMsg = errorJson.error;
      }
    } catch {
      // Ignora erro de parse caso corpo não seja json
    }
    throw new ApiError(errorMsg, response.status);
  }

  return response.json();
}

export const apiClient = {
  // --- Tickers & Market ---
  getTickers: (): Promise<TickerData[]> => {
    return request<TickerData[]>('/api/tickers');
  },

  getTickerBySymbol: (symbol: string): Promise<TickerData> => {
    return request<TickerData>(`/api/tickers/${encodeURIComponent(symbol)}`);
  },

  getKlines: (symbol: string, interval = '15m', limit = 50): Promise<Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    takerBuyVolume: number;
  }>> => {
    return request(`/api/tickers/${encodeURIComponent(symbol)}/klines?interval=${interval}&limit=${limit}`);
  },

  // --- Signals & Bot ---
  getSignals: (): Promise<TradeSignal[]> => {
    return request<TradeSignal[]>('/api/signals');
  },

  getBotStatus: (): Promise<BotStatusResponse> => {
    return request<BotStatusResponse>('/api/bot/status');
  },

  toggleBot: (active?: boolean): Promise<{ success: boolean; isRunning: boolean }> => {
    return request('/api/bot/toggle', {
      method: 'POST',
      body: JSON.stringify({ active }),
    });
  },

  updateBotWeights: (weights: Record<string, number>): Promise<{ success: boolean; weights: Record<string, number> }> => {
    return request('/api/bot/weights', {
      method: 'POST',
      body: JSON.stringify({ weights }),
    });
  },

  updateBotRisk: (riskSettings: Record<string, number>): Promise<{ success: boolean; riskSettings: Record<string, number> }> => {
    return request('/api/bot/risk', {
      method: 'POST',
      body: JSON.stringify({ riskSettings }),
    });
  },

  // --- AI Models & Review ---
  getAIModels: (): Promise<AIModelConfig[]> => {
    return request<AIModelConfig[]>('/api/ai/models');
  },

  updateAIModel: (id: string, config: Partial<AIModelConfig>): Promise<{ success: boolean; model: AIModelConfig }> => {
    return request(`/api/ai/models/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  testAIModel: (id: string): Promise<{ success: boolean; message: string; durationMs: number }> => {
    return request(`/api/ai/models/${encodeURIComponent(id)}/test`, {
      method: 'POST',
    });
  },

  reviewSignal: (signal: TradeSignal, modelId?: string): Promise<AIReviewResult> => {
    return request<AIReviewResult>('/api/ai/review', {
      method: 'POST',
      body: JSON.stringify({ signal, modelId }),
    });
  },

  auditTicker: (symbol: string, timeframe?: string, modelId?: string): Promise<AIAuditResult> => {
    return request<AIAuditResult>('/api/ai/audit', {
      method: 'POST',
      body: JSON.stringify({ symbol, timeframe, modelId }),
    });
  },

  chatWithAI: (params: { message: string; symbol: string; history?: AIChatMessage[]; modelId?: string }): Promise<{ reply: string }> => {
    return request('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  getAILogs: (limit = 100): Promise<Array<Record<string, unknown>>> => {
    return request(`/api/ai/logs?limit=${limit}`);
  },

  // --- Backtest ---
  runBacktest: (params: BacktestRunParams): Promise<{ success: boolean; result: BacktestResult; fromCache?: boolean }> => {
    return request('/api/backtest/run', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  tuneBacktest: (params: BacktestTuneParams): Promise<{
    success: boolean;
    bestWeights: Record<string, number>;
    bestResult: BacktestResult;
    baselineResult: BacktestResult;
    history: Array<{ iteration: number; weights: Record<string, number>; winRate: number; profitFactor: number; totalPnl: number }>;
  }> => {
    return request('/api/backtest/tune', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  applyBacktestWeights: (weights: Record<string, number>): Promise<{ success: boolean; weights: Record<string, number> }> => {
    return request('/api/backtest/apply', {
      method: 'POST',
      body: JSON.stringify({ weights }),
    });
  },

  getBacktestStats: (symbol: string): Promise<{ success: boolean; stats: Record<string, unknown> }> => {
    return request(`/api/backtest/stats/${encodeURIComponent(symbol)}`);
  },

  getBacktestTrades: (symbol: string): Promise<{ success: boolean; trades: Array<Record<string, unknown>> }> => {
    return request(`/api/backtest/trades/${encodeURIComponent(symbol)}`);
  },
};
