import React, { useState } from 'react';
import { Layers, Target, Activity, Flame, Sliders, Info, Eye, EyeOff, Sparkles, ArrowRight } from 'lucide-react';
import { VolumeProfileResult, VolumeProfileBin } from '../utils/volumeProfileUtils';
import { formatPrice, formatCompactNumber } from '../utils/formatters';
import { Tooltip } from './Tooltip';

export interface VolumeProfileVisualizationProps {
  volumeProfile: VolumeProfileResult | null;
  currentPrice: number;
  baseAsset?: string;
  className?: string;
  showControls?: boolean;
}

export const VolumeProfileVisualization: React.FC<VolumeProfileVisualizationProps> = ({
  volumeProfile,
  currentPrice,
  baseAsset = 'ATIVO',
  className = '',
  showControls = true
}) => {
  const [hoveredBin, setHoveredBin] = useState<VolumeProfileBin | null>(null);
  const [colorMode, setColorMode] = useState<'delta' | 'total' | 'heatmap'>('delta');
  const [filterValueAreaOnly, setFilterValueAreaOnly] = useState<boolean>(false);

  if (!volumeProfile || !volumeProfile.bins || volumeProfile.bins.length === 0) {
    return (
      <div className={`bg-[#0A0A0A] p-4 rounded-xl border border-white/10 text-neutral-400 text-xs font-mono flex items-center justify-center gap-2 ${className}`}>
        <Activity className="h-4 w-4 animate-spin text-cyan-400" />
        <span>Calculando distribuição de Volume Profile...</span>
      </div>
    );
  }

  const {
    bins,
    poc,
    vah,
    val,
    totalVolume,
    totalUSD,
    sessionDelta,
    sessionDeltaUSD,
    maxBinVolume,
    candleCount,
    hvnLevels,
    lvnLevels
  } = volumeProfile;

  // Reorder bins descending by price (highest price on top, lowest price on bottom)
  const sortedBins = [...bins].sort((a, b) => b.price - a.price);
  const visibleBins = filterValueAreaOnly ? sortedBins.filter(b => b.isInValueArea) : sortedBins;

  return (
    <div className={`bg-[#0A0A0A] p-4 rounded-xl border border-white/10 font-mono shadow-xl space-y-3 ${className}`}>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Volume Profile (Distribuição por Preço)
              </h4>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                {bins.length} NÍVEIS
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">
              Distribuição horizontal de liquidez com Point of Control (POC) e Value Area (70%)
            </p>
          </div>
        </div>

        {showControls && (
          <div className="flex items-center gap-1.5 text-[10px]">
            {/* Color Mode Selector */}
            <div className="flex items-center bg-[#050505] p-0.5 rounded border border-white/10">
              <button
                type="button"
                onClick={() => setColorMode('delta')}
                className={`px-2 py-0.5 rounded font-bold transition ${
                  colorMode === 'delta' ? 'bg-cyan-500 text-black shadow' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Buy/Sell Delta
              </button>
              <button
                type="button"
                onClick={() => setColorMode('total')}
                className={`px-2 py-0.5 rounded font-bold transition ${
                  colorMode === 'total' ? 'bg-cyan-500 text-black shadow' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Volume Total
              </button>
            </div>

            {/* Filter VA Only */}
            <button
              type="button"
              onClick={() => setFilterValueAreaOnly(!filterValueAreaOnly)}
              className={`px-2 py-1 rounded border font-bold transition flex items-center gap-1 ${
                filterValueAreaOnly
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                  : 'bg-[#050505] text-neutral-400 border-white/10 hover:text-white'
              }`}
            >
              <Target className="h-3 w-3" />
              <span>VA 70%</span>
            </button>
          </div>
        )}
      </div>

      {/* Key Volume Profile Boundaries Bar */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {/* VAH */}
        <div className="bg-[#050505] p-2 rounded-lg border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[9px] text-neutral-400 font-bold uppercase block">VAH (Teto 70%)</span>
            <span className="font-extrabold text-white text-xs">{formatPrice(vah, { currency: true })}</span>
          </div>
          <span className="text-[9px] px-1 py-0.2 rounded bg-white/5 text-neutral-300 border border-white/10">
            Resistência
          </span>
        </div>

        {/* POC */}
        <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/30 flex items-center justify-between">
          <div>
            <span className="text-[9px] text-cyan-400 font-bold uppercase block">POC (Ponto de Controle)</span>
            <span className="font-black text-cyan-300 text-xs">{formatPrice(poc, { currency: true })}</span>
          </div>
          <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
            Ímã Institucional
          </span>
        </div>

        {/* VAL */}
        <div className="bg-[#050505] p-2 rounded-lg border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[9px] text-neutral-400 font-bold uppercase block">VAL (Piso 70%)</span>
            <span className="font-extrabold text-white text-xs">{formatPrice(val, { currency: true })}</span>
          </div>
          <span className="text-[9px] px-1 py-0.2 rounded bg-white/5 text-neutral-300 border border-white/10">
            Suporte
          </span>
        </div>
      </div>

      {/* Interactive Horizontal Histogram Distribution */}
      <div className="bg-[#050505] p-3 rounded-lg border border-white/5 relative overflow-hidden space-y-1">
        <div className="max-h-[300px] overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-neutral-800">
          {visibleBins.map((bin, idx) => {
            const isCurrentPriceInBin = currentPrice >= bin.priceLow && currentPrice <= bin.priceHigh;
            const isHovered = hoveredBin?.price === bin.price;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredBin(bin)}
                onMouseLeave={() => setHoveredBin(null)}
                className={`relative flex items-center gap-2 py-0.5 px-1.5 rounded transition-all text-[10px] cursor-pointer group ${
                  bin.isPOC
                    ? 'bg-cyan-500/15 border border-cyan-500/40 ring-1 ring-cyan-500/30'
                    : isCurrentPriceInBin
                    ? 'bg-orange-500/15 border border-orange-500/40'
                    : bin.isInValueArea
                    ? 'bg-neutral-900/60 border border-white/5'
                    : 'opacity-60 hover:opacity-100 hover:bg-white/5 border border-transparent'
                }`}
              >
                {/* Price Level Tag */}
                <div className="w-24 shrink-0 flex items-center justify-between font-mono">
                  <span className={`font-bold ${
                    bin.isPOC 
                      ? 'text-cyan-300 font-black' 
                      : isCurrentPriceInBin 
                      ? 'text-orange-400 font-extrabold' 
                      : bin.isInValueArea 
                      ? 'text-neutral-200' 
                      : 'text-neutral-400'
                  }`}>
                    {formatPrice(bin.price)}
                  </span>
                  {bin.isPOC && (
                    <span className="text-[8px] bg-cyan-400 text-black px-1 rounded font-black uppercase">
                      POC
                    </span>
                  )}
                  {isCurrentPriceInBin && !bin.isPOC && (
                    <span className="text-[8px] bg-orange-500 text-black px-1 rounded font-black uppercase animate-pulse">
                      NOW
                    </span>
                  )}
                  {bin.isHVN && !bin.isPOC && !isCurrentPriceInBin && (
                    <span className="text-[8px] text-amber-400 font-mono font-bold">
                      HVN
                    </span>
                  )}
                </div>

                {/* Horizontal Volume Bar Container */}
                <div className="flex-1 h-3 bg-neutral-950 rounded overflow-hidden flex items-center border border-white/5 relative">
                  {colorMode === 'delta' ? (
                    // Split Buy Volume (Green) and Sell Volume (Red)
                    <div className="h-full w-full flex items-center">
                      <div
                        className={`h-full transition-all duration-300 ${
                          bin.isPOC ? 'bg-cyan-400' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${(bin.widthPercent * (bin.buyPercent / 100)).toFixed(1)}%` }}
                        title={`Buy Vol: ${formatCompactNumber(bin.buyVolume)} (${bin.buyPercent.toFixed(0)}%)`}
                      />
                      <div
                        className={`h-full transition-all duration-300 ${
                          bin.isPOC ? 'bg-cyan-600' : 'bg-rose-500'
                        }`}
                        style={{ width: `${(bin.widthPercent * (bin.sellPercent / 100)).toFixed(1)}%` }}
                        title={`Sell Vol: ${formatCompactNumber(bin.sellVolume)} (${bin.sellPercent.toFixed(0)}%)`}
                      />
                    </div>
                  ) : (
                    // Total Volume Bar
                    <div
                      className={`h-full transition-all duration-300 ${
                        bin.isPOC
                          ? 'bg-cyan-400 shadow-md'
                          : bin.isInValueArea
                          ? 'bg-cyan-600/80'
                          : 'bg-neutral-600'
                      }`}
                      style={{ width: `${bin.widthPercent.toFixed(1)}%` }}
                    />
                  )}

                  {/* Value Area Marker line */}
                  {bin.isInValueArea && (
                    <div className="absolute inset-0 border-y border-cyan-500/20 pointer-events-none" />
                  )}
                </div>

                {/* Volume & Delta Value */}
                <div className="w-20 shrink-0 text-right font-mono text-[9px]">
                  <span className="text-neutral-300 font-bold block">
                    {formatCompactNumber(bin.totalVolume)}
                  </span>
                  <span className={`text-[8.5px] font-bold ${bin.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {bin.delta >= 0 ? '+' : ''}{formatCompactNumber(bin.delta)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hover Inspector Tooltip Panel */}
        {hoveredBin ? (
          <div className="mt-2 p-2 rounded bg-neutral-900 border border-cyan-500/30 text-xs flex flex-wrap items-center justify-between gap-2 animate-fade-in">
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400 text-[10px]">Faixa:</span>
              <span className="font-extrabold text-white">
                {formatPrice(hoveredBin.priceLow)} – {formatPrice(hoveredBin.priceHigh)}
              </span>
              {hoveredBin.isPOC && (
                <span className="px-1 py-0.2 rounded bg-cyan-400 text-black text-[9px] font-black uppercase">
                  Point of Control
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[10px]">
              <div>
                <span className="text-neutral-400">Total: </span>
                <span className="font-bold text-white">
                  {formatCompactNumber(hoveredBin.totalVolume)} {baseAsset} (${formatCompactNumber(hoveredBin.totalUSD)})
                </span>
              </div>
              <div className="text-emerald-400">
                <span>Compra: </span>
                <span className="font-bold">{hoveredBin.buyPercent.toFixed(1)}%</span>
              </div>
              <div className="text-rose-400">
                <span>Venda: </span>
                <span className="font-bold">{hoveredBin.sellPercent.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-neutral-400">Delta: </span>
                <span className={`font-extrabold ${hoveredBin.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {hoveredBin.delta >= 0 ? '+' : ''}${formatCompactNumber(hoveredBin.deltaUSD)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-between text-[9px] text-neutral-400 pt-1 border-t border-white/5">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3 text-cyan-400" />
              Passe o cursor sobre os níveis para inspecionar o delta e volume em cada faixa de preço.
            </span>
            <span className="text-neutral-400">
              Total do Range: <strong className="text-neutral-200">{formatCompactNumber(totalVolume)} {baseAsset}</strong> (${formatCompactNumber(totalUSD)})
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export interface VolumeProfileOverlayOnChartProps {
  volumeProfile: VolumeProfileResult | null;
  domainMin: number;
  domainMax: number;
  priceRange: number;
  visible?: boolean;
  side?: 'right' | 'left';
  widthPercent?: number;
  opacity?: number;
}

/**
 * High-performance on-chart overlay that renders the horizontal volume profile bars
 * directly alongside the price scale inside the Recharts / SVG coordinate space.
 */
export const VolumeProfileOverlayOnChart: React.FC<VolumeProfileOverlayOnChartProps> = ({
  volumeProfile,
  domainMin,
  domainMax,
  priceRange,
  visible = true,
  side = 'right',
  widthPercent = 22,
  opacity = 0.85
}) => {
  if (!visible || !volumeProfile || !volumeProfile.bins.length || priceRange <= 0) {
    return null;
  }

  const { bins, poc, vah, val, maxBinVolume } = volumeProfile;
  const chartHeightPx = 240;

  const getY = (priceVal: number) => {
    const clamped = Math.max(domainMin, Math.min(domainMax, priceVal));
    return 15 + ((domainMax - clamped) / priceRange) * chartHeightPx;
  };

  return (
    <div
      className={`absolute top-0 bottom-0 pointer-events-none z-10 ${
        side === 'right' ? 'right-[75px]' : 'left-[15px]'
      }`}
      style={{
        width: `${widthPercent}%`,
        opacity: opacity
      }}
    >
      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="vpPocGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {bins.map((b, i) => {
          const yTop = getY(b.priceHigh);
          const yBottom = getY(b.priceLow);
          const height = Math.max(2, Math.abs(yBottom - yTop) - 0.5);
          const barWidthPct = maxBinVolume > 0 ? (b.totalVolume / maxBinVolume) * 100 : 0;
          const buyWidthPct = barWidthPct * (b.buyPercent / 100);
          const sellWidthPct = barWidthPct * (b.sellPercent / 100);

          return (
            <g key={i} className="transition-all duration-200">
              {/* Buy Volume Segment */}
              <rect
                x={side === 'right' ? `${100 - barWidthPct}%` : '0%'}
                y={Math.min(yTop, yBottom)}
                width={`${buyWidthPct}%`}
                height={height}
                fill={b.isPOC ? '#06b6d4' : b.isInValueArea ? '#10b981' : '#059669'}
                fillOpacity={b.isPOC ? 0.95 : b.isInValueArea ? 0.75 : 0.35}
                rx={0.5}
              />
              {/* Sell Volume Segment */}
              <rect
                x={side === 'right' ? `${100 - sellWidthPct}%` : `${buyWidthPct}%`}
                y={Math.min(yTop, yBottom)}
                width={`${sellWidthPct}%`}
                height={height}
                fill={b.isPOC ? '#0284c7' : b.isInValueArea ? '#f43f5e' : '#e11d48'}
                fillOpacity={b.isPOC ? 0.95 : b.isInValueArea ? 0.75 : 0.35}
                rx={0.5}
              />
              {/* POC Glow Ray */}
              {b.isPOC && (
                <line
                  x1="0%"
                  y1={yTop + height / 2}
                  x2="100%"
                  y2={yTop + height / 2}
                  stroke="#06b6d4"
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
