/**
 * screenerScoring (Fase 6.4)
 *
 * Núcleo PURO do screener — sem rede, sem relógio, sem estado:
 *
 * - 6.4.6 / CA-4.5: o universo nasce do `exchangeInfo` (`status == TRADING`,
 *   `contractType` em PERPETUAL/TRADIFI_PERPETUAL, moeda de cotação
 *   configurável). Nada de `endsWith('USDT')` sobre a lista do ticker.
 * - 6.4.4 / CA-4.3: nenhuma métrica é derivada do nome do símbolo (o antigo
 *   `baseSymbolSeed = soma dos charCodes` fabricava OI, variação de OI e
 *   funding). Dados idênticos ⇒ scores idênticos, qualquer que seja o nome.
 * - 6.4.4 / CA-4.4: dado ausente vira `null`, o fator SAI do score, o score é
 *   renormalizado entre os fatores disponíveis e `availableFactors` lista o
 *   que de fato compôs o número (a UI mostra "n/d" para o que é null).
 * - 6.4.5: RVOL = quoteVolume 24h ÷ média de 20 dias do PRÓPRIO símbolo
 *   (klines diários; média calculada pelo caller). Sem benchmark fixo.
 * - 6.4.3: sem fallback spot — o screener só fala com `fapi`.
 */

export type ScreenerFactorName = 'rvol' | 'oiChange' | 'momentum' | 'funding';

export interface ScreenerWeights {
  rvolWeight: number;
  oiChangeWeight: number;
  priceMomentumWeight: number;
  fundingAnomalyWeight: number;
}

export interface ScreenerTickerInput {
  symbol: string;
  lastPrice: number;
  priceChangePercent24h: number;
  volume24h: number;
  quoteVolume24h: number;
  high24h: number;
  low24h: number;
}

export interface ScreenerFactorInputs {
  priceChangePercent24h: number;
  quoteVolume24h: number;
  /** RVOL real do próprio símbolo (média de 20 dias); null = fora do top-N. */
  rvol: number | null;
  /** Variação de OI 24h REAL (openInterestHist); null = indisponível. */
  openInterestChange24h: number | null;
  /** Funding REAL (premiumIndex); null = indisponível. */
  fundingRate: number | null;
  /** Intervalo real do contrato (fundingInfo) para anualização; null = padrão 8h. */
  fundingIntervalHours: number | null;
}

export interface ScreenerScoreResult {
  score: number;
  availableFactors: ScreenerFactorName[];
  /** Métricas reais/nulas para a UI (null ⇒ "n/d"). */
  metrics: {
    rvol: number | null;
    openInterestChange24h: number | null;
    openInterestChange1h: number | null;
    fundingRate: number | null;
    fundingRateAnnualized: number | null;
  };
}

// ============================================================================
// 6.4.6 / CA-4.5 — universo a partir do exchangeInfo
// ============================================================================

const ALLOWED_CONTRACT_TYPES = new Set(['PERPETUAL', 'TRADIFI_PERPETUAL']);
const TRADING_STATUS = 'TRADING';

/**
 * Constrói o universo monitorável a partir do `exchangeInfo`: somente
 * `status == TRADING`, `contractType` permitido e cotação na lista pedida.
 */
export function buildUniverseFromExchangeInfo(
  exchangeInfo: { symbols?: Array<Record<string, any>> } | null | undefined,
  options: { quoteAssets?: string[] } = {}
): Set<string> {
  const universe = new Set<string>();
  const quoteAssets = (options.quoteAssets ?? ['USDT']).map(q => q.toUpperCase());
  const symbols = exchangeInfo?.symbols;
  if (!Array.isArray(symbols)) return universe;

  for (const s of symbols) {
    if (String(s.status || '').toUpperCase() !== TRADING_STATUS) continue;
    const contractType = String(s.contractType || '').toUpperCase();
    if (!ALLOWED_CONTRACT_TYPES.has(contractType)) continue;
    const quote = String(s.quoteAsset || '').toUpperCase();
    if (!quoteAssets.includes(quote)) continue;
    const symbol = String(s.symbol || '').trim().toUpperCase();
    if (symbol) universe.add(symbol);
  }
  return universe;
}

// ============================================================================
// 6.4.5 — RVOL real (média de 20 dias do próprio símbolo)
// ==========================================================================

export const RVOL_LOOKBACK_DAYS = 20;
/** Padrão do spec: RVOL real apenas para os N melhores por volume. */
export const RVOL_TOP_N = 60;

