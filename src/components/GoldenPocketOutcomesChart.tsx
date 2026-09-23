import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export interface OutcomeItem {
  profitable: boolean;
  pnlPct: number;
  timestamp: number;
}

interface GoldenPocketOutcomesChartProps {
  outcomes: OutcomeItem[];
  symbol: string;
  width?: number;
  height?: number;
}

export const GoldenPocketOutcomesChart: React.FC<GoldenPocketOutcomesChartProps> = ({
  outcomes,
  symbol,
  width = 240,
  height = 95
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredTrade, setHoveredTrade] = useState<{
    index: number;
    pnlPct: number;
    profitable: boolean;
    dateStr: string;
  } | null>(null);

  useEffect(() => {
    if (!svgRef.current || !outcomes || outcomes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 12, right: 12, bottom: 20, left: 28 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Determine max absolute PnL to symmetrically center around 0
    const maxPnl = Math.max(
      ...outcomes.map(d => Math.abs(d.pnlPct)),
      2.5 // minimum floor for visual clarity
    );

    // X Scale: band scale for each outcome trade
    const xScale = d3.scaleBand<number>()
      .domain(outcomes.map((_, i) => i))
      .range([0, innerWidth])
      .padding(0.24);

    // Y Scale: linear centered at 0
    const yScale = d3.scaleLinear()
      .domain([-maxPnl, maxPnl])
      .range([innerHeight, 0])
      .nice();

    const yZero = yScale(0);

    // Subtle horizontal gridlines
    const yAxisGrid = d3.axisLeft(yScale)
      .tickSize(-innerWidth)
      .tickFormat(() => '')
      .ticks(4);

    g.append('g')
      .attr('class', 'grid')
      .call(yAxisGrid)
      .selectAll('line')
      .attr('stroke', '#ffffff08')
      .attr('stroke-dasharray', '2 2');

    // Zero baseline
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yZero)
      .attr('y2', yZero)
      .attr('stroke', '#ffffff33')
      .attr('stroke-width', 1);

    // Render D3 Bars
    const barWidth = xScale.bandwidth();

    g.selectAll('.pnl-bar')
      .data(outcomes)
      .enter()
      .append('rect')
      .attr('class', 'pnl-bar')
      .attr('x', (_, i) => xScale(i) || 0)
      .attr('width', barWidth)
      .attr('rx', 2)
      .attr('y', d => d.pnlPct >= 0 ? yScale(d.pnlPct) : yZero)
      .attr('height', d => Math.max(2, Math.abs(yScale(d.pnlPct) - yZero)))
      .attr('fill', d => d.pnlPct >= 0 ? '#10b981' : '#f43f5e')
      .attr('fill-opacity', 0.85)
      .attr('stroke', d => d.pnlPct >= 0 ? '#34d399' : '#fb7185')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseenter', (event: MouseEvent, d: OutcomeItem) => {
        d3.select(event.currentTarget as SVGRectElement)
          .attr('fill-opacity', 1)
          .attr('stroke-width', 1.5);

        const index = outcomes.indexOf(d);
        const dateStr = new Date(d.timestamp).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });

        setHoveredTrade({
          index: index + 1,
          pnlPct: d.pnlPct,
          profitable: d.profitable,
          dateStr
        });
      })
      .on('mouseleave', (event: MouseEvent) => {
        d3.select(event.currentTarget as SVGRectElement)
          .attr('fill-opacity', 0.85)
          .attr('stroke-width', 1);
        setHoveredTrade(null);
      });

    // PnL text labels above / below each bar
    g.selectAll('.pnl-label')
      .data(outcomes)
      .enter()
      .append('text')
      .attr('class', 'pnl-label')
      .attr('x', (_, i) => (xScale(i) || 0) + barWidth / 2)
      .attr('y', d => d.pnlPct >= 0 ? yScale(d.pnlPct) - 3 : yScale(d.pnlPct) + 8)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.pnlPct >= 0 ? '#34d399' : '#fb7185')
      .attr('font-size', '8px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'monospace')
      .text(d => `${d.pnlPct > 0 ? '+' : ''}${d.pnlPct.toFixed(1)}%`);

    // Y Axis (+% / -%)
    const yAxis = d3.axisLeft(yScale)
      .ticks(3)
      .tickFormat(d => {
        const val = Number(d);
        return `${val > 0 ? '+' : ''}${val}%`;
      });

    const yAxisG = g.append('g').call(yAxis);
    yAxisG.selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '8px')
      .attr('dx', '-0.2em');

    yAxisG.selectAll('line').attr('stroke', '#334155');
    yAxisG.select('.domain').attr('stroke', 'transparent');

    // X Axis (# Trade)
    const xAxis = d3.axisBottom(xScale)
      .tickFormat((_, i) => `T${i + 1}`);

    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisG.selectAll('text')
      .attr('fill', '#64748b')
      .attr('font-size', '8px');

    xAxisG.selectAll('line').attr('stroke', '#334155');
    xAxisG.select('.domain').attr('stroke', '#334155');

  }, [outcomes, width, height]);

  return (
    <div className="flex flex-col gap-1.5 select-none">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-neutral-400 font-medium">Distribuição de Ganhos/Perdas (PnL %):</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500" /> Lucro
          </span>
          <span className="flex items-center gap-1 text-rose-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-sm bg-rose-500" /> Perda
          </span>
        </div>
      </div>

      <div className="bg-[#040404] p-1.5 rounded-lg border border-white/10 flex justify-center relative overflow-hidden">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="overflow-visible"
        />
      </div>

      {hoveredTrade ? (
        <div className="flex items-center justify-between text-[10px] px-1 bg-white/5 py-0.5 rounded border border-white/10 font-mono">
          <span className="text-neutral-300">Trade #{hoveredTrade.index} ({hoveredTrade.dateStr}):</span>
          <span className={`font-bold ${hoveredTrade.pnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {hoveredTrade.pnlPct > 0 ? '+' : ''}{hoveredTrade.pnlPct.toFixed(2)}%
          </span>
        </div>
      ) : (
        <div className="text-[9px] text-neutral-500 text-right pr-1">
          Passe o mouse nas barras para auditar o trade
        </div>
      )}
    </div>
  );
};
