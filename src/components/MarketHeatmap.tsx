import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { TickerData } from '../types';
import { formatPrice, formatPercent } from '../utils/formatters';
import { 
  Flame, 
  Activity, 
  Layers, 
  Maximize2, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  SlidersHorizontal,
  Sliders,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Tooltip } from './Tooltip';

interface MarketHeatmapProps {
  tickers: TickerData[];
  onSelectTicker: (ticker: TickerData) => void;
}

interface TreemapNode extends d3.HierarchyRectangularNode<any> {
  data: {
    name: string;
    symbol?: string;
    ticker?: TickerData;
    volume24h?: number;
    quoteVolume24h?: number;
    deviation?: number;
    price?: number;
    changePct?: number;
    children?: any[];
  };
}

export const MarketHeatmap: React.FC<MarketHeatmapProps> = ({
  tickers,
  onSelectTicker
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 500 });
  const [hoveredNode, setHoveredNode] = useState<TickerData | null>(null);
  const [hoveredPos, setHoveredPos] = useState<{ x: number; y: number } | null>(null);
  const [volumeMetric, setVolumeMetric] = useState<'quoteVolume' | 'baseVolume'>('quoteVolume');
  const [colorScheme, setColorScheme] = useState<'maDeviation' | 'priceChange'>('maDeviation');
  const [filterMarket, setFilterMarket] = useState<'ALL' | 'CRYPTO' | 'TRADFI'>('ALL');

  // Filtered tickers
  const activeTickers = useMemo(() => {
    return tickers.filter(t => {
      if (filterMarket === 'CRYPTO') return t.marketType.startsWith('crypto');
      if (filterMarket === 'TRADFI') return t.marketType === 'tradfi';
      return true;
    });
  }, [tickers, filterMarket]);

  // Handle ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 50 && height > 50) {
          setDimensions({
            width: Math.floor(width),
            height: Math.max(450, Math.floor(height))
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute Deviation fallback if server didn't supply
  const getDeviation = (t: TickerData): number => {
    if (typeof t.ma24hDeviationPct === 'number' && !isNaN(t.ma24hDeviationPct)) {
      return t.ma24hDeviationPct;
    }
    // Fallback: compare price to 24h midpoint
    if (t.high24h && t.low24h && t.high24h > t.low24h) {
      const mid = (t.high24h + t.low24h) / 2;
      return Number((((t.price - mid) / mid) * 100).toFixed(2));
    }
    return t.priceChangePercent24h || 0;
  };

  // Color interpolator for 24h Moving Average Price Deviation
  // Negative deviation: Rose/Ruby Red (#f43f5e to #9f1239)
  // Around 0% deviation: Deep Slate/Charcoal (#1e293b)
  // Positive deviation: Emerald/Green (#10b981 to #047857)
  const colorScale = useMemo(() => {
    return d3.scaleLinear<string>()
      .domain([-8, -4, -1, 0, 1, 4, 8])
      .range([
        '#be123c', // strong red (-8% or worse below 24h MA)
        '#e11d48', // red (-4%)
        '#9f1239', // soft ruby (-1%)
        '#1e222d', // neutral near MA (~0%)
        '#065f46', // soft emerald (+1%)
        '#059669', // green (+4%)
        '#10b981'  // bright emerald (+8% or higher above 24h MA)
      ])
      .clamp(true);
  }, []);

  // Build Treemap Hierarchy and Render via D3
  useEffect(() => {
    if (!svgRef.current || activeTickers.length === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Prepare hierarchical data grouped by base asset category or market type
    const hierarchyData = {
      name: 'root',
      children: activeTickers.map(t => {
        const vol = volumeMetric === 'quoteVolume' 
          ? Math.max(1000, t.quoteVolume24h || (t.volume24h * t.price) || 100000)
          : Math.max(1, t.volume24h || 100);

        const dev = colorScheme === 'maDeviation' 
          ? getDeviation(t) 
          : (t.priceChangePercent24h || 0);

        return {
          name: t.symbol,
          symbol: t.symbol,
          ticker: t,
          volume24h: t.volume24h,
          quoteVolume24h: vol,
          deviation: dev,
          price: t.price,
          changePct: t.priceChangePercent24h
        };
      })
    };

    const root = d3.hierarchy(hierarchyData)
      .sum(d => (d as any).quoteVolume24h || 0)
      .sort((a, b) => ((b.value || 0) - (a.value || 0)));

    const treemapLayout = d3.treemap<any>()
      .size([width, height])
      .paddingInner(3)
      .paddingOuter(3)
      .round(true);

    treemapLayout(root);

    const leaves = root.leaves() as TreemapNode[];

    // Render cells
    const cell = svg.selectAll('g')
      .data(leaves)
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)
      .attr('class', 'group cursor-pointer')
      .on('click', (event, d) => {
        if (d.data.ticker) {
          onSelectTicker(d.data.ticker);
        }
      })
      .on('mousemove', (event, d) => {
        if (d.data.ticker && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setHoveredPos({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          });
          setHoveredNode(d.data.ticker);
        }
      })
      .on('mouseleave', () => {
        setHoveredNode(null);
        setHoveredPos(null);
      });

    // Rectangles with rounded corners and gradient/border
    cell.append('rect')
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', d => colorScale(d.data.deviation || 0))
      .attr('stroke', 'rgba(255, 255, 255, 0.12)')
      .attr('stroke-width', 1)
      .attr('class', 'transition-all duration-200 hover:brightness-125 hover:stroke-orange-400/80');

    // Content container / ForeignObject for rich responsive HTML styling inside each box
    cell.each(function(d) {
      const boxWidth = d.x1 - d.x0;
      const boxHeight = d.y1 - d.y0;

      // Only render text content if box is large enough
      if (boxWidth < 40 || boxHeight < 25) return;

      const g = d3.select(this);
      const dev = d.data.deviation ?? 0;
      const isLarge = boxWidth >= 90 && boxHeight >= 65;
      const isMedium = boxWidth >= 65 && boxHeight >= 45;

      const fo = g.append('foreignObject')
        .attr('width', boxWidth)
        .attr('height', boxHeight)
        .style('pointer-events', 'none');

      const div = fo.append('xhtml:div')
        .attr('class', 'w-full h-full flex flex-col justify-center items-center p-1 text-center select-none overflow-hidden');

      // Ticker Symbol Header
      div.append('xhtml:span')
        .attr('class', `font-black text-white font-mono leading-none drop-shadow-md ${
          isLarge ? 'text-sm' : isMedium ? 'text-xs' : 'text-[10px]'
        }`)
        .text((d.data.symbol || '').replace('USDT', ''));

      // Deviation / Price change percentage
      const devFormatted = `${dev >= 0 ? '+' : ''}${dev.toFixed(2)}%`;
      div.append('xhtml:span')
        .attr('class', `font-bold font-mono drop-shadow-sm mt-0.5 leading-none ${
          dev >= 0 ? 'text-emerald-100' : 'text-rose-100'
        } ${isLarge ? 'text-xs' : isMedium ? 'text-[10px]' : 'text-[9px]'}`)
        .text(devFormatted);

      // Price and Volume on larger blocks
      if (isLarge && d.data.price) {
        div.append('xhtml:span')
          .attr('class', 'text-[10px] text-neutral-300 font-mono opacity-80 mt-1 leading-none')
          .text(formatPrice(d.data.price, { currency: true }));

        const volMillions = ((d.data.quoteVolume24h || 0) / 1_000_000).toFixed(1);
        div.append('xhtml:span')
          .attr('class', 'text-[8.5px] text-neutral-400 font-mono opacity-70 mt-0.5 leading-none')
          .text(`Vol: $${volMillions}M`);
      }
    });

  }, [activeTickers, dimensions, volumeMetric, colorScale, colorScheme, onSelectTicker]);

  // Summary Metrics
  const totalVolumeUSD = useMemo(() => {
    return activeTickers.reduce((acc, t) => acc + (t.quoteVolume24h || (t.volume24h * t.price) || 0), 0);
  }, [activeTickers]);

  const avgDeviation = useMemo(() => {
    if (activeTickers.length === 0) return 0;
    const sum = activeTickers.reduce((acc, t) => acc + getDeviation(t), 0);
    return sum / activeTickers.length;
  }, [activeTickers]);

  return (
    <div className="bg-[#0A0A0A] rounded-2xl border border-white/10 p-4 space-y-4 shadow-2xl relative">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">
                Mapa de Calor Global do Mercado (Market Heatmap)
              </h2>
              <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/30 font-mono font-bold">
                D3 Treemap
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-sans mt-0.5">
              Blocos proporcionais ao volume 24h negociado e colorizados pelo desvio percentual em relação à Média Móvel de 24h (MA24h).
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* Color Mode Toggle */}
          <div className="flex items-center bg-[#050505] p-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => setColorScheme('maDeviation')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 ${
                colorScheme === 'maDeviation' 
                  ? 'bg-orange-500 text-black shadow-sm' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>Desvio MA 24h</span>
            </button>
            <button
              onClick={() => setColorScheme('priceChange')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 ${
                colorScheme === 'priceChange' 
                  ? 'bg-orange-500 text-black shadow-sm' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>Variação 24h %</span>
            </button>
          </div>

          {/* Market Filter */}
          <div className="flex items-center bg-[#050505] p-0.5 rounded-lg border border-white/10">
            {(['ALL', 'CRYPTO', 'TRADFI'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterMarket(f)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                  filterMarket === f 
                    ? 'bg-neutral-800 text-white' 
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {f === 'ALL' ? 'Todos' : f === 'CRYPTO' ? 'Cripto' : 'TradFi'}
              </button>
            ))}
          </div>

          {/* Quick Aggregate Stats */}
          <div className="hidden lg:flex items-center gap-2 bg-[#050505] px-3 py-1 rounded-lg border border-white/5 text-[11px]">
            <span className="text-neutral-400">
              Volume Total: <strong className="text-white">${(totalVolumeUSD / 1_000_000_000).toFixed(2)}B</strong>
            </span>
            <span className="text-neutral-600">|</span>
            <span className="text-neutral-400">
              Desvio Médio: <strong className={avgDeviation >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {avgDeviation >= 0 ? '+' : ''}{avgDeviation.toFixed(2)}%
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Legend & Color Scale Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1 text-[10px] font-mono text-neutral-400">
        <div className="flex items-center gap-2">
          <span>Escala de Desvio MA 24h:</span>
          <div className="flex items-center h-3 w-44 rounded overflow-hidden border border-white/10">
            <div className="h-full flex-1 bg-[#be123c]" title="<-8%" />
            <div className="h-full flex-1 bg-[#e11d48]" title="-4%" />
            <div className="h-full flex-1 bg-[#9f1239]" title="-1%" />
            <div className="h-full flex-1 bg-[#1e222d]" title="0% (Na Média)" />
            <div className="h-full flex-1 bg-[#065f46]" title="+1%" />
            <div className="h-full flex-1 bg-[#059669]" title="+4%" />
            <div className="h-full flex-1 bg-[#10b981]" title=">+8%" />
          </div>
          <span className="text-[9px] text-neutral-500">-8% (Abaixo) ➔ 0% ➔ +8% (Acima)</span>
        </div>

        <div className="text-[10px] text-neutral-400 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Tamanho do retângulo = Volume Financeiro 24h negociado</span>
        </div>
      </div>

      {/* Treemap SVG Canvas */}
      <div 
        ref={containerRef} 
        className="w-full h-[520px] bg-[#050505] rounded-xl border border-white/5 overflow-hidden relative"
      >
        <svg 
          ref={svgRef} 
          width={dimensions.width} 
          height={dimensions.height}
          className="w-full h-full"
        />

        {/* Dynamic Floating Tooltip */}
        {hoveredNode && hoveredPos && (
          <div 
            className="absolute z-50 pointer-events-none bg-[#0a0a0c]/95 backdrop-blur-md border border-white/20 p-3 rounded-xl shadow-2xl font-mono text-xs w-64 space-y-1.5 transition-all"
            style={{
              left: Math.min(dimensions.width - 270, Math.max(10, hoveredPos.x + 15)),
              top: Math.min(dimensions.height - 180, Math.max(10, hoveredPos.y + 15))
            }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-white text-sm">{hoveredNode.symbol}</span>
                <span className="text-[9px] text-neutral-400 uppercase">{hoveredNode.name}</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                (hoveredNode.priceChangePercent24h ?? 0) >= 0 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              }`}>
                {formatPercent(hoveredNode.priceChangePercent24h)}
              </span>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-neutral-400">Preço Atual:</span>
                <span className="text-white font-bold">{formatPrice(hoveredNode.price, { currency: true })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Média Móvel 24h:</span>
                <span className="text-neutral-200">
                  {formatPrice(hoveredNode.ma24h || hoveredNode.price, { currency: true })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Desvio MA 24h:</span>
                <span className={`font-black ${
                  getDeviation(hoveredNode) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {getDeviation(hoveredNode) >= 0 ? '+' : ''}{getDeviation(hoveredNode).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Volume 24h (USD):</span>
                <span className="text-orange-400 font-bold">
                  ${((hoveredNode.quoteVolume24h || 0) / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Fluxo CVD:</span>
                <span className={hoveredNode.cvdDirection === 'BUY' ? 'text-emerald-400' : hoveredNode.cvdDirection === 'SELL' ? 'text-rose-400' : 'text-neutral-400'}>
                  {hoveredNode.cvdDirection}
                </span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-white/10 text-[9px] text-orange-400 flex items-center justify-between">
              <span>Clique para abrir análise técnica</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
