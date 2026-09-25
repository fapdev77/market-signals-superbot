import React, { useState, useMemo, useEffect } from 'react';
import { TradeSignal, TickerData, AIReviewResponse, MarketType, IndicatorWeights } from '../types';
import { formatPrice, formatPriceRange, calculateTradeMetrics, formatDateTime, formatTimeAgo } from '../utils/formatters';
import { calculateTtlProgress, formatTtlDuration, DEFAULT_SIGNAL_TTL_SETTINGS, REGIME_PRESETS } from '../utils/signalTtlUtils';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Brain, 
  RefreshCw, 
  Clock, 
  Calendar,
  AlertTriangle, 
  CheckCircle2, 
  Activity,
  Search,
  X,
  ArrowUpDown,
  SlidersHorizontal,
  Layers,
  Filter,
  Sliders,
  Sparkles,
  RotateCcw,
  LineChart,
  Timer,
  Shield,
  Hourglass,
  Gauge,
  Target,
  Flame,
  Settings,
  ShieldCheck,
  CheckCheck
} from 'lucide-react';
import { Tooltip } from './Tooltip';

export type SortOption = 
  | 'confidence_desc'
  | 'confidence_asc'
  | 'winrate_desc'
  | 'rr_desc'
  | 'ttl_asc'
  | 'ttl_desc'
  | 'newest'
  | 'oldest';

export type AssetClassFilter = 'ALL' | 'crypto_futures' | 'crypto_spot' | 'tradfi';
export type CategoryFilter = 'ALL' | 'SCALP' | 'DAY_TRADE' | 'INTRADAY' | 'SWING' | 'POSITION';
export type LifecycleFilter = 'ALL' | 'ACTIVE' | 'NEAR_EXPIRY' | 'BREAKEVEN' | 'TARGET_REACHED' | 'STOPPED_OUT' | 'EXPIRED';

export type TriggerFilter = 
  | 'ALL'
  | 'FIBONACCI'
  | 'CVD'
  | 'OI'
  | 'VOLUME_PROFILE'
  | 'FVG'
  | 'BOS'
  | 'FUNDING_RATE'
  | 'SUPPORT_RESISTANCE';

interface SignalsMatrixProps {
  signals: TradeSignal[];
  tickers: TickerData[];
  weights?: IndicatorWeights;
  onRequestAIReview?: (ticker: TickerData, signal?: TradeSignal) => void;
  onSelectSignal?: (signal: TradeSignal, autoRunAI?: boolean) => void;
  onNavigateToSettings?: () => void;
}

