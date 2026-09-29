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

const AUTH_STORAGE_KEY = 'superbot_auth_bearer_token';
let cachedToken: string | null = null;

export function getStoredAuthToken(): string | null {
  if (cachedToken) return cachedToken;
  try {
    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      cachedToken = stored;
      return stored;
    }
  } catch {
    // sessionStorage might be restricted
  }
  return null;
}

export function setStoredAuthToken(token: string): void {
  cachedToken = token.trim();
  try {
    sessionStorage.setItem(AUTH_STORAGE_KEY, token.trim());
  } catch {
    // ignore
  }
}

export function clearStoredAuthToken(): void {
  cachedToken = null;
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredAuthToken();
  const headers: Record<string, string> = {
    ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Notify UI to request access token from user
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('superbot:unauthorized'));
    }
  }

  return response;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('superbot:unauthorized'));
      }
    }

    let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson?.message || errorJson?.error) {
        errorMsg = errorJson.message || errorJson.error;
      }
    } catch {
      // Ignora erro de parse caso corpo não seja json
    }
    throw new ApiError(errorMsg, response.status);
  }

  return response.json();
}

// R-13: tipos do health por feed (espelham server/services/feedHealth.ts).
export type FeedStatus = 'OK' | 'DEGRADED' | 'STALE' | 'UNKNOWN';

export interface FeedHealthEntry {
  status: FeedStatus;
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastLatencyMs: number | null;
  lastError: string | null;
}

export interface FeedHealthPayload {
  generatedAt: number;
  feeds: Record<string, FeedHealthEntry>;
  summary: { totalFeeds: number; ok: number; degraded: number; stale: number; unknown: number };
  ws?: {
    connected: boolean;
    lastTickAt: number | null;
    lastError: string | null;
    messagesReceived: number;
    [key: string]: unknown;
  };
  tradingSchedule?: {
    active: 'EXCHANGE_SCHEDULE' | 'CLOCK_FALLBACK';
    assumptions: Array<{ reason: string; since: number }>;
    [key: string]: unknown;
  };
}

export const apiClient = {
  // --- Risk Posture & Kill-Switch (R-17) ---
  getRiskStatus: (): Promise<{
    killSwitch: { enabled: boolean; reason: string | null; activatedAt: number | null; activatedBy: string | null };
    limits: {
      maxConcurrentSignals: number;
      maxSignalsPerCategory: number;
      maxPortfolioRiskPct: number;
      riskPerTradePct: number;
      accountEquity: number;
      [key: string]: unknown;
    };
    portfolio: {
      allowed: boolean;
      reasons: string[];
      concurrentCount: number;
      categoryCounts: Record<string, number>;
      openRiskPct: number;
    };
  }> => {
    return request('/api/system/risk-status');
  },

  setKillSwitch: (enabled: boolean, reason?: string): Promise<{
    success: boolean;
    killSwitch: { enabled: boolean; reason: string | null; activatedAt: number | null; activatedBy: string | null };
  }> => {
    return request('/api/system/kill-switch', {
      method: 'POST',
      body: JSON.stringify({ enabled, reason })
    });
  },

  // --- System Health (R-13) ---
  getFeedHealth: (): Promise<FeedHealthPayload> => {
    return request<FeedHealthPayload>('/api/system/feed-health');
  },

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

  // --- Market Screener & Universe ---
  getScreenerAssets: (): Promise<{ assets: import('../types').ScreenerAsset[]; summary: import('../types').ScreenerScanSummary; monitoredSymbols: string[] }> => {
    return request('/api/screener/assets');
  },

  toggleFavorite: (symbol: string, isFavorite?: boolean): Promise<{ success: boolean; symbol: string; isFavorite: boolean }> => {
    return request('/api/screener/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify({ symbol, isFavorite }),
    });
  },

  getScreenerSettings: (): Promise<import('../types').ScreenerSettings> => {
    return request('/api/screener/settings');
  },

  saveScreenerSettings: (settings: import('../types').ScreenerSettings): Promise<{ success: boolean; settings: import('../types').ScreenerSettings }> => {
    return request('/api/screener/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  triggerScreenerScan: (): Promise<{ success: boolean; summary: import('../types').ScreenerScanSummary; monitoredCount: number }> => {
    return request('/api/screener/run-now', {
      method: 'POST',
    });
  },

  toggleExcludeSymbol: (symbol: string, isExcluded?: boolean): Promise<{ success: boolean; symbol: string; excludedSymbols: string[]; summary: import('../types').ScreenerScanSummary }> => {
    return request('/api/screener/exclude/toggle', {
      method: 'POST',
      body: JSON.stringify({ symbol, isExcluded }),
    });
  },

  resetExcludedSymbols: (): Promise<{ success: boolean; excludedSymbols: string[]; summary: import('../types').ScreenerScanSummary }> => {
    return request('/api/screener/exclude/reset', {
      method: 'POST',
    });
  },
};
