import React, { useState, useMemo } from 'react';
import { Flame, Sliders, Info, RotateCcw, TrendingUp, TrendingDown, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { TickerData } from '../types';
import { formatPrice } from '../utils/formatters';
import { ChartDataItem } from './OrderflowIndicators';
import { Tooltip } from './Tooltip';

interface FibonacciCardProps {
  ticker: TickerData;
  timeframe: string;
  slicedData?: ChartDataItem[];
  chartData?: ChartDataItem[];
  onFibLevelsChange?: (fibLevels: {
    fib0: number;
    fib236: number;
    fib382: number;
    fib50: number;
    fib618: number;
    fib68: number;
    fib786: number;
    fib100: number;
    swingHigh: number;
    swingLow: number;
    inGoldenPocket: boolean;
    trend: 'UP' | 'DOWN';
    point1Price: number;
    point0Price: number;
    point1Label: string;
    point0Label: string;
    point1Type: 'HH' | 'LL';
    point0Type: 'HH' | 'LL';
  }) => void;
}

export interface FibRangeCustom {
  mode: 'auto_chart' | 'auto_bot' | 'custom';
  swingHigh: number;
  swingLow: number;
  trend: 'auto' | 'bullish' | 'bearish';
}

export const FibonacciCard: React.FC<FibonacciCardProps> = ({
  ticker,
  timeframe,
  slicedData = [],
  chartData = [],
  onFibLevelsChange
}) => {
  const currentPrice = ticker.price ?? 0;

  // Dynamic swing calculation respecting strict left-to-right (Point 1 before Point 0) chronology
  const swings = useMemo(() => {
    const data = slicedData.length > 0 ? slicedData : chartData;
    if (!data.length) {
      const defHigh = ticker.high24h || currentPrice * 1.05;
      const defLow = ticker.low24h || currentPrice * 0.95;
      return {
        candlesCount: 0,
        auto: {
          trend: 'DOWN' as const,
          point1Price: defHigh,
          point0Price: defLow,
          point1Type: 'HH' as const,
          point0Type: 'LL' as const,
          high: defHigh,
          low: defLow
        },
        down: {
          trend: 'DOWN' as const,
          point1Price: defHigh,
          point0Price: defLow,
          point1Type: 'HH' as const,
          point0Type: 'LL' as const,
          high: defHigh,
          low: defLow
        },
        up: {
          trend: 'UP' as const,
          point1Price: defLow,
          point0Price: defHigh,
          point1Type: 'LL' as const,
          point0Type: 'HH' as const,
          high: defHigh,
          low: defLow
        }
      };
    }

    let globalHigh = -Infinity;
    let globalLow = Infinity;
    let hhIndex = -1;
    let llIndex = -1;

    data.forEach((d, idx) => {
      if (d.high > globalHigh) {
        globalHigh = d.high;
        hhIndex = idx;
      }
      if (d.low < globalLow) {
        globalLow = d.low;
        llIndex = idx;
      }
    });

    const isGlobalDown = hhIndex < llIndex;

    // 1. Auto swing: uses the dominant global chronological direction
    const autoSwing = isGlobalDown
      ? {
          trend: 'DOWN' as const,
          point1Price: globalHigh,
          point0Price: globalLow,
          point1Type: 'HH' as const,
          point0Type: 'LL' as const,
          high: globalHigh,
          low: globalLow
        }
      : {
          trend: 'UP' as const,
          point1Price: globalLow,
          point0Price: globalHigh,
          point1Type: 'LL' as const,
          point0Type: 'HH' as const,
          high: globalHigh,
          low: globalLow
        };

    // 2. Strict Downtrend swing (HH 1 -> LL 0 where Point 1 index < Point 0 index in time)
    let downSwing = autoSwing;
    if (isGlobalDown) {
      downSwing = autoSwing;
    } else {
      // hhIndex > llIndex (Global Low occurred before Global High)
      // To ensure Point 1 occurred BEFORE Point 0:
      // Candidate A: Highest High before Global Low (0 .. llIndex - 1) -> Low at llIndex
      let bestBeforeHigh = -Infinity;
      let bestBeforeHighIdx = -1;
      for (let i = 0; i < llIndex; i++) {
        if (data[i].high > bestBeforeHigh) {
          bestBeforeHigh = data[i].high;
          bestBeforeHighIdx = i;
        }
      }
      const diffA = bestBeforeHighIdx >= 0 ? bestBeforeHigh - globalLow : -1;

      // Candidate B: High at hhIndex -> Lowest Low after Global High (hhIndex + 1 .. N - 1)
      let bestAfterLow = Infinity;
      let bestAfterLowIdx = -1;
      for (let i = hhIndex + 1; i < data.length; i++) {
        if (data[i].low < bestAfterLow) {
          bestAfterLow = data[i].low;
          bestAfterLowIdx = i;
        }
      }
      const diffB = bestAfterLowIdx >= 0 ? globalHigh - bestAfterLow : -1;

      if (diffB >= diffA && diffB > 0) {
        downSwing = {
          trend: 'DOWN' as const,
          point1Price: globalHigh,
          point0Price: bestAfterLow,
          point1Type: 'HH' as const,
          point0Type: 'LL' as const,
          high: globalHigh,
          low: bestAfterLow
        };
      } else if (diffA > 0) {
        downSwing = {
          trend: 'DOWN' as const,
          point1Price: bestBeforeHigh,
          point0Price: globalLow,
          point1Type: 'HH' as const,
          point0Type: 'LL' as const,
          high: bestBeforeHigh,
          low: globalLow
        };
      } else {
        downSwing = {
          trend: 'DOWN' as const,
          point1Price: globalHigh,
          point0Price: globalLow,
          point1Type: 'HH' as const,
          point0Type: 'LL' as const,
          high: globalHigh,
          low: globalLow
        };
      }
    }

    // 3. Strict Uptrend swing (LL 1 -> HH 0 where Point 1 index < Point 0 index in time)
    let upSwing = autoSwing;
    if (!isGlobalDown) {
      upSwing = autoSwing;
    } else {
      // hhIndex < llIndex (Global High occurred before Global Low)
      // To ensure Point 1 occurred BEFORE Point 0:
      // Candidate A: Lowest Low before Global High (0 .. hhIndex - 1) -> High at hhIndex
      let bestBeforeLow = Infinity;
      let bestBeforeLowIdx = -1;
      for (let i = 0; i < hhIndex; i++) {
        if (data[i].low < bestBeforeLow) {
          bestBeforeLow = data[i].low;
          bestBeforeLowIdx = i;
        }
      }
      const diffA = bestBeforeLowIdx >= 0 ? globalHigh - bestBeforeLow : -1;

      // Candidate B: Low at llIndex -> Highest High after Global Low (llIndex + 1 .. N - 1)
      let bestAfterHigh = -Infinity;
      let bestAfterHighIdx = -1;
      for (let i = llIndex + 1; i < data.length; i++) {
        if (data[i].high > bestAfterHigh) {
          bestAfterHigh = data[i].high;
          bestAfterHighIdx = i;
        }
      }
      const diffB = bestAfterHighIdx >= 0 ? bestAfterHigh - globalLow : -1;

      if (diffB >= diffA && diffB > 0) {
        upSwing = {
          trend: 'UP' as const,
          point1Price: globalLow,
          point0Price: bestAfterHigh,
          point1Type: 'LL' as const,
          point0Type: 'HH' as const,
          high: bestAfterHigh,
          low: globalLow
        };
      } else if (diffA > 0) {
        upSwing = {
          trend: 'UP' as const,
          point1Price: bestBeforeLow,
          point0Price: globalHigh,
          point1Type: 'LL' as const,
          point0Type: 'HH' as const,
          high: globalHigh,
          low: bestBeforeLow
        };
      } else {
        upSwing = {
          trend: 'UP' as const,
          point1Price: globalLow,
          point0Price: globalHigh,
          point1Type: 'LL' as const,
          point0Type: 'HH' as const,
          high: globalHigh,
          low: globalLow
        };
      }
    }

    return {
      candlesCount: data.length,
      auto: autoSwing,
      down: downSwing,
      up: upSwing
    };
  }, [slicedData, chartData, ticker.high24h, ticker.low24h, currentPrice]);

  // Auto high/low from bot default (ticker.fibonacci)
  const autoBotExtremes = useMemo(() => {
    const high = ticker.fibonacci?.swingHigh || ticker.high24h || currentPrice * 1.05;
    const low = ticker.fibonacci?.swingLow || ticker.low24h || currentPrice * 0.95;
    const trend = ticker.fibonacci?.trend || ((ticker.priceChangePercent24h ?? 0) >= 0 ? 'UP' : 'DOWN');
    return {
      high,
      low,
      trend,
      point1Price: ticker.fibonacci?.point1Price || (trend === 'DOWN' ? high : low),
      point0Price: ticker.fibonacci?.point0Price || (trend === 'DOWN' ? low : high),
      point1Type: (trend === 'DOWN' ? 'HH' : 'LL') as 'HH' | 'LL',
      point0Type: (trend === 'DOWN' ? 'LL' : 'HH') as 'HH' | 'LL'
    };
  }, [ticker.fibonacci, ticker.high24h, ticker.low24h, ticker.priceChangePercent24h, currentPrice]);

  // Mode state: 'chart' (auto chart visible), 'bot' (bot 24h default), 'custom' (user custom inputs)
  const [fibMode, setFibMode] = useState<'chart' | 'bot' | 'custom'>('chart');
  
  // Custom inputs state: Point 1 (Início) and Point 0 (Fim)
  const [customP1Str, setCustomP1Str] = useState<string>('');
  const [customP0Str, setCustomP0Str] = useState<string>('');
  const [isCustomEditing, setIsCustomEditing] = useState<boolean>(false);

  // Direction: 'auto' (TradingView HH/LL chronology), 'up' (LL 1 -> HH 0), 'down' (HH 1 -> LL 0)
  const [fiboDirection, setFiboDirection] = useState<'auto' | 'up' | 'down'>('auto');

  // Collapsible Accordion state for Fibonacci Levels Table (compact by default to harmonize card heights)
  const [isLevelsOpen, setIsLevelsOpen] = useState<boolean>(false);

  // Selected swing configuration depending on mode and direction
  const selectedSwing = useMemo(() => {
    if (fibMode === 'custom') {
      const p1 = parseFloat(customP1Str);
      const p0 = parseFloat(customP0Str);
      const chartDef = swings.auto;
      const validP1 = !isNaN(p1) && p1 > 0 ? p1 : chartDef.point1Price;
      const validP0 = !isNaN(p0) && p0 > 0 ? p0 : chartDef.point0Price;

      // In Custom mode: Point 1 is always prior in time to Point 0.
      // If P1 > P0: Downtrend (1 is HH Top, 0 is LL Bottom). Retracement moves 0 -> 1 upwards.
      // If P1 < P0: Uptrend (1 is LL Bottom, 0 is HH Top). Retracement moves 0 -> 1 downwards.
      if (validP1 >= validP0) {
        return {
          trend: 'DOWN' as const,
          point1Price: validP1,
          point0Price: validP0,
          point1Type: 'HH' as const,
          point0Type: 'LL' as const,
          high: validP1,
          low: validP0,
          isCustom: true
        };
      } else {
        return {
          trend: 'UP' as const,
          point1Price: validP1,
          point0Price: validP0,
          point1Type: 'LL' as const,
          point0Type: 'HH' as const,
          high: validP0,
          low: validP1,
          isCustom: true
        };
      }
    }

    if (fibMode === 'bot') {
      if (fiboDirection === 'down') {
        return {
          trend: 'DOWN' as const,
          point1Price: autoBotExtremes.high,
          point0Price: autoBotExtremes.low,
          point1Type: 'HH' as const,
          point0Type: 'LL' as const,
          high: autoBotExtremes.high,
          low: autoBotExtremes.low,
          isCustom: false
        };
      }
      if (fiboDirection === 'up') {
        return {
          trend: 'UP' as const,
          point1Price: autoBotExtremes.low,
          point0Price: autoBotExtremes.high,
          point1Type: 'LL' as const,
          point0Type: 'HH' as const,
          high: autoBotExtremes.high,
          low: autoBotExtremes.low,
          isCustom: false
        };
      }
      return {
        trend: autoBotExtremes.trend,
        point1Price: autoBotExtremes.point1Price,
        point0Price: autoBotExtremes.point0Price,
        point1Type: autoBotExtremes.point1Type,
        point0Type: autoBotExtremes.point0Type,
        high: autoBotExtremes.high,
        low: autoBotExtremes.low,
        isCustom: false
      };
    }

    // Default 'chart' mode
    if (fiboDirection === 'down') {
      return { ...swings.down, isCustom: false };
    }
    if (fiboDirection === 'up') {
      return { ...swings.up, isCustom: false };
    }
    return { ...swings.auto, isCustom: false };
  }, [fibMode, fiboDirection, customP1Str, customP0Str, swings, autoBotExtremes]);

  const isUpTrend = selectedSwing.trend === 'UP';

  // Calculate full Fibonacci levels strictly per TradingView specifications:
  // - Downtrend: Swing High / HH is point 1, Swing Low / LL is point 0. Retracement moves 0 -> 1 upwards.
  // - Uptrend: Swing Low / LL is point 1, Swing High / HH is point 0. Retracement moves 0 -> 1 downwards.
  const fibMetrics = useMemo(() => {
    const { high, low, point1Price, point0Price, point1Type, point0Type, trend } = selectedSwing;
    const diff = high - low;
    if (diff <= 0) {
      return {
        swingHigh: high,
        swingLow: low,
        diff: 0,
        trend,
        point1Price,
        point0Price,
        point1Type,
        point0Type,
        fib0: high,
        fib236: high,
        fib382: high,
        fib50: high,
        fib618: high,
        fib68: high,
        fib786: high,
        fib100: low,
        goldenPocketTop: high,
        goldenPocketBottom: low,
        inGoldenPocket: false,
        goldenPocketDistancePct: 0
      };
    }

    let f0 = 0;
    let f236 = 0;
    let f382 = 0;
    let f50 = 0;
    let f618 = 0;
    let f68 = 0;
    let f786 = 0;
    let f100 = 0;

    if (trend === 'DOWN') {
      // --- DOWNTREND (Tendência de Baixa) ---
      // Impulso foi de cima para baixo (Point 1 HH -> Point 0 LL)
      // Retração / Repique sobe a partir de 0 (LL) em direção a 1 (HH):
      f0 = point0Price;                       // 0.0% = Fim da queda (LL)
      f236 = point0Price + diff * 0.236;
      f382 = point0Price + diff * 0.382;
      f50 = point0Price + diff * 0.50;
      f618 = point0Price + diff * 0.618;      // Golden Pocket (ex: 729.66 no TradingView)
      f68 = point0Price + diff * 0.68;        // Golden Pocket (ex: 731.32 no TradingView)
      f786 = point0Price + diff * 0.786;
      f100 = point1Price;                     // 100.0% = Início da queda (HH)
    } else {
      // --- UPTREND (Tendência de Alta) ---
      // Impulso foi de baixo para cima (Point 1 LL -> Point 0 HH)
      // Retração / Pullback desce a partir de 0 (HH) em direção a 1 (LL):
      f0 = point0Price;                       // 0.0% = Fim da alta (HH)
      f236 = point0Price - diff * 0.236;
      f382 = point0Price - diff * 0.382;
      f50 = point0Price - diff * 0.50;
      f618 = point0Price - diff * 0.618;      // Golden Pocket (ex: 718.98 no TradingView)
      f68 = point0Price - diff * 0.68;        // Golden Pocket (ex: 718.03 no TradingView)
      f786 = point0Price - diff * 0.786;
      f100 = point1Price;                     // 100.0% = Início da alta (LL)
    }

    const goldenTop = Math.max(f618, f68);
    const goldenBottom = Math.min(f618, f68);
    const inGoldenPocket = currentPrice >= goldenBottom * 0.998 && currentPrice <= goldenTop * 1.002;

    const goldenCenter = (goldenTop + goldenBottom) / 2;
    const goldenDistPct = currentPrice ? ((currentPrice - goldenCenter) / goldenCenter) * 100 : 0;

    return {
      swingHigh: high,
      swingLow: low,
      diff,
      trend,
      point1Price,
      point0Price,
      point1Type,
      point0Type,
      fib0: f0,
      fib236: f236,
      fib382: f382,
      fib50: f50,
      fib618: f618,
      fib68: f68,
      fib786: f786,
      fib100: f100,
      goldenPocketTop: goldenTop,
      goldenPocketBottom: goldenBottom,
      inGoldenPocket,
      goldenPocketDistancePct: goldenDistPct
    };
  }, [selectedSwing, currentPrice]);

  React.useEffect(() => {
    if (onFibLevelsChange) {
      onFibLevelsChange({
        fib0: fibMetrics.fib0,
        fib236: fibMetrics.fib236,
        fib382: fibMetrics.fib382,
        fib50: fibMetrics.fib50,
        fib618: fibMetrics.fib618,
        fib68: fibMetrics.fib68,
        fib786: fibMetrics.fib786,
        fib100: fibMetrics.fib100,
        swingHigh: fibMetrics.swingHigh,
        swingLow: fibMetrics.swingLow,
        inGoldenPocket: fibMetrics.inGoldenPocket,
        trend: fibMetrics.trend,
        point1Price: fibMetrics.point1Price,
        point0Price: fibMetrics.point0Price,
        point1Label: `1 (${formatPrice(fibMetrics.point1Price)})`,
        point0Label: `0 (${formatPrice(fibMetrics.point0Price)})`,
        point1Type: fibMetrics.point1Type,
        point0Type: fibMetrics.point0Type
      });
    }
  }, [fibMetrics, onFibLevelsChange]);

  // Synchronize custom inputs when switching to custom mode
  const handleSelectCustomMode = () => {
    setCustomP1Str(selectedSwing.point1Price.toString());
    setCustomP0Str(selectedSwing.point0Price.toString());
    setFibMode('custom');
    setIsCustomEditing(true);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCustomEditing(false);
  };

  const handleResetCustom = () => {
    const def = swings.auto;
    setCustomP1Str(def.point1Price.toString());
    setCustomP0Str(def.point0Price.toString());
  };

  // Distance from current price to a given fib level
  const getDistancePct = (targetPrice: number) => {
    if (!currentPrice || !targetPrice) return null;
    return ((currentPrice - targetPrice) / targetPrice) * 100;
  };

  // Levels for display table ordered from Highest Price to Lowest Price (matching the chart visually)
  const levels = useMemo(() => {
    if (!isUpTrend) {
      // DOWNTREND (Baixa): 1 (HH) no topo -> 0 (LL) no fundo
      return [
        { ratio: '1.000', label: `1 • ${fibMetrics.point1Type} (Início do Swing)`, price: fibMetrics.fib100, color: 'text-white font-bold', isKey: true, isEndpoint: true },
        { ratio: '0.786', label: '0.786 (Defesa Superior)', price: fibMetrics.fib786, color: 'text-purple-400', isKey: false },
        { ratio: '0.680', label: '0.68 (Golden Pocket)', price: fibMetrics.fib68, color: 'text-white font-extrabold', isKey: true, highlight: true },
        { ratio: '0.618', label: '0.618 (Golden Pocket)', price: fibMetrics.fib618, color: 'text-yellow-400 font-black', isKey: true, highlight: true },
        { ratio: '0.500', label: '0.50 (Equilíbrio / Meio)', price: fibMetrics.fib50, color: 'text-cyan-400 font-bold', isKey: true },
        { ratio: '0.382', label: '0.382 (Primeiro Repique)', price: fibMetrics.fib382, color: 'text-blue-400', isKey: true },
        { ratio: '0.236', label: '0.236 (Retração Rasa)', price: fibMetrics.fib236, color: 'text-neutral-400', isKey: false },
        { ratio: '0.000', label: `0 • ${fibMetrics.point0Type} (Fim do Swing)`, price: fibMetrics.fib0, color: 'text-white font-bold', isKey: true, isEndpoint: true },
      ];
    } else {
      // UPTREND (Alta): 0 (HH) no topo -> 1 (LL) no fundo
      return [
        { ratio: '0.000', label: `0 • ${fibMetrics.point0Type} (Fim do Swing)`, price: fibMetrics.fib0, color: 'text-white font-bold', isKey: true, isEndpoint: true },
        { ratio: '0.236', label: '0.236 (Retração Rasa)', price: fibMetrics.fib236, color: 'text-neutral-400', isKey: false },
        { ratio: '0.382', label: '0.382 (Primeiro Suporte)', price: fibMetrics.fib382, color: 'text-blue-400', isKey: true },
        { ratio: '0.500', label: '0.50 (Equilíbrio / Meio)', price: fibMetrics.fib50, color: 'text-cyan-400 font-bold', isKey: true },
        { ratio: '0.618', label: '0.618 (Golden Pocket)', price: fibMetrics.fib618, color: 'text-yellow-400 font-black', isKey: true, highlight: true },
        { ratio: '0.680', label: '0.68 (Golden Pocket)', price: fibMetrics.fib68, color: 'text-white font-extrabold', isKey: true, highlight: true },
        { ratio: '0.786', label: '0.786 (Última Defesa)', price: fibMetrics.fib786, color: 'text-purple-400', isKey: false },
        { ratio: '1.000', label: `1 • ${fibMetrics.point1Type} (Início do Swing)`, price: fibMetrics.fib100, color: 'text-white font-bold', isKey: true, isEndpoint: true },
      ];
    }
  }, [isUpTrend, fibMetrics]);

  return (
    <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-3 font-mono flex flex-col justify-between">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">
              Retração de Fibonacci & Golden Pocket
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30">
              {timeframe.toUpperCase()}
            </span>
            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border flex items-center gap-1 ${
              fibMetrics.trend === 'DOWN'
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
            }`}>
              {fibMetrics.trend === 'DOWN' ? 'Baixa: HH 1 ➔ LL 0' : 'Alta: LL 1 ➔ HH 0'}
            </span>
            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border flex items-center gap-1 ${
              fibMetrics.inGoldenPocket
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 animate-pulse font-extrabold'
                : 'bg-neutral-900 text-neutral-400 border-white/10'
            }`}>
              {fibMetrics.inGoldenPocket ? '🔥 No Golden Pocket' : 'Fora da Zona'}
            </span>
          </div>
        </div>

      {/* Mode Switcher: Gráfico (Visível) vs Bot (24h) vs Personalizado */}
      <div className="grid grid-cols-3 gap-1 bg-[#050505] p-1 rounded border border-white/10 text-[10px]">
        <button
          type="button"
          onClick={() => { setFibMode('chart'); setIsCustomEditing(false); }}
          className={`py-1 px-1.5 rounded font-bold transition flex items-center justify-center gap-1 truncate ${
            fibMode === 'chart'
              ? 'bg-orange-500 text-black shadow font-black'
              : 'text-neutral-400 hover:text-white'
          }`}
          title={`Calcula Fibonacci com base nas velas visíveis no gráfico de ${timeframe}`}
        >
          Gráfico ({swings.candlesCount}v • {timeframe})
        </button>

        <button
          type="button"
          onClick={() => { setFibMode('bot'); setIsCustomEditing(false); }}
          className={`py-1 px-1.5 rounded font-bold transition flex items-center justify-center gap-1 truncate ${
            fibMode === 'bot'
              ? 'bg-orange-500 text-black shadow'
              : 'text-neutral-400 hover:text-white'
          }`}
          title="Calcula Fibonacci com base no swing padrão do motor do bot (24h)"
        >
          Bot (24h)
        </button>

        <button
          type="button"
          onClick={handleSelectCustomMode}
          className={`py-1 px-1.5 rounded font-bold transition flex items-center justify-center gap-1 truncate ${
            fibMode === 'custom'
              ? 'bg-orange-500 text-black shadow'
              : 'text-neutral-400 hover:text-white'
          }`}
          title="Permite definir manualmente o Ponto Inicial [1] e Ponto Final [0] para recalcular a Fibonacci cronologicamente"
        >
          <Sliders className="h-3 w-3 shrink-0" />
          Customizar
        </button>
      </div>

      {/* Direction Switcher (TradingView Rule: 1 é Início, 0 é Fim) */}
      <div className="flex items-center justify-between text-[10px] bg-[#050505] px-2 py-1.5 rounded border border-white/5">
        <span className="text-neutral-400 flex items-center gap-1">
          <Info className="h-3 w-3 text-orange-400" /> Estrutura:
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFiboDirection('auto')}
            className={`px-1.5 py-0.5 rounded font-bold ${
              fiboDirection === 'auto' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'text-neutral-500 hover:text-white'
            }`}
            title="Auto detecta se o swing dominante é Baixa (HH 1 -> LL 0) ou Alta (LL 1 -> HH 0)"
          >
            Auto ({isUpTrend ? 'Alta' : 'Baixa'})
          </button>
          <button
            type="button"
            onClick={() => setFiboDirection('down')}
            className={`px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 ${
              fiboDirection === 'down' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-neutral-500 hover:text-white'
            }`}
            title="Tendência de Baixa: Topo HH (1) até Fundo LL (0) cronologicamente anterior"
          >
            <TrendingDown className="h-3 w-3" /> Baixa (HH 1→LL 0)
          </button>
          <button
            type="button"
            onClick={() => setFiboDirection('up')}
            className={`px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 ${
              fiboDirection === 'up' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-500 hover:text-white'
            }`}
            title="Tendência de Alta: Fundo LL (1) até Topo HH (0) cronologicamente anterior"
          >
            <TrendingUp className="h-3 w-3" /> Alta (LL 1→HH 0)
          </button>
        </div>
      </div>

      {/* Custom Inputs Panel (if custom mode active) */}
      {fibMode === 'custom' && (
        <form onSubmit={handleApplyCustom} className="p-2.5 bg-[#050505] rounded border border-orange-500/30 space-y-2 text-xs">
          <div className="flex items-center justify-between text-[10px] text-orange-400 font-bold uppercase">
            <span>Definir Níveis Cronológicos [1] ➔ [0]:</span>
            <button
              type="button"
              onClick={handleResetCustom}
              className="text-neutral-400 hover:text-white flex items-center gap-1 normal-case"
              title="Restaurar valores automáticos do gráfico"
            >
              <RotateCcw className="h-3 w-3" /> Restaurar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-neutral-400 block mb-0.5">Ponto Inicial [1]:</label>
              <input
                type="number"
                step="any"
                value={customP1Str}
                onChange={(e) => setCustomP1Str(e.target.value)}
                placeholder="Ex: Topo (Baixa) ou Fundo (Alta)"
                className="w-full bg-neutral-900 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-400 block mb-0.5">Ponto Final [0]:</label>
              <input
                type="number"
                step="any"
                value={customP0Str}
                onChange={(e) => setCustomP0Str(e.target.value)}
                placeholder="Ex: Fundo (Baixa) ou Topo (Alta)"
                className="w-full bg-neutral-900 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-neutral-500">
              Amplitude: {formatPrice(Math.abs(parseFloat(customP1Str) - parseFloat(customP0Str)) || 0, { currency: true })}
            </span>
            <button
              type="submit"
              className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-black text-[10px] font-black rounded transition flex items-center gap-1"
            >
              <Check className="h-3 w-3" /> Recalcular Fibo
            </button>
          </div>
        </form>
      )}

      {/* Scope Details Info Box */}
      <div className="bg-[#050505] p-2.5 rounded border border-white/5 space-y-1.5 text-[10px] font-mono text-neutral-400">
        <div className="flex justify-between items-center text-neutral-300">
          <span className="flex items-center gap-1">
            <Info className="h-3 w-3 text-orange-400" />
            Origem do Range:
          </span>
          <span className="font-bold text-white">
            {fibMode === 'chart' && `Gráfico Visível (${swings.candlesCount} velas • ${timeframe})`}
            {fibMode === 'bot' && `Range Padrão do Bot (24h)`}
            {fibMode === 'custom' && `Personalizado pelo Usuário`}
          </span>
        </div>

        {/* Dynamic Point 1 and Point 0 Mapping */}
        <div className="grid grid-cols-2 gap-2 bg-[#0A0A0A] p-1.5 rounded border border-white/5 text-[9.5px]">
          <div className="space-y-0.5">
            <span className="text-neutral-500 font-bold uppercase block">Ponto Inicial [1]:</span>
            <div className="flex items-center gap-1">
              <span className="px-1 py-0.2 rounded bg-white/10 text-white font-black text-[9px]">
                {fibMetrics.point1Type}
              </span>
              <span className="text-white font-extrabold">{formatPrice(fibMetrics.point1Price, { currency: true })}</span>
            </div>
          </div>
          <div className="space-y-0.5 text-right">
            <span className="text-neutral-500 font-bold uppercase block">Ponto Final [0]:</span>
            <div className="flex items-center justify-end gap-1">
              <span className="px-1 py-0.2 rounded bg-white/10 text-white font-black text-[9px]">
                {fibMetrics.point0Type}
              </span>
              <span className="text-white font-extrabold">{formatPrice(fibMetrics.point0Price, { currency: true })}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center border-t border-white/5 pt-1">
          <span>Zona Golden Pocket (0.618 - 0.68):</span>
          <span className="text-orange-400 font-extrabold">
            {formatPrice(fibMetrics.goldenPocketBottom, { currency: true })} – {formatPrice(fibMetrics.goldenPocketTop, { currency: true })}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span>Distância do Preço até Golden Pocket:</span>
          <span className={`font-bold ${Math.abs(fibMetrics.goldenPocketDistancePct) <= 0.5 ? 'text-orange-400' : 'text-neutral-300'}`}>
            {fibMetrics.goldenPocketDistancePct >= 0 ? '+' : ''}{fibMetrics.goldenPocketDistancePct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Key Golden Pocket Highlight Box */}
      <Tooltip
        position="left"
        title="Zona Áurea Institucional"
        badge="0.618 - 0.68"
        content="Nível matemático de retração onde robôs HFT e algoritmos institucionais acumulam posições com a melhor relação risco:retorno do swing."
      >
        <div className={`p-2.5 rounded border transition-all cursor-help ${
          fibMetrics.inGoldenPocket
            ? 'bg-orange-500/15 border-orange-500/50 text-orange-300 shadow-lg shadow-orange-500/10'
            : 'bg-[#050505] border-white/5 text-neutral-400'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-extrabold flex items-center gap-1.5 text-white">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              Golden Pocket (0.618 - 0.68)
            </span>
            <span className="text-[10px] font-black text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
              Alvo de Entrada Ótima
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-neutral-400">Faixa de Atração:</span>
            <span className="font-extrabold text-orange-400">
              {formatPrice(fibMetrics.goldenPocketBottom, { currency: true })} ~ {formatPrice(fibMetrics.goldenPocketTop, { currency: true })}
            </span>
          </div>
        </div>
      </Tooltip>

      </div>

      {/* Collapsible Accordion: Níveis & Ratios de Fibonacci */}
      <div className="pt-2 border-t border-white/5 space-y-1.5 mt-2.5">
        <button
          type="button"
          onClick={() => setIsLevelsOpen(!isLevelsOpen)}
          className="w-full flex items-center justify-between p-2 rounded bg-[#050505] hover:bg-[#111111] border border-white/5 transition text-xs font-mono group cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-neutral-300 font-bold uppercase group-hover:text-white transition">
              Nível / Ratio • Cotação & Distância
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-neutral-400 font-bold border border-white/5">
              8 níveis
            </span>
          </div>
          <div className="flex items-center gap-1 text-neutral-400 group-hover:text-white">
            <span className="text-[10px] text-neutral-500 font-sans">
              {isLevelsOpen ? 'Recolher' : 'Expandir'}
            </span>
            {isLevelsOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-orange-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-neutral-400 group-hover:text-orange-400" />
            )}
          </div>
        </button>

        {isLevelsOpen && (
          <div className="space-y-1 text-xs font-mono pt-1">
            <div className="text-[10px] text-neutral-500 font-bold uppercase px-1 pb-0.5 flex justify-between">
              <span>Nível / Ratio</span>
              <span>Cotação & Distância</span>
            </div>

            {levels.map((lvl, idx) => {
              const dist = getDistancePct(lvl.price);
              return (
                <div
                  key={idx}
                  className={`flex justify-between items-center px-2 py-1 rounded border transition ${
                    lvl.highlight
                      ? 'bg-orange-500/10 border-orange-500/30'
                      : lvl.isKey
                      ? 'bg-[#050505] border-white/5'
                      : 'bg-transparent border-transparent opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                      lvl.highlight
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                        : lvl.isEndpoint
                        ? 'bg-white/15 text-white font-black'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      {lvl.ratio}
                    </span>
                    <span className={`text-[10px] font-bold ${lvl.color}`}>{lvl.label}</span>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="font-bold text-neutral-200">{formatPrice(lvl.price, { currency: true })}</span>
                    {dist !== null && (
                      <span className={`text-[9px] w-12 text-right ${
                        Math.abs(dist) < 0.2
                          ? 'text-orange-400 font-black'
                          : dist >= 0
                          ? 'text-emerald-400'
                          : 'text-neutral-400'
                      }`}>
                        {dist >= 0 ? `+${dist.toFixed(1)}%` : `${dist.toFixed(1)}%`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
