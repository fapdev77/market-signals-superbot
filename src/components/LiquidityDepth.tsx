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
  ArrowUp,
  BarChart2,
  Gauge,
  Flame
} from 'lucide-react';
import { Tooltip } from './Tooltip';
import {
  computeCvdDeltaMetrics,
  classifyOrderFlowDivergence,
  generateCvdDeltaSeries,
  computeOrderBookImbalance,
  computeMultiTierOBI,
  type CvdDeltaMetrics,
  type OrderFlowDivergenceResult,
  type CvdDeltaDataPoint,
  type OrderBookImbalanceResult
} from '../utils/cvdDeltaUtils';
import {
  computeVolumeDeltaOscillator,
  generateVolumeOscillatorSeries,
  type VolumeOscillatorResult,
  type VolumeOscillatorPoint
} from '../utils/volumeOscillatorUtils';

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
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 700, height: 350 });
  const [depthData, setDepthData] = useState<OrderBookDepthData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [depthRange, setDepthRange] = useState<'0.5%' | '1%' | '2%' | '5%'>('2%');
  const [chartStyle, setChartStyle] = useState<'smooth' | 'step'>('step');
  const [showCvdOverlay, setShowCvdOverlay] = useState<boolean>(true);
  const [cvdOverlayMode, setCvdOverlayMode] = useState<'curve' | 'bars' | 'split'>('curve');
  const [showObiOverlay, setShowObiOverlay] = useState<boolean>(true);
  const [obiViewMode, setObiViewMode] = useState<'compact' | 'tiers' | 'gauge'>('compact');
  const [showVolumeOscillator, setShowVolumeOscillator] = useState<boolean>(true);
  const [oscillatorPreset, setOscillatorPreset] = useState<'fast' | 'standard'>('fast');
  const [hoveredPoint, setHoveredPoint] = useState<{
    side: 'bid' | 'ask';
    level: OrderBookLevel;
    x: number;
    y: number;
    takerBuyEstimatedUsd?: number;
    takerSellEstimatedUsd?: number;
    deltaEstimatedUsd?: number;
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

  // CVD Delta metrics & Order flow divergence & OBI
  const obiMetrics = useMemo(() => {
    return computeOrderBookImbalance(
      filteredDepth?.visibleBidUsd || 0,
      filteredDepth?.visibleAskUsd || 0
    );
  }, [filteredDepth]);

  const multiTierObi = useMemo(() => {
    return computeMultiTierOBI(filteredDepth?.bids || [], filteredDepth?.asks || []);
  }, [filteredDepth]);

  const cvdMetrics = useMemo(() => computeCvdDeltaMetrics(ticker), [ticker]);
  const imbalance = obiMetrics.imbalancePct;
  const divergence = useMemo(() => classifyOrderFlowDivergence(ticker, imbalance), [ticker, imbalance]);
  const cvdSeries = useMemo(() => generateCvdDeltaSeries(ticker, 28), [ticker]);

  // Volume Oscillator for CVD Delta Shifts
  const volumeOsc = useMemo(() => {
    const periods = oscillatorPreset === 'fast' 
      ? { fastPeriod: 5, slowPeriod: 14 } 
      : { fastPeriod: 10, slowPeriod: 21 };
    return computeVolumeDeltaOscillator(ticker, periods);
  }, [ticker, oscillatorPreset]);

  const oscSeries = useMemo(() => {
    return generateVolumeOscillatorSeries(ticker, 30);
  }, [ticker, oscillatorPreset]);

  // Render D3 Depth Chart with CVD Delta Overlay
  useEffect(() => {
    if (!svgRef.current || !filteredDepth || filteredDepth.bids.length === 0 || filteredDepth.asks.length === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { 
      top: 25, 
      right: showCvdOverlay ? 65 : 25, 
      bottom: 40, 
      left: 60 
    };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 50 || innerHeight <= 50) return;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare depth data
    const sortedBids = [...filteredDepth.bids].sort((a, b) => a.price - b.price);
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

    // Defs for gradients, filters and masks
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

    // CVD Overlay Gradient (Cyan / Electric Amber)
    const cvdGradient = defs.append('linearGradient')
      .attr('id', 'cvd-overlay-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    cvdGradient.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.35);
    cvdGradient.append('stop').attr('offset', '100%').attr('stop-color', '#0891b2').attr('stop-opacity', 0.02);

    // Glow Filter for CVD Line
    const filter = defs.append('filter')
      .attr('id', 'cvd-glow')
      .attr('x', '-20%').attr('y', '-20%')
      .attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '2.5')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Area & Line Generators for Depth
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

    // ==========================================
    // CVD DELTA OVERLAY LAYER (Taker Buy vs Sell)
    // ==========================================
    if (showCvdOverlay && cvdSeries && cvdSeries.length > 0) {
      const cvdGroup = g.append('g').attr('class', 'cvd-delta-overlay');

      // Secondary Y-Scale for CVD Delta
      const maxAbsCvd = Math.max(
        ...cvdSeries.map(d => Math.abs(d.cumulativeCvdUsd)),
        Math.abs(cvdMetrics.netCvdDeltaUsd),
        1000000
      ) * 1.25;

      const cvdYScale = d3.scaleLinear()
        .domain([-maxAbsCvd, maxAbsCvd])
        .range([innerHeight, 0]);

      // Delta Baseline (Zero Aggression Line)
      const zeroY = cvdYScale(0);
      cvdGroup.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', zeroY)
        .attr('y2', zeroY)
        .attr('stroke', 'rgba(6, 182, 212, 0.35)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2');

      // 1. CVD Delta Volume Aggression Bars (Histogram at Bottom/Center)
      if (cvdOverlayMode === 'bars' || cvdOverlayMode === 'split') {
        const barWidth = Math.max(3, (innerWidth / cvdSeries.length) - 3);
        const maxDeltaBar = Math.max(...cvdSeries.map(d => Math.abs(d.deltaUsd)), 10000);
        const barHeightMax = innerHeight * 0.30;

        cvdSeries.forEach((pt, i) => {
          const px = (i / (cvdSeries.length - 1)) * innerWidth;
          const isBuyDelta = pt.deltaUsd >= 0;
          const normalizedHeight = (Math.abs(pt.deltaUsd) / maxDeltaBar) * barHeightMax;
          const barY = isBuyDelta ? zeroY - normalizedHeight : zeroY;

          cvdGroup.append('rect')
            .attr('x', px - barWidth / 2)
            .attr('y', Math.max(0, Math.min(innerHeight - normalizedHeight, barY)))
            .attr('width', barWidth)
            .attr('height', Math.max(2, normalizedHeight))
            .attr('fill', isBuyDelta ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)')
            .attr('stroke', isBuyDelta ? '#10b981' : '#f43f5e')
            .attr('stroke-width', 0.8)
            .attr('rx', 1.5)
            .attr('opacity', 0.85);
        });
      }

      // 2. Continuous CVD Curve Line & Shaded Area
      if (cvdOverlayMode === 'curve' || cvdOverlayMode === 'split') {
        const cvdArea = d3.area<CvdDeltaDataPoint>()
          .x((_, i) => (i / (cvdSeries.length - 1)) * innerWidth)
          .y0(zeroY)
          .y1(d => cvdYScale(d.cumulativeCvdUsd))
          .curve(d3.curveMonotoneX);

        const cvdLine = d3.line<CvdDeltaDataPoint>()
          .x((_, i) => (i / (cvdSeries.length - 1)) * innerWidth)
          .y(d => cvdYScale(d.cumulativeCvdUsd))
          .curve(d3.curveMonotoneX);

        // CVD Area
        cvdGroup.append('path')
          .datum(cvdSeries)
          .attr('fill', 'url(#cvd-overlay-gradient)')
          .attr('d', cvdArea);

        // CVD Stroke Line
        const cvdStrokeColor = cvdMetrics.cvdDirection === 'BUY' 
          ? '#06b6d4' 
          : cvdMetrics.cvdDirection === 'SELL' 
          ? '#f43f5e' 
          : '#38bdf8';

        cvdGroup.append('path')
          .datum(cvdSeries)
          .attr('fill', 'none')
          .attr('stroke', cvdStrokeColor)
          .attr('stroke-width', 2.2)
          .attr('filter', 'url(#cvd-glow)')
          .attr('d', cvdLine);

        // Current CVD endpoint marker
        const lastPt = cvdSeries[cvdSeries.length - 1];
        if (lastPt) {
          const lastX = innerWidth;
          const lastY = cvdYScale(lastPt.cumulativeCvdUsd);

          cvdGroup.append('circle')
            .attr('cx', lastX)
            .attr('cy', lastY)
            .attr('r', 4.5)
            .attr('fill', cvdStrokeColor)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1.5)
            .attr('class', 'animate-pulse');
        }
      }

      // 3. Secondary Y-Axis for CVD Delta (Right side)
      const cvdYAxis = d3.axisRight(cvdYScale)
        .ticks(4)
        .tickFormat(d => {
          const val = (d as number) / 1_000_000;
          return `${val >= 0 ? '+' : ''}${val.toFixed(1)}M Δ`;
        });

      const cvdAxisG = g.append('g')
        .attr('transform', `translate(${innerWidth},0)`)
        .attr('class', 'text-cyan-400/80 font-mono text-[9.5px]')
        .call(cvdYAxis);

      cvdAxisG.select('.domain').attr('stroke', 'rgba(6, 182, 212, 0.3)');
      cvdAxisG.selectAll('line').attr('stroke', 'rgba(6, 182, 212, 0.2)');
    }

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
        .attr('x', -44)
        .attr('y', -10)
        .attr('width', 88)
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
        g.append('circle')
          .attr('cx', wx)
          .attr('cy', wy)
          .attr('r', 5)
          .attr('fill', '#10b981')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5)
          .attr('class', 'animate-pulse');

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

          // Estimate taker aggression at hovered price tier
          const tierRatio = (cvdMetrics.takerBuyRatioPct / 100);
          const estimatedTierTakerBuy = level.totalUsd * tierRatio * 0.45;
          const estimatedTierTakerSell = level.totalUsd * (1 - tierRatio) * 0.45;
          const estimatedTierDelta = estimatedTierTakerBuy - estimatedTierTakerSell;

          setHoveredPoint({
            side,
            level,
            x: cx + margin.left,
            y: cy + margin.top,
            takerBuyEstimatedUsd: estimatedTierTakerBuy,
            takerSellEstimatedUsd: estimatedTierTakerSell,
            deltaEstimatedUsd: estimatedTierDelta
          });
        }
      })
      .on('mouseleave', () => {
        crosshairLine.style('display', 'none');
        crosshairDot.style('display', 'none');
        setHoveredPoint(null);
      });

  }, [filteredDepth, dimensions, chartStyle, showCvdOverlay, cvdOverlayMode, cvdSeries, cvdMetrics]);

  const baseAsset = ticker?.baseAsset || ticker.symbol.replace(/USDT|USD|BUSD/g, '');

  const isBidDominant = imbalance > 0;
  const isAskDominant = imbalance < 0;

  // Percentage distribution of depth
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
                Profundidade de Liquidez & Overlay CVD Delta
              </h3>
              <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/30 font-mono font-bold">
                D3 OrderBook + CVD
              </span>
              {showCvdOverlay && (
                <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30 font-mono font-bold flex items-center gap-1">
                  <Activity className="w-3 h-3 animate-pulse" />
                  CVD Ativo
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 font-sans mt-0.5">
              Profundidade do livro de ofertas contrastada em tempo real com o Volume Delta Cumulativo (CVD) e agressão Taker Buy vs Sell.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* OBI % Toggle Button */}
          <button
            onClick={() => setShowObiOverlay(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1.5 ${
              showObiOverlay 
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-sm' 
                : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
            }`}
            title="Ativar/desativar visualização do Order Book Imbalance (OBI)"
          >
            <Scale className={`w-3.5 h-3.5 ${showObiOverlay ? 'text-amber-400' : 'text-neutral-500'}`} />
            <span>OBI {showObiOverlay ? 'ON' : 'OFF'}</span>
            <span className={`text-[9px] px-1 py-0.2 rounded font-black ${
              obiMetrics.imbalancePct >= 0 
                ? 'bg-emerald-500/20 text-emerald-300' 
                : 'bg-rose-500/20 text-rose-300'
            }`}>
              {obiMetrics.imbalancePct >= 0 ? '+' : ''}{obiMetrics.imbalancePct.toFixed(1)}%
            </span>
          </button>

          {/* OBI View Mode (when active) */}
          {showObiOverlay && (
            <div className="flex items-center bg-[#050505] p-0.5 rounded-lg border border-amber-500/20">
              <button
                onClick={() => setObiViewMode('compact')}
                className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition ${
                  obiViewMode === 'compact'
                    ? 'bg-amber-500 text-black font-extrabold'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Visão compacta de OBI"
              >
                Geral
              </button>
              <button
                onClick={() => setObiViewMode('tiers')}
                className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition ${
                  obiViewMode === 'tiers'
                    ? 'bg-amber-500 text-black font-extrabold'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Desdobramento de OBI por faixas de preço (±0.5%, ±1%, ±2%, ±5%)"
              >
                Faixas OBI
              </button>
            </div>
          )}

          {/* CVD Overlay Toggle Button */}
          <button
            onClick={() => setShowCvdOverlay(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1.5 ${
              showCvdOverlay 
                ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-sm' 
                : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
            }`}
            title="Ativar/desativar overlay de Volume Delta Cumulativo (CVD)"
          >
            <Activity className={`w-3.5 h-3.5 ${showCvdOverlay ? 'text-cyan-400' : 'text-neutral-500'}`} />
            <span>CVD Delta {showCvdOverlay ? 'ON' : 'OFF'}</span>
          </button>

          {/* Volume Oscillator Toggle Button */}
          <button
            onClick={() => setShowVolumeOscillator(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1.5 ${
              showVolumeOscillator 
                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30 shadow-sm' 
                : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
            }`}
            title="Ativar/desativar indicador de Volume Oscillator (Momento do Delta CVD)"
          >
            <BarChart2 className={`w-3.5 h-3.5 ${showVolumeOscillator ? 'text-purple-400' : 'text-neutral-500'}`} />
            <span>Oscilador {showVolumeOscillator ? 'ON' : 'OFF'}</span>
            <span className={`text-[9px] px-1 py-0.2 rounded font-black ${
              volumeOsc.oscillatorPct >= 0 
                ? 'bg-emerald-500/20 text-emerald-300' 
                : 'bg-rose-500/20 text-rose-300'
            }`}>
              {volumeOsc.oscillatorPct >= 0 ? '+' : ''}{volumeOsc.oscillatorPct.toFixed(1)}%
            </span>
          </button>

          {/* CVD Mode Selector (when active) */}
          {showCvdOverlay && (
            <div className="flex items-center bg-[#050505] p-0.5 rounded-lg border border-cyan-500/20">
              <button
                onClick={() => setCvdOverlayMode('curve')}
                className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition ${
                  cvdOverlayMode === 'curve'
                    ? 'bg-cyan-500 text-black font-extrabold'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Curva contínua de CVD com área"
              >
                Curva
              </button>
              <button
                onClick={() => setCvdOverlayMode('bars')}
                className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition ${
                  cvdOverlayMode === 'bars'
                    ? 'bg-cyan-500 text-black font-extrabold'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Histograma de delta de agressão"
              >
                Barras
              </button>
              <button
                onClick={() => setCvdOverlayMode('split')}
                className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition ${
                  cvdOverlayMode === 'split'
                    ? 'bg-cyan-500 text-black font-extrabold'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Visão combinada (Curva + Barras de delta)"
              >
                Dual
              </button>
            </div>
          )}

          {/* Depth Range Filter */}
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
              Degraus
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
            title="Alternar atualização periódica da profundidade, OBI e CVD"
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
            title="Recarregar profundidade, OBI e CVD agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Primary Diagnostic Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Order Book Imbalance (OBI) Gauge */}
        <div className={`bg-[#050505] p-3 rounded-xl border transition-all ${
          showObiOverlay ? 'border-amber-500/30 shadow-md ring-1 ring-amber-500/20' : 'border-white/10'
        } space-y-1.5`}>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-neutral-400 flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              OBI (Bids - Asks)/(Bids + Asks):
            </span>
            <span className={`font-black ${
              isBidDominant ? 'text-emerald-400' : isAskDominant ? 'text-rose-400' : 'text-neutral-300'
            }`}>
              {obiMetrics.imbalancePct >= 0 ? '+' : ''}{obiMetrics.imbalancePct.toFixed(1)}% {isBidDominant ? 'BID' : isAskDominant ? 'ASK' : 'FLAT'}
            </span>
          </div>

          {/* Dual Balance Bar */}
          <div className="space-y-1">
            <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden flex">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${obiMetrics.bidPercentage}%` }}
                title={`Bids: ${obiMetrics.bidPercentage.toFixed(1)}%`}
              />
              <div 
                className="bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${obiMetrics.askPercentage}%` }}
                title={`Asks: ${obiMetrics.askPercentage.toFixed(1)}%`}
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-neutral-400">
              <span className="text-emerald-400 font-bold">{obiMetrics.bidPercentage.toFixed(0)}% Bids (Passivo)</span>
              <span className="text-rose-400 font-bold">{obiMetrics.askPercentage.toFixed(0)}% Asks (Passivo)</span>
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
              {obiMetrics.label || 'LIVRO EQUILIBRADO'}
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

      {/* Multi-Tier OBI Grid (when OBI tier mode is active) */}
      {showObiOverlay && obiViewMode === 'tiers' && (
        <div className="bg-[#050811] p-3 rounded-xl border border-amber-500/25 space-y-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-extrabold flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                Desdobramento de Order Book Imbalance (OBI) por Faixas de Profundidade
              </span>
              <span className="text-[9.5px] text-neutral-400 font-sans">
                Fórmula: OBI = (Bids - Asks) / (Bids + Asks)
              </span>
            </div>
            <span className="text-[10px] text-neutral-400">
              Faixa Atual Ativa: <strong className="text-white">±{depthRange}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {(['0.5%', '1%', '2%', '5%', 'full'] as const).map(tierKey => {
              const tier = multiTierObi[tierKey];
              const isCurrentTier = tierKey === depthRange || (tierKey === 'full' && depthRange === '5%');
              return (
                <div 
                  key={tierKey}
                  className={`p-2 rounded-lg border font-mono text-xs space-y-1 transition ${
                    isCurrentTier 
                      ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30' 
                      : 'bg-[#090a0f] border-white/10'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-neutral-400 font-bold">
                      {tierKey === 'full' ? 'Livro Completo' : `Faixa ±${tierKey}`}
                    </span>
                    <span className={`font-black text-[10.5px] ${
                      tier.imbalancePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {tier.imbalancePct >= 0 ? '+' : ''}{tier.imbalancePct.toFixed(1)}%
                    </span>
                  </div>

                  {/* Micro balance bar */}
                  <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: `${tier.bidPercentage}%` }} />
                    <div className="bg-rose-500 h-full" style={{ width: `${tier.askPercentage}%` }} />
                  </div>

                  <div className="flex justify-between text-[9px] text-neutral-400 pt-0.5">
                    <span className="text-emerald-400/90">${(tier.bidsVolumeUsd / 1_000_000).toFixed(1)}M</span>
                    <span className="text-rose-400/90">${(tier.asksVolumeUsd / 1_000_000).toFixed(1)}M</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comparative CVD Delta & OBI Real-Time Taker Volume Overlay Card */}
      <div className="bg-[#07090e] p-3.5 rounded-xl border border-cyan-500/25 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider font-mono">
                  Comparative CVD Delta & Order Book Imbalance (OBI)
                </h4>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                  cvdMetrics.cvdDirection === 'BUY'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : cvdMetrics.cvdDirection === 'SELL'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    : 'bg-neutral-800 text-neutral-400 border-white/10'
                }`}>
                  DELTA {cvdMetrics.cvdDirection}
                </span>
                {showObiOverlay && (
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                    obiMetrics.imbalancePct >= 0
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}>
                    OBI {obiMetrics.imbalancePct >= 0 ? '+' : ''}{obiMetrics.imbalancePct.toFixed(1)}%
                  </span>
                )}
              </div>
              <span className="text-[10.5px] text-neutral-400 font-mono">
                {cvdMetrics.aggressionDominanceLabel} • OBI: {obiMetrics.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="text-right">
              <div className="text-[10px] text-neutral-400">Net CVD Delta (24h)</div>
              <div className={`text-sm font-black ${
                cvdMetrics.netCvdDeltaUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {cvdMetrics.netCvdDeltaUsd >= 0 ? '+' : ''}${((cvdMetrics.netCvdDeltaUsd) / 1_000_000).toFixed(2)}M
                <span className="text-[10px] ml-1 font-bold">
                  ({cvdMetrics.cvdDeltaPercent >= 0 ? '+' : ''}{cvdMetrics.cvdDeltaPercent.toFixed(1)}%)
                </span>
              </div>
            </div>

            <div className="text-right border-l border-white/10 pl-3">
              <div className="text-[10px] text-neutral-400">Velocidade de Delta</div>
              <div className="text-xs font-bold text-amber-300">
                ${((cvdMetrics.volumeDeltaSpeedUsdPerMin) / 1000).toFixed(1)}k/min
              </div>
            </div>
          </div>
        </div>

        {/* Side-by-Side: Taker Aggression (CVD) vs Passive Order Book Imbalance (OBI) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Active Taker Market Flow (CVD) */}
          <div className="bg-[#0a0d14] p-2.5 rounded-lg border border-cyan-500/20 space-y-1.5">
            <div className="flex justify-between items-center text-[11px] font-mono">
              <span className="text-cyan-300 font-bold flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Fluxo Ativo Taker (Agressão a Mercado)
              </span>
              <span className="text-neutral-400 text-[10px]">
                Delta: <strong className={cvdMetrics.netCvdDeltaUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {cvdMetrics.netCvdDeltaUsd >= 0 ? '+' : ''}${(cvdMetrics.netCvdDeltaUsd / 1_000_000).toFixed(2)}M
                </strong>
              </span>
            </div>

            <div className="h-2.5 w-full bg-neutral-900 rounded-lg overflow-hidden flex border border-white/10">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${cvdMetrics.takerBuyRatioPct}%` }}
                title={`Taker Buy: ${cvdMetrics.takerBuyRatioPct.toFixed(1)}%`}
              />
              <div 
                className="bg-rose-500 h-full transition-all duration-500"
                style={{ width: `${cvdMetrics.takerSellRatioPct}%` }}
                title={`Taker Sell: ${cvdMetrics.takerSellRatioPct.toFixed(1)}%`}
              />
            </div>

            <div className="flex justify-between text-[9.5px] font-mono">
              <span className="text-emerald-400 font-bold">
                Buy: ${((cvdMetrics.takerBuyVolumeUsd) / 1_000_000).toFixed(1)}M ({cvdMetrics.takerBuyRatioPct.toFixed(0)}%)
              </span>
              <span className="text-rose-400 font-bold">
                Sell: ${((cvdMetrics.takerSellVolumeUsd) / 1_000_000).toFixed(1)}M ({cvdMetrics.takerSellRatioPct.toFixed(0)}%)
              </span>
            </div>
          </div>

          {/* Passive Order Book Imbalance (OBI) */}
          <div className="bg-[#0a0d14] p-2.5 rounded-lg border border-amber-500/20 space-y-1.5">
            <div className="flex justify-between items-center text-[11px] font-mono">
              <span className="text-amber-300 font-bold flex items-center gap-1">
                <Scale className="w-3 h-3" />
                Liquidez Passiva (OBI: (Bids - Asks)/(Bids + Asks))
              </span>
              <span className="text-neutral-400 text-[10px]">
                OBI: <strong className={obiMetrics.imbalancePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {obiMetrics.imbalancePct >= 0 ? '+' : ''}{obiMetrics.imbalancePct.toFixed(1)}%
                </strong>
              </span>
            </div>

            <div className="h-2.5 w-full bg-neutral-900 rounded-lg overflow-hidden flex border border-white/10">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${obiMetrics.bidPercentage}%` }}
                title={`Bids: ${obiMetrics.bidPercentage.toFixed(1)}%`}
              />
              <div 
                className="bg-rose-500 h-full transition-all duration-500"
                style={{ width: `${obiMetrics.askPercentage}%` }}
                title={`Asks: ${obiMetrics.askPercentage.toFixed(1)}%`}
              />
            </div>

            <div className="flex justify-between text-[9.5px] font-mono">
              <span className="text-emerald-400 font-bold">
                Bids: ${(obiMetrics.bidsVolumeUsd / 1_000_000).toFixed(1)}M ({obiMetrics.bidPercentage.toFixed(0)}%)
              </span>
              <span className="text-rose-400 font-bold">
                Asks: ${(obiMetrics.asksVolumeUsd / 1_000_000).toFixed(1)}M ({obiMetrics.askPercentage.toFixed(0)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Order Flow & OBI Confluence Diagnostic Banner */}
        <div className="bg-[#0b0f17] p-2.5 rounded-lg border border-cyan-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
              divergence.bias === 'BUY'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : divergence.bias === 'SELL'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-neutral-800 text-neutral-300 border-white/10'
            }`}>
              {divergence.divergenceLabel}
            </span>
            <span className="text-neutral-300 text-[11px]">
              {divergence.divergenceDescription}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-neutral-400 shrink-0">
            <span>OBI/Delta Confluência:</span>
            <span className={`font-black ${
              (obiMetrics.imbalancePct > 0 && cvdMetrics.netCvdDeltaUsd > 0)
                ? 'text-emerald-400'
                : (obiMetrics.imbalancePct < 0 && cvdMetrics.netCvdDeltaUsd < 0)
                ? 'text-rose-400'
                : 'text-amber-300'
            }`}>
              {(obiMetrics.imbalancePct > 0 && cvdMetrics.netCvdDeltaUsd > 0)
                ? 'CONVERGÊNCIA COMPRADORA ALTA'
                : (obiMetrics.imbalancePct < 0 && cvdMetrics.netCvdDeltaUsd < 0)
                ? 'CONVERGÊNCIA VENDEDORA ALTA'
                : 'ABSORÇÃO / DIVERGÊNCIA DE FLUXO'}
            </span>
          </div>
        </div>
      </div>

      {/* D3 Depth Canvas Container with CVD Overlay */}
      <div 
        ref={containerRef} 
        className="w-full h-[360px] bg-[#050505] rounded-xl border border-white/5 overflow-hidden relative"
      >
        <svg 
          ref={svgRef} 
          width={dimensions.width} 
          height={dimensions.height}
          className="w-full h-full"
        />

        {/* Legend Overlay on Canvas Top Left */}
        <div className="absolute top-2.5 left-3 flex flex-wrap items-center gap-3 bg-[#0a0a0c]/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-mono pointer-events-none shadow-lg">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span className="text-emerald-400 font-bold">Bids (Limit)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            <span className="text-rose-400 font-bold">Asks (Limit)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-amber-300 font-bold">Mid Market</span>
          </div>
          {showObiOverlay && (
            <div className="flex items-center gap-1 border-l border-white/15 pl-2">
              <Scale className="w-3 h-3 text-amber-400" />
              <span className={`font-bold ${obiMetrics.imbalancePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                OBI: {obiMetrics.imbalancePct >= 0 ? '+' : ''}{obiMetrics.imbalancePct.toFixed(1)}%
              </span>
            </div>
          )}
          {showCvdOverlay && (
            <>
              <div className="flex items-center gap-1 border-l border-white/15 pl-2">
                <span className="w-2.5 h-0.5 bg-cyan-400" />
                <span className="text-cyan-300 font-bold">Curva CVD Delta</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-emerald-400 font-bold">▲ Buy Taker: ${((cvdMetrics.takerBuyVolumeUsd)/1_000_000).toFixed(1)}M</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-rose-400 font-bold">▼ Sell Taker: ${((cvdMetrics.takerSellVolumeUsd)/1_000_000).toFixed(1)}M</span>
              </div>
            </>
          )}
        </div>

        {/* Hover Crosshair Tooltip with Depth, OBI & CVD Aggression breakdown */}
        {hoveredPoint && (
          <div 
            className="absolute z-50 pointer-events-none bg-[#0c0d10]/95 backdrop-blur-md border border-cyan-500/30 p-2.5 rounded-xl shadow-2xl font-mono text-xs w-64 space-y-1.5 transition-all"
            style={{
              left: Math.min(dimensions.width - 270, Math.max(10, hoveredPoint.x + 15)),
              top: Math.min(dimensions.height - 180, Math.max(10, hoveredPoint.y - 40))
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

              {/* OBI at this Tier */}
              {showObiOverlay && (
                <div className="mt-1 pt-1 border-t border-amber-500/20 flex justify-between items-center text-[10px]">
                  <span className="text-amber-300 font-bold">OBI na Faixa (±{Math.abs(hoveredPoint.level.deviationPct).toFixed(1)}%):</span>
                  <span className={`font-black ${obiMetrics.imbalancePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {obiMetrics.imbalancePct >= 0 ? '+' : ''}{obiMetrics.imbalancePct.toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Taker CVD Delta at this Price Tier */}
              {showCvdOverlay && typeof hoveredPoint.deltaEstimatedUsd === 'number' && (
                <div className="mt-1 pt-1 border-t border-cyan-500/20 space-y-0.5 text-[10px]">
                  <div className="text-cyan-300 font-bold flex items-center justify-between">
                    <span>Estimativa Delta Taker:</span>
                    <span className={hoveredPoint.deltaEstimatedUsd >= 0 ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'}>
                      {hoveredPoint.deltaEstimatedUsd >= 0 ? '+' : ''}${(hoveredPoint.deltaEstimatedUsd / 1_000_000).toFixed(2)}M
                    </span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span className="text-emerald-400">Buy: ${(hoveredPoint.takerBuyEstimatedUsd! / 1_000_000).toFixed(2)}M</span>
                    <span className="text-rose-400">Sell: ${(hoveredPoint.takerSellEstimatedUsd! / 1_000_000).toFixed(2)}M</span>
                  </div>
                </div>
              )}

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

      {/* Volume Oscillator Indicator at Bottom of Widget */}
      {showVolumeOscillator && (
        <div className="bg-[#090b10] border border-purple-500/25 rounded-xl p-3.5 space-y-3 shadow-xl">
          {/* Header & Metric Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="p-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400">
                <Gauge className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white font-mono uppercase tracking-wider">
                    Volume Oscillator (Momentum CVD Delta)
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-black font-mono border ${
                    volumeOsc.momentumState === 'EXPANDING_BULLISH'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : volumeOsc.momentumState === 'FADING_BULLISH'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : volumeOsc.momentumState === 'EXPANDING_BEARISH'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : volumeOsc.momentumState === 'FADING_BEARISH'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-neutral-800 text-neutral-400 border-white/10'
                  }`}>
                    {volumeOsc.trendLabel}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-sans mt-0.5">
                  {volumeOsc.description}
                </p>
              </div>
            </div>

            {/* Controls & Current Stats */}
            <div className="flex items-center gap-3 font-mono text-xs">
              <div className="flex items-center bg-[#050505] p-0.5 rounded-lg border border-purple-500/30">
                <button
                  onClick={() => setOscillatorPreset('fast')}
                  className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition ${
                    oscillatorPreset === 'fast'
                      ? 'bg-purple-600 text-white font-extrabold shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Configuração Rápida: EMA 5 vs EMA 14"
                >
                  Rápido (5/14)
                </button>
                <button
                  onClick={() => setOscillatorPreset('standard')}
                  className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition ${
                    oscillatorPreset === 'standard'
                      ? 'bg-purple-600 text-white font-extrabold shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Configuração Padrão: EMA 10 vs EMA 21"
                >
                  Padrão (10/21)
                </button>
              </div>

              <div className="text-right border-l border-white/10 pl-3">
                <div className="text-[9.5px] text-neutral-400">Oscilador %</div>
                <div className={`text-xs font-black ${
                  volumeOsc.oscillatorPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {volumeOsc.oscillatorPct >= 0 ? '+' : ''}{volumeOsc.oscillatorPct.toFixed(1)}%
                </div>
              </div>

              <div className="text-right border-l border-white/10 pl-3">
                <div className="text-[9.5px] text-neutral-400">Velocidade</div>
                <div className="text-xs font-bold text-purple-300">
                  {volumeOsc.velocityScore}/100
                </div>
              </div>
            </div>
          </div>

          {/* Visual Mini Subchart for Volume Oscillator Histogram & Curve */}
          <div className="w-full h-24 bg-[#050507] rounded-lg border border-white/5 p-2 relative overflow-hidden flex flex-col justify-between">
            {/* Reference Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-20">
              <div className="border-b border-dashed border-emerald-500 w-full" />
              <div className="border-b border-solid border-white/40 w-full" />
              <div className="border-b border-dashed border-rose-500 w-full" />
            </div>

            {/* Zero reference label */}
            <div className="absolute top-1/2 -translate-y-1/2 right-2 text-[8.5px] font-mono text-neutral-500 pointer-events-none">
              0.0% Linha Base
            </div>

            {/* Histogram Bars & Sparkline */}
            <div className="w-full h-full flex items-center justify-between gap-1 z-10 pt-1 pb-1">
              {oscSeries.map((pt, idx) => {
                const heightPct = Math.min(46, Math.max(6, Math.abs(pt.oscillatorValue) * 1.5));
                const isPositive = pt.oscillatorValue >= 0;

                return (
                  <div 
                    key={idx}
                    className="flex-1 h-full flex flex-col justify-center items-center group relative cursor-crosshair"
                  >
                    {/* Bar above zero */}
                    <div className="w-full h-1/2 flex items-end justify-center">
                      {isPositive && (
                        <div 
                          className={`w-full max-w-[6px] rounded-t-sm transition-all ${
                            pt.color === 'emerald'
                              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                              : pt.color === 'cyan'
                              ? 'bg-cyan-400/80'
                              : 'bg-emerald-600/70'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      )}
                    </div>

                    {/* Bar below zero */}
                    <div className="w-full h-1/2 flex items-start justify-center">
                      {!isPositive && (
                        <div 
                          className={`w-full max-w-[6px] rounded-b-sm transition-all ${
                            pt.color === 'rose'
                              ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]'
                              : pt.color === 'amber'
                              ? 'bg-amber-400/80'
                              : 'bg-rose-600/70'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      )}
                    </div>

                    {/* Tooltip on hover */}
                    <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#0c0d12] border border-purple-500/40 px-2 py-1 rounded text-[9px] font-mono whitespace-nowrap shadow-xl z-30 pointer-events-none">
                      <span className="text-neutral-400">{pt.timeLabel}:</span>{' '}
                      <strong className={pt.oscillatorValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {pt.oscillatorValue >= 0 ? '+' : ''}{pt.oscillatorValue.toFixed(1)}%
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Diagnostic Breakdown Footer */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px] font-mono pt-1">
            <div className="bg-[#0c0f16] p-2 rounded border border-white/5 flex flex-col">
              <span className="text-neutral-400 text-[9.5px]">Fast EMA Delta</span>
              <span className="text-emerald-400 font-bold">
                ${(volumeOsc.fastEma / 1_000_000).toFixed(2)}M
              </span>
            </div>
            <div className="bg-[#0c0f16] p-2 rounded border border-white/5 flex flex-col">
              <span className="text-neutral-400 text-[9.5px]">Slow EMA Delta</span>
              <span className="text-neutral-300 font-bold">
                ${(volumeOsc.slowEma / 1_000_000).toFixed(2)}M
              </span>
            </div>
            <div className="bg-[#0c0f16] p-2 rounded border border-white/5 flex flex-col">
              <span className="text-neutral-400 text-[9.5px]">Spread Momentum</span>
              <span className={`font-bold ${
                volumeOsc.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {volumeOsc.histogram >= 0 ? '+' : ''}${(volumeOsc.histogram / 1_000_000).toFixed(2)}M
              </span>
            </div>
            <div className="bg-[#0c0f16] p-2 rounded border border-white/5 flex flex-col">
              <span className="text-neutral-400 text-[9.5px]">Sinal Taker</span>
              <span className="text-purple-300 font-black">
                {volumeOsc.signal.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


