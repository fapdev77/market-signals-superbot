import React, { useState, useEffect, useMemo } from 'react';
import { TickerData, KlineCandle, TradeSignal, AIReviewResponse, AIModelConfig, IndicatorWeights } from '../types';
import { formatPrice, formatPriceRange, formatPercent, formatCompactNumber, calculateTradeMetrics, formatDateTime, formatTimeAgo } from '../utils/formatters';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea, BarChart, Bar, CartesianGrid } from 'recharts';
import { LineChart as ChartIcon, Flame, Activity, RefreshCw, Brain, Target, ShieldAlert, Crosshair, Zap, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, ArrowUpRight, Scale, Percent, Cpu, UserCheck, Hand, MoveHorizontal, Maximize2, Minimize2, Clock, Sliders, Layers, BarChart3 } from 'lucide-react';
import { MarketProfileMetrics, VolumeProfileCard, OrderFlowFundingCard, DivergenceStructureCard } from './MarketProfileMetrics';
import { FibonacciCard } from './FibonacciCard';
import { OrderflowIndicators, ChartDataItem } from './OrderflowIndicators';
import { LiquidityDepth } from './LiquidityDepth';
import { calculateLiquidityHeatmap } from '../utils/heatmapUtils';
import { LiquidityHeatmapReferenceAreas, LiquidityHeatmapBadge } from './LiquidityHeatmapOverlay';
import { calculateVolumeProfile, VolumeProfileResult } from '../utils/volumeProfileUtils';
import { VolumeDeltaGauge } from './VolumeDeltaGauge';
import { VolumeProfileVisualization, VolumeProfileOverlayOnChart } from './VolumeProfileVisualization';
import { DEFAULT_AI_PERSONAS } from '../constants/aiPersonas';
import { Tooltip as AppTooltip } from './Tooltip';
import { PriceAlertManager } from './PriceAlertManager';
import { BulkAlertManager } from './BulkAlertManager';
import { AlertSoundSettingsMenu } from './AlertSoundSettingsMenu';
import { PositionSizerCalculator } from './PositionSizerCalculator';
import { PaperTradingSandbox } from './PaperTradingSandbox';
import { usePaperTrading } from '../hooks/usePaperTrading';
import { UserPriceAlert } from '../types';
import { getTopDetectedPattern } from '../utils/aiPatternScanner';
import { PatternBadge } from './PatternBadge';

interface ChartAndProfileProps {
  selectedTicker: TickerData | null;
  allTickers: TickerData[];
  onSelectTickerBySymbol: (symbol: string) => void;
  signals?: TradeSignal[];
  selectedSignal?: TradeSignal | null;
  onSelectSignal?: (signal: TradeSignal) => void;
  autoTriggerAI?: boolean;
  onClearAutoTrigger?: () => void;
  activeModels?: AIModelConfig[];
  botWeights?: IndicatorWeights;
}

