import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area, LineChart, Line } from 'recharts';
import { TickerData } from '../types';

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
}

interface OrderflowIndicatorsProps {
  slicedData: ChartDataItem[];
  chartData: ChartDataItem[];
  ticker: TickerData;
}

export const OrderflowIndicators: React.FC<OrderflowIndicatorsProps> = React.memo(({
  slicedData,
  chartData,
  ticker,
}) => {
  return (
    <div className="space-y-2">
      {/* Volume Taker Buy/Sell Bar Chart */}
      <div className="h-24 w-full pt-1 relative group">
        <span className="absolute top-1 left-2 text-[9px] font-bold text-neutral-500 uppercase z-10 group-hover:text-white transition">
          Volume Agressão (Taker Compra / Venda)
        </span>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={slicedData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide />
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
          <AreaChart data={slicedData} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="cvdGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ticker.cvdDirection === 'BUY' ? '#10b981' : '#f43f5e'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={ticker.cvdDirection === 'BUY' ? '#10b981' : '#f43f5e'} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip contentStyle={{ backgroundColor: '#050505', borderColor: '#262626', fontSize: '10px', color: '#fff' }} />
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

      {/* Open Interest Chart */}
      <div className="h-24 w-full pt-1 border-t border-white/5 mt-2 relative group">
        <span className="absolute top-1 left-2 text-[9px] font-bold text-neutral-500 uppercase z-10 group-hover:text-white transition">
          Open Interest (Contratos Abertos)
        </span>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip contentStyle={{ backgroundColor: '#050505', borderColor: '#262626', fontSize: '10px', color: '#fff' }} />
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
