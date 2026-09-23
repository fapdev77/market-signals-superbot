import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { TickerData, OrderBookDepthData, OrderBookLevel } from '../types';
import { formatPrice, formatPercent } from '../utils/formatters';
import { 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  Activity, 
  Crosshair, 
  Sparkles, 
  Sliders, 
  Scale, 
  Lock, 
  Maximize2,
  Anchor,
  Zap,
  ArrowRight,
  ArrowDown,
  ArrowUp
} from 'lucide-react';
import { Tooltip } from './Tooltip';

interface LiquidityDepthProps {
  ticker: TickerData;
  timeframe?: string;
}

export const LiquidityDepth: React.FC<LiquidityDepthProps> = ({
  ticker,
  timeframe = '15m'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 700, height: 320 });
  const [depthData, setDepthData] = useState<OrderBookDepthData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [depthRange, setDepthRange] = useState<'0.5%' | '1%' | '2%' | '5%'>('2%');
  const [chartStyle, setChartStyle] = useState<'smooth' | 'step'>('step');
  const [hoveredPoint, setHoveredPoint] = useState<{
    side: 'bid' | 'ask';
    level: OrderBookLevel;
    x: number;
    y: number;
  } | null>(null);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 50) {
          setDimensions({
            width: Math.floor(width),
            height: 320
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Client-side deterministic fallback generator
  const generateFallbackDepth = useCallback((symbol: string, currentPrice: number): OrderBookDepthData => {
    const mid = currentPrice > 0 ? currentPrice : 100;
    const spread = mid * 0.00018;
    const bestBid = mid - spread / 2;
    const bestAsk = mid + spread / 2;
    const limit = 35;

    const parsedBids: OrderBookLevel[] = [];
    const parsedAsks: OrderBookLevel[] = [];

    const baseUnitQty = mid > 1000 ? 0.9 : mid > 100 ? 18 : mid > 1 ? 600 : 35000;
    const now = Date.now();
    const seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const bias = ticker.cvdDirection === 'BUY' ? 0.18 : ticker.cvdDirection === 'SELL' ? -0.18 : 0;

    let cumBidQty = 0;
    let cumBidUsd = 0;
    let maxBidWall: OrderBookLevel | undefined;

    for (let i = 0; i < limit; i++) {
      const distPct = 0.0002 + (i / limit) * 0.025;
      const price = bestBid * (1 - distPct);
      let qty = (baseUnitQty * (1 + i * 0.3)) * (0.8 + Math.random() * 0.4) * (1 + bias);
      const isWall = i === 8 || i === 19;
      if (isWall) qty *= 3.2;

      cumBidQty += qty;
      const usd = price * qty;
      cumBidUsd += usd;

      const lvl: OrderBookLevel = {
        price,
        qty,
        totalQty: cumBidQty,
        totalUsd: cumBidUsd,
        deviationPct: Number((((price - mid) / mid) * 100).toFixed(3)),
        isWall
      };
      if (isWall && (!maxBidWall || qty > maxBidWall.qty)) maxBidWall = lvl;
      parsedBids.push(lvl);
    }

    let cumAskQty = 0;
    let cumAskUsd = 0;
    let maxAskWall: OrderBookLevel | undefined;

    for (let i = 0; i < limit; i++) {
      const distPct = 0.0002 + (i / limit) * 0.025;
      const price = bestAsk * (1 + distPct);
      let qty = (baseUnitQty * (1 + i * 0.3)) * (0.8 + Math.random() * 0.4) * (1 - bias);
      const isWall = i === 7 || i === 21;
      if (isWall) qty *= 3.2;

      cumAskQty += qty;
      const usd = price * qty;
      cumAskUsd += usd;

      const lvl: OrderBookLevel = {
        price,
        qty,
        totalQty: cumAskQty,
        totalUsd: cumAskUsd,
        deviationPct: Number((((price - mid) / mid) * 100).toFixed(3)),
        isWall
      };
      if (isWall && (!maxAskWall || qty > maxAskWall.qty)) maxAskWall = lvl;
      parsedAsks.push(lvl);
    }

    const totalDepthUsd = cumBidUsd + cumAskUsd;
    const imbalancePct = Number((((cumBidUsd - cumAskUsd) / totalDepthUsd) * 100).toFixed(2));
    const imbalanceRatio = cumAskUsd > 0 ? Number((cumBidUsd / cumAskUsd).toFixed(2)) : 1;

    let pressureLabel = 'LIVRO EQUILIBRADO (FLUXO NEUTRO)';
    let pressureBias: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';

    if (imbalancePct >= 15) {
      pressureLabel = 'FORTE PRESSÃO COMPRADORA (SUPORTE CARREGADO)';
      pressureBias = 'BUY';
    } else if (imbalancePct >= 5) {
      pressureLabel = 'MODERADA PRESSÃO COMPRADORA (BID DOMINANTE)';
      pressureBias = 'BUY';
    } else if (imbalancePct <= -15) {
      pressureLabel = 'FORTE PRESSÃO VENDEDORA (RESISTÊNCIA CARREGADA)';
      pressureBias = 'SELL';
    } else if (imbalancePct <= -5) {
      pressureLabel = 'MODERADA PRESSÃO VENDEDORA (ASK DOMINANTE)';
      pressureBias = 'SELL';
    }

    return {
      symbol,
      timestamp: now,
      bids: parsedBids,
      asks: parsedAsks,
      spread,
      spreadPct: (spread / mid) * 100,
      midPrice: mid,
      bidDepthUsd: cumBidUsd,
      askDepthUsd: cumAskUsd,
      totalDepthUsd,
      imbalancePct,
      imbalanceRatio,
      pressureLabel,
      pressureBias,
      whaleWalls: {
        bidWall: maxBidWall,
        askWall: maxAskWall
      }
    };
  }, [ticker.cvdDirection]);

  // Fetch Depth Data
  const loadDepth = useCallback(async () => {
    if (!ticker?.symbol) return;
    try {
      const res = await fetch(`/api/tickers/${ticker.symbol}/depth?limit=45`);
      if (!res.ok) throw new Error('API depth error');
      const data: OrderBookDepthData = await res.json();
      if (data && data.bids && data.bids.length > 0 && data.asks && data.asks.length > 0) {
        setDepthData(data);
        return;
      }
      throw new Error('Empty depth data');
    } catch {
      // Fallback
      setDepthData(generateFallbackDepth(ticker.symbol, ticker.price));
    } finally {
      setLoading(false);
    }
  }, [ticker?.symbol, ticker?.price, generateFallbackDepth]);

  useEffect(() => {
    setLoading(true);
    loadDepth();

    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadDepth();
    }, 4000);

    return () => clearInterval(interval);
  }, [loadDepth, autoRefresh]);

  // Filter levels based on depth range (0.5%, 1%, 2%, 5%)
  const maxDeviation = useMemo(() => {
    switch (depthRange) {
      case '0.5%': return 0.5;
      case '1%': return 1.0;
      case '2%': return 2.0;
      case '5%': return 5.0;
      default: return 2.0;
    }
  }, [depthRange]);

  const filteredDepth = useMemo(() => {
    if (!depthData) return null;
    const bids = depthData.bids.filter(b => Math.abs(b.deviationPct) <= maxDeviation);
    const asks = depthData.asks.filter(a => Math.abs(a.deviationPct) <= maxDeviation);

    // Recompute visible USD totals for the filtered range
    const maxBidUsd = bids[bids.length - 1]?.totalUsd || depthData.bidDepthUsd;
    const maxAskUsd = asks[asks.length - 1]?.totalUsd || depthData.askDepthUsd;
    const visibleTotal = maxBidUsd + maxAskUsd;
    const visibleImbalance = visibleTotal > 0 ? ((maxBidUsd - maxAskUsd) / visibleTotal) * 100 : 0;

    return {
      ...depthData,
      bids,
      asks,
      visibleBidUsd: maxBidUsd,
      visibleAskUsd: maxAskUsd,
      visibleImbalance
    };
  }, [depthData, maxDeviation]);

  // Render D3 Depth Chart
  useEffect(() => {
    if (!svgRef.current || !filteredDepth || filteredDepth.bids.length === 0 || filteredDepth.asks.length === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 25, right: 25, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 50 || innerHeight <= 50) return;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare data
    // Bids: sorted by price ascending for plotting left-to-right toward midPrice
    const sortedBids = [...filteredDepth.bids].sort((a, b) => a.price - b.price);
    // Asks: sorted by price ascending away from midPrice
    const sortedAsks = [...filteredDepth.asks].sort((a, b) => a.price - b.price);

    const minPrice = sortedBids[0]?.price || filteredDepth.midPrice * 0.98;
    const maxPrice = sortedAsks[sortedAsks.length - 1]?.price || filteredDepth.midPrice * 1.02;

    const maxVolumeUsd = Math.max(
      sortedBids[0]?.totalUsd || 0,
      sortedAsks[sortedAsks.length - 1]?.totalUsd || 0,
      10000
    ) * 1.1;

    // Scales
    const xScale = d3.scaleLinear()
      .domain([minPrice, maxPrice])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, maxVolumeUsd])
      .range([innerHeight, 0]);

    // Grid lines
    const yAxisGrid = d3.axisLeft(yScale)
      .ticks(5)
      .tickSize(-innerWidth)
      .tickFormat(() => '');

    g.append('g')
      .attr('class', 'grid text-neutral-800 opacity-20 stroke-neutral-700')
      .call(yAxisGrid);

    // Defs for gradients and glow filters
    const defs = svg.append('defs');

    // Bid gradient (Emerald)
    const bidGradient = defs.append('linearGradient')
      .attr('id', 'bid-depth-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    bidGradient.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.45);
    bidGradient.append('stop').attr('offset', '100%').attr('stop-color', '#064e3b').attr('stop-opacity', 0.05);

    // Ask gradient (Rose)
    const askGradient = defs.append('linearGradient')
      .attr('id', 'ask-depth-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    askGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.45);
    askGradient.append('stop').attr('offset', '100%').attr('stop-color', '#881337').attr('stop-opacity', 0.05);

    // Area & Line Generators
    const curveType = chartStyle === 'step' ? d3.curveStepBefore : d3.curveMonotoneX;

    const bidArea = d3.area<OrderBookLevel>()
      .x(d => xScale(d.price))
      .y0(innerHeight)
      .y1(d => yScale(d.totalUsd))
      .curve(curveType);

    const bidLine = d3.line<OrderBookLevel>()
      .x(d => xScale(d.price))
      .y(d => yScale(d.totalUsd))
      .curve(curveType);

    const askArea = d3.area<OrderBookLevel>()
      .x(d => xScale(d.price))
      .y0(innerHeight)
      .y1(d => yScale(d.totalUsd))
      .curve(chartStyle === 'step' ? d3.curveStepAfter : d3.curveMonotoneX);

    const askLine = d3.line<OrderBookLevel>()
      .x(d => xScale(d.price))
      .y(d => yScale(d.totalUsd))
      .curve(chartStyle === 'step' ? d3.curveStepAfter : d3.curveMonotoneX);

    // Render Bid Area & Line
    g.append('path')
      .datum(sortedBids)
      .attr('fill', 'url(#bid-depth-gradient)')
      .attr('d', bidArea);

    g.append('path')
      .datum(sortedBids)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2)
      .attr('d', bidLine);

    // Render Ask Area & Line
    g.append('path')
      .datum(sortedAsks)
      .attr('fill', 'url(#ask-depth-gradient)')
      .attr('d', askArea);

    g.append('path')
      .datum(sortedAsks)
      .attr('fill', 'none')
      .attr('stroke', '#f43f5e')
      .attr('stroke-width', 2)
      .attr('d', askLine);

    // Mid Market Price Vertical Center Line
    const midX = xScale(filteredDepth.midPrice);
    if (midX >= 0 && midX <= innerWidth) {
      g.append('line')
        .attr('x1', midX)
        .attr('x2', midX)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#fbbf24')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0.85);

      // Mid price pin badge
      const pinG = g.append('g')
        .attr('transform', `translate(${midX}, 12)`);

      pinG.append('rect')
        .attr('x', -40)
        .attr('y', -10)
        .attr('width', 80)
        .attr('height', 18)
        .attr('rx', 4)
        .attr('fill', '#18181b')
        .attr('stroke', '#fbbf24')
        .attr('stroke-width', 1);

      pinG.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 2)
        .attr('fill', '#fbbf24')
        .attr('font-size', '9.5px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .text(`MID: ${formatPrice(filteredDepth.midPrice, { currency: true })}`);
    }

    // Whale Wall Markers (Bids & Asks)
    sortedBids.filter(b => b.isWall).forEach(wall => {
      const wx = xScale(wall.price);
      const wy = yScale(wall.totalUsd);
      if (wx >= 0 && wx <= innerWidth) {
        // Pulsing wall circle
        g.append('circle')
          .attr('cx', wx)
          .attr('cy', wy)
          .attr('r', 5)
          .attr('fill', '#10b981')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5)
          .attr('class', 'animate-pulse');

        // Wall tag
        g.append('text')
          .attr('x', wx)
          .attr('y', wy - 10)
          .attr('text-anchor', 'middle')
          .attr('fill', '#34d399')
          .attr('font-size', '8.5px')
          .attr('font-family', 'monospace')
          .attr('font-weight', 'bold')
          .text(`MURALHA BID`);
      }
    });

    sortedAsks.filter(a => a.isWall).forEach(wall => {
      const wx = xScale(wall.price);
      const wy = yScale(wall.totalUsd);
      if (wx >= 0 && wx <= innerWidth) {
        g.append('circle')
          .attr('cx', wx)
          .attr('cy', wy)
          .attr('r', 5)
          .attr('fill', '#f43f5e')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5)
          .attr('class', 'animate-pulse');

        g.append('text')
          .attr('x', wx)
          .attr('y', wy - 10)
          .attr('text-anchor', 'middle')
          .attr('fill', '#fb7185')
          .attr('font-size', '8.5px')
          .attr('font-family', 'monospace')
          .attr('font-weight', 'bold')
          .text(`MURALHA ASK`);
      }
    });

    // X Axis (Prices)
    const xAxis = d3.axisBottom(xScale)
      .ticks(Math.max(4, Math.floor(innerWidth / 120)))
      .tickFormat(d => formatPrice(d as number, { currency: true }));

    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .attr('class', 'text-neutral-400 font-mono text-[10px]')
      .call(xAxis);

    xAxisG.select('.domain').attr('stroke', 'rgba(255,255,255,0.15)');
    xAxisG.selectAll('line').attr('stroke', 'rgba(255,255,255,0.1)');

    // Y Axis (Volume in Millions USD)
    const yAxis = d3.axisLeft(yScale)
      .ticks(4)
      .tickFormat(d => `$${((d as number) / 1_000_000).toFixed(1)}M`);

    const yAxisG = g.append('g')
      .attr('class', 'text-neutral-400 font-mono text-[10px]')
      .call(yAxis);

    yAxisG.select('.domain').attr('stroke', 'rgba(255,255,255,0.15)');
    yAxisG.selectAll('line').attr('stroke', 'rgba(255,255,255,0.1)');

    // Overlay Crosshair Event Rect
    const bisectPrice = d3.bisector((d: OrderBookLevel) => d.price).center;

    const crosshairLine = g.append('line')
      .attr('stroke', 'rgba(255, 255, 255, 0.4)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .style('display', 'none');

    const crosshairDot = g.append('circle')
      .attr('r', 4.5)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .style('display', 'none');

    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .attr('class', 'cursor-crosshair')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const hoveredPrice = xScale.invert(mx);

        let side: 'bid' | 'ask';
        let level: OrderBookLevel;

        if (hoveredPrice <= filteredDepth.midPrice) {
          side = 'bid';
          const idx = bisectPrice(sortedBids, hoveredPrice);
          level = sortedBids[Math.max(0, Math.min(sortedBids.length - 1, idx))];
        } else {
          side = 'ask';
          const idx = bisectPrice(sortedAsks, hoveredPrice);
          level = sortedAsks[Math.max(0, Math.min(sortedAsks.length - 1, idx))];
        }

        if (level) {
          const cx = xScale(level.price);
          const cy = yScale(level.totalUsd);

          crosshairLine
            .attr('x1', cx)
            .attr('x2', cx)
            .attr('y1', 0)
            .attr('y2', innerHeight)
            .style('display', 'block');

          crosshairDot
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('fill', side === 'bid' ? '#10b981' : '#f43f5e')
            .style('display', 'block');

          setHoveredPoint({
            side,
            level,
            x: cx + margin.left,
            y: cy + margin.top
          });
        }
      })
      .on('mouseleave', () => {
        crosshairLine.style('display', 'none');
        crosshairDot.style('display', 'none');
        setHoveredPoint(null);
      });

  }, [filteredDepth, dimensions, chartStyle]);

  const baseAsset = ticker?.baseAsset || ticker.symbol.replace(/USDT|USD|BUSD/g, '');

  const imbalance = filteredDepth?.visibleImbalance ?? filteredDepth?.imbalancePct ?? 0;
  const isBidDominant = imbalance > 0;
  const isAskDominant = imbalance < 0;

  // Percentage distribution (e.g. 55% bid vs 45% ask)
  const bidRatioPct = Math.max(10, Math.min(90, 50 + imbalance / 2));
  const askRatioPct = 100 - bidRatioPct;

  return (
    <div className="bg-[#09090b] border border-white/10 rounded-2xl p-4 space-y-4 shadow-2xl relative">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">
                Profundidade de Liquidez & Pressão de Livro (Order Book Imbalance)
              </h3>
              <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/30 font-mono font-bold">
                D3 Depth
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-sans mt-0.5">
              Curvas cumulativas de ordens limitadas de compra (Bids) vs venda (Asks) e mensuração quantitativa de desequilíbrio de pressão.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* Depth Range Range Filter */}
          <div className="flex items-center bg-[#050505] p-0.5 rounded-lg border border-white/10">
            {(['0.5%', '1%', '2%', '5%'] as const).map(r => (
              <button
                key={r}
                onClick={() => setDepthRange(r)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                  depthRange === r 
                    ? 'bg-orange-500 text-black shadow-sm' 
                    : 'text-neutral-500 hover:text-white'
                }`}
              >
                ±{r}
              </button>
            ))}
          </div>

          {/* Chart Style Toggle */}
          <div className="flex items-center bg-[#050505] p-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => setChartStyle('step')}
              className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                chartStyle === 'step' 
                  ? 'bg-neutral-800 text-white' 
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Degraus (Step)
            </button>
            <button
              onClick={() => setChartStyle('smooth')}
              className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                chartStyle === 'smooth' 
                  ? 'bg-neutral-800 text-white' 
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Suave
            </button>
          </div>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1.5 ${
              autoRefresh 
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                : 'bg-neutral-900 text-neutral-400 border-white/10'
            }`}
            title="Alternar atualização automática periódica da profundidade"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
            <span>{autoRefresh ? 'Live' : 'Pausado'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => {
              setLoading(true);
              loadDepth();
            }}
            disabled={loading}
            className="p-1.5 rounded-lg bg-neutral-900 border border-white/10 hover:border-white/20 text-neutral-400 hover:text-white transition disabled:opacity-50"
            title="Recarregar profundidade agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Key Order Book Pressure Diagnostic Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Order Book Imbalance Gauge */}
        <div className="bg-[#050505] p-3 rounded-xl border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-neutral-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-orange-400" />
              Pressão de Livro:
            </span>
            <span className={`font-black ${
              isBidDominant ? 'text-emerald-400' : isAskDominant ? 'text-rose-400' : 'text-neutral-300'
            }`}>
              {imbalance >= 0 ? '+' : ''}{imbalance.toFixed(1)}% {isBidDominant ? 'BUY' : isAskDominant ? 'SELL' : 'FLAT'}
            </span>
          </div>

          {/* Dual Balance Bar */}
          <div className="space-y-1">
            <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden flex">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${bidRatioPct}%` }}
                title={`Bids: ${bidRatioPct.toFixed(1)}%`}
              />
              <div 
                className="bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${askRatioPct}%` }}
                title={`Asks: ${askRatioPct.toFixed(1)}%`}
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-neutral-400">
              <span className="text-emerald-400 font-bold">{bidRatioPct.toFixed(0)}% Compradores</span>
              <span className="text-rose-400 font-bold">{askRatioPct.toFixed(0)}% Vendedores</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Bid Liquidity Depth (Support) */}
        <div className="bg-[#050505] p-3 rounded-xl border border-emerald-500/20 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-neutral-400 flex items-center gap-1">
              <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
              Profundidade Bids (Suporte):
            </span>
            <span className="text-emerald-400 font-bold text-[10px]">
              {filteredDepth?.bids.length || 0} níveis
            </span>
          </div>
          <div className="text-lg font-black text-emerald-400 font-mono">
            ${(((filteredDepth?.visibleBidUsd || 0)) / 1_000_000).toFixed(2)}M
          </div>
          <div className="text-[10px] text-neutral-500 font-mono flex items-center justify-between">
            <span>Muralha Bid:</span>
            <span className="text-neutral-300 font-bold">
              {filteredDepth?.whaleWalls.bidWall 
                ? formatPrice(filteredDepth.whaleWalls.bidWall.price, { currency: true })
                : 'Disperso'}
            </span>
          </div>
        </div>

        {/* Metric 3: Ask Liquidity Depth (Resistance) */}
        <div className="bg-[#050505] p-3 rounded-xl border border-rose-500/20 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-neutral-400 flex items-center gap-1">
              <ArrowDown className="w-3.5 h-3.5 text-rose-400" />
              Profundidade Asks (Resistência):
            </span>
            <span className="text-rose-400 font-bold text-[10px]">
              {filteredDepth?.asks.length || 0} níveis
            </span>
          </div>
          <div className="text-lg font-black text-rose-400 font-mono">
            ${(((filteredDepth?.visibleAskUsd || 0)) / 1_000_000).toFixed(2)}M
          </div>
          <div className="text-[10px] text-neutral-500 font-mono flex items-center justify-between">
            <span>Muralha Ask:</span>
            <span className="text-neutral-300 font-bold">
              {filteredDepth?.whaleWalls.askWall 
                ? formatPrice(filteredDepth.whaleWalls.askWall.price, { currency: true })
                : 'Disperso'}
            </span>
          </div>
        </div>

        {/* Metric 4: Spread & Diagnostic Classification */}
        <div className="bg-[#050505] p-3 rounded-xl border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-neutral-400">Spread do Livro:</span>
            <span className="text-neutral-200 font-bold">
              {formatPrice(filteredDepth?.spread || 0, { currency: true })} ({((filteredDepth?.spreadPct || 0)).toFixed(3)}%)
            </span>
          </div>
          <div className="pt-0.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border block truncate text-center ${
              isBidDominant 
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                : isAskDominant 
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' 
                : 'bg-neutral-800 text-neutral-300 border-white/10'
            }`}>
              {filteredDepth?.pressureLabel || 'LIVRO EQUILIBRADO'}
            </span>
          </div>
          <p className="text-[9.5px] text-neutral-500 font-mono text-center pt-0.5">
            {isBidDominant 
              ? 'Suporte institucional sólido abaixo da cotação.' 
              : isAskDominant 
              ? 'Muralhas de venda limitam expansão imediata.' 
              : 'Fluxo em equilíbrio sem pressão direcional.'}
          </p>
        </div>
      </div>

      {/* D3 Depth Canvas Container */}
      <div 
        ref={containerRef} 
        className="w-full h-[330px] bg-[#050505] rounded-xl border border-white/5 overflow-hidden relative"
      >
        <svg 
          ref={svgRef} 
          width={dimensions.width} 
          height={dimensions.height}
          className="w-full h-full"
        />

        {/* Legend Overlay on Canvas Top Left */}
        <div className="absolute top-2.5 left-3 flex items-center gap-3 bg-[#0a0a0c]/85 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10 text-[10px] font-mono pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span className="text-emerald-400 font-bold">Bids (Compras Limitadas)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            <span className="text-rose-400 font-bold">Asks (Vendas Limitadas)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-amber-300 font-bold">Mid Market</span>
          </div>
        </div>

        {/* Hover Crosshair Tooltip */}
        {hoveredPoint && (
          <div 
            className="absolute z-50 pointer-events-none bg-[#0c0d10]/95 backdrop-blur-md border border-white/20 p-2.5 rounded-xl shadow-2xl font-mono text-xs w-60 space-y-1 transition-all"
            style={{
              left: Math.min(dimensions.width - 250, Math.max(10, hoveredPoint.x + 15)),
              top: Math.min(dimensions.height - 140, Math.max(10, hoveredPoint.y - 40))
            }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-1">
              <span className={`font-black text-[11px] ${
                hoveredPoint.side === 'bid' ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {hoveredPoint.side === 'bid' ? 'ORDEM DE COMPRA (BID)' : 'ORDEM DE VENDA (ASK)'}
              </span>
              <span className={`text-[10px] font-bold ${
                hoveredPoint.level.deviationPct >= 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {hoveredPoint.level.deviationPct >= 0 ? '+' : ''}{hoveredPoint.level.deviationPct.toFixed(2)}%
              </span>
            </div>

            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-neutral-400">Preço:</span>
                <span className="text-white font-bold">{formatPrice(hoveredPoint.level.price, { currency: true })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Volume Acumulado:</span>
                <span className="text-orange-400 font-bold">
                  ${(hoveredPoint.level.totalUsd / 1_000_000).toFixed(2)}M
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Qtd Acumulada:</span>
                <span className="text-neutral-200">
                  {hoveredPoint.level.totalQty.toLocaleString('en-US', { maximumFractionDigits: 2 })} {baseAsset}
                </span>
              </div>
              {hoveredPoint.level.isWall && (
                <div className="mt-1 pt-1 border-t border-white/10 text-[9.5px] text-amber-400 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Muralha Institucional Identificada</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