export const SignalsMatrix: React.FC<SignalsMatrixProps> = ({
  signals = [],
  tickers = [],
  weights,
  onRequestAIReview,
  onSelectSignal,
  onNavigateToSettings
}) => {
  // Existing validation & direction filters
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [validationFilter, setValidationFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING' | 'REJECTED'>('ALL');
  
  // Strategy Category & Lifecycle filters
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('ALL');

  // Real-time second clock for live TTL ticking
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const ttlSettings = weights?.signalTtlSettings || DEFAULT_SIGNAL_TTL_SETTINGS;
  const currentRegimeInfo = REGIME_PRESETS[ttlSettings.marketRegime] || REGIME_PRESETS.NORMAL;

  // New search, sort, asset class & indicator trigger filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('confidence_desc');
  const [assetClassFilter, setAssetClassFilter] = useState<AssetClassFilter>('ALL');
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>('ALL');

  const [selectedAIReview, setSelectedAIReview] = useState<AIReviewResponse | null>(null);
  const [loadingSymbol, setLoadingSymbol] = useState<string | null>(null);

  // Helper to determine asset class
  const getSignalAssetClass = (s: TradeSignal): MarketType => {
    if (s.marketType) return s.marketType;
    const ticker = tickers.find(t => t.symbol === s.symbol);
    if (ticker?.marketType) return ticker.marketType;
    if (['SPY', 'QQQ', 'NVDA', 'AAPL', 'TSLA', 'GLD', 'PETR4', 'VALE3', 'EURUSD'].includes(s.symbol)) {
      return 'tradfi';
    }
    return 'crypto_futures';
  };

  // Helper to check if a specific factor matches a trigger filter
  const checkFactorMatchesTrigger = (factor: string, trigger: TriggerFilter): boolean => {
    const f = factor.toLowerCase();
    switch (trigger) {
      case 'FIBONACCI':
        return /fib|golden pocket|0\.618|0\.68/.test(f);
      case 'CVD':
        return /cvd|delta|taker|compradora|vendedora|agressão/.test(f);
      case 'OI':
        return /open interest|\boi\b|contratos|posiç|aberto/.test(f);
      case 'VOLUME_PROFILE':
        return /poc|vah|val|value area|volume profile|perfil/.test(f);
      case 'FVG':
        return /fvg|fair value gap|single print|desbalanço/.test(f);
      case 'BOS':
        return /bos|market structure break|rompimento de estrutura|estrutura/.test(f);
      case 'FUNDING_RATE':
        return /funding|taxa|squeeze|long flush|short squeeze/.test(f);
      case 'SUPPORT_RESISTANCE':
        return /support|resistance|suporte|resistência|rebound|rejeição|bounce|nível chave/.test(f);
      default:
        return false;
    }
  };

  // Helper to check if signal matches trigger
  const checkSignalTrigger = (s: TradeSignal, trigger: TriggerFilter): boolean => {
    if (trigger === 'ALL') return true;
    const ticker = tickers.find(t => t.symbol === s.symbol);
    const factors = (s.confluenceFactors || []).join(' ').toLowerCase();
    const reason = (ticker?.signalReason || '').toLowerCase();
    const text = `${factors} ${reason} ${s.validationStage || ''}`;

    switch (trigger) {
      case 'FIBONACCI':
        return /fib|golden pocket|0\.618|0\.68/.test(text) || !!ticker?.fibonacci?.inGoldenPocket;
      case 'CVD':
        return /cvd|delta|taker|compradora|vendedora|agressão/.test(text) || (ticker ? Math.abs(ticker.cvdDeltaPercent || 0) > 0.3 : false);
      case 'OI':
        return /open interest|\boi\b|contratos|posiç|aberto/.test(text) || (ticker ? Math.abs(ticker.openInterestChange1h || 0) > 0.2 : false);
      case 'VOLUME_PROFILE':
        return /poc|vah|val|value area|volume profile|perfil/.test(text) || !!ticker?.rangeProfile?.inValueArea;
      case 'FVG':
        return /fvg|fair value gap|single print|desbalanço/.test(text) || !!ticker?.keyLevels?.hasSinglePrintFVG;
      case 'BOS':
        return /bos|market structure break|rompimento de estrutura|estrutura/.test(text) || (ticker ? ticker.keyLevels?.structureBreak !== 'NONE' : false);
      case 'FUNDING_RATE':
        return /funding|taxa|squeeze|long flush|short squeeze/.test(text) || (ticker ? Math.abs(ticker.fundingRate || 0) >= 0.0001 : false);
      case 'SUPPORT_RESISTANCE':
        return /support|resistance|suporte|resistência|rebound|rejeição|bounce|nível chave/.test(text);
      default:
        return true;
    }
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = {
      ALL: (signals || []).length,
      SCALP: 0,
      DAY_TRADE: 0,
      INTRADAY: 0,
      SWING: 0,
      POSITION: 0
    };
    (signals || []).forEach(s => {
      const cat = (s.strategyCategory || 'INTRADAY') as keyof typeof counts;
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    });
    return counts;
  }, [signals]);

  // Institutional Lifecycle & TTL status counts
  const lifecycleCounts = useMemo(() => {
    const counts = {
      ALL: (signals || []).length,
      ACTIVE: 0,
      NEAR_EXPIRY: 0,
      BREAKEVEN: 0,
      TARGET_REACHED: 0,
      STOPPED_OUT: 0,
      EXPIRED: 0
    };
    (signals || []).forEach(s => {
      if (s.status === 'ACTIVE') counts.ACTIVE++;
      if (s.status === 'TARGET_REACHED') counts.TARGET_REACHED++;
      if (s.status === 'STOPPED_OUT') counts.STOPPED_OUT++;
      if (s.status === 'EXPIRED') counts.EXPIRED++;
      if (s.isBreakevenActive) counts.BREAKEVEN++;

      const prog = calculateTtlProgress(s, ttlSettings, now);
      if (s.status === 'ACTIVE' && prog.isNearExpiry) {
        counts.NEAR_EXPIRY++;
      }
    });
    return counts;
  }, [signals, ttlSettings, now]);

  // Institutional HUD Header Metrics
  const hudMetrics = useMemo(() => {
    const active = (signals || []).filter(s => s.status === 'ACTIVE');
    const totalConf = (signals || []).reduce((acc, s) => acc + (s.confluenceScore || 0), 0);
    const avgConf = signals.length > 0 ? Math.round(totalConf / signals.length) : 0;
    const totalWinRate = (signals || []).reduce((acc, s) => acc + (s.backtestWinRate || 0), 0);
    const avgWinRate = signals.length > 0 ? (totalWinRate / signals.length).toFixed(1) : '0.0';

    return {
      total: signals.length,
      active: active.length,
      avgConfluence: avgConf,
      avgWinRate,
      breakevenCount: lifecycleCounts.BREAKEVEN,
      nearExpiryCount: lifecycleCounts.NEAR_EXPIRY,
      targetReachedCount: lifecycleCounts.TARGET_REACHED,
      regime: currentRegimeInfo,
      multiplier: ttlSettings.regimeMultiplier
    };
  }, [signals, lifecycleCounts, currentRegimeInfo, ttlSettings]);

  // Has any active custom filter?
  const hasActiveFilters = 
    searchQuery.trim() !== '' ||
    sortBy !== 'confidence_desc' ||
    assetClassFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    lifecycleFilter !== 'ALL' ||
    triggerFilter !== 'ALL' ||
    directionFilter !== 'ALL' ||
    validationFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSortBy('confidence_desc');
    setAssetClassFilter('ALL');
    setCategoryFilter('ALL');
    setLifecycleFilter('ALL');
    setTriggerFilter('ALL');
    setDirectionFilter('ALL');
    setValidationFilter('ALL');
  };

  // Filtered and sorted signals
  const processedSignals = useMemo(() => {
    const filtered = (signals || []).filter(s => {
      if (!s) return false;

      // Strategy Category Filter
      if (categoryFilter !== 'ALL') {
        const cat = s.strategyCategory || 'INTRADAY';
        if (cat !== categoryFilter) return false;
      }

      // Lifecycle / Status Filter
      if (lifecycleFilter !== 'ALL') {
        if (lifecycleFilter === 'ACTIVE' && s.status !== 'ACTIVE') return false;
        if (lifecycleFilter === 'TARGET_REACHED' && s.status !== 'TARGET_REACHED') return false;
        if (lifecycleFilter === 'STOPPED_OUT' && s.status !== 'STOPPED_OUT') return false;
        if (lifecycleFilter === 'EXPIRED' && s.status !== 'EXPIRED') return false;
        if (lifecycleFilter === 'BREAKEVEN' && !s.isBreakevenActive) return false;
        if (lifecycleFilter === 'NEAR_EXPIRY') {
          const prog = calculateTtlProgress(s, ttlSettings, now);
          if (s.status !== 'ACTIVE' || !prog.isNearExpiry) return false;
        }
      }

      // Direction Filter
      if (directionFilter !== 'ALL' && s.direction !== directionFilter) return false;

      // Validation Filter
      if (validationFilter === 'CONFIRMED' && s.validationStatus !== 'CONFIRMED') return false;
      if (validationFilter === 'PENDING' && s.validationStatus !== 'PENDING_VALIDATION') return false;
      if (validationFilter === 'REJECTED' && s.validationStatus !== 'REJECTED_SPIKE') return false;

      // Asset Class Filter
      if (assetClassFilter !== 'ALL') {
        const cls = getSignalAssetClass(s);
        if (cls !== assetClassFilter) return false;
      }

      // Indicator Trigger Filter
      if (triggerFilter !== 'ALL' && !checkSignalTrigger(s, triggerFilter)) {
        return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const ticker = tickers.find(t => t.symbol === s.symbol);
        const symbolMatch = s.symbol.toLowerCase().includes(q);
        const nameMatch = ticker?.name?.toLowerCase().includes(q);
        const baseAssetMatch = ticker?.baseAsset?.toLowerCase().includes(q);
        const dirMatch = s.direction.toLowerCase().includes(q) || (s.direction === 'LONG' ? 'compra'.includes(q) : 'venda'.includes(q));
        const factorsMatch = (s.confluenceFactors || []).some(f => f.toLowerCase().includes(q));
        const reasonMatch = (ticker?.signalReason || '').toLowerCase().includes(q) || (s.validationStage || '').toLowerCase().includes(q) || (s.expirationReason || '').toLowerCase().includes(q);

        if (!symbolMatch && !nameMatch && !baseAssetMatch && !dirMatch && !factorsMatch && !reasonMatch) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    return [...filtered].sort((a, b) => {
      if (sortBy === 'confidence_desc') {
        return (b.confluenceScore || 0) - (a.confluenceScore || 0);
      }
      if (sortBy === 'confidence_asc') {
        return (a.confluenceScore || 0) - (b.confluenceScore || 0);
      }
      if (sortBy === 'winrate_desc') {
        return (b.backtestWinRate || 0) - (a.backtestWinRate || 0);
      }
      if (sortBy === 'rr_desc') {
        return (b.riskRewardRatio || 0) - (a.riskRewardRatio || 0);
      }
      if (sortBy === 'ttl_asc') {
        const aTtl = calculateTtlProgress(a, ttlSettings, now).remainingMs;
        const bTtl = calculateTtlProgress(b, ttlSettings, now).remainingMs;
        return aTtl - bTtl;
      }
      if (sortBy === 'ttl_desc') {
        const aTtl = calculateTtlProgress(a, ttlSettings, now).remainingMs;
        const bTtl = calculateTtlProgress(b, ttlSettings, now).remainingMs;
        return bTtl - aTtl;
      }
      if (sortBy === 'newest') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (sortBy === 'oldest') {
        return (a.createdAt || 0) - (b.createdAt || 0);
      }
      return 0;
    });
  }, [signals, tickers, directionFilter, validationFilter, lifecycleFilter, assetClassFilter, triggerFilter, searchQuery, sortBy, ttlSettings, now]);

  const handleOpenSignalChart = async (signal: TradeSignal, autoRunAI: boolean = false) => {
    if (onSelectSignal) {
      onSelectSignal(signal, autoRunAI);
      return;
    }
    const ticker = tickers.find(t => t.symbol === signal.symbol);
    if (ticker && onRequestAIReview) {
      setLoadingSymbol(signal.symbol);
      try {
        await onRequestAIReview(ticker, signal);
      } finally {
        setLoadingSymbol(null);
      }
    }
  };

  const handleRunAIReview = async (symbol: string) => {
    const targetSignal = signals.find(s => s.symbol === symbol);
    if (targetSignal) {
      await handleOpenSignalChart(targetSignal, true);
      return;
    }
    const ticker = tickers.find(t => t.symbol === symbol);
    if (ticker && onRequestAIReview) {
      setLoadingSymbol(symbol);
      try {
        await onRequestAIReview(ticker);
      } finally {
        setLoadingSymbol(null);
      }
    }
  };

  return (
    <div className="space-y-4 font-mono">
      {/* Header & Main Anti-Spike Description */}
      <div className="bg-[#0A0A0A] p-3.5 rounded-lg border border-white/10 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-extrabold text-white">Matriz de Sinais & Filtro Anti-Spike (1m & 5m)</h2>
            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30">
              {processedSignals.length} de {signals.length} SINAIS
            </span>
          </div>
          <p className="text-[10px] text-neutral-400 mt-0.5">
            Validação de sustentação de 1 min + confirmação de tendência de 5 min para eliminar falsos rompimentos.
          </p>
        </div>

        {/* Direction & Validation Quick Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs w-full xl:w-auto">
          {/* Validation Filter */}
          <div className="flex items-center gap-1 bg-[#050505] p-1 rounded border border-white/5 shrink-0">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider px-1">Validação:</span>
            
            <Tooltip
              position="bottom"
              title="Todos os Sinais"
              badge={`${signals.length} SINAIS`}
              content="Exibe todos os sinais gerados pelo motor quantitativo sem filtrar por status de validação."
            >
              <button
                onClick={() => setValidationFilter('ALL')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition shrink-0 cursor-pointer ${
                  validationFilter === 'ALL' ? 'bg-orange-500 text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Todos ({signals.length})
              </button>
            </Tooltip>

            <Tooltip
              position="bottom"
              title="Sinais Confirmados"
              badge="CONFIRMED"
              content="Apenas setups que passaram pelo filtro anti-spike: sustentaram volume no 1m e confirmaram tendência no 5m."
            >
              <button
                onClick={() => setValidationFilter('CONFIRMED')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition shrink-0 cursor-pointer ${
                  validationFilter === 'CONFIRMED' ? 'bg-emerald-500 text-black font-extrabold' : 'text-emerald-400 hover:text-white'
                }`}
              >
                ✓ Confirmados
              </button>
            </Tooltip>

            <Tooltip
              position="bottom"
              title="Sinais Em Validação"
              badge="PENDING"
              content="Sinais detectados recentemente aguardando confirmação do fechamento da próxima vela para evitar falsos rompimentos."
            >
              <button
                onClick={() => setValidationFilter('PENDING')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition shrink-0 cursor-pointer ${
                  validationFilter === 'PENDING' ? 'bg-amber-500 text-black font-extrabold' : 'text-amber-400 hover:text-white'
                }`}
              >
                ⏳ Em Validação
              </button>
            </Tooltip>

            <Tooltip
              position="bottom"
              title="Spikes Rejeitados"
              badge="REJECTED"
              content="Setups descartados automaticamente pelo filtro quantitativo após o delta perder agressão ou o preço rejeitar a POC."
            >
              <button
                onClick={() => setValidationFilter('REJECTED')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition shrink-0 cursor-pointer ${
                  validationFilter === 'REJECTED' ? 'bg-rose-500 text-white font-extrabold' : 'text-rose-400 hover:text-white'
                }`}
              >
                ✕ Spikes Rejeitados
              </button>
            </Tooltip>
          </div>

          {/* Direction Filter */}
          <div className="flex items-center gap-1 bg-[#050505] p-1 rounded border border-white/5">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider px-1">Lado:</span>
            
            <Tooltip
              position="bottom"
              title="Ambas as Direções"
              content="Exibe ordens recomendadas tanto de compra (LONG) quanto de venda (SHORT)."
            >
              <button
                onClick={() => setDirectionFilter('ALL')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                  directionFilter === 'ALL' ? 'bg-white/20 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Ambos
              </button>
            </Tooltip>

            <Tooltip
              position="bottom"
              title="Apenas Compras (LONG)"
              badge="COMPRA"
              content="Filtra somente oportunidades de entrada comprada alinhadas a confluências de suporte e delta positivo."
            >
              <button
                onClick={() => setDirectionFilter('LONG')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                  directionFilter === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-neutral-400'
                }`}
              >
                LONG
              </button>
            </Tooltip>

            <Tooltip
              position="bottom"
              title="Apenas Vendas (SHORT)"
              badge="VENDA"
              content="Filtra somente oportunidades de entrada vendida alinhadas a resistências institucionais e absorção."
            >
              <button
                onClick={() => setDirectionFilter('SHORT')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                  directionFilter === 'SHORT' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'text-neutral-400'
                }`}
              >
                SHORT
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Strategy Categories Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-white/5 w-full">
          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Layers className="h-3 w-3 text-cyan-400" />
            Estratégia:
          </span>
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
              categoryFilter === 'ALL'
                ? 'bg-cyan-500 text-black shadow'
                : 'bg-[#050505] text-neutral-400 hover:text-white border border-white/5'
            }`}
          >
            Todas ({categoryCounts.ALL})
          </button>
          <button
            onClick={() => setCategoryFilter('SCALP')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
              categoryFilter === 'SCALP'
                ? 'bg-purple-500 text-black shadow'
                : 'bg-[#050505] text-purple-400 hover:text-purple-300 border border-purple-500/20'
            }`}
          >
            ⚡ Scalp ({categoryCounts.SCALP})
          </button>
          <button
            onClick={() => setCategoryFilter('DAY_TRADE')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
              categoryFilter === 'DAY_TRADE'
                ? 'bg-blue-500 text-black shadow'
                : 'bg-[#050505] text-blue-400 hover:text-blue-300 border border-blue-500/20'
            }`}
          >
            🎯 Day Trade ({categoryCounts.DAY_TRADE})
          </button>
          <button
            onClick={() => setCategoryFilter('INTRADAY')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
              categoryFilter === 'INTRADAY'
                ? 'bg-emerald-500 text-black shadow'
                : 'bg-[#050505] text-emerald-400 hover:text-emerald-300 border border-emerald-500/20'
            }`}
          >
            ⏱️ Intraday ({categoryCounts.INTRADAY})
          </button>
          <button
            onClick={() => setCategoryFilter('SWING')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
              categoryFilter === 'SWING'
                ? 'bg-amber-500 text-black shadow'
                : 'bg-[#050505] text-amber-400 hover:text-amber-300 border border-amber-500/20'
            }`}
          >
            📈 Swing ({categoryCounts.SWING})
          </button>
          <button
            onClick={() => setCategoryFilter('POSITION')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
              categoryFilter === 'POSITION'
                ? 'bg-indigo-500 text-black shadow'
                : 'bg-[#050505] text-indigo-400 hover:text-indigo-300 border border-indigo-500/20'
            }`}
          >
            🌐 Position ({categoryCounts.POSITION})
          </button>
        </div>

        {/* Institutional Lifecycle & TTL Status Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/5 w-full">
          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Timer className="h-3 w-3 text-orange-400" />
            Ciclo de Vida:
          </span>
          <button
            onClick={() => setLifecycleFilter('ALL')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
              lifecycleFilter === 'ALL'
                ? 'bg-neutral-200 text-black font-extrabold shadow'
                : 'bg-[#050505] text-neutral-400 hover:text-white border border-white/5'
            }`}
          >
            Todas ({lifecycleCounts.ALL})
          </button>
          <button
            onClick={() => setLifecycleFilter('ACTIVE')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
              lifecycleFilter === 'ACTIVE'
                ? 'bg-emerald-500 text-black font-extrabold shadow'
                : 'bg-[#050505] text-emerald-400 hover:text-emerald-300 border border-emerald-500/20'
            }`}
          >
            🟢 Ativos ({lifecycleCounts.ACTIVE})
          </button>
          <button
            onClick={() => setLifecycleFilter('NEAR_EXPIRY')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
              lifecycleFilter === 'NEAR_EXPIRY'
                ? 'bg-amber-500 text-black font-extrabold shadow animate-pulse'
                : 'bg-[#050505] text-amber-400 hover:text-amber-300 border border-amber-500/20'
            }`}
          >
            ⏳ Expirando em Breve ({lifecycleCounts.NEAR_EXPIRY})
          </button>
          <button
            onClick={() => setLifecycleFilter('BREAKEVEN')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
              lifecycleFilter === 'BREAKEVEN'
                ? 'bg-cyan-500 text-black font-extrabold shadow'
                : 'bg-[#050505] text-cyan-400 hover:text-cyan-300 border border-cyan-500/20'
            }`}
          >
            🛡️ Breakeven Protegido ({lifecycleCounts.BREAKEVEN})
          </button>
          <button
            onClick={() => setLifecycleFilter('TARGET_REACHED')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
              lifecycleFilter === 'TARGET_REACHED'
                ? 'bg-teal-500 text-black font-extrabold shadow'
                : 'bg-[#050505] text-teal-400 hover:text-teal-300 border border-teal-500/20'
            }`}
          >
            🎯 Alvo Atingido ({lifecycleCounts.TARGET_REACHED})
          </button>
          <button
            onClick={() => setLifecycleFilter('STOPPED_OUT')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
              lifecycleFilter === 'STOPPED_OUT'
                ? 'bg-rose-500 text-white font-extrabold shadow'
                : 'bg-[#050505] text-rose-400 hover:text-rose-300 border border-rose-500/20'
            }`}
          >
            🛑 Stop Loss ({lifecycleCounts.STOPPED_OUT})
          </button>
          <button
            onClick={() => setLifecycleFilter('EXPIRED')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
              lifecycleFilter === 'EXPIRED'
                ? 'bg-neutral-500 text-white font-extrabold shadow'
                : 'bg-[#050505] text-neutral-400 hover:text-neutral-300 border border-white/10'
            }`}
          >
            ⌛ TTL Expirado ({lifecycleCounts.EXPIRED})
          </button>
        </div>
      </div>

      {/* Institutional Quantitative Signal HUD Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 bg-[#080808] p-2.5 rounded-lg border border-white/10 shadow-lg text-xs">
        <div className="bg-[#050505] p-2 rounded border border-white/5 flex flex-col justify-between">
          <span className="text-[9px] text-neutral-500 uppercase font-bold flex items-center gap-1">
            <Activity className="h-3 w-3 text-cyan-400" />
            Sinais no Book
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-black text-white">{hudMetrics.active}</span>
            <span className="text-[10px] text-neutral-400">/ {hudMetrics.total} tot</span>
          </div>
        </div>

        <div className="bg-[#050505] p-2 rounded border border-white/5 flex flex-col justify-between">
          <span className="text-[9px] text-neutral-500 uppercase font-bold flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-orange-400" />
            Confluência Média
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-black text-orange-400">{hudMetrics.avgConfluence}%</span>
            <span className="text-[9px] text-neutral-500">score</span>
          </div>
        </div>

        <div className="bg-[#050505] p-2 rounded border border-white/5 flex flex-col justify-between">
          <span className="text-[9px] text-neutral-500 uppercase font-bold flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            Breakeven Ativo
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-black text-emerald-400">{hudMetrics.breakevenCount}</span>
            <span className="text-[9px] text-emerald-500/80 font-semibold">risco zero</span>
          </div>
        </div>

        <div className="bg-[#050505] p-2 rounded border border-white/5 flex flex-col justify-between">
          <span className="text-[9px] text-neutral-500 uppercase font-bold flex items-center gap-1">
            <Timer className="h-3 w-3 text-amber-400" />
            Expiração Próxima
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-sm font-black ${hudMetrics.nearExpiryCount > 0 ? 'text-amber-400 animate-pulse' : 'text-neutral-400'}`}>
              {hudMetrics.nearExpiryCount}
            </span>
            <span className="text-[9px] text-neutral-500">&lt;20% TTL</span>
          </div>
        </div>

        <div className="bg-[#050505] p-2 rounded border border-white/5 flex flex-col justify-between">
          <span className="text-[9px] text-neutral-500 uppercase font-bold flex items-center gap-1">
            <Target className="h-3 w-3 text-emerald-400" />
            Alvos Concluídos
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm font-black text-emerald-400">{hudMetrics.targetReachedCount}</span>
            <span className="text-[9px] text-neutral-500">histórico</span>
          </div>
        </div>

        <div className="bg-[#050505] p-2 rounded border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-neutral-500 uppercase font-bold flex items-center gap-1">
              <Gauge className="h-3 w-3 text-cyan-400" />
              Regime TTL
            </span>
            {onNavigateToSettings && (
              <button
                onClick={onNavigateToSettings}
                className="text-[8.5px] text-orange-400 hover:text-orange-300 flex items-center gap-0.5 transition cursor-pointer"
                title="Configurar TTL em Ajustes"
              >
                <Settings className="h-2.5 w-2.5" />
                Ajustar
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[11px] font-black text-white truncate">
              {hudMetrics.regime.icon} {hudMetrics.regime.shortLabel}
            </span>
            <span className="text-[9px] text-cyan-400 font-bold bg-cyan-500/10 px-1 rounded border border-cyan-500/20">
              {hudMetrics.multiplier.toFixed(1)}x
            </span>
          </div>
        </div>
      </div>

      {/* Enhanced Search & Advanced Filter Bar */}
      <div className="bg-[#0A0A0A] p-3 rounded-lg border border-white/10 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input Box */}
        <div className="relative flex-1 min-w-[240px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
            <Search className="h-3.5 w-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por par (ex: BTC, SOL, SPY), indicador ou confluência..."
            className="w-full pl-9 pr-8 py-1.5 bg-[#050505] border border-white/10 rounded text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-neutral-400 hover:text-white transition cursor-pointer"
              title="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 bg-[#050505] px-2.5 py-1.5 rounded border border-white/10">
            <ArrowUpDown className="h-3.5 w-3.5 text-orange-400 shrink-0" />
            <span className="text-[10px] text-neutral-500 font-bold uppercase hidden sm:inline">Ordenar:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent text-xs text-neutral-200 font-bold focus:outline-none cursor-pointer"
            >
              <option value="confidence_desc" className="bg-[#0A0A0A] text-white">Score de Confluência (Maior → Menor)</option>
              <option value="confidence_asc" className="bg-[#0A0A0A] text-white">Score de Confluência (Menor → Maior)</option>
              <option value="ttl_asc" className="bg-[#0A0A0A] text-white">⏳ Validade TTL (Expirando Primeiro)</option>
              <option value="ttl_desc" className="bg-[#0A0A0A] text-white">⏳ Validade TTL (Maior Tempo Restante)</option>
              <option value="winrate_desc" className="bg-[#0A0A0A] text-white">Win Rate Backtest (Maior → Menor)</option>
              <option value="rr_desc" className="bg-[#0A0A0A] text-white">Ratio Risco:Retorno (Melhor R:R)</option>
              <option value="newest" className="bg-[#0A0A0A] text-white">Mais Recentes</option>
              <option value="oldest" className="bg-[#0A0A0A] text-white">Mais Antigos</option>
            </select>
          </div>

          {/* Asset Class Filter */}
          <div className="flex items-center gap-1.5 bg-[#050505] px-2.5 py-1.5 rounded border border-white/10">
            <Layers className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span className="text-[10px] text-neutral-500 font-bold uppercase hidden sm:inline">Classe:</span>
            <select
              value={assetClassFilter}
              onChange={(e) => setAssetClassFilter(e.target.value as AssetClassFilter)}
              className="bg-transparent text-xs text-neutral-200 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-[#0A0A0A] text-white">Todas as Classes</option>
              <option value="crypto_futures" className="bg-[#0A0A0A] text-white">Cripto Perpétuos (Futures)</option>
              <option value="crypto_spot" className="bg-[#0A0A0A] text-white">Cripto Spot</option>
              <option value="tradfi" className="bg-[#0A0A0A] text-white">TradFi / Ações & Macro</option>
            </select>
          </div>

          {/* Indicator Trigger Filter */}
          <div className="flex items-center gap-1.5 bg-[#050505] px-2.5 py-1.5 rounded border border-white/10">
            <Sliders className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-[10px] text-neutral-500 font-bold uppercase hidden sm:inline">Gatilho:</span>
            <select
              value={triggerFilter}
              onChange={(e) => setTriggerFilter(e.target.value as TriggerFilter)}
              className="bg-transparent text-xs text-neutral-200 font-bold focus:outline-none cursor-pointer max-w-[180px] sm:max-w-none truncate"
            >
              <option value="ALL" className="bg-[#0A0A0A] text-white">Todos os Gatilhos</option>
              <option value="FIBONACCI" className="bg-[#0A0A0A] text-white">Fibonacci (Golden Pocket 0.618 - 0.68)</option>
              <option value="CVD" className="bg-[#0A0A0A] text-white">CVD Delta & Agressão Taker</option>
              <option value="OI" className="bg-[#0A0A0A] text-white">Open Interest (Acumulação OI)</option>
              <option value="VOLUME_PROFILE" className="bg-[#0A0A0A] text-white">Volume Profile (POC / VAH / VAL)</option>
              <option value="FVG" className="bg-[#0A0A0A] text-white">Fair Value Gap (FVG / Desbalanço)</option>
              <option value="BOS" className="bg-[#0A0A0A] text-white">Break of Structure (BOS)</option>
              <option value="FUNDING_RATE" className="bg-[#0A0A0A] text-white">Funding Rate / Squeeze</option>
              <option value="SUPPORT_RESISTANCE" className="bg-[#0A0A0A] text-white">Suporte & Resistência Chave</option>
            </select>
          </div>

          {/* Reset Filters Button if active */}
          {hasActiveFilters && (
            <Tooltip
              position="bottom"
              title="Redefinir Filtros"
              badge="RESET"
              content="Limpa a busca textual e restaura todos os filtros de ordenação, classe de ativo e gatilhos para o padrão."
            >
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded text-xs font-bold transition flex items-center gap-1 border border-white/10 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3 text-orange-400" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* AI Review Modal / Card Header if Active */}
      {selectedAIReview && (
        <div className="bg-[#0A0A0A] border border-orange-500/50 rounded-lg p-4 shadow-2xl relative">
          <button
            onClick={() => setSelectedAIReview(null)}
            className="absolute top-3 right-3 text-neutral-400 hover:text-white text-xs font-bold bg-neutral-900 h-6 w-6 rounded flex items-center justify-center border border-white/10 cursor-pointer"
          >
            ✕
          </button>

          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-1.5 bg-orange-500/10 text-orange-400 rounded border border-orange-500/30">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white">
                  Revisão IA — {selectedAIReview.symbol}
                </h3>
                <span className="text-[9px] bg-orange-500/20 text-orange-400 font-bold px-1.5 py-0.5 rounded border border-orange-500/30">
                  {selectedAIReview.modelUsed}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400">Auditoria quantitativa do setup de trade</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1900px]:grid-cols-6 gap-2.5 mb-3">
            <div className="bg-[#050505] p-2.5 rounded border border-white/5">
              <span className="text-[9px] text-neutral-500 uppercase block font-bold">Decisão IA</span>
              <span className={`text-sm font-black ${
                selectedAIReview.decision === 'CONFIRM' ? 'text-emerald-400' : selectedAIReview.decision === 'ADJUST' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {selectedAIReview.decision === 'CONFIRM' ? '✓ CONFIRMADO' : selectedAIReview.decision === 'ADJUST' ? '⚠ AJUSTADO' : '✗ REJEITADO'}
              </span>
            </div>

            <div className="bg-[#050505] p-2.5 rounded border border-white/5">
              <span className="text-[9px] text-neutral-500 uppercase block font-bold">Entrada Recomendada</span>
              <span className="text-xs font-bold text-orange-400">
                {formatPriceRange(selectedAIReview.entryZone?.[0], selectedAIReview.entryZone?.[1])}
              </span>
            </div>

            <div className="bg-[#050505] p-2.5 rounded border border-white/5">
              <span className="text-[9px] text-neutral-500 uppercase block font-bold">Confiança IA</span>
              <span className="text-sm font-black text-emerald-400">
                {selectedAIReview.confidenceScore}%
              </span>
            </div>
          </div>

          <div className="bg-[#050505] p-3 rounded border border-white/5 text-xs text-neutral-300 leading-relaxed mb-2.5">
            <strong className="text-orange-400 block mb-1">Raciocínio do Trader IA:</strong>
            {selectedAIReview.reasoning}
          </div>

          {(() => {
            const aiMetrics = calculateTradeMetrics({
              entry: selectedAIReview.entryZone,
              stopLoss: selectedAIReview.stopLoss,
              target1: selectedAIReview.takeProfit1,
              target2: selectedAIReview.takeProfit2,
              direction: selectedAIReview.recommendedDirection,
              currentPrice: 0
            });
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-neutral-300 pt-2 border-t border-white/10 bg-[#050505] p-2.5 rounded border border-white/5">
                <div>
                  <span className="text-[9px] text-neutral-500 uppercase block font-bold">Stop Loss (% Risco)</span>
                  <div className="flex items-center gap-1">
                    <strong className="text-rose-400">{formatPrice(selectedAIReview.stopLoss, { currency: true })}</strong>
                    <span className="text-[9px] text-rose-400 font-bold bg-rose-500/10 px-1 rounded">-{aiMetrics.riskPct.toFixed(2)}%</span>
                  </div>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500 uppercase block font-bold">Alvo 1 (% Gain)</span>
                  <div className="flex items-center gap-1">
                    <strong className="text-emerald-400">{formatPrice(selectedAIReview.takeProfit1, { currency: true })}</strong>
                    <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded">+{aiMetrics.target1GainPct.toFixed(2)}%</span>
                  </div>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500 uppercase block font-bold">Alvo 2 (% Gain)</span>
                  <div className="flex items-center gap-1">
                    <strong className="text-emerald-400">{formatPrice(selectedAIReview.takeProfit2, { currency: true })}</strong>
                    <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded">+{aiMetrics.target2GainPct.toFixed(2)}%</span>
                  </div>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500 uppercase block font-bold">Ratio Risco : Retorno</span>
                  <strong className="text-orange-400 text-[11px]">1 : {aiMetrics.rrRatio1.toFixed(2)} (DT) / 1 : {aiMetrics.rrRatio2.toFixed(2)} (Swing)</strong>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Signals List / Cards */}
      <div className="space-y-3">
        {processedSignals.length === 0 ? (
          <div className="bg-[#0A0A0A] p-8 rounded-lg border border-white/10 text-center text-neutral-400 text-xs space-y-3">
            <Filter className="h-8 w-8 text-neutral-600 mx-auto" />
            <p className="font-extrabold text-white text-sm">
              Nenhum sinal encontrado com os filtros selecionados.
            </p>
            <p className="text-neutral-500 max-w-md mx-auto">
              Tente ajustar sua busca, selecionar outra classe de ativo ou redefinir os gatilhos para ver mais oportunidades monitoradas.
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black font-extrabold rounded text-xs transition inline-flex items-center gap-1.5 cursor-pointer shadow"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Redefinir Todos os Filtros
              </button>
            )}
          </div>
        ) : (
          processedSignals.map((s) => {
            const isLong = s.direction === 'LONG';
            const curPrice = s.currentPrice ?? 0;
            const entry0 = s.entryZone?.[0] ?? 0;
            const entry1 = s.entryZone?.[1] ?? 0;
            const stop = s.stopLoss ?? 0;
            const target = s.target1 ?? 0;
            const assetClass = getSignalAssetClass(s);

            const assetClassBadge = assetClass === 'tradfi' ? (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-purple-500/10 text-purple-400 border border-purple-500/30">
                TRADFI
              </span>
            ) : assetClass === 'crypto_spot' ? (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                SPOT
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                FUTURES
              </span>
            );

            const ttl = calculateTtlProgress(s, ttlSettings, now);

            return (
              <div
                key={s.id}
                className={`rounded-lg border p-3 hover:border-neutral-700 transition shadow-md relative ${
                  s.status === 'TARGET_REACHED'
                    ? 'border-emerald-500/50 bg-[#06120a]'
                    : s.status === 'STOPPED_OUT'
                    ? 'border-rose-500/40 bg-[#140808]'
                    : s.status === 'EXPIRED'
                    ? 'border-neutral-800 bg-[#080808] opacity-85'
                    : s.isBreakevenActive
                    ? 'border-cyan-500/40 bg-[#060d14] shadow-cyan-950/20'
                    : s.validationStatus === 'CONFIRMED'
                    ? 'border-emerald-500/30 bg-[#0A0A0A]'
                    : s.validationStatus === 'REJECTED_SPIKE'
                    ? 'border-rose-500/30 bg-[#0A0A0A] opacity-75'
                    : 'border-amber-500/30 bg-[#0A0A0A]'
                }`}
              >
                {/* Institutional Lifecycle Status Banner */}
                {s.status === 'TARGET_REACHED' && (
                  <div className="mb-2 px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-between text-[10px] font-extrabold shadow-sm">
                    <span className="flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-emerald-400" />
                      ALVO 2 ATINGIDO (+100% EXPANSÃO DE LUCRO) · TRADE CONCLUÍDO
                    </span>
                    <span className="text-[9px] text-emerald-300 font-mono">
                      {s.expirationReason || 'Meta técnica cumprida'}
                    </span>
                  </div>
                )}

                {s.status === 'STOPPED_OUT' && (
                  <div className="mb-2 px-2.5 py-1 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-between text-[10px] font-extrabold shadow-sm">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                      {s.isBreakevenActive ? 'STOP LOSS NO BREAKEVEN EXECUTADO (CAPITAL PRESERVADO)' : 'STOP LOSS EXECUTADO (INVALIDAÇÃO TÉCNICA)'}
                    </span>
                    <span className="text-[9px] text-rose-300 font-mono">
                      {s.expirationReason || 'Invalidação técnica da estrutura'}
                    </span>
                  </div>
                )}

                {s.status === 'EXPIRED' && (
                  <div className="mb-2 px-2.5 py-1 rounded bg-neutral-800/70 border border-neutral-700 text-neutral-300 flex items-center justify-between text-[10px] font-extrabold shadow-sm">
                    <span className="flex items-center gap-1.5">
                      <Hourglass className="h-3.5 w-3.5 text-amber-400" />
                      SINAL EXPIRADO (DECAIMENTO TEMPORAL DE ALPHA / TTL)
                    </span>
                    <span className="text-[9px] text-neutral-400 font-mono">
                      {s.expirationReason || 'Tempo de vida útil esgotado'}
                    </span>
                  </div>
                )}

                {s.status === 'ACTIVE' && s.isBreakevenActive && (
                  <div className="mb-2 px-2.5 py-1 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-between text-[10px] font-extrabold shadow-sm">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
                      BREAKEVEN ATIVO: Alvo 1 Realizado (+50%) · Stop movido para a entrada
                    </span>
                    <span className="text-[9px] text-cyan-400 font-bold bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/30">
                      RISCO ZERO
                    </span>
                  </div>
                )}

                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                  {/* Left Info Column */}
                  <div className="space-y-1.5 w-full lg:w-1/3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-white">{s.symbol}</h3>

                      {/* Asset Class Badge */}
                      <Tooltip
                        position="top"
                        title="Classe de Mercado"
                        content={
                          assetClass === 'tradfi'
                            ? 'Ativo de Mercado Tradicional (Ações, Índices ou Commodities)'
                            : assetClass === 'crypto_spot'
                            ? 'Mercado Cripto à Vista (Spot)'
                            : 'Contrato Perpétuo Cripto com Alavancagem e Financiamento'
                        }
                      >
                        {assetClassBadge}
                      </Tooltip>

                      {/* Strategy Category Badge */}
                      <Tooltip
                        position="top"
                        title={`Estratégia: ${s.strategyCategory || 'INTRADAY'}`}
                        badge={`TIMEFRAME ${s.timeframe || '30m'}`}
                        content={`Sinal gerado pela estratégia ${s.strategyCategory || 'INTRADAY'} (${s.timeframe || '30m'}). Opera de forma independente de outros sinais deste par.`}
                      >
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border cursor-help ${
                          s.strategyCategory === 'SCALP'
                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/40'
                            : s.strategyCategory === 'DAY_TRADE'
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                            : s.strategyCategory === 'SWING'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                            : s.strategyCategory === 'POSITION'
                            ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        }`}>
                          ⚡ {s.strategyCategory || 'INTRADAY'} ({s.timeframe || '30m'})
                        </span>
                      </Tooltip>

                      {/* Direction & Signal Type Badge */}
                      <Tooltip
                        position="top"
                        title="Direção & Força Operacional"
                        badge={`${s.direction} (${s.signalType})`}
                        content={
                          isLong
                            ? s.signalType === 'STRONG_LONG'
                              ? 'Operação de COMPRA FORTE (LONG): Alta probabilidade estatística com forte pressão compradora institucional no CVD e confluência em zonas de suporte e retração Fibonacci.'
                              : 'Operação de COMPRA (LONG): Viés altista configurado com confirmação em níveis de suporte e fluxo comprador.'
                            : s.signalType === 'STRONG_SHORT'
                            ? 'Operação de VENDA FORTE (SHORT): Alta probabilidade estatística com forte pressão agressora vendedora no CVD e rejeição acentuada em níveis de resistência técnica.'
                            : 'Operação de VENDA (SHORT): Viés baixista configurado com rejeição em níveis de topo e fluxo vendedor predominante.'
                        }
                      >
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border flex items-center gap-1 cursor-help transition-opacity hover:opacity-90 ${
                            isLong
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {isLong ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {s.direction} ({s.signalType})
                        </span>
                      </Tooltip>

                      <Tooltip
                        position="top"
                        title="Score de Confluência"
                        badge={`${s.confluenceScore}%`}
                        content="Ponderação percentual de confirmações técnicas (Volume Profile, CVD, Fib 0.68, POC e Order Blocks)."
                      >
                        <span className="bg-neutral-900 text-orange-400 text-[10px] px-2 py-0.5 rounded border border-white/5 font-extrabold cursor-help">
                          {s.confluenceScore}% CONFLUÊNCIA
                        </span>
                      </Tooltip>
                    </div>

                    {/* Validation Status Badge */}
                    <div className="flex items-center gap-1.5">
                      {s.validationStatus === 'CONFIRMED' && (
                        <Tooltip
                          position="top"
                          title="Sinal Validado"
                          badge="CONFIRMADO"
                          content="O trade sustentou volume após fechamento da vela de 1m e confirmou alinhamento de tendência no gráfico de 5m."
                        >
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-bold flex items-center gap-1 cursor-help">
                            <CheckCircle2 className="h-3 w-3" />
                            VALIDADO (1m Sustentado + 5m Tendência)
                          </span>
                        </Tooltip>
                      )}

                      {s.validationStatus === 'PENDING_VALIDATION' && (
                        <Tooltip
                          position="top"
                          title="Aguardando Confirmação"
                          badge="EM VALIDAÇÃO"
                          content="Detectado no book; o robô está aguardando fechamento da vela para atestar se não se trata de absorção efêmera."
                        >
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[9px] font-bold flex items-center gap-1 animate-pulse cursor-help">
                            <Clock className="h-3 w-3" />
                            EM VALIDAÇÃO (Aguardando 1m/5m)
                          </span>
                        </Tooltip>
                      )}

                      {s.validationStatus === 'REJECTED_SPIKE' && (
                        <Tooltip
                          position="top"
                          title="Spike Rejeitado"
                          badge="DESCARTADO"
                          content="Falso rompimento detectado: a agressão sumiu após tocar na zona e o preço reverteu bruscamente."
                        >
                          <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[9px] font-bold flex items-center gap-1 cursor-help">
                            <AlertTriangle className="h-3 w-3" />
                            SPIKE REJEITADO (Falso Rompimento)
                          </span>
                        </Tooltip>
                      )}
                    </div>

                    {s.backtestWinRate && (
                      <span className={`px-2 py-0.5 border rounded text-[9px] font-bold flex items-center gap-1 w-max ${
                        s.backtestWinRate >= 60 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      }`}>
                        <Activity className="h-3 w-3" />
                        Backtest WinRate: {s.backtestWinRate.toFixed(1)}%
                      </span>
                    )}
                    {s.validationStage && (
                      <p className="text-[9px] text-neutral-400 italic">
                        ↳ {s.validationStage}
                      </p>
                    )}

                    {/* Temporal Metadata: Identificação & Validação / Rejeição */}
                    <div className="bg-[#050505] p-2 rounded border border-white/5 space-y-1 text-[9px] font-mono">
                      {/* Data/Hora de Identificação */}
                      <Tooltip
                        position="top"
                        title="Momento da Identificação"
                        badge="DETECÇÃO"
                        content={`Sinal identificado pelo motor quantitativo às ${formatDateTime(s.createdAt)} (${formatTimeAgo(s.createdAt)}).`}
                      >
                        <div className="flex items-center justify-between gap-2 cursor-help text-neutral-300">
                          <span className="flex items-center gap-1 text-neutral-400">
                            <Clock className="h-3 w-3 text-cyan-400 shrink-0" />
                            <strong className="text-neutral-400 font-bold uppercase text-[8.5px]">Identificado em:</strong>
                          </span>
                          <span className="text-white font-bold flex items-center gap-1">
                            <span>{formatDateTime(s.createdAt)}</span>
                            <span className="text-[8px] text-cyan-400/80 font-normal">({formatTimeAgo(s.createdAt)})</span>
                          </span>
                        </div>
                      </Tooltip>

                      {/* Data/Hora de Validação ou Rejeição */}
                      {s.validationStatus === 'CONFIRMED' && (
                        <Tooltip
                          position="top"
                          title="Momento da Validação"
                          badge="CONFIRMADO"
                          content={`Sinal validado e aprovado pelo filtro multi-timeframe (1m/5m) às ${formatDateTime(s.validatedAt || s.createdAt)}.`}
                        >
                          <div className="flex items-center justify-between gap-2 cursor-help text-emerald-400 border-t border-white/5 pt-1">
                            <span className="flex items-center gap-1 text-emerald-400/90">
                              <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                              <strong className="font-bold uppercase text-[8.5px]">Validado em:</strong>
                            </span>
                            <span className="text-emerald-300 font-extrabold flex items-center gap-1">
                              <span>{formatDateTime(s.validatedAt || s.createdAt)}</span>
                              {s.validatedAt && s.createdAt && s.validatedAt > s.createdAt && (
                                <span className="text-[8px] text-emerald-400/80 font-normal">
                                  (+{Math.max(1, Math.round((s.validatedAt - s.createdAt) / 1000))}s)
                                </span>
                              )}
                            </span>
                          </div>
                        </Tooltip>
                      )}

                      {(s.validationStatus === 'REJECTED_SPIKE' || s.validationStatus === 'REJECTED_BACKTEST') && (
                        <Tooltip
                          position="top"
                          title="Momento da Rejeição"
                          badge="DESCARTADO"
                          content={`Sinal rejeitado e invalidado pelo filtro anti-spike às ${formatDateTime(s.rejectedAt || s.validatedAt || s.createdAt)}.`}
                        >
                          <div className="flex items-center justify-between gap-2 cursor-help text-rose-400 border-t border-white/5 pt-1">
                            <span className="flex items-center gap-1 text-rose-400/90">
                              <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
                              <strong className="font-bold uppercase text-[8.5px]">Rejeitado em:</strong>
                            </span>
                            <span className="text-rose-300 font-extrabold">
                              {formatDateTime(s.rejectedAt || s.validatedAt || s.createdAt)}
                            </span>
                          </div>
                        </Tooltip>
                      )}

                      {s.validationStatus === 'PENDING_VALIDATION' && (
                        <Tooltip
                          position="top"
                          title="Status da Validação"
                          badge="EM ANDAMENTO"
                          content="Aguardando fechamento da vela de 1m e confirmação de 5m para atestar validação definitiva."
                        >
                          <div className="flex items-center justify-between gap-2 cursor-help text-amber-400 border-t border-white/5 pt-1 animate-pulse">
                            <span className="flex items-center gap-1 text-amber-400/90">
                              <Clock className="h-3 w-3 text-amber-400 shrink-0" />
                              <strong className="font-bold uppercase text-[8.5px]">Validação:</strong>
                            </span>
                            <span className="text-amber-300 font-bold text-[8.5px]">
                              Aguardando 1m/5m...
                            </span>
                          </div>
                        </Tooltip>
                      )}

                      {/* Institutional TTL Lifespan Widget */}
                      <div className="border-t border-white/5 pt-1.5 space-y-1">
                        <div className="flex items-center justify-between text-[9px]">
                          <span className="text-neutral-400 flex items-center gap-1">
                            <Timer className={`h-3 w-3 ${ttl.isExpired ? 'text-neutral-500' : ttl.isNearExpiry ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
                            <strong className="text-neutral-400 uppercase text-[8.5px]">Validade (TTL):</strong>
                          </span>
                          <div className="flex items-center gap-1">
                            <span className={`font-black ${
                              ttl.isExpired
                                ? 'text-neutral-500'
                                : ttl.isNearExpiry
                                ? 'text-rose-400 animate-pulse'
                                : ttl.percentRemaining > 50
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }`}>
                              {ttl.isExpired ? 'EXPIRADO' : ttl.formattedRemaining}
                            </span>
                            <span className="text-[8px] text-neutral-500">
                              ({ttl.percentRemaining}% alpha)
                            </span>
                          </div>
                        </div>

                        {/* Lifespan Gauge Bar */}
                        <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden border border-white/5">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              ttl.isExpired
                                ? 'bg-neutral-700'
                                : ttl.percentRemaining > 50
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : ttl.percentRemaining > 20
                                ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                                : 'bg-gradient-to-r from-rose-500 to-red-500 animate-pulse'
                            }`}
                            style={{ width: `${ttl.percentRemaining}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[8px] text-neutral-500">
                          <span>Base: {formatTtlDuration(ttl.effectiveTtlMinutes)}</span>
                          <span>Regime: {currentRegimeInfo.shortLabel} ({ttlSettings.regimeMultiplier.toFixed(1)}x)</span>
                        </div>
                      </div>
                    </div>

                    {/* Confluence Factors with dynamic trigger highlight */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(s.confluenceFactors || []).map((f, idx) => {
                        const isTriggerMatch = triggerFilter !== 'ALL' && checkFactorMatchesTrigger(f, triggerFilter);
                        return (
                          <span 
                            key={idx} 
                            className={`text-[9px] px-1.5 py-0.5 rounded border transition ${
                              isTriggerMatch
                                ? 'bg-orange-500/20 text-orange-300 border-orange-500/50 font-extrabold shadow-sm'
                                : 'bg-[#050505] text-neutral-300 border-white/5'
                            }`}
                          >
                            ✓ {f}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Middle Order Parameters */}
                  {(() => {
                    const metrics = calculateTradeMetrics({
                      entry: s.entryZone,
                      stopLoss: s.stopLoss,
                      target1: s.target1,
                      target2: s.target2,
                      direction: s.direction,
                      currentPrice: curPrice
                    });
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-1/2 bg-[#050505] p-2.5 rounded border border-white/5 text-[10px]">
                        <Tooltip
                          position="top"
                          title="Preço Atual & Faixa de Entrada"
                          badge="ENTRY ZONE"
                          content="Preço de mercado em tempo real e a faixa ideal calculada pelo motor para posicionamento de ordens limites."
                        >
                          <div className="cursor-help">
                            <span className="text-[9px] text-neutral-500 uppercase block font-bold">Preço Atual / Zona</span>
                            <span className="font-extrabold text-white block">{formatPrice(curPrice, { currency: true })}</span>
                            <span className="text-[9px] font-bold text-orange-400">
                              {formatPriceRange(entry0, entry1)}
                            </span>
                          </div>
                        </Tooltip>

                        <Tooltip
                          position="top"
                          title={s.isBreakevenActive ? "Stop Loss no Breakeven (Risco Zero)" : "Stop Loss & Risco Máximo"}
                          badge={s.isBreakevenActive ? "BREAKEVEN" : "STOP"}
                          content={
                            s.isBreakevenActive
                              ? "O Stop Loss foi elevado automaticamente para o preço de entrada após atingir o Alvo 1. O trade não tem mais risco de perda de capital."
                              : "Ponto de invalidação técnica da tese, posicionado além do suporte/resistência ou extremidade do Order Block."
                          }
                        >
                          <div className="cursor-help">
                            <span className={`text-[9px] uppercase block font-bold ${s.isBreakevenActive ? 'text-cyan-400' : 'text-rose-400'}`}>
                              {s.isBreakevenActive ? '🛡️ Stop Breakeven' : 'Stop Loss (% Risco)'}
                            </span>
                            <span className={`font-extrabold block ${s.isBreakevenActive ? 'text-cyan-300' : 'text-rose-400'}`}>
                              {formatPrice(stop, { currency: true })}
                            </span>
                            {s.isBreakevenActive ? (
                              <span className="text-[9px] font-bold text-cyan-300 bg-cyan-500/20 px-1 rounded border border-cyan-500/30 inline-block mt-0.5">
                                0.00% RISCO
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1 rounded border border-rose-500/20 inline-block mt-0.5">
                                -{metrics.riskPct.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </Tooltip>

                        <Tooltip
                          position="top"
                          title="Alvo 1 (Realização Parcial)"
                          badge="TARGET 1"
                          content={`Primeiro alvo conservador com Risco:Retorno de 1:${metrics.rrRatio1.toFixed(1)}. Recomendado realizar 50% e mover stop para o ponto de entrada.`}
                        >
                          <div className="cursor-help">
                            <span className="text-[9px] text-emerald-400 uppercase block font-bold">Alvo 1 (R:R 1:{metrics.rrRatio1.toFixed(1)})</span>
                            <span className="font-extrabold text-emerald-400 block">{formatPrice(target, { currency: true })}</span>
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/20 inline-block mt-0.5">
                              +{metrics.target1GainPct.toFixed(2)}%
                            </span>
                          </div>
                        </Tooltip>

                        <Tooltip
                          position="top"
                          title="Alvo 2 (Expansão Máxima)"
                          badge="TARGET 2"
                          content={`Alvo final de projeção Fibonacci com Risco:Retorno de 1:${metrics.rrRatio2.toFixed(1)}.`}
                        >
                          <div className="cursor-help">
                            <span className="text-[9px] text-emerald-400 uppercase block font-bold">Alvo 2 (R:R 1:{metrics.rrRatio2.toFixed(1)})</span>
                            <span className="font-extrabold text-emerald-400 block">{formatPrice(s.target2, { currency: true })}</span>
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/20 inline-block mt-0.5">
                              +{metrics.target2GainPct.toFixed(2)}%
                            </span>
                          </div>
                        </Tooltip>
                      </div>
                    );
                  })()}

                  {/* Right Action Buttons */}
                  <div className="w-full lg:w-auto flex flex-wrap items-center justify-end gap-2">
                    <Tooltip
                      position="left"
                      title="Ver Gráfico Interativo"
                      badge={s.strategyCategory || 'ESTRATÉGIA'}
                      content={`Abre o gráfico interativo de 5m/15m/30m configurado com os alvos e stop deste sinal de ${s.strategyCategory || 'INTRADAY'} (${s.direction}).`}
                    >
                      <button
                        onClick={() => handleOpenSignalChart(s, false)}
                        className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <LineChart className="h-3.5 w-3.5" />
                        Ver Gráfico
                      </button>
                    </Tooltip>

                    <Tooltip
                      position="left"
                      title="Auditoria com Inteligência Artificial"
                      badge="GEMINI / LLM"
                      content={`Envia este setup de ${s.strategyCategory || 'INTRADAY'} (${s.direction}) para verificação de risco e diagnóstico em tempo real pela IA.`}
                    >
                      <button
                        onClick={() => handleOpenSignalChart(s, true)}
                        disabled={loadingSymbol === s.symbol}
                        className="px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {loadingSymbol === s.symbol ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Auditando...
                          </>
                        ) : (
                          <>
                            <Brain className="h-3.5 w-3.5" />
                            Auditar com IA
                          </>
                        )}
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

