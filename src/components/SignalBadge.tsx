import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface SignalBadgeProps {
  type?: 'LONG' | 'SHORT' | 'NEUTRAL' | string;
  score?: number;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const SignalBadge: React.FC<SignalBadgeProps> = ({
  type = 'NEUTRAL',
  score,
  showIcon = true,
  size = 'md',
  className = '',
}) => {
  const normalized = (type || 'NEUTRAL').toUpperCase();
  const isLong = normalized === 'LONG';
  const isShort = normalized === 'SHORT';

  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5 font-bold',
    md: 'text-[10px] px-2 py-0.5 font-bold',
    lg: 'text-xs px-2.5 py-1 font-bold',
  }[size];

  const colorClasses = isLong
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : isShort
    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
    : 'bg-neutral-800/60 text-neutral-400 border-neutral-700/40';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-mono tracking-wider ${sizeClasses} ${colorClasses} ${className}`}
      aria-label={`Sinal: ${normalized}${score !== undefined ? `, Confluência: ${score}` : ''}`}
    >
      {showIcon && (
        <>
          {isLong && <ArrowUpRight className="w-3 h-3 shrink-0" />}
          {isShort && <ArrowDownRight className="w-3 h-3 shrink-0" />}
          {!isLong && !isShort && <Minus className="w-3 h-3 shrink-0 opacity-60" />}
        </>
      )}
      <span>{normalized}</span>
      {score !== undefined && (
        <span className="opacity-75 font-normal ml-0.5">({score})</span>
      )}
    </span>
  );
};
