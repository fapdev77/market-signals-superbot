import React, { useState, useEffect } from 'react';
import { TickerData, IndicatorWeights } from '../types';
import { Play, Database, RefreshCw, BarChart2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface BacktestDashboardProps {
  tickers: TickerData[];
  weights: IndicatorWeights;
}

export const BacktestDashboard: React.FC<BacktestDashboardProps> = ({ tickers, weights }) => {
  const [selectedSymbol, setSelectedSymbol] = useState(tickers[0]?.symbol || 'BTCUSDT');
  const [days, setDays] = useState(30);
  const [syncState, setSyncState] = useState<any>(null);
  const [backtestResult, setBacktestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [useCache, setUseCache] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Poll sync status if syncing
    let interval: any;
    if (syncState?.status === 'SYNCING') {
      interval = setInterval(() => {
        fetch(`/api/backtest/sync/${selectedSymbol}`)
          .then(res => res.json())
          .then(data => setSyncState(data));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [syncState?.status, selectedSymbol]);

  const handleSync = async () => {
    await fetch('/api/backtest/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: selectedSymbol, days })
    });
    // fetch immediate state
    const res = await fetch(`/api/backtest/sync/${selectedSymbol}`);
    setSyncState(await res.json());
  };

  const handleRunBacktest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: selectedSymbol, days, weights, useCache })
      });
      const data = await res.json();
      if (data.success) {
        setBacktestResult(data.result);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-mono pb-10">
      <div className="bg-[#0A0A0A] p-4 rounded-lg border border-white/10 shadow-xl space-y-4">
        <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
          <Database className="h-5 w-5 text-cyan-400" />
          Motor de Backtest & Sincronização
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Ativo</label>
            <select
              value={selectedSymbol}
              onChange={e => { setSelectedSymbol(e.target.value); setSyncState(null); setBacktestResult(null); }}
              className="w-full bg-[#050505] text-white border border-white/10 rounded p-2 text-xs"
            >
              {tickers.map(t => (
                <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-neutral-500 uppercase font-bold block mb-1">Período Histórico</label>
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="w-full bg-[#050505] text-white border border-white/10 rounded p-2 text-xs"
            >
              <option value={7}>7 Dias (Rápido)</option>
              <option value={30}>30 Dias</option>
              <option value={90}>90 Dias (Demorado)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSync}
              disabled={syncState?.status === 'SYNCING'}
              className="w-full px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-cyan-400 rounded text-xs font-bold transition border border-cyan-500/30 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncState?.status === 'SYNCING' ? 'animate-spin' : ''}`} />
              {syncState?.status === 'SYNCING' ? `Sincronizando ${syncState.progress}%` : 'Sincronizar Banco (1m)'}
            </button>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs text-neutral-300 w-full p-2 bg-[#050505] border border-white/5 rounded cursor-pointer hover:bg-white/[0.02]">
               <input type="checkbox" checked={useCache} onChange={(e) => setUseCache(e.target.checked)} className="rounded bg-black border-white/20 text-orange-500 focus:ring-0" />
               Utilizar Cache do Teste Anterior
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
         <button
            onClick={handleRunBacktest}
            disabled={loading || syncState?.status === 'SYNCING'}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-400 text-black rounded text-sm font-black transition flex items-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50"
         >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
            {loading ? 'Rodando Simulação...' : 'Executar Backtest da Estratégia Atual'}
         </button>
      </div>

      {error && (
         <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
         </div>
      )}

      {backtestResult && (
        <div className="bg-[#0A0A0A] p-5 rounded-lg border border-emerald-500/30 shadow-xl shadow-emerald-500/10 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
             <h3 className="text-sm font-black text-emerald-400 flex items-center gap-2">
               <CheckCircle2 className="h-4 w-4" />
               Relatório do Backtest (Validado)
             </h3>
             <span className="text-[10px] text-neutral-500 bg-neutral-900 px-2 py-1 rounded border border-white/5">
                ID: {backtestResult.id.substring(0,8)} | Estratégia: {backtestResult.strategyId}
             </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
             <div className="bg-[#050505] p-3 rounded border border-white/5">
                <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Win Rate</span>
                <span className={`text-lg font-black ${backtestResult.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                   {backtestResult.winRate.toFixed(2)}%
                </span>
             </div>
             <div className="bg-[#050505] p-3 rounded border border-white/5">
                <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Profit Factor</span>
                <span className={`text-lg font-black ${backtestResult.profitFactor >= 1.5 ? 'text-emerald-400' : backtestResult.profitFactor > 1 ? 'text-orange-400' : 'text-rose-400'}`}>
                   {backtestResult.profitFactor.toFixed(2)}
                </span>
             </div>
             <div className="bg-[#050505] p-3 rounded border border-white/5">
                <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Net Profit</span>
                <span className={`text-lg font-black ${backtestResult.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                   {backtestResult.netProfit >= 0 ? '+' : ''}{backtestResult.netProfit.toFixed(2)}%
                </span>
             </div>
             <div className="bg-[#050505] p-3 rounded border border-white/5">
                <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Max Drawdown</span>
                <span className="text-lg font-black text-rose-400">
                   {backtestResult.maxDrawdown.toFixed(2)}%
                </span>
             </div>
             <div className="bg-[#050505] p-3 rounded border border-white/5">
                <span className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Total Trades</span>
                <span className="text-lg font-black text-neutral-200">
                   {backtestResult.totalTrades}
                </span>
             </div>
          </div>
          
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded text-xs leading-relaxed">
             <strong className="block mb-1">Impacto na IA:</strong>
             O LLM agora pode acessar estes dados validados ({backtestResult.winRate.toFixed(1)}% de acerto histórico) para justificar a emissão ou recusa de novos sinais de {backtestResult.symbol}, aprimorando o Raciocínio Quantitativo de aprovação ao vivo no Dashboard.
          </div>
        </div>
      )}
    </div>
  );
}
