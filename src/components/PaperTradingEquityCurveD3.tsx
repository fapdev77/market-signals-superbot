import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { PaperAccountState, PaperTradeRecord, PaperPosition } from '../types';
import { formatPrice, formatPercent, formatDateTime, formatTimeAgo } from '../utils/formatters';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Maximize2, 
  Award, 
  ShieldAlert, 
  Layers, 
  Sparkles, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Target,
  Activity,
  Zap,
  Info
} from 'lucide-react';
import { Tooltip } from './Tooltip';

export interface EquityDataPoint {
  tradeIndex: number;
  timestamp: number;
  dateStr: string;
  equity: number;
  cashBalance: number;
  highWatermark: number;
  drawdownAmount: number;
  drawdownPct: number;
  returnPct: number;
  tradeNetPnl: number;
  tradeGrossPnl: number;
  tradeFees: number;
  tradeSymbol?: string;
  tradeSide?: string;
  tradeExitReason?: string;
  tradeRoePct?: number;
  isInitialPoint?: boolean;
  isCurrentPoint?: boolean;
}

interface PaperTradingEquityCurveD3Props {
  accountState: PaperAccountState;
  currentTickerSymbol?: string;
}

export const PaperTradingEquityCurveD3: React.FC<PaperTradingEquityCurveD3Props> = ({
  accountState,
  currentTickerSymbol
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // View modes
  const [viewMode, setViewMode] = useState<'equity' | 'return' | 'drawdown'>('equity');
  const [showHighWatermark, setShowHighWatermark] = useState<boolean>(true);
  const [showBaseline, setShowBaseline] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<EquityDataPoint | null>(null);

  const initialBalance = accountState.initialBalance || 10000;

  // Process and compute time-series equity points chronologically from trade history
  const equityPoints: EquityDataPoint[] = useMemo(() => {
    // Sort closed trades chronologically (oldest to newest)
    const sortedTrades = [...accountState.tradeHistory].sort((a, b) => a.closedAt - b.closedAt);

    const points: EquityDataPoint[] = [];

    // Start point at account creation / sandbox start
    const startTimestamp = sortedTrades.length > 0 
      ? Math.min(sortedTrades[0].openedAt, sortedTrades[0].closedAt - 60000) 
      : Date.now() - 3600000;

    let runningEquity = initialBalance;
    let runningHighWatermark = initialBalance;

    points.push({
      tradeIndex: 0,
      timestamp: startTimestamp,
      dateStr: formatDateTime(startTimestamp),
      equity: initialBalance,
      cashBalance: initialBalance,
      highWatermark: initialBalance,
      drawdownAmount: 0,
      drawdownPct: 0,
      returnPct: 0,
      tradeNetPnl: 0,
      tradeGrossPnl: 0,
      tradeFees: 0,
      isInitialPoint: true
    });

    sortedTrades.forEach((trade, idx) => {
      runningEquity += trade.netPnl;
      if (runningEquity > runningHighWatermark) {
        runningHighWatermark = runningEquity;
      }
      const drawdownAmount = Math.max(0, runningHighWatermark - runningEquity);
      const drawdownPct = runningHighWatermark > 0 ? (drawdownAmount / runningHighWatermark) * 100 : 0;
      const returnPct = initialBalance > 0 ? ((runningEquity - initialBalance) / initialBalance) * 100 : 0;

      points.push({
        tradeIndex: idx + 1,
        timestamp: trade.closedAt,
        dateStr: formatDateTime(trade.closedAt),
        equity: runningEquity,
        cashBalance: runningEquity,
        highWatermark: runningHighWatermark,
        drawdownAmount,
        drawdownPct,
        returnPct,
        tradeNetPnl: trade.netPnl,
        tradeGrossPnl: trade.grossPnl,
        tradeFees: trade.feesPaid,
        tradeSymbol: trade.symbol,
        tradeSide: trade.side,
        tradeExitReason: trade.exitReason,
        tradeRoePct: trade.roePct
      });
    });

    // If there are open positions, append live current equity as the latest ticking point
    if (accountState.positions.length > 0) {
      const liveEquity = accountState.totalEquity;
      if (liveEquity > runningHighWatermark) {
        runningHighWatermark = liveEquity;
      }
      const ddAmount = Math.max(0, runningHighWatermark - liveEquity);
      const ddPct = runningHighWatermark > 0 ? (ddAmount / runningHighWatermark) * 100 : 0;
      const retPct = initialBalance > 0 ? ((liveEquity - initialBalance) / initialBalance) * 100 : 0;

      points.push({
        tradeIndex: sortedTrades.length + 1,
        timestamp: Date.now(),
        dateStr: 'Agora (Ao Vivo)',
        equity: liveEquity,
        cashBalance: accountState.cashBalance,
        highWatermark: runningHighWatermark,
        drawdownAmount: ddAmount,
        drawdownPct: ddPct,
        returnPct: retPct,
        tradeNetPnl: accountState.totalUnrealizedPnl,
        tradeGrossPnl: accountState.totalUnrealizedPnl,
        tradeFees: 0,
        isCurrentPoint: true
      });
    }

    return points;
  }, [accountState.tradeHistory, accountState.positions, accountState.totalEquity, accountState.totalUnrealizedPnl, accountState.cashBalance, initialBalance]);

  // Statistics derived from points
  const stats = useMemo(() => {
    const currentEquity = accountState.totalEquity || initialBalance;
    const netProfit = currentEquity - initialBalance;
    const netReturnPct = initialBalance > 0 ? (netProfit / initialBalance) * 100 : 0;

    let peakEquity = initialBalance;
    let maxDrawdownAmt = 0;
    let maxDrawdownPct = 0;

    equityPoints.forEach(p => {
      if (p.equity > peakEquity) peakEquity = p.equity;
      if (p.drawdownAmount > maxDrawdownAmt) maxDrawdownAmt = p.drawdownAmount;
      if (p.drawdownPct > maxDrawdownPct) maxDrawdownPct = p.drawdownPct;
    });

    const totalTrades = accountState.tradeHistory.length;
    const wins = accountState.tradeHistory.filter(t => t.netPnl > 0).length;
    const losses = accountState.tradeHistory.filter(t => t.netPnl <= 0).length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const avgTradePnl = totalTrades > 0 ? (netProfit / totalTrades) : 0;

    return {
      currentEquity,
      netProfit,
      netReturnPct,
      peakEquity,
      maxDrawdownAmt,
      maxDrawdownPct,
      totalTrades,
      winRate,
      avgTradePnl,
      profitFactor: accountState.profitFactor || 0,
      totalFeesPaid: accountState.totalFeesPaid || 0
    };
  }, [equityPoints, accountState, initialBalance]);

  // D3 Rendering Hook
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    const bounds = container.getBoundingClientRect();
    const width = Math.max(320, bounds.width);
    const height = 280;
    const margin = { top: 25, right: 35, bottom: 35, left: 65 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`)
       .attr('width', '100%')
       .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Definitions for gradients & shadow filters
    const defs = svg.append('defs');

    // Positive Equity Area Gradient (Emerald)
    const emeraldGrad = defs.append('linearGradient')
      .attr('id', 'equityEmeraldGradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    emeraldGrad.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.45);
    emeraldGrad.append('stop').attr('offset', '50%').attr('stop-color', '#059669').attr('stop-opacity', 0.15);
    emeraldGrad.append('stop').attr('offset', '100%').attr('stop-color', '#047857').attr('stop-opacity', 0.0);

    // Negative Equity Area Gradient (Rose)
    const roseGrad = defs.append('linearGradient')
      .attr('id', 'equityRoseGradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    roseGrad.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.45);
    roseGrad.append('stop').attr('offset', '100%').attr('stop-color', '#be123c').attr('stop-opacity', 0.0);

    // Drawdown Area Gradient (Purple / Crimson)
    const ddGrad = defs.append('linearGradient')
      .attr('id', 'drawdownGradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    ddGrad.append('stop').attr('offset', '0%').attr('stop-color', '#a855f7').attr('stop-opacity', 0.0);
    ddGrad.append('stop').attr('offset', '100%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.4);

    // Glow filter for line
    const filter = defs.append('filter')
      .attr('id', 'equityGlow')
      .attr('x', '-20%').attr('y', '-20%')
      .attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '2.5')
      .attr('result', 'blur');
    filter.append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .enter()
      .append('feMergeNode')
      .attr('in', d => d);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, Math.max(1, equityPoints.length - 1)])
      .range([0, innerWidth]);

    let yDomain: [number, number];

    if (viewMode === 'equity') {
      const minVal = d3.min(equityPoints, d => d.equity) || initialBalance;
      const maxVal = d3.max(equityPoints, d => Math.max(d.equity, d.highWatermark)) || initialBalance;
      const padding = Math.max(50, (maxVal - minVal) * 0.12);
      yDomain = [
        Math.min(initialBalance * 0.95, minVal - padding),
        Math.max(initialBalance * 1.05, maxVal + padding)
      ];
    } else if (viewMode === 'return') {
      const minVal = d3.min(equityPoints, d => d.returnPct) || 0;
      const maxVal = d3.max(equityPoints, d => d.returnPct) || 0;
      const padding = Math.max(1.0, (maxVal - minVal) * 0.15);
      yDomain = [Math.min(-2, minVal - padding), Math.max(2, maxVal + padding)];
    } else {
      // Drawdown mode (0 to -Max DD %)
      const maxDD = d3.max(equityPoints, d => d.drawdownPct) || 0;
      yDomain = [Math.max(5, maxDD * 1.25), 0]; // Reversed Y axis: 0 at top, deeper DD below
    }

    const yScale = d3.scaleLinear()
      .domain(yDomain)
      .range([innerHeight, 0])
      .nice();

    // Background Grid lines
    const yAxisTicks = yScale.ticks(6);
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yAxisTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#1f1f1f')
      .attr('stroke-dasharray', '2,2');

    // X Axis (Trade # / Progress)
    const xAxis = d3.axisBottom(xScale)
      .ticks(Math.min(innerWidth > 500 ? 10 : 5, equityPoints.length))
      .tickFormat((d) => {
        const idx = Number(d);
        if (idx === 0) return 'Início';
        if (idx === equityPoints.length - 1 && equityPoints[idx]?.isCurrentPoint) return 'Live';
        return `T#${idx}`;
      });

    const gX = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    gX.select('.domain').attr('stroke', '#333333');
    gX.selectAll('.tick line').attr('stroke', '#333333');
    gX.selectAll('.tick text')
      .attr('fill', '#737373')
      .attr('font-size', '10px')
      .attr('font-family', 'ui-monospace, monospace');

    // Y Axis (Value)
    const yAxis = d3.axisLeft(yScale)
      .ticks(6)
      .tickFormat((d) => {
        const val = Number(d);
        if (viewMode === 'equity') {
          return val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val.toFixed(0)}`;
        } else if (viewMode === 'return') {
          return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
        } else {
          return `-${val.toFixed(1)}%`;
        }
      });

    const gY = g.append('g').call(yAxis);
    gY.select('.domain').attr('stroke', '#333333');
    gY.selectAll('.tick line').attr('stroke', '#333333');
    gY.selectAll('.tick text')
      .attr('fill', '#888888')
      .attr('font-size', '10px')
      .attr('font-family', 'ui-monospace, monospace');

    // Baseline Reference Line (at initialBalance or 0% return)
    if (showBaseline && viewMode !== 'drawdown') {
      const baselineVal = viewMode === 'equity' ? initialBalance : 0;
      const baselineY = yScale(baselineVal);

      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', baselineY)
        .attr('y2', baselineY)
        .attr('stroke', '#737373')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0.6);

      g.append('text')
        .attr('x', 6)
        .attr('y', baselineY - 5)
        .attr('fill', '#737373')
        .attr('font-size', '9px')
        .attr('font-family', 'ui-monospace, monospace')
        .text(viewMode === 'equity' ? `Saldo Base: $${formatPrice(initialBalance)}` : 'Retorno Base (0.00%)');
    }

    // High Watermark Step-Line
    if (showHighWatermark && viewMode === 'equity') {
      const hwmLine = d3.line<EquityDataPoint>()
        .x((_, i) => xScale(i))
        .y(d => yScale(d.highWatermark))
        .curve(d3.curveStepAfter);

      g.append('path')
        .datum(equityPoints)
        .attr('fill', 'none')
        .attr('stroke', '#06b6d4')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '3,3')
        .attr('opacity', 0.5)
        .attr('d', hwmLine);
    }

    // Generator for Area
    if (viewMode === 'equity') {
      const areaGen = d3.area<EquityDataPoint>()
        .x((_, i) => xScale(i))
        .y0(innerHeight)
        .y1(d => yScale(d.equity))
        .curve(d3.curveMonotoneX);

      const isOverallProfitable = (accountState.totalEquity || initialBalance) >= initialBalance;

      g.append('path')
        .datum(equityPoints)
        .attr('fill', `url(#${isOverallProfitable ? 'equityEmeraldGradient' : 'equityRoseGradient'})`)
        .attr('d', areaGen);
    } else if (viewMode === 'return') {
      const areaGen = d3.area<EquityDataPoint>()
        .x((_, i) => xScale(i))
        .y0(yScale(0))
        .y1(d => yScale(d.returnPct))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(equityPoints)
        .attr('fill', 'url(#equityEmeraldGradient)')
        .attr('d', areaGen);
    } else {
      // Drawdown underwater area
      const ddAreaGen = d3.area<EquityDataPoint>()
        .x((_, i) => xScale(i))
        .y0(0)
        .y1(d => yScale(d.drawdownPct))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(equityPoints)
        .attr('fill', 'url(#drawdownGradient)')
        .attr('d', ddAreaGen);
    }

    // Generator for Main Equity Line
    const lineGen = d3.line<EquityDataPoint>()
      .x((_, i) => xScale(i))
      .y(d => {
        if (viewMode === 'equity') return yScale(d.equity);
        if (viewMode === 'return') return yScale(d.returnPct);
        return yScale(d.drawdownPct);
      })
      .curve(d3.curveMonotoneX);

    const lineColor = viewMode === 'drawdown'
      ? '#f43f5e'
      : ((accountState.totalEquity || initialBalance) >= initialBalance ? '#10b981' : '#f43f5e');

    // Glow path under main line
    g.append('path')
      .datum(equityPoints)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 3)
      .attr('opacity', 0.4)
      .attr('filter', 'url(#equityGlow)')
      .attr('d', lineGen);

    // Primary Crisp Line
    const path = g.append('path')
      .datum(equityPoints)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 2.2)
      .attr('d', lineGen);

    // Animate line draw on mount / refresh
    const totalLength = (path.node() as SVGPathElement)?.getTotalLength() || 0;
    path.attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(650)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0);

    // Render Data Point Dots
    const dotsGroup = g.append('g').attr('class', 'equity-dots');

    dotsGroup.selectAll('circle.data-dot')
      .data(equityPoints)
      .enter()
      .append('circle')
      .attr('class', 'data-dot')
      .attr('cx', (_, i) => xScale(i))
      .attr('cy', d => {
        if (viewMode === 'equity') return yScale(d.equity);
        if (viewMode === 'return') return yScale(d.returnPct);
        return yScale(d.drawdownPct);
      })
      .attr('r', (d, i) => i === equityPoints.length - 1 ? 5 : (d.tradeNetPnl !== 0 ? 3.5 : 2.5))
      .attr('fill', (d) => {
        if (d.isInitialPoint) return '#737373';
        if (d.isCurrentPoint) return '#06b6d4';
        return d.tradeNetPnl >= 0 ? '#10b981' : '#f43f5e';
      })
      .attr('stroke', '#0c0c0c')
      .attr('stroke-width', 1.5);

    // Active pulse on current live point if positions open
    if (accountState.positions.length > 0) {
      const lastIdx = equityPoints.length - 1;
      const lastPoint = equityPoints[lastIdx];
      const cx = xScale(lastIdx);
      const cy = viewMode === 'equity' ? yScale(lastPoint.equity) : (viewMode === 'return' ? yScale(lastPoint.returnPct) : yScale(lastPoint.drawdownPct));

      g.append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 8)
        .attr('fill', 'none')
        .attr('stroke', '#06b6d4')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.8)
        .append('animate')
        .attr('attributeName', 'r')
        .attr('values', '4;11;4')
        .attr('dur', '2s')
        .attr('repeatCount', 'indefinite');
    }

    // Crosshair & Interactive Hover Overlay
    const crosshair = g.append('g').attr('class', 'crosshair').style('display', 'none');

    const crosshairLine = crosshair.append('line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#f97316')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.85);

    const crosshairDot = crosshair.append('circle')
      .attr('r', 5)
      .attr('fill', '#f97316')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    // Transparent overlay capturing pointer events
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', function (event) {
        const [mx] = d3.pointer(event);
        const rawIndex = xScale.invert(mx);
        const idx = Math.max(0, Math.min(equityPoints.length - 1, Math.round(rawIndex)));
        const pt = equityPoints[idx];

        if (pt) {
          setHoveredPoint(pt);
          crosshair.style('display', null);
          const cx = xScale(idx);
          const cy = viewMode === 'equity' 
            ? yScale(pt.equity) 
            : (viewMode === 'return' ? yScale(pt.returnPct) : yScale(pt.drawdownPct));

          crosshairLine.attr('x1', cx).attr('x2', cx);
          crosshairDot.attr('cx', cx).attr('cy', cy);
        }
      })
      .on('mouseleave', function () {
        setHoveredPoint(null);
        crosshair.style('display', 'none');
      });

  }, [equityPoints, viewMode, showHighWatermark, showBaseline, accountState.totalEquity, initialBalance]);

  return (
    <div className="w-full bg-[#0a0a0a] rounded-xl border border-white/10 p-4 space-y-3 font-sans shadow-2xl">
      {/* HEADER CONTROLS BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                Curva Cumulativa de Patrimônio
                <span className="text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                  D3.JS VECTORIAL
                </span>
              </h4>
            </div>
            <p className="text-[11px] text-neutral-400">
              Evolução contínua do saldo virtual trade-a-trade, marcas de pico (High Watermark) e profundidade de rebaixamento (Drawdown).
            </p>
          </div>
        </div>

        {/* View Mode Segmented Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#050505] p-1 rounded-lg border border-white/10 font-mono text-xs">
            <button
              type="button"
              onClick={() => setViewMode('equity')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                viewMode === 'equity'
                  ? 'bg-orange-500 text-black font-black shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Patrimônio ($)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('return')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                viewMode === 'return'
                  ? 'bg-orange-500 text-black font-black shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Retorno (%)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('drawdown')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                viewMode === 'drawdown'
                  ? 'bg-rose-600 text-white font-black shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Drawdown (%)
            </button>
          </div>

          {/* High Watermark & Baseline Toggles */}
          {viewMode === 'equity' && (
            <div className="hidden md:flex items-center gap-1.5 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => setShowHighWatermark(!showHighWatermark)}
                className={`px-2 py-1 rounded border transition cursor-pointer ${
                  showHighWatermark
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-[#050505] text-neutral-500 border-white/5 hover:text-neutral-300'
                }`}
              >
                Pico (HWM)
              </button>
              <button
                type="button"
                onClick={() => setShowBaseline(!showBaseline)}
                className={`px-2 py-1 rounded border transition cursor-pointer ${
                  showBaseline
                    ? 'bg-neutral-800 text-neutral-300 border-white/20'
                    : 'bg-[#050505] text-neutral-500 border-white/5 hover:text-neutral-300'
                }`}
              >
                Base ($)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* QUICK STATS WATERMARK RIBBON */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs font-mono">
        <div className="bg-[#050505] p-2 rounded-lg border border-white/5">
          <span className="text-[9px] text-neutral-400 uppercase font-bold block">Saldo Base</span>
          <span className="text-white font-bold">${formatPrice(initialBalance)}</span>
        </div>

        <div className="bg-[#050505] p-2 rounded-lg border border-white/5">
          <span className="text-[9px] text-neutral-400 uppercase font-bold block">Patrimônio Atual</span>
          <span className={`font-black ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ${formatPrice(stats.currentEquity)}
          </span>
        </div>

        <div className="bg-[#050505] p-2 rounded-lg border border-white/5">
          <span className="text-[9px] text-neutral-400 uppercase font-bold block">Retorno Líquido</span>
          <span className={`font-black ${stats.netReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {stats.netReturnPct >= 0 ? '+' : ''}{stats.netReturnPct.toFixed(2)}%
          </span>
        </div>

        <div className="bg-[#050505] p-2 rounded-lg border border-white/5">
          <span className="text-[9px] text-cyan-400 uppercase font-bold block">Pico Histórico (HWM)</span>
          <span className="text-cyan-300 font-bold">${formatPrice(stats.peakEquity)}</span>
        </div>

        <div className="bg-[#050505] p-2 rounded-lg border border-rose-500/20">
          <span className="text-[9px] text-rose-400 uppercase font-bold block">Max Drawdown</span>
          <span className="text-rose-400 font-bold">-{stats.maxDrawdownPct.toFixed(2)}%</span>
        </div>

        <div className="bg-[#050505] p-2 rounded-lg border border-amber-500/20">
          <span className="text-[9px] text-amber-400 uppercase font-bold block">Profit Factor</span>
          <span className="text-amber-300 font-bold">{stats.profitFactor.toFixed(2)}</span>
        </div>
      </div>

      {/* D3 SVG CHART CONTAINER */}
      <div ref={containerRef} className="relative w-full overflow-hidden select-none bg-[#050505] rounded-xl border border-white/5">
        <svg ref={svgRef} className="w-full block" />

        {/* Floating Tooltip Card */}
        {hoveredPoint && (
          <div className="absolute top-2 right-2 bg-neutral-950/95 backdrop-blur-md border border-white/15 p-2.5 rounded-lg shadow-2xl font-mono text-[11px] space-y-1 z-30 pointer-events-none min-w-[210px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-1">
              <span className="text-white font-bold">
                {hoveredPoint.isInitialPoint 
                  ? 'Ponto de Partida' 
                  : (hoveredPoint.isCurrentPoint ? '🔥 Ao Vivo (Posição Aberta)' : `Trade #${hoveredPoint.tradeIndex}`)}
              </span>
              <span className="text-[9px] text-neutral-400">{hoveredPoint.dateStr}</span>
            </div>

            <div className="flex justify-between items-center text-neutral-300">
              <span className="text-neutral-400">Patrimônio:</span>
              <span className="text-white font-black">${formatPrice(hoveredPoint.equity)}</span>
            </div>

            <div className="flex justify-between items-center text-neutral-300">
              <span className="text-neutral-400">Retorno Total:</span>
              <span className={`font-bold ${hoveredPoint.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {hoveredPoint.returnPct >= 0 ? '+' : ''}{hoveredPoint.returnPct.toFixed(2)}%
              </span>
            </div>

            {!hoveredPoint.isInitialPoint && hoveredPoint.tradeSymbol && (
              <div className="border-t border-white/10 pt-1 space-y-0.5 text-[10px]">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Ativo / Lado:</span>
                  <span className="font-bold text-orange-400">
                    {hoveredPoint.tradeSymbol} ({hoveredPoint.tradeSide})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">PnL deste Trade:</span>
                  <span className={`font-bold ${hoveredPoint.tradeNetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {hoveredPoint.tradeNetPnl >= 0 ? '+' : ''}${hoveredPoint.tradeNetPnl.toFixed(2)} ({hoveredPoint.tradeRoePct ? `${hoveredPoint.tradeRoePct.toFixed(1)}%` : ''})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Taxas Pagas:</span>
                  <span className="text-amber-400 font-bold">-${hoveredPoint.tradeFees.toFixed(3)}</span>
                </div>
              </div>
            )}

            {hoveredPoint.drawdownPct > 0 && (
              <div className="flex justify-between items-center text-rose-400 border-t border-white/10 pt-1 text-[10px]">
                <span>Drawdown do Pico:</span>
                <span className="font-bold">-${hoveredPoint.drawdownAmount.toFixed(2)} (-{hoveredPoint.drawdownPct.toFixed(2)}%)</span>
              </div>
            )}
          </div>
        )}

        {/* Empty state overlay when no closed trades yet */}
        {accountState.tradeHistory.length === 0 && accountState.positions.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-2xs p-4 text-center">
            <Sparkles className="h-6 w-6 text-orange-400 mb-1.5 animate-pulse" />
            <p className="text-xs font-bold text-white">Curva de Patrimônio Pronta para Mapeamento</p>
            <p className="text-[11px] text-neutral-400 max-w-sm mt-0.5">
              Execute e encerre trades simulados acima para gerar sua curva de capital em tempo real com métricas de Sharpe, Win Rate e Drawdown.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
