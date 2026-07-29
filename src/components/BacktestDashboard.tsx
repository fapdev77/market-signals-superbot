import React, { useState, useEffect } from 'react';
import { TickerData, IndicatorWeights, TradingProfile, BacktestResult, AutoTuneResult } from '../types';
import { PROFILE_PRESETS } from '../services/BacktestEngine';
import { 
  Play, 
  Database, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  Sliders, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ShieldCheck, 
  Cpu, 
  Target, 
  Layers, 
  Award,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface BacktestDashboardProps {
  tickers: TickerData[];
  weights: IndicatorWeights;
  onApplyWeights?: (newWeights: IndicatorWeights) => void;
}

export const BacktestDashboard: React.FC<BacktestDashboardProps> = ({ tickers, weights, onApplyWeights }) => {
  const [selectedSymbol, setSelectedSymbol] = useState(tickers[0]?.symbol || 'BTCUSDT');
  const [days, setDays] = useState(30);
  const [profile, setProfile] = useState<TradingProfile>('daytrade');
  const [syncState, setSyncState] = useState<any>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [autoTuneResult, setAutoTuneResult] = useState<AutoTuneResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tuningLoading, setTuningLoading] = useState(false);
  const [tuningIterations, setTuningIterations] = useState(20);
  const [useCache, setUseCache] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appliedSuccessMsg, setAppliedSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
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
    const res = await fetch(`/api/backtest/sync/${selectedSymbol}`);
    setSyncState(await res.json());
  };

  const handleRunBacktest = async () => {
    setLoading(true);
    setError(null);
    setAppliedSuccessMsg(null);
    try {
      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: selectedSymbol, days, profile, weights, useCache })
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

  const handleRunAutoTune = async () => {
    setTuningLoading(true);
    setError(null);
    setAppliedSuccessMsg(null);
    try {
      const res = await fetch('/api/backtest/autotune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedSymbol,
          profile,
          days,
          iterations: tuningIterations
        })
      });
      const data = await res.json();
      if (data.success) {
        setAutoTuneResult(data.tuneResult);
        setBacktestResult(data.tuneResult.bestResult);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTuningLoading(false);
    }
  };

  const handleApplyTunedWeights = async (newWeights: IndicatorWeights) => {
    try {
      const res = await fetch('/api/settings/weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWeights)
      });
      const data = await res.json();
      if (data.success) {
        if (onApplyWeights) onApplyWeights(newWeights);
        setAppliedSuccessMsg('Novos pesos otimizados foram aplicados ao robô com sucesso!');
      }
    } catch (err: any) {
      setError('Falha ao aplicar pesos otimizados: ' + err.message);
    }
  };

  const currentPreset = PROFILE_PRESETS[profile];

  return (
    <div className="space-y-6 font-mono pb-12 text-xs">
      
      {/* 1. Profile Selection Cards */}
      <div className="bg-[#0A0A0A] p-4 rounded-xl border border-white/10 shadow-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-400" />
            Perfil da Estratégia de Negociação
          </h2>
          <span className="text-[10px] text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-white/10">
            Ajusta timeframes, stop loss e alvos de risco
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(Object.keys(PROFILE_PRESETS) as TradingProfile[]).map((pKey) => {
            const p = PROFILE_PRESETS[pKey];
            const isSelected = profile === pKey;
            return (
              <button
                key={pKey}
                onClick={() => setProfile(pKey)}
                className={`p-3 rounded-lg border text-left transition relative flex flex-col justify-between ${
                  isSelected 
                    ? 'bg-orange-500/10 border-orange-500 shadow-lg shadow-orange-500/10 text-white' 
                    : 'bg-[#050505] border-white/5 hover:border-white/20 text-neutral-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-black text-xs ${isSelected ? 'text-orange-400' : 'text-neutral-200'}`}>
                      {p.name}
                    </span>
                    <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-neutral-300 font-bold">
                      {p.timeframeLabel}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-tight mb-2">
                    {p.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-1 text-[9px] font-bold">
                  <div>
                    <span className="text-neutral-500 block">R:R Alvo</span>
                    <span className="text-emerald-400">1 : {p.targetRiskRatio}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Stop Loss</span>
                    <span className="text-rose-400">~{p.stopLossPct}%</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Controls & Parameter Bar */}
      <div className="bg-[#0A0A0A] p-4 rounded-xl border border-white/10 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Database className="h-4 w-4 text-cyan-400" />
            Parâmetros do Backtest & Histórico de Preços
          </h2>
          {syncState?.status === 'SYNCING' && (
            <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30 flex items-center gap-1.5 animate-pulse">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Sincronizando Velas: {syncState.progress}%
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">Ativo / Ticker</label>
            <select
              value={selectedSymbol}
              onChange={e => { setSelectedSymbol(e.target.value); setSyncState(null); setBacktestResult(null); setAutoTuneResult(null); }}
              className="w-full bg-[#050505] text-white border border-white/10 rounded p-2 text-xs font-bold"
            >
              {tickers.map(t => (
                <option key={t.symbol} value={t.symbol}>{t.symbol} ({t.marketType})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">Período de Análise</label>
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="w-full bg-[#050505] text-white border border-white/10 rounded p-2 text-xs font-bold"
            >
              <option value={7}>7 Dias (~10.000 velas)</option>
              <option value={14}>14 Dias (~20.000 velas)</option>
              <option value={30}>30 Dias (~43.000 velas)</option>
              <option value={60}>60 Dias (~86.000 velas)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">Sincronização 1m</label>
            <button
              onClick={handleSync}
              disabled={syncState?.status === 'SYNCING'}
              className="w-full p-2 bg-neutral-900 hover:bg-neutral-800 text-cyan-400 rounded text-xs font-bold transition border border-cyan-500/30 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncState?.status === 'SYNCING' ? 'animate-spin' : ''}`} />
              {syncState?.status === 'SYNCING' ? `${syncState.progress}%` : 'Baixar Dados Binance'}
            </button>
          </div>

          <div>
            <label className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">Otimização Cache</label>
            <label className="flex items-center gap-2 text-xs text-neutral-300 w-full p-2 bg-[#050505] border border-white/10 rounded cursor-pointer hover:bg-white/[0.02]">
              <input 
                type="checkbox" 
                checked={useCache} 
                onChange={(e) => setUseCache(e.target.checked)} 
                className="rounded bg-black border-white/20 text-orange-500 focus:ring-0" 
              />
              <span className="text-[10px] font-bold">Reutilizar Resultados</span>
            </label>
          </div>

          <div>
            <label className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">Iterações Auto-Tuning</label>
            <select
              value={tuningIterations}
              onChange={e => setTuningIterations(Number(e.target.value))}
              className="w-full bg-[#050505] text-orange-400 border border-orange-500/30 rounded p-2 text-xs font-bold"
            >
              <option value={10}>10 Iterações (Ultrarrápido)</option>
              <option value={20}>20 Iterações (Padrão)</option>
              <option value={40}>40 Iterações (Profundo)</option>
            </select>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2 border-t border-white/5">
          <button
            onClick={handleRunBacktest}
            disabled={loading || tuningLoading || syncState?.status === 'SYNCING'}
            className="w-full sm:w-auto px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-bold transition flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin text-orange-400" /> : <Play className="h-4 w-4 fill-current text-orange-400" />}
            {loading ? 'Rodando Simulação...' : 'Executar Backtest Atual'}
          </button>

          <button
            onClick={handleRunAutoTune}
            disabled={loading || tuningLoading || syncState?.status === 'SYNCING'}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black rounded-lg font-black transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50"
          >
            {tuningLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
            {tuningLoading ? 'Executando Fine-Tuning...' : '⚡ Iniciar Auto-Tuning de Pesos'}
          </button>
        </div>
      </div>

      {/* Notifications / Errors */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {appliedSuccessMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>{appliedSuccessMsg}</span>
          </div>
          <button onClick={() => setAppliedSuccessMsg(null)} className="text-xs font-bold underline hover:text-white">
            Fechar
          </button>
        </div>
      )}

      {/* 3. "O que está sendo testado" - Active Weights Breakdown Panel */}
      <div className="bg-[#050505] p-4 rounded-xl border border-white/10 space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h3 className="text-xs font-extrabold text-white flex items-center gap-2">
            <Sliders className="h-3.5 w-3.5 text-orange-400" />
            Configuração dos Pesos Quantitativos Testados
          </h3>
          <span className="text-[10px] text-neutral-400">
            Perfil Ativo: <strong className="text-orange-400">{currentPreset.name}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <div className="bg-[#0A0A0A] p-2 rounded border border-white/5">
            <span className="text-[9px] text-neutral-500 uppercase block font-bold">Volume Surge</span>
            <strong className="text-cyan-400 text-sm">{weights.volumeSurgeWeight}%</strong>
          </div>
          <div className="bg-[#0A0A0A] p-2 rounded border border-white/5">
            <span className="text-[9px] text-neutral-500 uppercase block font-bold">Open Interest</span>
            <strong className="text-cyan-400 text-sm">{weights.openInterestWeight}%</strong>
          </div>
          <div className="bg-[#0A0A0A] p-2 rounded border border-white/5">
            <span className="text-[9px] text-neutral-500 uppercase block font-bold">Funding Rate</span>
            <strong className="text-cyan-400 text-sm">{weights.fundingRateWeight}%</strong>
          </div>
          <div className="bg-[#0A0A0A] p-2 rounded border border-white/5">
            <span className="text-[9px] text-neutral-500 uppercase block font-bold">CVD Imbalance</span>
            <strong className="text-cyan-400 text-sm">{weights.cvdImbalanceWeight}%</strong>
          </div>
          <div className="bg-[#0A0A0A] p-2 rounded border border-white/5">
            <span className="text-[9px] text-neutral-500 uppercase block font-bold">Fibonacci Zone</span>
            <strong className="text-cyan-400 text-sm">{weights.fibonacciZoneWeight}%</strong>
          </div>
          <div className="bg-[#0A0A0A] p-2 rounded border border-white/5">
            <span className="text-[9px] text-neutral-500 uppercase block font-bold">Range POC</span>
            <strong className="text-cyan-400 text-sm">{weights.rangePocWeight}%</strong>
          </div>
          <div className="bg-[#0A0A0A] p-2 rounded border border-white/5">
            <span className="text-[9px] text-neutral-500 uppercase block font-bold">Suporte / Res.</span>
            <strong className="text-cyan-400 text-sm">{weights.supportResistanceWeight}%</strong>
          </div>
        </div>
      </div>

      {/* 4. Auto-Tuning Optimization Report (if available) */}
      {autoTuneResult && (
        <div className="bg-[#0A0A0A] p-5 rounded-xl border border-amber-500/40 shadow-2xl shadow-amber-500/10 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <h3 className="text-sm font-black text-amber-400">
                Resultado do Auto-Tuning & Fine-Tuning de Pesos
              </h3>
            </div>
            <button
              onClick={() => handleApplyTunedWeights(autoTuneResult.bestWeights)}
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded shadow transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Aplicar Pesos Otimizados no Bot
            </button>
          </div>

          <p className="text-neutral-300 leading-relaxed bg-[#050505] p-3 rounded border border-white/5">
            {autoTuneResult.tuningSummary}
          </p>

          {/* Side-by-Side Comparison Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Initial Config */}
            <div className="bg-[#050505] p-3.5 rounded-lg border border-white/10 space-y-2">
              <span className="text-[10px] text-neutral-400 font-bold uppercase block border-b border-white/5 pb-1">
                Configuração Inicial (Antes)
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-neutral-500 text-[10px]">Win Rate:</span>
                  <div className="font-bold text-white">{autoTuneResult.initialResult.winRate}%</div>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px]">Profit Factor:</span>
                  <div className="font-bold text-white">{autoTuneResult.initialResult.profitFactor}</div>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px]">Lucro Líquido:</span>
                  <div className="font-bold text-white">{autoTuneResult.initialResult.netProfit}%</div>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px]">Max Drawdown:</span>
                  <div className="font-bold text-rose-400">{autoTuneResult.initialResult.maxDrawdown}%</div>
                </div>
              </div>
            </div>

            {/* Tuned Best Config */}
            <div className="bg-[#050505] p-3.5 rounded-lg border border-emerald-500/30 space-y-2">
              <span className="text-[10px] text-emerald-400 font-bold uppercase block border-b border-white/5 pb-1 flex items-center justify-between">
                <span>Melhor Configuração Encontrada (Otimizada)</span>
                <span className="text-emerald-400 bg-emerald-500/10 px-1.5 rounded text-[9px]">Melhor Fitness</span>
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-neutral-500 text-[10px]">Win Rate:</span>
                  <div className="font-black text-emerald-400">{autoTuneResult.bestResult.winRate}%</div>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px]">Profit Factor:</span>
                  <div className="font-black text-emerald-400">{autoTuneResult.bestResult.profitFactor}</div>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px]">Lucro Líquido:</span>
                  <div className="font-black text-emerald-400">+{autoTuneResult.bestResult.netProfit}%</div>
                </div>
                <div>
                  <span className="text-neutral-500 text-[10px]">Max Drawdown:</span>
                  <div className="font-black text-emerald-400">{autoTuneResult.bestResult.maxDrawdown}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Best Weights Grid */}
          <div className="pt-2">
            <span className="text-[10px] text-neutral-400 font-bold uppercase block mb-1.5">
              Pesos Otimizados para o Perfil {PROFILE_PRESETS[profile].name}:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {Object.entries(autoTuneResult.bestWeights).map(([k, v]) => {
                if (k === 'minRiskRewardRatio' || k === 'volumeProfileRange') return null;
                return (
                  <div key={k} className="bg-[#050505] p-2 rounded border border-amber-500/20 text-center">
                    <span className="text-[8px] text-neutral-400 uppercase block font-bold truncate">
                      {k.replace('Weight', '')}
                    </span>
                    <strong className="text-amber-400 text-xs">{v}%</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. Main Backtest Results Report */}
      {backtestResult && (
        <div className="bg-[#0A0A0A] p-5 rounded-xl border border-emerald-500/30 shadow-2xl space-y-5 animate-fade-in">
          
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-black text-white">
                  Relatório de Backtest Quantitativo - {backtestResult.symbol}
                </h3>
                <span className="text-[10px] text-neutral-400 block">
                  Estratégia {PROFILE_PRESETS[backtestResult.profile]?.name || backtestResult.profile} | {new Date(backtestResult.startTime).toLocaleDateString()} a {new Date(backtestResult.endTime).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-400 bg-neutral-900 px-2 py-1 rounded border border-white/5">
                Velas Analisadas: <strong className="text-white">{backtestResult.totalCandlesTested.toLocaleString()}</strong>
              </span>
              <span className="text-[10px] text-neutral-400 bg-neutral-900 px-2 py-1 rounded border border-white/5">
                ID: {backtestResult.id.substring(0, 8)}
              </span>
            </div>
          </div>

          {/* Primary Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-[#050505] p-3 rounded-lg border border-white/5">
              <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-0.5">Win Rate</span>
              <span className={`text-base font-black ${backtestResult.winRate >= 55 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {backtestResult.winRate}%
              </span>
            </div>

            <div className="bg-[#050505] p-3 rounded-lg border border-white/5">
              <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-0.5">Profit Factor</span>
              <span className={`text-base font-black ${backtestResult.profitFactor >= 1.5 ? 'text-emerald-400' : 'text-orange-400'}`}>
                {backtestResult.profitFactor}
              </span>
            </div>

            <div className="bg-[#050505] p-3 rounded-lg border border-white/5">
              <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-0.5">Lucro Líquido</span>
              <span className={`text-base font-black ${backtestResult.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {backtestResult.netProfit >= 0 ? '+' : ''}{backtestResult.netProfit}%
              </span>
            </div>

            <div className="bg-[#050505] p-3 rounded-lg border border-white/5">
              <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-0.5">Max Drawdown</span>
              <span className="text-base font-black text-rose-400">
                {backtestResult.maxDrawdown}%
              </span>
            </div>

            <div className="bg-[#050505] p-3 rounded-lg border border-white/5">
              <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-0.5">Total Trades</span>
              <span className="text-base font-black text-white">
                {backtestResult.totalTrades}
              </span>
            </div>

            <div className="bg-[#050505] p-3 rounded-lg border border-white/5">
              <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-0.5">Wins / Losses</span>
              <span className="text-xs font-black text-neutral-300 block mt-0.5">
                <span className="text-emerald-400">{backtestResult.winningTrades}W</span> / <span className="text-rose-400">{backtestResult.losingTrades}L</span>
              </span>
            </div>

            <div className="bg-[#050505] p-3 rounded-lg border border-white/5">
              <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-0.5">Média Win/Loss</span>
              <span className="text-xs font-bold text-neutral-300 block mt-0.5">
                +{backtestResult.avgWinPct}% / -{backtestResult.avgLossPct}%
              </span>
            </div>

            <div className="bg-[#050505] p-3 rounded-lg border border-white/5">
              <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-0.5">Duração Média</span>
              <span className="text-xs font-bold text-white block mt-0.5">
                {backtestResult.avgDurationMinutes} min
              </span>
            </div>
          </div>

          {/* Equity Curve SVG Chart */}
          {backtestResult.equityCurve && backtestResult.equityCurve.length > 1 && (
            <div className="bg-[#050505] p-4 rounded-lg border border-white/5 space-y-2">
              <span className="text-[10px] text-neutral-400 font-bold uppercase block flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                Simulação da Curva de Capital (Equity Curve)
              </span>

              <div className="h-36 w-full relative pt-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.05)" strokeDasharray="2" />
                  <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.05)" strokeDasharray="2" />
                  <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.05)" strokeDasharray="2" />

                  {(() => {
                    const curve = backtestResult.equityCurve;
                    const minB = Math.min(...curve.map(c => c.balance));
                    const maxB = Math.max(...curve.map(c => c.balance));
                    const range = Math.max(1, maxB - minB);

                    const points = curve.map((c, idx) => {
                      const x = (idx / (curve.length - 1)) * 100;
                      const y = 100 - ((c.balance - minB) / range) * 80 - 10;
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2"
                          points={points}
                        />
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>
          )}

          {/* Diagnostic & Suggestions Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths & Weaknesses */}
            <div className="bg-[#050505] p-4 rounded-lg border border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Award className="h-4 w-4 text-emerald-400" />
                Pontos Fortes & Diagnóstico
              </h4>

              <div className="space-y-1.5">
                {backtestResult.diagnostic.strengths.map((s, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[11px] text-emerald-400 bg-emerald-500/5 p-2 rounded border border-emerald-500/10">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>{s}</span>
                  </div>
                ))}

                {backtestResult.diagnostic.weaknesses.map((w, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[11px] text-rose-400 bg-rose-500/5 p-2 rounded border border-rose-500/10">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Suggestions */}
            <div className="bg-[#050505] p-4 rounded-lg border border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Target className="h-4 w-4 text-orange-400" />
                Recomendações e Próximos Passos
              </h4>

              <div className="space-y-1.5">
                {backtestResult.diagnostic.suggestions.map((sug, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[11px] text-orange-300 bg-orange-500/5 p-2 rounded border border-orange-500/10">
                    <ArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-orange-400" />
                    <span>{sug}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded text-xs leading-relaxed">
            <strong className="block mb-0.5">Integração com Raciocínio IA do Bot:</strong>
            Estes parâmetros validados ({backtestResult.winRate}% de acerto em {backtestResult.totalTrades} operações) foram salvos na base do sistema. O módulo de Inteligência Artificial utiliza esses resultados históricos para fundamentar e aprovar sinais ao vivo no Dashboard.
          </div>

        </div>
      )}
    </div>
  );
};
