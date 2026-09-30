import { TickerData, KlineCandle, OrderBookDepthData, OrderBookLevel, LongShortRatioData, TrappedTradersData, LiquidationSummary } from '../src/types.js';
import { addBinanceLog, getLiveWSTickers, getLiquidationsSummary } from './binanceWebsocket.js';
import { requestJson, requestJsonLimited } from './utils/httpClient.js';
import { BinanceRateLimiter } from './utils/binanceRateLimiter.js';
// R-13: health por feed — todo caminho de fetch grava sucesso/falha no registro central.
import { recordFeedSuccess, recordFeedFailure } from './services/feedHealth.js';
import { incrementMetric } from './utils/metrics.js';
// R-2: os geradores sintéticos vivem todos em server/demo/.
import { generateFallbackKlines } from './demo/syntheticKlines.js';
import { simulateLongShortRatio } from './demo/syntheticMarket.js';

function formatPriceString(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0.00';
  const abs = Math.abs(value);
  if (abs === 0) return '0.00';
  if (abs >= 1000) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (abs >= 50) return value.toFixed(2);
  if (abs >= 1) return value.toFixed(3);
  const leadingZeros = Math.floor(-Math.log10(abs));
  const decimals = Math.min(12, Math.max(5, leadingZeros + 4));
  return value.toFixed(decimals);
}

// Phase 2.1: Exclusive fapi endpoints for perpetual contracts with weight control
const REST_ENDPOINTS = [
  { base: 'https://fapi.binance.com', type: 'futures', tickerPath: '/fapi/v1/ticker/24hr', klinePath: '/fapi/v1/klines' },
  { base: 'https://fapi1.binance.com', type: 'futures', tickerPath: '/fapi/v1/ticker/24hr', klinePath: '/fapi/v1/klines' },
  { base: 'https://fapi2.binance.com', type: 'futures', tickerPath: '/fapi/v1/ticker/24hr', klinePath: '/fapi/v1/klines' },
  { base: 'https://fapi3.binance.com', type: 'futures', tickerPath: '/fapi/v1/ticker/24hr', klinePath: '/fapi/v1/klines' }
];

let currentWorkingBaseIndex = 0;

// Monitored Crypto Futures Assets
export const DEFAULT_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'SUIUSDT',
  'PEPEUSDT',
  'LINKUSDT',
  'AAVEUSDT',
  'AVAXUSDT',
  'NEARUSDT'
];

// ---------------------------------------------------------------------------------------------
// TradFi registry (Phase 2.5.5)
//
// TradFi assets are DISCOVERED from Binance `exchangeInfo`, never hardcoded. The previous list
// (NVDABUSDT, TSLABUSDT, AAPLBUSDT, SPYBUSDT, QQQBUSDT, EURUSDT, GBPUSDT, JPYUSDT) contained symbols
// that were never validated against the exchange, and `fetchBinanceTradfiContracts` force-added all of
// them to its result — so the "validation" could not fail and nothing was actually verified.
//
// `TRADFI_ASSETS` is now a live registry: it stays EMPTY until discovery succeeds. An empty registry
// is the correct outcome when the exchange is unreachable or does not list the instrument.
// ---------------------------------------------------------------------------------------------

export type TradfiCategory = 'EQUITY' | 'INDEX' | 'COMMODITY' | 'FOREX';

export interface TradfiAsset {
  symbol: string;
  name: string;
  baseAsset: string;
  quoteAsset: string;
  tradfiCategory: TradfiCategory;
  contractType: string;
  /** The exchangeInfo fields the classification was derived from, kept so an operator can audit it. */
  classificationSource?: Record<string, unknown>;
}

/** Base assets that are unambiguously a fiat currency rather than a crypto token. */
const FX_BASE_ASSETS = new Set([
  'EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CAD', 'NZD', 'BRL', 'TRY', 'ZAR', 'MXN', 'CNH', 'CNY',
  'HKD', 'SGD', 'KRW', 'INR', 'SEK', 'NOK', 'DKK', 'PLN', 'THB', 'IDR', 'PHP', 'MYR', 'CZK',
  'HUF', 'ILS', 'RON', 'AED', 'SAR'
]);

/** Base assets that are commodity-backed or commodity contracts rather than pure crypto. */
const COMMODITY_BASE_ASSETS = new Set([
  'PAXG', 'XAUT', 'GOLD', 'XAU', 'XAG', 'SILVER', 'XPT', 'XPD', 'WTI', 'BRENT', 'NGAS', 'OIL'
]);

/** Live registry of discovered TradFi instruments. Empty until `refreshTradfiRegistry` succeeds. */
export const TRADFI_ASSETS: TradfiAsset[] = [];

let tradfiRegistryRefreshedAt = 0;
let tradfiContractsCache: Set<string> | null = null;
const TRADFI_REGISTRY_TTL_MS = 5 * 60 * 1000;

/**
 * Classifies a single `exchangeInfo` symbol entry, or returns null when the exchange gives no evidence
 * that it is a TradFi instrument. Returning null is deliberate: an unclassifiable contract is reported
 * rather than guessed into a category.
 */
export function classifyTradfiContract(symbolInfo: any): TradfiCategory | null {
  if (!symbolInfo || typeof symbolInfo !== 'object') return null;

  const contractType = String(symbolInfo.contractType || '');
  const underlyingType = String(symbolInfo.underlyingType || '').toUpperCase();
  const subTypes: string[] = Array.isArray(symbolInfo.underlyingSubType)
    ? symbolInfo.underlyingSubType.map((x: unknown) => String(x).toUpperCase())
    : [];
  const base = String(symbolInfo.baseAsset || '').toUpperCase();
  const haystack = [underlyingType, contractType, ...subTypes].join(' ').toUpperCase();

  // Commodity-backed tokens are a genuine classification regardless of the exchange's TradFi marker.
  if (COMMODITY_BASE_ASSETS.has(base) || /COMMODITY|METAL|GOLD|SILVER|OIL/.test(haystack)) return 'COMMODITY';
  if (FX_BASE_ASSETS.has(base) || /(^|\s)(FX|FOREX)(\s|$)/.test(haystack)) return 'FOREX';

  if (!contractType) return null;

  // Only instruments the exchange itself flags as TradFi (or with an obvious TradFi underlying) qualify.
  const looksTradfi =
    contractType.toUpperCase() === 'TRADIFI_PERPETUAL' ||
    underlyingType === 'INDEX' ||
    underlyingType === 'EQUITY' ||
    /(^|\s)(EQUITY|STOCK|INDEX|FX|FOREX|COMMODITY|METAL|GOLD)(\s|$)/.test(haystack);
  if (!looksTradfi) return null;

  if (/COMMODITY|METAL|GOLD|SILVER|OIL/.test(haystack)) return 'COMMODITY';
  if (/(^|\s)(FX|FOREX)(\s|$)/.test(haystack)) return 'FOREX';
  if (/INDEX/.test(haystack)) return 'INDEX';
  if (/EQUITY|STOCK/.test(haystack)) return 'EQUITY';

  // Marked TradFi by the exchange but carrying no finer subtype — report instead of guessing.
  return null;
}

/**
 * Refreshes the TradFi registry from Binance `exchangeInfo`.
 * Never force-adds a symbol: if discovery returns nothing, the registry is empty and the caller must
 * treat TradFi monitoring as unavailable.
 */
export async function refreshTradfiRegistry(): Promise<TradfiAsset[]> {
  const now = Date.now();
  if (TRADFI_ASSETS.length > 0 && now - tradfiRegistryRefreshedAt < TRADFI_REGISTRY_TTL_MS) {
    return TRADFI_ASSETS;
  }

  const discovered: TradfiAsset[] = [];
  const unclassified: string[] = [];

  try {
    const { data } = await fetchWithFallback(() => '/fapi/v1/exchangeInfo');
    const symbols = Array.isArray(data?.symbols) ? data.symbols : [];

    for (const s of symbols) {
      // Only contracts that are actively trading can produce signals.
      if (s?.status && String(s.status).toUpperCase() !== 'TRADING') continue;

      const category = classifyTradfiContract(s);
      if (!category) {
        if (String(s?.contractType || '').toUpperCase() === 'TRADIFI_PERPETUAL') {
          unclassified.push(s.symbol);
        }
        continue;
      }

      discovered.push({
        symbol: s.symbol,
        name: s.symbol,
        baseAsset: String(s.baseAsset || ''),
        quoteAsset: String(s.quoteAsset || 'USDT'),
        tradfiCategory: category,
        contractType: String(s.contractType || 'PERPETUAL'),
        classificationSource: {
          contractType: s.contractType,
          underlyingType: s.underlyingType,
          underlyingSubType: s.underlyingSubType
        }
      });
    }

    addBinanceLog(
      'INFO',
      'REST_API',
      `TradFi: ${discovered.length} contrato(s) descoberto(s) via exchangeInfo${unclassified.length > 0 ? ` (${unclassified.length} TRADIFI_PERPETUAL não classificado(s): ${unclassified.join(', ')})` : ''}.`
    );
  } catch (err: any) {
    addBinanceLog('WARN', 'REST_API', `Falha ao carregar exchangeInfo para TradFi: ${err?.message}. Registro mantido vazio (sem lista hardcoded).`);
  }

  // Mutate in place so existing importers keep observing the same array binding.
  TRADFI_ASSETS.length = 0;
  TRADFI_ASSETS.push(...discovered);
  tradfiRegistryRefreshedAt = now;
  tradfiContractsCache = new Set(discovered.map(a => a.symbol));
  return TRADFI_ASSETS;
}

