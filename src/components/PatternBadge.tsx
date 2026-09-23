import React from 'react';
import { DetectedChartPattern } from '../types';
import { getPatternVisualBadgeTheme } from '../utils/aiPatternScanner';
import { Tooltip } from './Tooltip';
import { formatPrice } from '../utils/formatters';
import { 
  Flag, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Target, 
  ShieldCheck, 
  Sparkles,
  Layers
} from 'lucide-react';

interface PatternBadgeProps {
  pattern: DetectedChartPattern;
  onInspect?: (pattern: DetectedChartPattern, e: React.MouseEvent) => void;
  compact?: boolean;
}

export const PatternBadge: React.FC<PatternBadgeProps> = ({
  pattern,
  onInspect,
  compact = false
}) => {
  if (!pattern) return null;

  const theme = getPatternVisualBadgeTheme(pattern);
  const isBullish = pattern.bias === 'BULLISH';
  const isReady = pattern.stage === 'READY_BREAKOUT';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onInspect) {
      onInspect(pattern, e);
    }
  };

  const tooltipContent = (
    <div className="space-y-2 text-xs font-mono max-w-xs">
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
        <span className="font-bold text-white flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          {pattern.name}
        </span>
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder}`}>
          {pattern.confidence}% CONF.
        </span>
      </div>

      <p className="text-[11px] text-neutral-300 leading-tight">
        {pattern.summary}
      </p>

      {/* Target & Invalidation Metrics */}
      <div className="grid grid-cols-2 gap-1.5 bg-black/40 p-2 rounded border border-white/5 text-[10px]">
        <div>
          <span className="text-neutral-500 block uppercase text-[9px] flex items-center gap-1">
            <Target className="w-2.5 h-2.5 text-cyan-400" />
            Alvo Técnico
          </span>
          <span className={`font-bold ${isBullish ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatPrice(pattern.measuredMoveTarget, { currency: true })}
            <span className="text-[9px] ml-1 opacity-80">
              ({isBullish ? '+' : '-'}{pattern.targetGainPct}%)
            </span>
          </span>
        </div>

        <div>
          <span className="text-neutral-500 block uppercase text-[9px] flex items-center gap-1">
            <ShieldCheck className="w-2.5 h-2.5 text-amber-400" />
            Stop / Invalidação
          </span>
          <span className="font-bold text-neutral-300">
            {formatPrice(pattern.suggestedStopLoss, { currency: true })}
          </span>
        </div>

        <div>
          <span className="text-neutral-500 block uppercase text-[9px]">Gatilho Rompimento</span>
          <span className="font-bold text-cyan-300">
            {formatPrice(pattern.breakoutTriggerPrice, { currency: true })}
          </span>
        </div>

        <div>
          <span className="text-neutral-500 block uppercase text-[9px]">Risco : Retorno</span>
          <span className="font-bold text-orange-400">
            1 : {pattern.riskRewardRatio}
          </span>
        </div>
      </div>

      {/* Rationale Checklist */}
      <div className="space-y-1">
        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">
          Confluências Validadas:
        </span>
        <div className="space-y-0.5">
          {pattern.technicalRationale.map((rat, i) => (
            <div key={i} className="text-[10px] text-neutral-300 flex items-start gap-1">
              <span className="text-cyan-400 font-bold shrink-0">✓</span>
              <span className="line-clamp-2">{rat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stage Badge */}
      <div className="pt-1 border-t border-white/10 flex items-center justify-between text-[9px] text-neutral-400">
        <span>Estágio: <strong className="text-white">{pattern.stage.replace('_', ' ')}</strong></span>
        <span>TF: <strong className="text-neutral-300">{pattern.timeframe}</strong></span>
      </div>
    </div>
  );

  return (
    <Tooltip
      position="top"
      title={`Scanner de Padrões IA: ${pattern.shortName}`}
      badge={`${pattern.bias === 'BULLISH' ? 'ALTA' : 'BAIXA'} • ${pattern.confidence}%`}
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
        className={`group/pattern relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold transition-all duration-200 cursor-pointer select-none ${theme.badgeBg} ${theme.badgeBorder} ${theme.badgeText} ${theme.accentGlow} hover:scale-[1.02] active:scale-95`}
      >
        {/* Pulsing indicator if ready for breakout */}
        {isReady && (
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.chipColor}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${theme.chipColor}`} />
          </span>
        )}

        {/* Icon */}
        <span className="shrink-0">
          {pattern.type.includes('FLAG') ? (
            <Flag className="w-3 h-3 text-current" />
          ) : pattern.type.includes('WEDGE') || pattern.type.includes('TRIANGLE') ? (
            <Zap className="w-3 h-3 text-current" />
          ) : isBullish ? (
            <TrendingUp className="w-3 h-3 text-current" />
          ) : (
            <TrendingDown className="w-3 h-3 text-current" />
          )}
        </span>

        {/* Short Name */}
        <span className="tracking-tight truncate max-w-[110px] sm:max-w-[130px]">
          {pattern.shortName}
        </span>

        {/* Confidence chip or Target */}
        {!compact && (
          <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 border border-white/10 font-black opacity-90">
            {pattern.confidence}%
          </span>
        )}

        {isReady && (
          <span className="hidden sm:inline-block text-[8px] uppercase tracking-wider font-extrabold px-1 py-0.2 rounded bg-white/10 text-white">
            BREAKOUT
          </span>
        )}
      </div>
    </Tooltip>
  );
};
