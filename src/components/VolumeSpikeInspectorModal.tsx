import React from 'react';
import { VolumeSpikeAlert, TickerData } from '../types';
import { getVolumeAnomalyVisualTheme } from '../utils/volumeScreenerUtils';
import { formatPrice } from '../utils/formatters';
import { 
  X, 
  Flame, 
  Activity, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Zap, 
  ArrowRight, 
  Layers, 
  CheckCircle2, 
  Clock, 
  Coins 
} from 'lucide-react';

interface VolumeSpikeInspectorModalProps {
  alert: VolumeSpikeAlert | null;
  ticker?: TickerData | null;
  onClose: () => void;
  onSelectTicker?: (ticker: TickerData) => void;
}

export const VolumeSpikeInspectorModal: React.FC<VolumeSpikeInspectorModalProps> = ({
  alert,
  ticker,
  onClose,
  onSelectTicker
}) => {
  if (!alert) return null;

  const theme = getVolumeAnomalyVisualTheme(alert.anomalyType);
  const isHighUrgency = alert.urgency === 'HIGH';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-mono">
      <div 
        className="bg-[#0D0D0D] border border-amber-500/40 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl shadow-amber-950/40 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-neutral-900/60">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${theme.bg} ${theme.border} ${theme.text}`}>
              <Flame className="w-6 h-6 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-neutral-400 uppercase tracking-wider">
                  Smart Volume Screener • Alerta Anômalo
                </span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${theme.tagBg} border ${theme.border}`}>
                  {theme.label}
                </span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                  isHighUrgency ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  URGÊNCIA {alert.urgency}
                </span>
              </div>
              <h2 className="text-xl font-black text-white flex items-center gap-2 mt-0.5">
                <span className="text-amber-400">{alert.symbol}</span>
                <span className="text-sm font-bold text-neutral-400">• {alert.name}</span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Executive Diagnostic Box */}
          <div className="p-4 rounded-xl bg-neutral-900/70 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Diagnóstico de Fluxo e Volume
              </span>
              <span className="text-amber-400 font-black">
                Pico Máximo: {alert.maxRvol}x no TF {alert.dominantTimeframe.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-neutral-200 leading-relaxed">
              {alert.anomalyDescription}
            </p>
          </div>

          {/* Multi-Timeframe Volume Matrix (1h, 4h, 1d) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                Comportamento Multi-Timeframe (1h, 4h, 1d)
              </span>
              <span className="text-[10px] text-neutral-500">
                R-Vol = Volume Atual ÷ Média Histórica
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(['1h', '4h', '1d'] as const).map(tf => {
                const metric = alert.timeframes[tf];
                const isDominant = tf === alert.dominantTimeframe;

                return (
                  <div
                    key={tf}
                    className={`p-3 rounded-xl border transition-all ${
                      isDominant
                        ? 'bg-amber-950/30 border-amber-500/50 shadow-md shadow-amber-950/20'
                        : metric.isAnomaly
                        ? 'bg-neutral-900/80 border-white/15'
                        : 'bg-neutral-900/40 border-white/5 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black text-neutral-300 uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3 text-neutral-400" />
                        Timeframe {tf}
                      </span>
                      {isDominant && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500 text-black">
                          DOMINANTE
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between my-1">
                      <div className="text-2xl font-black text-white">
                        {metric.rvol}x
                      </div>
                      <div className={`text-xs font-bold ${metric.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {metric.changePct >= 0 ? '+' : ''}{metric.changePct}%
                      </div>
                    </div>

                    {/* R-Vol Visual Bar */}
                    <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden my-2">
                      <div
                        className={`h-full rounded-full ${
                          metric.rvol >= 3.0 ? 'bg-amber-400' : metric.rvol >= 2.0 ? 'bg-cyan-400' : 'bg-neutral-500'
                        }`}
                        style={{ width: `${Math.min(100, (metric.rvol / 5.0) * 100)}%` }}
                      />
                    </div>

                    <div className="space-y-1 text-[10px] text-neutral-400 pt-1 border-t border-white/5">
                      <div className="flex justify-between">
                        <span>Volume Estimado:</span>
                        <strong className="text-white">
                          ${(metric.volumeUsd >= 1_000_000 ? `${(metric.volumeUsd / 1_000_000).toFixed(2)}M` : `${(metric.volumeUsd / 1_000).toFixed(0)}k`)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Desvio Z-Score:</span>
                        <strong className="text-cyan-300">+{metric.zScore}σ</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Delta Agressão:</span>
                        <strong className={metric.deltaPressure === 'BUY' ? 'text-emerald-400' : metric.deltaPressure === 'SELL' ? 'text-rose-400' : 'text-neutral-400'}>
                          {metric.deltaPressure === 'BUY' ? 'Comprador (Taker)' : metric.deltaPressure === 'SELL' ? 'Vendedor (Taker)' : 'Equilibrado'}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Microstructure & Confluences */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Confluences */}
            <div className="p-3.5 rounded-xl bg-neutral-900/50 border border-white/5 space-y-2">
              <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Evidências do Volume Spike
              </span>
              <div className="space-y-1.5">
                {alert.confluenceFactors.map((fac, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-neutral-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{fac}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actionable Investigation Checklist */}
            <div className="p-3.5 rounded-xl bg-neutral-900/50 border border-white/5 space-y-2">
              <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                Guia de Ação Imediata
              </span>
              <div className="space-y-1.5">
                {alert.investigationChecklist.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-neutral-300">
                    <span className="text-cyan-400 font-bold shrink-0">{idx + 1}.</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-neutral-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-400">
            Preço Atual: <strong className="text-white">{formatPrice(alert.currentPrice, { currency: true })}</strong> ({alert.priceChangePercent24h >= 0 ? '+' : ''}{alert.priceChangePercent24h}%)
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs transition cursor-pointer"
            >
              Fechar
            </button>

            {onSelectTicker && ticker && (
              <button
                type="button"
                onClick={() => {
                  onSelectTicker(ticker);
                  onClose();
                }}
                className="w-full sm:w-auto px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                <span>Investigar Gráfico & Order Flow</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
