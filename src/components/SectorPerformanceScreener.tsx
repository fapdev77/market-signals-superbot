import React, { useState, useMemo } from 'react';
import { 
  TickerData, 
  MarketSector 
} from '../types';
import { 
  SectorCategoryKey, 
  SECTOR_DEFINITIONS, 
  SectorAggregatedMetrics, 
  computeSectorPerformanceSummary,
  classifyAssetSector
} from '../utils/sectorPerformanceUtils';
import { 
  formatPrice, 
  formatPercent, 
  formatCompactNumber, 
  formatDateTime 
} from '../utils/formatters';
import { 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Cpu, 
  Flame, 
  Gamepad2, 
  HardDrive, 
  Building2, 
  Landmark, 
  Coins, 
  RefreshCw, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  BarChart3, 
  PieChart, 
  Sliders, 
  Sparkles, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight,
  Info,
  DollarSign,
  Percent,
  ArrowUpDown
} from 'lucide-react';
import { Tooltip } from './Tooltip';
import { useToast } from './Toast';

interface SectorPerformanceScreenerProps {
  tickers: TickerData[];
  onSelectTicker?: (ticker: TickerData) => void;
  onNavigateToTab?: (tab: string) => void;
}

// Icon resolver helper
const getSectorIcon = (sectorKey: SectorCategoryKey) => {
  switch (sectorKey) {
    case 'L1_L2': return Layers;
    case 'DEFI': return Zap;
    case 'AI': return Cpu;
    case 'MEME': return Flame;
    case 'GAMING': return Gamepad2;
    case 'DEPIN': return HardDrive;
    case 'RWA': return Building2;
    case 'TRADFI': return Landmark;
    case 'STABLECOIN': return Coins;
    default: return Activity;
  }
};

