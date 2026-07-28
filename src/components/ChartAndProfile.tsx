import React, { useState, useEffect } from 'react';
import { TickerData, KlineCandle, TradeSignal, AIReviewResponse, AIModelConfig } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, BarChart, Bar, CartesianGrid } from 'recharts';
import { LineChart as ChartIcon, Layers, Flame, Activity, RefreshCw, Brain, Target, ShieldAlert, Crosshair, Zap, TrendingUp, TrendingDown } from 'lucide-react';

interface ChartAndProfileProps {
  selectedTicker: TickerData | null;
  allTickers: TickerData[];
  onSelectTickerBySymbol: (symbol: string) => void;
  signals?: TradeSignal[];
  activeModels?: AIModelConfig[];
}

export const ChartAndProfile: React.FC<ChartAndProfileProps> = ({
  selectedTicker,
  allTickers = [],
  onSelectTickerBySymbol,
  signals = [],
  activeModels = []
}) => {
  const ticker = selectedTicker || allTickers[0];
  const [klines, setKlines] = useState<KlineCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiReview, setAiReview] = useState<AIReviewResponse | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  
  const activeSignal = signals.find(s => s.symbol === ticker?.symbol);

  const handleRunAIReview = async () => {
    if (!ticker) return;
    setLoadingReview(true);
    try {
      const model = activeModels.find(m => m.isActive)?.modelId || 'gemini-1.5-flash-latest';
      const res = await fetch('/api/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: ticker.symbol, model })
      });
      const data: AIReviewResponse = await res.json();
      setAiReview(data);
    } catch (err) {
      console.error('Failed to run AI review:', err);
    } finally {
      setLoadingReview(false);
    }
  };
  
  useEffect(() => {
    setAiReview(null);
  }, [ticker?.symbol]);

  useEffect(() => {
    if (!ticker?.symbol) return;
    setLoading(true);
    fetch(`/api/tickers/${ticker.symbol}`)
      .then(res => res.json())
      .then(data => {
        if (data.klines) {
          setKlines(data.klines);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [ticker?.symbol]);

  if (!ticker) return null;

  const chartData = klines.map(k => {
    const timeStr = new Date(k.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      time: timeStr,
      price: k.close,
      takerBuy: k.takerBuyVolume,
      takerSell: k.volume - k.takerBuyVolume,
    };
  });

  const fib = ticker.fibonacci || { fib618: 0, fib68: 0, inGoldenPocket: false };
  const range = ticker.rangeProfile || { vah: 0, val: 0, poc: 0 };
  const price = ticker.price ?? 0;
  const changePct = ticker.priceChangePercent24h ?? 0;

  return (
    <div className="space-y-4 font-mono pb-10">
      {/* Top Asset Switcher Bar */}
      <div className="bg-[#0A0A0A] p-3 rounded-lg border border-white/10 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 text-orange-400 rounded border border-orange-500/20">
            <ChartIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white">{ticker.symbol}</h2>
              <span className="text-[10px] bg-neutral-900 text-neutral-300 font-bold px-1.5 py-0.5 rounded border border-white/5">
                Dashboard Unificado do Ativo
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">{ticker.name} • Análise Profunda</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {allTickers.slice(0, 10).map(t => (
            <button
              key={t.symbol}
              onClick={() => onSelectTickerBySymbol(t.symbol)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                t.symbol === ticker.symbol
                  ? 'bg-orange-500 text-black shadow'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/5'
              }`}
            >
              {t.symbol.replace('USDT', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Action / AI Review Area */}
      <div className="bg-gradient-to-r from-orange-500/5 to-[#0A0A0A] p-4 rounded-lg border border-orange-500/20 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Brain className="h-4 w-4 text-orange-400" />
              Auditoria de IA & Sinais Ativos
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">Analise o Order Flow, CVD e confluências com o Motor Quantitativo de IA.</p>
          </div>
          <button
            onClick={handleRunAIReview}
            disabled={loadingReview}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50 whitespace-nowrap"
          >
            {loadingReview ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Auditando...</>
            ) : (
              <><Brain className="h-4 w-4" /> Executar Auditoria IA</>
            )}
          </button>
        </div>

        {aiReview && (
          <div className="mt-4 pt-4 border-t border-white/10 animate-fade-in space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 bg-[#050505] p-2.5 rounded border border-white/5">
                <span className="text-[10px] text-neutral-500 font-bold uppercase">Decisão IA</span>
                <span className={`text-sm font-extrabold ${
                  aiReview.decision === 'CONFIRM' ? 'text-emerald-400' : 
                  aiReview.decision === 'REJECT' ? 'text-rose-400' : 'text-amber-400'
                }`}>
                  {aiReview.decision}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-[#050505] p-2.5 rounded border border-white/5">
                <span className="text-[10px] text-neutral-500 font-bold uppercase">Direção</span>
                <span className={`text-sm font-extrabold flex items-center gap-1 ${
                  aiReview.recommendedDirection === 'LONG' ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {aiReview.recommendedDirection === 'LONG' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {aiReview.recommendedDirection}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-[#050505] p-2.5 rounded border border-white/5">
                <span className="text-[10px] text-neutral-500 font-bold uppercase">Confiança</span>
                <span className="text-sm font-extrabold text-orange-400">{aiReview.confidenceScore}%</span>
              </div>
            </div>
            
            <div className="bg-[#050505] p-3 rounded border border-white/5 text-xs text-neutral-300 leading-relaxed">
              <strong className="text-orange-400 block mb-1">Raciocínio da IA:</strong>
              {aiReview.reasoning}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#050505] p-2 rounded border border-white/5">
                <span className="text-[10px] text-neutral-500 uppercase block font-bold mb-0.5">Zona de Entrada</span>
                <span className="font-bold text-neutral-200">
                  ${(aiReview.entryZone?.[0] ?? 0).toFixed(4)} - ${(aiReview.entryZone?.[1] ?? 0).toFixed(4)}
                </span>
              </div>
              <div className="bg-[#050505] p-2 rounded border border-rose-500/20">
                <span className="text-[10px] text-rose-500 uppercase block font-bold mb-0.5">Stop Loss</span>
                <span className="font-bold text-rose-400">${(aiReview.stopLoss ?? 0).toFixed(4)}</span>
              </div>
              <div className="bg-[#050505] p-2 rounded border border-emerald-500/20">
                <span className="text-[10px] text-emerald-500 uppercase block font-bold mb-0.5">Alvo Scalp/DT</span>
                <span className="font-bold text-emerald-400">${(aiReview.takeProfit1 ?? 0).toFixed(4)}</span>
              </div>
              <div className="bg-[#050505] p-2 rounded border border-emerald-500/20">
                <span className="text-[10px] text-emerald-500 uppercase block font-bold mb-0.5">Alvo Swing</span>
                <span className="font-bold text-emerald-400">${(aiReview.takeProfit2 ?? 0).toFixed(4)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Active Signal Info */}
        {!aiReview && activeSignal && (
          <div className="mt-4 pt-4 border-t border-white/10 animate-fade-in space-y-3">
             <div className="flex items-center justify-between mb-1">
               <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase">
                  <Zap className="h-4 w-4" />
                  Sinal Ativo Encontrado para {ticker.symbol}
               </div>
               {activeSignal.backtestWinRate && (
                 <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${activeSignal.backtestWinRate >= 60 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                   Backtest WR: {activeSignal.backtestWinRate.toFixed(1)}% | PF: {activeSignal.backtestProfitFactor?.toFixed(2)}
                 </span>
               )}
             </div>
             
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#050505] p-2 rounded border border-emerald-500/20">
                <span className="text-[10px] text-emerald-500 uppercase block font-bold mb-0.5">Direção</span>
                <span className="font-extrabold text-emerald-400">{activeSignal.direction} ({activeSignal.signalType})</span>
              </div>
              <div className="bg-[#050505] p-2 rounded border border-white/5">
                <span className="text-[10px] text-neutral-500 uppercase block font-bold mb-0.5">Zona Entrada</span>
                <span className="font-bold text-orange-400">
                  ${(activeSignal.entryZone?.[0] ?? 0).toFixed(4)} - ${(activeSignal.entryZone?.[1] ?? 0).toFixed(4)}
                </span>
              </div>
              <div className="bg-[#050505] p-2 rounded border border-rose-500/20">
                <span className="text-[10px] text-rose-500 uppercase block font-bold mb-0.5">Stop Loss</span>
                <span className="font-bold text-rose-400">${(activeSignal.stopLoss ?? 0).toFixed(4)}</span>
              </div>
              <div className="bg-[#050505] p-2 rounded border border-emerald-500/20">
                <span className="text-[10px] text-emerald-500 uppercase block font-bold mb-0.5">Alvo 1 (DT)</span>
                <span className="font-bold text-emerald-400">${(activeSignal.target1 ?? 0).toFixed(4)}</span>
              </div>
            </div>

            <div className="bg-[#050505] p-3 rounded border border-white/5">
               <span className="text-[10px] text-neutral-500 uppercase block font-bold mb-1.5">Fatores de Confluência Detalhados ({activeSignal.confluenceScore}%)</span>
               <div className="flex flex-wrap gap-1.5">
                  {(activeSignal.confluenceFactors || []).map((f, idx) => (
                    <span key={idx} className="text-[9px] font-bold bg-neutral-900 text-neutral-300 px-2 py-1 rounded border border-white/10">
                      ✓ {f}
                    </span>
                  ))}
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Chart Grid & Order Flow Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Price Chart with Fibonacci Overlays */}
        <div className="lg:col-span-2 bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-black text-white">
                ${price >= 1000 ? price.toLocaleString('en-US', { minimumFractionDigits: 1 }) : price.toFixed(price < 1 ? 4 : 2)}
              </div>
              <span className={`text-xs font-bold ${changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {changePct >= 0 ? '▲ +' : '▼ '}{changePct.toFixed(2)}% (24h)
              </span>
            </div>
            {/* Golden Pocket Banner */}
            <div className={`px-2.5 py-1 rounded border text-xs font-bold flex items-center gap-1.5 ${
              fib.inGoldenPocket ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 animate-pulse' : 'bg-neutral-900 text-neutral-400 border-white/10'
            }`}>
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              {fib.inGoldenPocket ? 'NA ZONA GOLDEN POCKET (0.618 - 0.68)' : 'AGUARDANDO FIBO 0.618-0.68'}
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="h-72 w-full pt-2">
            {loading ? (
              <div className="h-full flex items-center justify-center text-neutral-500 text-xs">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Carregando gráfico...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 2" stroke="#262626" />
                  <XAxis dataKey="time" stroke="#737373" tick={{ fontSize: 9 }} />
                  <YAxis domain={['auto', 'auto']} stroke="#737373" tick={{ fontSize: 9 }} orientation="right" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#050505', borderColor: '#262626', borderRadius: '6px', fontSize: '11px', color: '#fff' }}
                  />
                  {/* Fibonacci Retracement Levels */}
                  {fib.fib618 > 0 && (
                    <ReferenceLine y={fib.fib618} stroke="#f97316" strokeDasharray="3 3" label={{ value: `Fibo 0.618 ($${fib.fib618.toFixed(2)})`, fill: '#f97316', fontSize: 9 }} />
                  )}
                  {fib.fib68 > 0 && (
                    <ReferenceLine y={fib.fib68} stroke="#ea580c" strokeDasharray="3 3" label={{ value: `Fibo 0.68 ($${fib.fib68.toFixed(2)})`, fill: '#ea580c', fontSize: 9 }} />
                  )}
                  {range.poc > 0 && (
                    <ReferenceLine y={range.poc} stroke="#06b6d4" strokeDasharray="2 2" label={{ value: `POC Range ($${range.poc.toFixed(2)})`, fill: '#06b6d4', fontSize: 9 }} />
                  )}
                  {/* Active Signal / AI Review targets */}
                  {(aiReview?.takeProfit1 || activeSignal?.target1) && (
                     <ReferenceLine y={aiReview?.takeProfit1 || activeSignal?.target1} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Alvo', fill: '#10b981', fontSize: 9 }} />
                  )}
                  {(aiReview?.stopLoss || activeSignal?.stopLoss) && (
                     <ReferenceLine y={aiReview?.stopLoss || activeSignal?.stopLoss} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Stop', fill: '#f43f5e', fontSize: 9 }} />
                  )}
                  <Area type="monotone" dataKey="price" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#priceGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Volume Taker Buy/Sell Bar Chart */}
          <div className="h-24 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Bar dataKey="takerBuy" name="Taker Compra" stackId="a" fill="#10b981" />
                <Bar dataKey="takerSell" name="Taker Venda" stackId="a" fill="#f43f5e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Sidebar: Volume Profile & Order Flow Breakdown */}
        <div className="space-y-4">
          {/* Volume Profile Breakdown */}
          <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-2.5">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <Layers className="h-4 w-4 text-orange-400" />
              <h3 className="text-xs font-bold text-white uppercase">Volume Profile do Range</h3>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between p-2 rounded bg-[#050505] border border-white/5">
                <span className="text-neutral-400">VAH (Value Area High):</span>
                <span className="font-extrabold text-neutral-200">${(range.vah ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-orange-500/10 border border-orange-500/30">
                <span className="text-orange-400 font-bold">POC (Point of Control):</span>
                <span className="font-extrabold text-orange-400">${(range.poc ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-[#050505] border border-white/5">
                <span className="text-neutral-400">VAL (Value Area Low):</span>
                <span className="font-extrabold text-neutral-200">${(range.val ?? 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Order Flow & OI Breakdown */}
          <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-2.5">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase">Métricas de Order Flow</h3>
            </div>
            <div className="space-y-2.5 text-xs">
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
              <div className="flex justify-between p-2 bg-[#050505] rounded border border-white/5">
                <span className="text-neutral-400">Var Open Interest (1h):</span>
                <span className={`font-bold ${(ticker.openInterestChange1h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(ticker.openInterestChange1h ?? 0) >= 0 ? '+' : ''}{(ticker.openInterestChange1h ?? 0).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between p-2 bg-[#050505] rounded border border-white/5">
                <span className="text-neutral-400">Funding Rate Anualizado:</span>
                <span className="font-bold text-orange-400">
                  {(ticker.fundingRateAnnualized ?? 0).toFixed(2)}% APR
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
