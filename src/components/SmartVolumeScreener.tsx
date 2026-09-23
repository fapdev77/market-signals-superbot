import React, { useState, useMemo } from 'react';
import { TickerData, VolumeSpikeAlert, VolumeAnomalyType, VolumeSpikeTimeframe, VolumeScreenerFilterOptions } from '../types';
import { scanAllTickersForVolumeSpikes, getVolumeAnomalyVisualTheme } from '../utils/volumeScreenerUtils';
import { VolumeAlertBadge } from './VolumeAlertBadge';
import { VolumeSpikeInspectorModal } from './VolumeSpikeInspectorModal';
import { formatPrice, formatPercent } from '../utils/formatters';
import { Tooltip } from './Tooltip';
import { 
  Flame, 
  Activity, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  SlidersHorizontal, 
  Search, 
  Filter, 
  ShieldAlert, 
  Zap, 
  ArrowUpRight, 
  Clock, 
  Layers, 
  Info,
  RefreshCw,
  Sparkles,
  Eye,
  LineChart,
  Gauge
} from 'lucide-react';

interface SmartVolumeScreenerProps {
  tickers: TickerData[];
  onSelectTicker: (ticker: TickerData) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const SmartVolumeScreener: React.FC<SmartVolumeScreenerProps> = ({
  tickers,
  onSelectTicker,
  onNavigateToTab
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'all' | VolumeSpikeTimeframe>('all');
  const [minRvol, setMinRvol] = useState<number>(1.75);
  const [selectedAnomalyType, setSelectedAnomalyType] = useState<'all' | VolumeAnomalyType>('all');
  const [selectedUrgency, setSelectedUrgency] = useState<'all' | 'HIGH' | 'MEDIUM'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'rvol_desc' | 'volume_desc' | 'price_change_desc' | 'cvd_desc' | 'urgency_desc'>('rvol_desc');
  const [selectedAlertForModal, setSelectedAlertForModal] = useState<{ alert: VolumeSpikeAlert; ticker: TickerData | null } | null>(null);

  // Scan tickers for volume spikes
  const allAlerts = useMemo(() => {
    return scanAllTickersForVolumeSpikes(tickers, minRvol);
  }, [tickers, minRvol]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalAnomalies = allAlerts.length;
    const highUrgencyCount = allAlerts.filter(a => a.urgency === 'HIGH').length;
    const count1h = allAlerts.filter(a => a.dominantTimeframe === '1h').length;
    const count4h = allAlerts.filter(a => a.dominantTimeframe === '4h').length;
    const count1d = allAlerts.filter(a => a.dominantTimeframe === '1d').length;
    const topSpike = allAlerts.length > 0 ? allAlerts[0] : null;

    return {
      totalAnomalies,
      highUrgencyCount,
      count1h,
      count4h,
      count1d,
      topSpike
    };
  }, [allAlerts]);

  // Filtered & Sorted Alerts
  const filteredAlerts = useMemo(() => {
    return allAlerts.filter(alert => {
      // Timeframe filter
      if (selectedTimeframe !== 'all') {
        const tfMetric = alert.timeframes[selectedTimeframe];
        if (!tfMetric.isAnomaly && alert.dominantTimeframe !== selectedTimeframe) {
          return false;
        }
      }

      // Anomaly Type filter
      if (selectedAnomalyType !== 'all' && alert.anomalyType !== selectedAnomalyType) {
        return false;
      }

      // Urgency filter
      if (selectedUrgency !== 'all' && alert.urgency !== selectedUrgency) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return alert.symbol.toLowerCase().includes(q) || alert.name.toLowerCase().includes(q);
      }

      return true;
    }).sort((a, b) => {
      switch (sortBy) {
        case 'rvol_desc':
          if (selectedTimeframe !== 'all') {
            return b.timeframes[selectedTimeframe].rvol - a.timeframes[selectedTimeframe].rvol;
          }
          return b.maxRvol - a.maxRvol;
        case 'volume_desc': {
          const tA = tickers.find(t => t.symbol === a.symbol);
          const tB = tickers.find(t => t.symbol === b.symbol);
          return (tB?.quoteVolume24h || 0) - (tA?.quoteVolume24h || 0);
        }
        case 'price_change_desc':
          return Math.abs(b.priceChangePercent24h) - Math.abs(a.priceChangePercent24h);
        case 'cvd_desc':
          return Math.abs(b.cvdDeltaUsd) - Math.abs(a.cvdDeltaUsd);
        case 'urgency_desc': {
          const rankA = a.urgency === 'HIGH' ? 3 : a.urgency === 'MEDIUM' ? 2 : 1;
          const rankB = b.urgency === 'HIGH' ? 3 : b.urgency === 'MEDIUM' ? 2 : 1;
          return rankB - rankA;
        }
        default:
          return 0;
      }
    });
  }, [allAlerts, selectedTimeframe, selectedAnomalyType, selectedUrgency, searchQuery, sortBy, tickers]);

