import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { 
  TrendingUp, 
  Target, 
  Calendar, 
  Award, 
  Percent, 
  BarChart3, 
  Layers, 
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight
} from 'lucide-react';

export interface DayHitRateMetric {
  date: string;
  timestamp: number;
  totalSignals: number;
  targetsReached: number;
  stoppedOut: number;
  expiredOrActive: number;
  winRate: number;
  avgConfluence: number;
  cumulativeWinRate: number;
  cumulativeSignals: number;
  signals?: Array<{
    id: string;
    symbol: string;
    direction: string;
    confluenceScore: number;
    status: string;
    currentPrice: number;
    entryPrice: number;
    target1: number;
    target2: number;
    stopLoss: number;
    pnlPct: number;
  }>;
}

export interface SignalHitRatePerformanceData {
  days: number;
  overallHitRate: number;
  profitFactor: number;
  totalSignals: number;
  totalWins: number;
  totalLosses: number;
  dailyMetrics: DayHitRateMetric[];
  bestDay: DayHitRateMetric | null;
}

interface SignalHitRateD3ChartProps {
  data?: SignalHitRatePerformanceData | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const SignalHitRateD3Chart: React.FC<SignalHitRateD3ChartProps> = ({
  data,
  isLoading = false,
  onRefresh
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [selectedMetricView, setSelectedMetricView] = useState<'both' | 'daily' | 'cumulative'>('both');
  const [hoveredPoint, setHoveredPoint] = useState<DayHitRateMetric | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data?.dailyMetrics || data.dailyMetrics.length === 0) {
      return;
    }

    const svgElement = svgRef.current;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = 300;
    const margin = { top: 25, right: 55, bottom: 40, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear previous render
    d3.select(svgElement).selectAll('*').remove();

    const svg = d3.select(svgElement)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('style', 'max-width: 100%; height: auto; overflow: visible;');

    // Defs for Gradients & Filters
    const defs = svg.append('defs');

    // Area Gradient for Daily WinRate
    const areaGradient = defs.append('linearGradient')
      .attr('id', 'daily-winrate-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');

    areaGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#10b981')
      .attr('stop-opacity', 0.28);

    areaGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#10b981')
      .attr('stop-opacity', 0.0);

    // Glow Filter for Cumulative Line
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-20%').attr('y', '-20%')
      .attr('width', '140%').attr('height', '140%');
    
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '2.5')
      .attr('result', 'coloredBlur');
    
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const metrics = data.dailyMetrics;

    // Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(metrics, d => new Date(d.date)) as [Date, Date])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([innerHeight, 0]);

    // Volume bars scale (total signals)
    const maxSignals = d3.max(metrics, d => d.totalSignals) || 10;
    const yVolumeScale = d3.scaleLinear()
      .domain([0, maxSignals * 2.5])
      .range([innerHeight, 0]);

    // Gridlines (Horizontal)
    const yAxisGrid = d3.axisLeft(yScale)
      .tickSize(-innerWidth)
      .tickFormat(() => '')
      .ticks(5);

    g.append('g')
      .attr('class', 'grid')
      .call(yAxisGrid)
      .selectAll('line')
      .attr('stroke', '#ffffff08')
      .attr('stroke-dasharray', '3 3');

    // 50% Benchmark & 70% Target lines
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(50))
      .attr('y2', yScale(50))
      .attr('stroke', '#ef444433')
      .attr('stroke-dasharray', '4 4')
      .attr('stroke-width', 1);

