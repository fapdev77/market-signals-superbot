import { ScreenerAsset, ScreenerSettings, ScreenerScanSummary, MarketSector } from '../../src/types.js';
import { requestJsonLimited } from '../utils/httpClient.js';
import { addBinanceLog } from '../binanceWebsocket.js';
import { getFavoriteSymbols, getScreenerSettings, saveScreenerSettings, getActiveSignals, setWatchedSymbol, DEFAULT_EXCLUDED_SYMBOLS } from '../db.js';
import { DEFAULT_SYMBOLS, getTradfiAsset, TRADFI_ASSETS } from '../binanceService.js';
// 6.4: núcleo puro do screener — universo via exchangeInfo, score sem
// métricas do nome, renormalização de fatores, RVOL real, sem fallback spot.
import {
  buildScreenerCandidates,
  computeScreenerCompositeScore,
  topSymbolsByVolume,
  averageDailyQuoteVolume,
  computeRealRvol,
  RVOL_LOOKBACK_DAYS,
  type ScreenerTickerInput
} from './screenerScoring.js';

// Classification mapping for sectors
const SECTOR_MAP: Record<string, { sector: MarketSector; tag: string }> = {
  BTCUSDT: { sector: 'L1_L2', tag: 'Store of Value / L1' },
  ETHUSDT: { sector: 'L1_L2', tag: 'Smart Contracts L1' },
  SOLUSDT: { sector: 'L1_L2', tag: 'High Performance L1' },
  BNBUSDT: { sector: 'L1_L2', tag: 'Exchange Ecosystem' },
  XRPUSDT: { sector: 'L1_L2', tag: 'Cross-Border Payments' },
  ADAUSDT: { sector: 'L1_L2', tag: 'PoS Smart Contracts L1' },
  DOGEUSDT: { sector: 'MEME', tag: 'OG Meme Coin' },
  SHIBUSDT: { sector: 'MEME', tag: 'Meme Ecosystem' },
  PEPEUSDT: { sector: 'MEME', tag: 'High Beta Meme' },
  WIFUSDT: { sector: 'MEME', tag: 'Solana Meme' },
  BONKUSDT: { sector: 'MEME', tag: 'Solana Meme' },
  FLOKIUSDT: { sector: 'MEME', tag: 'Gaming Meme' },
  SUIUSDT: { sector: 'L1_L2', tag: 'Move VM L1' },
  APTUSDT: { sector: 'L1_L2', tag: 'Move VM L1' },
  AVAXUSDT: { sector: 'L1_L2', tag: 'Subnet L1' },
  NEARUSDT: { sector: 'AI', tag: 'AI & Sharding L1' },
  LINKUSDT: { sector: 'DEFI', tag: 'Oracle Infrastructure' },
  AAVEUSDT: { sector: 'DEFI', tag: 'Lending Protocol' },
  UNIUSDT: { sector: 'DEFI', tag: 'DEX AMM' },
  MKRUSDT: { sector: 'DEFI', tag: 'Stablecoin RWA' },
  PENDLEUSDT: { sector: 'DEFI', tag: 'Yield Trading' },
  RENDERUSDT: { sector: 'AI', tag: 'Decentralized GPU' },
  FETUSDT: { sector: 'AI', tag: 'AI Agents Alliance' },
  TAOUSDT: { sector: 'AI', tag: 'Subnet Intelligence' },
  INJUSDT: { sector: 'DEFI', tag: 'Derivatives L1' },
  TIAUSDT: { sector: 'L1_L2', tag: 'Modular DA' },
  SEIUSDT: { sector: 'L1_L2', tag: 'Trading Optimized L1' },
  ARBUSDT: { sector: 'L1_L2', tag: 'Ethereum L2 Rollup' },
  OPUSDT: { sector: 'L1_L2', tag: 'Optimism L2 Superchain' },
  BCHUSDT: { sector: 'L1_L2', tag: 'P2P Electronic Cash' },
  LTCUSDT: { sector: 'L1_L2', tag: 'Scrypt PoW Payments' },
  // TradFi Equities / US Stocks & Commodities
  XAUUSDT: { sector: 'TRADFI', tag: 'Physical Gold / Ouro' },
  PAXGUSDT: { sector: 'TRADFI', tag: 'Tokenized Gold' },
  AAPLUSDT: { sector: 'TRADFI', tag: 'Apple Inc. / US Stock' },
  TSLAUSDT: { sector: 'TRADFI', tag: 'Tesla Inc. / US Stock' },
  NVDAUSDT: { sector: 'TRADFI', tag: 'NVIDIA Corp / US Stock' },
  MSFTUSDT: { sector: 'TRADFI', tag: 'Microsoft / US Stock' },
  AMZNUSDT: { sector: 'TRADFI', tag: 'Amazon.com / US Stock' },
  GOOGUSDT: { sector: 'TRADFI', tag: 'Alphabet / US Stock' },
  METAUSDT: { sector: 'TRADFI', tag: 'Meta Platforms / US Stock' },
  SPYUSDT: { sector: 'TRADFI', tag: 'S&P 500 ETF Index' },
  QQQUSDT: { sector: 'TRADFI', tag: 'Nasdaq 100 ETF Index' },
  // Stablecoins / Pegged assets mappings
  USDCUSDT: { sector: 'STABLECOIN', tag: 'USD Coin Stablecoin' },
  USDTUSDC: { sector: 'STABLECOIN', tag: 'Tether / USDC' },
  USDGUSDT: { sector: 'STABLECOIN', tag: 'Global Dollar Stablecoin' },
  USDTUSDG: { sector: 'STABLECOIN', tag: 'Tether / USDG' },
  PYUSDUSDT: { sector: 'STABLECOIN', tag: 'PayPal USD Stablecoin' },
  FDUSDUSDT: { sector: 'STABLECOIN', tag: 'First Digital USD' },
  USDTFDUSD: { sector: 'STABLECOIN', tag: 'Tether / FDUSD' },
  TUSDUSDT: { sector: 'STABLECOIN', tag: 'TrueUSD Stablecoin' },
  BUSDUSDT: { sector: 'STABLECOIN', tag: 'Binance USD' },
  USDPUSDT: { sector: 'STABLECOIN', tag: 'Pax Dollar' },
  EURUSDT: { sector: 'TRADFI', tag: 'Euro / USDT Forex' },
  AEURUSDT: { sector: 'TRADFI', tag: 'Anchored Euro' },
  DAIUSDT: { sector: 'STABLECOIN', tag: 'MakerDAO DAI' },
  USDEUSDT: { sector: 'STABLECOIN', tag: 'Ethena Synthetic Dollar' },
  USTCUSDT: { sector: 'STABLECOIN', tag: 'TerraClassicUSD' },
  WBTCUSDT: { sector: 'DEFI', tag: 'Wrapped Bitcoin' },
  USDCTUSD: { sector: 'STABLECOIN', tag: 'USDC / TUSD Peg' },
  EURSUSDT: { sector: 'TRADFI', tag: 'STASIS EURO' }
};

