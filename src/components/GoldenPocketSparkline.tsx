import React from 'react';
import { CheckCircle2, TrendingUp, Award } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { GoldenPocketOutcomesChart } from './GoldenPocketOutcomesChart';

export interface GoldenPocketStats {
  symbol: string;
  totalAlerts: number;
  profitableCount: number;
  stoppedCount: number;
  activeCount: number;
  winRate: number;
  recentOutcomes: Array<{
    profitable: boolean;
    pnlPct: number;
    timestamp: number;
  }>;
}

interface GoldenPocketSparklineProps {
  stats: GoldenPocketStats;
  compact?: boolean;
}

export const GoldenPocketSparkline: React.FC<GoldenPocketSparklineProps> = ({ stats, compact = false }) => {
  const { totalAlerts, profitableCount, winRate, recentOutcomes } = stats;

  // Mini sparkline SVG coordinates (width 70, height 22)
  const width = 72;
  const height = 22;
  const padding = 3;

  // Compute points from cumulative equity/outcomes
  const points = recentOutcomes.slice(-8); // last 8 trades
  let cumulative = 0;
  const dataSeries: number[] = [0];
  points.forEach(p => {
    cumulative += p.profitable ? Math.max(1.2, p.pnlPct) : Math.min(-0.8, p.pnlPct);
    dataSeries.push(cumulative);
  });

  const minVal = Math.min(...dataSeries);
  const maxVal = Math.max(...dataSeries);
  const range = maxVal - minVal || 1;

  const polyPoints = dataSeries.map((val, idx) => {
    const x = padding + (idx / (dataSeries.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - ((val - minVal) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const isNetPositive = winRate >= 50;
  const lineColor = isNetPositive ? '#10b981' : '#f43f5e';
  const fillColor = isNetPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';

  const areaPoints = `${padding},${height - padding} ${polyPoints} ${width - padding},${height - padding}`;

  return (
    <Tooltip
      position="bottom"
      title={`Estatísticas Golden Pocket: ${stats.symbol}`}
      badge={`${winRate}% HIT-RATE`}
      content={
        <div className="space-y-2 text-xs">
          <p className="text-neutral-300">
            Histórico recente de alertas Golden Pocket (Fibo 0.618 - 0.68) para <strong>{stats.symbol}</strong>.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
            <div>
              <span className="text-neutral-400 block text-[10px]">Trades com Lucro</span>
              <span className="text-emerald-400 font-bold">{profitableCount} de {totalAlerts}</span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[10px]">Assertividade</span>
              <span className="text-white font-bold">{winRate}%</span>
            </div>
          </div>

          {/* D3-based Bar Chart visualizing the distribution of gains and losses */}
          <div className="pt-2 border-t border-white/10">
            <GoldenPocketOutcomesChart
              symbol={stats.symbol}
              outcomes={recentOutcomes.slice(-8)}
              width={250}
              height={100}
            />
          </div>
        </div>
      }
    >
      <div className="inline-flex items-center gap-2 bg-[#050505]/80 hover:bg-[#111] px-2.5 py-1 rounded-xl border border-amber-500/30 transition cursor-pointer select-none">
        {/* Sparkline curve */}
        <div className="flex items-center">
          <svg width={width} height={height} className="overflow-visible">
            <defs>
              <linearGradient id={`grad-${stats.symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity="0.4" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <polygon points={areaPoints} fill={`url(#grad-${stats.symbol})`} />
            <polyline
              points={polyPoints}
              fill="none"
              stroke={lineColor}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* End glowing marker point */}
            {dataSeries.length > 0 && (
              <circle
                cx={(padding + (width - padding * 2)).toFixed(1)}
                cy={(height - padding - ((dataSeries[dataSeries.length - 1] - minVal) / range) * (height - padding * 2)).toFixed(1)}
                r="2.5"
                fill={lineColor}
              />
            )}
          </svg>
        </div>

        {/* Success count pill */}
        <div className="flex flex-col items-start leading-none">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            <span className="text-[11px] font-black text-emerald-400 font-mono">
              {profitableCount}/{totalAlerts}
            </span>
            <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
              WINS
            </span>
          </div>
          <span className="text-[9px] text-amber-300 font-semibold font-mono mt-0.5">
            {winRate}% assertivo
          </span>
        </div>
      </div>
    </Tooltip>
  );
};
