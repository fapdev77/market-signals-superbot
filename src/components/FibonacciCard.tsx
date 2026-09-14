import React, { useState, useMemo } from 'react';
import { Flame, Sliders, Info, RotateCcw, TrendingUp, TrendingDown, Check } from 'lucide-react';
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
    fib236: number;
    fib382: number;
    fib50: number;
    fib618: number;
    fib68: number;
    fib786: number;
    swingHigh: number;
    swingLow: number;
    inGoldenPocket: boolean;
  }) => void;
}

export interface FibRangeCustom {
  mode: 'auto_chart' | 'auto_bot' | 'custom';
  swingHigh: number;
  swingLow: number;
  trend: 'auto' | 'bullish' | 'bearish'; // 'bullish' = retração de alta (Low -> High), 'bearish' = retração de baixa (High -> Low)
}

export const FibonacciCard: React.FC<FibonacciCardProps> = ({
  ticker,
  timeframe,
  slicedData = [],
  chartData = [],
  onFibLevelsChange
}) => {
  const currentPrice = ticker.price ?? 0;

  // Auto high/low from slicedData (visible chart)
  const autoChartExtremes = useMemo(() => {
    const data = slicedData.length > 0 ? slicedData : chartData;
    if (!data.length) {
      return {
        high: ticker.high24h || currentPrice * 1.05,
        low: ticker.low24h || currentPrice * 0.95,
        candlesCount: 0
      };
    }
    const high = Math.max(...data.map(d => d.high));
    const low = Math.min(...data.map(d => d.low));
    return { high, low, candlesCount: data.length };
  }, [slicedData, chartData, ticker.high24h, ticker.low24h, currentPrice]);

  // Auto high/low from bot default (ticker.fibonacci)
  const autoBotExtremes = useMemo(() => {
    return {
      high: ticker.fibonacci?.swingHigh || ticker.high24h || currentPrice * 1.05,
      low: ticker.fibonacci?.swingLow || ticker.low24h || currentPrice * 0.95
    };
  }, [ticker.fibonacci, ticker.high24h, ticker.low24h, currentPrice]);

  // Mode state: 'chart' (auto chart visible), 'bot' (bot 24h default), 'custom' (user custom inputs)
  const [fibMode, setFibMode] = useState<'chart' | 'bot' | 'custom'>('chart');
  
  // Custom inputs state
  const [customHighStr, setCustomHighStr] = useState<string>('');
  const [customLowStr, setCustomLowStr] = useState<string>('');
  const [isCustomEditing, setIsCustomEditing] = useState<boolean>(false);

  // Direction: 'auto' (baseado no fechamento vs abertura), 'retracement_bull' (correção da alta), 'retracement_bear' (repique da baixa)
  const [fiboDirection, setFiboDirection] = useState<'auto' | 'up' | 'down'>('auto');

  // Active High and Low based on selected mode
  const activeExtremes = useMemo(() => {
    if (fibMode === 'custom') {
      const parsedH = parseFloat(customHighStr);
      const parsedL = parseFloat(customLowStr);
      const validH = !isNaN(parsedH) && parsedH > 0 ? parsedH : autoChartExtremes.high;
      const validL = !isNaN(parsedL) && parsedL > 0 ? parsedL : autoChartExtremes.low;
      const h = Math.max(validH, validL);
      const l = Math.min(validH, validL);
      return { high: h, low: l, isCustom: true };
    }
    if (fibMode === 'bot') {
      return { high: autoBotExtremes.high, low: autoBotExtremes.low, isCustom: false };
    }
    // Default 'chart'
    return { high: autoChartExtremes.high, low: autoChartExtremes.low, isCustom: false };
  }, [fibMode, customHighStr, customLowStr, autoChartExtremes, autoBotExtremes]);

  // Auto detect trend from visible candles if 'auto' direction
  const isUpTrend = useMemo(() => {
    if (fiboDirection === 'up') return true;
    if (fiboDirection === 'down') return false;

    // Auto detection
    const data = slicedData.length > 0 ? slicedData : chartData;
    if (data.length >= 2) {
      const first = data[0].open;
      const last = data[data.length - 1].close;
      return last >= first;
    }
    return (ticker.priceChangePercent24h ?? 0) >= 0;
  }, [fiboDirection, slicedData, chartData, ticker.priceChangePercent24h]);

  // Calculate full Fibonacci levels
  const fibMetrics = useMemo(() => {
    const { high, low } = activeExtremes;
    const diff = high - low;
    if (diff <= 0) {
      return {
        swingHigh: high,
        swingLow: low,
        diff: 0,
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

    // Classic Fibonacci Retracements
    // When measuring retracement of an UP move (Swing Low -> Swing High):
    // 0% is at Top (High), 100% is at Bottom (Low). Pullback levels are High - diff * ratio.
    // When measuring retracement of a DOWN move (Swing High -> Swing Low):
    // 0% is at Bottom (Low), 100% is at Top (High). Bounce levels are Low + diff * ratio.
    let f0 = high;
    let f236 = high - diff * 0.236;
    let f382 = high - diff * 0.382;
    let f50 = high - diff * 0.50;
    let f618 = high - diff * 0.618;
    let f68 = high - diff * 0.68;
    let f786 = high - diff * 0.786;
    let f100 = low;

    if (!isUpTrend) {
      // Down move retracement (bounce levels upwards from low)
      f0 = low;
      f236 = low + diff * 0.236;
      f382 = low + diff * 0.382;
      f50 = low + diff * 0.50;
      f618 = low + diff * 0.618;
      f68 = low + diff * 0.68;
      f786 = low + diff * 0.786;
      f100 = high;
    }

    const goldenTop = Math.max(f618, f68);
    const goldenBottom = Math.min(f618, f68);
    const inGoldenPocket = currentPrice >= goldenBottom * 0.998 && currentPrice <= goldenTop * 1.002;

    const goldenCenter = (goldenTop + goldenBottom) / 2;
    const goldenDistPct = currentPrice ? ((currentPrice - goldenCenter) / goldenCenter) * 100 : 0;

    const res = {
      swingHigh: high,
      swingLow: low,
      diff,
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

    return res;
  }, [activeExtremes, isUpTrend, currentPrice]);

  React.useEffect(() => {
    if (onFibLevelsChange) {
      onFibLevelsChange({
        fib236: fibMetrics.fib236,
        fib382: fibMetrics.fib382,
        fib50: fibMetrics.fib50,
        fib618: fibMetrics.fib618,
        fib68: fibMetrics.fib68,
        fib786: fibMetrics.fib786,
        swingHigh: fibMetrics.swingHigh,
        swingLow: fibMetrics.swingLow,
        inGoldenPocket: fibMetrics.inGoldenPocket
      });
    }
  }, [fibMetrics, onFibLevelsChange]);

  // Synchronize custom inputs when switching to custom mode
  const handleSelectCustomMode = () => {
    setCustomHighStr(activeExtremes.high.toString());
    setCustomLowStr(activeExtremes.low.toString());
    setFibMode('custom');
    setIsCustomEditing(true);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCustomEditing(false);
  };

  const handleResetCustom = () => {
    setCustomHighStr(autoChartExtremes.high.toString());
    setCustomLowStr(autoChartExtremes.low.toString());
  };

  // Distance from current price to a given fib level
  const getDistancePct = (targetPrice: number) => {
    if (!currentPrice || !targetPrice) return null;
    return ((currentPrice - targetPrice) / targetPrice) * 100;
  };

  // Levels for display table
  const levels = [
    { label: '0.0% (Extremo)', price: fibMetrics.fib0, color: 'text-neutral-400', isKey: false },
    { label: '0.236 (Retração Rasa)', price: fibMetrics.fib236, color: 'text-neutral-300', isKey: false },
    { label: '0.382 (Primeiro Suporte/Resistência)', price: fibMetrics.fib382, color: 'text-blue-400', isKey: true },
    { label: '0.50 (Equilíbrio / Meio)', price: fibMetrics.fib50, color: 'text-cyan-400', isKey: true },
    { label: '0.618 (Golden Pocket)', price: fibMetrics.fib618, color: 'text-orange-400 font-extrabold', isKey: true, highlight: true },
    { label: '0.680 (Golden Pocket Ext)', price: fibMetrics.fib68, color: 'text-orange-500 font-extrabold', isKey: true, highlight: true },
    { label: '0.786 (Última Defesa)', price: fibMetrics.fib786, color: 'text-purple-400', isKey: true },
    { label: '100.0% (Invalidação/Origem)', price: fibMetrics.fib100, color: 'text-neutral-400', isKey: false },
  ];

  return (
    <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-3 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wide">
            Retração de Fibonacci & Golden Pocket
          </h3>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border flex items-center gap-1 ${
          fibMetrics.inGoldenPocket
            ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 animate-pulse font-extrabold'
            : 'bg-neutral-900 text-neutral-400 border-white/10'
        }`}>
          {fibMetrics.inGoldenPocket ? '🔥 No Golden Pocket' : 'Fora da Zona'}
        </span>
      </div>

      {/* Mode Switcher: Gráfico (Visível) vs Bot (24h) vs Personalizado */}
      <div className="grid grid-cols-3 gap-1 bg-[#050505] p-1 rounded border border-white/10 text-[10px]">
        <button
          type="button"
          onClick={() => { setFibMode('chart'); setIsCustomEditing(false); }}
          className={`py-1 px-1.5 rounded font-bold transition flex items-center justify-center gap-1 truncate ${
            fibMode === 'chart'
              ? 'bg-orange-500 text-black shadow'
              : 'text-neutral-400 hover:text-white'
          }`}
          title="Calcula Fibonacci com base nas velas visíveis no gráfico atual"
        >
          Gráfico ({autoChartExtremes.candlesCount}v)
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
          title="Permite definir manualmente o Topo (Swing High) e Fundo (Swing Low) para recalcular a Fibonacci"
        >
          <Sliders className="h-3 w-3 shrink-0" />
          Customizar
        </button>
      </div>

      {/* Direction Switcher (Opcional: Retração de Alta ou Retração de Baixa) */}
      <div className="flex items-center justify-between text-[10px] bg-[#050505] px-2 py-1.5 rounded border border-white/5">
        <span className="text-neutral-400 flex items-center gap-1">
          <Info className="h-3 w-3 text-orange-400" /> Direção do Swing:
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFiboDirection('auto')}
            className={`px-1.5 py-0.5 rounded font-bold ${
              fiboDirection === 'auto' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'text-neutral-500 hover:text-white'
            }`}
          >
            Auto ({isUpTrend ? 'Bull' : 'Bear'})
          </button>
          <button
            type="button"
            onClick={() => setFiboDirection('up')}
            className={`px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 ${
              fiboDirection === 'up' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-500 hover:text-white'
            }`}
            title="Retração de Alta (Pullback de Onda Compradora: Fundo -> Topo)"
          >
            <TrendingUp className="h-3 w-3" /> Alta (Low→High)
          </button>
          <button
            type="button"
            onClick={() => setFiboDirection('down')}
            className={`px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 ${
              fiboDirection === 'down' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-neutral-500 hover:text-white'
            }`}
            title="Retração de Baixa (Repique de Onda Vendedora: Topo -> Fundo)"
          >
            <TrendingDown className="h-3 w-3" /> Baixa (High→Low)
          </button>
        </div>
      </div>

      {/* Custom Inputs Panel (if custom mode active) */}
      {fibMode === 'custom' && (
        <form onSubmit={handleApplyCustom} className="p-2.5 bg-[#050505] rounded border border-orange-500/30 space-y-2 text-xs">
          <div className="flex items-center justify-between text-[10px] text-orange-400 font-bold uppercase">
            <span>Definir Níveis de Topo e Fundo (Range):</span>
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
              <label className="text-[10px] text-neutral-400 block mb-0.5">Swing High (Topo):</label>
              <input
                type="number"
                step="any"
                value={customHighStr}
                onChange={(e) => setCustomHighStr(e.target.value)}
                placeholder="Ex: 94500"
                className="w-full bg-neutral-900 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-400 block mb-0.5">Swing Low (Fundo):</label>
              <input
                type="number"
                step="any"
                value={customLowStr}
                onChange={(e) => setCustomLowStr(e.target.value)}
                placeholder="Ex: 91200"
                className="w-full bg-neutral-900 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-neutral-500">
              Amplitude: {formatPrice(Math.abs(parseFloat(customHighStr) - parseFloat(customLowStr)) || 0, { currency: true })}
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
      <div className="bg-[#050505] p-2.5 rounded border border-white/5 space-y-1 text-[10px] font-mono text-neutral-400">
        <div className="flex justify-between items-center text-neutral-300">
          <span className="flex items-center gap-1">
            <Info className="h-3 w-3 text-orange-400" />
            Origem do Range:
          </span>
          <span className="font-bold text-white">
            {fibMode === 'chart' && `Gráfico Visível (${autoChartExtremes.candlesCount} velas • ${timeframe})`}
            {fibMode === 'bot' && `Range Padrão do Bot (24h)`}
            {fibMode === 'custom' && `Personalizado pelo Usuário`}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span>Swing High (Topo):</span>
          <span className="text-neutral-200 font-bold">{formatPrice(fibMetrics.swingHigh, { currency: true })}</span>
        </div>

        <div className="flex justify-between items-center">
          <span>Swing Low (Fundo):</span>
          <span className="text-neutral-200 font-bold">{formatPrice(fibMetrics.swingLow, { currency: true })}</span>
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

      {/* Fibonacci Retracement Levels Table */}
      <div className="space-y-1 text-xs font-mono">
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
    </div>
  );
};
