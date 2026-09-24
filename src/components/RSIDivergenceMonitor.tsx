import React, { useState, useMemo } from 'react';
import { TickerData, TradeSignal, RSIDivergenceItem, RSIDivergenceType } from '../types';
import { 
  Activity, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  LineChart, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  SlidersHorizontal,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Info,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { formatCompactNumber, formatPrice } from '../utils/formatters';
import { scanUniverseRSIDivergences, scanRSIDivergence } from '../utils/rsiDivergenceUtils';
import { useToast } from './Toast';
import { Tooltip } from './Tooltip';

interface RSIDivergenceMonitorProps {
  tickers: TickerData[];
  selectedTicker?: TickerData | null;
  onSelectTicker?: (ticker: TickerData) => void;
  onRequestAIReview?: (ticker: TickerData, signal?: TradeSignal) => void;
  onOpenChart?: (ticker: TickerData) => void;
}

export const RSIDivergenceMonitor: React.FC<RSIDivergenceMonitorProps> = ({
  tickers = [],
  selectedTicker,
  onSelectTicker,
  onRequestAIReview,
  onOpenChart
}) => {
  const { showToast } = useToast();
  const [timeframe, setTimeframe] = useState<'15m' | '1h' | '4h' | '1D'>('1h');
  const [filterType, setFilterType] = useState<'ALL' | 'DIVERGENCES_ONLY' | 'BULLISH' | 'BEARISH'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDivId, setSelectedDivId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Scan universe with current timeframe
  const universeData = useMemo(() => {
    return scanUniverseRSIDivergences(tickers, timeframe);
  }, [tickers, timeframe]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return universeData.items.filter(item => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!item.symbol.toLowerCase().includes(q)) return false;
      }

      // Type filter
      if (filterType === 'DIVERGENCES_ONLY' && item.divergenceType === 'NO_DIVERGENCE') {
        return false;
      }
      if (filterType === 'BULLISH' && (item.bias !== 'BULLISH' || item.divergenceType === 'NO_DIVERGENCE')) {
        return false;
      }
      if (filterType === 'BEARISH' && (item.bias !== 'BEARISH' || item.divergenceType === 'NO_DIVERGENCE')) {
        return false;
      }

      return true;
    });
  }, [universeData.items, searchQuery, filterType]);

  // Selected item for expanded inspector
  const activeItem = useMemo(() => {
    if (selectedDivId) {
      return universeData.items.find(i => i.id === selectedDivId) || null;
    }
    if (selectedTicker) {
      return universeData.items.find(i => i.symbol === selectedTicker.symbol) || universeData.topOpportunity;
    }
    return universeData.topOpportunity;
  }, [selectedDivId, selectedTicker, universeData]);

  const handleCopySetup = (item: RSIDivergenceItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `🎯 Setup Divergência RSI (${item.symbol} - ${item.timeframe})
Tipo: ${item.divergenceType.replace('_', ' ')}
Preço Atual: $${formatPrice(item.priceCurrent)}
RSI (14): ${item.rsiCurrent}
Entrada: $${formatPrice(item.entryZone[0])} - $${formatPrice(item.entryZone[1])}
Stop Loss: $${formatPrice(item.stopLoss)}
Alvo 1: $${formatPrice(item.target1)} | Alvo 2: $${formatPrice(item.target2)}
R:R: ${item.riskRewardRatio}x
Confluência: ${item.confidence}%`;

    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    showToast('success', 'Setup Copiado!', `Plano de trade para ${item.symbol} copiado.`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="bg-neutral-950/90 backdrop-blur-xl border border-neutral-800/80 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Background ambient glow */}
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-cyan-600/10 blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-neutral-800/80 pb-3.5 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-neutral-900 border border-neutral-700/60 text-cyan-400 shadow-inner">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                RSI Divergence Monitor
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                  REVERSAL ENGINE
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-neutral-400 font-mono">
              Detecção algorítmica de divergências regulares e ocultas no RSI (14)
            </p>
          </div>
        </div>

        {/* Controls: Timeframe & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe selector */}
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
            {(['15m', '1h', '4h', '1D'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded-md transition ${
                  timeframe === tf
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Filtrar par..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 w-28 sm:w-36 transition"
            />
          </div>
        </div>
      </div>

      {/* Top Metrics HUD Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* Bullish Divergences Card */}
        <div 
          onClick={() => setFilterType(filterType === 'BULLISH' ? 'ALL' : 'BULLISH')}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            filterType === 'BULLISH'
              ? 'bg-emerald-950/40 border-emerald-500/50 ring-1 ring-emerald-500/40'
              : 'bg-neutral-900/50 border-neutral-800 hover:border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Divergências Altistas
            </span>
            {universeData.bullishCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {universeData.bullishCount}
            </span>
            <span className="text-[10px] font-mono text-neutral-500">pares em reversão</span>
          </div>
        </div>

        {/* Bearish Divergences Card */}
        <div 
          onClick={() => setFilterType(filterType === 'BEARISH' ? 'ALL' : 'BEARISH')}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            filterType === 'BEARISH'
              ? 'bg-rose-950/40 border-rose-500/50 ring-1 ring-rose-500/40'
              : 'bg-neutral-900/50 border-neutral-800 hover:border-rose-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              Divergências Baixistas
            </span>
            {universeData.bearishCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-rose-400">
              {universeData.bearishCount}
            </span>
            <span className="text-[10px] font-mono text-neutral-500">pares em distribuição</span>
          </div>
        </div>

        {/* Average Universe RSI Card */}
        <div className="p-3 rounded-xl border bg-neutral-900/50 border-neutral-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              RSI Médio Global
            </span>
            <span className="text-[10px] font-mono font-bold text-neutral-400">
              {timeframe}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl font-bold font-mono ${
              universeData.avgRSI >= 65 ? 'text-rose-400' : universeData.avgRSI <= 35 ? 'text-emerald-400' : 'text-cyan-300'
            }`}>
              {universeData.avgRSI}
            </span>
            <span className="text-[10px] font-mono text-neutral-500">
              {universeData.marketCondition === 'OVERBOUGHT' ? 'Sobrecomprado' : universeData.marketCondition === 'OVERSOLD' ? 'Sobrevendido' : 'Neutro'}
            </span>
          </div>
        </div>

        {/* Filter Switcher Card */}
        <div 
          onClick={() => setFilterType(filterType === 'DIVERGENCES_ONLY' ? 'ALL' : 'DIVERGENCES_ONLY')}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            filterType === 'DIVERGENCES_ONLY'
              ? 'bg-cyan-950/40 border-cyan-500/50 ring-1 ring-cyan-500/40'
              : 'bg-neutral-900/50 border-neutral-800 hover:border-cyan-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              Total de Alertas
            </span>
            <span className="text-[10px] font-mono text-cyan-400 font-bold">
              {filterType === 'DIVERGENCES_ONLY' ? 'ATIVO' : 'TODOS'}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-cyan-300">
              {universeData.regularCount + universeData.hiddenCount}
            </span>
            <span className="text-[10px] font-mono text-neutral-500">de {tickers.length} ativos</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 no-scrollbar">
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 border ${
            filterType === 'ALL'
              ? 'bg-neutral-800 text-white border-neutral-600'
              : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <span>Todos ({universeData.items.length})</span>
        </button>
        <button
          onClick={() => setFilterType('DIVERGENCES_ONLY')}
          className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 border ${
            filterType === 'DIVERGENCES_ONLY'
              ? 'bg-cyan-950/50 text-cyan-300 border-cyan-500/60'
              : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Apenas Divergências ({universeData.regularCount + universeData.hiddenCount})</span>
        </button>
        <button
          onClick={() => setFilterType('BULLISH')}
          className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 border ${
            filterType === 'BULLISH'
              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/60'
              : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <span>Altistas ({universeData.bullishCount})</span>
        </button>
        <button
          onClick={() => setFilterType('BEARISH')}
          className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 border ${
            filterType === 'BEARISH'
              ? 'bg-rose-950/50 text-rose-300 border-rose-500/60'
              : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <TrendingDown className="w-3 h-3 text-rose-400" />
          <span>Baixistas ({universeData.bearishCount})</span>
        </button>
      </div>

      {/* Main Content Layout: Grid List & Detailed Focus Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left/Main Column: Pairs List with Divergence Badges & RSI Gauges (7 cols) */}
        <div className="lg:col-span-7 space-y-2 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-neutral-900/40 border border-neutral-800 text-neutral-500 font-mono text-xs">
              Nenhuma divergência encontrada para os filtros selecionados.
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = activeItem?.id === item.id;
              const hasDiv = item.divergenceType !== 'NO_DIVERGENCE';
              const isBull = item.bias === 'BULLISH';
              const isBear = item.bias === 'BEARISH';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedDivId(item.id);
                    if (onSelectTicker) onSelectTicker(item.ticker);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-800/90 border-cyan-500/60 shadow-lg shadow-cyan-950/30'
                      : hasDiv
                      ? isBull
                        ? 'bg-emerald-950/15 border-emerald-500/30 hover:border-emerald-500/50'
                        : 'bg-rose-950/15 border-rose-500/30 hover:border-rose-500/50'
                      : 'bg-neutral-900/50 border-neutral-800/80 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono text-sm">
                        {item.symbol}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-300">
                        ${formatPrice(item.priceCurrent)}
                      </span>
                      <span className={`text-[10px] font-mono font-bold ${
                        (item.ticker.priceChangePercent24h || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {(item.ticker.priceChangePercent24h || 0) >= 0 ? '+' : ''}
                        {(item.ticker.priceChangePercent24h || 0).toFixed(2)}%
                      </span>
                    </div>

                    {/* Divergence Type Badge */}
                    <div className="flex items-center gap-1.5">
                      {item.divergenceType === 'REGULAR_BULLISH' && (
                        <Tooltip
                          position="top"
                          title="Divergência Regular de Alta"
                          content="Preço fez fundo mais baixo, mas o oscilador RSI fez fundo mais alto. Indica exaustão vendedora e reversão altista iminente."
                          badge="REVERSÃO"
                          badgeColor="emerald"
                        >
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3" /> REGULAR BULL
                          </span>
                        </Tooltip>
                      )}
                      {item.divergenceType === 'REGULAR_BEARISH' && (
                        <Tooltip
                          position="top"
                          title="Divergência Regular de Baixa"
                          content="Preço fez topo mais alto, mas o RSI fez topo mais baixo. Indica exaustão compradora e provável correção baixista."
                          badge="REVERSÃO"
                          badgeColor="rose"
                        >
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                            <ArrowDownRight className="w-3 h-3" /> REGULAR BEAR
                          </span>
                        </Tooltip>
                      )}
                      {item.divergenceType === 'HIDDEN_BULLISH' && (
                        <Tooltip
                          position="top"
                          title="Divergência Oculta de Alta"
                          content="Preço fez fundo mais alto durante correção enquanto o RSI recuou mais fundo. Indica continuação da tendência altista principal."
                          badge="CONTINUAÇÃO"
                          badgeColor="cyan"
                        >
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> HIDDEN BULL
                          </span>
                        </Tooltip>
                      )}
                      {item.divergenceType === 'HIDDEN_BEARISH' && (
                        <Tooltip
                          position="top"
                          title="Divergência Oculta de Baixa"
                          content="Preço fez topo mais baixo durante repique enquanto o RSI subiu a patamar superior. Indica continuação da tendência baixista."
                          badge="CONTINUAÇÃO"
                          badgeColor="amber"
                        >
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> HIDDEN BEAR
                          </span>
                        </Tooltip>
                      )}
                      {item.divergenceType === 'NO_DIVERGENCE' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-neutral-500 bg-neutral-900 border border-neutral-800">
                          NEUTRO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* RSI Bar & Metrics */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-neutral-400 flex items-center gap-1">
                        <span>RSI (14):</span>
                        <strong className={`font-bold ${
                          item.rsiCurrent >= 70 ? 'text-rose-400' : item.rsiCurrent <= 30 ? 'text-emerald-400' : 'text-neutral-200'
                        }`}>
                          {item.rsiCurrent}
                        </strong>
                        <span className="text-[10px] text-neutral-500">
                          (Prev: {item.rsiPrevSwing})
                        </span>
                      </span>

                      <span className="text-neutral-400">
                        {hasDiv ? (
                          <span className="text-cyan-400 font-semibold">
                            Confluência: {item.confidence}% • R:R {item.riskRewardRatio}
                          </span>
                        ) : (
                          <span className="text-neutral-500">Sem divergência ativa</span>
                        )}
                      </span>
                    </div>

                    {/* Progress visualizer for RSI */}
                    <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden relative">
                      {/* Oversold zone marker (0-30) */}
                      <div className="absolute left-0 top-0 bottom-0 w-[30%] bg-emerald-500/20" />
                      {/* Overbought zone marker (70-100) */}
                      <div className="absolute right-0 top-0 bottom-0 w-[30%] bg-rose-500/20" />
                      {/* Current RSI Bar */}
                      <div 
                        className={`h-full transition-all duration-300 ${
                          item.rsiCurrent <= 30 ? 'bg-emerald-500' : item.rsiCurrent >= 70 ? 'bg-rose-500' : 'bg-cyan-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, item.rsiCurrent))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Detailed Inspector Card for Selected Pair (5 cols) */}
        <div className="lg:col-span-5 bg-neutral-900/50 border border-neutral-800/90 rounded-xl p-4 flex flex-col justify-between space-y-3">
          {activeItem ? (
            <>
              <div>
                {/* Active Item Title & Status */}
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5 mb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-white font-mono">
                        {activeItem.symbol}
                      </h4>
                      <span className="text-xs font-mono text-neutral-300">
                        ${formatPrice(activeItem.priceCurrent)}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                      Timeframe {activeItem.timeframe} • {activeItem.ticker.name}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-mono text-neutral-500 block">Confluência</span>
                    <span className="text-base font-bold font-mono text-emerald-400">
                      {activeItem.confidence}%
                    </span>
                  </div>
                </div>

                {/* Divergence Diagnosis Box */}
                <div className={`p-3 rounded-xl border text-xs font-mono mb-3 ${
                  activeItem.bias === 'BULLISH'
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                    : activeItem.bias === 'BEARISH'
                    ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                }`}>
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    {activeItem.bias === 'BULLISH' ? (
                      <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    ) : activeItem.bias === 'BEARISH' ? (
                      <ArrowDownRight className="w-4 h-4 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-neutral-500" />
                    )}
                    <span>{activeItem.verdict}</span>
                  </div>
                </div>

                {/* Technical Confluence Factors */}
                <div className="space-y-1.5 mb-3">
                  <span className="text-[11px] font-semibold text-neutral-400 block font-mono">
                    Fatores de Confluência:
                  </span>
                  {activeItem.confluences.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>

                {/* Execution Plan Levels */}
                <div className="bg-neutral-950/80 border border-neutral-800 rounded-lg p-2.5 space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Zona de Entrada:</span>
                    <span className="font-bold text-white">
                      ${formatPrice(activeItem.entryZone[0])} - ${formatPrice(activeItem.entryZone[1])}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Stop Loss Técnico:</span>
                    <span className="font-bold text-rose-400">${formatPrice(activeItem.stopLoss)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Alvo 1 (Pivot/POC):</span>
                    <span className="font-bold text-emerald-400">${formatPrice(activeItem.target1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Alvo 2 (Liquidez Macro):</span>
                    <span className="font-bold text-emerald-400">${formatPrice(activeItem.target2)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-neutral-800 text-cyan-300">
                    <span>Risco / Retorno:</span>
                    <span className="font-bold">{activeItem.riskRewardRatio}x</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
                <button
                  onClick={(e) => handleCopySetup(activeItem, e)}
                  className="py-1.5 px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono font-semibold transition flex items-center justify-center gap-1.5 border border-neutral-700"
                  title="Copiar Setup de Trade"
                >
                  {copiedId === activeItem.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  )}
                  <span>{copiedId === activeItem.id ? 'Copiado!' : 'Copiar'}</span>
                </button>

                {onRequestAIReview && (
                  <button
                    onClick={() => onRequestAIReview(activeItem.ticker)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono font-semibold transition flex items-center justify-center gap-1.5 border border-neutral-700"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Auditar por IA</span>
                  </button>
                )}

                {onOpenChart && (
                  <button
                    onClick={() => onOpenChart(activeItem.ticker)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-cyan-950/40"
                  >
                    <LineChart className="w-3.5 h-3.5" />
                    <span>Ver no Gráfico</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-neutral-500 font-mono text-xs">
              Selecione um ativo para inspecionar os níveis de divergência.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
