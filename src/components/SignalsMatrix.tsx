import React, { useState, useMemo } from 'react';
import { TradeSignal, TickerData, AIReviewResponse, MarketType } from '../types';
import { formatPrice, formatPriceRange, calculateTradeMetrics } from '../utils/formatters';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Brain, 
  RefreshCw, 
  Clock, 
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
  RotateCcw
} from 'lucide-react';
import { Tooltip } from './Tooltip';

export type SortOption = 
  | 'confidence_desc'
  | 'confidence_asc'
  | 'winrate_desc'
  | 'rr_desc'
  | 'newest'
  | 'oldest';

export type AssetClassFilter = 'ALL' | 'crypto_futures' | 'crypto_spot' | 'tradfi';

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
  onRequestAIReview: (ticker: TickerData) => void;
}

export const SignalsMatrix: React.FC<SignalsMatrixProps> = ({
  signals = [],
  tickers = [],
  onRequestAIReview
}) => {
  // Existing validation & direction filters
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [validationFilter, setValidationFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING' | 'REJECTED'>('ALL');
  
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

  // Has any active custom filter?
  const hasActiveFilters = 
    searchQuery.trim() !== '' ||
    sortBy !== 'confidence_desc' ||
    assetClassFilter !== 'ALL' ||
    triggerFilter !== 'ALL' ||
    directionFilter !== 'ALL' ||
    validationFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSortBy('confidence_desc');
    setAssetClassFilter('ALL');
    setTriggerFilter('ALL');
    setDirectionFilter('ALL');
    setValidationFilter('ALL');
  };

  // Filtered and sorted signals
  const processedSignals = useMemo(() => {
    const filtered = (signals || []).filter(s => {
      if (!s) return false;

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
        const reasonMatch = (ticker?.signalReason || '').toLowerCase().includes(q) || (s.validationStage || '').toLowerCase().includes(q);

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
      if (sortBy === 'newest') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (sortBy === 'oldest') {
        return (a.createdAt || 0) - (b.createdAt || 0);
      }
      return 0;
    });
  }, [signals, tickers, directionFilter, validationFilter, assetClassFilter, triggerFilter, searchQuery, sortBy]);

  const handleRunAIReview = async (symbol: string) => {
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

            return (
              <div
                key={s.id}
                className={`bg-[#0A0A0A] rounded-lg border p-3 hover:border-neutral-700 transition shadow-md relative overflow-hidden ${
                  s.validationStatus === 'CONFIRMED'
                    ? 'border-emerald-500/30'
                    : s.validationStatus === 'REJECTED_SPIKE'
                    ? 'border-rose-500/30 opacity-75'
                    : 'border-amber-500/30'
                }`}
              >
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

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border flex items-center gap-1 ${
                          isLong
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {isLong ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {s.direction} ({s.signalType})
                      </span>

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
                          title="Stop Loss & Risco Máximo"
                          badge="STOP"
                          content="Ponto de invalidação técnica da tese, posicionado além do suporte/resistência ou extremidade do Order Block."
                        >
                          <div className="cursor-help">
                            <span className="text-[9px] text-rose-400 uppercase block font-bold">Stop Loss (% Risco)</span>
                            <span className="font-extrabold text-rose-400 block">{formatPrice(stop, { currency: true })}</span>
                            <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1 rounded border border-rose-500/20 inline-block mt-0.5">
                              -{metrics.riskPct.toFixed(2)}%
                            </span>
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

                  {/* Right Action Button */}
                  <div className="w-full lg:w-auto flex items-center justify-end">
                    <Tooltip
                      position="left"
                      title="Auditoria com Inteligência Artificial"
                      badge="GEMINI / LLM"
                      content="Envia métricas de Order Flow, liquidez e estrutura gráfica para diagnóstico e verificação de risco pela IA."
                    >
                      <button
                        onClick={() => handleRunAIReview(s.symbol)}
                        disabled={loadingSymbol === s.symbol}
                        className="w-full lg:w-auto px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
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

