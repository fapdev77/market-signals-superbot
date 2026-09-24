import React, { useState, useEffect } from 'react';
import { TickerData, TradeSignal } from '../types';
import { 
  Users, 
  Target, 
  Flame, 
  Activity, 
  ArrowDownRight, 
  ArrowUpRight, 
  Sparkles, 
  BrainCircuit, 
  LineChart, 
  BarChart2, 
  CheckCircle2,
  Radio,
  Coins
} from 'lucide-react';
import { formatCompactNumber, formatPrice } from '../utils/formatters';

interface TrappedTradersRadarProps {
  tickers: TickerData[];
  selectedTicker?: TickerData | null;
  onSelectTicker?: (ticker: TickerData) => void;
  onRequestAIReview?: (ticker: TickerData, signal?: TradeSignal) => void;
  onOpenChart?: (ticker: TickerData) => void;
}

export const TrappedTradersRadar: React.FC<TrappedTradersRadarProps> = ({
  tickers = [],
  selectedTicker,
  onSelectTicker,
  onRequestAIReview,
  onOpenChart
}) => {
  // Filter only crypto futures assets with trappedTraders data or fallback to DEFAULT_SYMBOLS
  const cryptoTickers = tickers.filter(t => t.marketType === 'crypto_futures' || t.symbol.includes('USDT'));
  const activeTicker = selectedTicker && cryptoTickers.some(t => t.symbol === selectedTicker.symbol)
    ? selectedTicker
    : (cryptoTickers[0] || tickers[0]);

  const [activeSymbol, setActiveSymbol] = useState<string>(activeTicker?.symbol || 'BTCUSDT');

  // Sync state if selectedTicker changes externally
  useEffect(() => {
    if (selectedTicker && selectedTicker.symbol) {
      setActiveSymbol(selectedTicker.symbol);
    }
  }, [selectedTicker?.symbol]);

  const currentTicker = cryptoTickers.find(t => t.symbol === activeSymbol) || activeTicker;

  if (!currentTicker) {
    return (
      <div className="bg-neutral-950/80 backdrop-blur-md border border-neutral-800/80 rounded-2xl p-6 text-center text-neutral-400 font-mono text-sm">
        Carregando dados de fluxo e posicionamento institucional...
      </div>
    );
  }

  const trapped = currentTicker.trappedTraders || {
    status: 'BALANCED' as const,
    trappedIndex: 35,
    trappedSide: 'NONE' as const,
    trappedPriceZone: [currentTicker.price * 0.995, currentTicker.price * 1.005] as [number, number],
    trappedPocPrice: currentTicker.price,
    trappedVolumeUSD: 15000000,
    absorptionRatio: 30,
    divergenceType: 'NONE' as const,
    crowdSentiment: 'NEUTRAL' as const,
    smartMoneyBias: 'NEUTRAL' as const,
    confluenceVerdict: 'Fluxo em consolidação equilibrada. Sem divergências extremas de absorção.',
    liquidationsSummary: {
      totalBuyLiqUSD: 120000,
      totalSellLiqUSD: 150000,
      netLiqUSD: -30000,
      recentEvents: []
    },
    updatedAt: Date.now()
  };

  const ls = currentTicker.longShortData || {
    symbol: currentTicker.symbol,
    globalRatio: 1.15,
    longAccountPct: 53.5,
    shortAccountPct: 46.5,
    topTraderAccountRatio: 1.10,
    topTraderPositionRatio: 0.95,
    topTraderLongPositionPct: 48.7,
    topTraderShortPositionPct: 51.3,
    takerRatio: 1.05,
    takerBuyVolUsd: 12000000,
    takerSellVolUsd: 11400000,
    timestamp: Date.now()
  };

  const isTrappedLongs = trapped.status === 'TRAPPED_LONGS';
  const isTrappedShorts = trapped.status === 'TRAPPED_SHORTS';

  const ttiColor = isTrappedLongs
    ? 'text-rose-400 border-rose-500/40 bg-rose-950/30'
    : isTrappedShorts
    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30'
    : 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20';

  const badgeBg = isTrappedLongs
    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
    : isTrappedShorts
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
    : 'bg-neutral-800/60 border-neutral-700 text-neutral-300';

  // Smart Money Divergence check
  const hasSmartMoneyDivergence = 
    (ls.longAccountPct > 58 && ls.topTraderShortPositionPct > 52) ||
    (ls.shortAccountPct > 58 && ls.topTraderLongPositionPct > 52);

  // Suggested Contra-Trade Plan
  const contraDirection = isTrappedLongs ? 'SHORT (FADE)' : isTrappedShorts ? 'LONG (SQUEEZE)' : 'AGUARDAR EXTREMO';
  const contraStopLoss = isTrappedLongs
    ? trapped.trappedPriceZone[1] * 1.002
    : isTrappedShorts
    ? trapped.trappedPriceZone[0] * 0.998
    : currentTicker.price * 0.985;

  const contraTarget1 = currentTicker.rangeProfile?.poc || currentTicker.price;
  const contraTarget2 = isTrappedLongs
    ? (currentTicker.rangeProfile?.val || currentTicker.keyLevels?.support1 || currentTicker.price * 0.98)
    : (currentTicker.rangeProfile?.vah || currentTicker.keyLevels?.resistance1 || currentTicker.price * 1.02);

  const riskDist = Math.abs(currentTicker.price - contraStopLoss) || (currentTicker.price * 0.01);
  const rewardDist = Math.abs(contraTarget2 - currentTicker.price);
  const contraRR = riskDist > 0 ? (rewardDist / riskDist).toFixed(1) : '2.8';

  const priceChange = currentTicker.priceChangePercent24h ?? 0;
  const isPositiveChange = priceChange >= 0;

  return (
    <div className="bg-neutral-950/90 backdrop-blur-xl border border-neutral-800/80 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Subtle background ambient glow */}
      <div 
        className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20 ${
          isTrappedLongs ? 'bg-rose-600' : isTrappedShorts ? 'bg-emerald-600' : 'bg-cyan-600'
        }`} 
      />

      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-neutral-800/80 pb-3.5 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-neutral-900 border border-neutral-700/60 text-cyan-400 shadow-inner">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                Trapped Traders & Squeeze Radar
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                  INSTITUTIONAL
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-neutral-400 font-mono">
              Net Longs/Shorts, Absorção CVD & Detecção de Contra-Trade
            </p>
          </div>
        </div>

        {/* Prominent Active Asset Banner & Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Asset Info Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 shadow-sm shadow-cyan-950/50">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                Ativo Monitorado:
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="font-bold text-white text-xs">{currentTicker.symbol}</span>
              <span className="text-[11px] font-semibold text-neutral-200">
                ${formatPrice(currentTicker.price)}
              </span>
              <span className={`text-[10px] font-bold ${isPositiveChange ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositiveChange ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Quick Asset Selector Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
            {cryptoTickers.slice(0, 7).map((t) => {
              const isSelected = t.symbol === currentTicker.symbol;
              const tStatus = t.trappedTraders?.status;
              return (
                <button
                  key={t.symbol}
                  onClick={() => {
                    setActiveSymbol(t.symbol);
                    if (onSelectTicker) onSelectTicker(t);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1 border ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-md shadow-cyan-950/50 ring-1 ring-cyan-500/40'
                      : 'bg-neutral-900/70 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                  title={`Monitorar ${t.symbol}`}
                >
                  <span>{t.symbol.replace('USDT', '')}</span>
                  {tStatus === 'TRAPPED_LONGS' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" title="Trapped Longs" />
                  )}
                  {tStatus === 'TRAPPED_SHORTS' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Trapped Shorts" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Grid: 3 Institutional Intelligence Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Column 1: Net Longs / Shorts & Smart Money Positioning (4 cols) */}
        <div className="lg:col-span-4 bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-3.5 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              Posicionamento ({currentTicker.symbol.replace('USDT', '')})
            </span>
            <span className="text-[10px] font-mono text-neutral-500">15m Window</span>
          </div>

          {/* Retail Global Accounts Long/Short */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-neutral-400">Varejo (Contas Globais):</span>
              <span className="font-bold text-white">
                <span className="text-emerald-400">{ls.longAccountPct}% L</span>
                {' / '}
                <span className="text-rose-400">{ls.shortAccountPct}% S</span>
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden flex">
              <div 
                className="bg-emerald-500 transition-all duration-500" 
                style={{ width: `${ls.longAccountPct}%` }}
              />
              <div 
                className="bg-rose-500 transition-all duration-500" 
                style={{ width: `${ls.shortAccountPct}%` }}
              />
            </div>
          </div>

          {/* Top Traders Position Ratio (Smart Money) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-neutral-400">Top Traders (Posições Reais):</span>
              <span className="font-bold text-white">
                <span className="text-emerald-400">{ls.topTraderLongPositionPct}% L</span>
                {' / '}
                <span className="text-rose-400">{ls.topTraderShortPositionPct}% S</span>
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden flex">
              <div 
                className="bg-cyan-500 transition-all duration-500" 
                style={{ width: `${ls.topTraderLongPositionPct}%` }}
              />
              <div 
                className="bg-amber-500 transition-all duration-500" 
                style={{ width: `${ls.topTraderShortPositionPct}%` }}
              />
            </div>
          </div>

          {/* Divergence Diagnosis Badge */}
          <div className={`p-2.5 rounded-lg border text-[11px] font-mono leading-relaxed ${
            hasSmartMoneyDivergence
              ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
              : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
          }`}>
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <Activity className="w-3 h-3 text-amber-400" />
              <span>Divergência Smart Money:</span>
            </div>
            {hasSmartMoneyDivergence ? (
              <span>
                {ls.longAccountPct > 58 
                  ? '⚡ Varejo comprando topo enquanto Top Traders montam posições curtas (Short bias).'
                  : '⚡ Varejo vendendo fundo enquanto Top Traders acumulam posições longas.'}
              </span>
            ) : (
              <span>Posicionamento institucional alinhado com o mercado geral.</span>
            )}
          </div>

          {/* Taker Volume Pressure */}
          <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-neutral-800/80 text-neutral-300">
            <span className="text-neutral-500">Taker Buy/Sell Ratio:</span>
            <span className={`font-bold ${ls.takerRatio >= 1.05 ? 'text-emerald-400' : ls.takerRatio <= 0.95 ? 'text-rose-400' : 'text-neutral-300'}`}>
              {ls.takerRatio.toFixed(2)}x ({ls.takerRatio >= 1 ? 'Compra Agressiva' : 'Venda Agressiva'})
            </span>
          </div>
        </div>

        {/* Column 2: Trapped Traders Index & Absorption Meter (4 cols) */}
        <div className="lg:col-span-4 bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Índice TTI ({currentTicker.symbol.replace('USDT', '')})
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${badgeBg}`}>
              {trapped.status === 'TRAPPED_LONGS'
                ? 'TRAPPED LONGS'
                : trapped.status === 'TRAPPED_SHORTS'
                ? 'TRAPPED SHORTS'
                : 'BALANCED'}
            </span>
          </div>

          {/* TTI Gauge Card */}
          <div className={`p-3 rounded-xl border flex items-center justify-between ${ttiColor}`}>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
                Score TTI / Wyckoff
              </span>
              <div className="text-2xl font-black font-mono">
                {trapped.trappedIndex}
                <span className="text-xs font-normal text-neutral-400 ml-1">/100</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
                Absorção Passiva
              </span>
              <div className="text-lg font-bold font-mono text-cyan-400">
                {trapped.absorptionRatio}%
              </div>
            </div>
          </div>

          {/* Trapped Zone Details */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-lg p-2.5 space-y-2 text-[11px] font-mono">
            <div className="flex justify-between items-center">
              <span className="text-neutral-500">Faixa Encurralada:</span>
              <span className="font-bold text-white">
                ${formatPrice(trapped.trappedPriceZone[0])} - ${formatPrice(trapped.trappedPriceZone[1])}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-500">POC da Armadilha:</span>
              <span className="font-bold text-cyan-300">
                ${formatPrice(trapped.trappedPocPrice)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-500">Volume Preso Estimado:</span>
              <span className="font-bold text-amber-300">
                ${formatCompactNumber(trapped.trappedVolumeUSD)} USDT
              </span>
            </div>
          </div>

          {/* Liquidation Exhaustion Tracker */}
          <div className="flex items-center justify-between text-[11px] font-mono pt-1 text-neutral-400 border-t border-neutral-800/80">
            <span>Liq. 30m Recente:</span>
            <div className="flex items-center gap-2">
              <span className="text-rose-400">L: ${formatCompactNumber(trapped.liquidationsSummary.totalSellLiqUSD)}</span>
              <span className="text-neutral-600">•</span>
              <span className="text-emerald-400">S: ${formatCompactNumber(trapped.liquidationsSummary.totalBuyLiqUSD)}</span>
            </div>
          </div>
        </div>

        {/* Column 3: Institutional Contra-Trade Execution (4 cols) */}
        <div className="lg:col-span-4 bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-3.5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <BrainCircuit className="w-3.5 h-3.5 text-emerald-400" />
                Setup Contra-Trade ({currentTicker.symbol.replace('USDT', '')})
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                R:R {contraRR}
              </span>
            </div>

            {/* Signal & Direction Badge */}
            <div className={`p-2.5 rounded-lg border font-mono text-xs flex items-center justify-between ${
              isTrappedLongs
                ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                : isTrappedShorts
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400'
            }`}>
              <div className="flex items-center gap-1.5">
                {isTrappedLongs ? (
                  <ArrowDownRight className="w-4 h-4 text-rose-400" />
                ) : isTrappedShorts ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-neutral-500" />
                )}
                <span className="font-bold">{contraDirection}</span>
              </div>
              <span className="text-[10px] opacity-80">
                {isTrappedLongs ? 'FADE DE TOPO' : isTrappedShorts ? 'SQUEEZE DE FUNDO' : 'AGUARDANDO'}
              </span>
            </div>

            {/* Execution Levels */}
            <div className="mt-2.5 space-y-1 text-[11px] font-mono">
              <div className="flex justify-between py-0.5 border-b border-neutral-800/60">
                <span className="text-neutral-500">Preço Atual:</span>
                <span className="font-bold text-white">${formatPrice(currentTicker.price)}</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-neutral-800/60">
                <span className="text-neutral-500">Stop Técnico (além da Trap):</span>
                <span className="font-bold text-rose-400">${formatPrice(contraStopLoss)}</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-neutral-800/60">
                <span className="text-neutral-500">Alvo 1 (POC de Retorno):</span>
                <span className="font-bold text-emerald-400">${formatPrice(contraTarget1)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-neutral-500">Alvo 2 (Liquidez Oposta):</span>
                <span className="font-bold text-emerald-400">${formatPrice(contraTarget2)}</span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/80">
            {onRequestAIReview && (
              <button
                onClick={() => onRequestAIReview(currentTicker)}
                className="flex-1 py-1.5 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono font-semibold transition flex items-center justify-center gap-1.5 border border-neutral-700"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Auditar por IA</span>
              </button>
            )}
            {onOpenChart && (
              <button
                onClick={() => onOpenChart(currentTicker)}
                className="flex-1 py-1.5 px-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-cyan-950/40"
              >
                <LineChart className="w-3.5 h-3.5" />
                <span>Ver no Gráfico</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Footer Diagnostic Message */}
      <div className="mt-3.5 pt-2.5 border-t border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold flex items-center gap-1">
            <BarChart2 className="w-3.5 h-3.5" />
            Veredito Institucional:
          </span>
          <span className="text-neutral-300">{trapped.confluenceVerdict}</span>
        </div>
        <span className="text-[10px] text-neutral-500 sm:self-center shrink-0">
          Atualizado em tempo real via Binance Futures WebSocket
        </span>
      </div>
    </div>
  );
};