/**
 * Média de quote volume dos últimos 20 klines DIÁRIOS (klines[0] = dia mais
 * recente já fechado é aceitável; caller passa a janela já recortada).
 */
export function averageDailyQuoteVolume(dailyKlines: Array<{ quoteVolume: number }>): number | null {
  if (!Array.isArray(dailyKlines) || dailyKlines.length === 0) return null;
  const sum = dailyKlines.reduce((acc, k) => acc + (Number(k.quoteVolume) || 0), 0);
  const avg = sum / dailyKlines.length;
  return avg > 0 ? avg : null;
}

/**
 * RVOL = quoteVolume 24h ÷ média de 20 dias do próprio símbolo.
 * Sem média disponível ⇒ null (fora do top-N ou histórico insuficiente).
 */
export function computeRealRvol(quoteVolume24h: number, avgDailyQuoteVolume: number | null): number | null {
  if (avgDailyQuoteVolume === null || avgDailyQuoteVolume <= 0) return null;
  if (!(quoteVolume24h > 0)) return null;
  return parseFloat(Math.min(8, Math.max(0, quoteVolume24h / avgDailyQuoteVolume)).toFixed(2));
}

/** Seleciona os N melhores símbolos por quote volume (para OI/funding/RVOL detalhados). */
export function topSymbolsByVolume<T extends { quoteVolume24h: number; symbol: string }>(
  tickers: T[],
  n: number = RVOL_TOP_N
): Set<string> {
  return new Set(
    [...tickers]
      .sort((a, b) => b.quoteVolume24h - a.quoteVolume24h)
      .slice(0, Math.max(0, n))
      .map(t => t.symbol)
  );
}

// ============================================================================
// 6.4.4 / CA-4.3 + CA-4.4 — score composto sem métricas do nome
// ============================================================================

/** Anualiza o funding com o intervalo REAL do contrato (8h apenas como padrão). */
export function annualizeFundingRate(fundingRate: number, fundingIntervalHours: number | null): number {
  const interval = fundingIntervalHours && fundingIntervalHours > 0 ? fundingIntervalHours : 8;
  const eventsPerYear = (365 * 24) / interval;
  return parseFloat((fundingRate * eventsPerYear * 100).toFixed(2));
}

/**
 * Score composto com renormalização: cada fator disponível vira 0..100
 * pontos e é ponderado pelo peso do usuário; o total é dividido pela soma dos
 * pesos dos fatores DISPONÍVEIS (renormalização). Fatores sem dado saem do
 * cálculo e de `availableFactors`.
 */
export function computeScreenerCompositeScore(
  _symbol: string,
  inputs: ScreenerFactorInputs,
  weights?: Partial<ScreenerWeights>
): ScreenerScoreResult {
  // O símbolo é deliberadamente ignorado no cálculo (CA-4.3): nenhuma métrica
  // pode depender do nome.
  void _symbol;

  const w: ScreenerWeights = {
    rvolWeight: weights?.rvolWeight ?? 35,
    oiChangeWeight: weights?.oiChangeWeight ?? 30,
    priceMomentumWeight: weights?.priceMomentumWeight ?? 20,
    fundingAnomalyWeight: weights?.fundingAnomalyWeight ?? 15
  };

  const metrics = {
    rvol: inputs.rvol,
    openInterestChange24h: inputs.openInterestChange24h,
    openInterestChange1h: inputs.openInterestChange24h !== null ? parseFloat((inputs.openInterestChange24h / 4).toFixed(2)) : null,
    fundingRate: inputs.fundingRate,
    fundingRateAnnualized:
      inputs.fundingRate !== null ? annualizeFundingRate(inputs.fundingRate, inputs.fundingIntervalHours) : null
  };

  const weightedPoints: Array<{ factor: ScreenerFactorName; weight: number; points: number }> = [];

  if (inputs.rvol !== null) {
    const points = Math.min(100, (inputs.rvol / 3.0) * 100);
    weightedPoints.push({ factor: 'rvol', weight: Math.max(0, w.rvolWeight), points });
  }
  if (inputs.openInterestChange24h !== null) {
    const points = Math.min(100, Math.max(0, (inputs.openInterestChange24h + 10) * 4));
    weightedPoints.push({ factor: 'oiChange', weight: Math.max(0, w.oiChangeWeight), points });
  }
  if (inputs.priceChangePercent24h !== null && Number.isFinite(inputs.priceChangePercent24h)) {
    const points = Math.min(100, Math.abs(inputs.priceChangePercent24h) * 5);
    weightedPoints.push({ factor: 'momentum', weight: Math.max(0, w.priceMomentumWeight), points });
  }
  if (inputs.fundingRate !== null) {
    const points = Math.min(100, Math.abs(inputs.fundingRate * 10000) * 15);
    weightedPoints.push({ factor: 'funding', weight: Math.max(0, w.fundingAnomalyWeight), points });
  }

  const totalWeight = weightedPoints.reduce((acc, f) => acc + f.weight, 0);
  let score = 15; // piso do score para candidatos presentes no universo
  if (weightedPoints.length > 0 && totalWeight > 0) {
    const weightedSum = weightedPoints.reduce((acc, f) => acc + f.points * f.weight, 0);
    score = Math.round(Math.min(99, Math.max(15, weightedSum / totalWeight)));
  }

  return {
    score,
    availableFactors: weightedPoints.map(f => f.factor),
    metrics
  };
}

