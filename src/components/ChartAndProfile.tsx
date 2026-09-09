import React, { useState, useEffect, useMemo } from 'react';
import { TickerData, KlineCandle, TradeSignal, AIReviewResponse, AIModelConfig } from '../types';
import { formatPrice, formatPriceRange, formatPercent, formatCompactNumber, calculateTradeMetrics } from '../utils/formatters';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, BarChart, Bar, CartesianGrid } from 'recharts';
import { LineChart as ChartIcon, Flame, Activity, RefreshCw, Brain, Target, ShieldAlert, Crosshair, Zap, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, ArrowUpRight, Scale, Percent, Cpu, UserCheck } from 'lucide-react';
import { MarketProfileMetrics } from './MarketProfileMetrics';
import { OrderflowIndicators, ChartDataItem } from './OrderflowIndicators';
import { calculateLiquidityHeatmap } from '../utils/heatmapUtils';
import { LiquidityHeatmapReferenceAreas, LiquidityHeatmapBadge } from './LiquidityHeatmapOverlay';
import { DEFAULT_AI_PERSONAS } from '../constants/aiPersonas';

interface ChartAndProfileProps {
  selectedTicker: TickerData | null;
  allTickers: TickerData[];
  onSelectTickerBySymbol: (symbol: string) => void;
  signals?: TradeSignal[];
  activeModels?: AIModelConfig[];
}

