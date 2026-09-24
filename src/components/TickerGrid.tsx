import React, { useState, useMemo, useEffect } from 'react';
import { TickerData, DetectedChartPattern, VolumeSpikeAlert } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Activity, 
  Flame, 
  Brain, 
  ArrowUpRight, 
  ArrowUpDown, 
  Search, 
  X, 
  RotateCcw, 
  SlidersHorizontal, 
  Star,
  Gauge,
  Sparkles
} from 'lucide-react';
import { formatPrice, formatPercent } from '../utils/formatters';
import { Tooltip } from './Tooltip';
import { apiClient } from '../services/apiClient';
import { scanAllTickersForPatterns } from '../utils/aiPatternScanner';
import { PatternBadge } from './PatternBadge';
import { PatternInspectorModal } from './PatternInspectorModal';
import { getVolumeSpikesMap } from '../utils/volumeScreenerUtils';
import { VolumeAlertBadge } from './VolumeAlertBadge';
import { VolumeSpikeInspectorModal } from './VolumeSpikeInspectorModal';

export type TickerSortOption = 
  | 'volatility_desc'
  | 'volume_spike_desc'
  | 'trend_strength_desc'
  | 'pattern_confidence_desc'
  | 'confluence_desc'
  | 'price_change_abs_desc'
  | 'price_change_desc'
  | 'price_change_asc'
  | 'volume_desc'
  | 'symbol_asc';

export const getTickerVolatility = (t: TickerData): number => {
  if (t.high24h && t.low24h && t.low24h > 0) {
    return ((t.high24h - t.low24h) / t.low24h) * 100;
  }
  return Math.abs(t.priceChangePercent24h || 0);
};

export interface TrendStrengthInfo {
  score: number; // 0 to 100
  bars: 1 | 2 | 3 | 4 | 5;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  adxEstimated: number; // Approximate ADX value 10 - 65
  label: string;
  description: string;
  colorClass: string;
  barColorClass: string;
  bgLightClass: string;
}

/**
 * Calculates a robust 1-5 bar 'Trend Strength' indicator based on directional momentum,
 * price location within 24h range (High-Low % positioning), CVD delta aggression,
 * Open Interest expansion, and algorithmic confluence factors.
 */