export const SectorPerformanceScreener: React.FC<SectorPerformanceScreenerProps> = ({
  tickers = [],
  onSelectTicker,
  onNavigateToTab
}) => {
  const { showToast } = useToast();

  // State
  const [selectedSectorKey, setSelectedSectorKey] = useState<SectorCategoryKey | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [phaseFilter, setPhaseFilter] = useState<'ALL' | 'LEADER' | 'INFLOW' | 'OUTFLOW'>('ALL');
  const [sortBy, setSortBy] = useState<'PERF_DESC' | 'PERF_ASC' | 'ALPHA_DESC' | 'VOLUME_DESC' | 'OI_DESC'>('PERF_DESC');
  const [assetSortBy, setAssetSortBy] = useState<'PERF_DESC' | 'PERF_ASC' | 'VOLUME_DESC' | 'OI_DESC'>('PERF_DESC');
  const [viewLayout, setViewLayout] = useState<'cards' | 'matrix'>('cards');

  // Compute aggregated sector metrics
  const sectorSummary = useMemo(() => {
    return computeSectorPerformanceSummary(tickers);
  }, [tickers]);

  // Filtered sectors
  const filteredSectors = useMemo(() => {
    let list = sectorSummary.sectors.filter(s => s.tickersCount > 0);

    if (phaseFilter === 'LEADER') {
      list = list.filter(s => s.rotationPhase === 'LEADER');
    } else if (phaseFilter === 'INFLOW') {
      list = list.filter(s => s.rotationPhase === 'ROTATION_INFLOW' || s.rotationPhase === 'LEADER');
    } else if (phaseFilter === 'OUTFLOW') {
      list = list.filter(s => s.rotationPhase === 'ROTATION_OUTFLOW');
    }

    list.sort((a, b) => {
      if (sortBy === 'PERF_DESC') return b.equalWeightedReturn24h - a.equalWeightedReturn24h;
      if (sortBy === 'PERF_ASC') return a.equalWeightedReturn24h - b.equalWeightedReturn24h;
      if (sortBy === 'ALPHA_DESC') return b.alphaVsBtc - a.alphaVsBtc;
      if (sortBy === 'VOLUME_DESC') return b.totalVolume24hUsd - a.totalVolume24hUsd;
      if (sortBy === 'OI_DESC') return b.totalOpenInterestUsd - a.totalOpenInterestUsd;
      return b.equalWeightedReturn24h - a.equalWeightedReturn24h;
    });

    return list;
  }, [sectorSummary.sectors, phaseFilter, sortBy]);

  // Filtered Assets for the Table Drill-Down
  const filteredAssets = useMemo(() => {
    let assets = [...tickers];

    // Filter by sector if not ALL
    if (selectedSectorKey !== 'ALL') {
      assets = assets.filter(t => classifyAssetSector(t).sectorKey === selectedSectorKey);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      assets = assets.filter(t => {
        const info = classifyAssetSector(t);
        return (
          t.symbol.toLowerCase().includes(q) ||
          (t.name && t.name.toLowerCase().includes(q)) ||
          info.assetName.toLowerCase().includes(q) ||
          info.categoryTag.toLowerCase().includes(q)
        );
      });
    }

    // Sort assets
    assets.sort((a, b) => {
      const volA = a.quoteVolume24h || a.volume24h * a.price || 0;
      const volB = b.quoteVolume24h || b.volume24h * b.price || 0;
      const oiA = a.openInterest || 0;
      const oiB = b.openInterest || 0;

      if (assetSortBy === 'PERF_DESC') return b.priceChangePercent24h - a.priceChangePercent24h;
      if (assetSortBy === 'PERF_ASC') return a.priceChangePercent24h - b.priceChangePercent24h;
      if (assetSortBy === 'VOLUME_DESC') return volB - volA;
      if (assetSortBy === 'OI_DESC') return oiB - oiA;
      return b.priceChangePercent24h - a.priceChangePercent24h;
    });

    return assets;
  }, [tickers, selectedSectorKey, searchQuery, assetSortBy]);

  const handleSelectAsset = (t: TickerData) => {
    if (onSelectTicker) {
      onSelectTicker(t);
      if (onNavigateToTab) {
        onNavigateToTab('chart');
      }
      showToast('info', `Ativo ${t.symbol} selecionado`, 'Visualizando análise técnica no gráfico.');
    }
  };

  return (
    <div className="space-y-4 font-sans text-neutral-200">
      {/* HEADER MACRO BANNER */}
      <div className="bg-[#0A0A0A] p-4.5 rounded-xl border border-white/10 shadow-2xl space-y-3.5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <PieChart className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  Sector Performance Screener & Capital Rotation
                </h2>
                <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded font-mono">
                  ALPHA VS BTC
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Monitor de rotação de capital setorial, retorno médio ponderado por volume, força relativa contra o Bitcoin e breadth de mercado.
              </p>
            </div>
          </div>

          {/* Macro Benchmark Badges */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            {/* BTC Benchmark */}
            <div className="bg-[#050505] px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
              <span className="text-neutral-400 text-[10px] uppercase font-bold">Benchmark BTC:</span>
              <span className={`font-black ${
                sectorSummary.btcBenchmarkReturn24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {sectorSummary.btcBenchmarkReturn24h >= 0 ? '▲ +' : '▼ '}{sectorSummary.btcBenchmarkReturn24h.toFixed(2)}%
              </span>
            </div>

            {/* Market Equal Weight Average */}
            <div className="bg-[#050505] px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
              <span className="text-neutral-400 text-[10px] uppercase font-bold">Média Mercado:</span>
              <span className={`font-black ${
                sectorSummary.marketEqualWeightReturn24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {sectorSummary.marketEqualWeightReturn24h >= 0 ? '+' : ''}{sectorSummary.marketEqualWeightReturn24h.toFixed(2)}%
              </span>
            </div>

            {/* Total Market Turnover */}
            <div className="bg-[#050505] px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5">
              <span className="text-neutral-400 text-[10px]">Volume Total 24h:</span>
              <span className="text-white font-bold">${formatCompactNumber(sectorSummary.totalMarketTurnoverUsd)}</span>
            </div>
          </div>
        </div>

        {/* TOP LEADER & INFLOW HIGHLIGHT TILES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
          {/* Tile 1: Top Capital Inflow */}
          <div className="bg-[#050505] p-3 rounded-xl border border-cyan-500/30 space-y-1">
            <span className="text-[10px] text-cyan-400 uppercase font-bold flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Maior Entrada de Capital
            </span>
            <div className="flex items-center justify-between">
              <span className="font-black text-sm text-white">
                {sectorSummary.topCapitalInflowSector?.definition.name || '--'}
              </span>
              <span className="text-xs font-bold text-cyan-400 bg-cyan-500/20 px-1.5 py-0.5 rounded">
                +{sectorSummary.topCapitalInflowSector?.alphaVsBtc.toFixed(2)}% Alpha
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 font-sans">
              Setor com maior aceleração de fluxo comprador em relação ao Bitcoin.
            </p>
          </div>

          {/* Tile 2: Leading Sector */}
          <div className="bg-[#050505] p-3 rounded-xl border border-emerald-500/30 space-y-1">
            <span className="text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Setor Líder 24h
            </span>
            <div className="flex items-center justify-between">
              <span className="font-black text-sm text-white">
                {sectorSummary.leadingSector?.definition.name || '--'}
              </span>
              <span className="text-xs font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                {sectorSummary.leadingSector?.equalWeightedReturn24h ? `+${sectorSummary.leadingSector.equalWeightedReturn24h.toFixed(2)}%` : '--'}
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 font-sans">
              Maior rentabilidade média diária entre todos os setores monitorados.
            </p>
          </div>

          {/* Tile 3: Weakest / Laggard Sector */}
          <div className="bg-[#050505] p-3 rounded-xl border border-rose-500/20 space-y-1">
            <span className="text-[10px] text-rose-400 uppercase font-bold flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Setor Retardatário (Laggard)
            </span>
            <div className="flex items-center justify-between">
              <span className="font-black text-sm text-white">
                {sectorSummary.weakestSector?.definition.name || '--'}
              </span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                (sectorSummary.weakestSector?.equalWeightedReturn24h || 0) >= 0 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-500/20 text-rose-400'
              }`}>
                {sectorSummary.weakestSector?.equalWeightedReturn24h ? `${sectorSummary.weakestSector.equalWeightedReturn24h.toFixed(2)}%` : '--'}
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 font-sans">
              Menor tração no momento, com potencial de repique ou saída de capital.
            </p>
          </div>

          {/* Tile 4: Breadth / Dominance */}
          <div className="bg-[#050505] p-3 rounded-xl border border-white/10 space-y-1">
            <span className="text-[10px] text-orange-400 uppercase font-bold flex items-center gap-1">
              <Activity className="h-3 w-3" /> Amplitude Geral (Breadth)
            </span>
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">
                {tickers.filter(t => t.priceChangePercent24h > 0).length} / {tickers.length} em Alta
              </span>
              <span className="text-xs font-bold text-orange-300">
                {tickers.length > 0 ? ((tickers.filter(t => t.priceChangePercent24h > 0).length / tickers.length) * 100).toFixed(0) : 0}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden flex">
              <div 
                className="bg-emerald-500 h-full" 
                style={{ width: `${tickers.length > 0 ? (tickers.filter(t => t.priceChangePercent24h > 0).length / tickers.length) * 100 : 50}%` }} 
              />
              <div 
                className="bg-rose-500 h-full flex-1" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & SORT TOOLBAR */}
      <div className="bg-[#0A0A0A] p-3 rounded-xl border border-white/10 flex flex-wrap items-center justify-between gap-3">
        {/* Phase Tabs */}
        <div className="flex items-center bg-[#050505] p-1 rounded-lg border border-white/10 text-xs font-mono">
          <button
            type="button"
            onClick={() => setPhaseFilter('ALL')}
            className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
              phaseFilter === 'ALL' ? 'bg-orange-500 text-black shadow-xs font-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Todos os Setores ({sectorSummary.sectors.filter(s => s.tickersCount > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setPhaseFilter('LEADER')}
            className={`px-3 py-1 rounded-md font-bold transition flex items-center gap-1 cursor-pointer ${
              phaseFilter === 'LEADER' ? 'bg-orange-500 text-black shadow-xs font-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>🚀 Líderes</span>
          </button>
          <button
            type="button"
            onClick={() => setPhaseFilter('INFLOW')}
            className={`px-3 py-1 rounded-md font-bold transition flex items-center gap-1 cursor-pointer ${
              phaseFilter === 'INFLOW' ? 'bg-orange-500 text-black shadow-xs font-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>⚡ Entrada (Inflow)</span>
          </button>
          <button
            type="button"
            onClick={() => setPhaseFilter('OUTFLOW')}
            className={`px-3 py-1 rounded-md font-bold transition flex items-center gap-1 cursor-pointer ${
              phaseFilter === 'OUTFLOW' ? 'bg-orange-500 text-black shadow-xs font-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>🔻 Saída (Outflow)</span>
          </button>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-[10px] text-neutral-400 uppercase font-bold">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#050505] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:border-orange-500 focus:outline-none cursor-pointer"
          >
            <option value="PERF_DESC">Maior Retorno 24h</option>
            <option value="PERF_ASC">Menor Retorno 24h</option>
            <option value="ALPHA_DESC">Maior Alpha vs BTC</option>
            <option value="VOLUME_DESC">Maior Volume 24h (USD)</option>
            <option value="OI_DESC">Maior Open Interest ($)</option>
          </select>
        </div>
      </div>

      {/* SECTOR CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSectors.map((sector) => {
          const Icon = getSectorIcon(sector.sectorKey);
          const isSelected = selectedSectorKey === sector.sectorKey;
          const isPositive = sector.equalWeightedReturn24h >= 0;
          const isAlphaPositive = sector.alphaVsBtc >= 0;

          return (
            <div
              key={sector.sectorKey}
              onClick={() => {
                setSelectedSectorKey(isSelected ? 'ALL' : sector.sectorKey);
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3.5 ${
                isSelected
                  ? 'bg-[#0f0f0f] border-orange-500 shadow-xl ring-1 ring-orange-500/40'
                  : 'bg-[#080808] border-white/10 hover:border-white/20 hover:bg-[#0c0c0c]'
              }`}
            >
              {/* Sector Header */}
              <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="p-2 rounded-lg border text-white"
                    style={{ 
                      backgroundColor: `${sector.definition.color}20`,
                      borderColor: `${sector.definition.color}40`,
                      color: sector.definition.color 
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                      {sector.definition.name}
                    </h3>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {sector.tickersCount} Ativos Monitorados • {sector.marketVolumeSharePct.toFixed(1)}% Share
                    </span>
                  </div>
                </div>

                {/* Rotation Phase Badge */}
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border font-mono ${
                  sector.rotationPhase === 'LEADER'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                    : (sector.rotationPhase === 'ROTATION_INFLOW'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : (sector.rotationPhase === 'ROTATION_OUTFLOW'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                            : 'bg-neutral-900 text-neutral-400 border-white/10'))
                }`}>
                  {sector.rotationPhase === 'LEADER' ? '🚀 Líder' : (sector.rotationPhase === 'ROTATION_INFLOW' ? '⚡ Inflow' : (sector.rotationPhase === 'ROTATION_OUTFLOW' ? '🔻 Outflow' : 'Consolidação'))}
                </span>
              </div>

              {/* Primary Performance Metric Row */}
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="bg-[#050505] p-2 rounded-lg border border-white/5">
                  <span className="text-[9px] text-neutral-400 uppercase font-bold block mb-0.5">Retorno Médio 24h</span>
                  <div className={`text-base font-black flex items-center gap-1 ${
                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    <span>{isPositive ? '+' : ''}{sector.equalWeightedReturn24h.toFixed(2)}%</span>
                  </div>
                </div>

                <div className="bg-[#050505] p-2 rounded-lg border border-white/5">
                  <span className="text-[9px] text-neutral-400 uppercase font-bold block mb-0.5">Alpha vs BTC</span>
                  <div className={`text-base font-black flex items-center gap-1 ${
                    isAlphaPositive ? 'text-cyan-400' : 'text-amber-400'
                  }`}>
                    <span>{isAlphaPositive ? '+' : ''}{sector.alphaVsBtc.toFixed(2)}%</span>
                  </div>
                </div>
              </div>

              {/* Volume & Breadth Metrics */}
              <div className="space-y-1.5 text-[11px] font-mono">
                <div className="flex justify-between items-center text-neutral-300">
                  <span className="text-neutral-400">Volume 24h:</span>
                  <span className="font-bold text-white">${formatCompactNumber(sector.totalVolume24hUsd)}</span>
                </div>

                <div className="flex justify-between items-center text-neutral-300">
                  <span className="text-neutral-400">Open Interest:</span>
                  <span className="font-bold text-white">${formatCompactNumber(sector.totalOpenInterestUsd)}</span>
                </div>

                {/* Breadth Bar (Altas vs Baixas no setor) */}
                <div className="space-y-1 pt-1 border-t border-white/5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-neutral-400">Amplitude (Breadth):</span>
                    <span className="text-neutral-300 font-bold">
                      <strong className="text-emerald-400">{sector.advancersCount}▲</strong> / <strong className="text-rose-400">{sector.declinersCount}▼</strong> ({sector.advanceDeclineRatio.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: `${sector.advanceDeclineRatio}%` }} />
                    <div className="bg-rose-500 h-full flex-1" />
                  </div>
                </div>
              </div>

              {/* Top Gainer & Worst Laggard */}
              <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px] font-mono">
                {sector.topGainer && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectAsset(sector.topGainer!.ticker);
                    }}
                    className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition cursor-pointer"
                    title="Clique para analisar no gráfico"
                  >
                    <span className="text-emerald-400 font-bold block">Top: {sector.topGainer.ticker.symbol.replace('USDT', '')}</span>
                    <span className="text-emerald-300 font-bold">+{sector.topGainer.change24h.toFixed(2)}%</span>
                  </div>
                )}

                {sector.worstLaggard && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectAsset(sector.worstLaggard!.ticker);
                    }}
                    className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition cursor-pointer"
                    title="Clique para analisar no gráfico"
                  >
                    <span className="text-rose-400 font-bold block">Laggard: {sector.worstLaggard.ticker.symbol.replace('USDT', '')}</span>
                    <span className={`font-bold ${sector.worstLaggard.change24h >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {sector.worstLaggard.change24h >= 0 ? '+' : ''}{sector.worstLaggard.change24h.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DETAILED ASSET DRILL-DOWN TABLE */}
      <div className="bg-[#0A0A0A] rounded-xl border border-white/10 shadow-2xl overflow-hidden space-y-3">
        <div className="bg-[#0c0c0c] px-4 py-3 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-orange-400" />
              Tabela de Ativos: {selectedSectorKey === 'ALL' ? 'Todos os Setores' : SECTOR_DEFINITIONS[selectedSectorKey]?.name} ({filteredAssets.length})
            </span>
          </div>

          {/* Search Input & Asset Sort */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-neutral-500 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar ativo ou setor..."
                className="bg-[#050505] border border-white/10 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder:text-neutral-600 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <select
              value={assetSortBy}
              onChange={(e) => setAssetSortBy(e.target.value as any)}
              className="bg-[#050505] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:border-orange-500 focus:outline-none cursor-pointer"
            >
              <option value="PERF_DESC">Maior Alta 24h</option>
              <option value="PERF_ASC">Maior Baixa 24h</option>
              <option value="VOLUME_DESC">Maior Volume</option>
              <option value="OI_DESC">Maior Open Interest</option>
            </select>
          </div>
        </div>

        {/* ASSET TABLE */}
        <div className="p-4 overflow-x-auto">
          {filteredAssets.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500 font-sans space-y-1">
              <p>Nenhum ativo encontrado com os filtros selecionados.</p>
            </div>
          ) : (
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[10px] text-neutral-400 uppercase">
                  <th className="pb-2">Ativo / Setor</th>
                  <th className="pb-2">Preço ($)</th>
                  <th className="pb-2">Variação 24h</th>
                  <th className="pb-2">Alpha vs BTC</th>
                  <th className="pb-2">Volume 24h (USD)</th>
                  <th className="pb-2">Open Interest ($)</th>
                  <th className="pb-2">Funding Rate</th>
                  <th className="pb-2">Fluxo CVD</th>
                  <th className="pb-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAssets.map((asset) => {
                  const info = classifyAssetSector(asset);
                  const isUp = asset.priceChangePercent24h >= 0;
                  const alphaVsBtc = asset.priceChangePercent24h - sectorSummary.btcBenchmarkReturn24h;
                  const isAlphaUp = alphaVsBtc >= 0;
                  const volUsd = asset.quoteVolume24h || asset.volume24h * asset.price || 0;

                  return (
                    <tr 
                      key={asset.symbol} 
                      onClick={() => handleSelectAsset(asset)}
                      className="hover:bg-white/[0.02] transition cursor-pointer"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white">{asset.symbol}</span>
                          <span 
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded border"
                            style={{
                              backgroundColor: `${info.definition.color}15`,
                              borderColor: `${info.definition.color}30`,
                              color: info.definition.color
                            }}
                          >
                            {info.definition.shortName}
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-sans block mt-0.5">
                          {info.assetName} • {info.categoryTag}
                        </span>
                      </td>

                      <td className="py-3 font-semibold text-white">
                        ${formatPrice(asset.price)}
                      </td>

                      <td className="py-3">
                        <span className={`font-black text-xs px-2 py-0.5 rounded ${
                          isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {isUp ? '+' : ''}{asset.priceChangePercent24h.toFixed(2)}%
                        </span>
                      </td>

                      <td className="py-3">
                        <span className={`font-bold ${isAlphaUp ? 'text-cyan-400' : 'text-amber-400'}`}>
                          {isAlphaUp ? '+' : ''}{alphaVsBtc.toFixed(2)}%
                        </span>
                      </td>

                      <td className="py-3 text-neutral-300 font-medium">
                        ${formatCompactNumber(volUsd)}
                      </td>

                      <td className="py-3 text-neutral-300 font-medium">
                        ${formatCompactNumber(asset.openInterest || 0)}
                        {asset.openInterestChange24h !== undefined && (
                          <span className={`text-[9px] ml-1 font-bold ${
                            asset.openInterestChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            ({asset.openInterestChange24h >= 0 ? '+' : ''}{asset.openInterestChange24h.toFixed(1)}%)
                          </span>
                        )}
                      </td>

                      <td className="py-3 text-[11px]">
                        <span className="text-neutral-300">
                          {((asset.fundingRate || 0) * 100).toFixed(4)}%
                        </span>
                      </td>

                      <td className="py-3">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          (asset.cvdDelta || asset.cvd || 0) >= 0 
                            ? 'bg-emerald-500/15 text-emerald-400' 
                            : 'bg-rose-500/15 text-rose-400'
                        }`}>
                          {(asset.cvdDelta || asset.cvd || 0) >= 0 ? 'COMPRA TAKER' : 'VENDA TAKER'}
                        </span>
                      </td>

                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectAsset(asset);
                          }}
                          className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#050505] text-neutral-300 border border-white/10 hover:border-orange-500/40 hover:text-white transition flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <span>Gráfico</span>
                          <ExternalLink className="h-3 w-3 text-orange-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
