import React, { useState } from 'react';
import { 
  PhoneCall, 
  WholeWord, 
  Timer, 
  CheckCircle, 
  DollarSign, 
  Package, 
  BarChart2, 
  Tag, 
  ListOrdered 
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// --- MOCK DATA ---
const mockStats = {
  totalCalls: 1245,
  successCalls: 1240,
  failedCalls: 5,
  totalTokens: 1450000,
  promptTokens: 1100000,
  completionTokens: 350000,
  avgTimeMs: 840,
  avgTokensPerCall: 1164,
  successRate: 99.6,
  totalCost: 0.145, // Assuming some cheap Gemini Flash model cost
};

const modelsUsage = [
  { model: 'gemini-flash-latest', calls: 950, tokens: 1050000, avgPerCall: 1105, avgTime: 720, cost: 0.105 },
  { model: 'gemini-3.1-pro', calls: 295, tokens: 400000, avgPerCall: 1355, avgTime: 1200, cost: 0.040 },
];

const dailyUsage = [
  { date: '22/07', tokens: 180000 },
  { date: '23/07', tokens: 150000 },
  { date: '24/07', tokens: 210000 },
  { date: '25/07', tokens: 195000 },
  { date: '26/07', tokens: 250000 },
  { date: '27/07', tokens: 320000 },
  { date: '28/07', tokens: 145000 },
];

const typeUsage = [
  { type: 'Signal Review (SMC)', calls: 800, tokens: 960000, avgTime: 750 },
  { type: 'Market Audit', calls: 145, tokens: 290000, avgTime: 1100 },
  { type: 'Chat Assistant', calls: 300, tokens: 200000, avgTime: 950 },
];

const recentCalls = [
  { id: 1, date: '28/07, 13:45', model: 'gemini-flash-latest', asset: 'BTCUSDT', tokens: 1205, time: 650, status: 'SUCESSO' },
  { id: 2, date: '28/07, 13:42', model: 'gemini-3.1-pro', asset: 'ETHUSDT', tokens: 1400, time: 1150, status: 'SUCESSO' },
  { id: 3, date: '28/07, 13:40', model: 'gemini-flash-latest', asset: 'SOLUSDT', tokens: 1150, time: 720, status: 'SUCESSO' },
  { id: 4, date: '28/07, 13:35', model: 'gemini-flash-latest', asset: 'DOGEUSDT', tokens: 0, time: '-', status: 'ERRO' },
  { id: 5, date: '28/07, 13:30', model: 'gemini-flash-latest', asset: 'XRPUSDT', tokens: 1090, time: 680, status: 'SUCESSO' },
];

export const AIDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7 dias');

  return (
    <div className="space-y-4 max-w-[2400px] mx-auto font-mono pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-cyan-400" />
            Consumo da IA & Telemetria
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Tokens, tempo de resposta e custo das chamadas dos modelos de IA
          </p>
        </div>
        <select 
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="bg-[#0A0A0A] border border-white/10 text-neutral-200 text-xs font-bold rounded px-3 py-1.5 focus:outline-none focus:border-cyan-500"
        >
          <option value="Hoje">Hoje</option>
          <option value="7 dias">Últimos 7 dias</option>
          <option value="30 dias">Últimos 30 dias</option>
        </select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 min-[1900px]:grid-cols-8 gap-3">
        
        {/* Total Chamadas */}
        <div className="bg-[#0A0A0A] p-3 rounded-lg border border-white/10 flex items-center gap-3 shadow-md">
          <div className="p-2 bg-indigo-500/10 rounded-full border border-indigo-500/20">
            <PhoneCall className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold">Total Chamadas</p>
            <p className="text-base font-extrabold text-white">{mockStats.totalCalls}</p>
            <p className="text-[9px] text-neutral-400">{mockStats.successCalls} sucesso · {mockStats.failedCalls} falhas</p>
          </div>
        </div>

        {/* Tokens */}
        <div className="bg-[#0A0A0A] p-3 rounded-lg border border-white/10 flex items-center gap-3 shadow-md">
          <div className="p-2 bg-blue-500/10 rounded-full border border-blue-500/20">
            <WholeWord className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold">Tokens</p>
            <p className="text-base font-extrabold text-white">{(mockStats.totalTokens / 1000).toFixed(1)}k</p>
            <p className="text-[9px] text-neutral-400">{(mockStats.promptTokens / 1000).toFixed(0)}k prompt · {(mockStats.completionTokens / 1000).toFixed(0)}k compl</p>
          </div>
        </div>

        {/* Tempo Médio */}
        <div className="bg-[#0A0A0A] p-3 rounded-lg border border-white/10 flex items-center gap-3 shadow-md">
          <div className="p-2 bg-pink-500/10 rounded-full border border-pink-500/20">
            <Timer className="h-4 w-4 text-pink-400" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold">Tempo Médio</p>
            <p className="text-base font-extrabold text-white">{mockStats.avgTimeMs}ms</p>
            <p className="text-[9px] text-neutral-400">{mockStats.avgTokensPerCall} tok/chamada</p>
          </div>
        </div>

        {/* Sucesso */}
        <div className="bg-[#0A0A0A] p-3 rounded-lg border border-white/10 flex items-center gap-3 shadow-md">
          <div className="p-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold">Sucesso</p>
            <p className="text-base font-extrabold text-white">{mockStats.successRate}%</p>
            <p className="text-[9px] text-neutral-400">{mockStats.failedCalls} falhas em {mockStats.totalCalls}</p>
          </div>
        </div>

        {/* Custo Total */}
        <div className="bg-[#0A0A0A] p-3 rounded-lg border border-white/10 flex items-center gap-3 shadow-md">
          <div className="p-2 bg-amber-500/10 rounded-full border border-amber-500/20">
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-500 uppercase font-bold">Custo Total</p>
            <p className="text-base font-extrabold text-emerald-400">${mockStats.totalCost.toFixed(4)}</p>
            <p className="text-[9px] text-neutral-400">{modelsUsage.length} modelo(s)</p>
          </div>
        </div>

      </div>

      {/* Consumo por Modelo */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/10 shadow-xl overflow-hidden">
        <div className="p-3 border-b border-white/10 flex items-center gap-2">
          <Package className="h-4 w-4 text-orange-400" />
          <h3 className="text-xs font-bold text-neutral-200">Consumo por Modelo</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] text-neutral-500 uppercase bg-[#050505] border-b border-white/5">
              <tr>
                <th className="px-4 py-2 font-bold">Modelo</th>
                <th className="px-4 py-2 font-bold text-right">Chamadas</th>
                <th className="px-4 py-2 font-bold text-right">Tokens</th>
                <th className="px-4 py-2 font-bold text-right">Méd/Chamada</th>
                <th className="px-4 py-2 font-bold text-right">Tempo Méd</th>
                <th className="px-4 py-2 font-bold text-right">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {modelsUsage.map((m, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition">
                  <td className="px-4 py-3 font-bold text-neutral-200">{m.model}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">{m.calls}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">{(m.tokens / 1000).toFixed(1)}k</td>
                  <td className="px-4 py-3 text-right text-neutral-400">{m.avgPerCall}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">{m.avgTime}ms</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-bold">${m.cost.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Consumo Diário (Chart) */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/10 shadow-xl p-3">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-neutral-200">Consumo Diário (Tokens)</h3>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyUsage} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="date" stroke="#666" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#666" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val / 1000}k`} />
              <Tooltip 
                cursor={{ fill: '#ffffff0a' }}
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #333', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                formatter={(value: number) => [`${value.toLocaleString()} tokens`, 'Tokens']}
              />
              <Bar dataKey="tokens" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Consumo por Tipo */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/10 shadow-xl overflow-hidden">
        <div className="p-3 border-b border-white/10 flex items-center gap-2">
          <Tag className="h-4 w-4 text-pink-400" />
          <h3 className="text-xs font-bold text-neutral-200">Consumo por Tipo</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] text-neutral-500 uppercase bg-[#050505] border-b border-white/5">
              <tr>
                <th className="px-4 py-2 font-bold">Tipo</th>
                <th className="px-4 py-2 font-bold text-right">Chamadas</th>
                <th className="px-4 py-2 font-bold text-right">Tokens</th>
                <th className="px-4 py-2 font-bold text-right">Tempo Méd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {typeUsage.map((t, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition">
                  <td className="px-4 py-3 font-bold text-neutral-200">{t.type}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">{t.calls}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">{(t.tokens / 1000).toFixed(1)}k</td>
                  <td className="px-4 py-3 text-right text-neutral-400">{t.avgTime}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Últimas Chamadas */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/10 shadow-xl overflow-hidden">
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-neutral-200">Últimas Chamadas</h3>
          </div>
          <span className="text-[10px] text-neutral-500">{recentCalls.length} registros (Amostra)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] text-neutral-500 uppercase bg-[#050505] border-b border-white/5">
              <tr>
                <th className="px-4 py-2 font-bold">Data</th>
                <th className="px-4 py-2 font-bold">Modelo</th>
                <th className="px-4 py-2 font-bold">Ativo</th>
                <th className="px-4 py-2 font-bold text-right">Tokens</th>
                <th className="px-4 py-2 font-bold text-right">Tempo</th>
                <th className="px-4 py-2 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentCalls.map((call) => (
                <tr key={call.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-4 py-3 text-neutral-400">{call.date}</td>
                  <td className="px-4 py-3 text-neutral-300 font-bold">{call.model}</td>
                  <td className="px-4 py-3 text-neutral-400">{call.asset || '—'}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">{call.tokens}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">{call.time === '-' ? '—' : `${call.time}ms`}</td>
                  <td className="px-4 py-3 text-right">
                    {call.status === 'SUCESSO' ? (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        SUCESSO
                      </span>
                    ) : (
                      <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 justify-end w-fit ml-auto">
                        ERRO
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