export const ChartAndProfile: React.FC<ChartAndProfileProps> = ({
  selectedTicker,
  allTickers = [],
  onSelectTickerBySymbol,
  signals = [],
  activeModels = []
}) => {
  const ticker = selectedTicker || allTickers[0];
  const [klines, setKlines] = useState<KlineCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiReview, setAiReview] = useState<AIReviewResponse | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [timeframe, setTimeframe] = useState('15m');
  const [chartType, setChartType] = useState<'line' | 'candles'>('line');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedPersona, setSelectedPersona] = useState<string>('conservative');
  const [zoomStart, setZoomStart] = useState<number>(0);
  const [zoomEnd, setZoomEnd] = useState<number>(0);
  const [heatmapEnabled, setHeatmapEnabled] = useState<boolean>(true);
  const [heatmapBucketCount, setHeatmapBucketCount] = useState<number>(36);

  const enabledModels = activeModels.filter(m => m.isActive);

  useEffect(() => {
    if (activeModels && activeModels.length > 0) {
      const active = activeModels.find(m => m.isActive) || activeModels[0];
      if (active && !selectedModel) {
        setSelectedModel(active.id);
      }
    }
  }, [activeModels]);
  
  const activeSignal = signals.find(s => s.symbol === ticker?.symbol);

  const botMetrics = activeSignal ? calculateTradeMetrics({
    entry: activeSignal.entryZone,
    stopLoss: activeSignal.stopLoss,
    target1: activeSignal.target1,
    target2: activeSignal.target2,
    direction: activeSignal.direction,
    currentPrice: ticker?.price ?? 0
  }) : null;

  const aiMetrics = aiReview ? calculateTradeMetrics({
    entry: aiReview.entryZone,
    stopLoss: aiReview.stopLoss,
    target1: aiReview.takeProfit1,
    target2: aiReview.takeProfit2,
    direction: aiReview.recommendedDirection,
    currentPrice: ticker?.price ?? 0
  }) : null;

  const handleRunAIReview = async () => {
    if (!ticker) return;
    setLoadingReview(true);
    try {
      const model = selectedModel || activeModels.find(m => m.isActive)?.id || undefined;
      const res = await fetch('/api/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: ticker.symbol, model, personaId: selectedPersona })
      });
      const data: AIReviewResponse = await res.json();
      setAiReview(data);
    } catch (err) {
      console.error('Failed to run AI review:', err);
    } finally {
      setLoadingReview(false);
    }
  };
  
  useEffect(() => {
    setAiReview(null);
  }, [ticker?.symbol]);

  useEffect(() => {
    if (!ticker?.symbol) return;
    setLoading(true);
    fetch(`/api/tickers/${ticker.symbol}?tf=${timeframe}`)
      .then(res => res.json())
      .then(data => {
        if (data.klines) {
          setKlines(data.klines);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [ticker?.symbol, timeframe]);

  if (!ticker) return null;

  const chartData: ChartDataItem[] = useMemo(() => {
    if (!klines.length) return [];
    let currentOI = ticker.openInterest ?? 1000000;
    let currentCVD = ticker.cvd ?? 0;
    
    const data: ChartDataItem[] = klines.map(k => {
      const timeStr = new Date(k.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const delta = k.takerBuyVolume - (k.volume - k.takerBuyVolume);
      return {
        time: timeStr,
        price: k.close,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        takerBuy: k.takerBuyVolume,
        takerSell: k.volume - k.takerBuyVolume,
        delta: delta,
        openInterest: 0,
        cvd: 0
      };
    });

    // Backward accumulate OI and CVD to finish exactly at the current ticker values
    for (let i = data.length - 1; i >= 0; i--) {
      data[i].openInterest = currentOI;
      data[i].cvd = currentCVD;
      const delta = data[i].delta;
      currentOI -= (Math.abs(delta) * (Math.random() * 2 - 0.5));
      currentCVD -= delta;
    }

    return data;
  }, [klines, ticker.openInterest, ticker.cvd]);

  useEffect(() => {
    if (chartData.length > 0) {
      setZoomStart(0);
      setZoomEnd(chartData.length);
    }
  }, [chartData.length, ticker?.symbol, timeframe]);

  const effectiveStart = Math.max(0, Math.min(zoomStart, chartData.length - 2));
  const effectiveEnd = Math.max(effectiveStart + 2, Math.min(zoomEnd, chartData.length));
  
  const slicedData = useMemo(() => {
    return chartData.slice(effectiveStart, effectiveEnd);
  }, [chartData, effectiveStart, effectiveEnd]);

  const handleZoomIn = () => {
    const currentLen = effectiveEnd - effectiveStart;
    if (currentLen <= 5) return;
    const center = Math.floor((effectiveStart + effectiveEnd) / 2);
    const newLen = Math.max(5, Math.floor(currentLen * 0.75));
    const newStart = Math.max(0, center - Math.floor(newLen / 2));
    const newEnd = Math.min(chartData.length, newStart + newLen);
    setZoomStart(newStart);
    setZoomEnd(newEnd);
  };

  const handleZoomOut = () => {
    const currentLen = effectiveEnd - effectiveStart;
    const center = Math.floor((effectiveStart + effectiveEnd) / 2);
    const newLen = Math.min(chartData.length, Math.floor(currentLen * 1.33));
    const newStart = Math.max(0, center - Math.floor(newLen / 2));
    const newEnd = Math.min(chartData.length, newStart + newLen);
    setZoomStart(newStart);
    setZoomEnd(newEnd);
  };

  const handleResetZoom = () => {
    setZoomStart(0);
    setZoomEnd(chartData.length);
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const touchStartDistRef = React.useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const diff = dist - touchStartDistRef.current;
      if (Math.abs(diff) > 25) {
        if (diff > 0) {
          handleZoomIn();
        } else {
          handleZoomOut();
        }
        touchStartDistRef.current = dist;
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
  };

  interface TooltipPropsType {
    active?: boolean;
    payload?: Array<{ payload: ChartDataItem }>;
    label?: string;
  }

  const CustomTooltip: React.FC<TooltipPropsType> = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const isUp = (data.close ?? 0) >= (data.open ?? 0);
    const pct = data.open ? (((data.close - data.open) / data.open) * 100).toFixed(2) : '0.00';

    return (
      <div className="bg-neutral-950/95 backdrop-blur-md border border-neutral-800 p-3 rounded-xl shadow-2xl text-xs space-y-2 min-w-[210px] z-50 pointer-events-none">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
          <span className="font-mono text-neutral-400 font-semibold">{data.time || label}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isUp ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
            {isUp ? `+${pct}%` : `${pct}%`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
          <div className="text-neutral-400">Abertura: <span className="text-white">${data.open?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          <div className="text-neutral-400">Fechamento: <span className="text-white">${data.close?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          <div className="text-neutral-400">Máxima: <span className="text-emerald-400">${data.high?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
          <div className="text-neutral-400">Mínima: <span className="text-rose-400">${data.low?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
        </div>
        {data.takerBuy !== undefined && (
          <div className="border-t border-neutral-800/80 pt-1.5 flex justify-between text-[11px] text-neutral-400 font-mono">
            <span>Vol: {(data.takerBuy + data.takerSell).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <span className="text-emerald-400">Compra: {((data.takerBuy / ((data.takerBuy + data.takerSell) || 1)) * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>
    );
  };

  const fib = ticker.fibonacci || { fib618: 0, fib68: 0, inGoldenPocket: false };
  const range = ticker.rangeProfile || { vah: 0, val: 0, poc: 0 };
  const price = ticker.price ?? 0;
  const changePct = ticker.priceChangePercent24h ?? 0;

  const { domainMin, domainMax, priceRange } = useMemo(() => {
    const target = slicedData.length > 0 ? slicedData : chartData;
    if (!target.length) return { domainMin: 0, domainMax: 1, priceRange: 1 };
    const rawMin = Math.min(...target.map(d => d.low));
    const rawMax = Math.max(...target.map(d => d.high));
    const pad = (rawMax - rawMin) * 0.03 || 1;
    const min = rawMin - pad;
    const max = rawMax + pad;
    return { domainMin: min, domainMax: max, priceRange: max - min || 1 };
  }, [slicedData, chartData]);

  const heatmapData = useMemo(() => {
    const target = slicedData.length > 0 ? slicedData : chartData;
    if (!target.length || !ticker) {
      return { buckets: [], pocBucket: null, topSupplyCluster: null, topDemandCluster: null, maxBucketVolume: 0 };
    }
    return calculateLiquidityHeatmap(target, ticker.price, heatmapBucketCount);
  }, [slicedData, chartData, ticker?.price, heatmapBucketCount]);

  const chartHeightPx = 240;

  interface CandlestickShapeProps {
    x?: number;
    width?: number;
    payload?: ChartDataItem;
  }

  const CandlestickShape: React.FC<CandlestickShapeProps> = (props) => {
    const { x = 0, width = 10, payload } = props;
    if (!payload || typeof payload.open !== 'number' || typeof payload.close !== 'number') {
      return null;
    }

    const isUp = payload.close >= payload.open;
    const color = isUp ? '#10b981' : '#f43f5e';

    const getY = (priceVal: number) => {
      const clamped = Math.max(domainMin, Math.min(domainMax, priceVal));
      return 15 + ((domainMax - clamped) / priceRange) * chartHeightPx;
    };

    const yOpen = getY(payload.open);
    const yClose = getY(payload.close);
    const yHigh = getY(payload.high);
    const yLow = getY(payload.low);

    const bodyTop = Math.min(yOpen, yClose);
    const bodyBottom = Math.max(yOpen, yClose);
    const bodyHeight = Math.max(2, bodyBottom - bodyTop);

    const centerX = x + width / 2;
    const barWidth = Math.max(3, Math.min(12, width * 0.7));
    const barX = centerX - barWidth / 2;

    return (
      <g>
        <line x1={centerX} y1={yHigh} x2={centerX} y2={yLow} stroke={color} strokeWidth={1.5} />
        <rect x={barX} y={bodyTop} width={barWidth} height={bodyHeight} fill={color} stroke={color} rx={1} />
      </g>
    );
  };

  // --- Determine Market Structure from Klines ---
  let structureLabel = 'NEUTRAL';
  let isBullishStructure = false;
  let bosStatus = 'Aguardando';

  if (klines.length > 10) {
    const swingHighs = [];
    const swingLows = [];
    // Simple 3-bar fractal for swings
    for (let i = 2; i < klines.length - 2; i++) {
      const current = klines[i];
      const prev1 = klines[i-1];
      const prev2 = klines[i-2];
      const next1 = klines[i+1];
      const next2 = klines[i+2];

      if (current.high > prev1.high && current.high > prev2.high && current.high > next1.high && current.high > next2.high) {
        swingHighs.push({ price: current.high, index: i });
      }
      if (current.low < prev1.low && current.low < prev2.low && current.low < next1.low && current.low < next2.low) {
        swingLows.push({ price: current.low, index: i });
      }
    }

    if (swingHighs.length >= 2 && swingLows.length >= 2) {
      const lastH = swingHighs[swingHighs.length - 1].price;
      const prevH = swingHighs[swingHighs.length - 2].price;
      const lastL = swingLows[swingLows.length - 1].price;
      const prevL = swingLows[swingLows.length - 2].price;

      if (lastH > prevH && lastL > prevL) {
        structureLabel = 'HH / HL (BULL)';
        isBullishStructure = true;
        bosStatus = 'Confirmado';
      } else if (lastH < prevH && lastL < prevL) {
        structureLabel = 'LL / LH (BEAR)';
        isBullishStructure = false;
        bosStatus = 'Confirmado';
      } else if (lastH > prevH && lastL < prevL) {
        structureLabel = 'EXPANSÃO (BULL)';
        isBullishStructure = true;
        bosStatus = 'Rompimento';
      } else {
        structureLabel = 'COMPRESSÃO (BEAR)';
        isBullishStructure = false;
        bosStatus = 'Acumulação';
      }
    } else {
      isBullishStructure = ticker.priceChangePercent24h >= 0;
      structureLabel = isBullishStructure ? 'HH / HL (BULL)' : 'LL / LH (BEAR)';
      bosStatus = 'Testado';
    }
  } else {
    isBullishStructure = ticker.priceChangePercent24h >= 0;
    structureLabel = isBullishStructure ? 'HH / HL (BULL)' : 'LL / LH (BEAR)';
    bosStatus = 'Testado';
  }

  return (
    <div className="space-y-4 font-mono pb-10">
      {/* Top Asset Switcher Bar */}
      <div className="bg-[#0A0A0A] p-3 rounded-lg border border-white/10 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 text-orange-400 rounded border border-orange-500/20">
            <ChartIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white">{ticker.symbol}</h2>
              <span className="text-[10px] bg-neutral-900 text-neutral-300 font-bold px-1.5 py-0.5 rounded border border-white/5">
                Sniper Dashboard
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">{ticker.name} • Timeframes Analisados: 1m, 5m, 15m, 1H, 4H, 1D</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs overflow-x-auto scrollbar-none w-full md:w-auto pb-1 md:pb-0">
          {allTickers.slice(0, 12).map(t => (
            <button
              key={t.symbol}
              onClick={() => onSelectTickerBySymbol(t.symbol)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition shrink-0 ${
                t.symbol === ticker.symbol
                  ? 'bg-orange-500 text-black shadow'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/5'
              }`}
            >
              {t.symbol.replace('USDT', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Action / AI Review Area & Comparative Analysis Panel */}
      <div className="bg-gradient-to-r from-orange-500/5 via-[#0A0A0A] to-[#0D0D0D] p-4.5 rounded-xl border border-orange-500/20 shadow-2xl space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Painel de Sinais, Auditoria IA & Relação Risco/Retorno
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Análise quantitativa de pontos de entrada, stop loss, alvos com porcentagens e comparação em tempo real.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Active Model Selector */}
            <div className="flex items-center gap-1.5 bg-[#050505] px-2.5 py-1.5 rounded-lg border border-white/10 text-xs">
              <Cpu className="h-3.5 w-3.5 text-orange-400 shrink-0" />
              <span className="text-[10px] text-neutral-400 font-bold uppercase hidden md:inline">Modelo:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer max-w-[180px] sm:max-w-[220px] truncate"
              >
                {enabledModels.length > 0 ? (
                  enabledModels.map(m => (
                    <option key={m.id} value={m.id} className="bg-[#0A0A0A] text-white">
                      {m.name} ({m.provider.toUpperCase()} - {m.modelId})
                    </option>
                  ))
                ) : (
                  <option value="" className="bg-[#0A0A0A] text-neutral-400">Motor IA Ativo (Auto)</option>
                )}
              </select>
            </div>

            {/* Persona Selector */}
            <div className="flex items-center gap-1.5 bg-[#050505] px-2.5 py-1.5 rounded-lg border border-cyan-500/20">
              <UserCheck className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
              <select
                value={selectedPersona}
                onChange={(e) => setSelectedPersona(e.target.value)}
                className="bg-transparent text-cyan-300 text-xs font-bold focus:outline-none cursor-pointer max-w-[170px] truncate"
                title="Persona e Estilo Operacional da IA"
              >
                {DEFAULT_AI_PERSONAS.map(p => (
                  <option key={p.id} value={p.id} className="bg-[#0A0A0A] text-white">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRunAIReview}
              disabled={loadingReview}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded-lg text-xs font-black transition flex items-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              {loadingReview ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Auditando com IA...</>
              ) : aiReview ? (
                <><RefreshCw className="h-4 w-4" /> Re-Executar Auditoria</>
              ) : (
                <><Brain className="h-4 w-4" /> Executar Auditoria IA</>
              )}
            </button>
          </div>
        </div>

        {/* AI Reasoning Header if AI Review exists */}
        {aiReview && (
          <div className="space-y-3 animate-fade-in bg-[#050505] p-3.5 rounded-lg border border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-white/5">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="text-neutral-400 font-bold text-[10px] uppercase">Decisão do Agente:</span>
                <span className={`px-2.5 py-1 rounded text-xs font-black uppercase border flex items-center gap-1 ${
                  aiReview.decision === 'CONFIRM' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                  aiReview.decision === 'REJECT' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {aiReview.decision === 'CONFIRM' && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {aiReview.decision === 'REJECT' && <ShieldAlert className="h-3.5 w-3.5" />}
                  {aiReview.decision === 'ADJUST' && <AlertTriangle className="h-3.5 w-3.5" />}
                  {aiReview.decision}
                </span>

                <span className="text-neutral-600">|</span>

                <span className="text-neutral-400 font-bold text-[10px] uppercase">Direção IA:</span>
                <span className={`font-black flex items-center gap-1 ${
                  aiReview.recommendedDirection === 'LONG' ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {aiReview.recommendedDirection === 'LONG' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {aiReview.recommendedDirection}
                </span>

                <span className="text-neutral-600">|</span>

                <span className="text-neutral-400 font-bold text-[10px] uppercase">Confiança:</span>
                <span className="font-extrabold text-orange-400">{aiReview.confidenceScore}%</span>
              </div>

              {aiReview.modelUsed && (
                <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-white/5">
                  Modelo: {aiReview.modelUsed}
                </span>
              )}
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed font-sans">
              <strong className="text-orange-400 font-bold">Tese de Investimento & Auditoria: </strong>
              {aiReview.reasoning}
            </p>
          </div>
        )}

        {/* COMPARATIVE / DETAILED SIGNALS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* BOT QUANT SIGNAL CARD */}
          <div className={`p-4 rounded-xl border font-mono transition-all space-y-3 ${
            activeSignal ? 'bg-[#050505] border-emerald-500/30 shadow-lg' : 'bg-[#050505]/60 border-white/5 opacity-70'
          }`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-black text-white uppercase tracking-wider">Sinal Algorítmico (Quant Bot)</span>
              </div>
              {activeSignal ? (
                <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded uppercase">
                  {activeSignal.direction} ({activeSignal.signalType})
                </span>
              ) : (
                <span className="text-[10px] font-bold text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-white/5">
                  Sem sinal ativo
                </span>
              )}
            </div>

            {activeSignal && botMetrics ? (
              <div className="space-y-3">
                {/* Metric Items */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-neutral-900/80 p-2.5 rounded border border-white/5">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-0.5">Zona de Entrada</span>
                    <span className="font-extrabold text-orange-400 text-xs">
                      {formatPriceRange(activeSignal.entryZone?.[0], activeSignal.entryZone?.[1])}
                    </span>
                  </div>

                  <div className="bg-neutral-900/80 p-2.5 rounded border border-rose-500/20">
                    <span className="text-[10px] text-rose-400 font-bold uppercase block mb-0.5">Stop Loss (% Risco)</span>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-rose-400">{formatPrice(activeSignal.stopLoss, { currency: true })}</span>
                      <span className="text-[10px] font-black text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                        -{botMetrics.riskPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-neutral-900/80 p-2.5 rounded border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-0.5">Alvo 1 (Scalp / DayTrade)</span>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-400">{formatPrice(activeSignal.target1, { currency: true })}</span>
                      <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        +{botMetrics.target1GainPct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[9px] font-bold text-neutral-400 mt-1 flex items-center justify-between border-t border-white/5 pt-1">
                      <span>Risco : Retorno:</span>
                      <span className="text-orange-400 font-extrabold">1 : {botMetrics.rrRatio1.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-neutral-900/80 p-2.5 rounded border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-0.5">Alvo 2 (Swing)</span>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-400">{formatPrice(activeSignal.target2, { currency: true })}</span>
                      <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        +{botMetrics.target2GainPct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[9px] font-bold text-neutral-400 mt-1 flex items-center justify-between border-t border-white/5 pt-1">
                      <span>Risco : Retorno:</span>
                      <span className="text-orange-400 font-extrabold">1 : {botMetrics.rrRatio2.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Score & Confluence */}
                <div className="bg-neutral-900/80 p-2.5 rounded border border-white/5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-neutral-400 font-bold uppercase">Confluência Quant:</span>
                    <span className="font-extrabold text-orange-400">{activeSignal.confluenceScore}%</span>
                  </div>
                  {activeSignal.backtestWinRate && (
                    <div className="flex items-center justify-between text-[10px] border-t border-white/5 pt-1">
                      <span className="text-neutral-400 font-bold uppercase">Backtest Histórico:</span>
                      <span className="font-bold text-emerald-400">
                        WR {activeSignal.backtestWinRate.toFixed(1)}% | PF {activeSignal.backtestProfitFactor?.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(activeSignal.confluenceFactors || []).map((f, idx) => (
                      <span key={idx} className="text-[9px] font-bold bg-black text-neutral-300 px-1.5 py-0.5 rounded border border-white/10">
                        ✓ {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-500 font-sans space-y-2">
                <p>Nenhum sinal ativo gerado pelo bot quant para {ticker?.symbol} no momento.</p>
                <p className="text-[11px] text-neutral-400">Clique no botão "Executar Auditoria IA" acima para solicitar um sinal autônomo ao agente.</p>
              </div>
            )}
          </div>

          {/* AI REVIEW PROPOSAL CARD */}
          <div className={`p-4 rounded-xl border font-mono transition-all space-y-3 ${
            aiReview ? 'bg-[#050505] border-orange-500/40 shadow-lg' : 'bg-[#050505]/60 border-white/5 opacity-70'
          }`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-orange-400" />
                <span className="text-xs font-black text-white uppercase tracking-wider">Auditoria do Agente de IA</span>
              </div>
              {aiReview ? (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase border flex items-center gap-1 ${
                  aiReview.recommendedDirection === 'LONG' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}>
                  {aiReview.recommendedDirection} ({aiReview.confidenceScore}% Conf)
                </span>
              ) : (
                <span className="text-[10px] font-bold text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-white/5">
                  Aguardando execução
                </span>
              )}
            </div>

            {aiReview && aiMetrics ? (
              <div className="space-y-3">
                {/* Metric Items */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-neutral-900/80 p-2.5 rounded border border-white/5">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-0.5">Zona Entrada Recomendada</span>
                    <span className="font-extrabold text-orange-400 text-xs">
                      {formatPriceRange(aiReview.entryZone?.[0], aiReview.entryZone?.[1])}
                    </span>
                  </div>

                  <div className="bg-neutral-900/80 p-2.5 rounded border border-rose-500/20">
                    <span className="text-[10px] text-rose-400 font-bold uppercase block mb-0.5">Stop Loss Auditoria (% Risco)</span>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-rose-400">{formatPrice(aiReview.stopLoss, { currency: true })}</span>
                      <span className="text-[10px] font-black text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                        -{aiMetrics.riskPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-neutral-900/80 p-2.5 rounded border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-0.5">Alvo 1 (Scalp IA)</span>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-400">{formatPrice(aiReview.takeProfit1, { currency: true })}</span>
                      <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        +{aiMetrics.target1GainPct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[9px] font-bold text-neutral-400 mt-1 flex items-center justify-between border-t border-white/5 pt-1">
                      <span>Risco : Retorno IA:</span>
                      <span className="text-orange-400 font-extrabold">1 : {aiMetrics.rrRatio1.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-neutral-900/80 p-2.5 rounded border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-0.5">Alvo 2 (Swing IA)</span>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emerald-400">{formatPrice(aiReview.takeProfit2, { currency: true })}</span>
                      <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        +{aiMetrics.target2GainPct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[9px] font-bold text-neutral-400 mt-1 flex items-center justify-between border-t border-white/5 pt-1">
                      <span>Risco : Retorno IA:</span>
                      <span className="text-orange-400 font-extrabold">1 : {aiMetrics.rrRatio2.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* AI Review Delta comparison */}
                <div className="bg-neutral-900/80 p-2.5 rounded border border-white/5 text-xs space-y-1 font-sans">
                  <span className="text-[10px] text-orange-400 font-bold uppercase block mb-0.5">Resumo Comparativo de Risco:</span>
                  <p className="text-[11px] text-neutral-300">
                    Relação Risco:Retorno Média da IA: <strong className="text-orange-400">1:{aiMetrics.rrRatio1.toFixed(2)}</strong> (Scalp) / <strong className="text-orange-400">1:{aiMetrics.rrRatio2.toFixed(2)}</strong> (Swing).
                    {botMetrics && (
                      <span>
                        {' '}Comparado ao Bot Quant ({botMetrics.riskPct.toFixed(2)}% Risco / R:R 1:{botMetrics.rrRatio1.toFixed(2)}),
                        a IA sugere {aiMetrics.riskPct < botMetrics.riskPct ? `um Stop Loss mais protegido (-${(botMetrics.riskPct - aiMetrics.riskPct).toFixed(2)}% menor risco).` : 'um ajuste proporcional de margem.'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-neutral-500 font-sans space-y-2">
                <p>Nenhuma auditoria executada ainda para {ticker?.symbol}.</p>
                <p className="text-[11px] text-neutral-400">Clique em "Executar Auditoria IA" para auditar o gráfico com LLMs quantitativos.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chart Grid & Order Flow Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
        {/* Main Price Chart with Fibonacci Overlays */}
        <div className="lg:col-span-2 2xl:col-span-3 bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-xl font-black text-white flex items-center gap-2">
                {formatPrice(price, { currency: true })}
                {loading && <RefreshCw className="h-4 w-4 text-neutral-500 animate-spin" />}
              </div>
              <span className={`text-xs font-bold ${changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {changePct >= 0 ? '▲ ' : '▼ '}{formatPercent(changePct)} (24h)
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Timeframe Selector */}
              <div className="flex items-center bg-[#050505] rounded border border-white/5 p-0.5 shadow-inner">
                {['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'].map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition ${timeframe === tf ? 'bg-orange-500 text-black shadow-sm' : 'text-neutral-500 hover:text-white'}`}
                  >
                    {tf.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Chart Type Toggle (Linhas vs Velas/Candles) */}
              <div className="flex items-center bg-[#050505] rounded border border-white/5 p-0.5 shadow-inner">
                <button
                  onClick={() => setChartType('line')}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 ${chartType === 'line' ? 'bg-orange-500 text-black shadow-sm' : 'text-neutral-500 hover:text-white'}`}
                >
                  Linha
                </button>
                <button
                  onClick={() => setChartType('candles')}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 ${chartType === 'candles' ? 'bg-orange-500 text-black shadow-sm' : 'text-neutral-500 hover:text-white'}`}
                >
                  Velas (Candles)
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center bg-[#050505] rounded border border-white/5 p-0.5 shadow-inner">
                <button
                  onClick={handleZoomIn}
                  title="Zoom In (+)"
                  aria-label="Aumentar Zoom (+)"
                  className="px-2 py-1 rounded text-[10px] font-bold text-neutral-400 hover:text-white transition"
                >
                  +
                </button>
                <button
                  onClick={handleZoomOut}
                  title="Zoom Out (-)"
                  aria-label="Diminuir Zoom (-)"
                  className="px-2 py-1 rounded text-[10px] font-bold text-neutral-400 hover:text-white transition"
                >
                  -
                </button>
                <button
                  onClick={handleResetZoom}
                  title="Reset Zoom"
                  aria-label="Resetar Zoom para 100%"
                  className="px-2 py-1 rounded text-[10px] font-bold text-neutral-400 hover:text-white transition"
                >
                  100%
                </button>
              </div>

              {/* Golden Pocket Banner */}
              <div className={`px-2.5 py-1 rounded border text-[10px] font-bold flex items-center gap-1.5 ${
                fib.inGoldenPocket ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 animate-pulse' : 'bg-neutral-900 text-neutral-400 border-white/10'
              }`}>
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                {fib.inGoldenPocket ? 'NA ZONA GOLDEN POCKET (0.618 - 0.68)' : 'AGUARDANDO FIBO 0.618-0.68'}
              </div>
            </div>
          </div>

          {/* Liquidity Heatmap Overlay Badge & Controls */}
          <LiquidityHeatmapBadge
            heatmapData={heatmapData}
            visible={heatmapEnabled}
            onToggle={() => setHeatmapEnabled(!heatmapEnabled)}
            bucketCount={heatmapBucketCount}
            onChangeBucketCount={(cnt) => setHeatmapBucketCount(cnt)}
          />

          {/* Recharts Area Chart / Candlestick Chart */}
          <div 
            className="h-72 w-full pt-2"
            onWheel={handleWheelZoom}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {loading ? (
              <div className="h-full flex items-center justify-center text-neutral-500 text-xs">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Carregando gráfico...
              </div>
            ) : chartType === 'line' ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={slicedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 2" stroke="#262626" />
                  <XAxis dataKey="time" stroke="#737373" tick={{ fontSize: 9 }} />
                  <YAxis domain={['auto', 'auto']} stroke="#737373" tick={{ fontSize: 9 }} orientation="right" />
                  <Tooltip content={<CustomTooltip />} />
                  {/* Liquidity Heatmap Overlay Reference Areas */}
                  <LiquidityHeatmapReferenceAreas heatmapData={heatmapData} visible={heatmapEnabled} />
                  {/* Fibonacci Retracement Levels */}
                  {fib.fib618 > 0 && (
                    <ReferenceLine y={fib.fib618} stroke="#f97316" strokeDasharray="3 3" label={{ value: `Fibo 0.618 (${formatPrice(fib.fib618, { currency: true })})`, fill: '#f97316', fontSize: 9 }} />
                  )}
                  {fib.fib68 > 0 && (
                    <ReferenceLine y={fib.fib68} stroke="#ea580c" strokeDasharray="3 3" label={{ value: `Fibo 0.68 (${formatPrice(fib.fib68, { currency: true })})`, fill: '#ea580c', fontSize: 9 }} />
                  )}
                  {range.poc > 0 && (
                    <ReferenceLine y={range.poc} stroke="#06b6d4" strokeDasharray="2 2" label={{ value: `POC Range (${formatPrice(range.poc, { currency: true })})`, fill: '#06b6d4', fontSize: 9 }} />
                  )}
                  {/* Active Signal / AI Review targets */}
                  {(aiReview?.takeProfit1 || activeSignal?.target1) && (
                     <ReferenceLine y={aiReview?.takeProfit1 || activeSignal?.target1} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Alvo', fill: '#10b981', fontSize: 9 }} />
                  )}
                  {(aiReview?.stopLoss || activeSignal?.stopLoss) && (
                     <ReferenceLine y={aiReview?.stopLoss || activeSignal?.stopLoss} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Stop', fill: '#f43f5e', fontSize: 9 }} />
                  )}
                  <Area type="monotone" dataKey="price" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#priceGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={slicedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#262626" />
                  <XAxis dataKey="time" stroke="#737373" tick={{ fontSize: 9 }} />
                  <YAxis domain={[domainMin, domainMax]} stroke="#737373" tick={{ fontSize: 9 }} orientation="right" />
                  <Tooltip content={<CustomTooltip />} />
                  {/* Liquidity Heatmap Overlay Reference Areas */}
                  <LiquidityHeatmapReferenceAreas heatmapData={heatmapData} visible={heatmapEnabled} />
                  {/* Fibonacci Retracement Levels */}
                  {fib.fib618 > 0 && (
                    <ReferenceLine y={fib.fib618} stroke="#f97316" strokeDasharray="3 3" label={{ value: `Fibo 0.618 (${formatPrice(fib.fib618, { currency: true })})`, fill: '#f97316', fontSize: 9 }} />
                  )}
                  {fib.fib68 > 0 && (
                    <ReferenceLine y={fib.fib68} stroke="#ea580c" strokeDasharray="3 3" label={{ value: `Fibo 0.68 (${formatPrice(fib.fib68, { currency: true })})`, fill: '#ea580c', fontSize: 9 }} />
                  )}
                  {range.poc > 0 && (
                    <ReferenceLine y={range.poc} stroke="#06b6d4" strokeDasharray="2 2" label={{ value: `POC Range (${formatPrice(range.poc, { currency: true })})`, fill: '#06b6d4', fontSize: 9 }} />
                  )}
                  {/* Active Signal / AI Review targets */}
                  {(aiReview?.takeProfit1 || activeSignal?.target1) && (
                     <ReferenceLine y={aiReview?.takeProfit1 || activeSignal?.target1} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Alvo', fill: '#10b981', fontSize: 9 }} />
                  )}
                  {(aiReview?.stopLoss || activeSignal?.stopLoss) && (
                     <ReferenceLine y={aiReview?.stopLoss || activeSignal?.stopLoss} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Stop', fill: '#f43f5e', fontSize: 9 }} />
                  )}
                  <Bar dataKey="close" shape={<CandlestickShape />} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Sub-gráficos de Orderflow e Volume Taker */}
          <OrderflowIndicators
            slicedData={slicedData}
            chartData={chartData}
            ticker={ticker}
          />
        </div>

        {/* Right Sidebar: Volume Profile & Order Flow Breakdown */}
        <MarketProfileMetrics
          ticker={ticker}
          timeframe={timeframe}
          isBullishStructure={isBullishStructure}
          structureLabel={structureLabel}
          bosStatus={bosStatus}
        />
      </div>
    </div>
  );
};