export const getTickerTrendStrength = (t: TickerData): TrendStrengthInfo => {
  if (!t) {
    return {
      score: 20,
      bars: 1,
      direction: 'NEUTRAL',
      adxEstimated: 15,
      label: 'Sem Tendência (Consolidação)',
      description: 'Mercado lateral sem momentum direcional sustentado.',
      colorClass: 'text-neutral-400',
      barColorClass: 'bg-neutral-600',
      bgLightClass: 'bg-neutral-800'
    };
  }

  const changePct = t.priceChangePercent24h ?? 0;
  const absChange = Math.abs(changePct);
  
  // 1. Directional bias determination
  let isBullish = changePct > 0.2;
  let isBearish = changePct < -0.2;

  if (t.signalType && t.signalType !== 'NEUTRAL') {
    if (t.signalType.includes('LONG')) isBullish = true;
    if (t.signalType.includes('SHORT')) isBearish = true;
  } else if (t.cvdDirection === 'BUY') {
    isBullish = true;
  } else if (t.cvdDirection === 'SELL') {
    isBearish = true;
  }

  // 2. Range Position Factor (Close near High = Bullish trend push; Close near Low = Bearish trend push)
  let rangeExpansionScore = 0;
  if (t.high24h && t.low24h && t.high24h > t.low24h && t.price) {
    const range = t.high24h - t.low24h;
    const posInRange = (t.price - t.low24h) / range; // 0 (at low) to 1 (at high)
    if (isBullish) {
      rangeExpansionScore = Math.max(0, (posInRange - 0.45) * 50); // up to ~27 pts
    } else if (isBearish) {
      rangeExpansionScore = Math.max(0, (0.55 - posInRange) * 50); // up to ~27 pts
    } else {
      rangeExpansionScore = Math.abs(posInRange - 0.5) * 30;
    }
  }

  // 3. Momentum & Price Velocity component (0 - 30 pts)
  const momentumScore = Math.min(30, absChange * 3.5);

  // 4. Orderflow & CVD alignment (0 - 20 pts)
  let cvdAlignmentScore = 5;
  if (isBullish && t.cvdDirection === 'BUY') cvdAlignmentScore = 20;
  else if (isBearish && t.cvdDirection === 'SELL') cvdAlignmentScore = 20;
  else if (t.cvdDirection === 'NEUTRAL') cvdAlignmentScore = 10;

  // 5. Open Interest trend confirmation (0 - 15 pts)
  let oiScore = 5;
  const oiChange = t.openInterestChange1h ?? 0;
  if (oiChange > 1.0) oiScore = 15;
  else if (oiChange > 0.3) oiScore = 12;
  else if (oiChange >= -0.3) oiScore = 7;
  else oiScore = 2; // OI flushing out

  // 6. Confluence bonus (0 - 15 pts)
  const confluenceScoreBonus = ((t.confluenceScore || 50) / 100) * 15;

  // Total raw strength score: 0 to 100
  const rawScore = Math.max(5, Math.min(100, momentumScore + rangeExpansionScore + cvdAlignmentScore + oiScore + confluenceScoreBonus));

  // Map to Estimated ADX equivalent (10 to 60+)
  const adxEstimated = parseFloat((12 + (rawScore / 100) * 48).toFixed(1));

  // Determine 1 - 5 bars
  let bars: 1 | 2 | 3 | 4 | 5 = 1;
  let label = 'Sem Tendência (Fraca)';
  let description = 'Movimento lateral ou oscilação fraca sem convicção institucional.';

  if (rawScore >= 80 || adxEstimated >= 48) {
    bars = 5;
    label = 'Tendência Muito Forte (Exaustão/Parabólica)';
    description = 'Momentum direcional extremo com alto volume. Risco de clímax ou continuação agressiva.';
  } else if (rawScore >= 62 || adxEstimated >= 38) {
    bars = 4;
    label = 'Tendência Forte (Sustentada)';
    description = 'Tendência estrutural consistente com fluxo institucional favorável e sustentação de topo/fundo.';
  } else if (rawScore >= 45 || adxEstimated >= 28) {
    bars = 3;
    label = 'Tendência Moderada';
    description = 'Direcional ativo em desenvolvimento, requer acompanhamento de rompimento de níveis chave.';
  } else if (rawScore >= 28 || adxEstimated >= 20) {
    bars = 2;
    label = 'Tendência Incipiente / Fraca';
    description = 'Início tímido de direcional ou consolidação ampla.';
  } else {
    bars = 1;
    label = 'Sem Tendência (Consolidação)';
    description = 'Mercado lateralizado em equilíbrio ou baixa volatilidade.';
  }

  const direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 
    isBullish && bars >= 2 ? 'BULLISH' : isBearish && bars >= 2 ? 'BEARISH' : 'NEUTRAL';

  // Theming colors
  let colorClass = 'text-neutral-400';
  let barColorClass = 'bg-neutral-500';
  let bgLightClass = 'bg-neutral-800';

  if (direction === 'BULLISH') {
    colorClass = bars >= 4 ? 'text-emerald-400' : 'text-teal-400';
    barColorClass = bars >= 4 ? 'bg-emerald-400' : 'bg-teal-400';
    bgLightClass = 'bg-emerald-950/40 border-emerald-500/20';
  } else if (direction === 'BEARISH') {
    colorClass = bars >= 4 ? 'text-rose-400' : 'text-amber-400';
    barColorClass = bars >= 4 ? 'bg-rose-400' : 'bg-amber-400';
    bgLightClass = 'bg-rose-950/40 border-rose-500/20';
  } else {
    colorClass = 'text-neutral-400';
    barColorClass = 'bg-neutral-500';
    bgLightClass = 'bg-neutral-900 border-white/5';
  }

  return {
    score: Math.round(rawScore),
    bars,
    direction,
    adxEstimated,
    label,
    description,
    colorClass,
    barColorClass,
    bgLightClass
  };
};

interface TickerGridProps {
  tickers: TickerData[];
  onSelectTicker: (ticker: TickerData) => void;
  onRequestAIReview?: (ticker: TickerData) => void;
}

