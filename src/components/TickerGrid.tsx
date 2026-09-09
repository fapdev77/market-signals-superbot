import React, { useState, useMemo } from 'react';
import { TickerData } from '../types';
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
  SlidersHorizontal
} from 'lucide-react';
import { formatPrice, formatPercent } from '../utils/formatters';
import { Tooltip } from './Tooltip';

export type TickerSortOption = 
  | 'volatility_desc'
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
  const [filterSignal, setFilterSignal] = useState<'all' | 'signals_only' | 'golden_pocket'>('all');
  const [sortBy, setSortBy] = useState<TickerSortOption>('volatility_desc');
  const [searchQuery, setSearchQuery] = useState('');

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
  }, [tickers, filterMarket, filterSignal, searchQuery, sortBy]);

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
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2 flex items-center text-neutral-400 hover:text-white transition cursor-pointer"
                title="Limpar busca"
              >
                <X className="h-3 w-3" />
              </button>
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

            return (
              <div
                key={t.symbol}
                onClick={() => onSelectTicker(t)}
                className={`bg-[#0A0A0A] rounded-xl border ${
                  t.confluenceScore >= 65 ? 'border-orange-500/40 hover:border-orange-500' : 'border-white/10 hover:border-orange-500/60'
                } p-3.5 transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between shadow-md hover:shadow-orange-500/10 cursor-pointer relative overflow-hidden group font-mono`}
              >
                <div>
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-1.5">
                    <div>
                      <div className="flex items-center gap-1.5">
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
    </div>
  );
};