    g.append('text')
      .attr('x', innerWidth + 6)
      .attr('y', yScale(50) + 3)
      .attr('fill', '#ef444499')
      .attr('font-size', '9px')
      .attr('font-family', 'sans-serif')
      .text('50% BEP');

    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(70))
      .attr('y2', yScale(70))
      .attr('stroke', '#10b98144')
      .attr('stroke-dasharray', '4 4')
      .attr('stroke-width', 1);

    g.append('text')
      .attr('x', innerWidth + 6)
      .attr('y', yScale(70) + 3)
      .attr('fill', '#10b981aa')
      .attr('font-size', '9px')
      .attr('font-family', 'sans-serif')
      .text('70% Target');

    // Volume Bars (Underlay background for signal activity)
    const barWidth = Math.max(3, (innerWidth / metrics.length) * 0.45);
    g.selectAll('.signal-bar')
      .data(metrics)
      .enter()
      .append('rect')
      .attr('class', 'signal-bar')
      .attr('x', d => (xScale(new Date(d.date)) || 0) - barWidth / 2)
      .attr('y', d => yVolumeScale(d.totalSignals))
      .attr('width', barWidth)
      .attr('height', d => Math.max(0, innerHeight - yVolumeScale(d.totalSignals)))
      .attr('rx', 2)
      .attr('fill', '#38bdf818')
      .attr('stroke', '#38bdf830')
      .attr('stroke-width', 0.5);

    // Area Generator (Daily)
    if (selectedMetricView === 'both' || selectedMetricView === 'daily') {
      const area = d3.area<DayHitRateMetric>()
        .x(d => xScale(new Date(d.date)))
        .y0(innerHeight)
        .y1(d => yScale(d.winRate))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(metrics)
        .attr('fill', 'url(#daily-winrate-gradient)')
        .attr('d', area);

      // Line Generator (Daily Hit Rate)
      const dailyLine = d3.line<DayHitRateMetric>()
        .x(d => xScale(new Date(d.date)))
        .y(d => yScale(d.winRate))
        .curve(d3.curveMonotoneX);

      const dailyPath = g.append('path')
        .datum(metrics)
        .attr('fill', 'none')
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2)
        .attr('d', dailyLine);

      // Animation
      const totalLength = dailyPath.node()?.getTotalLength() || 1000;
      dailyPath
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(1200)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0);
    }

    // Cumulative Line Generator (Rolling Win Rate)
    if (selectedMetricView === 'both' || selectedMetricView === 'cumulative') {
      const cumulativeLine = d3.line<DayHitRateMetric>()
        .x(d => xScale(new Date(d.date)))
        .y(d => yScale(d.cumulativeWinRate))
        .curve(d3.curveMonotoneX);

      const cumPath = g.append('path')
        .datum(metrics)
        .attr('fill', 'none')
        .attr('stroke', '#38bdf8')
        .attr('stroke-width', 2.5)
        .attr('filter', 'url(#glow)')
        .attr('d', cumulativeLine);

      // Animation
      const cumTotalLength = cumPath.node()?.getTotalLength() || 1000;
      cumPath
        .attr('stroke-dasharray', `${cumTotalLength} ${cumTotalLength}`)
        .attr('stroke-dashoffset', cumTotalLength)
        .transition()
        .duration(1400)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0);
    }

    // Interactive Overlay and Dots
    const focusGroup = g.append('g').style('display', 'none');

    // Vertical cursor line
    const cursorLine = focusGroup.append('line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#ffffff40')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3');

    // Focus dots
    const dailyDot = focusGroup.append('circle')
      .attr('r', 5)
      .attr('fill', '#10b981')
      .attr('stroke', '#020617')
      .attr('stroke-width', 2);

    const cumDot = focusGroup.append('circle')
      .attr('r', 5)
      .attr('fill', '#38bdf8')
      .attr('stroke', '#020617')
      .attr('stroke-width', 2);

    // Bisector for hover
    const bisectDate = d3.bisector<DayHitRateMetric, Date>(d => new Date(d.date)).left;

    // Invisible overlay for capturing mouse events
    g.append('rect')
      .attr('class', 'overlay')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mouseenter', () => {
        focusGroup.style('display', null);
      })
      .on('mouseleave', () => {
        focusGroup.style('display', 'none');
        setHoveredPoint(null);
      })
      .on('mousemove', (event) => {
        const [xPos] = d3.pointer(event);
        const x0 = xScale.invert(xPos);
        const i = bisectDate(metrics, x0, 1);
        const d0 = metrics[i - 1];
        const d1 = metrics[i];
        let d = d0;
        if (d0 && d1) {
          d = x0.getTime() - new Date(d0.date).getTime() > new Date(d1.date).getTime() - x0.getTime() ? d1 : d0;
        } else if (d1) {
          d = d1;
        }

        if (d) {
          setHoveredPoint(d);
          const cx = xScale(new Date(d.date));
          cursorLine.attr('x1', cx).attr('x2', cx);
          dailyDot.attr('cx', cx).attr('cy', yScale(d.winRate));
          cumDot.attr('cx', cx).attr('cy', yScale(d.cumulativeWinRate));
        }
      });

    // Axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(Math.min(metrics.length, width > 640 ? 8 : 4))
      .tickFormat(d => d3.timeFormat('%d/%m')(d as Date))
      .tickSizeOuter(0);

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => `${d}%`)
      .tickSizeOuter(0);

    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('dy', '1em');

    xAxisG.selectAll('line').attr('stroke', '#334155');
    xAxisG.select('.domain').attr('stroke', '#334155');

    const yAxisG = g.append('g').call(yAxis);
    yAxisG.selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('dx', '-0.5em');

    yAxisG.selectAll('line').attr('stroke', '#334155');
    yAxisG.select('.domain').attr('stroke', '#334155');

  }, [data, selectedMetricView]);

  return (
    <div className="bg-[#0A0A0A] rounded-xl border border-white/10 shadow-xl overflow-hidden p-5 flex flex-col gap-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Award className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Auditoria de Assertividade dos Sinais (Hit-Rate)
            </h3>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
              D3.js Real Data
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">
            Validação estatística dos sinais emitidos nos últimos 30 dias comparados com o price action subsequente (Alvo atingido vs Stop).
          </p>
        </div>

        {/* View Switchers & Controls */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[#121212] p-0.5 rounded-lg border border-white/10 text-[11px]">
            <button
              onClick={() => setSelectedMetricView('both')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                selectedMetricView === 'both' 
                  ? 'bg-neutral-800 text-white shadow-sm' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Combinado
            </button>
            <button
              onClick={() => setSelectedMetricView('daily')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                selectedMetricView === 'daily' 
                  ? 'bg-neutral-800 text-emerald-400 shadow-sm' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Diário
            </button>
            <button
              onClick={() => setSelectedMetricView('cumulative')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                selectedMetricView === 'cumulative' 
                  ? 'bg-neutral-800 text-sky-400 shadow-sm' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Acumulado
            </button>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Recalcular métricas de assertividade"
              className="p-1.5 rounded-lg border border-white/10 bg-[#121212] text-neutral-400 hover:text-white hover:border-white/20 transition disabled:opacity-50"
            >
              <BarChart3 className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-[#111] rounded-lg border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>Hit-Rate Médio (30d)</span>
            <Target className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-emerald-400">
              {data?.overallHitRate?.toFixed(1) || '0.0'}%
            </span>
            <span className="text-[10px] text-emerald-500/80 font-semibold">
              ≥ 70% Meta
            </span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">
            {data?.totalWins || 0} alvos / {(data?.totalWins || 0) + (data?.totalLosses || 0)} trades concluídos
          </div>
        </div>

        <div className="p-3 bg-[#111] rounded-lg border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>Profit Factor</span>
            <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-sky-400">
              {data?.profitFactor?.toFixed(2) || '0.00'}
            </span>
            <span className="text-[10px] text-sky-500/80 font-semibold">
              R:R 1:2.15
            </span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">
            Ganhos brutos / perdas brutas
          </div>
        </div>

        <div className="p-3 bg-[#111] rounded-lg border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>Sinais Gerados (30d)</span>
            <Layers className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-purple-400">
              {data?.totalSignals || 0}
            </span>
            <span className="text-[10px] text-purple-400/80 font-semibold">
              ~{Math.round((data?.totalSignals || 0) / 30)}/dia
            </span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">
            Com confluência &gt; 65pts
          </div>
        </div>

        <div className="p-3 bg-[#111] rounded-lg border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span>Melhor Assertividade Diária</span>
            <Award className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-amber-400">
              {data?.bestDay ? `${data.bestDay.winRate}%` : '--'}
            </span>
            <span className="text-[10px] text-neutral-400">
              {data?.bestDay ? data.bestDay.date.slice(5) : ''}
            </span>
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">
            {data?.bestDay?.targetsReached || 0} de {data?.bestDay?.totalSignals || 0} no alvo
          </div>
        </div>
      </div>

      {/* D3 Canvas Container */}
      <div className="relative w-full" ref={containerRef}>
        <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1 px-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-neutral-300 font-medium">Assertividade Diária (%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-sky-400 rounded-full" />
              <span className="text-neutral-300 font-medium">Média Acumulada Móvel (%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-sky-400/20 border border-sky-400/40" />
              <span className="text-neutral-500">Volume de Sinais</span>
            </div>
          </div>
          <span className="text-[10px] text-neutral-500">Passe o mouse para auditar o dia</span>
        </div>

        <div className="bg-[#050505] rounded-lg border border-white/5 p-2 overflow-hidden">
          <svg ref={svgRef} className="w-full select-none" />
        </div>

        {/* Hover Inspector Tooltip / Card */}
        {hoveredPoint && (
          <div className="mt-3 p-3 bg-[#111] rounded-lg border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-neutral-400" />
              <span className="font-bold text-white">{hoveredPoint.date}</span>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <div>
                <span className="text-neutral-400">Assertividade: </span>
                <span className={`font-bold ${hoveredPoint.winRate >= 70 ? 'text-emerald-400' : hoveredPoint.winRate >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {hoveredPoint.winRate}%
                </span>
              </div>
              <div>
                <span className="text-neutral-400">Acumulado: </span>
                <span className="font-bold text-sky-400">
                  {hoveredPoint.cumulativeWinRate}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> {hoveredPoint.targetsReached} Alvo
                </span>
                <span className="text-rose-400 font-bold flex items-center gap-0.5 ml-2">
                  <XCircle className="w-3 h-3" /> {hoveredPoint.stoppedOut} Stop
                </span>
              </div>
              <div>
                <span className="text-neutral-400">Score Confluência Médio: </span>
                <span className="font-bold text-neutral-200">{hoveredPoint.avgConfluence} pts</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Explanatory Methodology Footnote */}
      <div className="flex items-start gap-2 text-[10px] text-neutral-500 bg-[#0d0d0d] p-2.5 rounded-lg border border-white/5">
        <Info className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Metodologia de Validação D3:</strong> A assertividade é apurada avaliando se a máxima variação subsequente de preço atingiu o Alvo Projetado (Target 1 ou Target 2) antes do limite de Stop Loss. Sinais mantidos ou com fechamento em breakeven são calculados proporcionalmente ao PnL verificado.
        </span>
      </div>
    </div>
  );
};