/**
 * Backwards-compatible accessor: the set of discovered TradFi symbols.
 * Unlike the previous implementation it performs no force-add, so an empty set means "none found".
 */
export async function fetchBinanceTradfiContracts(): Promise<Set<string>> {
  if (tradfiContractsCache && Date.now() - tradfiRegistryRefreshedAt < TRADFI_REGISTRY_TTL_MS) {
    return tradfiContractsCache;
  }
  await refreshTradfiRegistry();
  return tradfiContractsCache || new Set<string>();
}

export function getTradfiAsset(symbol: string): TradfiAsset | undefined {
  const clean = String(symbol || '').toUpperCase();
  return TRADFI_ASSETS.find(a => a.symbol === clean);
}

/**
 * Local time in America/New_York for an instant, reduced to a weekday index and minute-of-day.
 * Using an IANA zone makes the US equity session DST-correct.
 */
function newYorkClock(at: Date): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hourCycle: 'h23',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(at);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));

  return {
    weekday: weekdays[get('weekday')] ?? 0,
    minutes: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0)
  };
}

/**
 * Local time in America/New_York for an instant, reduced to a weekday index and minute-of-day.
 * Using an IANA zone makes the US equity session DST-correct.
 */

// ---------------------------------------------------------------------------------------------
// R-11 — `GET /fapi/v1/tradingSchedule` (cache diário) cruzado com `isTradfiMarketOpen`.
// O relógio puro de America/New_York não modela feriados nem horários reduzidos. O endpoint
// oficial da exchange devolve `marketSchedules` por mercado (EQUITY, COMMODITY, FX, CN_EQUITY,
// ...) com sessões `{ startTime, endTime, type }` — formato verificado contra a API real
// (tipos observados: REGULAR, NO_TRADING, PRE_MARKET, AFTER_MARKET, OVERNIGHT). Quando o
// endpoint responde, ele é a autoridade; quando não responde, mantemos o cálculo por
// America/New_York e registramos a suposição em `assumptions` (fallback documentado).
// ---------------------------------------------------------------------------------------------

export type TradingSessionType = 'REGULAR' | 'NO_TRADING' | 'PRE_MARKET' | 'AFTER_MARKET' | 'OVERNIGHT';

export interface TradingSession {
  startTime: number;
  endTime: number;
  type: TradingSessionType;
}

export interface TradingMarketSchedule {
  sessions: TradingSession[];
}

export type TradingSchedule = Record<string, TradingMarketSchedule>;

/** Categorias TradFi do projeto → chaves de mercado do endpoint. */
export const TRADFI_CATEGORY_TO_SCHEDULE_MARKET: Record<TradfiCategory, string> = {
  EQUITY: 'EQUITY',
  INDEX: 'EQUITY',   // índices seguem o mesmo calendário de equities (observado na API real)
  COMMODITY: 'COMMODITY',
  FOREX: 'FX'
};

/**
 * 6.1.4 — `underlyingType` reportado pelo `exchangeInfo` → chave do `tradingSchedule`.
 * Validado contra as chaves reais capturadas em `tests/fixtures/binance/tradingSchedule.json`
 * (EQUITY, COMMODITY, FX, CN_EQUITY, HK_EQUITY, KR_EQUITY).
 */
export const TRADFI_UNDERLYING_TO_SCHEDULE_MARKET: Record<string, string> = {
  EQUITY: 'EQUITY',
  INDEX: 'EQUITY',
  COMMODITY: 'COMMODITY',
  FX: 'FX',
  CN_EQUITY: 'CN_EQUITY',
  HK_EQUITY: 'HK_EQUITY',
  KR_EQUITY: 'KR_EQUITY'
};

/**
 * 6.1.4 — Categorias TradFi para as quais a exchange NÃO publica calendário.
 * O gate deve fechar (fail-closed): não existe sessão para avaliar, então esses símbolos
 * ficam fora do conjunto monitorado em vez de receberem horário inventado.
 */
export const TRADFI_UNDERLYING_NO_CALENDAR: ReadonlySet<string> = new Set(['PREMARKET']);

const TRADING_SCHEDULE_TTL_MS = 24 * 60 * 60 * 1000; // cache diário

let tradingScheduleCache: TradingSchedule | null = null;
let tradingScheduleFetchedAt = 0;
let tradingScheduleLastError: string | null = null;
const tradingScheduleAssumptions: Array<{ reason: string; since: number }> = [];

function recordScheduleAssumption(reason: string): void {
  const last = tradingScheduleAssumptions[tradingScheduleAssumptions.length - 1];
  if (last && last.reason === reason) {
    last.since = Date.now(); // mesma suposição vigente: atualiza o instante
    return;
  }
  tradingScheduleAssumptions.push({ reason, since: Date.now() });
  if (tradingScheduleAssumptions.length > 10) tradingScheduleAssumptions.shift();
}

/**
 * Busca (ou re-busca após o TTL de 24h) o calendário oficial da exchange.
 * `force` ignora o TTL. Retorna `true` quando existe calendário válido em cache após a chamada.
 * Falha NUNCA propaga: o fallback por relógio é registrado e o trading continua degradado,
 * não quebrado.
 */
export async function refreshTradingSchedule(force: boolean = false): Promise<boolean> {
  const now = Date.now();
  if (!force && tradingScheduleCache && now - tradingScheduleFetchedAt < TRADING_SCHEDULE_TTL_MS) {
    return true;
  }

  try {
    const { data } = await fetchWithFallback(() => '/fapi/v1/tradingSchedule');
    const markets = data?.marketSchedules;
    if (!markets || typeof markets !== 'object') {
      throw new Error('resposta sem marketSchedules');
    }

    const cleaned: TradingSchedule = {};
    for (const [market, schedule] of Object.entries(markets as Record<string, any>)) {
      if (!schedule || !Array.isArray(schedule.sessions)) continue;
      const sessions = (schedule.sessions as any[]).filter(
        s => Number.isFinite(Number(s?.startTime)) && Number.isFinite(Number(s?.endTime))
      ).map(s => ({
        startTime: Number(s.startTime),
        endTime: Number(s.endTime),
        type: (String(s.type || 'REGULAR').toUpperCase()) as TradingSessionType
      }));
      if (sessions.length > 0) cleaned[market] = { sessions };
    }

    if (Object.keys(cleaned).length === 0) {
      throw new Error('marketSchedules veio vazio');
    }

    tradingScheduleCache = cleaned;
    tradingScheduleFetchedAt = Date.now();
    tradingScheduleLastError = null;
    recordFeedSuccess('tradingSchedule');
    return true;
  } catch (err: any) {
    recordFeedFailure('tradingSchedule', err?.message || String(err));
    tradingScheduleLastError = err?.message || String(err);
    // Um calendário anterior ainda dentro de 2× TTL continua utilizável (aviso sem derrubar o gate).
    const usable = tradingScheduleCache !== null && now < tradingScheduleFetchedAt + TRADING_SCHEDULE_TTL_MS * 2;
    if (!usable) {
      tradingScheduleCache = null;
      recordScheduleAssumption(
        `tradingSchedule indisponível (${tradingScheduleLastError}); fechamento/abertura por America/New_York sem feriados.`
      );
    }
    return false;
  }
}

/** Estado observável do calendário, para operador e diagnóstico (R-13 consome o mesmo dado). */
export function getTradingScheduleStatus(): {
  active: 'EXCHANGE_SCHEDULE' | 'CLOCK_FALLBACK';
  lastFetchedAt: number | null;
  expiresAt: number | null;
  markets: string[];
  lastError: string | null;
  assumptions: Array<{ reason: string; since: number }>;
} {
  return {
    active: tradingScheduleCache !== null ? 'EXCHANGE_SCHEDULE' : 'CLOCK_FALLBACK',
    lastFetchedAt: tradingScheduleFetchedAt || null,
    expiresAt: tradingScheduleFetchedAt ? tradingScheduleFetchedAt + TRADING_SCHEDULE_TTL_MS : null,
    markets: tradingScheduleCache ? Object.keys(tradingScheduleCache) : [],
    lastError: tradingScheduleLastError,
    assumptions: [...tradingScheduleAssumptions]
  };
}