export const ChartAndProfile: React.FC<ChartAndProfileProps> = ({
  selectedTicker,
  allTickers = [],
  onSelectTickerBySymbol,
  signals = [],
  selectedSignal,
  onSelectSignal,
  autoTriggerAI,
  onClearAutoTrigger,
  activeModels = [],
  botWeights
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
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [dragModeActive, setDragModeActive] = useState<boolean>(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState<boolean>(true);
  const [heatmapBucketCount, setHeatmapBucketCount] = useState<number>(36);
  const [volumeProfileEnabled, setVolumeProfileEnabled] = useState<boolean>(true);
  const [volumeProfileBins, setVolumeProfileBins] = useState<number>(36);
  const [volumeProfileSide, setVolumeProfileSide] = useState<'right' | 'left'>('right');
  const [showDetailedVolumeProfile, setShowDetailedVolumeProfile] = useState<boolean>(false);
  const [showVolumeDeltaGauge, setShowVolumeDeltaGauge] = useState<boolean>(true);
  const [fibOverlayEnabled, setFibOverlayEnabled] = useState<boolean>(true);
  const [valueAreaOverlayEnabled, setValueAreaOverlayEnabled] = useState<boolean>(true);
  const [activeFibLevels, setActiveFibLevels] = useState<{
    fib0?: number;
    fib236: number;
    fib382: number;
    fib50: number;
    fib618: number;
    fib68: number;
    fib786: number;
    fib100?: number;
    swingHigh: number;
    swingLow: number;
    inGoldenPocket: boolean;
    trend?: 'UP' | 'DOWN';
    point1Price?: number;
    point0Price?: number;
    point1Label?: string;
    point0Label?: string;
    point1Type?: 'HH' | 'LL';
    point0Type?: 'HH' | 'LL';
  } | null>(null);

  const [userAlerts, setUserAlerts] = useState<UserPriceAlert[]>(() => {
    try {
      const stored = localStorage.getItem('superbot_user_price_alerts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [showBulkAlertManager, setShowBulkAlertManager] = useState<boolean>(false);

  // Re-read alerts periodically or on custom storage event
  useEffect(() => {
    const handleStorage = () => {
      try {
        const stored = localStorage.getItem('superbot_user_price_alerts');
        if (stored) setUserAlerts(JSON.parse(stored));
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(handleStorage, 2000);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  // Filter active alerts for current ticker for Chart Reference Lines
  const activeTickerPriceAlerts = useMemo(() => {
    if (!ticker?.symbol) return [];
    return userAlerts.filter(a => a.symbol === ticker.symbol && a.active && !a.triggered);
  }, [userAlerts, ticker?.symbol]);

  // Paper Trading Sandbox active positions & pending orders for on-chart visualization
  const { currentTickerPositions: activePaperPositions, currentTickerPendingOrders: activePaperOrders } = usePaperTrading(allTickers, ticker?.symbol);

  const enabledModels = activeModels.filter(m => m.isActive);

  useEffect(() => {
    if (activeModels && activeModels.length > 0) {
      const active = activeModels.find(m => m.isActive) || activeModels[0];
      if (active && !selectedModel) {
        setSelectedModel(active.id);
      }
    }
  }, [activeModels]);
  
  // Filter all active signals for this ticker
  const tickerSignals = useMemo(() => {
    if (!ticker?.symbol) return [];
    return (signals || []).filter(s => s.symbol === ticker.symbol);
  }, [signals, ticker?.symbol]);

  // Determine activeSignal prioritizing the explicitly selected signal
  const activeSignal = useMemo(() => {
    if (selectedSignal && selectedSignal.symbol === ticker?.symbol) {
      const foundInList = tickerSignals.find(s => s.id === selectedSignal.id);
      return foundInList || selectedSignal;
    }
    if (tickerSignals.length > 0) {
      return [...tickerSignals].sort((a, b) => (b.confluenceScore || 0) - (a.confluenceScore || 0))[0];
    }
    return null;
  }, [selectedSignal, tickerSignals, ticker?.symbol]);

  // Auto-sync chart timeframe with the active signal's timeframe
  useEffect(() => {
    if (activeSignal?.timeframe) {
      const tfClean = activeSignal.timeframe.trim().toLowerCase();
      const validTfs = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
      const matched = validTfs.find(tf => tfClean === tf || tfClean.startsWith(tf) || tfClean.includes(tf));
      if (matched && matched !== timeframe) {
        setTimeframe(matched);
      }
    }
  }, [activeSignal?.id, activeSignal?.timeframe]);

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
        body: JSON.stringify({
          symbol: ticker.symbol,
          signalId: activeSignal?.id,
          signal: activeSignal || undefined,
          model,
          personaId: selectedPersona
        })
      });
      const data: AIReviewResponse = await res.json();
      setAiReview(data);
    } catch (err) {
      console.error('Failed to run AI review:', err);
    } finally {
      setLoadingReview(false);
    }
  };
  
  // Auto-trigger AI review if requested from navigation
  useEffect(() => {
    if (autoTriggerAI && ticker?.symbol && !loadingReview) {
      handleRunAIReview();
      if (onClearAutoTrigger) {
        onClearAutoTrigger();
      }
    }
  }, [autoTriggerAI, ticker?.symbol, activeSignal?.id]);

  useEffect(() => {
    setAiReview(null);
  }, [ticker?.symbol, activeSignal?.id]);

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

  const baseAsset = ticker?.baseAsset || (ticker?.symbol ? ticker.symbol.replace(/USDT|BUSD|USDC/g, '') : 'ATIVO');

  const chartData: ChartDataItem[] = useMemo(() => {
    if (!klines.length) return [];
    let currentOI = ticker.openInterest ?? 1000000;
    let currentCVD = ticker.cvd ?? 0;
    
    const data: ChartDataItem[] = klines.map(k => {
      const timeStr = new Date(k.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const takerBuy = k.takerBuyVolume ?? (k.volume * 0.5);
      const takerSell = Math.max(0, k.volume - takerBuy);
      const delta = takerBuy - takerSell;
      const quoteVol = k.quoteVolume || (k.volume * k.close);
      
      return {
        time: timeStr,
        price: k.close,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
        quoteVolume: quoteVol,
        takerBuy: takerBuy,
        takerSell: takerSell,
        takerBuyUSD: takerBuy * k.close,
        takerSellUSD: takerSell * k.close,
        delta: delta,
        deltaUSD: delta * k.close,
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
  const isFullRange = effectiveStart === 0 && effectiveEnd >= chartData.length;
  const savedZoomRef = React.useRef<{ start: number; end: number } | null>(null);
  
  const slicedData = useMemo(() => {
    return chartData.slice(effectiveStart, effectiveEnd);
  }, [chartData, effectiveStart, effectiveEnd]);

  // Keep a ref of the current range for zero-latency event callbacks
  const zoomRangeRef = React.useRef({ start: effectiveStart, end: effectiveEnd, length: chartData.length });
  zoomRangeRef.current = { start: effectiveStart, end: effectiveEnd, length: chartData.length };

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

  // Zoom-To-Fit Toggle: toggles between 100% full dataset range and previous/focused view
  const handleToggleZoomToFit = () => {
    if (chartData.length === 0) return;
    if (!isFullRange) {
      // Save current zoomed/custom view
      savedZoomRef.current = { start: effectiveStart, end: effectiveEnd };
      // Fit to full data range
      setZoomStart(0);
      setZoomEnd(chartData.length);
    } else {
      // If we have a previously saved range, restore it
      if (savedZoomRef.current && (savedZoomRef.current.end - savedZoomRef.current.start < chartData.length)) {
        setZoomStart(savedZoomRef.current.start);
        setZoomEnd(savedZoomRef.current.end);
      } else {
        // Default focused trading view: recent 35 candles (or last 45%)
        const focusLen = Math.max(8, Math.min(35, Math.floor(chartData.length * 0.45)));
        setZoomStart(Math.max(0, chartData.length - focusLen));
        setZoomEnd(chartData.length);
      }
    }
  };

  // Professional Cursor-Anchored Smooth Zoom
  const performZoomAtPoint = React.useCallback((clientX: number, deltaY: number) => {
    const container = chartContainerRef.current;
    if (!container) return;
    const { start, end, length } = zoomRangeRef.current;
    if (length <= 2) return;

    const rect = container.getBoundingClientRect();
    const plotLeft = rect.left + 10;
    const plotWidth = Math.max(80, rect.width - 65);
    const ratio = Math.max(0, Math.min(1, (clientX - plotLeft) / plotWidth));

    const currentLen = end - start;
    if (currentLen <= 5 && deltaY < 0) return; // limit max zoom in
    if (currentLen >= length && deltaY > 0) return; // limit max zoom out

    // Proportional smooth scaling: small delta gives subtle zoom, larger wheel notch gives snappy zoom
    const zoomFactor = deltaY < 0 ? 0.85 : 1.18;
    const newLen = Math.max(5, Math.min(length, Math.round(currentLen * zoomFactor)));
    if (newLen === currentLen) return;

    const anchorCandle = start + ratio * currentLen;
    let newStart = Math.round(anchorCandle - ratio * newLen);
    let newEnd = newStart + newLen;

    if (newStart < 0) {
      newStart = 0;
      newEnd = Math.min(length, newLen);
    } else if (newEnd > length) {
      newEnd = length;
      newStart = Math.max(0, length - newLen);
    }

    setZoomStart(newStart);
    setZoomEnd(newEnd);
  }, []);

  // Pan / Drag State References
  const isDraggingRef = React.useRef<boolean>(false);
  const dragStartXRef = React.useRef<number>(0);
  const dragStartZoomRef = React.useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const chartContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Attach non-passive wheel event listener for smooth TradingView-style cursor-anchored zoom
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      performZoomAtPoint(e.clientX, e.deltaY);
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, [performZoomAtPoint]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only primary mouse button
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartZoomRef.current = { start: effectiveStart, end: effectiveEnd };
    setIsPanning(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !chartContainerRef.current) return;
    const deltaX = e.clientX - dragStartXRef.current;
    if (Math.abs(deltaX) < 3) return;

    const rect = chartContainerRef.current.getBoundingClientRect();
    const containerWidth = rect.width || 600;
    const windowLen = dragStartZoomRef.current.end - dragStartZoomRef.current.start;
    const candlesPerPixel = windowLen / containerWidth;

    // In TradingView: dragging mouse right (deltaX > 0) pulls older bars into view (start/end shift down)
    // dragging mouse left (deltaX < 0) pulls future/newer bars into view (start/end shift up)
    const shiftBars = Math.round(-deltaX * candlesPerPixel);

    let newStart = dragStartZoomRef.current.start + shiftBars;
    let newEnd = dragStartZoomRef.current.end + shiftBars;

    if (newStart < 0) {
      newStart = 0;
      newEnd = windowLen;
    } else if (newEnd > chartData.length) {
      newEnd = chartData.length;
      newStart = Math.max(0, chartData.length - windowLen);
    }

    setZoomStart(newStart);
    setZoomEnd(newEnd);
  };

  const handleMouseUpOrLeave = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsPanning(false);
    }
  };

  const touchStartDistRef = React.useRef<number | null>(null);
  const touchStartSingleXRef = React.useRef<number | null>(null);
  const touchStartZoomRef = React.useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2-finger smooth pinch zoom
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      touchStartDistRef.current = dist;
      touchStartSingleXRef.current = null;
      touchStartZoomRef.current = { start: effectiveStart, end: effectiveEnd };
      setIsPanning(true);
    } else if (e.touches.length === 1) {
      // 1-finger horizontal pan (drag)
      touchStartDistRef.current = null;
      touchStartSingleXRef.current = e.touches[0].clientX;
      touchStartZoomRef.current = { start: effectiveStart, end: effectiveEnd };
      setIsPanning(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current && touchStartDistRef.current > 0 && chartContainerRef.current) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      if (dist < 10) return;

      const midX = (t0.clientX + t1.clientX) / 2;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const plotLeft = rect.left + 10;
      const plotWidth = Math.max(80, (rect.width || 600) - 65);
      const ratio = Math.max(0, Math.min(1, (midX - plotLeft) / plotWidth));

      const origLen = touchStartZoomRef.current.end - touchStartZoomRef.current.start;
      const scale = touchStartDistRef.current / dist;
      const newLen = Math.max(5, Math.min(chartData.length, Math.round(origLen * scale)));

      const anchorCandle = touchStartZoomRef.current.start + ratio * origLen;
      let newStart = Math.round(anchorCandle - ratio * newLen);
      let newEnd = newStart + newLen;

      if (newStart < 0) {
        newStart = 0;
        newEnd = Math.min(chartData.length, newLen);
      } else if (newEnd > chartData.length) {
        newEnd = chartData.length;
        newStart = Math.max(0, chartData.length - newLen);
      }

      setZoomStart(newStart);
      setZoomEnd(newEnd);
    } else if (e.touches.length === 1 && touchStartSingleXRef.current !== null && chartContainerRef.current) {
      const currentX = e.touches[0].clientX;
      const deltaX = currentX - touchStartSingleXRef.current;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const containerWidth = rect.width || 600;
      const windowLen = touchStartZoomRef.current.end - touchStartZoomRef.current.start;
      const candlesPerPixel = windowLen / containerWidth;
      const shiftBars = Math.round(-deltaX * candlesPerPixel);

      let newStart = touchStartZoomRef.current.start + shiftBars;
      let newEnd = touchStartZoomRef.current.end + shiftBars;

      if (newStart < 0) {
        newStart = 0;
        newEnd = windowLen;
      } else if (newEnd > chartData.length) {
        newEnd = chartData.length;
        newStart = Math.max(0, chartData.length - windowLen);
      }

      setZoomStart(newStart);
      setZoomEnd(newEnd);
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
    touchStartSingleXRef.current = null;
    setIsPanning(false);
  };

  interface TooltipPropsType {
    active?: boolean;
    payload?: Array<{ payload: ChartDataItem }>;
    label?: string;
  }

  const CustomTooltip: React.FC<TooltipPropsType> = ({ active, payload, label }) => {
    if (isPanning || !active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const isUp = (data.close ?? 0) >= (data.open ?? 0);
    const pct = data.open ? (((data.close - data.open) / data.open) * 100).toFixed(2) : '0.00';
    const totalVolAsset = (data.takerBuy ?? 0) + (data.takerSell ?? 0);
    const totalVolUSD = data.quoteVolume || (totalVolAsset * (data.close ?? 0));
    const takerBuyPct = totalVolAsset > 0 ? ((data.takerBuy ?? 0) / totalVolAsset) * 100 : 50;
    const takerSellPct = totalVolAsset > 0 ? ((data.takerSell ?? 0) / totalVolAsset) * 100 : 50;

    return (
      <div className="bg-neutral-950/95 backdrop-blur-md border border-neutral-800 p-3 rounded-xl shadow-2xl text-xs space-y-2.5 min-w-[240px] z-50 pointer-events-none">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
          <span className="font-mono text-neutral-400 font-semibold">{data.time || label}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isUp ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
            {isUp ? `+${pct}%` : `${pct}%`}
          </span>
        </div>

        {/* Preços OHLC */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
          <div className="text-neutral-400">Abertura: <span className="text-white font-semibold">${formatPrice(data.open)}</span></div>
          <div className="text-neutral-400">Fechamento: <span className="text-white font-semibold">${formatPrice(data.close)}</span></div>
          <div className="text-neutral-400">Máxima: <span className="text-emerald-400 font-semibold">${formatPrice(data.high)}</span></div>
          <div className="text-neutral-400">Mínima: <span className="text-rose-400 font-semibold">${formatPrice(data.low)}</span></div>
        </div>

        {/* Volume da Vela: Ativo e USD (Passo 2) */}
        {totalVolAsset > 0 && (
          <div className="border-t border-neutral-800/80 pt-2 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between items-center text-neutral-300">
              <span className="text-neutral-400">Vol. Total Vela:</span>
              <span className="font-bold text-white">
                {formatCompactNumber(totalVolAsset)} {baseAsset} <span className="text-neutral-400 font-normal">(${formatCompactNumber(totalVolUSD)})</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] pt-0.5">
              <div className="bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20">
                <span className="text-emerald-400 font-bold block">Compra Taker:</span>
                <span className="text-emerald-300 font-semibold">
                  {formatCompactNumber(data.takerBuy ?? 0)} {baseAsset}
                </span>
                <span className="text-emerald-500 block text-[9px]">
                  ${formatCompactNumber(data.takerBuyUSD ?? (data.takerBuy ?? 0) * data.close)} ({takerBuyPct.toFixed(0)}%)
                </span>
              </div>

              <div className="bg-rose-500/10 p-1.5 rounded border border-rose-500/20">
                <span className="text-rose-400 font-bold block">Venda Taker:</span>
                <span className="text-rose-300 font-semibold">
                  {formatCompactNumber(data.takerSell ?? 0)} {baseAsset}
                </span>
                <span className="text-rose-500 block text-[9px]">
                  ${formatCompactNumber(data.takerSellUSD ?? (data.takerSell ?? 0) * data.close)} ({takerSellPct.toFixed(0)}%)
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] pt-0.5 border-t border-white/5">
              <span className="text-neutral-400">Delta da Vela:</span>
              <span className={`font-bold ${(data.delta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(data.delta ?? 0) >= 0 ? '+' : ''}{formatCompactNumber(data.delta ?? 0)} {baseAsset} 
                <span className="text-neutral-400 font-normal ml-1">
                  ({(data.delta ?? 0) >= 0 ? '+' : ''}${formatCompactNumber(data.deltaUSD ?? (data.delta ?? 0) * data.close)})
                </span>
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

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

  const volumeProfileData = useMemo(() => {
    const target = slicedData.length > 0 ? slicedData : chartData;
    if (!target.length || !ticker) return null;
    return calculateVolumeProfile(target, volumeProfileBins, 0.70);
  }, [slicedData, chartData, ticker?.symbol, volumeProfileBins]);

  const defaultFib = ticker.fibonacci || {
    fib0: 0,
    fib236: 0,
    fib382: 0,
    fib50: 0,
    fib618: 0,
    fib68: 0,
    fib786: 0,
    fib100: 0,
    swingHigh: 0,
    swingLow: 0,
    inGoldenPocket: false,
    trend: 'UP',
    point1Price: 0,
    point0Price: 0,
    point1Label: '1 (0.00)',
    point0Label: '0 (0.00)',
    point1Type: 'LL',
    point0Type: 'HH'
  };
  const fib = activeFibLevels || defaultFib;
  const range = ticker.rangeProfile || { vah: 0, val: 0, poc: 0 };
  const price = ticker.price ?? 0;
  const changePct = ticker.priceChangePercent24h ?? 0;

  // Dynamic Volume Profile (VAH, VAL, POC) synchronized to the active timeframe
  const dynamicVolumeProfile = volumeProfileData;
  const dynamicVah = dynamicVolumeProfile?.vah ?? range.vah;
  const dynamicVal = dynamicVolumeProfile?.val ?? range.val;
  const dynamicPoc = dynamicVolumeProfile?.poc ?? range.poc;
  const isInsideValueArea = dynamicVal > 0 && dynamicVah > 0 && price >= dynamicVal && price <= dynamicVah;
  const isAboveVah = dynamicVah > 0 && price > dynamicVah;
  const isBelowVal = dynamicVal > 0 && price < dynamicVal;

  const renderMarketProfileOverlay = () => {
    if (!valueAreaOverlayEnabled || (!dynamicPoc && !dynamicVah && !dynamicVal)) return null;

    return (
      <React.Fragment key="market-profile-overlay">
        {/* Shaded 70% Value Area Range for Selected Timeframe */}
        {dynamicVal > 0 && dynamicVah > 0 && dynamicVah > dynamicVal && (
          <ReferenceArea
            y1={dynamicVal}
            y2={dynamicVah}
            {...({
              fill: "#06b6d4",
              fillOpacity: 0.04,
              stroke: "#06b6d4",
              strokeOpacity: 0.25,
              strokeDasharray: "2 2"
            } as any)}
          />
        )}

        {/* VAH Line (Value Area High) */}
        {dynamicVah > 0 && (
          <ReferenceLine
            y={dynamicVah}
            stroke="#38bdf8"
            strokeDasharray="3 3"
            strokeWidth={1.2}
            label={{
              value: `VAH (${timeframe}) • ${formatPrice(dynamicVah, { currency: true })}`,
              fill: '#38bdf8',
              fontSize: 9,
              fontWeight: 700,
              position: 'insideRight'
            }}
          />
        )}

        {/* POC Line (Point of Control) */}
        {dynamicPoc > 0 && (
          <ReferenceLine
            y={dynamicPoc}
            stroke="#06b6d4"
            strokeDasharray="4 2"
            strokeWidth={1.8}
            label={{
              value: `POC (${timeframe}) • ${formatPrice(dynamicPoc, { currency: true })}`,
              fill: '#06b6d4',
              fontSize: 9,
              fontWeight: 800,
              position: 'insideRight'
            }}
          />
        )}

        {/* VAL Line (Value Area Low) */}
        {dynamicVal > 0 && (
          <ReferenceLine
            y={dynamicVal}
            stroke="#38bdf8"
            strokeDasharray="3 3"
            strokeWidth={1.2}
            label={{
              value: `VAL (${timeframe}) • ${formatPrice(dynamicVal, { currency: true })}`,
              fill: '#38bdf8',
              fontSize: 9,
              fontWeight: 700,
              position: 'insideRight'
            }}
          />
        )}
      </React.Fragment>
    );
  };

  const renderFibonacciOverlay = () => {
    if (!fibOverlayEnabled) return null;
    const p1 = fib.point1Price || (fib.trend === 'DOWN' ? fib.swingHigh : fib.swingLow);
    const p0 = fib.point0Price || (fib.trend === 'DOWN' ? fib.swingLow : fib.swingHigh);
    const p1Type = fib.point1Type || (fib.trend === 'DOWN' ? 'HH' : 'LL');
    const p0Type = fib.point0Type || (fib.trend === 'DOWN' ? 'LL' : 'HH');

    const gpMin = Math.min(fib.fib618 || 0, fib.fib68 || 0);
    const gpMax = Math.max(fib.fib618 || 0, fib.fib68 || 0);

    return (
      <React.Fragment key="fibo-overlay">
        {/* Shaded Golden Pocket Zone */}
        {gpMin > 0 && gpMax > 0 && (
          <ReferenceArea
            y1={gpMin}
            y2={gpMax}
            {...({
              fill: "#f59e0b",
              fillOpacity: 0.09,
              stroke: "#f59e0b",
              strokeOpacity: 0.3,
              strokeDasharray: "2 2"
            } as any)}
          />
        )}

        {/* Point 1 (Início do Swing - 1.0) */}
        {p1 > 0 && (
          <ReferenceLine
            y={p1}
            stroke="#ffffff"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: `1 (${p1Type}) • ${formatPrice(p1, { currency: true })}`,
              fill: '#ffffff',
              fontSize: 9,
              fontWeight: 700,
              position: 'insideRight'
            }}
          />
        )}

        {/* 0.786 Level */}
        {fib.fib786 && fib.fib786 > 0 && (
          <ReferenceLine
            y={fib.fib786}
            stroke="#c084fc"
            strokeDasharray="3 3"
            strokeWidth={1}
            label={{
              value: `0.786 (${formatPrice(fib.fib786, { currency: true })})`,
              fill: '#c084fc',
              fontSize: 9,
              position: 'insideRight'
            }}
          />
        )}

        {/* 0.68 Level (Golden Pocket Ext) */}
        {fib.fib68 > 0 && (
          <ReferenceLine
            y={fib.fib68}
            stroke="#ffffff"
            strokeDasharray="2 2"
            strokeWidth={1.2}
            label={{
              value: `0.68 (GP ${timeframe}) • ${formatPrice(fib.fib68, { currency: true })}`,
              fill: '#ffffff',
              fontSize: 9,
              fontWeight: 700,
              position: 'insideRight'
            }}
          />
        )}

        {/* 0.618 Level (Golden Pocket Core - TradingView Yellow) */}
        {fib.fib618 > 0 && (
          <ReferenceLine
            y={fib.fib618}
            stroke="#facc15"
            strokeDasharray="3 3"
            strokeWidth={1.5}
            label={{
              value: `0.618 (GP ${timeframe}) • ${formatPrice(fib.fib618, { currency: true })}`,
              fill: '#facc15',
              fontSize: 9,
              fontWeight: 800,
              position: 'insideRight'
            }}
          />
        )}

        {/* 0.50 Level (Equilíbrio) */}
        {fib.fib50 > 0 && (
          <ReferenceLine
            y={fib.fib50}
            stroke="#06b6d4"
            strokeDasharray="3 3"
            strokeWidth={1}
            label={{
              value: `0.50 • ${formatPrice(fib.fib50, { currency: true })}`,
              fill: '#06b6d4',
              fontSize: 9,
              position: 'insideRight'
            }}
          />
        )}

        {/* 0.382 Level */}
        {fib.fib382 && fib.fib382 > 0 && (
          <ReferenceLine
            y={fib.fib382}
            stroke="#60a5fa"
            strokeDasharray="3 3"
            strokeWidth={1}
            label={{
              value: `0.382 (${formatPrice(fib.fib382, { currency: true })})`,
              fill: '#60a5fa',
              fontSize: 9,
              position: 'insideRight'
            }}
          />
        )}

        {/* 0.236 Level */}
        {fib.fib236 && fib.fib236 > 0 && (
          <ReferenceLine
            y={fib.fib236}
            stroke="#a3a3a3"
            strokeDasharray="2 2"
            strokeWidth={1}
            label={{
              value: `0.236 (${formatPrice(fib.fib236, { currency: true })})`,
              fill: '#a3a3a3',
              fontSize: 9,
              position: 'insideRight'
            }}
          />
        )}

        {/* Point 0 (Fim do Swing - 0.0) */}
        {p0 > 0 && (
          <ReferenceLine
            y={p0}
            stroke="#ffffff"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: `0 (${p0Type}) • ${formatPrice(p0, { currency: true })}`,
              fill: '#ffffff',
              fontSize: 9,
              fontWeight: 700,
              position: 'insideRight'
            }}
          />
        )}
      </React.Fragment>
    );
  };

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

  const detectedPattern = useMemo(() => {
    return ticker ? getTopDetectedPattern(ticker) : null;
  }, [ticker]);

  return (
    <div className="space-y-4 font-mono pb-10">
      {/* Top Asset Switcher Bar */}
      <div className="bg-[#0A0A0A] p-3 rounded-lg border border-white/10 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 text-orange-400 rounded border border-orange-500/20">
            <ChartIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="text-base font-extrabold text-white">{ticker.symbol}</h2>
              <span className="text-[10px] bg-neutral-900 text-neutral-300 font-bold px-1.5 py-0.5 rounded border border-white/5">
                Sniper Dashboard
              </span>
              {detectedPattern && (
                <PatternBadge pattern={detectedPattern} />
              )}
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
            <AppTooltip
              position="bottom"
              title="Estilo Operacional do Agente"
              badge="PERSONA"
              content="Configura o viés da inteligência artificial (Conservador, Agressivo, Wyckoff, Scalper ou Price Action) na análise técnica deste gráfico."
            >
              <div className="flex items-center gap-1.5 bg-[#050505] px-2.5 py-1.5 rounded-lg border border-cyan-500/20">
                <UserCheck className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
                <select
                  value={selectedPersona}
                  onChange={(e) => setSelectedPersona(e.target.value)}
                  className="bg-transparent text-cyan-300 text-xs font-bold focus:outline-none cursor-pointer max-w-[170px] truncate"
                >
                  {DEFAULT_AI_PERSONAS.map(p => (
                    <option key={p.id} value={p.id} className="bg-[#0A0A0A] text-white">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </AppTooltip>

            <AppTooltip
              position="left"
              title={aiReview ? "Re-Executar Auditoria de IA" : "Executar Auditoria IA do Ativo"}
              badge="AUDIT"
              content="Envia os dados de Orderflow, Volume Profile, Suporte/Resistência e Médias para o motor de IA avaliar o risco/retorno atual."
            >
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
            </AppTooltip>
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
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  Sinal Algorítmico {activeSignal?.strategyCategory ? `(${activeSignal.strategyCategory})` : '(Quant Bot)'}
                </span>
              </div>
              {activeSignal ? (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-neutral-400 uppercase bg-neutral-900 px-1.5 py-0.5 rounded border border-white/5">
                    TF {activeSignal.timeframe || '30m'}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase border ${
                    activeSignal.direction === 'LONG'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  }`}>
                    {activeSignal.direction} ({activeSignal.signalType})
                  </span>
                </div>
              ) : (
                <span className="text-[10px] font-bold text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-white/5">
                  Sem sinal ativo
                </span>
              )}
            </div>

            {/* Concurrent Multi-Strategy Selector Bar */}
            {tickerSignals.length > 1 && (
              <div className="bg-[#0A0A0A] p-2 rounded-lg border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
                  <span>Estratégias Concorrentes Ativas ({tickerSignals.length})</span>
                  <span className="text-cyan-400 font-normal">Clique para alternar o setup no gráfico</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {tickerSignals.map(sig => {
                    const isSelected = activeSignal?.id === sig.id;
                    const isSigLong = sig.direction === 'LONG';
                    return (
                      <button
                        key={sig.id}
                        onClick={() => {
                          if (onSelectSignal) onSelectSignal(sig);
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-extrabold transition flex items-center gap-1.5 border cursor-pointer ${
                          isSelected
                            ? isSigLong
                              ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                              : 'bg-rose-500/25 text-rose-300 border-rose-500 shadow-md ring-1 ring-rose-500/50'
                            : 'bg-neutral-900/90 text-neutral-400 border-white/10 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        <span>{isSigLong ? '🟢' : '🔴'}</span>
                        <span>{sig.strategyCategory || 'INTRADAY'} ({sig.timeframe || '30m'})</span>
                        <span className="opacity-90 uppercase font-black">{sig.direction}</span>
                        <span className="text-[9px] px-1 rounded bg-black/50 text-orange-300 font-mono font-bold">
                          {sig.confluenceScore}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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

                  {/* Temporal Metadata: Identificado & Validado/Rejeitado */}
                  <div className="border-t border-white/5 pt-1.5 space-y-1 font-mono text-[9px]">
                    <div className="flex items-center justify-between text-neutral-300">
                      <span className="flex items-center gap-1 text-neutral-400">
                        <Clock className="h-3 w-3 text-cyan-400 shrink-0" />
                        <span className="uppercase font-bold text-[8.5px]">Identificado:</span>
                      </span>
                      <span className="text-white font-bold">
                        {formatDateTime(activeSignal.createdAt)} <span className="text-neutral-400 font-normal">({formatTimeAgo(activeSignal.createdAt)})</span>
                      </span>
                    </div>

                    {activeSignal.validationStatus === 'CONFIRMED' && (
                      <div className="flex items-center justify-between text-emerald-400 border-t border-white/5 pt-1">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                          <span className="uppercase font-bold text-[8.5px]">Validado:</span>
                        </span>
                        <span className="text-emerald-300 font-extrabold">
                          {formatDateTime(activeSignal.validatedAt || activeSignal.createdAt)}
                        </span>
                      </div>
                    )}

                    {(activeSignal.validationStatus === 'REJECTED_SPIKE' || activeSignal.validationStatus === 'REJECTED_BACKTEST') && (
                      <div className="flex items-center justify-between text-rose-400 border-t border-white/5 pt-1">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
                          <span className="uppercase font-bold text-[8.5px]">Rejeitado:</span>
                        </span>
                        <span className="text-rose-300 font-extrabold">
                          {formatDateTime(activeSignal.rejectedAt || activeSignal.validatedAt || activeSignal.createdAt)}
                        </span>
                      </div>
                    )}

                    {activeSignal.validationStatus === 'PENDING_VALIDATION' && (
                      <div className="flex items-center justify-between text-amber-400 border-t border-white/5 pt-1 animate-pulse">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-amber-400 shrink-0" />
                          <span className="uppercase font-bold text-[8.5px]">Validação:</span>
                        </span>
                        <span className="text-amber-300 font-bold">
                          Aguardando confirmação 1m/5m...
                        </span>
                      </div>
                    )}
                  </div>

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

        {/* Position Sizer & PnL Calculator for the Selected Signal & Ticker */}
        {ticker && (
          <PositionSizerCalculator
            ticker={ticker}
            activeSignal={activeSignal}
            aiReview={aiReview}
          />
        )}

        {/* Paper Trading Sandbox: Live risk-free simulated trading widget with commission impact */}
        {ticker && (
          <PaperTradingSandbox
            ticker={ticker}
            allTickers={allTickers}
            activeSignal={activeSignal}
            aiReview={aiReview}
            onSelectTickerBySymbol={onSelectTickerBySymbol}
          />
        )}
      </div>

      {/* Main Full-Width Chart Section & Order Flow Sub-Charts */}
      <div className="w-full bg-[#0A0A0A] p-4.5 rounded-xl border border-white/10 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="text-xl font-black text-white flex items-center gap-2">
              {formatPrice(price, { currency: true })}
              {loading && <RefreshCw className="h-4 w-4 text-neutral-500 animate-spin" />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-bold ${changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {changePct >= 0 ? '▲ ' : '▼ '}{formatPercent(changePct)} (24h)
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">•</span>
              <span className="text-[10px] text-cyan-400 font-bold font-mono">
                TF Ativo: {timeframe.toUpperCase()}
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Timeframe Selector with Prominent Toggle Buttons */}
            <div className="flex items-center bg-[#050505] rounded-lg border border-white/10 p-0.5 shadow-inner">
              {[
                { tf: '1m', label: '1M', desc: 'Scalping Ultra-Rápido' },
                { tf: '3m', label: '3M', desc: 'Scalp Médio' },
                { tf: '5m', label: '5M', desc: 'Day Trade Rápido' },
                { tf: '15m', label: '15M', desc: 'Intraday Principal' },
                { tf: '30m', label: '30M', desc: 'Intraday Expandido' },
                { tf: '1h', label: '1H', desc: 'Swing Trade Horário' },
                { tf: '4h', label: '4H', desc: 'Tendência 4 Horas' },
                { tf: '1d', label: '1D', desc: 'Diário Macro' },
                { tf: '1w', label: '1W', desc: 'Semanal Institucional' }
              ].map(item => (
                <button
                  key={item.tf}
                  onClick={() => setTimeframe(item.tf)}
                  title={`${item.label} - ${item.desc}`}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-0.5 ${
                    timeframe === item.tf
                      ? 'bg-orange-500 text-black shadow-sm font-black'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
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

            {/* Zoom Controls & Pan Mode */}
            <div className="flex items-center bg-[#050505] rounded border border-white/5 p-0.5 shadow-inner gap-0.5">
              <AppTooltip
                position="top"
                title={dragModeActive ? "Modo Arrastar Ativo" : "Ativar Modo Arrastar"}
                badge="TRADINGVIEW PAN"
                content="Clique e arraste o gráfico para a esquerda ou direita para navegar pelo histórico, ou role a roda do mouse para dar zoom."
              >
                <button
                  onClick={() => setDragModeActive(!dragModeActive)}
                  aria-label="Alternar Modo Arrastar Gráfico"
                  className={`px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 ${dragModeActive ? 'bg-orange-500 text-black shadow-sm' : 'text-neutral-400 hover:text-white'}`}
                >
                  <Hand className="h-3 w-3" />
                  <span className="hidden sm:inline">Arrastar</span>
                </button>
              </AppTooltip>

              <div className="w-[1px] h-3 bg-neutral-800 mx-0.5" />

              <AppTooltip
                position="top"
                title="Aumentar Zoom"
                badge="ZOOM IN (+)"
                content="Foca a visualização nas velas e no perfil de volume mais recentes."
              >
                <button
                  onClick={handleZoomIn}
                  aria-label="Aumentar Zoom (+)"
                  className="px-2 py-1 rounded text-[10px] font-bold text-neutral-400 hover:text-white transition"
                >
                  +
                </button>
              </AppTooltip>

              <AppTooltip
                position="top"
                title="Diminuir Zoom"
                badge="ZOOM OUT (-)"
                content="Amplia a janela temporal exibida para visualizar um histórico maior de velas e níveis de suporte."
              >
                <button
                  onClick={handleZoomOut}
                  aria-label="Diminuir Zoom (-)"
                  className="px-2 py-1 rounded text-[10px] font-bold text-neutral-400 hover:text-white transition"
                >
                  -
                </button>
              </AppTooltip>

              <div className="w-[1px] h-3 bg-neutral-800 mx-0.5" />

              {/* Zoom-To-Fit Toggle Button */}
              <AppTooltip
                position="top"
                title={isFullRange ? "Restaurar Visão Foco" : "Ajustar à Tela (Zoom-to-Fit)"}
                badge={isFullRange ? "FOCO ANTERIOR" : "100% TOTAL"}
                content={
                  isFullRange
                    ? "Alterna de volta para a visão focada ou período personalizado anterior."
                    : "Expande a visualização para enquadrar 100% do range de dados da série. Clique novamente para alternar com a visão focada."
                }
              >
                <button
                  onClick={handleToggleZoomToFit}
                  aria-label="Zoom to Fit: Alternar entre range total e visão atual"
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition flex items-center gap-1.5 ${
                    isFullRange
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-xs'
                      : 'text-neutral-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {isFullRange ? (
                    <>
                      <Minimize2 className="h-3 w-3 text-orange-400" />
                      <span>Foco</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3 w-3" />
                      <span>Ajustar (Fit)</span>
                    </>
                  )}
                </button>
              </AppTooltip>
            </div>

            {/* User-Defined Price Alert Manager, Central Bulk Manager & Audio Settings */}
            {ticker && (
              <div className="flex items-center gap-1.5">
                <PriceAlertManager
                  ticker={ticker}
                  onOpenBulkManager={() => setShowBulkAlertManager(true)}
                  onAlertTriggered={(triggeredAlert) => {
                    try {
                      const stored = localStorage.getItem('superbot_user_price_alerts');
                      if (stored) setUserAlerts(JSON.parse(stored));
                    } catch {
                      // ignore
                    }
                  }}
                />

                {/* Centralized Bulk Price Alert Manager Trigger Button */}
                <AppTooltip
                  position="top"
                  title="Gerenciador Geral de Alarmes (Bulk Manager)"
                  badge={`${userAlerts.length} TOTAL`}
                  content="Acesse a tabela centralizada para visualizar, filtrar, criar, pausar/ativar e excluir múltiplos alarmes em lote para todos os ativos cadastrados."
                >
                  <button
                    onClick={() => setShowBulkAlertManager(true)}
                    aria-label="Abrir Gerenciador Geral de Alarmes em Massa"
                    className="px-2.5 py-1 rounded text-[10px] font-bold transition flex items-center gap-1.5 border bg-[#050505] text-neutral-300 border-white/10 hover:border-orange-500/40 hover:text-white active:scale-95 shadow-xs"
                  >
                    <Sliders className="h-3.5 w-3.5 text-orange-400" />
                    <span className="hidden sm:inline">Central de Alarmes</span>
                    <span className="text-[9px] bg-orange-500/20 text-orange-300 px-1.5 py-0.2 rounded font-mono font-bold">
                      {userAlerts.length}
                    </span>
                  </button>
                </AppTooltip>

                <AlertSoundSettingsMenu />
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Multi-Timeframe HUD Status Strip (Fibonacci & Market Profile VAH/VAL/POC Synchronization) */}
        <div className="bg-[#050505] p-2.5 rounded-lg border border-white/10 flex flex-wrap items-center justify-between gap-2.5 text-[10px] font-mono shadow-md">
          <div className="flex flex-wrap items-center gap-3">
            {/* Active Timeframe Badge */}
            <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20 font-bold">
              <Clock className="h-3.5 w-3.5" />
              <span>TIMEFRAME: {timeframe.toUpperCase()}</span>
              <span className="text-[9px] text-neutral-400 font-normal">
                ({slicedData.length || chartData.length}v carregadas)
              </span>
            </div>

            {/* Dynamic Market Profile (VAH / POC / VAL) Real-Time Levels */}
            <div className="flex items-center gap-2 bg-[#0A0A0A] px-2.5 py-0.5 rounded border border-cyan-500/20">
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-neutral-400 font-bold">Market Profile ({timeframe}):</span>
              <span className="text-cyan-300 font-bold">VAH: {formatPrice(dynamicVah)}</span>
              <span className="text-neutral-500">|</span>
              <span className="text-cyan-400 font-black">POC: {formatPrice(dynamicPoc)}</span>
              <span className="text-neutral-500">|</span>
              <span className="text-cyan-300 font-bold">VAL: {formatPrice(dynamicVal)}</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                isInsideValueArea
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : isAboveVah
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}>
                {isInsideValueArea ? 'Na Value Area' : isAboveVah ? 'Acima do VAH' : 'Abaixo do VAL'}
              </span>
            </div>

            {/* Dynamic Fibonacci Retracement & Golden Pocket Status */}
            <div className="flex items-center gap-2 bg-[#0A0A0A] px-2.5 py-0.5 rounded border border-orange-500/20">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-neutral-400 font-bold">Fibonacci ({timeframe}):</span>
              <span className="text-neutral-300">
                {fib.trend === 'DOWN' ? 'Baixa (HH 1 ➔ LL 0)' : 'Alta (LL 1 ➔ HH 0)'}
              </span>
              {fib.fib618 > 0 && fib.fib68 > 0 && (
                <span className="text-yellow-400 font-bold bg-yellow-400/10 px-1 py-0.2 rounded border border-yellow-400/20">
                  GP: {formatPrice(Math.min(fib.fib618, fib.fib68))} - {formatPrice(Math.max(fib.fib618, fib.fib68))}
                </span>
              )}
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                fib.inGoldenPocket ? 'bg-orange-500/20 text-orange-400 animate-pulse' : 'bg-neutral-900 text-neutral-400'
              }`}>
                {fib.inGoldenPocket ? '🔥 No Golden Pocket' : 'Fora da Zona'}
              </span>
            </div>
          </div>
        </div>

        {/* Liquidity Heatmap, Volume Profile, Fibonacci & Value Area Overlay Badges & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <LiquidityHeatmapBadge
            heatmapData={heatmapData}
            visible={heatmapEnabled}
            onToggle={() => setHeatmapEnabled(!heatmapEnabled)}
            bucketCount={heatmapBucketCount}
            onChangeBucketCount={(cnt) => setHeatmapBucketCount(cnt)}
          />

          {/* Volume Profile, Fibonacci, Value Area & Volume Delta Controls */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
            {/* Toggle Fibonacci Overlay on Chart */}
            <AppTooltip
              position="top"
              title={`Overlay de Fibonacci (${timeframe.toUpperCase()})`}
              badge={fibOverlayEnabled ? "FIBO ATIVO NO GRÁFICO" : "FIBO OCULTO"}
              content="Exibe as linhas de retração de Fibonacci e a área sombreada do Golden Pocket (0.618 - 0.68) calculadas dinamicamente para o timeframe atual."
            >
              <button
                type="button"
                onClick={() => setFibOverlayEnabled(!fibOverlayEnabled)}
                className={`px-2.5 py-1 rounded-lg border font-bold transition flex items-center gap-1.5 ${
                  fibOverlayEnabled
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-xs'
                    : 'bg-[#050505] text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                <Flame className={`h-3.5 w-3.5 ${fibOverlayEnabled ? 'text-orange-400' : 'text-neutral-500'}`} />
                <span>Fibo Overlay ({timeframe.toUpperCase()})</span>
                {fib.fib618 > 0 && (
                  <span className="text-[9px] bg-yellow-400/20 text-yellow-300 px-1 py-0.2 rounded font-bold">
                    0.618 {formatPrice(fib.fib618)}
                  </span>
                )}
              </button>
            </AppTooltip>

            {/* Toggle Value Area & VAH/VAL/POC Lines on Chart */}
            <AppTooltip
              position="top"
              title={`Área de Valor VAH / VAL / POC (${timeframe.toUpperCase()})`}
              badge={valueAreaOverlayEnabled ? "VAH/VAL/POC ATIVO" : "OCULTO"}
              content="Exibe as linhas de referência de VAH (Value Area High), POC (Point of Control) e VAL (Value Area Low) juntamente com a faixa sombreada de 70% de volume para o timeframe selecionado."
            >
              <button
                type="button"
                onClick={() => setValueAreaOverlayEnabled(!valueAreaOverlayEnabled)}
                className={`px-2.5 py-1 rounded-lg border font-bold transition flex items-center gap-1.5 ${
                  valueAreaOverlayEnabled
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-xs'
                    : 'bg-[#050505] text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                <Target className={`h-3.5 w-3.5 ${valueAreaOverlayEnabled ? 'text-cyan-400' : 'text-neutral-500'}`} />
                <span>VAH/VAL/POC ({timeframe.toUpperCase()})</span>
                {dynamicPoc > 0 && (
                  <span className="text-[9px] bg-cyan-400/20 text-cyan-300 px-1 py-0.2 rounded font-bold">
                    POC {formatPrice(dynamicPoc)}
                  </span>
                )}
              </button>
            </AppTooltip>

            {/* Toggle Volume Profile On Chart */}
            <AppTooltip
              position="top"
              title="Volume Profile do Range (VP)"
              badge={volumeProfileEnabled ? "ATIVO NO GRÁFICO" : "OCULTO"}
              content="Projeta barras horizontais de distribuição de volume por faixa de preço diretamente no gráfico, com destaque para o POC (Point of Control) e Área de Valor (70%)."
            >
              <button
                type="button"
                onClick={() => setVolumeProfileEnabled(!volumeProfileEnabled)}
                className={`px-2.5 py-1 rounded-lg border font-bold transition flex items-center gap-1.5 ${
                  volumeProfileEnabled
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-xs'
                    : 'bg-[#050505] text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                <Layers className={`h-3.5 w-3.5 ${volumeProfileEnabled ? 'text-cyan-400 animate-pulse' : 'text-neutral-500'}`} />
                <span>Volume Profile (VP)</span>
              </button>
            </AppTooltip>

            {/* Volume Profile Resolution Selector */}
            {volumeProfileEnabled && (
              <div className="flex items-center bg-[#050505] rounded border border-white/10 p-0.5">
                {[24, 36, 48, 64].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setVolumeProfileBins(cnt)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition ${
                      volumeProfileBins === cnt ? 'bg-cyan-500 text-black shadow' : 'text-neutral-500 hover:text-white'
                    }`}
                  >
                    {cnt}L
                  </button>
                ))}
              </div>
            )}

            {/* Volume Profile Side Position Toggle */}
            {volumeProfileEnabled && (
              <button
                type="button"
                onClick={() => setVolumeProfileSide(volumeProfileSide === 'right' ? 'left' : 'right')}
                className="px-2 py-1 rounded border bg-[#050505] text-neutral-400 border-white/10 hover:text-white text-[9px] font-bold"
                title="Alternar lado do Volume Profile no gráfico (Direita / Esquerda)"
              >
                Lado: {volumeProfileSide === 'right' ? 'Dir' : 'Esq'}
              </button>
            )}

            {/* Toggle Detailed Volume Profile Distribution Inspector */}
            <AppTooltip
              position="top"
              title="Painel Detalhado de Volume Profile"
              badge="DISTRIBUIÇÃO DE LIQUIDEZ"
              content="Exibe a lista completa de níveis de preço com a divisão exata entre volume comprador e vendedor (Delta), High Volume Nodes (HVN) e Low Volume Nodes (LVN)."
            >
              <button
                type="button"
                onClick={() => setShowDetailedVolumeProfile(!showDetailedVolumeProfile)}
                className={`px-2.5 py-1 rounded-lg border font-bold transition flex items-center gap-1.5 ${
                  showDetailedVolumeProfile
                    ? 'bg-cyan-500/25 text-cyan-200 border-cyan-500 shadow-xs ring-1 ring-cyan-500/50'
                    : 'bg-[#050505] text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
                <span>Níveis Detalhados</span>
              </button>
            </AppTooltip>

            {/* Toggle Real-time Volume Delta Gauge */}
            <AppTooltip
              position="top"
              title="Medidor de Volume Delta Real-Time"
              badge={showVolumeDeltaGauge ? "GAUGE ATIVO" : "GAUGE OCULTO"}
              content="Visualizador em ponteiro (gauge) de agressão compradora vs vendedora na sessão atual."
            >
              <button
                type="button"
                onClick={() => setShowVolumeDeltaGauge(!showVolumeDeltaGauge)}
                className={`px-2.5 py-1 rounded-lg border font-bold transition flex items-center gap-1.5 ${
                  showVolumeDeltaGauge
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                    : 'bg-[#050505] text-neutral-400 border-white/10 hover:text-white'
                }`}
              >
                <Zap className={`h-3.5 w-3.5 ${showVolumeDeltaGauge ? 'text-emerald-400 animate-pulse' : 'text-neutral-500'}`} />
                <span>Volume Delta Gauge</span>
                {volumeProfileData && (
                  <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                    volumeProfileData.sessionDelta >= 0 ? 'text-emerald-300 bg-emerald-500/20' : 'text-rose-300 bg-rose-500/20'
                  }`}>
                    {volumeProfileData.sessionDelta >= 0 ? '+' : ''}{volumeProfileData.pressureScore.toFixed(0)}%
                  </span>
                )}
              </button>
            </AppTooltip>
          </div>
        </div>

        {/* Recharts Area Chart / Candlestick Chart (Expanded Height for Pristine Readability) */}
        <div 
          ref={chartContainerRef}
          style={{ touchAction: 'none' }}
          className={`h-80 sm:h-96 md:h-[380px] w-full pt-2 relative select-none transition-all ${
            dragModeActive 
              ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') 
              : (isPanning ? 'cursor-grabbing' : 'cursor-default')
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* On-Chart Horizontal Volume Profile Overlay */}
          <VolumeProfileOverlayOnChart
            volumeProfile={volumeProfileData}
            domainMin={domainMin}
            domainMax={domainMax}
            priceRange={priceRange}
            visible={volumeProfileEnabled}
            side={volumeProfileSide}
            widthPercent={22}
          />
          {/* Pan Indicator Pill when dragging or dragModeActive */}
          {dragModeActive && (
            <div className="absolute top-3 left-4 z-20 pointer-events-none flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-900/90 border border-orange-500/40 text-[10px] font-mono text-orange-400 backdrop-blur-md shadow-lg">
              <MoveHorizontal className="h-3 w-3 animate-pulse" />
              <span>{isPanning ? 'Arrastando timeline...' : 'Clique e arraste para os lados'}</span>
            </div>
          )}
          {loading ? (
            <div className="h-full flex items-center justify-center text-neutral-500 text-xs">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Carregando gráfico ({timeframe.toUpperCase()})...
            </div>
          ) : chartType === 'line' ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart syncId="cryptoSniperChart" data={slicedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke="#262626" />
                <XAxis dataKey="time" stroke="#737373" tick={{ fontSize: 9 }} />
                <YAxis domain={['auto', 'auto']} width={65} stroke="#737373" tick={{ fontSize: 9 }} orientation="right" />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#f97316', strokeWidth: 1, strokeDasharray: '3 3' }} />
                {/* Liquidity Heatmap Overlay Reference Areas */}
                <LiquidityHeatmapReferenceAreas heatmapData={heatmapData} visible={heatmapEnabled} />
                {/* Dynamic Value Area & VAH / VAL / POC Overlay */}
                {renderMarketProfileOverlay()}
                {/* Dynamic Fibonacci Retracement Levels & Golden Pocket Overlay */}
                {renderFibonacciOverlay()}
                {/* Active Signal / AI Review targets */}
                {(aiReview?.takeProfit1 || activeSignal?.target1) && (
                   <ReferenceLine y={aiReview?.takeProfit1 || activeSignal?.target1} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Alvo', fill: '#10b981', fontSize: 9 }} />
                )}
                {(aiReview?.stopLoss || activeSignal?.stopLoss) && (
                   <ReferenceLine y={aiReview?.stopLoss || activeSignal?.stopLoss} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Stop', fill: '#f43f5e', fontSize: 9 }} />
                )}
                {/* User-Defined Price Alerts */}
                {activeTickerPriceAlerts.map(alert => (
                  <ReferenceLine
                    key={alert.id}
                    y={alert.targetPrice}
                    stroke="#f59e0b"
                    strokeDasharray="4 2"
                    strokeWidth={1.5}
                    label={{
                      value: `🔔 Alarme: ${formatPrice(alert.targetPrice)}`,
                      fill: '#fbbf24',
                      fontSize: 9,
                      position: 'insideTopLeft'
                    }}
                  />
                ))}
                {/* Paper Trading Active Virtual Positions & Orders */}
                {activePaperPositions.map(pos => (
                  <React.Fragment key={pos.id}>
                    <ReferenceLine
                      y={pos.entryPrice}
                      stroke={pos.side === 'LONG' ? '#10b981' : '#f43f5e'}
                      strokeDasharray="4 2"
                      strokeWidth={1.5}
                      label={{
                        value: `📦 Paper ${pos.side} (${formatPrice(pos.entryPrice)})`,
                        fill: pos.side === 'LONG' ? '#34d399' : '#fb7185',
                        fontSize: 9,
                        position: 'insideLeft'
                      }}
                    />
                    {pos.takeProfit && (
                      <ReferenceLine
                        y={pos.takeProfit}
                        stroke="#059669"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        label={{
                          value: `🎯 Paper TP (${formatPrice(pos.takeProfit)})`,
                          fill: '#34d399',
                          fontSize: 9,
                          position: 'insideRight'
                        }}
                      />
                    )}
                    {pos.stopLoss && (
                      <ReferenceLine
                        y={pos.stopLoss}
                        stroke="#e11d48"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        label={{
                          value: `🛑 Paper SL (${formatPrice(pos.stopLoss)})`,
                          fill: '#fb7185',
                          fontSize: 9,
                          position: 'insideRight'
                        }}
                      />
                    )}
                  </React.Fragment>
                ))}
                {activePaperOrders.map(ord => (
                  <ReferenceLine
                    key={ord.id}
                    y={ord.price || ord.stopPrice}
                    stroke="#a855f7"
                    strokeDasharray="2 2"
                    label={{
                      value: `⏳ Paper ${ord.type} (${formatPrice(ord.price || ord.stopPrice)})`,
                      fill: '#c084fc',
                      fontSize: 9,
                      position: 'insideLeft'
                    }}
                  />
                ))}
                <Area type="monotone" dataKey="price" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#priceGradient)" activeDot={{ r: 4, fill: '#f97316', stroke: '#ffffff', strokeWidth: 1.5 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart syncId="cryptoSniperChart" data={slicedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#262626" />
                <XAxis dataKey="time" stroke="#737373" tick={{ fontSize: 9 }} />
                <YAxis domain={[domainMin, domainMax]} width={65} stroke="#737373" tick={{ fontSize: 9 }} orientation="right" />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#f97316', strokeWidth: 1, strokeDasharray: '3 3' }} />
                {/* Liquidity Heatmap Overlay Reference Areas */}
                <LiquidityHeatmapReferenceAreas heatmapData={heatmapData} visible={heatmapEnabled} />
                {/* Dynamic Value Area & VAH / VAL / POC Overlay */}
                {renderMarketProfileOverlay()}
                {/* Dynamic Fibonacci Retracement Levels & Golden Pocket Overlay */}
                {renderFibonacciOverlay()}
                {/* Active Signal / AI Review targets */}
                {(aiReview?.takeProfit1 || activeSignal?.target1) && (
                   <ReferenceLine y={aiReview?.takeProfit1 || activeSignal?.target1} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Alvo', fill: '#10b981', fontSize: 9 }} />
                )}
                {(aiReview?.stopLoss || activeSignal?.stopLoss) && (
                   <ReferenceLine y={aiReview?.stopLoss || activeSignal?.stopLoss} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Stop', fill: '#f43f5e', fontSize: 9 }} />
                )}
                {/* User-Defined Price Alerts */}
                {activeTickerPriceAlerts.map(alert => (
                  <ReferenceLine
                    key={alert.id}
                    y={alert.targetPrice}
                    stroke="#f59e0b"
                    strokeDasharray="4 2"
                    strokeWidth={1.5}
                    label={{
                      value: `🔔 Alarme: ${formatPrice(alert.targetPrice)}`,
                      fill: '#fbbf24',
                      fontSize: 9,
                      position: 'insideTopLeft'
                    }}
                  />
                ))}
                {/* Paper Trading Active Virtual Positions & Orders */}
                {activePaperPositions.map(pos => (
                  <React.Fragment key={pos.id}>
                    <ReferenceLine
                      y={pos.entryPrice}
                      stroke={pos.side === 'LONG' ? '#10b981' : '#f43f5e'}
                      strokeDasharray="4 2"
                      strokeWidth={1.5}
                      label={{
                        value: `📦 Paper ${pos.side} (${formatPrice(pos.entryPrice)})`,
                        fill: pos.side === 'LONG' ? '#34d399' : '#fb7185',
                        fontSize: 9,
                        position: 'insideLeft'
                      }}
                    />
                    {pos.takeProfit && (
                      <ReferenceLine
                        y={pos.takeProfit}
                        stroke="#059669"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        label={{
                          value: `🎯 Paper TP (${formatPrice(pos.takeProfit)})`,
                          fill: '#34d399',
                          fontSize: 9,
                          position: 'insideRight'
                        }}
                      />
                    )}
                    {pos.stopLoss && (
                      <ReferenceLine
                        y={pos.stopLoss}
                        stroke="#e11d48"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        label={{
                          value: `🛑 Paper SL (${formatPrice(pos.stopLoss)})`,
                          fill: '#fb7185',
                          fontSize: 9,
                          position: 'insideRight'
                        }}
                      />
                    )}
                  </React.Fragment>
                ))}
                {activePaperOrders.map(ord => (
                  <ReferenceLine
                    key={ord.id}
                    y={ord.price || ord.stopPrice}
                    stroke="#a855f7"
                    strokeDasharray="2 2"
                    label={{
                      value: `⏳ Paper ${ord.type} (${formatPrice(ord.price || ord.stopPrice)})`,
                      fill: '#c084fc',
                      fontSize: 9,
                      position: 'insideLeft'
                    }}
                  />
                ))}
                <Bar dataKey="close" shape={<CandlestickShape />} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Real-time Session Volume Delta Gauge Indicator */}
        {showVolumeDeltaGauge && (
          <VolumeDeltaGauge
            volumeProfile={volumeProfileData}
            baseAsset={baseAsset}
            timeframe={timeframe}
            currentPrice={price}
          />
        )}

        {/* Detailed Horizontal Volume Profile Distribution Inspector */}
        {showDetailedVolumeProfile && (
          <VolumeProfileVisualization
            volumeProfile={volumeProfileData}
            currentPrice={price}
            baseAsset={baseAsset}
          />
        )}

        {/* Sub-gráficos de Orderflow e Volume Taker */}
        <OrderflowIndicators
          slicedData={slicedData}
          chartData={chartData}
          ticker={ticker}
        />
      </div>

      {/* D3 Liquidity Depth & Order Book Pressure Imbalance */}
      <LiquidityDepth
        ticker={ticker}
        timeframe={timeframe}
      />

      {/* Dedicated Section Below Charts: Volume Profile, Fibonacci, Order Flow & Market Structure */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Métricas Estruturais, Order Flow & Níveis Institucionais
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5 font-sans">
                Volume Profile do range, Retração de Fibonacci cronológica (1 ➔ 0), Métricas de Order Flow & Funding e Divergências/BOS.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold bg-neutral-900 text-orange-400 px-2.5 py-1 rounded border border-white/10 font-mono flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
              {ticker.symbol} • {timeframe}
            </span>
          </div>
        </div>

        {/* Harmonized Responsive Grid: 4 cards in 1 row on wide, 2x2 on desktop/laptop, 1 per row on mobile/tablet */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
          {/* Card 1: Volume Profile do Range */}
          <VolumeProfileCard
            ticker={ticker}
            timeframe={timeframe}
            slicedData={slicedData}
            botWeights={botWeights}
          />

          {/* Card 2: Retração de Fibonacci & Golden Pocket */}
          <FibonacciCard
            ticker={ticker}
            timeframe={timeframe}
            slicedData={slicedData}
            chartData={chartData}
            onFibLevelsChange={(levels) => setActiveFibLevels(levels)}
          />

          {/* Card 3: Métricas de Order Flow & Funding */}
          <OrderFlowFundingCard ticker={ticker} />

          {/* Card 4: Divergências & Estrutura de Mercado */}
          <DivergenceStructureCard
            ticker={ticker}
            timeframe={timeframe}
            isBullishStructure={isBullishStructure}
            structureLabel={structureLabel}
            bosStatus={bosStatus}
          />
        </div>
      </div>

      {/* Centralized Bulk Price Alert Manager Modal */}
      <BulkAlertManager
        isOpen={showBulkAlertManager}
        onClose={() => setShowBulkAlertManager(false)}
        allTickers={allTickers}
        currentTickerSymbol={ticker?.symbol}
        onSelectTickerBySymbol={onSelectTickerBySymbol}
        onAlertsUpdated={(updated) => setUserAlerts(updated)}
      />
    </div>
  );
};