  return (
    <div className="space-y-4 font-mono pb-12">
      {/* Top Banner / Summary Header */}
      <div className="bg-gradient-to-r from-amber-950/40 via-neutral-900/60 to-neutral-950 p-4 sm:p-5 rounded-2xl border border-amber-500/30 shadow-xl shadow-amber-950/20">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <Flame className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-white tracking-wide">
                    Smart Volume Screener
                  </h1>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-black shadow-xs shadow-amber-500/30">
                    MULTI-TIMEFRAME (1h • 4h • 1d)
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Monitoramento contínuo de anomalias estatísticas de volume (R-Vol &ge; {minRvol}x), fluxo taker de baleias e explosões de liquidez.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto text-xs">
            <div className="bg-black/60 p-2.5 rounded-xl border border-white/5">
              <span className="text-[10px] text-neutral-500 uppercase block">Anomalias Ativas</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-amber-400">{stats.totalAnomalies}</span>
                <span className="text-[10px] text-neutral-400">ativos</span>
              </div>
            </div>

            <div className="bg-black/60 p-2.5 rounded-xl border border-white/5">
              <span className="text-[10px] text-neutral-500 uppercase block">Alta Urgência</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-rose-400">{stats.highUrgencyCount}</span>
                <span className="text-[10px] text-rose-400/80">críticos</span>
              </div>
            </div>

            <div className="bg-black/60 p-2.5 rounded-xl border border-white/5">
              <span className="text-[10px] text-neutral-500 uppercase block">Dominância 1h</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-cyan-400">{stats.count1h}</span>
                <span className="text-[10px] text-cyan-400/80">spikes</span>
              </div>
            </div>

            <div className="bg-black/60 p-2.5 rounded-xl border border-white/5">
              <span className="text-[10px] text-neutral-500 uppercase block">Maior R-Vol</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-emerald-400">
                  {stats.topSpike ? `${stats.topSpike.maxRvol}x` : '1.0x'}
                </span>
                <span className="text-[10px] text-neutral-400 truncate max-w-[50px]">
                  {stats.topSpike?.symbol || '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control & Filter Bar */}
      <div className="bg-[#0A0A0A] p-3.5 sm:p-4 rounded-xl border border-white/10 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Timeframe Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <span className="text-xs text-neutral-500 font-bold uppercase mr-1 hidden sm:inline flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Timeframe:
            </span>

            {[
              { id: 'all', label: 'Todos Multi-TF' },
              { id: '1h', label: '1 Hora (1h)' },
              { id: '4h', label: '4 Horas (4h)' },
              { id: '1d', label: 'Diário (1d)' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTimeframe(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border shrink-0 cursor-pointer ${
                  selectedTimeframe === tab.id
                    ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-neutral-900 text-neutral-400 border-white/5 hover:text-white hover:bg-neutral-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px] sm:min-w-[260px]">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar ativo (ex: BTC, SOL, ETH)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        {/* Secondary Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-white/5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Min R-Vol Threshold Presets */}
            <div className="flex items-center gap-1.5 bg-neutral-900/80 px-2.5 py-1 rounded-lg border border-white/5">
              <span className="text-[11px] text-neutral-500 font-bold uppercase">Corte R-Vol:</span>
              {[1.5, 1.75, 2.0, 2.5, 3.0].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMinRvol(val)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-black border transition cursor-pointer ${
                    minRvol === val
                      ? 'bg-amber-500/30 text-amber-300 border-amber-500/50'
                      : 'bg-black/40 text-neutral-400 border-transparent hover:text-neutral-200'
                  }`}
                >
                  &ge;{val}x
                </button>
              ))}
            </div>

            {/* Anomaly Type Dropdown */}
            <div className="flex items-center gap-1.5 bg-neutral-900/80 px-2.5 py-1 rounded-lg border border-white/5">
              <span className="text-[11px] text-neutral-500 font-bold uppercase">Tipo:</span>
              <select
                value={selectedAnomalyType}
                onChange={(e) => setSelectedAnomalyType(e.target.value as any)}
                className="bg-transparent text-xs text-neutral-200 font-bold focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#0A0A0A] text-white">Todos os Tipos</option>
                <option value="WHALE_ACCUMULATION" className="bg-[#0A0A0A] text-emerald-400">Acumulação Baleia</option>
                <option value="BREAKOUT_SURGE" className="bg-[#0A0A0A] text-cyan-400">Breakout Surge</option>
                <option value="PANIC_DUMP" className="bg-[#0A0A0A] text-rose-400">Despejo / Venda</option>
                <option value="EXHAUSTION_CLIMAX" className="bg-[#0A0A0A] text-purple-400">Clímax / Exaustão</option>
                <option value="UNUSUAL_EXPANSION" className="bg-[#0A0A0A] text-amber-400">Expansão de Volume</option>
              </select>
            </div>

            {/* Urgency Filter */}
            <div className="flex items-center gap-1.5 bg-neutral-900/80 px-2.5 py-1 rounded-lg border border-white/5">
              <span className="text-[11px] text-neutral-500 font-bold uppercase">Urgência:</span>
              <select
                value={selectedUrgency}
                onChange={(e) => setSelectedUrgency(e.target.value as any)}
                className="bg-transparent text-xs text-neutral-200 font-bold focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#0A0A0A] text-white">Todas</option>
                <option value="HIGH" className="bg-[#0A0A0A] text-rose-400">Alta Urgência (Crítico)</option>
                <option value="MEDIUM" className="bg-[#0A0A0A] text-amber-400">Média Urgência</option>
              </select>
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 bg-neutral-900/80 px-2.5 py-1 rounded-lg border border-white/5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-[11px] text-neutral-500 font-bold uppercase">Ordenar:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-neutral-200 font-bold focus:outline-none cursor-pointer"
            >
              <option value="rvol_desc" className="bg-[#0A0A0A] text-white">Maior R-Vol (Pico)</option>
              <option value="urgency_desc" className="bg-[#0A0A0A] text-white">Maior Urgência</option>
              <option value="volume_desc" className="bg-[#0A0A0A] text-white">Maior Volume 24h USD</option>
              <option value="price_change_desc" className="bg-[#0A0A0A] text-white">Maior Oscilação de Preço</option>
              <option value="cvd_desc" className="bg-[#0A0A0A] text-white">Maior Delta CVD</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table / Grid of Volume Anomalies */}
      {filteredAlerts.length === 0 ? (
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-12 text-center space-y-3">
          <div className="p-3 bg-neutral-900 rounded-full w-12 h-12 mx-auto flex items-center justify-center text-neutral-500">
            <Flame className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Nenhum pico anômalo com os filtros atuais</h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            Experimente reduzir o corte de R-Vol para &ge;1.5x ou selecionar &quot;Todos os Tipos&quot; para exibir mais ativos monitorados.
          </p>
          <button
            type="button"
            onClick={() => {
              setMinRvol(1.5);
              setSelectedTimeframe('all');
              setSelectedAnomalyType('all');
              setSelectedUrgency('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-bold text-xs transition cursor-pointer"
          >
            Redefinir Filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredAlerts.map(alert => {
            const originalTicker = tickers.find(t => t.symbol === alert.symbol) || null;
            const theme = getVolumeAnomalyVisualTheme(alert.anomalyType);
            const isHighUrgency = alert.urgency === 'HIGH';

            return (
              <div
                key={alert.id}
                className={`bg-[#0D0D0D] border rounded-xl p-4 transition-all duration-200 hover:scale-[1.01] hover:border-amber-500/40 relative overflow-hidden flex flex-col justify-between space-y-3.5 shadow-lg ${
                  isHighUrgency ? 'border-amber-500/30 shadow-amber-950/20' : 'border-white/10'
                }`}
              >
                {/* Top Card Header */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg border ${theme.bg} ${theme.border} ${theme.text}`}>
                        <Flame className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-base font-black text-white">{alert.symbol}</h3>
                          <span className="text-[9px] bg-neutral-900 text-neutral-400 px-1.5 py-0.2 rounded border border-white/5 uppercase">
                            {alert.marketType === 'crypto_futures' ? 'Perp' : 'Spot'}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 truncate max-w-[140px]">{alert.name}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <VolumeAlertBadge
                        alert={alert}
                        onInspect={(a, e) => {
                          e.stopPropagation();
                          setSelectedAlertForModal({ alert: a, ticker: originalTicker });
                        }}
                      />
                      <span className="text-[9px] text-neutral-500 font-bold uppercase">
                        TF {alert.dominantTimeframe} • {alert.maxRvol}x Pico
                      </span>
                    </div>
                  </div>

                  {/* Price & Change */}
                  <div className="flex items-baseline justify-between mt-3 pt-2.5 border-t border-white/5">
                    <div className="text-lg font-black text-white">
                      {formatPrice(alert.currentPrice, { currency: true })}
                    </div>
                    <div className={`text-xs font-black flex items-center gap-0.5 ${
                      alert.priceChangePercent24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {alert.priceChangePercent24h >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      {alert.priceChangePercent24h >= 0 ? '+' : ''}{alert.priceChangePercent24h}%
                    </div>
                  </div>

                  {/* Multi-Timeframe Volume Matrix Bars */}
                  <div className="mt-3 space-y-1.5 bg-black/50 p-2.5 rounded-lg border border-white/5">
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 font-bold">
                      <span>R-VOL POR TIMEFRAME:</span>
                      <span className="text-amber-400">Dominante: {alert.dominantTimeframe.toUpperCase()}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                      {(['1h', '4h', '1d'] as const).map(tf => {
                        const m = alert.timeframes[tf];
                        const isDominant = tf === alert.dominantTimeframe;

                        return (
                          <div
                            key={tf}
                            className={`p-1.5 rounded-md border ${
                              isDominant
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-black'
                                : m.isAnomaly
                                ? 'bg-white/10 border-white/15 text-white font-bold'
                                : 'bg-neutral-900 border-white/5 text-neutral-400'
                            }`}
                          >
                            <div className="text-[8px] opacity-75 uppercase">{tf}</div>
                            <div className="text-xs font-black">{m.rvol}x</div>
                            <div className="text-[8px] truncate">
                              {m.deltaPressure === 'BUY' ? '▲ BUY' : m.deltaPressure === 'SELL' ? '▼ SELL' : '▬ EQ'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Anomaly Description & Order Flow Insight */}
                  <div className="mt-2.5 p-2 rounded-lg bg-neutral-900/60 border border-white/5 text-[11px] text-neutral-300 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-amber-400 font-bold uppercase">{alert.anomalyTitle}</span>
                      <span className={alert.cvdDirection === 'BUY' ? 'text-emerald-400 font-bold' : alert.cvdDirection === 'SELL' ? 'text-rose-400 font-bold' : 'text-neutral-400'}>
                        CVD {alert.cvdDirection === 'BUY' ? 'COMPRADOR' : alert.cvdDirection === 'SELL' ? 'VENDEDOR' : 'NEUTRO'}
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-400 line-clamp-2 leading-tight">
                      {alert.anomalyDescription}
                    </p>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAlertForModal({ alert, ticker: originalTicker })}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Detalhes</span>
                  </button>

                  {originalTicker && (
                    <button
                      type="button"
                      onClick={() => onSelectTicker(originalTicker)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition flex items-center justify-center gap-1 shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
                    >
                      <LineChart className="w-3.5 h-3.5" />
                      <span>Ver Gráfico</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deep Dive Inspection Modal */}
      {selectedAlertForModal && (
        <VolumeSpikeInspectorModal
          alert={selectedAlertForModal.alert}
          ticker={selectedAlertForModal.ticker}
          onClose={() => setSelectedAlertForModal(null)}
          onSelectTicker={onSelectTicker}
        />
      )}
    </div>
  );
};
