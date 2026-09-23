import React, { useState, useMemo } from 'react';
import { TickerData } from '../types';
import { 
  Network, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  Zap,
  Activity,
  Globe2
} from 'lucide-react';
import { formatPercent, formatPrice } from '../utils/formatters';
import { Tooltip } from './Tooltip';

interface MarketCorrelationMatrixProps {
  primeTicker: TickerData;
  tickers: TickerData[];
  onSelectTicker: (ticker: TickerData) => void;
}

export interface CorrelationAssetItem {
  ticker: TickerData;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  isCoaligned: boolean;       // Same direction as prime
  correlationScore: number;   // -1.0 to +1.0
  correlationPct: number;     // 0% to 100% agreement
  sectorCategory: string;
  alignmentReason: string;
}

export const MarketCorrelationMatrix: React.FC<MarketCorrelationMatrixProps> = ({
  primeTicker,
  tickers,
  onSelectTicker
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<'all' | 'coaligned' | 'divergent'>('all');

  // Prime ticker movement bias
  const primeBias: 'LONG' | 'SHORT' | 'NEUTRAL' = useMemo(() => {
    if (primeTicker.signalType?.includes('LONG') || (primeTicker.cvdDirection === 'BUY' && primeTicker.priceChangePercent24h >= 0)) {
      return 'LONG';
    }
    if (primeTicker.signalType?.includes('SHORT') || (primeTicker.cvdDirection === 'SELL' && primeTicker.priceChangePercent24h < 0)) {
      return 'SHORT';
    }
    return primeTicker.priceChangePercent24h >= 0 ? 'LONG' : 'SHORT';
  }, [primeTicker]);

  // Sector heuristic mapping based on symbol
  const getSectorCategory = (symbol: string): string => {
    const s = symbol.toUpperCase();
    if (['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'AVAXUSDT'].some(x => s.includes(x.replace('USDT', '')))) {
      return 'Layer 1 / Large Cap';
    }
    if (['NEARUSDT', 'APTUSDT', 'SUIUSDT', 'OPUSDT', 'ARBUSDT', 'MATICUSDT'].some(x => s.includes(x.replace('USDT', '')))) {
      return 'L1/L2 High-Beta';
    }
    if (['LINKUSDT', 'UNIUSDT', 'AAVEUSDT', 'MKRUSDT', 'CRVUSDT'].some(x => s.includes(x.replace('USDT', '')))) {
      return 'DeFi & Oracles';
    }
    if (['DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'BONKUSDT', 'WIFUSDT', 'FLOKIUSDT'].some(x => s.includes(x.replace('USDT', '')))) {
      return 'Memecoins / High Volatility';
    }
    if (['RENDERUSDT', 'FETUSDT', 'AGIXUSDT', 'TAOUSDT', 'RNDRUSDT'].some(x => s.includes(x.replace('USDT', '')))) {
      return 'AI & Compute';
    }
    return 'Altcoins Top 50';
  };

  // Compute correlation against prime ticker for all other tracked assets
  const correlationItems: CorrelationAssetItem[] = useMemo(() => {
    return tickers
      .filter(t => t.symbol !== primeTicker.symbol)
      .map(t => {
        // Evaluate other asset bias
        const assetBias: 'LONG' | 'SHORT' | 'NEUTRAL' = 
          t.signalType?.includes('LONG') || (t.cvdDirection === 'BUY' && t.priceChangePercent24h >= 0)
            ? 'LONG'
            : t.signalType?.includes('SHORT') || (t.cvdDirection === 'SELL' && t.priceChangePercent24h < 0)
              ? 'SHORT'
              : t.priceChangePercent24h >= 0 ? 'LONG' : 'SHORT';

        const isCoaligned = assetBias === primeBias;

        // Multidimensional correlation index:
        // 1. 24h price direction agreement (weight 35%)
        const primePriceSign = Math.sign(primeTicker.priceChangePercent24h || 1);
        const assetPriceSign = Math.sign(t.priceChangePercent24h || 1);
        const priceDirScore = primePriceSign === assetPriceSign ? 1 : -0.7;

        // 2. CVD Flow agreement (weight 25%)
        const cvdScore = primeTicker.cvdDirection === t.cvdDirection ? 1 : (t.cvdDirection === 'NEUTRAL' ? 0.2 : -0.6);

        // 3. Open Interest change alignment (weight 20%)
        const oiSignPrime = Math.sign(primeTicker.openInterestChange24h || 0);
        const oiSignAsset = Math.sign(t.openInterestChange24h || 0);
        const oiScore = oiSignPrime === oiSignAsset ? 0.9 : -0.4;

        // 4. Confluence similarity (weight 20%)
        const confluenceDiff = Math.abs(primeTicker.confluenceScore - t.confluenceScore) / 100;
        const confluenceScore = Math.max(0, 1 - confluenceDiff);

        // Weighted sum (-1 to +1)
        const rawScore = (priceDirScore * 0.35) + (cvdScore * 0.25) + (oiScore * 0.20) + (confluenceScore * 0.20);
        const clampedScore = Math.max(-1, Math.min(1, rawScore));
        const correlationPct = Math.round(((clampedScore + 1) / 2) * 100);

        let alignmentReason = isCoaligned 
          ? `Alinhado em ${assetBias}: CVD ${t.cvdDirection === 'BUY' ? 'Comprador' : 'Vendedor'} & 24h em ${formatPercent(t.priceChangePercent24h)}`
          : `Divergente (${assetBias}): Oposição de fluxo institucional contra ${primeTicker.symbol}`;

        return {
          ticker: t,
          direction: assetBias,
          isCoaligned,
          correlationScore: clampedScore,
          correlationPct,
          sectorCategory: getSectorCategory(t.symbol),
          alignmentReason
        };
      })
      .sort((a, b) => b.correlationScore - a.correlationScore);
  }, [tickers, primeTicker, primeBias]);

  // Sector-wide breadth statistics
  const coalignedCount = correlationItems.filter(c => c.isCoaligned).length;
  const totalCount = correlationItems.length || 1;
  const sectorBreadthPct = Math.round((coalignedCount / totalCount) * 100);
  const isSectorConfirmed = sectorBreadthPct >= 65;

  const filteredItems = useMemo(() => {
    if (filterMode === 'coaligned') return correlationItems.filter(c => c.isCoaligned);
    if (filterMode === 'divergent') return correlationItems.filter(c => !c.isCoaligned);
    return correlationItems;
  }, [correlationItems, filterMode]);

  return (
    <div className="bg-[#0A0A0A] rounded-2xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-300">
      {/* Top Header Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-3 bg-gradient-to-r from-neutral-900/90 via-neutral-900/60 to-black flex flex-wrap items-center justify-between gap-3 border-b border-white/10 cursor-pointer select-none hover:bg-neutral-800/40 transition"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border ${
            isSectorConfirmed 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            <Network className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold font-mono text-white tracking-wide">
                MATRIZ DE CORRELAÇÃO DE MERCADO
              </h3>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                isSectorConfirmed 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {isSectorConfirmed ? 'MOVIMENTO SETORIAL CONFIRMADO' : 'FLUXO ISOLADO / DIVERGENTE'}
              </span>
            </div>

            <p className="text-[11px] text-neutral-400 mt-0.5">
              Confirmando amplitude do movimento de <strong>{primeTicker.symbol} ({primeBias})</strong> no mercado de criptoativos.
            </p>
          </div>
        </div>

        {/* Breadth Score & Toggle Button */}
        <div className="flex items-center gap-4">
          <Tooltip
            position="bottom"
            title="Amplitude Setorial (Market Breadth)"
            badge={`${sectorBreadthPct}% CO-ALINHADOS`}
            content="Indica a porcentagem de pares rastreados que estão se movimentando no mesmo sentido e com fluxo compatível à oportunidade prime. Quanto maior, menor o risco de armadilha (fakeout) isolada."
          >
            <div className="flex items-center gap-2.5 bg-black/60 px-3 py-1.5 rounded-xl border border-white/10">
              <span className="text-[10px] text-neutral-400 font-medium">Amplitude:</span>
              <div className="w-20 bg-neutral-800 h-2 rounded-full overflow-hidden flex">
                <div 
                  className={`h-full transition-all duration-500 ${isSectorConfirmed ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  style={{ width: `${sectorBreadthPct}%` }}
                />
              </div>
              <span className={`text-xs font-mono font-black ${isSectorConfirmed ? 'text-emerald-400' : 'text-amber-400'}`}>
                {sectorBreadthPct}%
              </span>
              <span className="text-[10px] text-neutral-500">
                ({coalignedCount}/{totalCount})
              </span>
            </div>
          </Tooltip>

          <button 
            type="button"
            className="p-1 rounded-lg text-neutral-400 hover:text-white transition"
            aria-label="Toggle matrix"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Body */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {/* Quick Filter Strip & Summary Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-neutral-400 text-[11px] mr-1">Filtrar:</span>
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
                  filterMode === 'all'
                    ? 'bg-neutral-800 text-white border-white/20'
                    : 'bg-black text-neutral-400 border-white/5 hover:text-white'
                }`}
              >
                Todos ({correlationItems.length})
              </button>
              <button
                onClick={() => setFilterMode('coaligned')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border flex items-center gap-1 ${
                  filterMode === 'coaligned'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-black text-neutral-400 border-white/5 hover:text-emerald-400'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Co-alinhados ({coalignedCount})
              </button>
              <button
                onClick={() => setFilterMode('divergent')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border flex items-center gap-1 ${
                  filterMode === 'divergent'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-black text-neutral-400 border-white/5 hover:text-rose-400'
                }`}
              >
                <AlertCircle className="w-3 h-3 text-rose-400" />
                Divergentes ({totalCount - coalignedCount})
              </button>
            </div>

            <div className="text-[11px] text-neutral-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
              <span>Benchmark Ativo: <strong className="text-white font-mono">{primeTicker.symbol}</strong> ({primeBias})</span>
            </div>
          </div>

          {/* Matrix Tiles Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {filteredItems.map(item => {
              const isPositiveCorr = item.correlationScore >= 0.2;
              const isStrongOpposite = item.correlationScore <= -0.2;

              return (
                <div
                  key={item.ticker.symbol}
                  onClick={() => onSelectTicker(item.ticker)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none group flex flex-col justify-between hover:scale-[1.02] ${
                    item.isCoaligned
                      ? 'bg-[#06120d] hover:bg-[#091a13] border-emerald-500/30 hover:border-emerald-500/60'
                      : 'bg-[#140608] hover:bg-[#1a080b] border-rose-500/30 hover:border-rose-500/60'
                  }`}
                >
                  {/* Top Row: Symbol & Sector */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-white group-hover:text-cyan-400 transition flex items-center gap-1">
                      {item.ticker.symbol.replace('USDT', '')}
                      <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                    </span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded font-mono ${
                      item.direction === 'LONG' 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {item.direction}
                    </span>
                  </div>

                  {/* Middle Row: Price & 24h Change */}
                  <div className="my-2">
                    <div className="text-xs font-mono font-bold text-neutral-200">
                      {formatPrice(item.ticker.price, { currency: true })}
                    </div>
                    <div className="flex items-center justify-between text-[10px] mt-0.5">
                      <span className={item.ticker.priceChangePercent24h >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {formatPercent(item.ticker.priceChangePercent24h)}
                      </span>
                      <span className="text-[9px] text-neutral-500 truncate max-w-[70px]">
                        {item.sectorCategory.split(' ')[0]}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Correlation Bar & Score */}
                  <div className="pt-1.5 border-t border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-neutral-400">Correlação:</span>
                      <span className={`font-mono font-extrabold ${
                        item.isCoaligned ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {item.correlationPct}%
                      </span>
                    </div>
                    <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.isCoaligned ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                        style={{ width: `${item.correlationPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Footnote Explaining Institutional Breadth */}
          <div className="flex items-start gap-2 text-[10px] text-neutral-500 bg-black/40 p-2.5 rounded-xl border border-white/5">
            <Info className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Interpretação Institucional:</strong> Quando a maioria dos ativos do setor acompanha a direção do <strong>{primeTicker.symbol}</strong> ({primeBias}), há forte probabilidade de injeção macro de liquidez setorial (Beta Play). Uma divergência acentuada sugere trade idiossincrático, requerendo maior cautela em retrações.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
