import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area, LineChart, Line } from 'recharts';
import { TickerData } from '../types';
import { formatCompactNumber } from '../utils/formatters';

export interface ChartDataItem {
  time: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  takerBuy: number;
  takerSell: number;
  delta: number;
  openInterest: number;
  cvd: number;
  volume?: number;
  quoteVolume?: number;
  takerBuyUSD?: number;
  takerSellUSD?: number;
  deltaUSD?: number;
}

interface OrderflowIndicatorsProps {
  slicedData: ChartDataItem[];
  chartData: ChartDataItem[];
  ticker: TickerData;
}

export const OrderflowIndicators: React.FC<OrderflowIndicatorsProps> = React.memo(({
  slicedData,
  ticker,
}) => {
  const baseAsset = ticker.baseAsset || (ticker.symbol ? ticker.symbol.replace(/USDT|BUSD|USDC/g, '') : 'ATIVO');

  // Custom Tooltip for Volume Aggression (Taker Buy / Sell) - Passo 2
  const VolumeAggressionTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const d: ChartDataItem = payload[0].payload;
    const totalVol = (d.takerBuy ?? 0) + (d.takerSell ?? 0);
    const closePrice = d.close || d.price || ticker.price || 1;
    const totalUSD = d.quoteVolume || (totalVol * closePrice);
    const buyVol = d.takerBuy ?? 0;
    const buyUSD = d.takerBuyUSD || (buyVol * closePrice);
    const sellVol = d.takerSell ?? 0;
    const sellUSD = d.takerSellUSD || (sellVol * closePrice);
    const buyPct = totalVol > 0 ? ((buyVol / totalVol) * 100).toFixed(1) : '50.0';
    const sellPct = totalVol > 0 ? ((sellVol / totalVol) * 100).toFixed(1) : '50.0';
    const delta = d.delta ?? (buyVol - sellVol);
    const deltaUSD = d.deltaUSD ?? (delta * closePrice);
    const isPositive = delta >= 0;

    return (
      <div className="bg-neutral-950/95 backdrop-blur-md border border-neutral-800 p-2.5 rounded-lg shadow-2xl text-[11px] font-mono space-y-1.5 min-w-[220px] z-50 pointer-events-none">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-1 text-neutral-400">
          <span className="font-semibold text-white">{d.time || label}</span>
          <span className="text-[10px] text-neutral-400">Volume Agressão</span>
        </div>
        <div className="flex justify-between items-center text-neutral-200">
          <span className="text-neutral-400">Vol Vela:</span>
          <span className="font-bold text-white">
            {totalVol.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseAsset}
            <span className="text-neutral-400 font-normal ml-1">(${formatCompactNumber(totalUSD)})</span>
          </span>
        </div>
        <div className="flex justify-between items-center text-emerald-400">
          <span>Taker Compra:</span>
          <span className="font-bold">
            {buyVol.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseAsset}
            <span className="text-emerald-500/80 font-normal ml-1">(${formatCompactNumber(buyUSD)} • {buyPct}%)</span>
          </span>
        </div>
        <div className="flex justify-between items-center text-rose-400">
          <span>Taker Venda:</span>
          <span className="font-bold">
            {sellVol.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseAsset}
            <span className="text-rose-500/80 font-normal ml-1">(${formatCompactNumber(sellUSD)} • {sellPct}%)</span>
          </span>
        </div>
        <div className="border-t border-neutral-800/80 pt-1 flex justify-between items-center">
          <span className="text-neutral-400">Delta da Vela:</span>
          <span className={`font-extrabold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositive ? '+' : ''}{delta.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseAsset}
            <span className="text-[10px] font-normal ml-1">({isPositive ? '+' : ''}${formatCompactNumber(deltaUSD)})</span>
          </span>
        </div>
      </div>
    );
  };

  const CVDTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const d: ChartDataItem = payload[0].payload;
    const cvdVal = d.cvd ?? 0;
    return (
      <div className="bg-neutral-950/95 backdrop-blur-md border border-neutral-800 p-2 rounded-lg shadow-xl text-[11px] font-mono text-neutral-300 pointer-events-none">
        <div className="text-neutral-400 text-[10px]">{d.time || label}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-neutral-400">CVD Acumulado:</span>
          <span className={`font-bold ${cvdVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {cvdVal >= 0 ? '+' : ''}${formatCompactNumber(cvdVal)}
          </span>
        </div>
      </div>
    );
  };

  const OITooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const d: ChartDataItem = payload[0].payload;
    const oiVal = d.openInterest ?? 0;
    return (
      <div className="bg-neutral-950/95 backdrop-blur-md border border-neutral-800 p-2 rounded-lg shadow-xl text-[11px] font-mono text-neutral-300 pointer-events-none">
        <div className="text-neutral-400 text-[10px]">{d.time || label}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-neutral-400">Open Interest:</span>
          <span className="font-bold text-cyan-400">
            ${formatCompactNumber(oiVal)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* Volume Taker Buy/Sell Bar Chart (Passo 1: syncId & YAxis width 65, Passo 2: Tooltip ativo/USD) */}
      <div className="h-24 w-full pt-1 relative group">
        <span className="absolute top-1 left-2 text-[9px] font-bold text-neutral-500 uppercase z-10 group-hover:text-white transition">
          Volume Agressão (Taker Compra / Venda) • {baseAsset} & USD
        </span>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart syncId="cryptoSniperChart" data={slicedData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis
              orientation="right"
              width={65}
              stroke="#404040"
              tick={{ fontSize: 8, fill: '#737373' }}
              tickFormatter={(val) => formatCompactNumber(val)}
            />
            <Tooltip
              content={<VolumeAggressionTooltip />}
              cursor={{ stroke: '#f97316', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Bar dataKey="takerBuy" name="Taker Compra" stackId="a" fill="#10b981" />
            <Bar dataKey="takerSell" name="Taker Venda" stackId="a" fill="#f43f5e" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* CVD (Cumulative Volume Delta) Chart */}
      <div className="h-24 w-full pt-1 border-t border-white/5 mt-2 relative group">
        <span className="absolute top-1 left-2 text-[9px] font-bold text-neutral-500 uppercase z-10 group-hover:text-white transition">
          CVD (Delta Acumulado)
        </span>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart syncId="cryptoSniperChart" data={slicedData} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="cvdGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ticker.cvdDirection === 'BUY' ? '#10b981' : '#f43f5e'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={ticker.cvdDirection === 'BUY' ? '#10b981' : '#f43f5e'} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis
              domain={['auto', 'auto']}
              orientation="right"
              width={65}
              stroke="#404040"
              tick={{ fontSize: 8, fill: '#737373' }}
              tickFormatter={(val) => `$${formatCompactNumber(val)}`}
            />
            <Tooltip
              content={<CVDTooltip />}
              cursor={{ stroke: '#f97316', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area
              type="step"
              dataKey="cvd"
              name="CVD"
              stroke={ticker.cvdDirection === 'BUY' ? '#10b981' : '#f43f5e'}
              fill="url(#cvdGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Open Interest Chart (Passo 1: data={slicedData} para alinhar o zoom com o gráfico principal) */}
      <div className="h-24 w-full pt-1 border-t border-white/5 mt-2 relative group">
        <span className="absolute top-1 left-2 text-[9px] font-bold text-neutral-500 uppercase z-10 group-hover:text-white transition">
          Open Interest (Contratos Abertos)
        </span>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart syncId="cryptoSniperChart" data={slicedData} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis
              domain={['auto', 'auto']}
              orientation="right"
              width={65}
              stroke="#404040"
              tick={{ fontSize: 8, fill: '#737373' }}
              tickFormatter={(val) => `$${formatCompactNumber(val)}`}
            />
            <Tooltip
              content={<OITooltip />}
              cursor={{ stroke: '#f97316', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Line
              type="monotone"
              dataKey="openInterest"
              name="Open Interest"
              stroke="#06b6d4"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

OrderflowIndicators.displayName = 'OrderflowIndicators';