export class MarketScreenerService {
  private static instance: MarketScreenerService;
  private cachedScreenerAssets: ScreenerAsset[] = [];
  private lastSummary: ScreenerScanSummary | null = null;
  private isScanning = false;
  private activeMonitoredSymbols: string[] = [...DEFAULT_SYMBOLS];

  private constructor() {}

  public static getInstance(): MarketScreenerService {
    if (!MarketScreenerService.instance) {
      MarketScreenerService.instance = new MarketScreenerService();
    }
    return MarketScreenerService.instance;
  }

  public getMonitoredSymbols(): string[] {
    const tradfiSymbols = TRADFI_ASSETS.map(a => a.symbol);
    if (tradfiSymbols.length > 0) {
      return Array.from(new Set([...this.activeMonitoredSymbols, ...tradfiSymbols]));
    }
    return this.activeMonitoredSymbols;
  }

  public getCachedAssets(): ScreenerAsset[] {
    return this.cachedScreenerAssets;
  }

  public getLastSummary(): ScreenerScanSummary | null {
    return this.lastSummary;
  }

  /**
   * Identifies sector and category tag for a given symbol
   */
  public getSectorInfo(symbol: string): { sector: MarketSector; tag: string } {
    if (SECTOR_MAP[symbol]) return SECTOR_MAP[symbol];
    const s = symbol.toUpperCase();

    // Check dynamic TradFi registry
    const tradfi = getTradfiAsset(s);
    if (tradfi) {
      const tag = tradfi.tradfiCategory === 'EQUITY'
        ? 'US Stocks / Equity'
        : tradfi.tradfiCategory === 'INDEX'
        ? 'TradFi Index'
        : tradfi.tradfiCategory === 'COMMODITY'
        ? 'Commodity TradFi'
        : 'Forex TradFi';
      return { sector: 'TRADFI', tag };
    }

    if (
      s.includes('USDC') || s.includes('USDG') || s.includes('PYUSD') || 
      s.includes('FDUSD') || s.includes('TUSD') || s.includes('BUSD') || 
      s.includes('USDP') || s.includes('DAI') || s.includes('USDE') || s.includes('USTC')
    ) {
      return { sector: 'STABLECOIN', tag: 'Stablecoin / Pegged' };
    }
    if (s.includes('EUR') || s.includes('GBP') || s.includes('JPY') || s.includes('BRL')) {
      return { sector: 'TRADFI', tag: 'Forex Fiat Peg' };
    }
    if (s.includes('PEPE') || s.includes('DOGE') || s.includes('MEME') || s.includes('SHIB') || s.includes('WIF') || s.includes('BONK')) {
      return { sector: 'MEME', tag: 'Meme Token' };
    }
    if (s.includes('AI') || s.includes('GPT') || s.includes('FET') || s.includes('RNDR') || s.includes('RENDER') || s.includes('TAO')) {
      return { sector: 'AI', tag: 'Artificial Intelligence' };
    }
    if (s.includes('SWAP') || s.includes('LEND') || s.includes('FINANCE') || s.includes('AAVE') || s.includes('UNI')) {
      return { sector: 'DEFI', tag: 'DeFi Protocol' };
    }
    return { sector: 'L1_L2', tag: 'Layer 1 / Layer 2' };
  }

