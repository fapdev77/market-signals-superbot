import React, { useState } from 'react';
import { TickerData } from '../types';
import { TrendingUp, TrendingDown, Zap, Brain, Activity, Flame } from 'lucide-react';

interface TickerGridProps {
  tickers: TickerData[];
  onSelectTicker: (ticker: TickerData) => void;
  onRequestAIReview: (ticker: TickerData) => void;
}

export const TickerGrid: React.FC<TickerGridProps> = ({
  tickers = [],
  onSelectTicker,
  onRequestAIReview
}) => {
  const [filterMarket, setFilterMarket] = useState<'all' | 'crypto_futures' | 'tradfi'>('all');
  const [filterSignal, setFilterSignal] = useState<'all' | 'signals_only' | 'golden_pocket'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTickers = (tickers || []).filter(t => {
    if (!t) return false;
    if (filterMarket !== 'all' && t.marketType !== filterMarket) return false;
    if (filterSignal === 'signals_only' && (t.signalType === 'NEUTRAL' || !t.signalType)) return false;
    if (filterSignal === 'golden_pocket' && !t.fibonacci?.inGoldenPocket) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (t.symbol || '').toLowerCase().includes(q) || (t.name || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="bg-[#0A0A0A] p-3 rounded-lg border border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-1.5 w-full md:w-auto font-mono text-xs overflow-x-auto scrollbar-none pb-1 md:pb-0">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mr-1 shrink-0">MERCADO:</span>
          <button
            onClick={() => setFilterMarket('all')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition shrink-0 ${
              filterMarket === 'all'
                ? 'bg-orange-500 text-black'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/5'
            }`}
          >
            TODOS ({tickers.length})
          </button>
          <button
            onClick={() => setFilterMarket('crypto_futures')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition shrink-0 ${
              filterMarket === 'crypto_futures'
                ? 'bg-orange-500 text-black'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/5'
            }`}
          >
            CRIPTO PERPETUOS
          </button>
          <button
            onClick={() => setFilterMarket('tradfi')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition shrink-0 ${
              filterMarket === 'tradfi'
                ? 'bg-orange-500 text-black'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/5'
            }`}
          >
            TRADFI & AÇÕES
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto font-mono text-xs">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setFilterSignal(filterSignal === 'signals_only' ? 'all' : 'signals_only')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition border shrink-0 ${
                filterSignal === 'signals_only'
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                  : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
              }`}
            >
              <Zap className="h-3 w-3 text-orange-400" />
              SINAIS ATIVOS
            </button>

            <button
              onClick={() => setFilterSignal(filterSignal === 'golden_pocket' ? 'all' : 'golden_pocket')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition border shrink-0 ${
                filterSignal === 'golden_pocket'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
              }`}
            >
              <Flame className="h-3 w-3 text-orange-400" />
              GOLDEN POCKET (0.68)
            </button>
          </div>

          <input
            type="text"
            placeholder="Buscar ativo (BTC, SOL)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#050505] border border-white/10 text-neutral-200 placeholder-neutral-500 px-3 py-1 rounded text-xs focus:outline-none focus:border-orange-500 w-full sm:w-48 font-mono"
          />
        </div>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredTickers.map((t) => {
          const signalType = t.signalType || 'NEUTRAL';
          const isLong = signalType.includes('LONG');
          const isShort = signalType.includes('SHORT');
          const price = t.price ?? 0;
          const changePct = t.priceChangePercent24h ?? 0;

          return (
            <div
              key={t.symbol}
              className={`bg-[#0A0A0A] rounded-lg border ${
                t.confluenceScore >= 65 ? 'border-orange-500/40' : 'border-white/10'
              } p-3 hover:border-neutral-700 transition duration-150 flex flex-col justify-between shadow-md relative overflow-hidden group font-mono`}
            >
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-extrabold text-sm text-white group-hover:text-orange-400 transition">
                        {t.symbol}
                      </h3>
                      <span className="text-[9px] uppercase font-bold text-neutral-400 bg-neutral-900 border border-white/5 px-1 py-0.5 rounded">
                        {t.marketType === 'crypto_futures' ? 'PERP' : 'STOCK'}
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-400 line-clamp-1">{t.name}</p>
                  </div>

                  {/* Signal Rating Pill */}
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
                </div>

                {/* Price & Change */}
                <div className="flex items-baseline justify-between my-2">
                  <div className="text-lg font-black text-white">
                    ${price >= 1000 ? price.toLocaleString('en-US', { minimumFractionDigits: 1 }) : price.toFixed(price < 1 ? 4 : 2)}
                  </div>
                  <div className={`text-xs font-bold ${changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                  </div>
                </div>

                {/* Quant Indicators Summary Matrix */}
                <div className="grid grid-cols-2 gap-1.5 bg-[#050505] p-2 rounded border border-white/5 text-[10px] mb-2.5">
                  <div>
                    <span className="text-neutral-500 block text-[9px] font-bold uppercase">OI (1h)</span>
                    <span className={`font-bold ${(t.openInterestChange1h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {(t.openInterestChange1h ?? 0) >= 0 ? '+' : ''}{(t.openInterestChange1h ?? 0).toFixed(2)}%
                    </span>
                  </div>

                  <div>
                    <span className="text-neutral-500 block text-[9px] font-bold uppercase">CVD Delta</span>
                    <span className={`font-bold ${t.cvdDirection === 'BUY' ? 'text-emerald-400' : t.cvdDirection === 'SELL' ? 'text-rose-400' : 'text-neutral-400'}`}>
                      {t.cvdDirection === 'BUY' ? 'COMPRA' : t.cvdDirection === 'SELL' ? 'VENDA' : 'NEUTRO'}
                    </span>
                  </div>

                  <div>
                    <span className="text-neutral-500 block text-[9px] font-bold uppercase">Funding APR</span>
                    <span className={`font-bold ${(t.fundingRate ?? 0) < 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                      {(t.fundingRateAnnualized ?? 0).toFixed(1)}%
                    </span>
                  </div>

                  <div>
                    <span className="text-neutral-500 block text-[9px] font-bold uppercase">Golden Pocket</span>
                    <span className={`font-bold ${t.fibonacci?.inGoldenPocket ? 'text-orange-400 animate-pulse' : 'text-neutral-600'}`}>
                      {t.fibonacci?.inGoldenPocket ? '★ ZONA 0.68' : 'FORA'}
                    </span>
                  </div>
                </div>

                {/* Confluence Bar */}
                <div className="space-y-1 mb-2.5">
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

                {/* Factors List Badges */}
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {(t.confluenceFactors || []).slice(0, 2).map((factor, idx) => (
                    <span key={idx} className="text-[9px] bg-neutral-900 text-neutral-300 px-1.5 py-0.5 rounded border border-white/5 line-clamp-1">
                      • {factor}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/10">
                <button
                  onClick={() => onSelectTicker(t)}
                  className="w-full py-1 px-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 rounded text-[11px] font-bold transition border border-white/5 flex items-center justify-center gap-1"
                >
                  <Activity className="h-3 w-3 text-orange-400" />
                  Gráfico
                </button>

                <button
                  onClick={() => onRequestAIReview(t)}
                  className="w-full py-1 px-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded text-[11px] font-bold transition flex items-center justify-center gap-1"
                >
                  <Brain className="h-3 w-3 text-orange-400" />
                  Revisar IA
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
