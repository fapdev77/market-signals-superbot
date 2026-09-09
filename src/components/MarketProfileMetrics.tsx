import React from 'react';
import { Layers, Activity, Target } from 'lucide-react';
import { TickerData } from '../types';
import { formatPrice, formatCompactNumber } from '../utils/formatters';

interface MarketProfileMetricsProps {
  ticker: TickerData;
  timeframe: string;
  isBullishStructure: boolean;
  structureLabel: string;
  bosStatus: string;
}

export const MarketProfileMetrics: React.FC<MarketProfileMetricsProps> = ({
  ticker,
  timeframe,
  isBullishStructure,
  structureLabel,
  bosStatus,
}) => {
  const range = ticker.rangeProfile || { vah: 0, val: 0, poc: 0 };

  return (
    <div className="space-y-4">
      {/* Volume Profile Breakdown */}
      <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-2.5">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <Layers className="h-4 w-4 text-orange-400" />
          <h3 className="text-xs font-bold text-white uppercase">Volume Profile do Range</h3>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between p-2 rounded bg-[#050505] border border-white/5">
            <span className="text-neutral-400">VAH (Value Area High):</span>
            <span className="font-extrabold text-neutral-200">{formatPrice(range.vah, { currency: true })}</span>
          </div>
          <div className="flex justify-between p-2 rounded bg-orange-500/10 border border-orange-500/30">
            <span className="text-orange-400 font-bold">POC (Point of Control):</span>
            <span className="font-extrabold text-orange-400">{formatPrice(range.poc, { currency: true })}</span>
          </div>
          <div className="flex justify-between p-2 rounded bg-[#050505] border border-white/5">
            <span className="text-neutral-400">VAL (Value Area Low):</span>
            <span className="font-extrabold text-neutral-200">{formatPrice(range.val, { currency: true })}</span>
          </div>
        </div>
      </div>

      {/* Order Flow & OI Breakdown */}
      <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-2.5">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white uppercase">Métricas de Order Flow & Funding</h3>
        </div>
        <div className="space-y-2 text-xs">
          <div>
            <div className="flex justify-between text-neutral-400 mb-1">
              <span>CVD (Delta Acumulado):</span>
              <span className={`font-bold ${ticker.cvdDirection === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${((ticker.cvd ?? 0) / 1000000).toFixed(2)}M ({ticker.cvdDirection})
              </span>
            </div>
            <div className="w-full bg-[#050505] h-1.5 rounded-full overflow-hidden border border-white/5">
              <div
                className={`h-full ${ticker.cvdDirection === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(100, (ticker.takerBuyRatio ?? 0.5) * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between p-2 bg-[#050505] rounded border border-white/5 items-center">
            <span className="text-neutral-400">CVD Delta (Vela Recente):</span>
            <span className={`font-bold ${(ticker.cvdDeltaPercent ?? 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${formatCompactNumber(Math.abs(ticker.cvdDelta ?? 0))} ({(ticker.cvdDeltaPercent ?? 0) > 0 ? '+' : ''}{ticker.cvdDeltaPercent ?? 0}%)
            </span>
          </div>

          <div className="flex justify-between p-2 bg-[#050505] rounded border border-white/5">
            <span className="text-neutral-400">Var Open Interest (1h):</span>
            <span className={`font-bold ${(ticker.openInterestChange1h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {(ticker.openInterestChange1h ?? 0) >= 0 ? '+' : ''}{(ticker.openInterestChange1h ?? 0).toFixed(2)}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <div className="p-2 bg-[#050505] rounded border border-white/5">
              <span className="text-[10px] text-neutral-400 block">Funding Fee Atual</span>
              <span className="font-extrabold text-white">
                {((ticker.fundingRate ?? 0) * 100).toFixed(4)}%
              </span>
            </div>
            <div className="p-2 bg-[#050505] rounded border border-white/5">
              <span className="text-[10px] text-neutral-400 block">Funding Fee Diário</span>
              <span className={`font-extrabold ${(ticker.fundingRate ?? 0) < 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                {((ticker.fundingRateDaily ?? (ticker.fundingRate ?? 0) * 3) * 100).toFixed(3)}%/d
              </span>
            </div>
          </div>

          <div className="flex justify-between p-2 bg-[#050505] rounded border border-white/5">
            <span className="text-neutral-400">Funding Rate Anualizado:</span>
            <span className="font-bold text-orange-400">
              {(ticker.fundingRateAnnualized ?? 0).toFixed(1)}% APR
            </span>
          </div>

          {/* Análise do Comportamento do Funding Rate */}
          <div className={`p-2.5 rounded border text-[11px] space-y-1 ${
            ticker.fundingRateAnalysis?.status === 'EXTREME_NEGATIVE' || ticker.fundingRateAnalysis?.status === 'NEGATIVE'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : ticker.fundingRateAnalysis?.status === 'EXTREME_POSITIVE' || ticker.fundingRateAnalysis?.status === 'POSITIVE'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-neutral-900 border-white/10 text-neutral-300'
          }`}>
            <div className="flex items-center justify-between font-extrabold">
              <span>ANALISADOR DE FUNDING</span>
              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-black/40 border border-white/10">
                {ticker.fundingRateAnalysis?.bias ?? 'NEUTRAL'}
              </span>
            </div>
            <div className="font-black text-[10px] uppercase">
              {ticker.fundingRateAnalysis?.pressure ?? 'NEUTRO / EQUILIBRADO'}
            </div>
            <div className="text-[10px] opacity-90 leading-relaxed">
              {ticker.fundingRateAnalysis?.description ?? 'Taxa de funding em equilíbrio normal.'}
            </div>
          </div>
        </div>
      </div>

      {/* Divergence & Structure Analysis (Sniper) */}
      <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-2.5">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-rose-400" />
            <h3 className="text-xs font-bold text-white uppercase">Divergências & Estrutura</h3>
          </div>
        </div>
        
        <div className="space-y-3 text-xs">
          {/* Divergence */}
          <div className="p-2.5 bg-[#050505] rounded border border-white/5 space-y-2 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-8 h-8 rounded-bl-full opacity-20 ${ticker.cvdDirection === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <div className="flex justify-between items-center mb-1">
              <span className="text-neutral-400 font-bold uppercase text-[10px]">Divergência Detectada</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${ticker.cvdDirection === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                {ticker.cvdDirection === 'BUY' ? 'Bullish (Forte)' : 'Bearish (Média)'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-neutral-500 block">Formação (CVD vs Preço)</span>
                <span className="font-bold text-neutral-200">{ticker.cvdDirection === 'BUY' ? 'Absorção de Venda' : 'Agressão de Venda'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Relevância / Impacto</span>
                <span className="font-bold text-orange-400">{ticker.cvdDirection === 'BUY' ? 'Alta (Reversão)' : 'Irrelevante'}</span>
              </div>
            </div>
          </div>

          {/* Market Structure HH/HL LL/LH */}
          <div className="p-2.5 bg-[#050505] rounded border border-white/5 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-8 h-8 rounded-bl-full opacity-20 ${isBullishStructure ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-neutral-400 font-bold uppercase text-[10px] mb-2 block">Estrutura de Mercado ({timeframe})</span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isBullishStructure ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className={`font-bold ${isBullishStructure ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {structureLabel}
                </span>
              </div>
              <span className="text-[10px] text-neutral-500 border border-white/10 px-1.5 py-0.5 rounded font-bold">
                BOS {bosStatus}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
