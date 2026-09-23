import React, { useState, useMemo } from 'react';
import { TickerData } from '../types';
import { 
  TickerVolatilityMetric, 
  VolatilityRegime, 
  calculateUniverseVolatility 
} from '../utils/volatilityUtils';
import { formatPrice, formatPercent, formatCompactNumber } from '../utils/formatters';
import { 
  Flame, 
  Activity, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  SlidersHorizontal, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Info, 
  ExternalLink,
  ChevronRight,
  Maximize2,
  Gauge,
  Scale
} from 'lucide-react';
import { Tooltip } from './Tooltip';

export interface VolatilityHeatmapProps {
  tickers: TickerData[];
  onSelectTicker: (ticker: TickerData) => void;
  className?: string;
}

export const VolatilityHeatmap: React.FC<VolatilityHeatmapProps> = ({
  tickers,
  onSelectTicker,
  className = ''
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'leaderboard'>('grid');
  const [filterRegime, setFilterRegime] = useState<'ALL' | 'SUPERNOVA' | 'HIGH' | 'SQUEEZE' | 'TOP_ACTION'>('ALL');
  const [sortBy, setSortBy] = useState<'atr' | 'action' | 'change' | 'volume'>('atr');
  const [colorMode, setColorMode] = useState<'regime' | 'action' | 'direction'>('regime');
  const [selectedMetric, setSelectedMetric] = useState<TickerVolatilityMetric | null>(null);

  // Compute all volatility and action statistics
  const summary = useMemo(() => {
    return calculateUniverseVolatility(tickers);
  }, [tickers]);

  // Filter items based on user selection
  const filteredItems = useMemo(() => {
    let list = [...summary.items];

    if (filterRegime === 'SUPERNOVA') {
      list = list.filter(i => i.volatilityRegime === 'SUPERNOVA');
    } else if (filterRegime === 'HIGH') {
      list = list.filter(i => i.volatilityRegime === 'HIGH' || i.volatilityRegime === 'SUPERNOVA');
    } else if (filterRegime === 'SQUEEZE') {
      list = list.filter(i => i.isSqueezeCandidate || i.volatilityRegime === 'COMPRESSION');
    } else if (filterRegime === 'TOP_ACTION') {
      list = list.filter(i => i.actionScore >= 65);
    }

    // Sort items
    if (sortBy === 'atr') {
      list.sort((a, b) => b.atrPercent - a.atrPercent);
    } else if (sortBy === 'action') {
      list.sort((a, b) => b.actionScore - a.actionScore);
    } else if (sortBy === 'change') {
      list.sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
    } else if (sortBy === 'volume') {
      list.sort((a, b) => b.quoteVolume24h - a.quoteVolume24h);
    }

    return list;
  }, [summary.items, filterRegime, sortBy]);

  // Color generator for heatmap tiles
  const getTileBgStyle = (item: TickerVolatilityMetric) => {
    if (colorMode === 'direction') {
      if (item.change24h >= 4) {
        return 'bg-gradient-to-br from-emerald-950/80 to-emerald-900/60 border-emerald-500/40 text-emerald-300';
      } else if (item.change24h >= 0) {
        return 'bg-gradient-to-br from-emerald-950/40 to-neutral-900 border-emerald-500/20 text-emerald-400';
      } else if (item.change24h <= -4) {
        return 'bg-gradient-to-br from-rose-950/80 to-rose-900/60 border-rose-500/40 text-rose-300';
      } else {
        return 'bg-gradient-to-br from-rose-950/40 to-neutral-900 border-rose-500/20 text-rose-400';
      }
    }

    if (colorMode === 'action') {
      if (item.actionScore >= 80) {
        return 'bg-gradient-to-br from-orange-950/90 via-amber-950/80 to-neutral-900 border-orange-500/60 text-orange-300 shadow-orange-950/30';
      } else if (item.actionScore >= 60) {
        return 'bg-gradient-to-br from-amber-950/50 to-neutral-900 border-amber-500/30 text-amber-400';
      } else if (item.actionScore >= 40) {
        return 'bg-gradient-to-br from-cyan-950/40 to-neutral-900 border-cyan-500/20 text-cyan-400';
      } else {
        return 'bg-neutral-900/80 border-white/5 text-neutral-400';
      }
    }

    // Default: 'regime'
    switch (item.volatilityRegime) {
      case 'SUPERNOVA':
        return 'bg-gradient-to-br from-pink-950/90 via-rose-950/80 to-orange-950/60 border-rose-500/60 text-rose-200 ring-1 ring-rose-500/30 shadow-lg';
      case 'HIGH':
        return 'bg-gradient-to-br from-amber-950/70 via-orange-950/50 to-neutral-900 border-amber-500/40 text-amber-300';
      case 'MODERATE':
        return 'bg-gradient-to-br from-cyan-950/40 via-blue-950/30 to-neutral-900 border-cyan-500/20 text-cyan-300';
      case 'COMPRESSION':
        return 'bg-gradient-to-br from-slate-900/90 to-neutral-950 border-indigo-500/20 text-indigo-300';
    }
  };

  const getRegimeBadge = (regime: VolatilityRegime) => {
    switch (regime) {
      case 'SUPERNOVA':
        return {
          label: 'SUPERNOVA',
          class: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          dot: 'bg-rose-400 animate-ping'
        };
      case 'HIGH':
        return {
          label: 'ALTA VOLATILIDADE',
          class: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400'
        };
      case 'MODERATE':
        return {
          label: 'MODERADA',
          class: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          dot: 'bg-cyan-400'
        };
      case 'COMPRESSION':
        return {
          label: 'SQUEEZE / COMPRESSÃO',
          class: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          dot: 'bg-indigo-400'
        };
    }
  };

  return (
    <div className={`bg-[#0A0A0C] border border-white/10 rounded-2xl p-4 sm:p-5 font-mono shadow-2xl space-y-4 ${className}`}>
      {/* Top Header & Overview */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-rose-500/20 border border-orange-500/30 text-orange-400 shadow-inner">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                Heatmap de Volatilidade & Ação (ATR)
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/30 font-bold">
                ATR PRO
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-sans mt-0.5">
              Identificação de ativos em expansão de amplitude (High Action) e compressão de volatilidade (Squeeze Setups).
            </p>
          </div>
        </div>

        {/* View Mode & Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Grid vs Leaderboard View */}
          <div className="bg-[#050505] p-1 rounded-lg border border-white/10 flex items-center">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'grid' 
                  ? 'bg-orange-500 text-black shadow-md' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Matriz Visual</span>
            </button>
            <button
              onClick={() => setViewMode('leaderboard')}
              className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'leaderboard' 
                  ? 'bg-orange-500 text-black shadow-md' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Ranking de Ação</span>
            </button>
          </div>

          {/* Color Mode Selector */}
          <div className="bg-[#050505] p-1 rounded-lg border border-white/10 flex items-center text-[10px]">
            <button
              onClick={() => setColorMode('regime')}
              className={`px-2 py-1 rounded transition ${
                colorMode === 'regime' ? 'bg-white/10 text-white font-bold' : 'text-neutral-500 hover:text-neutral-300'
              }`}
              title="Colorir por Regime de ATR (Supernova, Alta, Moderada, Compressão)"
            >
              Regime ATR
            </button>
            <button
              onClick={() => setColorMode('action')}
              className={`px-2 py-1 rounded transition ${
                colorMode === 'action' ? 'bg-white/10 text-white font-bold' : 'text-neutral-500 hover:text-neutral-300'
              }`}
              title="Colorir por Score de Ação e Liquidez"
            >
              Action Score
            </button>
            <button
              onClick={() => setColorMode('direction')}
              className={`px-2 py-1 rounded transition ${
                colorMode === 'direction' ? 'bg-white/10 text-white font-bold' : 'text-neutral-500 hover:text-neutral-300'
              }`}
              title="Colorir por Variação de Preço 24h (+/- %)"
            >
              Retorno 24h
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Top Volatile Asset */}
        <div 
          onClick={() => summary.topVolatile && setSelectedMetric(summary.topVolatile)}
          className="bg-[#050507] p-3 rounded-xl border border-rose-500/20 hover:border-rose-500/40 transition cursor-pointer relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition" />
          <div className="flex items-center justify-between text-neutral-400 text-[10px] uppercase font-bold">
            <span className="flex items-center gap-1 text-rose-400">
              <Flame className="w-3 h-3" />
              Maior Volatilidade
            </span>
            <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px]">
              #1 ATR
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-black text-white group-hover:text-rose-300 transition">
              {summary.topVolatile?.baseAsset || '---'}
            </span>
            <span className="text-sm font-black text-rose-400">
              {summary.topVolatile?.atrPercent}% ATR
            </span>
          </div>
          <div className="text-[10px] text-neutral-500 flex justify-between mt-0.5">
            <span>Range 24h: {summary.topVolatile?.intradayRangePercent}%</span>
            <span className={summary.topVolatile && summary.topVolatile.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {formatPercent(summary.topVolatile?.change24h || 0)}
            </span>
          </div>
        </div>

        {/* Top Action Asset */}
        <div 
          onClick={() => summary.topAction && setSelectedMetric(summary.topAction)}
          className="bg-[#050507] p-3 rounded-xl border border-orange-500/20 hover:border-orange-500/40 transition cursor-pointer relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-xl group-hover:bg-orange-500/10 transition" />
          <div className="flex items-center justify-between text-neutral-400 text-[10px] uppercase font-bold">
            <span className="flex items-center gap-1 text-orange-400">
              <Zap className="w-3 h-3" />
              Maior Ação & Fluxo
            </span>
            <span className="px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-300 text-[9px]">
              #1 ACTION
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-black text-white group-hover:text-orange-300 transition">
              {summary.topAction?.baseAsset || '---'}
            </span>
            <span className="text-sm font-black text-orange-400">
              {summary.topAction?.actionScore}/100
            </span>
          </div>
          <div className="text-[10px] text-neutral-500 flex justify-between mt-0.5">
            <span>Vol: ${formatCompactNumber(summary.topAction?.quoteVolume24h || 0)}</span>
            <span className="text-orange-300 font-bold">{summary.topAction?.atrPercent}% ATR</span>
          </div>
        </div>

        {/* Market Average ATR */}
        <div className="bg-[#050507] p-3 rounded-xl border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400 text-[10px] uppercase font-bold">
            <span className="flex items-center gap-1 text-cyan-400">
              <Activity className="w-3 h-3" />
              Média do Universo
            </span>
            <span className="text-[9px] text-neutral-500">
              {summary.items.length} ATIVOS
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-black text-white">
              {summary.averageAtrPercent}%
            </span>
            <span className="text-[11px] font-bold text-neutral-400">
              Mediana: {summary.medianAtrPercent}%
            </span>
          </div>
          <div className="text-[10px] text-neutral-500 flex justify-between mt-0.5">
            <span className="text-rose-400">{summary.supernovaCount} Supernova</span>
            <span className="text-amber-400">{summary.highCount} Alta Vol</span>
          </div>
        </div>

        {/* Squeeze / Compression Alerts */}
        <div 
          onClick={() => setFilterRegime(filterRegime === 'SQUEEZE' ? 'ALL' : 'SQUEEZE')}
          className={`p-3 rounded-xl border transition cursor-pointer relative overflow-hidden ${
            filterRegime === 'SQUEEZE' 
              ? 'bg-indigo-950/40 border-indigo-500/50 shadow-indigo-950/40 shadow-lg' 
              : 'bg-[#050507] border-indigo-500/20 hover:border-indigo-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-neutral-400 text-[10px] uppercase font-bold">
            <span className="flex items-center gap-1 text-indigo-400">
              <Scale className="w-3 h-3" />
              Squeeze / Compressão
            </span>
            <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-bold">
              ROMPIMENTO
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-black text-white">
              {summary.squeezeCount} Alertas
            </span>
            <span className="text-[11px] font-bold text-indigo-300">
              {summary.compressionCount} em Faixa Estreita
            </span>
          </div>
          <div className="text-[10px] text-neutral-500 flex justify-between mt-0.5">
            <span>Clique para filtrar</span>
            <span className="text-indigo-400 font-bold">&le; 2.5% ATR</span>
          </div>
        </div>
      </div>

      {/* Filter & Sort Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#050506] p-2.5 rounded-xl border border-white/5 text-xs">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-neutral-500 text-[11px] mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3" />
            Filtrar:
          </span>
          {[
            { id: 'ALL', label: `Todos (${summary.items.length})` },
            { id: 'SUPERNOVA', label: `Supernova (${summary.supernovaCount})`, highlight: 'text-rose-400' },
            { id: 'HIGH', label: `Alta Vol (${summary.highCount + summary.supernovaCount})`, highlight: 'text-amber-400' },
            { id: 'TOP_ACTION', label: `Top Ação (Score 65+)`, highlight: 'text-orange-400' },
            { id: 'SQUEEZE', label: `Squeeze (${summary.squeezeCount})`, highlight: 'text-indigo-400' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterRegime(f.id as any)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
                filterRegime === f.id
                  ? 'bg-white/10 text-white border-white/30 shadow-xs'
                  : 'bg-transparent text-neutral-400 border-transparent hover:border-white/10 hover:text-white'
              } ${f.highlight || ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-neutral-500 text-[11px]">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
          >
            <option value="atr">ATR % (Volatilidade)</option>
            <option value="action">Score de Ação</option>
            <option value="change">Variação 24h (|%|)</option>
            <option value="volume">Volume 24h ($)</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredItems.length === 0 ? (
        <div className="bg-[#050505] p-8 rounded-xl border border-white/5 text-center space-y-2">
          <Info className="w-6 h-6 text-neutral-500 mx-auto" />
          <div className="text-sm font-bold text-neutral-300">Nenhum ativo corresponde ao filtro selecionado</div>
          <button
            onClick={() => setFilterRegime('ALL')}
            className="px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-bold border border-orange-500/30 hover:bg-orange-500/30 transition"
          >
            Limpar Filtros
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Heatmap Grid Matrix View */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {filteredItems.map(item => {
            const isSelected = selectedMetric?.symbol === item.symbol;
            const tileStyle = getTileBgStyle(item);
            const badge = getRegimeBadge(item.volatilityRegime);

            return (
              <div
                key={item.symbol}
                onClick={() => setSelectedMetric(item)}
                onDoubleClick={() => onSelectTicker(item.ticker)}
                className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[110px] group ${tileStyle} ${
                  isSelected ? 'ring-2 ring-orange-400 scale-[1.02] shadow-xl z-10' : 'hover:scale-[1.02] hover:shadow-lg'
                }`}
              >
                {/* Header: Symbol + Rank */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-white text-xs tracking-wider group-hover:text-orange-300 transition">
                        {item.baseAsset}
                      </span>
                      {item.isSqueezeCandidate && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" title="Squeeze Setup" />
                      )}
                    </div>
                    <span className="text-[9px] text-neutral-400 block font-normal">
                      #{item.volatilityRank} Vol • #{item.actionRank} Act
                    </span>
                  </div>

                  {/* Volatility Badge / Dot */}
                  <span className={`text-[8px] px-1.5 py-0.2 rounded font-black uppercase border ${badge.class}`}>
                    {item.atrPercent}%
                  </span>
                </div>

                {/* Center: Price & Change */}
                <div className="my-1.5">
                  <div className="text-xs font-black text-white">
                    {formatPrice(item.price, { currency: true })}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold">
                    <span className={item.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {formatPercent(item.change24h)}
                    </span>
                    <span className="text-neutral-500 text-[9px]">
                      (Δ24h)
                    </span>
                  </div>
                </div>

                {/* Footer: Action Meter Bar + Expected Move */}
                <div className="space-y-1 pt-1 border-t border-white/5">
                  <div className="flex justify-between items-center text-[8.5px] text-neutral-400 font-bold">
                    <span>Ação: {item.actionScore}/100</span>
                    <span>1D: &plusmn;{item.atrPercent}%</span>
                  </div>
                  {/* Progress Bar for Action Score */}
                  <div className="h-1 w-full bg-black/40 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        item.actionScore >= 75 ? 'bg-orange-400' : item.actionScore >= 50 ? 'bg-amber-400' : 'bg-cyan-400'
                      }`}
                      style={{ width: `${item.actionScore}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Action Leaderboard Tabular Cards View */
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] uppercase font-bold text-neutral-500 px-3 py-1 border-b border-white/5">
            <span className="col-span-3">Ativo & Regime</span>
            <span className="col-span-2 text-right">Preço / 24h</span>
            <span className="col-span-2 text-right">ATR (14) & Range</span>
            <span className="col-span-3 text-right">Projeção 1D (Faixa Esperada)</span>
            <span className="col-span-2 text-center">Score de Ação</span>
          </div>

          <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-800">
            {filteredItems.map(item => {
              const badge = getRegimeBadge(item.volatilityRegime);
              const isSelected = selectedMetric?.symbol === item.symbol;

              return (
                <div
                  key={item.symbol}
                  onClick={() => setSelectedMetric(item)}
                  className={`p-3 rounded-xl border transition flex flex-col sm:grid sm:grid-cols-12 gap-2 items-center cursor-pointer ${
                    isSelected 
                      ? 'bg-neutral-900 border-orange-500/50 shadow-md ring-1 ring-orange-500/30' 
                      : 'bg-[#050507] border-white/5 hover:border-white/20 hover:bg-neutral-900/60'
                  }`}
                >
                  {/* Col 1: Asset & Regime (3 cols) */}
                  <div className="w-full sm:col-span-3 flex items-center justify-between sm:justify-start gap-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-neutral-300">
                        {item.volatilityRank}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-white text-xs">{item.baseAsset}</span>
                          <span className="text-[10px] text-neutral-500">/USDT</span>
                        </div>
                        <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-black border ${badge.class}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTicker(item.ticker);
                      }}
                      className="sm:hidden p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] flex items-center gap-1"
                    >
                      <span>Gráfico</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Col 2: Price / 24h (2 cols) */}
                  <div className="w-full sm:col-span-2 flex justify-between sm:block text-right">
                    <span className="sm:hidden text-neutral-500 text-[10px]">Preço:</span>
                    <div>
                      <div className="font-bold text-white text-xs">{formatPrice(item.price, { currency: true })}</div>
                      <div className={`text-[10px] font-bold ${item.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatPercent(item.change24h)}
                      </div>
                    </div>
                  </div>

                  {/* Col 3: ATR (14) & Range (2 cols) */}
                  <div className="w-full sm:col-span-2 flex justify-between sm:block text-right">
                    <span className="sm:hidden text-neutral-500 text-[10px]">ATR / Range:</span>
                    <div>
                      <div className="font-black text-orange-400 text-xs">{item.atrPercent}% ATR</div>
                      <div className="text-[10px] text-neutral-400">
                        Range: {item.intradayRangePercent}%
                      </div>
                    </div>
                  </div>

                  {/* Col 4: Projeção 1D (3 cols) */}
                  <div className="w-full sm:col-span-3 flex justify-between sm:block text-right">
                    <span className="sm:hidden text-neutral-500 text-[10px]">Faixa 1D:</span>
                    <div>
                      <div className="text-[11px] font-bold text-neutral-200">
                        {formatPrice(item.expectedMove1D.lower)} &mdash; {formatPrice(item.expectedMove1D.upper)}
                      </div>
                      <div className="text-[9px] text-neutral-500">
                        Spread: ${formatCompactNumber(item.highLowSpreadUsd)}
                      </div>
                    </div>
                  </div>

                  {/* Col 5: Action Score Meter & Chart Button (2 cols) */}
                  <div className="w-full sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                    <div className="flex-1 max-w-[80px]">
                      <div className="flex justify-between text-[9px] font-bold text-neutral-400 mb-0.5">
                        <span>Ação</span>
                        <span className="text-orange-400">{item.actionScore}</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            item.actionScore >= 75 ? 'bg-orange-400' : item.actionScore >= 50 ? 'bg-amber-400' : 'bg-cyan-400'
                          }`}
                          style={{ width: `${item.actionScore}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTicker(item.ticker);
                      }}
                      className="hidden sm:flex p-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-black border border-orange-500/30 transition text-xs items-center gap-1"
                      title="Abrir no Gráfico e Orderflow"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Asset Volatility Intelligence Drawer */}
      {selectedMetric && (
        <div className="bg-[#050507] border border-orange-500/30 rounded-xl p-4 shadow-xl space-y-3 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">{selectedMetric.symbol}</span>
                  <span className={`text-[9px] px-2 py-0.2 rounded font-black border ${getRegimeBadge(selectedMetric.volatilityRegime).class}`}>
                    {getRegimeBadge(selectedMetric.volatilityRegime).label}
                  </span>
                  {selectedMetric.isSqueezeCandidate && (
                    <span className="text-[9px] px-2 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-black">
                      SQUEEZE ATIVO
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400">
                  Preço: <strong className="text-white">{formatPrice(selectedMetric.price, { currency: true })}</strong> &bull; Variação 24h: <strong className={selectedMetric.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatPercent(selectedMetric.change24h)}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectTicker(selectedMetric.ticker)}
                className="px-3 py-1.5 rounded-lg bg-orange-500 text-black font-extrabold text-xs flex items-center gap-1.5 hover:bg-orange-400 transition shadow-md"
              >
                <span>Abrir no Gráfico & Order Flow</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSelectedMetric(null)}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-900 text-neutral-400 hover:text-white border border-white/10 text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>

          {/* Metric Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            {/* ATR 14 Estimates */}
            <div className="bg-[#09090b] p-2.5 rounded-lg border border-white/5 space-y-0.5">
              <span className="text-[10px] text-neutral-400 uppercase font-bold">ATR Estimado</span>
              <div className="font-black text-orange-400 text-sm">
                {selectedMetric.atrPercent}% ({formatPrice(selectedMetric.estimatedAtr, { currency: true })})
              </div>
              <span className="text-[9px] text-neutral-500 block">Amplitude média 24h</span>
            </div>

            {/* Expected 1D Move Band */}
            <div className="bg-[#09090b] p-2.5 rounded-lg border border-white/5 space-y-0.5">
              <span className="text-[10px] text-neutral-400 uppercase font-bold">Faixa Esperada 1D (&plusmn;1 ATR)</span>
              <div className="font-bold text-white text-xs truncate">
                {formatPrice(selectedMetric.expectedMove1D.lower)} &mdash; {formatPrice(selectedMetric.expectedMove1D.upper)}
              </div>
              <span className="text-[9px] text-neutral-500 block">Projeção estatística de 68%</span>
            </div>

            {/* Extreme 2D Move Band */}
            <div className="bg-[#09090b] p-2.5 rounded-lg border border-white/5 space-y-0.5">
              <span className="text-[10px] text-neutral-400 uppercase font-bold">Faixa Extrema 2D (&plusmn;2 ATR)</span>
              <div className="font-bold text-neutral-300 text-xs truncate">
                {formatPrice(selectedMetric.expectedMove2D.lower)} &mdash; {formatPrice(selectedMetric.expectedMove2D.upper)}
              </div>
              <span className="text-[9px] text-neutral-500 block">Teto/Piso de exaustão</span>
            </div>

            {/* Action Score & Ranking */}
            <div className="bg-[#09090b] p-2.5 rounded-lg border border-white/5 space-y-0.5">
              <span className="text-[10px] text-neutral-400 uppercase font-bold">Score de Ação & Volume</span>
              <div className="font-black text-amber-400 text-sm">
                {selectedMetric.actionScore}/100 (#{selectedMetric.actionRank})
              </div>
              <span className="text-[9px] text-neutral-500 block">
                Vol 24h: ${formatCompactNumber(selectedMetric.quoteVolume24h)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