/**
 * Returns active TradFi trading session for a category or symbol at an instant.
 * M1.4: Derives session type and bounds from exchange tradingSchedule cache.
 */
export function getTradfiSession(
  symbolOrCategory: string | TradfiCategory,
  at: Date = new Date()
): { type: TradingSessionType; startsAt: number; endsAt: number } | null {
  if (!tradingScheduleCache) return null;

  let category: TradfiCategory | undefined;
  if (symbolOrCategory === 'EQUITY' || symbolOrCategory === 'INDEX' || symbolOrCategory === 'COMMODITY' || symbolOrCategory === 'FOREX') {
    category = symbolOrCategory;
  } else {
    const asset = getTradfiAsset(symbolOrCategory);
    category = asset?.tradfiCategory;
  }

  const marketKey = category ? (TRADFI_CATEGORY_TO_SCHEDULE_MARKET[category] || category) : 'EQUITY';
  const schedule = tradingScheduleCache[marketKey];
  if (!schedule || !Array.isArray(schedule.sessions)) return null;

  const t = at.getTime();
  const session = schedule.sessions.find(s => t >= s.startTime && t < s.endTime);
  if (!session) return null;

  return {
    type: session.type,
    startsAt: session.startTime,
    endsAt: session.endTime
  };
}

/**
 * Checks whether a given session type allows generating new trading signals.
 * D2 / M1.4: REGULAR, PRE_MARKET, and AFTER_MARKET allow new signals. OVERNIGHT and NO_TRADING block them.
 */
export function isTradfiSessionAllowed(sessionType: TradingSessionType): boolean {
  if (sessionType === 'OVERNIGHT' || sessionType === 'NO_TRADING') {
    return false;
  }
  const allowedEnv = process.env.TRADFI_ALLOWED_SESSIONS;
  if (allowedEnv) {
    const allowed = allowedEnv.split(',').map(s => s.trim().toUpperCase());
    return allowed.includes(sessionType);
  }
  return sessionType === 'REGULAR' || sessionType === 'PRE_MARKET' || sessionType === 'AFTER_MARKET';
}

/**
 * M1.6: Returns score bonus required during extended sessions (PRE_MARKET / AFTER_MARKET)
 * due to lower market liquidity.
 */
export function getTradfiExtendedScoreBonus(sessionType?: TradingSessionType | null): number {
  if (!sessionType) return 0;
  if (sessionType === 'PRE_MARKET' || sessionType === 'AFTER_MARKET') {
    const envBonus = Number(process.env.TRADFI_EXTENDED_MIN_SCORE_BONUS);
    return Number.isFinite(envBonus) && envBonus >= 0 ? envBonus : 5;
  }
  return 0;
}

/**
 * M1.3 / M1.4 / M1.5: Determines whether trading signals can be generated for an asset.
 * - PERPETUAL contracts (crypto) are never blocked by market calendars.
 * - TRADIFI_PERPETUAL contracts are verified against exchange tradingSchedule.
 * - Fail-closed if tradingSchedule is missing and TRADFI_SCHEDULE_FALLBACK is not 'clock'.
 */
export function canGenerateSignalsForAsset(
  asset: { symbol: string; contractType?: string; tradfiCategory?: TradfiCategory | null },
  at: Date = new Date()
): { allow: boolean; reason?: string; session?: TradingSessionType; scoreBonus?: number } {
  const contractType = String(asset.contractType || '').toUpperCase();

  // M1.3: Crypto perpetuals are NEVER blocked by traditional market calendar
  if (contractType !== 'TRADIFI_PERPETUAL') {
    return { allow: true };
  }

  const category = asset.tradfiCategory || 'EQUITY';
  const session = getTradfiSession(category, at);

  if (session) {
    if (isTradfiSessionAllowed(session.type)) {
      return {
        allow: true,
        session: session.type,
        scoreBonus: getTradfiExtendedScoreBonus(session.type)
      };
    }
    return {
      allow: false,
      session: session.type,
      reason: `Sessão tradicional ${session.type} fechada (mercado fechado para novos sinais).`
    };
  }

  // If no tradingSchedule cache is present
  if (process.env.TRADFI_SCHEDULE_FALLBACK === 'clock') {
    const open = isTradfiMarketOpenClock(category, at);
    if (!open) {
      return {
        allow: false,
        reason: `Mercado tradicional fechado pelo relógio de Nova York (fallback de horário).`
      };
    }
    return { allow: true, session: 'REGULAR', scoreBonus: 0 };
  }

  // Fail-closed (M1.5 / CA-1.3)
  incrementMetric('tradingScheduleBlocks');
  return {
    allow: false,
    reason: `tradingSchedule indisponível da exchange (fail-closed por segurança: mercado fechado para novos sinais).`
  };
}

