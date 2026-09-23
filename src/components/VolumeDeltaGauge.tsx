import React from 'react';
import { Zap, TrendingUp, TrendingDown, Scale, ShieldAlert, Activity, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { VolumeProfileResult } from '../utils/volumeProfileUtils';
import { formatCompactNumber, formatPrice } from '../utils/formatters';
import { Tooltip } from './Tooltip';

export interface VolumeDeltaGaugeProps {
  volumeProfile: VolumeProfileResult | null;
  baseAsset?: string;
  timeframe?: string;
  currentPrice?: number;
  className?: string;
  compact?: boolean;
}

export const VolumeDeltaGauge: React.FC<VolumeDeltaGaugeProps> = ({
  volumeProfile,
  baseAsset = 'ATIVO',
  timeframe = '15m',
  currentPrice = 0,
  className = '',
  compact = false
}) => {
  if (!volumeProfile) {
    return (
      <div className={`bg-[#0A0A0A] p-3 rounded-xl border border-white/10 text-neutral-400 text-xs font-mono flex items-center justify-center gap-2 ${className}`}>
        <Activity className="h-4 w-4 animate-spin text-orange-400" />
        <span>Calculando Volume Delta da Sessão...</span>
      </div>
    );
  }

  const {
    sessionDelta,
    sessionDeltaUSD,
    takerBuyRatio,
    totalBuyVolume,
    totalSellVolume,
    totalBuyUSD,
    totalSellUSD,
    totalVolume,
    pressureState,
    pressureScore,
    candleCount
  } = volumeProfile;

  const buyPercent = (takerBuyRatio * 100);
  const sellPercent = (100 - buyPercent);
  const isPositiveDelta = sessionDelta >= 0;

  // Gauge needle rotation angle (-90deg at 100% sell to +90deg at 100% buy, 0deg at 50/50)
  // pressureScore is -100 to +100
  const needleRotation = (pressureScore / 100) * 82; // clamped between -82° and +82°

  // Status mapping
  const statusConfig = {
    STRONG_BUY: {
      label: 'Forte Pressão Compradora',
      shortLabel: 'Super Buy Delta',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      glowColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/30',
      icon: TrendingUp,
      desc: 'Agressões agressivas a mercado no ask dominando o livro e absorvendo liquidez passiva.'
    },
    BUY: {
      label: 'Pressão Compradora Moderada',
      shortLabel: 'Buy Dominance',
      badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      glowColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/20',
      icon: ArrowUpRight,
      desc: 'Compradores ativos a mercado com delta positivo e sustentação de preço.'
    },
    NEUTRAL: {
      label: 'Equilíbrio Institucional / Neutro',
      shortLabel: 'Delta Equilibrado',
      badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      glowColor: 'text-cyan-400',
      borderColor: 'border-white/10',
      icon: Scale,
      desc: 'Volume de compra e venda nivelado, range em consolidação ou preparação de rompimento.'
    },
    SELL: {
      label: 'Pressão Vendedora Moderada',
      shortLabel: 'Sell Dominance',
      badgeColor: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      glowColor: 'text-rose-400',
      borderColor: 'border-rose-500/20',
      icon: ArrowDownRight,
      desc: 'Vendedores ativos batendo a mercado no bid com saldo de delta negativo.'
    },
    STRONG_SELL: {
      label: 'Forte Pressão Vendedora',
      shortLabel: 'Super Sell Delta',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      glowColor: 'text-rose-400',
      borderColor: 'border-rose-500/30',
      icon: TrendingDown,
      desc: 'Despejo contínuo a mercado com delta vendedor intenso e risco de liquidação em cascata.'
    }
  }[pressureState];

  const StatusIcon = statusConfig.icon;

  if (compact) {
    return (
      <div className={`bg-[#0A0A0A] p-3 rounded-xl border ${statusConfig.borderColor} font-mono space-y-2 shadow-lg ${className}`}>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Zap className={`h-3.5 w-3.5 ${statusConfig.glowColor}`} />
            <span className="font-bold text-white text-[11px] uppercase tracking-wider">Volume Delta</span>
          </div>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase border ${statusConfig.badgeColor}`}>
            {statusConfig.shortLabel}
          </span>
        </div>

        {/* Linear Delta Bar */}
        <div className="space-y-1">
          <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden flex border border-white/5">
            <div
              className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full transition-all duration-500"
              style={{ width: `${buyPercent}%` }}
              title={`Compra Taker: ${buyPercent.toFixed(1)}%`}
            />
            <div
              className="bg-gradient-to-r from-rose-500 to-rose-700 h-full transition-all duration-500"
              style={{ width: `${sellPercent}%` }}
              title={`Venda Taker: ${sellPercent.toFixed(1)}%`}
            />
          </div>
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-emerald-400">{buyPercent.toFixed(1)}% Compras</span>
            <span className={isPositiveDelta ? 'text-emerald-300' : 'text-rose-300'}>
              Δ {isPositiveDelta ? '+' : ''}${formatCompactNumber(sessionDeltaUSD)}
            </span>
            <span className="text-rose-400">{sellPercent.toFixed(1)}% Vendas</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#0A0A0A] p-4 rounded-xl border border-white/10 font-mono shadow-xl space-y-3.5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 ${statusConfig.glowColor}`}>
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Volume Delta & Order Flow Gauge</h4>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-900 text-neutral-400 border border-white/5">
                {candleCount} velas • {timeframe}
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">Medidor de Agressão Real-Time Taker Buy vs Sell na Sessão</p>
          </div>
        </div>

        <Tooltip
          position="left"
          title={statusConfig.label}
          badge={`DELTA SCORE ${pressureScore.toFixed(0)}`}
          content={statusConfig.desc}
        >
          <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-extrabold uppercase flex items-center gap-1.5 cursor-help ${statusConfig.badgeColor}`}>
            <StatusIcon className="h-3 w-3" />
            <span>{statusConfig.shortLabel}</span>
          </div>
        </Tooltip>
      </div>

      {/* Main Gauge Visual + Central Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* SVG Semi-Circular Gauge (5 cols) */}
        <div className="md:col-span-5 flex flex-col items-center justify-center relative py-1">
          <svg viewBox="0 0 200 120" className="w-48 max-w-full overflow-visible">
            <defs>
              {/* Arc Gradients */}
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="35%" stopColor="#fb7185" />
                <stop offset="50%" stopColor="#94a3b8" />
                <stop offset="65%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>

              {/* Shadow Filter for needle */}
              <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#f97316" floodOpacity="0.4" />
              </filter>
            </defs>

            {/* Background Track Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#1f2937"
              strokeWidth="14"
              strokeLinecap="round"
            />

            {/* Colored Metric Gradient Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray="251.2"
              strokeDashoffset="0"
            />

            {/* Minor Tick Marks */}
            {[-75, -50, -25, 0, 25, 50, 75].map(deg => {
              const rad = (deg - 90) * (Math.PI / 180);
              const x1 = 100 + 88 * Math.cos(rad);
              const y1 = 100 + 88 * Math.sin(rad);
              const x2 = 100 + 94 * Math.cos(rad);
              const y2 = 100 + 94 * Math.sin(rad);
              return (
                <line
                  key={deg}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#525252"
                  strokeWidth={deg === 0 ? "2" : "1"}
                />
              );
            })}

            {/* Center Reference Mark (0 Delta Equilibrium) */}
            <circle cx="100" cy="18" r="2" fill="#38bdf8" />

            {/* Animated Needle Group */}
            <g transform={`rotate(${needleRotation}, 100, 100)`} className="transition-transform duration-700 ease-out">
              {/* Needle Body */}
              <polygon
                points="96,100 104,100 101,22 99,22"
                fill={isPositiveDelta ? '#10b981' : '#f43f5e'}
                stroke="#ffffff"
                strokeWidth="1"
                filter="url(#gaugeGlow)"
              />
              <circle cx="100" cy="100" r="7" fill="#ffffff" />
              <circle cx="100" cy="100" r="4" fill="#0f172a" />
            </g>

            {/* Bottom Scale Labels */}
            <text x="15" y="116" fill="#f43f5e" fontSize="9" fontWeight="bold" textAnchor="start">
              -100% SELL
            </text>
            <text x="100" y="116" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">
              EQUILÍBRIO
            </text>
            <text x="185" y="116" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="end">
              +100% BUY
            </text>
          </svg>

          {/* Real-time Imbalance Percentage Center */}
          <div className="text-center mt-[-6px]">
            <span className={`text-base font-black ${isPositiveDelta ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositiveDelta ? '+' : ''}{pressureScore.toFixed(1)}%
            </span>
            <span className="text-[9px] text-neutral-400 block font-normal">Score de Pressão Líquida</span>
          </div>
        </div>

        {/* Detailed Breakdown Panels (7 cols) */}
        <div className="md:col-span-7 space-y-2.5">
          {/* Main Net Session Delta Highlight */}
          <div className="bg-[#050505] p-3 rounded-lg border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">Delta Líquido da Sessão (Net Flow)</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className={`text-lg font-black ${isPositiveDelta ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isPositiveDelta ? '+' : ''}{formatCompactNumber(sessionDelta)} {baseAsset}
                </span>
                <span className={`text-xs font-bold ${isPositiveDelta ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ({isPositiveDelta ? '+' : ''}${formatCompactNumber(sessionDeltaUSD)})
                </span>
              </div>
            </div>
            <div className={`p-2 rounded-lg border ${statusConfig.badgeColor}`}>
              <StatusIcon className="h-5 w-5" />
            </div>
          </div>

          {/* Buy vs Sell Volume Comparative Breakdown */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Taker Buy Volume */}
            <div className="bg-emerald-500/5 p-2.5 rounded-lg border border-emerald-500/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-400 font-bold uppercase flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" /> Taker Buy
                </span>
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded border border-emerald-500/30">
                  {buyPercent.toFixed(1)}%
                </span>
              </div>
              <div className="font-extrabold text-white text-xs">
                {formatCompactNumber(totalBuyVolume)} {baseAsset}
              </div>
              <div className="text-[10px] text-neutral-400 font-mono">
                ${formatCompactNumber(totalBuyUSD)}
              </div>
            </div>

            {/* Taker Sell Volume */}
            <div className="bg-rose-500/5 p-2.5 rounded-lg border border-rose-500/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-rose-400 font-bold uppercase flex items-center gap-1">
                  <ArrowDownRight className="h-3 w-3" /> Taker Sell
                </span>
                <span className="text-[10px] font-black text-rose-400 bg-rose-500/20 px-1.5 py-0.2 rounded border border-rose-500/30">
                  {sellPercent.toFixed(1)}%
                </span>
              </div>
              <div className="font-extrabold text-white text-xs">
                {formatCompactNumber(totalSellVolume)} {baseAsset}
              </div>
              <div className="text-[10px] text-neutral-400 font-mono">
                ${formatCompactNumber(totalSellUSD)}
              </div>
            </div>
          </div>

          {/* Dual Balance Progress Bar */}
          <div className="space-y-1">
            <div className="h-2.5 w-full bg-neutral-900 rounded-full overflow-hidden flex border border-white/5 shadow-inner">
              <div
                className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 h-full transition-all duration-500"
                style={{ width: `${buyPercent}%` }}
                title={`Agressão Compradora: ${buyPercent.toFixed(1)}%`}
              />
              <div
                className="bg-gradient-to-r from-rose-400 via-rose-500 to-rose-600 h-full transition-all duration-500"
                style={{ width: `${sellPercent}%` }}
                title={`Agressão Vendedora: ${sellPercent.toFixed(1)}%`}
              />
            </div>
            <div className="flex justify-between text-[9px] text-neutral-400 font-bold">
              <span className="text-emerald-400">Total Comprador: ${formatCompactNumber(totalBuyUSD)}</span>
              <span className="text-rose-400">Total Vendedor: ${formatCompactNumber(totalSellUSD)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
