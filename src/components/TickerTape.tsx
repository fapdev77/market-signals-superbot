import React, { useState } from 'react';
import { TickerData } from '../types';
import { formatPrice, formatPercent } from '../utils/formatters';
import { getVolumeSpikesMap } from '../utils/volumeScreenerUtils';
import { Flame, Activity, TrendingUp, TrendingDown, Pause, Play, ChevronRight } from 'lucide-react';

interface TickerTapeProps {
  tickers: TickerData[];
  onSelectTicker: (ticker: TickerData) => void;
}

export const TickerTape: React.FC<TickerTapeProps> = ({ tickers, onSelectTicker }) => {
  const [isPaused, setIsPaused] = useState(false);

  const spikesMap = React.useMemo(() => {
    return getVolumeSpikesMap(tickers, 1.75);
  }, [tickers]);

  if (!tickers || tickers.length === 0) return null;

  // Duplicate the list so it scrolls infinitely without gaps
  const tapeList = [...tickers, ...tickers];

  return (
    <div className="bg-[#050608] border-b border-white/10 text-xs font-mono select-none relative overflow-hidden flex items-center h-8 z-30">
      {/* Live Label & Pause Control */}
      <div className="bg-[#0D0E12] px-2.5 h-full flex items-center gap-1.5 border-r border-white/10 z-10 shrink-0 text-[10px] font-black uppercase text-amber-400">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        <span className="hidden sm:inline">LIVE TAPE</span>
        <button
          type="button"
          onClick={() => setIsPaused(prev => !prev)}
          className="text-neutral-500 hover:text-white transition cursor-pointer p-0.5"
          title={isPaused ? 'Retomar fita' : 'Pausar fita'}
        >
          {isPaused ? <Play className="w-2.5 h-2.5 text-emerald-400" /> : <Pause className="w-2.5 h-2.5" />}
        </button>
      </div>

      {/* Scrolling Track */}
      <div className="flex items-center overflow-x-hidden whitespace-nowrap w-full group/tape">
        <div
          className="flex items-center gap-4 animate-marquee group-hover/tape:[animation-play-state:paused]"
          style={{
            animationDuration: '165s',
            ...(isPaused ? { animationPlayState: 'paused' } : {}),
          }}
        >
          {tapeList.map((t, idx) => {
            const spike = spikesMap.get(t.symbol);
            const isPositive = (t.priceChangePercent24h || 0) >= 0;

            return (
              <div
                key={`${t.symbol}_${idx}`}
                onClick={() => onSelectTicker(t)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelectTicker(t)}
                className="inline-flex items-center gap-2 px-2 py-1 rounded hover:bg-white/10 hover:ring-1 hover:ring-white/20 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <span className="font-extrabold text-white text-[11px] flex items-center gap-1">
                  {t.symbol}
                </span>

                <span className="font-bold text-neutral-300 text-[11px] tabular-nums">
                  {formatPrice(t.price, { currency: true })}
                </span>

                <span className={`text-[10px] font-bold tabular-nums flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isPositive ? '+' : ''}{formatPercent(t.priceChangePercent24h || 0)}
                </span>

                {/* Volume Spike Tag if active */}
                {spike && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                    <Flame className="w-2.5 h-2.5 text-amber-400" />
                    VOL {spike.maxRvol}x
                  </span>
                )}

                <span className="text-neutral-700 font-normal">|</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

