import React, { useState, useMemo } from 'react';
import { Layers, Activity, Target, Sliders, Info } from 'lucide-react';
import { TickerData } from '../types';
import { formatPrice, formatCompactNumber } from '../utils/formatters';
import { ChartDataItem } from './OrderflowIndicators';
import { Tooltip } from './Tooltip';

export interface VolumeProfileCardProps {
  ticker: TickerData;
  timeframe: string;
  slicedData?: ChartDataItem[];
  botWeights?: {
    volumeProfileRange?: number;
    volumeProfileTimeframe?: string;
    volumeProfileCandles?: number;
  };
}

export const VolumeProfileCard: React.FC<VolumeProfileCardProps> = ({
  ticker,
  timeframe,
  slicedData = [],
  botWeights
}) => {
  const [profileMode, setProfileMode] = useState<'chart' | 'bot'>('chart');
  const baseAsset = ticker.baseAsset || (ticker.symbol ? ticker.symbol.replace(/USDT|BUSD|USDC/g, '') : 'ATIVO');
  const currentPrice = ticker.price ?? 0;

  // Dynamic Volume Profile calculation based on visible candles
  const chartProfile = useMemo(() => {
    if (!slicedData || slicedData.length === 0) return null;
    const minP = Math.min(...slicedData.map(d => d.low));
    const maxP = Math.max(...slicedData.map(d => d.high));
    const priceDelta = maxP - minP;
    if (priceDelta <= 0) return null;

    const rowCount = botWeights?.volumeProfileRange || 50;
    const step = priceDelta / rowCount;
    const bins = new Array(rowCount).fill(0);
    let totalVol = 0;

    slicedData.forEach(d => {
      const vol = (d.takerBuy ?? 0) + (d.takerSell ?? 0);
      totalVol += vol;
      const binIdx = Math.min(rowCount - 1, Math.max(0, Math.floor(((d.close - minP) / priceDelta) * rowCount)));
      bins[binIdx] += vol;
    });

    let maxBinIdx = 0;
    let maxBinVol = 0;
    bins.forEach((v, idx) => {
      if (v > maxBinVol) {
        maxBinVol = v;
        maxBinIdx = idx;
      }
    });

    const poc = minP + (maxBinIdx + 0.5) * step;

    // Value area (70% of total volume around POC)
    const targetVA = totalVol * 0.70;
    let accumulatedVA = maxBinVol;
    let upIdx = maxBinIdx;
    let downIdx = maxBinIdx;

    while (accumulatedVA < targetVA && (upIdx < rowCount - 1 || downIdx > 0)) {
      const nextUpVol = upIdx < rowCount - 1 ? bins[upIdx + 1] : -1;
      const nextDownVol = downIdx > 0 ? bins[downIdx - 1] : -1;

      if (nextUpVol >= nextDownVol && nextUpVol !== -1) {
        upIdx++;
        accumulatedVA += bins[upIdx];
      } else if (nextDownVol !== -1) {
        downIdx--;
        accumulatedVA += bins[downIdx];
      } else if (nextUpVol !== -1) {
        upIdx++;
        accumulatedVA += bins[upIdx];
      } else {
        break;
      }
    }

    const vah = minP + (upIdx + 1) * step;
    const val = minP + downIdx * step;

    return {
      vah,
      val,
      poc,
      minPrice: minP,
      maxPrice: maxP,
      totalVolume: totalVol,
      candlesCount: slicedData.length,
      timeframe,
      rowCount
    };
  }, [slicedData, timeframe, botWeights?.volumeProfileRange]);

  const botRange = ticker.rangeProfile || { vah: 0, val: 0, poc: 0 };
  const botTf = botWeights?.volumeProfileTimeframe || '30m';
  const botCandles = botWeights?.volumeProfileCandles || 48;
  const botRows = botWeights?.volumeProfileRange || 50;

  const activeProfile = (profileMode === 'chart' && chartProfile) ? {
    vah: chartProfile.vah,
    val: chartProfile.val,
    poc: chartProfile.poc,
    isDynamic: true,
    tf: chartProfile.timeframe,
    candles: chartProfile.candlesCount,
    rows: chartProfile.rowCount,
    minPrice: chartProfile.minPrice,
    maxPrice: chartProfile.maxPrice,
    totalVol: chartProfile.totalVolume
  } : {
    vah: botRange.vah,
    val: botRange.val,
    poc: botRange.poc,
    isDynamic: false,
    tf: botTf,
    candles: botCandles,
    rows: botRows,
    minPrice: undefined,
    maxPrice: undefined,
    totalVol: undefined
  };

  const inValueArea = currentPrice >= activeProfile.val && currentPrice <= activeProfile.vah;
  const aboveVAH = currentPrice > activeProfile.vah;

  const getDistancePct = (targetPrice: number) => {
    if (!currentPrice || !targetPrice) return null;
    return ((currentPrice - targetPrice) / targetPrice) * 100;
  };

  return (
    <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-3 font-mono flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">Volume Profile do Range</h3>
          </div>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border ${
            inValueArea 
              ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
              : aboveVAH
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
          }`}>
            {inValueArea ? 'Na Value Area' : aboveVAH ? 'Acima do VAH' : 'Abaixo do VAL'}
          </span>
        </div>

        {/* Toggle de Modo: Gráfico Visível vs Motor do Bot */}
        <div className="grid grid-cols-2 gap-1 bg-[#050505] p-1 rounded border border-white/10 text-[10px] mt-2.5">
          <button
            type="button"
            onClick={() => setProfileMode('chart')}
            className={`py-1 px-2 rounded font-bold transition flex items-center justify-center gap-1 truncate ${
              profileMode === 'chart'
                ? 'bg-cyan-500 text-black shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Gráfico ({slicedData.length}v • {timeframe})
          </button>
          <button
            type="button"
            onClick={() => setProfileMode('bot')}
            className={`py-1 px-2 rounded font-bold transition flex items-center justify-center gap-1 truncate ${
              profileMode === 'bot'
                ? 'bg-cyan-500 text-black shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Bot ({botCandles}v • {botTf})
          </button>
        </div>

        {/* Caixa de Detalhes do Range Selecionado */}
        <div className="bg-[#050505] p-2.5 rounded border border-white/5 space-y-1 text-[10px] text-neutral-400 mt-2.5">
          <div className="flex justify-between items-center text-neutral-300">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3 text-cyan-400" />
              Escopo do Range:
            </span>
            <span className="font-bold text-white">
              {activeProfile.candles} velas de {activeProfile.tf} 
              {activeProfile.tf === '30m' && ` (~${(activeProfile.candles * 0.5).toFixed(0)}h)`}
              {activeProfile.tf === '15m' && ` (~${(activeProfile.candles * 0.25).toFixed(1)}h)`}
              {activeProfile.tf === '1h' && ` (~${activeProfile.candles}h)`}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span>Resolução (Linhas):</span>
            <span className="text-cyan-400 font-bold">{activeProfile.rows} níveis</span>
          </div>

          {activeProfile.minPrice !== undefined && activeProfile.maxPrice !== undefined && (
            <div className="flex justify-between items-center border-t border-white/5 pt-1">
              <span>Faixa de Preço:</span>
              <span className="text-neutral-200">
                {formatPrice(activeProfile.minPrice, { currency: true })} – {formatPrice(activeProfile.maxPrice, { currency: true })}
              </span>
            </div>
          )}

          {activeProfile.totalVol !== undefined && (
            <div className="flex justify-between items-center">
              <span>Volume no Período:</span>
              <span className="text-neutral-200">
                {formatCompactNumber(activeProfile.totalVol)} {baseAsset}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* VAH, POC, VAL Cards */}
      <div className="space-y-1.5 text-xs font-mono mt-2.5">
        {/* VAH */}
        <Tooltip
          position="top"
          title="Value Area High (VAH)"
          badge="70% TETO"
          content="Limite superior da Área de Valor (70% do volume negociado no período). Preços acima do VAH indicam expansão de alta ou busca por liquidez compradora."
        >
          <div className="flex justify-between items-center p-2 rounded bg-[#050505] border border-white/5 cursor-help">
            <div>
              <span className="text-neutral-400 block text-[10px]">VAH (Value Area High)</span>
              <span className="font-extrabold text-neutral-200">{formatPrice(activeProfile.vah, { currency: true })}</span>
            </div>
            {(() => {
              const dist = getDistancePct(activeProfile.vah);
              if (dist === null) return null;
              return (
                <span className={`text-[10px] font-bold ${dist >= 0 ? 'text-emerald-400' : 'text-neutral-400'}`}>
                  {dist >= 0 ? `+${dist.toFixed(2)}%` : `${dist.toFixed(2)}%`}
                </span>
              );
            })()}
          </div>
        </Tooltip>

        {/* POC */}
        <Tooltip
          position="top"
          title="Point of Control (POC)"
          badge="PONTO DE CONTROLE"
          content="Nível de preço com o maior volume negociado em todo o período. Atua como um ímã institucional para retração e referência de equilíbrio de mercado."
        >
          <div className="flex justify-between items-center p-2 rounded bg-cyan-500/10 border border-cyan-500/30 cursor-help">
            <div>
              <span className="text-cyan-400 font-bold block text-[10px]">POC (Point of Control)</span>
              <span className="font-extrabold text-cyan-300">{formatPrice(activeProfile.poc, { currency: true })}</span>
            </div>
            {(() => {
              const dist = getDistancePct(activeProfile.poc);
              if (dist === null) return null;
              return (
                <span className={`text-[10px] font-extrabold ${dist >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {dist >= 0 ? `+${dist.toFixed(2)}%` : `${dist.toFixed(2)}%`}
                </span>
              );
            })()}
          </div>
        </Tooltip>

        {/* VAL */}
        <Tooltip
          position="top"
          title="Value Area Low (VAL)"
          badge="70% PISO"
          content="Limite inferior da Área de Valor (piso dos 70% de volume). Preços abaixo do VAL indicam desconto ou rompimento de baixa sem suporte prévio."
        >
          <div className="flex justify-between items-center p-2 rounded bg-[#050505] border border-white/5 cursor-help">
            <div>
              <span className="text-neutral-400 block text-[10px]">VAL (Value Area Low)</span>
              <span className="font-extrabold text-neutral-200">{formatPrice(activeProfile.val, { currency: true })}</span>
            </div>
            {(() => {
              const dist = getDistancePct(activeProfile.val);
              if (dist === null) return null;
              return (
                <span className={`text-[10px] font-bold ${dist >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {dist >= 0 ? `+${dist.toFixed(2)}%` : `${dist.toFixed(2)}%`}
                </span>
              );
            })()}
          </div>
        </Tooltip>
      </div>
    </div>
  );
};

export interface OrderFlowFundingCardProps {
  ticker: TickerData;
}

export const OrderFlowFundingCard: React.FC<OrderFlowFundingCardProps> = ({ ticker }) => {
  return (
    <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-2.5 font-mono flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white uppercase">Métricas de Order Flow & Funding</h3>
        </div>
        
        <div className="space-y-2 text-xs mt-2.5">
          <div>
            <div className="flex justify-between text-neutral-400 mb-1">
              <span>CVD (Delta Acumulado):</span>
              <span className={`font-bold ${ticker.cvdDirection === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${((ticker.cvd ?? 0) / 1000000).toFixed(2)}M ({ticker.cvdDirection})
              </span>
            </div>
            <div className="w-full bg-[#050505] h-1.5 rounded-full overflow-hidden border border-white/5">
              <div
                className={`h-full ${ticker.cvdDirection === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(100, (ticker.takerBuyRatio ?? 0.5) * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between p-2 bg-[#050505] rounded border border-white/5 items-center">
            <span className="text-neutral-400">CVD Delta (Vela Recente):</span>
            <span className={`font-bold ${(ticker.cvdDeltaPercent ?? 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${formatCompactNumber(Math.abs(ticker.cvdDelta ?? 0))} ({(ticker.cvdDeltaPercent ?? 0) > 0 ? '+' : ''}{ticker.cvdDeltaPercent ?? 0}%)
            </span>
          </div>

          <div className="flex justify-between p-2 bg-[#050505] rounded border border-white/5">
            <span className="text-neutral-400">Var Open Interest (1h):</span>
            <span className={`font-bold ${(ticker.openInterestChange1h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {(ticker.openInterestChange1h ?? 0) >= 0 ? '+' : ''}{(ticker.openInterestChange1h ?? 0).toFixed(2)}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <div className="p-2 bg-[#050505] rounded border border-white/5">
              <span className="text-[10px] text-neutral-400 block">Funding Fee Atual</span>
              <span className="font-extrabold text-white text-xs">
                {((ticker.fundingRate ?? 0) * 100).toFixed(4)}%
              </span>
            </div>
            <div className="p-2 bg-[#050505] rounded border border-white/5">
              <span className="text-[10px] text-neutral-400 block">Funding Diário</span>
              <span className={`font-extrabold text-xs ${(ticker.fundingRate ?? 0) < 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                {((ticker.fundingRateDaily ?? (ticker.fundingRate ?? 0) * 3) * 100).toFixed(3)}%/d
              </span>
            </div>
          </div>

          <div className="flex justify-between p-2 bg-[#050505] rounded border border-white/5">
            <span className="text-neutral-400">Funding Rate Anualizado:</span>
            <span className="font-bold text-orange-400">
              {(ticker.fundingRateAnnualized ?? 0).toFixed(1)}% APR
            </span>
          </div>
        </div>
      </div>

      {/* Análise do Comportamento do Funding Rate */}
      <div className={`p-2.5 rounded border text-[11px] space-y-1 mt-2.5 ${
        ticker.fundingRateAnalysis?.status === 'EXTREME_NEGATIVE' || ticker.fundingRateAnalysis?.status === 'NEGATIVE'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : ticker.fundingRateAnalysis?.status === 'EXTREME_POSITIVE' || ticker.fundingRateAnalysis?.status === 'POSITIVE'
          ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          : 'bg-neutral-900 border-white/10 text-neutral-300'
      }`}>
        <div className="flex items-center justify-between font-extrabold">
          <span>ANALISADOR DE FUNDING</span>
          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-black/40 border border-white/10">
            {ticker.fundingRateAnalysis?.bias ?? 'NEUTRAL'}
          </span>
        </div>
        <div className="font-black text-[10px] uppercase">
          {ticker.fundingRateAnalysis?.pressure ?? 'NEUTRO / EQUILIBRADO'}
        </div>
        <div className="text-[10px] opacity-90 leading-relaxed">
          {ticker.fundingRateAnalysis?.description ?? 'Taxa de funding em equilíbrio normal.'}
        </div>
      </div>
    </div>
  );
};

export interface DivergenceStructureCardProps {
  ticker: TickerData;
  timeframe: string;
  isBullishStructure: boolean;
  structureLabel: string;
  bosStatus: string;
}

export const DivergenceStructureCard: React.FC<DivergenceStructureCardProps> = ({
  ticker,
  timeframe,
  isBullishStructure,
  structureLabel,
  bosStatus
}) => {
  return (
    <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-2.5 font-mono flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-rose-400" />
            <h3 className="text-xs font-bold text-white uppercase">Divergências & Estrutura</h3>
          </div>
        </div>
        
        <div className="space-y-2.5 text-xs mt-2.5">
          {/* Divergence */}
          <div className="p-2.5 bg-[#050505] rounded border border-white/5 space-y-2 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-8 h-8 rounded-bl-full opacity-20 ${ticker.cvdDirection === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <div className="flex justify-between items-center mb-1">
              <span className="text-neutral-400 font-bold uppercase text-[10px]">Divergência Detectada</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${ticker.cvdDirection === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                {ticker.cvdDirection === 'BUY' ? 'Bullish (Forte)' : 'Bearish (Média)'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-neutral-500 block">Formação (CVD vs Preço)</span>
                <span className="font-bold text-neutral-200">{ticker.cvdDirection === 'BUY' ? 'Absorção de Venda' : 'Agressão de Venda'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Relevância / Impacto</span>
                <span className="font-bold text-orange-400">{ticker.cvdDirection === 'BUY' ? 'Alta (Reversão)' : 'Irrelevante'}</span>
              </div>
            </div>
          </div>

          {/* Market Structure HH/HL LL/LH */}
          <div className="p-2.5 bg-[#050505] rounded border border-white/5 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-8 h-8 rounded-bl-full opacity-20 ${isBullishStructure ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-neutral-400 font-bold uppercase text-[10px] mb-2 block">Estrutura de Mercado ({timeframe})</span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isBullishStructure ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className={`font-bold ${isBullishStructure ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {structureLabel}
                </span>
              </div>
              <span className="text-[10px] text-neutral-500 border border-white/10 px-1.5 py-0.5 rounded font-bold">
                BOS {bosStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-2.5 bg-[#050505] rounded border border-white/5 text-[10px] text-neutral-400 space-y-1 mt-2.5">
        <span className="font-bold text-neutral-300 block">Confluência Estrutural:</span>
        <p className="leading-relaxed">
          {isBullishStructure 
            ? 'Topos e fundos ascendentes com quebra de estrutura altista. Favorece busca por retrações na Golden Pocket para posições compradas.'
            : 'Topos e fundos descendentes com pressão vendedora contínua. Favorece operações de repique na retração para continuação de baixa.'}
        </p>
      </div>
    </div>
  );
};

export interface MarketProfileMetricsProps {
  ticker: TickerData;
  timeframe: string;
  isBullishStructure: boolean;
  structureLabel: string;
  bosStatus: string;
  slicedData?: ChartDataItem[];
  botWeights?: {
    volumeProfileRange?: number;
    volumeProfileTimeframe?: string;
    volumeProfileCandles?: number;
  };
}

export const MarketProfileMetrics: React.FC<MarketProfileMetricsProps> = ({
  ticker,
  timeframe,
  isBullishStructure,
  structureLabel,
  bosStatus,
  slicedData = [],
  botWeights
}) => {
  return (
    <div className="space-y-4">
      <VolumeProfileCard
        ticker={ticker}
        timeframe={timeframe}
        slicedData={slicedData}
        botWeights={botWeights}
      />
      <OrderFlowFundingCard ticker={ticker} />
      <DivergenceStructureCard
        ticker={ticker}
        timeframe={timeframe}
        isBullishStructure={isBullishStructure}
        structureLabel={structureLabel}
        bosStatus={bosStatus}
      />
    </div>
  );
};
