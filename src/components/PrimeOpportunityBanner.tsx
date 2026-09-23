import React, { useState } from 'react';
import { TickerData } from '../types';
import { 
  Flame, 
  ArrowUpRight, 
  ChevronDown, 
  ChevronUp, 
  Scale, 
  Percent, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  ShieldAlert, 
  Layers,
  HelpCircle,
  Zap,
  BarChart2,
  Sliders,
  Filter,
  Check
} from 'lucide-react';
import { formatPrice, formatPercent, formatCompactNumber } from '../utils/formatters';
import { GoldenPocketSparkline, GoldenPocketStats } from './GoldenPocketSparkline';
import { Tooltip } from './Tooltip';

interface PrimeOpportunityBannerProps {
  ticker: TickerData;
  stats: GoldenPocketStats | null;
  onAnalyzeTicker: (symbol: string) => void;
  confluenceThreshold: number;
  onUpdateConfluenceThreshold: (threshold: number) => void;
}

export const PrimeOpportunityBanner: React.FC<PrimeOpportunityBannerProps> = ({
  ticker,
  stats,
  onAnalyzeTicker,
  confluenceThreshold,
  onUpdateConfluenceThreshold
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showThresholdPicker, setShowThresholdPicker] = useState<boolean>(false);

  // Pre-set threshold levels for fast switching
  const presetThresholds = [60, 70, 75, 80];

  // Deriving Order Book Imbalance metrics
  // Taker buy ratio gives exact order flow aggression balance.
  // Bid/Ask volume approximation from taker buy ratio & 24h volume:
  const buyRatio = ticker.takerBuyRatio ?? 0.52;
  const sellRatio = Math.max(0, 1 - buyRatio);
  
  // Imbalance Ratio: ratio of buyer power to seller power
  const imbalanceRatio = sellRatio > 0 ? buyRatio / sellRatio : 1;
  const imbalancePct = Math.round((buyRatio - 0.5) * 200); // from -100% to +100%
  const isBuyerDominant = buyRatio >= 0.50;

  // Imbalance depth interpretation
  const imbalanceLevel = 
    Math.abs(imbalancePct) >= 20 ? 'FORTE DESEQUILÍBRIO' : 
    Math.abs(imbalancePct) >= 8 ? 'DESEQUILÍBRIO MODERADO' : 'LIVRO EQUILIBRADO';

  // Funding Rate Trend & APR
  const fundingRateRaw = ticker.fundingRate ?? 0.0001;
  const fundingRatePct = fundingRateRaw * 100;
  const fundingAnnualized = ticker.fundingRateAnnualized ?? (fundingRatePct * 3 * 365);
  const fundingDaily = ticker.fundingRateDaily ?? (fundingRateRaw * 3);

  // Funding pressure categorization
  const isExtremePositiveFunding = fundingRateRaw >= 0.0005; // > 0.05% per cycle (overleveraged longs)
  const isNegativeFunding = fundingRateRaw < 0;             // Shorts paying longs (potential squeeze)

  const fundingTrendStatus = isNegativeFunding 
    ? 'SHORT SQUEEZE POTENTIAL' 
    : isExtremePositiveFunding 
      ? 'OVERLEVERAGED LONGS (FLUSH RISK)' 
      : 'TAXA ESTÁVEL / SAUDÁVEL';

  return (
    <div 
      key={ticker.symbol}
      className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 border border-amber-500/40 rounded-2xl shadow-xl animate-prime-banner-entrance overflow-hidden transition-all duration-300 relative group"
    >
      {/* Dynamic sheen line */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

      {/* Primary Bar (Always visible) */}
      <div className="p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left Side: Icon, Symbol, Sparkline & Confluence */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 flex-shrink-0 mt-0.5 sm:mt-0">
            <Flame className="h-6 w-6 animate-bounce" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold font-mono text-white">
                OPORTUNIDADE PRIME: {ticker.symbol}
              </h3>

              {/* Mini Sparkline & Success Count Indicator */}
              {stats && (
                <GoldenPocketSparkline stats={stats} />
              )}

              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-extrabold px-2 py-0.5 rounded uppercase border border-amber-500/30">
                {ticker.confluenceScore}% Confluência
              </span>

              {/* Threshold Override Quick Toggle Button */}
              <div className="relative inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setShowThresholdPicker(!showThresholdPicker)}
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border transition flex items-center gap-1 active:scale-95 ${
                    confluenceThreshold > 60
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30'
                      : 'bg-neutral-800/80 text-neutral-300 border-white/10 hover:border-white/20 hover:text-white'
                  }`}
                  title="Ajustar threshold mínimo de confluência para a sessão"
                >
                  <Sliders className="w-2.5 h-2.5 text-cyan-400" />
                  <span>Filtro: &ge;{confluenceThreshold}%</span>
                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                </button>

                {/* Popover Menu for Threshold quick selection */}
                {showThresholdPicker && (
                  <div className="absolute top-full left-0 mt-1 z-30 bg-[#0c0c0c] border border-white/15 rounded-xl shadow-2xl p-2.5 w-52 text-xs flex flex-col gap-2 font-sans animate-fade-in backdrop-blur-md">
                    <div className="flex items-center justify-between pb-1 border-b border-white/10">
                      <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider">Filtro de Ruído</span>
                      <span className="text-[10px] text-cyan-400 font-mono font-bold">{confluenceThreshold}% min</span>
                    </div>

                    <p className="text-[10px] text-neutral-400 leading-tight">
                      Aumente de 60% para 75%+ para exibir apenas sinais ultra-confluentes no banner.
                    </p>

                    <div className="grid grid-cols-4 gap-1">
                      {presetThresholds.map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            onUpdateConfluenceThreshold(val);
                            setShowThresholdPicker(false);
                          }}
                          className={`py-1 rounded-lg text-[10px] font-mono font-bold transition flex items-center justify-center border ${
                            confluenceThreshold === val
                              ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/30'
                              : 'bg-neutral-900 text-neutral-300 border-white/5 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>

                    <div className="pt-1 flex items-center justify-between text-[9px] text-neutral-500 border-t border-white/5">
                      <span>Persistido no navegador</span>
                      {confluenceThreshold !== 60 && (
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateConfluenceThreshold(60);
                            setShowThresholdPicker(false);
                          }}
                          className="text-amber-400 hover:underline"
                        >
                          Restaurar (60%)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick glance micro-badges */}
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border hidden sm:inline-flex items-center gap-1 ${
                isBuyerDominant 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                <Scale className="w-2.5 h-2.5" />
                Book: {imbalanceRatio.toFixed(2)}x {isBuyerDominant ? 'Comprador' : 'Vendedor'}
              </span>

              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border hidden md:inline-flex items-center gap-1 ${
                isNegativeFunding
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-neutral-800 text-neutral-300 border-white/10'
              }`}>
                <Percent className="w-2.5 h-2.5" />
                Funding: {fundingRatePct > 0 ? '+' : ''}{fundingRatePct.toFixed(4)}%
              </span>
            </div>

            <p className="text-xs text-slate-300 mt-1">
              Preço em {formatPrice(ticker.price, { currency: true })} no Golden Pocket Fibo (0.618 - 0.68) com CVD {ticker.cvdDirection === 'BUY' ? 'Comprador' : 'Vendedor'}.
            </p>
          </div>
        </div>

        {/* Right Side: Actions (Expand toggle & Analyze button) */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-white/10">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-2 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition flex items-center gap-1.5 active:scale-95"
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? 'Recolher Métricas' : 'Métricas Avançadas'}</span>
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-amber-400" /> : <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />}
          </button>

          <button
            onClick={() => onAnalyzeTicker(ticker.symbol)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20 whitespace-nowrap active:scale-95"
          >
            Analisar {ticker.symbol}
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expandable Deep Metrics Tray */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-amber-500/20 bg-black/40 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in font-mono">
          
          {/* Card 1: Order Book Imbalance Ratio & Flow */}
          <div className="bg-[#050505] p-3 rounded-xl border border-white/10 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold text-neutral-200">Order Book Imbalance</span>
              </div>
              <Tooltip
                position="top"
                title="Desequilíbrio de Livro de Ofertas"
                badge={`${imbalanceRatio.toFixed(2)}x RATIO`}
                content="Mede a proporção de pressão passiva e agressora no livro de ofertas (Bids vs Asks). Um ratio > 1.20x indica forte sustentação compradora para o rompimento do Golden Pocket."
              >
                <HelpCircle className="w-3 h-3 text-neutral-500 cursor-help" />
              </Tooltip>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 text-[10px]">Ratio Compra / Venda:</span>
                <span className={`font-extrabold ${isBuyerDominant ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {imbalanceRatio.toFixed(2)}:1 ({isBuyerDominant ? 'Comprador' : 'Vendedor'})
                </span>
              </div>

              {/* Visual Balance Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] text-neutral-400">
                  <span className="text-emerald-400 font-bold">Bids: {(buyRatio * 100).toFixed(1)}%</span>
                  <span className="text-rose-400 font-bold">Asks: {(sellRatio * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-neutral-900 h-2 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${buyRatio * 100}%` }}
                  />
                  <div 
                    className="bg-rose-500 h-full transition-all duration-300"
                    style={{ width: `${sellRatio * 100}%` }}
                  />
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-[10px] text-neutral-300">
                <span className="text-neutral-500">Status do Livro:</span>
                <span className={`font-bold uppercase ${
                  isBuyerDominant ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {imbalanceLevel}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Funding Rate Trend & Pressure Analyzer */}
          <div className="bg-[#050505] p-3 rounded-xl border border-white/10 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[11px] font-bold text-neutral-200">Tendência de Funding Rate</span>
              </div>
              <Tooltip
                position="top"
                title="Tendência de Taxa de Financiamento"
                badge={`${fundingAnnualized.toFixed(1)}% APR`}
                content="Indica se os compradores ou vendedores de futuros perpétuos estão superalavancados. Taxas negativas com preço no Golden Pocket fornecem combustível para Short Squeeze explosivo."
              >
                <HelpCircle className="w-3 h-3 text-neutral-500 cursor-help" />
              </Tooltip>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 text-[10px]">Taxa do Ciclo (8h):</span>
                <span className={`font-extrabold ${fundingRateRaw < 0 ? 'text-emerald-400' : 'text-neutral-200'}`}>
                  {fundingRatePct > 0 ? '+' : ''}{fundingRatePct.toFixed(4)}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] bg-neutral-900/60 p-1.5 rounded-lg border border-white/5">
                <div>
                  <span className="text-neutral-500 block text-[9px]">Projeção Diária</span>
                  <span className="font-bold text-neutral-200">{((fundingDaily) * 100).toFixed(3)}%/dia</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[9px]">Taxa Anualizada</span>
                  <span className="font-bold text-cyan-400">{fundingAnnualized.toFixed(1)}% APR</span>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-[10px]">
                <span className="text-neutral-500">Pressão Futuros:</span>
                <span className={`font-black text-[9px] uppercase px-1.5 py-0.5 rounded ${
                  isNegativeFunding 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : isExtremePositiveFunding
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-neutral-800 text-neutral-300'
                }`}>
                  {fundingTrendStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Institutional CVD & Open Interest Delta */}
          <div className="bg-[#050505] p-3 rounded-xl border border-white/10 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-bold text-neutral-200">Volume Delta & Open Interest</span>
              </div>
              <Tooltip
                position="top"
                title="Cumulative Volume Delta & Open Interest"
                content="Mede se o teste na retração do Golden Pocket está acompanhado de acréscimo de contratos em aberto e absorção passiva institucional."
              >
                <HelpCircle className="w-3 h-3 text-neutral-500 cursor-help" />
              </Tooltip>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 text-[10px]">Delta Vela Atual (CVD):</span>
                <span className={`font-bold ${(ticker.cvdDeltaPercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ${formatCompactNumber(Math.abs(ticker.cvdDelta ?? 0))} ({(ticker.cvdDeltaPercent ?? 0) >= 0 ? '+' : ''}{ticker.cvdDeltaPercent ?? 0}%)
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-400 text-[10px]">Variação Open Interest (1h):</span>
                <span className={`font-bold ${(ticker.openInterestChange1h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(ticker.openInterestChange1h ?? 0) >= 0 ? '+' : ''}{(ticker.openInterestChange1h ?? 0).toFixed(2)}%
                </span>
              </div>

              <div className="pt-1 flex items-center justify-between text-[10px] border-t border-white/5">
                <span className="text-neutral-500">Golden Pocket Range:</span>
                <span className="text-amber-300 font-extrabold text-[10px]">
                  {formatPrice(ticker.fibonacci.fib618, { currency: true })} – {formatPrice(ticker.fibonacci.fib68, { currency: true })}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Session Confluence Threshold Override */}
          <div className="bg-[#050505] p-3 rounded-xl border border-white/10 flex flex-col justify-between space-y-2 md:col-span-2 lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[11px] font-bold text-neutral-200">Filtro de Ruído: Override de Confluência Mínima</span>
                <span className="text-[9px] bg-cyan-500/10 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30 font-mono">
                  Sessão Persistida
                </span>
              </div>
              <div className="flex items-center gap-1">
                {presetThresholds.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onUpdateConfluenceThreshold(preset)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition border ${
                      confluenceThreshold === preset
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-neutral-900 text-neutral-400 border-white/5 hover:text-white'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
              <div className="flex-1 w-full space-y-1">
                <div className="flex justify-between text-[10px] text-neutral-400">
                  <span>Sensibilidade: 50% (Permissivo)</span>
                  <span className="font-bold text-cyan-400 font-mono">Corte Atual: &ge;{confluenceThreshold}%</span>
                  <span>95% (Ultra Restrito)</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={90}
                  step={5}
                  value={confluenceThreshold}
                  onChange={(e) => onUpdateConfluenceThreshold(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="text-[10px] text-neutral-400 leading-tight max-w-sm">
                Aumentar o corte para <strong>75%</strong> elimina sinais espúrios durante consolidações, garantindo que o banner destaque apenas ativos com confluência estrita de CVD, OI e Book.
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
