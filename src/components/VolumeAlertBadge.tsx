import React from 'react';
import { VolumeSpikeAlert } from '../types';
import { getVolumeAnomalyVisualTheme } from '../utils/volumeScreenerUtils';
import { Tooltip } from './Tooltip';
import { formatPrice } from '../utils/formatters';
import { Flame, Activity, TrendingUp, TrendingDown, Zap, BarChart2, ShieldAlert } from 'lucide-react';

interface VolumeAlertBadgeProps {
  alert: VolumeSpikeAlert;
  onInspect?: (alert: VolumeSpikeAlert, e: React.MouseEvent) => void;
  compact?: boolean;
}

export const VolumeAlertBadge: React.FC<VolumeAlertBadgeProps> = ({
  alert,
  onInspect,
  compact = false
}) => {
  if (!alert) return null;

  const theme = getVolumeAnomalyVisualTheme(alert.anomalyType);
  const isHighUrgency = alert.urgency === 'HIGH';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onInspect) {
      onInspect(alert, e);
    }
  };

  const tooltipContent = (
    <div className="space-y-2 text-xs font-mono max-w-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
        <span className="font-extrabold text-white flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          {alert.anomalyTitle}
        </span>
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${theme.tagBg} border ${theme.border}`}>
          {alert.urgency === 'HIGH' ? 'URGÊNCIA ALTA' : 'URGÊNCIA MÉDIA'}
        </span>
      </div>

      <p className="text-[11px] text-neutral-300 leading-tight">
        {alert.anomalyDescription}
      </p>

      {/* Multi-Timeframe Matrix (1h, 4h, 1d) */}
      <div className="space-y-1 bg-black/50 p-2 rounded border border-white/5">
        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
          R-Vol Multi-Timeframe vs Média:
        </span>
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
          {(['1h', '4h', '1d'] as const).map(tf => {
            const m = alert.timeframes[tf];
            return (
              <div
                key={tf}
                className={`p-1 rounded border ${
                  m.isAnomaly
                    ? tf === alert.dominantTimeframe
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-black'
                      : 'bg-white/10 border-white/20 text-white font-bold'
                    : 'bg-neutral-900 border-white/5 text-neutral-400'
                }`}
              >
                <div className="text-[9px] opacity-75">{tf.toUpperCase()}</div>
                <div className="text-xs">{m.rvol}x</div>
                <div className="text-[8px] opacity-70">
                  {m.deltaPressure === 'BUY' ? '▲ BUY' : m.deltaPressure === 'SELL' ? '▼ SELL' : '▬'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CVD & Volume Data */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px] text-neutral-300">
        <div>
          <span className="text-neutral-500 block text-[9px]">Pressão CVD:</span>
          <span className={`font-bold ${alert.cvdDirection === 'BUY' ? 'text-emerald-400' : alert.cvdDirection === 'SELL' ? 'text-rose-400' : 'text-neutral-300'}`}>
            {alert.cvdDirection === 'BUY' ? 'COMPRADORA ▲' : alert.cvdDirection === 'SELL' ? 'VENDEDORA ▼' : 'NEUTRA'}
          </span>
        </div>
        <div>
          <span className="text-neutral-500 block text-[9px]">Dominante:</span>
          <span className="font-bold text-amber-300 uppercase">
            {alert.dominantTimeframe} ({alert.timeframes[alert.dominantTimeframe].rvol}x)
          </span>
        </div>
      </div>

      {/* Checklist */}
      <div className="pt-1 border-t border-white/10 space-y-0.5">
        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
          Fatores Confirmados:
        </span>
        {alert.confluenceFactors.slice(0, 2).map((fac, i) => (
          <div key={i} className="text-[10px] text-neutral-300 flex items-start gap-1">
            <span className="text-amber-400 shrink-0">⚡</span>
            <span className="line-clamp-2">{fac}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Tooltip
      position="top"
      title={`Alerta de Volume Anômalo: ${alert.symbol}`}
      badge={`${alert.dominantTimeframe.toUpperCase()} • ${alert.maxRvol}x R-Vol`}
      content={tooltipContent}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick(e as unknown as React.MouseEvent);
          }
        }}
        className={`group/vol relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-mono font-black transition-all duration-200 cursor-pointer select-none ${theme.bg} ${theme.border} ${theme.text} ${theme.glow} hover:scale-[1.02] active:scale-95`}
      >
        {/* Animated Pulse Beacon */}
        <span className="relative flex h-2 w-2">
          {isHighUrgency && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.badgeChip}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${theme.badgeChip}`} />
        </span>

        {/* Icon */}
        <Flame className="w-3 h-3 text-amber-400 shrink-0 group-hover/vol:rotate-12 transition-transform" />

        {/* Tag Name & Multiplier */}
        <span className="tracking-tight uppercase">
          VOL {alert.maxRvol}x
        </span>

        {!compact && (
          <span className="text-[8px] font-extrabold uppercase px-1 py-0.2 rounded bg-black/40 border border-white/10 text-neutral-200">
            {alert.dominantTimeframe}
          </span>
        )}

        {isHighUrgency && (
          <span className="hidden sm:inline-block text-[8px] uppercase tracking-wider font-black px-1 py-0.2 rounded bg-amber-500/30 text-amber-200 border border-amber-500/40">
            SPIKE
          </span>
        )}
      </div>
    </Tooltip>
  );
};