export const TickerGrid: React.FC<TickerGridProps> = ({
  tickers = [],
  onSelectTicker,
}) => {
  const [filterMarket, setFilterMarket] = useState<'all' | 'crypto_futures' | 'tradfi'>('all');
  const [filterSignal, setFilterSignal] = useState<'all' | 'signals_only' | 'golden_pocket' | 'favorites' | 'patterns_only' | 'volume_anomalies'>('all');
  const [sortBy, setSortBy] = useState<TickerSortOption>('volatility_desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteSymbols, setFavoriteSymbols] = useState<Set<string>>(new Set());
  const [selectedPatternModal, setSelectedPatternModal] = useState<{ ticker: TickerData; pattern: DetectedChartPattern } | null>(null);
  const [selectedVolumeAlertModal, setSelectedVolumeAlertModal] = useState<{ ticker: TickerData; alert: VolumeSpikeAlert } | null>(null);

  // Run AI Pattern Scanner on all tickers
  const tickerPatternsMap = useMemo(() => {
    return scanAllTickersForPatterns(tickers);
  }, [tickers]);

  const patternsCount = useMemo(() => {
    return tickerPatternsMap.size;
  }, [tickerPatternsMap]);

  // Run Smart Volume Screener on all tickers
  const tickerVolumeAlertsMap = useMemo(() => {
    return getVolumeSpikesMap(tickers, 1.75);
  }, [tickers]);

  const volumeAnomaliesCount = useMemo(() => {
    return tickerVolumeAlertsMap.size;
  }, [tickerVolumeAlertsMap]);

  // Load favorites from API
  useEffect(() => {
    apiClient.getScreenerAssets().then(res => {
      const favs = new Set<string>();
      (res.assets || []).forEach(a => {
        if (a.isFavorite) favs.add(a.symbol);
      });
      setFavoriteSymbols(favs);
    }).catch(() => {});
  }, []);

  const handleToggleFavoriteInGrid = async (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCurrentFav = favoriteSymbols.has(symbol);
    try {
      const res = await apiClient.toggleFavorite(symbol, !isCurrentFav);
      setFavoriteSymbols(prev => {
        const next = new Set(prev);
        if (res.isFavorite) next.add(symbol);
        else next.delete(symbol);
        return next;
      });
    } catch (err) {
      console.error('Failed to toggle favorite in grid:', err);
    }
  };

  const hasActiveFilters = 
    filterMarket !== 'all' || 
    filterSignal !== 'all' || 
    sortBy !== 'volatility_desc' || 
    searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setFilterMarket('all');
    setFilterSignal('all');
    setSortBy('volatility_desc');
    setSearchQuery('');
  };

  const processedTickers = useMemo(() => {
    const filtered = (tickers || []).filter(t => {
      if (!t) return false;
      if (filterMarket !== 'all' && t.marketType !== filterMarket) return false;
      if (filterSignal === 'signals_only' && (t.signalType === 'NEUTRAL' || !t.signalType)) return false;
      if (filterSignal === 'golden_pocket' && !t.fibonacci?.inGoldenPocket) return false;
      if (filterSignal === 'favorites' && !favoriteSymbols.has(t.symbol)) return false;
      if (filterSignal === 'patterns_only' && !tickerPatternsMap.has(t.symbol)) return false;
      if (filterSignal === 'volume_anomalies' && !tickerVolumeAlertsMap.has(t.symbol)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (t.symbol || '').toLowerCase().includes(q) || (t.name || '').toLowerCase().includes(q);
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'volatility_desc': {
          const volA = getTickerVolatility(a);
          const volB = getTickerVolatility(b);
          return volB - volA;
        }
        case 'volume_spike_desc': {
          const rvolA = tickerVolumeAlertsMap.get(a.symbol)?.maxRvol || 0;
          const rvolB = tickerVolumeAlertsMap.get(b.symbol)?.maxRvol || 0;
          return rvolB - rvolA;
        }
        case 'trend_strength_desc': {
          const trendA = getTickerTrendStrength(a).score;
          const trendB = getTickerTrendStrength(b).score;
          return trendB - trendA;
        }
        case 'pattern_confidence_desc': {
          const confA = tickerPatternsMap.get(a.symbol)?.[0]?.confidence || 0;
          const confB = tickerPatternsMap.get(b.symbol)?.[0]?.confidence || 0;
          return confB - confA;
        }
        case 'confluence_desc':
          return (b.confluenceScore || 0) - (a.confluenceScore || 0);
        case 'price_change_abs_desc':
          return Math.abs(b.priceChangePercent24h || 0) - Math.abs(a.priceChangePercent24h || 0);
        case 'price_change_desc':
          return (b.priceChangePercent24h || 0) - (a.priceChangePercent24h || 0);
        case 'price_change_asc':
          return (a.priceChangePercent24h || 0) - (b.priceChangePercent24h || 0);
        case 'volume_desc':
          return (b.quoteVolume24h || b.volume24h || 0) - (a.quoteVolume24h || a.volume24h || 0);
        case 'symbol_asc':
          return a.symbol.localeCompare(b.symbol);
        default:
          return 0;
      }
    });
  }, [tickers, filterMarket, filterSignal, searchQuery, sortBy, favoriteSymbols, tickerPatternsMap, tickerVolumeAlertsMap]);

  return (
    <div className="space-y-4">
      {/* Filter, Sort and Search Bar */}
      <div className="bg-[#0A0A0A] p-3 rounded-lg border border-white/10 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 shadow-xl font-mono text-xs">
        {/* Market Category Buttons */}
        <div className="flex items-center gap-1.5 w-full xl:w-auto overflow-x-auto scrollbar-none pb-1 xl:pb-0">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mr-1 shrink-0">MERCADO:</span>
          
          <Tooltip
            position="bottom"
            title="Todos os Mercados"
            badge={`${tickers.length} ATIVOS`}
            content="Exibe todos os pares monitorados, englobando futuros perpétuos de cripto e índices/ações TradFi."
          >
            <button
              onClick={() => setFilterMarket('all')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition shrink-0 cursor-pointer ${
                filterMarket === 'all'
                  ? 'bg-orange-500 text-black'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/5'
              }`}
            >
              TODOS ({tickers.length})
            </button>
          </Tooltip>

          <Tooltip
            position="bottom"
            title="Contratos Perpétuos Cripto"
            badge="FUTURES"
            content="Filtra apenas contratos de derivativos perpétuos da Binance Futures (USDT-M) com leitura de Order Flow em tempo real."
          >
            <button
              onClick={() => setFilterMarket('crypto_futures')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition shrink-0 cursor-pointer ${
                filterMarket === 'crypto_futures'
                  ? 'bg-orange-500 text-black'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/5'
              }`}
            >
              CRIPTO PERPETUOS
            </button>
          </Tooltip>

          <Tooltip
            position="bottom"
            title="Mercados Tradicionais & Ações"
            badge="TRADFI"
            content="Filtra ativos tradicionais, índices acionários (S&P 500, Nasdaq) e commodities para correlação macroeconômica."
          >
            <button
              onClick={() => setFilterMarket('tradfi')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition shrink-0 cursor-pointer ${
                filterMarket === 'tradfi'
                  ? 'bg-orange-500 text-black'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/5'
              }`}
            >
              TRADFI & AÇÕES
            </button>
          </Tooltip>
        </div>

        {/* Signals Quick Filter, Sort by Dropdown & Search */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* Quick Signal Toggles */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <Tooltip
              position="bottom"
              title="Filtro de Sinais Ativos"
              badge="BUY / SELL"
              content="Mostra apenas pares onde o algoritmo identificou confluência matemática de entrada (exclui ativos consolidados em NEUTRAL)."
            >
              <button
                onClick={() => setFilterSignal(filterSignal === 'signals_only' ? 'all' : 'signals_only')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition border shrink-0 cursor-pointer ${
                  filterSignal === 'signals_only'
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                    : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                <Zap className="h-3 w-3 text-orange-400" />
                SINAIS ATIVOS
              </button>
            </Tooltip>

            <Tooltip
              position="bottom"
              title="Filtro de Ativos Favoritos"
              badge="FAVORITOS"
              content="Mostra apenas ativos fixados pelo trader como favoritos permanentes na lista de monitoramento."
            >
              <button
                onClick={() => setFilterSignal(filterSignal === 'favorites' ? 'all' : 'favorites')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition border shrink-0 cursor-pointer ${
                  filterSignal === 'favorites'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                <Star className={`h-3 w-3 ${filterSignal === 'favorites' ? 'fill-amber-400 text-amber-400' : 'text-neutral-400'}`} />
                FAVORITOS ({favoriteSymbols.size})
              </button>
            </Tooltip>

            <Tooltip
              position="bottom"
              title="Filtro Golden Pocket 0.618 - 0.68"
              badge="FIBONACCI"
              content="Destaca apenas pares cujo preço atual está oscilando exatamente dentro da zona áurea institucional de retração de Fibonacci."
            >
              <button
                onClick={() => setFilterSignal(filterSignal === 'golden_pocket' ? 'all' : 'golden_pocket')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition border shrink-0 cursor-pointer ${
                  filterSignal === 'golden_pocket'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                <Flame className="h-3 w-3 text-orange-400" />
                GOLDEN POCKET (0.68)
              </button>
            </Tooltip>

            <Tooltip
              position="bottom"
              title="Filtro de Padrões Gráficos IA"
              badge="AI SCANNER"
              content="Filtra ativos onde o scanner de padrões identificou figuras técnicas de continuidade ou reversão (Bull Flags, Cunhas, Triângulos, etc.)."
            >
              <button
                onClick={() => setFilterSignal(filterSignal === 'patterns_only' ? 'all' : 'patterns_only')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition border shrink-0 cursor-pointer ${
                  filterSignal === 'patterns_only'
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-xs shadow-cyan-500/20'
                    : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                <Sparkles className={`h-3 w-3 ${filterSignal === 'patterns_only' ? 'text-cyan-400' : 'text-neutral-400'}`} />
                PADRÕES IA ({patternsCount})
              </button>
            </Tooltip>

            <Tooltip
              position="bottom"
              title="Filtro de Alertas de Volume Anômalo"
              badge="VOLUME ALERT"
              content="Filtra ativos com volume relativo anormal (R-Vol) disparado em 1h, 4h ou 1d com fluxo institucional relevante."
            >
              <button
                onClick={() => setFilterSignal(filterSignal === 'volume_anomalies' ? 'all' : 'volume_anomalies')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition border shrink-0 cursor-pointer ${
                  filterSignal === 'volume_anomalies'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-xs shadow-amber-500/20'
                    : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                <Flame className={`h-3 w-3 ${filterSignal === 'volume_anomalies' ? 'text-amber-400' : 'text-neutral-400'}`} />
                VOLUME ALERT ({volumeAnomaliesCount})
              </button>
            </Tooltip>
          </div>

          {/* Sort By Dropdown */}
          <Tooltip
            position="bottom"
            title="Classificação Automática de Mercado"
            badge="SORT BY"
            content="Classifica os ativos por volatilidade intraday (amplitude High-Low), convicção algorítmica (Score de Confluência) ou oscilação percentual de preço."
          >
            <div className="flex items-center gap-1.5 bg-[#050505] px-2.5 py-1 rounded border border-white/10 shrink-0">
              <ArrowUpDown className="h-3.5 w-3.5 text-orange-400 shrink-0" />
              <span className="text-[10px] text-neutral-500 font-bold uppercase hidden sm:inline">Ordenar:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as TickerSortOption)}
                className="bg-transparent text-xs text-neutral-200 font-bold focus:outline-none cursor-pointer"
              >
                <option value="volatility_desc" className="bg-[#0A0A0A] text-white">Maior Volatilidade (Range 24h)</option>
                <option value="volume_spike_desc" className="bg-[#0A0A0A] text-white">Maior Anomalia de Volume (R-Vol)</option>
                <option value="pattern_confidence_desc" className="bg-[#0A0A0A] text-white">Maior Confiança de Padrão IA</option>
                <option value="trend_strength_desc" className="bg-[#0A0A0A] text-white">Maior Força de Tendência (ADX 1-5)</option>
                <option value="confluence_desc" className="bg-[#0A0A0A] text-white">Score de Confluência (Maior → Menor)</option>
                <option value="price_change_abs_desc" className="bg-[#0A0A0A] text-white">Maior Oscilação (|%| 24h)</option>
                <option value="price_change_desc" className="bg-[#0A0A0A] text-white">Maiores Altas (+% Gainers)</option>
                <option value="price_change_asc" className="bg-[#0A0A0A] text-white">Maiores Quedas (-% Losers)</option>
                <option value="volume_desc" className="bg-[#0A0A0A] text-white">Maior Volume 24h ($)</option>
                <option value="symbol_asc" className="bg-[#0A0A0A] text-white">Símbolo (A → Z)</option>
              </select>
            </div>
          </Tooltip>

          {/* Search Input Box */}
          <div className="relative flex-1 sm:w-48 min-w-[140px]">
            <input
              type="text"
              placeholder="Buscar ativo (BTC, SOL)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#050505] border border-white/10 text-neutral-200 placeholder-neutral-500 pl-3 pr-7 py-1 rounded text-xs focus:outline-none focus:border-orange-500 w-full font-mono"
            />
            {searchQuery && (
              <Tooltip position="top" content="Limpar termo de busca">
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-neutral-400 hover:text-white transition cursor-pointer"
                  aria-label="Limpar busca"
                >
                  <X className="h-3 w-3" />
                </button>
              </Tooltip>
            )}
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <Tooltip
              position="bottom"
              title="Redefinir Filtros"
              badge="RESET"
              content="Restaura os filtros de mercado, sinais, busca e ordenação para o padrão."
            >
              <button
                onClick={handleResetFilters}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded text-xs font-bold transition flex items-center gap-1 border border-white/10 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3 text-orange-400" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Grid Cards or Empty State */}
      {processedTickers.length === 0 ? (
        <div className="bg-[#0A0A0A] p-8 rounded-lg border border-white/10 text-center text-neutral-400 text-xs space-y-3 font-mono">
          <SlidersHorizontal className="h-8 w-8 text-neutral-600 mx-auto" />
          <p className="font-extrabold text-white text-sm">
            Nenhum ativo encontrado para os filtros selecionados.
          </p>
          <p className="text-neutral-500 max-w-md mx-auto text-[11px]">
            Tente redefinir a busca textual ou selecionar outra categoria de mercado para visualizar os pares monitorados.
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black font-extrabold rounded text-xs transition inline-flex items-center gap-1.5 cursor-pointer shadow"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Redefinir Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1900px]:grid-cols-6 min-[2200px]:grid-cols-7 min-[2400px]:grid-cols-8 gap-3">
          {processedTickers.map((t) => {
            const signalType = t.signalType || 'NEUTRAL';
            const isLong = signalType.includes('LONG');
            const isShort = signalType.includes('SHORT');
            const price = t.price ?? 0;
            const changePct = t.priceChangePercent24h ?? 0;
            const volatility = getTickerVolatility(t);
            const trendStrength = getTickerTrendStrength(t);
            const topPattern = tickerPatternsMap.get(t.symbol)?.[0] || null;
            const topVolumeAlert = tickerVolumeAlertsMap.get(t.symbol) || null;

            return (
              <div
                key={t.symbol}
                onClick={() => onSelectTicker(t)}
                className={`bg-[#0A0A0A] rounded-xl border ${
                  t.confluenceScore >= 65 ? 'border-orange-500/40 hover:border-orange-500' : 'border-white/10 hover:border-orange-500/60'
                } p-3.5 transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between shadow-md hover:shadow-orange-500/10 cursor-pointer relative group font-mono`}
              >
                <div>
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Tooltip
                          position="top"
                          content={favoriteSymbols.has(t.symbol) ? 'Remover dos favoritos' : 'Fixar nos favoritos'}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleToggleFavoriteInGrid(t.symbol, e)}
                            className={`p-0.5 rounded transition ${
                              favoriteSymbols.has(t.symbol)
                                ? 'text-amber-400 hover:text-amber-300'
                                : 'text-neutral-600 hover:text-amber-400 opacity-60 group-hover:opacity-100'
                            }`}
                            aria-label={favoriteSymbols.has(t.symbol) ? 'Remover dos favoritos' : 'Fixar como favorito'}
                          >
                            <Star className={`h-3.5 w-3.5 ${favoriteSymbols.has(t.symbol) ? 'fill-amber-400' : ''}`} />
                          </button>
                        </Tooltip>
                        <h3 className="font-extrabold text-sm text-white group-hover:text-orange-400 transition flex items-center gap-1">
                          {t.symbol}
                        </h3>
                        <span className="text-[9px] uppercase font-bold text-neutral-400 bg-neutral-900 border border-white/5 px-1 py-0.5 rounded">
                          {t.marketType === 'crypto_futures' ? 'PERP' : 'STOCK'}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 line-clamp-1">{t.name}</p>
                    </div>

                    {/* Signal Rating Pill with Tooltip */}
                    <Tooltip
                      position="left"
                      title={`Classificação de Sinal: ${signalType}`}
                      badge={`${t.confluenceScore}%`}
                      content={
                        isLong
                          ? 'Recomendação de Compra: Confluência positiva de Order Flow com absorção passiva ou agressão compradora.'
                          : isShort
                          ? 'Recomendação de Venda: Confluência de venda com pressão delta negativa e rejeição de máximas.'
                          : 'Condição Neutra: Mercado em consolidação lateral sem viés de confluência definido.'
                      }
                    >
                      <div
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border flex items-center gap-1 ${
                          isLong
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : isShort
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-neutral-900 text-neutral-400 border-white/5'
                        }`}
                      >
                        {isLong && <TrendingUp className="h-3 w-3 text-emerald-400" />}
                        {isShort && <TrendingDown className="h-3 w-3 text-rose-400" />}
                        {signalType.replace('_', ' ')}
                      </div>
                    </Tooltip>
                  </div>

                  {/* AI Pattern Scanner & Volume Alert Badges */}
                  {(topPattern || topVolumeAlert) && (
                    <div className="mt-1 mb-1.5 flex items-center justify-between flex-wrap gap-1">
                      {topVolumeAlert && (
                        <VolumeAlertBadge
                          alert={topVolumeAlert}
                          onInspect={(a, e) => {
                            e.stopPropagation();
                            setSelectedVolumeAlertModal({ ticker: t, alert: a });
                          }}
                        />
                      )}
                      {topPattern && (
                        <PatternBadge
                          pattern={topPattern}
                          onInspect={(p, e) => {
                            e.stopPropagation();
                            setSelectedPatternModal({ ticker: t, pattern: p });
                          }}
                        />
                      )}
                    </div>
                  )}

                  {/* Price & Change & Volatility */}
                  <div className="flex items-baseline justify-between my-2">
                    <div className="text-lg font-black text-white">
                      {formatPrice(price, { currency: true })}
                    </div>
                    <div className="flex flex-col items-end">
                      <div className={`text-xs font-bold ${changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatPercent(changePct)}
                      </div>
                      <Tooltip
                        position="top"
                        title="Volatilidade Intraday 24h (High-Low Range)"
                        badge="VOLATILIDADE"
                        content={`Amplitude percentual entre a máxima (${formatPrice(t.high24h, { currency: true })}) e a mínima (${formatPrice(t.low24h, { currency: true })}) das últimas 24 horas.`}
                      >
                        <span className="text-[9px] text-neutral-400 font-bold hover:text-orange-400 transition cursor-help">
                          Vol: {volatility.toFixed(1)}%
                        </span>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Subtle Trend Strength Indicator (1-5 Bars) */}
                  <Tooltip
                    position="top"
                    title={`Força da Tendência: ${trendStrength.label}`}
                    badge={`ADX ~${trendStrength.adxEstimated}`}
                    content={`${trendStrength.description} Momentum derivado do range 24h, delta CVD e expansão direcional de contratos.`}
                  >
                    <div className="flex items-center justify-between px-2 py-1 rounded bg-[#070707] border border-white/5 mb-2 cursor-help group-hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-1.5 text-[9px]">
                        <Gauge className="h-3 w-3 text-neutral-500 shrink-0" />
                        <span className="text-neutral-400 font-bold tracking-tight uppercase">Tendência</span>
                        <span className={`font-extrabold ${trendStrength.colorClass}`}>
                          {trendStrength.direction === 'BULLISH' ? '▲ ALTA' : trendStrength.direction === 'BEARISH' ? '▼ BAIXA' : '— LATERAL'}
                        </span>
                      </div>

                      {/* 1-5 Ascending Trend Bars */}
                      <div className="flex items-end gap-[3px] h-3.5 px-0.5">
                        {[1, 2, 3, 4, 5].map((barNum) => {
                          const isActive = barNum <= trendStrength.bars;
                          const heightMap = ['h-1.5', 'h-2', 'h-2.5', 'h-3', 'h-3.5'];
                          return (
                            <div
                              key={barNum}
                              className={`w-1 rounded-xs transition-all duration-200 ${heightMap[barNum - 1]} ${
                                isActive 
                                  ? `${trendStrength.barColorClass} shadow-xs` 
                                  : 'bg-neutral-800/80'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </Tooltip>

                  {/* Quant Indicators Summary Matrix */}
                  <div className="grid grid-cols-2 gap-1.5 bg-[#050505] p-2 rounded border border-white/5 text-[10px] mb-2.5">
                    <Tooltip
                      position="top"
                      title="Variação de Open Interest (1h)"
                      badge="CONTRATOS"
                      content="Variação líquida de contratos em aberto na última hora. Aumento com subida de preço confirma força compradora; queda sinaliza liquidações."
                    >
                      <div className="cursor-help">
                        <span className="text-neutral-500 block text-[9px] font-bold uppercase">OI (1h)</span>
                        <span className={`font-bold ${(t.openInterestChange1h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(t.openInterestChange1h ?? 0) >= 0 ? '+' : ''}{(t.openInterestChange1h ?? 0).toFixed(2)}%
                        </span>
                      </div>
                    </Tooltip>

                    <Tooltip
                      position="top"
                      title="CVD Delta (Cumulative Volume Delta)"
                      badge="ORDER FLOW"
                      content="Diferença acumulada entre o volume de compras a mercado e vendas a mercado. Indica quem está agredindo o book de ofertas."
                    >
                      <div className="cursor-help">
                        <span className="text-neutral-500 block text-[9px] font-bold uppercase">CVD Delta</span>
                        <span className={`font-bold ${t.cvdDirection === 'BUY' ? 'text-emerald-400' : t.cvdDirection === 'SELL' ? 'text-rose-400' : 'text-neutral-400'}`}>
                          {t.cvdDirection === 'BUY' ? 'COMPRA' : t.cvdDirection === 'SELL' ? 'VENDA' : 'NEUTRO'}
                        </span>
                      </div>
                    </Tooltip>

                    <Tooltip
                      position="top"
                      title="Funding Rate Anualizado"
                      badge="TAXA TAX"
                      content="Taxa periódica paga entre longs e shorts. Valores muito positivos indicam euforia compradora; taxas negativas indicam shorts pagando longs (potencial short squeeze)."
                    >
                      <div className="cursor-help">
                        <span className="text-neutral-500 block text-[9px] font-bold uppercase">Funding APR</span>
                        <span className={`font-bold ${(t.fundingRate ?? 0) < 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                          {(t.fundingRateAnnualized ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    </Tooltip>

                    <Tooltip
                      position="top"
                      title="Zona Áurea de Fibonacci (0.618 - 0.68)"
                      badge="PULLBACK"
                      content="Região matemática de retração de alta probabilidade estatística para reversão ou continuação de tendência institucional."
                    >
                      <div className="cursor-help">
                        <span className="text-neutral-500 block text-[9px] font-bold uppercase">Golden Pocket</span>
                        <span className={`font-bold ${t.fibonacci?.inGoldenPocket ? 'text-orange-400 animate-pulse' : 'text-neutral-600'}`}>
                          {t.fibonacci?.inGoldenPocket ? '★ ZONA 0.68' : 'FORA'}
                        </span>
                      </div>
                    </Tooltip>
                  </div>

                  {/* Confluence Bar with Tooltip */}
                  <Tooltip
                    position="top"
                    title="Score de Confluência Algorítmica"
                    badge={`${t.confluenceScore}/100`}
                    content="Ponderação quantitativa somando Delta CVD, Open Interest, Níveis de Volume Profile (POC/VAH/VAL), Suporte/Resistência e Fibonacci."
                  >
                    <div className="space-y-1 mb-2.5 cursor-help w-full">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-neutral-400 font-bold">Confluência:</span>
                        <span className="font-extrabold text-orange-400">{t.confluenceScore}%</span>
                      </div>
                      <div className="w-full h-1 bg-neutral-900 rounded-full overflow-hidden border border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            t.confluenceScore >= 65
                              ? 'bg-orange-500'
                              : t.confluenceScore >= 45
                              ? 'bg-amber-500'
                              : 'bg-neutral-700'
                          }`}
                          style={{ width: `${t.confluenceScore}%` }}
                        />
                      </div>
                    </div>
                  </Tooltip>

                  {/* Factors List Badges */}
                  <div className="flex flex-wrap gap-1 mb-2.5">
                    {(t.confluenceFactors || []).slice(0, 2).map((factor, idx) => (
                      <span key={idx} className="text-[9px] bg-neutral-900 text-neutral-300 px-1.5 py-0.5 rounded border border-white/5 line-clamp-1">
                        • {factor}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Footer Link with Tooltip */}
                <Tooltip
                  position="top"
                  title={`Abrir Gráfico & IA de ${t.symbol}`}
                  badge="INTERAÇÃO"
                  content="Abre o painel com velas de 1m/5m/15m/1h, perfil de volume institucional (TPO), Order Blocks e revisão analítica por Inteligência Artificial."
                >
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400 group-hover:text-orange-400 transition font-mono w-full">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Activity className="h-3.5 w-3.5 text-orange-400" />
                      <Brain className="h-3.5 w-3.5 text-orange-400" />
                      <span>Gráfico & Análise IA</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-orange-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </Tooltip>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Pattern Details Inspector Modal */}
      {selectedPatternModal && (
        <PatternInspectorModal
          ticker={selectedPatternModal.ticker}
          pattern={selectedPatternModal.pattern}
          onClose={() => setSelectedPatternModal(null)}
          onSelectTicker={onSelectTicker}
        />
      )}

      {/* Volume Spike Inspector Modal */}
      {selectedVolumeAlertModal && (
        <VolumeSpikeInspectorModal
          alert={selectedVolumeAlertModal.alert}
          ticker={selectedVolumeAlertModal.ticker}
          onClose={() => setSelectedVolumeAlertModal(null)}
          onSelectTicker={onSelectTicker}
        />
      )}
    </div>
  );
};