  /**
   * Main Dynamic Screener Algorithm:
   * 1. Fetches all 24h Futures tickers
   * 2. Filters by survival liquidity criteria (min volume $25M) and exclusion list
   * 3. Calculates Institutional Composite Momentum Score
   * 4. Merges with user favorites and active trades (hysteresis protection)
   * 5. Produces final active execution universe (completely omitting excluded assets)
   */
  public async runScreenerScan(force = false): Promise<{ assets: ScreenerAsset[]; summary: ScreenerScanSummary }> {
    if (this.isScanning) {
      return {
        assets: this.cachedScreenerAssets,
        summary: this.lastSummary || this.buildFallbackSummary()
      };
    }

    this.isScanning = true;
    const scanStartTime = Date.now();

    try {
      const settings: ScreenerSettings = await getScreenerSettings();
      const favorites = await getFavoriteSymbols();
      // R-2: o screener não deve repropor símbolos que já têm trade aberto — incluindo DEMO,
      // que o motor também gerencia.
      const activeSignals = await getActiveSignals('ALL');
      const symbolsWithActiveTrades = new Set(activeSignals.map(s => s.symbol));

      // Excluded symbols set (case-insensitive normalized)
      const rawExcluded = Array.isArray(settings.excludedSymbols) && settings.excludedSymbols.length > 0
        ? settings.excludedSymbols
        : DEFAULT_EXCLUDED_SYMBOLS;
      const excludedNormalizedList = Array.from(new Set(rawExcluded.map(s => s.trim().toUpperCase().replace(/[\/\-_]/g, ''))));
      const excludedSet = new Set<string>(excludedNormalizedList);

      // 1. Candidatos: tickers fapi filtrados pelo universo do exchangeInfo.
      // 6.4.3: SEM fallback spot; fapi fora ⇒ lista vazia + feed degradado.
      const { tickers, universe, dataUnavailable, degradedFeeds } = await buildScreenerCandidates({
        fetchTickers: async url => {
          const res = await requestJsonLimited<any[]>(url, { timeoutMs: 5000 });
          return Array.isArray(res.data) ? res.data : [];
        },
        fetchExchangeInfo: async () => {
          const res = await requestJsonLimited<any>('https://fapi.binance.com/fapi/v1/exchangeInfo', { timeoutMs: 8000 });
          return res.data;
        }
      });

      // Phase 2.5.6 / 6.4.3: nunca fabricar universo. Sem dado, sem candidatos.
      if (dataUnavailable || tickers.length === 0) {
        addBinanceLog(
          'WARN',
          'REST_API',
          `Screener sem dados do fapi (feeds degradados: ${degradedFeeds.join(', ') || 'nenhum'}). Universo vazio; nenhuma métrica inventada.`
        );
        const emptySummary = this.buildFallbackSummary();
        emptySummary.dataUnavailable = true;
        this.lastSummary = emptySummary;
        return { assets: [], summary: emptySummary };
      }

      // 2. Enriquecimento REAL para o top-N por volume (6.4.4/6.4.5):
      // OI e RVOL apenas do top-N; funding do lote premiumIndex/fundingInfo;
      // tudo sob o limiter (requestJsonLimited) e com cache.
      const topSet = topSymbolsByVolume(tickers);
      const oiChangeBySymbol = await this.fetchRealOiChanges([...topSet]);
      const { funding: fundingBySymbol, intervals: intervalBySymbol } = await this.fetchRealFundingBatch();
      const rvolBySymbol = await this.computeRealRvolBatch(tickers, topSet);

      // 3. Score composto a partir de dados reais (6.4.4/CA-4.3/CA-4.4).
      const processed: ScreenerAsset[] = tickers.map((ticker: ScreenerTickerInput) => {
        const symbol = ticker.symbol;
        const normalizedSymbol = symbol.trim().toUpperCase().replace(/[\/\-_]/g, '');
        const isExcluded = excludedSet.has(normalizedSymbol);

        const oiChange24h = oiChangeBySymbol.get(symbol) ?? null;
        const fundingRate = fundingBySymbol.get(symbol) ?? null;
        const rvol = rvolBySymbol.get(symbol) ?? null;

        const scored = isExcluded
          ? {
              score: 5,
              availableFactors: [] as string[],
              metrics: {
                rvol,
                openInterestChange24h: oiChange24h,
                openInterestChange1h: oiChange24h !== null ? parseFloat((oiChange24h / 4).toFixed(2)) : null,
                fundingRate,
                fundingRateAnnualized: fundingRate !== null ? parseFloat((fundingRate * 3 * 365 * 100).toFixed(2)) : null
              }
            }
          : computeScreenerCompositeScore(symbol, {
              priceChangePercent24h: ticker.priceChangePercent24h,
              quoteVolume24h: ticker.quoteVolume24h,
              rvol,
              openInterestChange24h: oiChange24h,
              fundingRate,
              fundingIntervalHours: intervalBySymbol.get(symbol) ?? null
            });

        // Sector classification
        const { sector, tag } = this.getSectorInfo(symbol);

        // Check if favorite
        const isFavorite = favorites.includes(symbol) || (favorites.length === 0 && DEFAULT_SYMBOLS.slice(0, 5).includes(symbol));

        return {
          symbol,
          baseAsset: symbol.replace(/(USDT|USDC|USD)$/, ''),
          quoteAsset: symbol.endsWith('USDC') ? 'USDC' : 'USDT',
          name: symbol,
          price: ticker.lastPrice || 1,
          priceChangePercent24h: ticker.priceChangePercent24h,
          volume24h: ticker.volume24h,
          quoteVolume24h: ticker.quoteVolume24h,
          high24h: ticker.high24h || ticker.lastPrice * 1.02,
          low24h: ticker.low24h || ticker.lastPrice * 0.98,
          // 6.4.4: null = indisponível ⇒ UI mostra "n/d". Nunca inventado.
          openInterest: null,
          openInterestChange1h: scored.metrics.openInterestChange1h,
          openInterestChange24h: scored.metrics.openInterestChange24h,
          fundingRate: scored.metrics.fundingRate,
          fundingRateAnnualized: scored.metrics.fundingRateAnnualized,
          rvol: scored.metrics.rvol,
          availableFactors: scored.availableFactors,
          compositeScore: scored.score,
          isFavorite,
          isMonitored: false,
          isExcluded,
          monitoringReason: 'NONE' as const,
          sector: isExcluded ? 'EXCLUDED' : sector,
          categoryTag: tag,
          lastScannedAt: Date.now()
        };
      });

      // 3. Filter for Screener Ranking based on Liquidity, Exclusion list & Meme preferences
      const filteredForRanking = processed.filter(a => {
        // Excluded assets (e.g. stablecoins) are completely omitted from ranking and dynamic radar selection
        if (a.isExcluded) return false;
        if (a.quoteVolume24h < settings.minVolume24hUsd && !a.isFavorite) return false;
        if (!settings.includeMemes && a.sector === 'MEME' && !a.isFavorite) return false;
        return true;
      });

      // Sort by Institutional Composite Score descending
      filteredForRanking.sort((a, b) => b.compositeScore - a.compositeScore);

      // 4. Determine Active Monitored Universe
      const monitoredSet = new Set<string>();

      // A. FAVORITES (Always Monitored UNLESS explicitly placed in exclusion list)
      processed.forEach(a => {
        if (a.isFavorite && !a.isExcluded) {
          monitoredSet.add(a.symbol);
          a.isMonitored = true;
          a.monitoringReason = 'FAVORITE';
        } else if (a.isExcluded) {
          a.isMonitored = false;
          a.monitoringReason = 'NONE';
        }
      });

      // B. HYSTERESIS PROTECTION (Active signals never dropped, unless explicitly excluded)
      processed.forEach(a => {
        if (symbolsWithActiveTrades.has(a.symbol) && !a.isExcluded) {
          monitoredSet.add(a.symbol);
          a.isMonitored = true;
          if (a.monitoringReason === 'NONE') {
            a.monitoringReason = 'ACTIVE_TRADE';
          }
        }
      });

      // C. DYNAMIC SCREENER TOP SELECTION (candidates strictly from filteredForRanking)
      if (settings.mode !== 'FAVORITES_ONLY') {
        const quota = settings.maxMonitoredDynamicAssets || 8;
        let addedDynamic = 0;

        for (const candidate of filteredForRanking) {
          if (addedDynamic >= quota) break;
          if (!monitoredSet.has(candidate.symbol) && !candidate.isExcluded) {
            monitoredSet.add(candidate.symbol);
            candidate.isMonitored = true;
            candidate.monitoringReason = 'SCREENER_TOP';
            addedDynamic++;
          }
        }
      }

      // Ensure base large caps always present if set is too small (unless user explicitly excluded them)
      if (monitoredSet.size < 6) {
        ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].forEach(s => {
          if (!excludedSet.has(s)) {
            monitoredSet.add(s);
            const found = processed.find(p => p.symbol === s);
            if (found) {
              found.isMonitored = true;
              found.monitoringReason = 'FAVORITE';
            }
          }
        });
      }

      // Absolute safety: remove any excluded symbols from monitoredSet
      for (const exc of excludedSet) {
        monitoredSet.delete(exc);
      }

      this.activeMonitoredSymbols = Array.from(monitoredSet);
      this.cachedScreenerAssets = processed;

      // 5. Update DB watched_symbols for monitored dynamic assets
      for (const a of processed) {
        if (a.isMonitored) {
          await setWatchedSymbol(a.symbol, a.isFavorite, a.monitoringReason, a.sector);
        }
      }

      // Build Summary
      const scanDuration = Date.now() - scanStartTime;
      const validAssets = processed.filter(p => !p.isExcluded);
      const sortedByGain = [...validAssets].sort((a, b) => b.priceChangePercent24h - a.priceChangePercent24h);
      const sortedByVol = [...validAssets].sort((a, b) => b.quoteVolume24h - a.quoteVolume24h);
      // 6.4.4: null ordena por último (indisponível não compete com dado real).
      const sortedByOi = [...validAssets].sort((a, b) => (b.openInterestChange24h ?? -Infinity) - (a.openInterestChange24h ?? -Infinity));
      const sortedByFunding = [...validAssets].sort((a, b) => Math.abs(b.fundingRate ?? 0) - Math.abs(a.fundingRate ?? 0));

      const summary: ScreenerScanSummary = {
        totalAssetsAvailable: processed.length,
        totalMonitored: this.activeMonitoredSymbols.length,
        favoritesCount: processed.filter(p => p.isFavorite && !p.isExcluded).length,
        dynamicCount: processed.filter(p => p.monitoringReason === 'SCREENER_TOP').length,
        excludedCount: processed.filter(p => p.isExcluded).length,
        topGainer: {
          symbol: sortedByGain[0]?.symbol || 'BTCUSDT',
          change: sortedByGain[0]?.priceChangePercent24h || 0
        },
        topVolume: {
          symbol: sortedByVol[0]?.symbol || 'BTCUSDT',
          quoteVolume: sortedByVol[0]?.quoteVolume24h || 0
        },
        topOiSurge: sortedByOi[0]?.openInterestChange24h != null
          ? { symbol: sortedByOi[0].symbol, oiChange: sortedByOi[0].openInterestChange24h }
          : undefined,
        highestFundingRate: sortedByFunding[0]?.fundingRate != null
          ? { symbol: sortedByFunding[0].symbol, rate: sortedByFunding[0].fundingRate }
          : undefined,
        lastScanDurationMs: scanDuration,
        timestamp: Date.now()
      };

      this.lastSummary = summary;
      settings.lastRescanTimestamp = Date.now();
      await saveScreenerSettings(settings);

      addBinanceLog(
        'SUCCESS',
        'REST_API',
        `Screener Dinâmico executado: ${this.activeMonitoredSymbols.length} ativos monitorados (${summary.favoritesCount} favoritos + ${summary.dynamicCount} radar dinâmico, ${summary.excludedCount} excluídos) em ${scanDuration}ms.`
      );

      return { assets: processed, summary };

    } catch (err: any) {
      console.error('Error running Market Screener scan:', err);
      const fallbackSummary = this.buildFallbackSummary();
      return { assets: this.cachedScreenerAssets, summary: fallbackSummary };
    } finally {
      this.isScanning = false;
    }
  }

  // ==========================================================================
  // 6.4.4 / 6.4.5 — enriquecimento REAL (sem métrica derivada do nome)
  // ==========================================================================

  /** Cache de funding real (premiumIndex em lote) — 5 min. */
  private fundingCache: { at: number; funding: Map<string, number>; intervals: Map<string, number | null> } | null = null;
  private fundingCachePromise: Promise<{ funding: Map<string, number>; intervals: Map<string, number | null> }> | null = null;
  /** Cache de variação de OI real (openInterestHist) por símbolo — 5 min. */
  private oiCache = new Map<string, { at: number; change24h: number | null }>();
  /** Cache de klines diários para RVOL por símbolo — 24 h. */
  private dailyKlinesCache = new Map<string, { at: number; avgQuoteVolume: number | null }>();

  /**
   * Funding real por símbolo: UMA chamada a `/fapi/v1/premiumIndex` (sem
   * symbol = todos, peso baixo) + intervalos do `fundingInfo` (com fallback
   * 8h). Cache de 5 min; tudo sob o limiter (requestJsonLimited).
   */
  private async fetchRealFundingBatch(): Promise<{ funding: Map<string, number>; intervals: Map<string, number | null> }> {
    const TTL = 5 * 60 * 1000;
    if (this.fundingCache && Date.now() - this.fundingCache.at < TTL) {
      return { funding: this.fundingCache.funding, intervals: this.fundingCache.intervals };
    }
    if (this.fundingCachePromise) return this.fundingCachePromise;

    this.fundingCachePromise = (async () => {
      const funding = new Map<string, number>();
      const intervals = new Map<string, number | null>();
      try {
        const res = await requestJsonLimited<any[]>('https://fapi.binance.com/fapi/v1/premiumIndex', { timeoutMs: 8000 });
        if (Array.isArray(res.data)) {
          for (const item of res.data) {
            const symbol = String(item?.symbol || '').toUpperCase();
            const rate = parseFloat(item?.lastFundingRate);
            if (symbol && Number.isFinite(rate)) funding.set(symbol, rate);
          }
        }
      } catch {
        // Sem funding: todos ficam null (fator sai do score) — nunca inventado.
      }
      try {
        const res = await requestJsonLimited<any[]>('https://fapi.binance.com/fapi/v1/fundingInfo', { timeoutMs: 8000 });
        if (Array.isArray(res.data)) {
          for (const item of res.data) {
            const symbol = String(item?.symbol || '').toUpperCase();
            const hours = Number(item?.fundingIntervalHours);
            intervals.set(symbol, Number.isFinite(hours) && hours > 0 ? hours : null);
          }
        }
      } catch {
        // Intervalos ausentes ⇒ anualização usa o padrão 8h.
      }
      this.fundingCache = { at: Date.now(), funding, intervals };
      return { funding, intervals };
    })();

    try {
      return await this.fundingCachePromise;
    } finally {
      this.fundingCachePromise = null;
    }
  }

  /**
   * Variação de OI real por símbolo via `/futures/data/openInterestHist`
   * (period=5m, limit=500 ⇒ janela de ~41h; a variação é do início ao fim da
   * janela obtida). Apenas para o top-N; cache de 5 min.
   */
  private async fetchRealOiChanges(symbols: string[]): Promise<Map<string, number | null>> {
    const TTL = 5 * 60 * 1000;
    const now = Date.now();
    const result = new Map<string, number | null>();
    const toFetch: string[] = [];

    for (const symbol of symbols) {
      const cached = this.oiCache.get(symbol);
      if (cached && now - cached.at < TTL) {
        result.set(symbol, cached.change24h);
      } else {
        toFetch.push(symbol);
      }
    }

    await Promise.allSettled(
      toFetch.map(async symbol => {
        try {
          const res = await requestJsonLimited<any[]>(
            `https://fapi.binance.com/futures/data/openInterestHist?symbol=${encodeURIComponent(symbol)}&period=5m&limit=500`,
            { timeoutMs: 6000 }
          );
          const rows = Array.isArray(res.data) ? res.data : [];
          let change: number | null = null;
          if (rows.length >= 2) {
            const latest = parseFloat(rows[rows.length - 1]?.sumOpenInterest);
            const oldest = parseFloat(rows[0]?.sumOpenInterest);
            if (Number.isFinite(latest) && Number.isFinite(oldest) && oldest > 0) {
              change = parseFloat((((latest - oldest) / oldest) * 100).toFixed(2));
            }
          }
          this.oiCache.set(symbol, { at: now, change24h: change });
          result.set(symbol, change);
        } catch {
          this.oiCache.set(symbol, { at: now, change24h: null });
          result.set(symbol, null);
        }
      })
    );

    return result;
  }

  /**
   * RVOL real (6.4.5): quoteVolume 24h ÷ média de 20 klines diários do
   * PRÓPRIO símbolo. Apenas para o top-N por volume; cache de 24 h.
   */
  private async computeRealRvolBatch(
    tickers: ScreenerTickerInput[],
    topSet: Set<string>
  ): Promise<Map<string, number | null>> {
    const now = Date.now();
    const result = new Map<string, number | null>();
    const toFetch: string[] = [];

    for (const t of tickers) {
      if (!topSet.has(t.symbol)) {
        result.set(t.symbol, null); // fora do top-N ⇒ rvol: null (spec 6.4.5)
        continue;
      }
      const cached = this.dailyKlinesCache.get(t.symbol);
      if (cached && now - cached.at < 24 * 60 * 60 * 1000) {
        result.set(t.symbol, computeRealRvol(t.quoteVolume24h, cached.avgQuoteVolume));
      } else {
        toFetch.push(t.symbol);
      }
    }

    // Top-N em série com pequenas bateladas para não estourar o peso do limiter.
    const BATCH = 8;
    for (let i = 0; i < toFetch.length; i += BATCH) {
      const slice = toFetch.slice(i, i + BATCH);
      await Promise.allSettled(
        slice.map(async symbol => {
          try {
            // limit=21 e descarte do último: exclui o candle DIÁRIO em formação
            // da média (senão o dia parcial distorceria o RVOL).
            const res = await requestJsonLimited<any[]>(
              `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=1d&limit=21`,
              { timeoutMs: 6000 }
            );
            const rowsAll = Array.isArray(res.data) ? res.data : [];
            const rows = rowsAll.length > 1 ? rowsAll.slice(0, -1) : [];
            const klines = rows.map(k => ({ quoteVolume: parseFloat(k?.[7]) || 0 }));
            const avg = averageDailyQuoteVolume(klines.slice(0, RVOL_LOOKBACK_DAYS));
            this.dailyKlinesCache.set(symbol, { at: now, avgQuoteVolume: avg });
            const ticker = tickers.find(t => t.symbol === symbol);
            result.set(symbol, ticker ? computeRealRvol(ticker.quoteVolume24h, avg) : null);
          } catch {
            this.dailyKlinesCache.set(symbol, { at: now, avgQuoteVolume: null });
            result.set(symbol, null);
          }
        })
      );
    }

    return result;
  }

  /**
   * Phase 2.5.6: this used to report invented leaders (SUIUSDT +12.4%, PEPEUSDT funding 0.00045) as
   * though they were observed, and the UI rendered them as live. It now reports only what is actually
   * known: the cached asset list and the monitored-symbol counts. Leader fields stay undefined when no
   * scan has produced them.
   */
  private buildFallbackSummary(): ScreenerScanSummary {
    return {
      totalAssetsAvailable: this.cachedScreenerAssets.length,
      totalMonitored: this.activeMonitoredSymbols.length,
      favoritesCount: this.cachedScreenerAssets.filter(a => a.isFavorite).length,
      dynamicCount: this.activeMonitoredSymbols.length,
      excludedCount: this.cachedScreenerAssets.filter(a => a.isExcluded).length,
      lastScanDurationMs: 0,
      timestamp: Date.now()
    };
  }

}

export const marketScreener = MarketScreenerService.getInstance();