/** Fallback clock evaluation using America/New_York timezone */
export function isTradfiMarketOpenClock(category: TradfiCategory, at: Date = new Date()): boolean {
  if (category === 'COMMODITY') return true;

  const { weekday, minutes } = newYorkClock(at);

  if (category === 'FOREX') {
    if (weekday === 6) return false;                        // Saturday: closed
    if (weekday === 0) return minutes >= 22 * 60;          // Sunday: opens 22:00 NY
    if (weekday === 5) return minutes < 22 * 60;           // Friday: closes 22:00 NY
    return true;
  }

  if (weekday === 0 || weekday === 6) return false;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

/** Test-only: injeta fixture de calendário sem rede. */
export function __applyTradingScheduleForTests(schedule: TradingSchedule, fetchedAt: number = Date.now()): void {
  tradingScheduleCache = schedule;
  tradingScheduleFetchedAt = fetchedAt;
  tradingScheduleLastError = null;
}

/** Test-only: limpa cache, erro e suposições do calendário. */
export function __resetTradingScheduleForTests(): void {
  tradingScheduleCache = null;
  tradingScheduleFetchedAt = 0;
  tradingScheduleLastError = null;
  tradingScheduleAssumptions.length = 0;
}

/**
 * Checks whether the underlying traditional market for a category is currently open.
 */
export function isTradfiMarketOpen(category: TradfiCategory, at: Date = new Date()): boolean {
  if (tradingScheduleCache) {
    const session = getTradfiSession(category, at);
    if (session) {
      return isTradfiSessionAllowed(session.type);
    }
    // If market category is absent from schedule, fallback to clock without inventing closure
    const marketKey = TRADFI_CATEGORY_TO_SCHEDULE_MARKET[category] || category;
    if (!tradingScheduleCache[marketKey]) {
      return isTradfiMarketOpenClock(category, at);
    }
    return false;
  }

  return isTradfiMarketOpenClock(category, at);
}

// Helper to fetch JSON safely with timeout, User-Agent, and detailed logging
async function fetchWithFallback(getPath: (ep: typeof REST_ENDPOINTS[0]) => string): Promise<{ data: any; endpoint: string }> {
  // Check if rate limiter has active cooldown (same semantics as requestJsonLimited)
  BinanceRateLimiter.assertAllowed();

  // Start trying from current working endpoint index, then wrap around
  for (let offset = 0; offset < REST_ENDPOINTS.length; offset++) {
    const idx = (currentWorkingBaseIndex + offset) % REST_ENDPOINTS.length;
    const ep = REST_ENDPOINTS[idx];
    const fullUrl = `${ep.base}${getPath(ep)}`;
    const startTime = Date.now();

    try {
      const response = await requestJson(fullUrl, { timeoutMs: 4000 });
      const latency = Date.now() - startTime;
      currentWorkingBaseIndex = idx; // Remember working endpoint

      // Update rate limiter weight from response headers
      BinanceRateLimiter.updateFromHeaders(response.headers);
      BinanceRateLimiter.recordSuccess();

      addBinanceLog(
        'SUCCESS',
        'REST_API',
        `Conexão bem-sucedida com Binance API (${ep.base}) em ${latency}ms [Status ${response.status}]`,
        { url: fullUrl, latencyMs: latency }
      );

      return { data: response.data, endpoint: ep.base };

    } catch (err: any) {
      const latency = Date.now() - startTime;
      const status = err?.status || 0;
      const errMsg = err?.message || 'Falha de conexão com a API';

      if (status === 429 || status === 418) {
        BinanceRateLimiter.triggerBackoff(status);
        BinanceRateLimiter.updateFromHeaders(err?.headers || {});
      }

      addBinanceLog(
        'WARN',
        'REST_API',
        `Falha na requisição para ${ep.base}: ${errMsg} (${latency}ms). Tentando servidor secundário...`,
        { url: fullUrl, error: errMsg, status }
      );
    }
  }

  throw new Error('Todos os servidores da Binance REST API estão inacessíveis no momento.');
}

// Memory cache for CVD & Historical Orderbook tracking
const cvdStateMap: Record<string, { buyVol: number; sellVol: number; netCvd: number }> = {};

let lastFallbackNoticeLogged = 0;

/**
 * Fetches 24h ticker data for Binance (combines WebSocket live cache + REST API fallback)
 */
export async function fetchBinanceFuturesTickers(symbolsToFilter?: string[]): Promise<any[]> {
  // 1. First check if real-time WebSocket ticker cache has data
  const wsTickers = getLiveWSTickers();
  const wsKeys = Object.keys(wsTickers);

  const targetSymbols = symbolsToFilter && symbolsToFilter.length > 0
    ? Array.from(new Set([...DEFAULT_SYMBOLS, ...symbolsToFilter]))
    : DEFAULT_SYMBOLS;

  if (wsKeys.length > 0) {
    const targetSet = new Set(targetSymbols);
    const matchedFromWS = Object.values(wsTickers).filter((t: any) => targetSet.has(t.symbol));
    if (matchedFromWS.length >= Math.min(3, targetSymbols.length * 0.3)) {
      // Return all matched tickers plus all live tickers so callers find any active monitored pair
      recordFeedSuccess('ticker');
      return Object.values(wsTickers);
    }
  }

  // 2. Fallback to REST API fetch across unrestricted endpoints
  try {
    const { data } = await fetchWithFallback((ep) => ep.tickerPath);
    if (Array.isArray(data)) {
      const targetSet = new Set(targetSymbols);
      const filtered = data.filter(item => item.symbol && (targetSet.has(item.symbol) || item.symbol.endsWith('USDT')));
      if (filtered.length > 0) {
        recordFeedSuccess('ticker');
        return filtered;
      }
      recordFeedSuccess('ticker');
      return data;
    }
    recordFeedFailure('ticker', 'resposta de tickers vazia/malformada');
    return [];
  } catch (err: any) {
    recordFeedFailure('ticker', err?.message || 'tickers REST inacessível');
    const now = Date.now();
    if (now - lastFallbackNoticeLogged > 30000) {
      addBinanceLog(
        'ERROR',
        'REST_API',
        `Aviso: REST APIs da Binance inacessíveis. Utilizando gerador de contingência sintética de mercado.`
      );
      lastFallbackNoticeLogged = now;
    }
    return [];
  }
}

// In-memory cache for Open Interest (30s TTL) and Funding Rate (60s TTL) to minimize outbound requests
const oiCache: Record<string, { value: number; timestamp: number; source: 'REST' | 'CACHE'; change24h?: number; change1h?: number }> = {};
const fundingCache: Record<string, { value: number; timestamp: number; source: 'REST' | 'CACHE'; intervalHours?: number }> = {};

/**
 * Fetches Open Interest and historical change for a Futures symbol
 * Uses /fapi/v1/openInterest and /futures/data/openInterestHist
 */
export async function fetchOpenInterest(symbol: string): Promise<{
  openInterest: number;
  source?: 'REST' | 'CACHE';
  isDegraded?: boolean;
  change24h?: number;
  change1h?: number;
}> {
  const cached = oiCache[symbol];
  const now = Date.now();
  if (cached && now - cached.timestamp < 30000) {
    return {
      openInterest: cached.value,
      source: cached.source,
      isDegraded: false,
      change24h: cached.change24h,
      change1h: cached.change1h
    };
  }

  const futuresEndpoints = [
    'https://fapi.binance.com',
    'https://fapi1.binance.com',
    'https://fapi2.binance.com',
    'https://fapi3.binance.com'
  ];

  let currentOI = 0;
  let fetchedOI = false;

  // R-5: fail closed while the limiter is in preventive cooldown — the symbol
  // degrades to CACHE/isDegraded instead of bypassing weight control.
  let limiterInCooldown = false;
  try {
    BinanceRateLimiter.assertAllowed();
  } catch {
    limiterInCooldown = true;
  }

  if (!limiterInCooldown) for (const base of futuresEndpoints) {
    try {
      // R-5: limiter-aware (weight accounting + 429/418 backoff)
      const res = await requestJsonLimited<{ openInterest?: string }>(`${base}/fapi/v1/openInterest?symbol=${symbol}`, { timeoutMs: 3000 });
      if (res.data?.openInterest) {
        const val = parseFloat(res.data.openInterest);
        if (!isNaN(val) && val > 0) {
          currentOI = val;
          fetchedOI = true;
          recordFeedSuccess('openInterest');
          break;
        }
      }
    } catch {
      // Try next endpoint
    }
  }
  // R-13: o fetch inteiro falhou (limiter em cooldown ou todos os endpoints) — conta como falha de feed.
  if (!fetchedOI) recordFeedFailure('openInterest', 'openInterest indisponível para ' + symbol);

  // Fetch real historical OI to compute actual 1h and 24h change
  let change1h = cached?.change1h || 0;
  let change24h = cached?.change24h || 0;

  if (fetchedOI) {
    for (const base of futuresEndpoints) {
      try {
        const histRes = await requestJsonLimited<Array<{ sumOpenInterest?: string; timestamp?: number }>>(
          `${base}/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=25`,
          { timeoutMs: 2500 }
        );
        if (Array.isArray(histRes.data) && histRes.data.length >= 2) {
          const list = histRes.data;
          const prev1h = parseFloat(list[list.length - 2]?.sumOpenInterest || '0');
          const prev24h = parseFloat(list[0]?.sumOpenInterest || '0');

          if (prev1h > 0) {
            change1h = Number((((currentOI - prev1h) / prev1h) * 100).toFixed(2));
          }
          if (prev24h > 0) {
            change24h = Number((((currentOI - prev24h) / prev24h) * 100).toFixed(2));
          }
          break;
        }
      } catch {
        // non-blocking
      }
    }

    oiCache[symbol] = {
      value: currentOI,
      timestamp: now,
      source: 'REST',
      change24h,
      change1h
    };

    return {
      openInterest: currentOI,
      source: 'REST',
      isDegraded: false,
      change24h,
      change1h
    };
  }

  // If remote is unreachable, return previous cached value or 0 with degraded flag
  return {
    openInterest: cached?.value || 0,
    source: 'CACHE',
    isDegraded: !cached,
    change24h: cached?.change24h || 0,
    change1h: cached?.change1h || 0
  };
}

/**
 * Documented fallback when the exchange does not publish a contract-specific funding interval.
 * 8h is the Binance USDⓈ-M default; it is a *default*, not a measurement (Phase 2.5.3).
 */
export const DEFAULT_FUNDING_INTERVAL_HOURS = 8;

// Global cache of contract-specific funding intervals (Phase 2.5.3).
// The interval is published by GET /fapi/v1/fundingInfo (an array for all symbols), NOT by
// /fapi/v1/premiumIndex — reading it from premiumIndex silently always produced the 8h default.
const fundingIntervalCache: { map: Record<string, number>; timestamp: number } = { map: {}, timestamp: 0 };
const FUNDING_INTERVAL_TTL_MS = 60 * 60 * 1000; // 1h

export async function getFundingIntervals(): Promise<Record<string, number>> {
  const now = Date.now();
  if (Object.keys(fundingIntervalCache.map).length > 0 && now - fundingIntervalCache.timestamp < FUNDING_INTERVAL_TTL_MS) {
    return fundingIntervalCache.map;
  }

  try {
    const { data } = await fetchWithFallback(() => '/fapi/v1/fundingInfo');
    if (Array.isArray(data)) {
      const map: Record<string, number> = {};
      for (const item of data) {
        const hours = Number(item?.fundingIntervalHours);
        if (item?.symbol && Number.isFinite(hours) && hours > 0) {
          map[item.symbol] = hours;
        }
      }
      if (Object.keys(map).length > 0) {
        fundingIntervalCache.map = map;
        fundingIntervalCache.timestamp = now;
        return map;
      }
    }
  } catch {
    // Non-fatal: keep the previous map (or the documented default) rather than failing the tick.
  }

  return fundingIntervalCache.map;
}

/**
 * Fetches Premium Index & Funding Rate with contract-specific funding interval
 */
export async function fetchFundingRate(symbol: string): Promise<{
  fundingRate: number;
  fundingIntervalHours: number;
  source?: 'REST' | 'CACHE';
  isDegraded?: boolean;
}> {
  const cached = fundingCache[symbol];
  const now = Date.now();
  if (cached && now - cached.timestamp < 60000) {
    return {
      fundingRate: cached.value,
      fundingIntervalHours: cached.intervalHours || 8,
      source: cached.source,
      isDegraded: false
    };
  }

  const futuresEndpoints = [
    'https://fapi.binance.com',
    'https://fapi1.binance.com',
    'https://fapi2.binance.com',
    'https://fapi3.binance.com'
  ];

  {
    try {
      const res = await fetchWithFallback(() => `/fapi/v1/premiumIndex?symbol=${symbol}`);

      if (res.data?.lastFundingRate) {
        const val = parseFloat(res.data.lastFundingRate);
        // Phase 2.5.3: resolve the real interval from /fapi/v1/fundingInfo.
        const intervals = await getFundingIntervals();
        const intervalHours = intervals[symbol] || cached?.intervalHours || DEFAULT_FUNDING_INTERVAL_HOURS;
        if (!isNaN(val)) {
          fundingCache[symbol] = {
            value: val,
            timestamp: now,
            source: 'REST',
            intervalHours
          };
          recordFeedSuccess('funding');
          return {
            fundingRate: val,
            fundingIntervalHours: intervalHours,
            source: 'REST',
            isDegraded: false
          };
        }
      }
    } catch (err: any) {
      recordFeedFailure('funding', err?.message || 'premiumIndex falhou para ' + symbol);
      // Fall through to the cached value below (and report isDegraded)
    }
  }

  return {
    fundingRate: cached?.value ?? 0,
    fundingIntervalHours: cached?.intervalHours || DEFAULT_FUNDING_INTERVAL_HOURS,
    source: 'CACHE',
    isDegraded: cached === undefined
  };
}

// Memory cache for Long/Short ratio data (45s TTL)
const lsCache: Record<string, { data: LongShortRatioData; timestamp: number }> = {};

/**
 * Fetches Long/Short account and position ratios from Binance Futures.
 *
 * Phase 2.5.2: returns `null` when every upstream endpoint fails. Previously this fabricated
 * "realistic" positioning with a sine wave, which then fed the Trapped Traders Index and awarded
 * real confluence points on invented data. Fabrication now requires ALLOW_SYNTHETIC_DATA='true'.
 */
export async function fetchLongShortRatio(symbol: string, currentPrice?: number): Promise<LongShortRatioData | null> {
  const cleanSymbol = symbol.toUpperCase();
  const now = Date.now();

  // R-5 (fail closed): durante o cooldown do limiter (429/418) nenhum caminho de
  // leitura deve servir dados — nem cache, nem o fallback sintético opt-in. Antes
  // o cache era consultado primeiro, então um endpoint "em castigo" ainda devolvia
  // posicionamento, mascarando o bloqueio.
  let limiterInCooldown = false;
  try {
    BinanceRateLimiter.assertAllowed();
  } catch {
    limiterInCooldown = true;
  }
  if (limiterInCooldown) return null;

  const cached = lsCache[cleanSymbol];
  if (cached && now - cached.timestamp < 45000) {
    return cached.data;
  }

  const futuresBases = [
    'https://fapi.binance.com',
    'https://fapi1.binance.com',
    'https://fapi2.binance.com',
    'https://fapi3.binance.com'
  ];

  let globalRatio = 1.0;
  let longAccountPct = 50.0;
  let shortAccountPct = 50.0;
  let topTraderPositionRatio = 1.0;
  let topTraderLongPositionPct = 50.0;
  let topTraderShortPositionPct = 50.0;
  let takerRatio = 1.0;
  let takerBuyVolUsd = 500000;
  let takerSellVolUsd = 500000;
  let fetchedAny = false;

  for (const base of futuresBases) {
    try {
      // 1. Global Account Long/Short Ratio
      const globalRes = await requestJsonLimited<any[]>(
        `${base}/futures/data/globalLongShortAccountRatio?symbol=${cleanSymbol}&period=15m&limit=1`,
        { timeoutMs: 2500 }
      );
      if (Array.isArray(globalRes.data) && globalRes.data.length > 0) {
        const item = globalRes.data[0];
        globalRatio = parseFloat(item.longShortRatio) || 1.0;
        longAccountPct = Number((parseFloat(item.longAccount) * 100).toFixed(1)) || 50.0;
        shortAccountPct = Number((parseFloat(item.shortAccount) * 100).toFixed(1)) || 50.0;
        fetchedAny = true;
      }

      // 2. Top Trader Position Ratio
      const topPosRes = await requestJsonLimited<any[]>(
        `${base}/futures/data/topLongShortPositionRatio?symbol=${cleanSymbol}&period=15m&limit=1`,
        { timeoutMs: 2500 }
      );
      if (Array.isArray(topPosRes.data) && topPosRes.data.length > 0) {
        const item = topPosRes.data[0];
        topTraderPositionRatio = parseFloat(item.longShortRatio) || 1.0;
        topTraderLongPositionPct = Number((parseFloat(item.longAccount) * 100).toFixed(1)) || 50.0;
        topTraderShortPositionPct = Number((parseFloat(item.shortAccount) * 100).toFixed(1)) || 50.0;
        fetchedAny = true;
      }

      // 3. Taker Buy/Sell Volume Ratio
      const takerRes = await requestJsonLimited<any[]>(
        `${base}/futures/data/takerlongshortRatio?symbol=${cleanSymbol}&period=15m&limit=1`,
        { timeoutMs: 2500 }
      );
      if (Array.isArray(takerRes.data) && takerRes.data.length > 0) {
        const item = takerRes.data[0];
        takerRatio = parseFloat(item.buySellRatio) || 1.0;
        takerBuyVolUsd = parseFloat(item.buyVol) || 500000;
        takerSellVolUsd = parseFloat(item.sellVol) || 500000;
        fetchedAny = true;
      }

      if (fetchedAny) break;
    } catch {
      // try next base endpoint
    }
  }

  // If remote was unreachable: fail closed. Fabrication is opt-in only.
  if (!fetchedAny) {
    recordFeedFailure('longShort', 'longShortRatio indisponível para ' + cleanSymbol);
    if (process.env.ALLOW_SYNTHETIC_DATA !== 'true') {
      return null;
    }

    const simulated = simulateLongShortRatio(cleanSymbol, currentPrice, now);
    lsCache[cleanSymbol] = { data: simulated, timestamp: now };
    return simulated;
  }

  recordFeedSuccess('longShort');
  const result: LongShortRatioData = {
    symbol: cleanSymbol,
    globalRatio,
    longAccountPct,
    shortAccountPct,
    topTraderAccountRatio: Number((globalRatio * 0.95).toFixed(2)),
    topTraderPositionRatio,
    topTraderLongPositionPct,
    topTraderShortPositionPct,
    takerRatio,
    takerBuyVolUsd,
    takerSellVolUsd,
    timestamp: now
  };

  lsCache[cleanSymbol] = { data: result, timestamp: now };
  return result;
}

/**
 * Calculates Trapped Traders Index (TTI), Wyckoff Absorption Ratio and Trapped Price Zones
 * Based on Price Action at Extreme Levels, CVD Imbalance, OI Spike and Long/Short Positioning
 */
export function calculateTrappedTradersAnalysis(
  symbol: string,
  currentPrice: number,
  klines: KlineCandle[],
  openInterest: number,
  fundingRate: number,
  lsData: LongShortRatioData,
  rangeProfile: { vah: number; val: number; poc: number },
  keyLevels: { support1: number; resistance1: number },
  takerBuyRatio: number
): TrappedTradersData {
  const now = Date.now();
  const liqSummary = getLiquidationsSummary(symbol, currentPrice);

  if (!klines || klines.length < 5) {
    return {
      status: 'BALANCED',
      trappedIndex: 30,
      trappedSide: 'NONE',
      trappedPriceZone: [currentPrice * 0.995, currentPrice * 1.005],
      trappedPocPrice: currentPrice,
      trappedVolumeUSD: 1000000,
      absorptionRatio: 25,
      divergenceType: 'NONE',
      crowdSentiment: 'NEUTRAL',
      smartMoneyBias: 'NEUTRAL',
      confluenceVerdict: 'Dados insuficientes para cálculo de absorção.',
      liquidationsSummary: liqSummary,
      updatedAt: now
    };
  }

  // 1. Analyze the last 3-5 candles for volume spikes and absorption wicks
  const inspectCandles = klines.slice(-5);
  let maxVolCandle = inspectCandles[0];
  inspectCandles.forEach(c => {
    if (c.volume > maxVolCandle.volume) {
      maxVolCandle = c;
    }
  });

  const maxCandleRange = Math.abs(maxVolCandle.high - maxVolCandle.low) || (currentPrice * 0.005);
  const maxCandleBody = Math.abs(maxVolCandle.close - maxVolCandle.open);
  const upperWick = maxVolCandle.high - Math.max(maxVolCandle.open, maxVolCandle.close);
  const lowerWick = Math.min(maxVolCandle.open, maxVolCandle.close) - maxVolCandle.low;

  const upperWickPct = (upperWick / maxCandleRange) * 100;
  const lowerWickPct = (lowerWick / maxCandleRange) * 100;

  const candleTakerBuyRatio = maxVolCandle.takerBuyVolume / (maxVolCandle.volume || 1);

  // 2. Proximity to Key Range Extremes (VAH / VAL / Resistance / Support)
  const distToHigh = Math.abs(currentPrice - Math.max(rangeProfile.vah, keyLevels.resistance1)) / currentPrice;
  const distToLow = Math.abs(currentPrice - Math.min(rangeProfile.val, keyLevels.support1)) / currentPrice;
  const isNearHigh = distToHigh <= 0.015 || currentPrice >= rangeProfile.vah * 0.995;
  const isNearLow = distToLow <= 0.015 || currentPrice <= rangeProfile.val * 1.005;

  // 3. Wyckoff Effort vs Result (Absorption Calculation)
  let bearishAbsorptionScore = 0;
  if (candleTakerBuyRatio > 0.52 && (upperWickPct > 35 || maxVolCandle.close <= (maxVolCandle.high + maxVolCandle.low) / 2)) {
    bearishAbsorptionScore = Math.min(100, Math.round(candleTakerBuyRatio * 75 + upperWickPct * 0.5));
  }
  let bullishAbsorptionScore = 0;
  if (candleTakerBuyRatio < 0.48 && (lowerWickPct > 35 || maxVolCandle.close >= (maxVolCandle.high + maxVolCandle.low) / 2)) {
    bullishAbsorptionScore = Math.min(100, Math.round((1 - candleTakerBuyRatio) * 75 + lowerWickPct * 0.5));
  }

  // 4. Crowd Sentiment & Smart Money Divergence
  let crowdSentiment: 'EXTREME_GREED' | 'BULLISH_CROWD' | 'NEUTRAL' | 'BEARISH_CROWD' | 'EXTREME_FEAR' = 'NEUTRAL';
  if (lsData.longAccountPct >= 72) crowdSentiment = 'EXTREME_GREED';
  else if (lsData.longAccountPct >= 60) crowdSentiment = 'BULLISH_CROWD';
  else if (lsData.shortAccountPct >= 72) crowdSentiment = 'EXTREME_FEAR';
  else if (lsData.shortAccountPct >= 60) crowdSentiment = 'BEARISH_CROWD';

  let smartMoneyBias: 'ACCUMULATING_SHORTS' | 'ACCUMULATING_LONGS' | 'NEUTRAL' = 'NEUTRAL';
  if (lsData.topTraderShortPositionPct > 54 && lsData.longAccountPct > 56) {
    smartMoneyBias = 'ACCUMULATING_SHORTS';
  } else if (lsData.topTraderLongPositionPct > 54 && lsData.shortAccountPct > 56) {
    smartMoneyBias = 'ACCUMULATING_LONGS';
  }

  // 5. Trapped Traders Evaluation
  let status: 'TRAPPED_LONGS' | 'TRAPPED_SHORTS' | 'BALANCED' = 'BALANCED';
  let trappedSide: 'LONG' | 'SHORT' | 'NONE' = 'NONE';
  let divergenceType: 'BEARISH_ABSORPTION' | 'BULLISH_ABSORPTION' | 'NONE' = 'NONE';
  let trappedIndex = 30;

  // Potential TRAPPED LONGS (Fade Short setup)
  if ((isNearHigh || maxVolCandle.high >= rangeProfile.vah) && (bearishAbsorptionScore >= 40 || lsData.longAccountPct >= 62)) {
    const crowdingBonus = Math.max(0, (lsData.longAccountPct - 50) * 1.5);
    const fundingBonus = fundingRate > 0.00015 ? 15 : 0;
    const smartDivergenceBonus = smartMoneyBias === 'ACCUMULATING_SHORTS' ? 15 : 0;
    const absorptionWeight = bearishAbsorptionScore * 0.45;

    trappedIndex = Math.min(100, Math.round(absorptionWeight + crowdingBonus + fundingBonus + smartDivergenceBonus));
    if (trappedIndex >= 52) {
      status = 'TRAPPED_LONGS';
      trappedSide = 'LONG';
      divergenceType = 'BEARISH_ABSORPTION';
    }
  }

  // Potential TRAPPED SHORTS (Short Squeeze setup)
  if ((isNearLow || maxVolCandle.low <= rangeProfile.val) && (bullishAbsorptionScore >= 40 || lsData.shortAccountPct >= 62)) {
    const crowdingBonus = Math.max(0, (lsData.shortAccountPct - 50) * 1.5);
    const fundingBonus = fundingRate < -0.0001 ? 15 : 0;
    const smartDivergenceBonus = smartMoneyBias === 'ACCUMULATING_LONGS' ? 15 : 0;
    const absorptionWeight = bullishAbsorptionScore * 0.45;

    trappedIndex = Math.min(100, Math.round(absorptionWeight + crowdingBonus + fundingBonus + smartDivergenceBonus));
    if (trappedIndex >= 52) {
      status = 'TRAPPED_SHORTS';
      trappedSide = 'SHORT';
      divergenceType = 'BULLISH_ABSORPTION';
    }
  }

  // 6. Define Trapped Price Zone & POC
  const trappedMin = status === 'TRAPPED_LONGS' 
    ? Math.min(maxVolCandle.low, currentPrice * 0.998)
    : Math.min(maxVolCandle.low, currentPrice * 0.995);
  const trappedMax = status === 'TRAPPED_LONGS'
    ? Math.max(maxVolCandle.high, currentPrice * 1.005)
    : Math.max(maxVolCandle.high, currentPrice * 1.002);

  const trappedPocPrice = parseFloat(((trappedMin + trappedMax + maxVolCandle.close * 2) / 4).toFixed(currentPrice > 100 ? 2 : 4));
  const trappedVolumeUSD = Math.round(maxVolCandle.volume * currentPrice * 0.65);
  const absorptionRatio = Math.max(bearishAbsorptionScore, bullishAbsorptionScore);

  // 7. Human readable institutional diagnosis
  let confluenceVerdict = 'Fluxo de liquidez e posicionamento de contratos equilibrados.';
  if (status === 'TRAPPED_LONGS') {
    confluenceVerdict = `Traders Compradores Presos no Topo (${trappedIndex}/100): ${lsData.longAccountPct}% Net Longs absorvidos na faixa de ${formatPriceString(trappedMin)} - ${formatPriceString(trappedMax)}. Absorção de compra de ${absorptionRatio}%. Alavancagem sob risco iminente de Long Flush.`;
  } else if (status === 'TRAPPED_SHORTS') {
    confluenceVerdict = `Traders Vendedores Presos no Fundo (${trappedIndex}/100): ${lsData.shortAccountPct}% Net Shorts absorvidos na faixa de ${formatPriceString(trappedMin)} - ${formatPriceString(trappedMax)}. Absorção de venda de ${absorptionRatio}%. Potencial elevado de Short Squeeze.`;
  }

  return {
    status,
    trappedIndex,
    trappedSide,
    trappedPriceZone: [trappedMin, trappedMax],
    trappedPocPrice,
    trappedVolumeUSD,
    absorptionRatio,
    divergenceType,
    crowdSentiment,
    smartMoneyBias,
    confluenceVerdict,
    liquidationsSummary: liqSummary,
    updatedAt: now
  };
}

// Memory cache for Klines with 10s TTL to optimize multi-strategy concurrent evaluations
const klineCache: Record<string, { candles: KlineCandle[]; timestamp: number; isSynthetic: boolean }> = {};

/**
 * Fetches Kline / Candlestick data (e.g. 5m, 15m, 30m, 1h, 4h)
 * Fail-closed: Never returns synthetic data silently.
 * Synthetic fallback is only activated if explicitly allowed via ALLOW_SYNTHETIC_DATA='true'.
 */
export async function fetchKlines(
  symbol: string,
  interval: string = '15m',
  limit: number = 50
): Promise<KlineCandle[]> {
  const cacheKey = `${symbol}_${interval}_${limit}`;
  const now = Date.now();
  if (klineCache[cacheKey] && (now - klineCache[cacheKey].timestamp < 10000)) {
    return klineCache[cacheKey].candles;
  }

  try {
    const { data } = await fetchWithFallback(
      (ep) => `${ep.klinePath}?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );

    if (Array.isArray(data) && data.length > 0) {
      const candles: KlineCandle[] = data.map((k: any) => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        takerBuyVolume: parseFloat(k[9]) || parseFloat(k[5]) * 0.52
      }));
      klineCache[cacheKey] = { candles, timestamp: now, isSynthetic: false };
      recordFeedSuccess('klines');
      return candles;
    }
  } catch (err: any) {
    recordFeedFailure('klines', err?.message || 'klines falhou para ' + symbol);
    addBinanceLog('WARN', 'REST_API', `Falha ao obter klines para ${symbol} (${interval}): ${err?.message || err}`);
  }

  // If cached candles exist from earlier real fetches, reuse them
  if (klineCache[cacheKey] && klineCache[cacheKey].candles.length > 0 && !klineCache[cacheKey].isSynthetic) {
    return klineCache[cacheKey].candles;
  }

  // Synthetic fallback strictly controlled by environment variable
  const allowSynthetic = process.env.ALLOW_SYNTHETIC_DATA === 'true';
  if (allowSynthetic) {
    const fallback = generateFallbackKlines(symbol, limit);
    klineCache[cacheKey] = { candles: fallback, timestamp: now, isSynthetic: true };
    return fallback;
  }

  // Fail-closed: return empty array rather than fabricating prices
  return [];
}

/**
 * Calculates Volume Profile (POC, VAH, VAL) from candle arrays
 */
export function calculateVolumeProfile(klines: KlineCandle[], binsCount: number = 24) {
  if (!klines.length) {
    return { vah: 0, val: 0, poc: 0, bins: [] };
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  klines.forEach(c => {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
  });

  const step = (maxPrice - minPrice) / binsCount || 1;
  const bins = Array.from({ length: binsCount }, (_, i) => ({
    priceMin: minPrice + i * step,
    priceMax: minPrice + (i + 1) * step,
    midPrice: minPrice + (i + 0.5) * step,
    volume: 0,
    buyVolume: 0
  }));

  let totalVolume = 0;
  klines.forEach(c => {
    const mid = (c.high + c.low) / 2;
    const binIdx = Math.min(Math.floor((mid - minPrice) / step), binsCount - 1);
    if (binIdx >= 0 && binIdx < binsCount) {
      bins[binIdx].volume += c.volume;
      bins[binIdx].buyVolume += c.takerBuyVolume;
      totalVolume += c.volume;
    }
  });

  // POC = bin with max volume
  let pocBin = bins[0];
  bins.forEach(b => {
    if (b.volume > pocBin.volume) pocBin = b;
  });

  // Value Area = 70% of total volume around POC
  const sortedBins = [...bins].sort((a, b) => b.volume - a.volume);
  let accumulatedVol = 0;
  const targetVol = totalVolume * 0.7;
  const valueBins: typeof bins = [];

  for (const b of sortedBins) {
    valueBins.push(b);
    accumulatedVol += b.volume;
    if (accumulatedVol >= targetVol) break;
  }

  const val = Math.min(...valueBins.map(b => b.priceMin));
  const vah = Math.max(...valueBins.map(b => b.priceMax));

  return {
    vah,
    val,
    poc: pocBin.midPrice,
    bins
  };
}

/**
 * Calculates Fibonacci Retracements (0.0, 0.236, 0.382, 0.5, 0.618, 0.68, 0.786, 1.0)
 * According to TradingView market structure rules:
 * - Downtrend: Swing High / HH is point 1, Swing Low / LL is point 0. Bounce retracement moves 0 -> 1.
 * - Uptrend: Swing Low / LL is point 1, Swing High / HH is point 0. Pullback retracement moves 0 -> 1.
 */
export function calculateFibonacci(klines: KlineCandle[], currentPrice: number) {
  if (!klines.length) {
    return {
      fib0: 0,
      fib236: 0,
      fib382: 0,
      fib50: 0,
      fib618: 0,
      fib68: 0,
      fib786: 0,
      fib100: 0,
      swingHigh: 0,
      swingLow: 0,
      inGoldenPocket: false,
      trend: 'UP' as const,
      point1Price: 0,
      point0Price: 0,
      point1Label: '1 (0.00)',
      point0Label: '0 (0.00)',
      point1Type: 'LL' as const,
      point0Type: 'HH' as const
    };
  }

  let swingHigh = -Infinity;
  let swingLow = Infinity;
  let hhIndex = 0;
  let llIndex = 0;

  klines.forEach((c, idx) => {
    if (c.high > swingHigh) {
      swingHigh = c.high;
      hhIndex = idx;
    }
    if (c.low < swingLow) {
      swingLow = c.low;
      llIndex = idx;
    }
  });

  const diff = swingHigh - swingLow;
  if (diff <= 0) {
    return {
      fib0: swingHigh,
      fib236: swingHigh,
      fib382: swingHigh,
      fib50: swingHigh,
      fib618: swingHigh,
      fib68: swingHigh,
      fib786: swingHigh,
      fib100: swingLow,
      swingHigh,
      swingLow,
      inGoldenPocket: false,
      trend: 'UP' as const,
      point1Price: swingLow,
      point0Price: swingHigh,
      point1Label: `1 (${formatPriceString(swingLow)})`,
      point0Label: `0 (${formatPriceString(swingHigh)})`,
      point1Type: 'LL' as const,
      point0Type: 'HH' as const
    };
  }

  // Determine market structure direction based on chronological sequence of HH and LL:
  // If HH occurred before LL (hhIndex < llIndex):
  // The impulse moved DOWN from HH (1) to LL (0).
  // Retracement bounces from 0 (LL) upwards towards 1 (HH).
  // If LL occurred before HH (llIndex < hhIndex):
  // The impulse moved UP from LL (1) to HH (0).
  // Retracement pulls back from 0 (HH) downwards towards 1 (LL).
  const isDownTrend = hhIndex < llIndex;

  let f0 = 0;
  let f236 = 0;
  let f382 = 0;
  let f50 = 0;
  let f618 = 0;
  let f68 = 0;
  let f786 = 0;
  let f100 = 0;

  if (isDownTrend) {
    // Downtrend: 1 is HH (swingHigh), 0 is LL (swingLow)
    f0 = swingLow;
    f236 = swingLow + diff * 0.236;
    f382 = swingLow + diff * 0.382;
    f50 = swingLow + diff * 0.50;
    f618 = swingLow + diff * 0.618;
    f68 = swingLow + diff * 0.68;
    f786 = swingLow + diff * 0.786;
    f100 = swingHigh;
  } else {
    // Uptrend: 1 is LL (swingLow), 0 is HH (swingHigh)
    f0 = swingHigh;
    f236 = swingHigh - diff * 0.236;
    f382 = swingHigh - diff * 0.382;
    f50 = swingHigh - diff * 0.50;
    f618 = swingHigh - diff * 0.618;
    f68 = swingHigh - diff * 0.68;
    f786 = swingHigh - diff * 0.786;
    f100 = swingLow;
  }

  // Golden Pocket zone: between 0.618 and 0.68 retracement
  const goldenTop = Math.max(f618, f68);
  const goldenBottom = Math.min(f618, f68);
  const inGoldenPocket = currentPrice >= goldenBottom * 0.998 && currentPrice <= goldenTop * 1.002;

  return {
    fib0: f0,
    fib236: f236,
    fib382: f382,
    fib50: f50,
    fib618: f618,
    fib68: f68,
    fib786: f786,
    fib100: f100,
    swingHigh,
    swingLow,
    inGoldenPocket,
    trend: isDownTrend ? ('DOWN' as const) : ('UP' as const),
    point1Price: isDownTrend ? swingHigh : swingLow,
    point0Price: isDownTrend ? swingLow : swingHigh,
    point1Label: isDownTrend ? `1 (${formatPriceString(swingHigh)})` : `1 (${formatPriceString(swingLow)})`,
    point0Label: isDownTrend ? `0 (${formatPriceString(swingLow)})` : `0 (${formatPriceString(swingHigh)})`,
    point1Type: isDownTrend ? ('HH' as const) : ('LL' as const),
    point0Type: isDownTrend ? ('LL' as const) : ('HH' as const)
  };
}

/**
 * Detects Fair Value Gaps (FVG) / Single Prints
 */
export function detectFVG(klines: KlineCandle[]) {
  if (klines.length < 3) return { hasSinglePrintFVG: false };

  // Look at last 5 candles for FVG
  for (let i = klines.length - 2; i >= 2; i--) {
    const c1 = klines[i - 2];
    const c3 = klines[i];

    // Bullish FVG: C3 Low > C1 High
    if (c3.low > c1.high) {
      return {
        hasSinglePrintFVG: true,
        fvgZone: { top: c3.low, bottom: c1.high, type: 'BULLISH' as const }
      };
    }
    // Bearish FVG: C3 High < C1 Low
    if (c3.high < c1.low) {
      return {
        hasSinglePrintFVG: true,
        fvgZone: { top: c1.low, bottom: c3.high, type: 'BEARISH' as const }
      };
    }
  }

  return { hasSinglePrintFVG: false };
}

/**
 * Normalizes raw order book levels into cumulative depth with USD calculation and wall detection
 */
function processDepthData(
  symbol: string,
  rawBids: string[][],
  rawAsks: string[][],
  timestamp: number
): OrderBookDepthData {
  const parsedBids = rawBids.map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) })).filter(b => b.price > 0 && b.qty > 0);
  const parsedAsks = rawAsks.map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) })).filter(a => a.price > 0 && a.qty > 0);

  // Sort bids descending (highest buy offer first), asks ascending (lowest sell offer first)
  parsedBids.sort((a, b) => b.price - a.price);
  parsedAsks.sort((a, b) => a.price - b.price);

  const bestBid = parsedBids[0]?.price || 1;
  const bestAsk = parsedAsks[0]?.price || bestBid * 1.0002;
  const spread = Math.max(0, bestAsk - bestBid);
  const midPrice = (bestBid + bestAsk) / 2;
  const spreadPct = midPrice > 0 ? (spread / midPrice) * 100 : 0;

  // Compute average qty to detect Whale Walls
  const allQtys = [...parsedBids.map(b => b.qty), ...parsedAsks.map(a => a.qty)];
  const avgQty = allQtys.length > 0 ? allQtys.reduce((acc, q) => acc + q, 0) / allQtys.length : 1;
  const wallThreshold = avgQty * 2.3;

  let cumBidQty = 0;
  let cumBidUsd = 0;
  let maxBidWall: OrderBookLevel | undefined;

  const bids: OrderBookLevel[] = parsedBids.map(b => {
    cumBidQty += b.qty;
    const usd = b.price * b.qty;
    cumBidUsd += usd;
    const isWall = b.qty >= wallThreshold;
    const level: OrderBookLevel = {
      price: b.price,
      qty: b.qty,
      totalQty: cumBidQty,
      totalUsd: cumBidUsd,
      deviationPct: Number((((b.price - midPrice) / midPrice) * 100).toFixed(3)),
      isWall
    };
    if (isWall && (!maxBidWall || b.qty > maxBidWall.qty)) {
      maxBidWall = level;
    }
    return level;
  });

  let cumAskQty = 0;
  let cumAskUsd = 0;
  let maxAskWall: OrderBookLevel | undefined;

  const asks: OrderBookLevel[] = parsedAsks.map(a => {
    cumAskQty += a.qty;
    const usd = a.price * a.qty;
    cumAskUsd += usd;
    const isWall = a.qty >= wallThreshold;
    const level: OrderBookLevel = {
      price: a.price,
      qty: a.qty,
      totalQty: cumAskQty,
      totalUsd: cumAskUsd,
      deviationPct: Number((((a.price - midPrice) / midPrice) * 100).toFixed(3)),
      isWall
    };
    if (isWall && (!maxAskWall || a.qty > maxAskWall.qty)) {
      maxAskWall = level;
    }
    return level;
  });

  const totalDepthUsd = cumBidUsd + cumAskUsd;
  const imbalancePct = totalDepthUsd > 0
    ? Number((((cumBidUsd - cumAskUsd) / totalDepthUsd) * 100).toFixed(2))
    : 0;
  const imbalanceRatio = cumAskUsd > 0 ? Number((cumBidUsd / cumAskUsd).toFixed(2)) : 1;

  let pressureLabel = 'LIVRO EQUILIBRADO (FLUXO NEUTRO)';
  let pressureBias: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';

  if (imbalancePct >= 20) {
    pressureLabel = 'FORTE PRESSÃO COMPRADORA (SUPORTE CARREGADO)';
    pressureBias = 'BUY';
  } else if (imbalancePct >= 7) {
    pressureLabel = 'MODERADA PRESSÃO COMPRADORA (BID DOMINANTE)';
    pressureBias = 'BUY';
  } else if (imbalancePct <= -20) {
    pressureLabel = 'FORTE PRESSÃO VENDEDORA (RESISTÊNCIA CARREGADA)';
    pressureBias = 'SELL';
  } else if (imbalancePct <= -7) {
    pressureLabel = 'MODERADA PRESSÃO VENDEDORA (ASK DOMINANTE)';
    pressureBias = 'SELL';
  }

  return {
    symbol,
    timestamp,
    bids,
    asks,
    spread,
    spreadPct,
    midPrice,
    bidDepthUsd: cumBidUsd,
    askDepthUsd: cumAskUsd,
    totalDepthUsd,
    imbalancePct,
    imbalanceRatio,
    pressureLabel,
    pressureBias,
    whaleWalls: {
      bidWall: maxBidWall,
      askWall: maxAskWall
    }
  };
}

/**
 * Generates synthetic high-fidelity Order Book Depth centered around the asset's active price
 */
export function generateSimulatedDepth(
  symbol: string,
  currentPrice: number = 100,
  limit: number = 35,
  timestamp: number = Date.now()
): OrderBookDepthData {
  let midPrice = currentPrice || 100;
  if (!currentPrice || currentPrice <= 0) {
    if (symbol.includes('BTC')) midPrice = 92000;
    else if (symbol.includes('ETH')) midPrice = 3400;
    else if (symbol.includes('SOL')) midPrice = 185;
    else if (symbol.includes('BNB')) midPrice = 640;
    else if (symbol.includes('XRP')) midPrice = 2.45;
    else if (symbol.includes('SPY')) midPrice = 585;
    else if (symbol.includes('GOLD')) midPrice = 2650;
    else midPrice = 50;
  }

  const spread = midPrice * 0.00015; // tight institutional spread
  const bestBid = midPrice - spread / 2;
  const bestAsk = midPrice + spread / 2;

  const rawBids: string[][] = [];
  const rawAsks: string[][] = [];

  // Seed with deterministic pseudo-random variations based on symbol and time
  const seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const biasFactor = Math.sin(seed + Math.floor(timestamp / 60000)) * 0.25; // slight natural cyclical shift

  const baseUnitQty = midPrice > 1000 ? 0.8 : midPrice > 100 ? 15 : midPrice > 1 ? 500 : 25000;

  for (let i = 0; i < limit; i++) {
    // Step size grows slightly as we move deeper into the order book
    const distPct = 0.0002 + (i / limit) * 0.02; // up to ~2% depth
    const bidPrice = bestBid * (1 - distPct);
    const askPrice = bestAsk * (1 + distPct);

    // Depth volume: increasing with distance + random variance + potential whale wall spike
    let bidQty = (baseUnitQty * (1 + i * 0.35)) * (0.7 + Math.random() * 0.6) * (1 + biasFactor);
    let askQty = (baseUnitQty * (1 + i * 0.35)) * (0.7 + Math.random() * 0.6) * (1 - biasFactor);

    // Inject deliberate institutional walls at ~tier 7 or 15
    if (i === 7 || i === 18) {
      if (Math.sin(seed + i) > 0) {
        bidQty *= 3.4; // Bid Wall
      } else {
        askQty *= 3.4; // Ask Wall
      }
    }

    rawBids.push([bidPrice.toFixed(midPrice > 10 ? 2 : 5), bidQty.toFixed(2)]);
    rawAsks.push([askPrice.toFixed(midPrice > 10 ? 2 : 5), askQty.toFixed(2)]);
  }

  return processDepthData(symbol, rawBids, rawAsks, timestamp);
}

/**
 * Fetches Order Book Depth (bids, asks) with depth imbalance and whale wall detection
 */
export async function fetchOrderBookDepth(
  symbol: string,
  currentPrice?: number,
  limit: number = 35
): Promise<OrderBookDepthData> {
  const cleanSymbol = symbol.toUpperCase();
  const now = Date.now();

  const isTradfi = TRADFI_ASSETS.some(a => a.symbol === cleanSymbol);

  if (!isTradfi) {
    const endpoints = [
      `https://fapi.binance.com/fapi/v1/depth?symbol=${cleanSymbol}&limit=${limit}`,
      `https://fapi1.binance.com/fapi/v1/depth?symbol=${cleanSymbol}&limit=${limit}`,
      `https://fapi2.binance.com/fapi/v1/depth?symbol=${cleanSymbol}&limit=${limit}`
    ];

    for (const url of endpoints) {
      try {
        const res = await requestJsonLimited<{ bids?: string[][]; asks?: string[][] }>(url, { timeoutMs: 2500 });
        if (res.data?.bids && res.data?.asks && res.data.bids.length > 0 && res.data.asks.length > 0) {
          recordFeedSuccess('depth');
          return processDepthData(cleanSymbol, res.data.bids, res.data.asks, now);
        }
      } catch {
        // try next endpoint
      }
    }
  }

  // R-13: caiu no depth simulado — o feed real de book não respondeu.
  recordFeedFailure('depth', 'book depth indisponível para ' + cleanSymbol + ' (usando simulado)');
  return generateSimulatedDepth(cleanSymbol, currentPrice, limit, now);
}