// ============================================================================
// 6.4.3 / CA-4.2 — coleta sem fallback spot (dependências injetáveis)
// ============================================================================

export interface ScreenerFetchDeps {
  /** Busca a lista de tickers 24h (apenas endpoints fapi). */
  fetchTickers(url: string): Promise<Array<Record<string, any>>>;
  /** Busca o exchangeInfo para o universo. */
  fetchExchangeInfo(): Promise<Record<string, any>>;
  /** Cotações configuráveis (padrão USDT). */
  quoteAssets?: string[];
  /** Endpoints fapi a tentar, em ordem. */
  endpoints?: string[];
}

export interface ScreenerCandidatesResult {
  /** Tickerns dentro do universo (exchangeInfo) — ou vazio quando degradado. */
  tickers: ScreenerTickerInput[];
  universe: Set<string>;
  dataUnavailable: boolean;
  /** Feeds que falharam nesta coleta (para alerta/métrica de degradação). */
  degradedFeeds: string[];
}

const DEFAULT_SCREENER_ENDPOINTS = [
  'https://fapi.binance.com/fapi/v1/ticker/24hr',
  'https://fapi1.binance.com/fapi/v1/ticker/24hr'
];

/**
 * Coleta os candidatos do screener: tickers 24h do fapi filtrados pelo
 * universo do exchangeInfo. fapi fora ⇒ lista vazia + `dataUnavailable`
 * (NUNCA um fallback spot ou sintético no caminho do screener).
 */
export async function buildScreenerCandidates(deps: ScreenerFetchDeps): Promise<ScreenerCandidatesResult> {
  const endpoints = deps.endpoints ?? DEFAULT_SCREENER_ENDPOINTS;
  const degradedFeeds: string[] = [];

  // Universo a partir do exchangeInfo (6.4.6). Falha ⇒ universo vazio.
  let universe = new Set<string>();
  try {
    const info = await deps.fetchExchangeInfo();
    universe = buildUniverseFromExchangeInfo(info, { quoteAssets: deps.quoteAssets ?? ['USDT'] });
  } catch {
    degradedFeeds.push('exchangeInfo');
  }

  // Tickers 24h: somente fapi (6.4.3 — sem data-api.binance.vision/api/v3).
  let rawTickers: Array<Record<string, any>> = [];
  let tickersOk = false;
  for (const url of endpoints) {
    try {
      const data = await deps.fetchTickers(url);
      if (Array.isArray(data) && data.length > 0) {
        rawTickers = data;
        tickersOk = true;
        break;
      }
    } catch {
      // tenta o próximo endpoint fapi
    }
  }
  if (!tickersOk) {
    degradedFeeds.push('ticker/24hr');
  }

  if (!tickersOk || universe.size === 0) {
    return { tickers: [], universe, dataUnavailable: true, degradedFeeds };
  }

  const tickers: ScreenerTickerInput[] = [];
  for (const t of rawTickers) {
    const symbol = String(t.symbol || '').trim().toUpperCase();
    if (!symbol || !universe.has(symbol)) continue;
    tickers.push({
      symbol,
      lastPrice: parseFloat(t.lastPrice) || 0,
      priceChangePercent24h: parseFloat(t.priceChangePercent) || 0,
      volume24h: parseFloat(t.volume) || 0,
      quoteVolume24h: parseFloat(t.quoteVolume) || parseFloat(t.volume) * parseFloat(t.lastPrice) || 0,
      high24h: parseFloat(t.highPrice) || 0,
      low24h: parseFloat(t.lowPrice) || 0
    });
  }

  return { tickers, universe, dataUnavailable: false, degradedFeeds };
}
