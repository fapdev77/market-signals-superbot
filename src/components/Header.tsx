import React from 'react';
import { Bot, Zap, Activity, RefreshCw, Sliders, LineChart, BrainCircuit, ShieldAlert, Wifi, BarChart2, Cpu, Database } from 'lucide-react';
import { BotState, TickerData } from '../types';

interface HeaderProps {
  botState: BotState;
  tickers: TickerData[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onToggleBot: () => void;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  botState,
  tickers,
  activeTab,
  setActiveTab,
  onToggleBot,
  onRefresh
}) => {
  const topTickers = (tickers || []).slice(0, 6);

  return (
    <header className="bg-[#0A0A0A] border-b border-white/10 text-neutral-100 sticky top-0 z-50">
      {/* Top Ticker Tape */}
      <div className="bg-[#050505] px-4 py-1 border-b border-white/5 text-xs overflow-x-auto flex items-center justify-between gap-6 whitespace-nowrap scrollbar-none font-mono">
        <div className="flex items-center gap-5">
          <div
            onClick={() => setActiveTab('binance_logs')}
            className="flex items-center gap-1.5 font-bold text-emerald-400 uppercase tracking-wider text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition"
            title="Clique para ver Status e Logs de Conexão com Binance"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            BINANCE LIVE / LOGS
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
            <span>AI ENGINE:</span>
            <span className="text-orange-400">GEMINI 3.6 FLASH</span>
          </div>

          <div className="flex items-center gap-5 text-neutral-300 text-[11px]">
            {topTickers.map(t => (
              <div key={t.symbol} className="flex items-center gap-1.5">
                <span className="font-bold text-neutral-200">{t.symbol}</span>
                <span className="text-neutral-300">${(t.price ?? 0) >= 1000 ? (t.price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 1 }) : (t.price ?? 0).toFixed((t.price ?? 0) < 1 ? 4 : 2)}</span>
                <span className={`text-[10px] font-bold ${(t.priceChangePercent24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(t.priceChangePercent24h ?? 0) >= 0 ? '+' : ''}{(t.priceChangePercent24h ?? 0).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-neutral-400 text-[10px]">
          <span>VOL 24H: <strong className="text-neutral-200">$48.2B</strong></span>
          <span>•</span>
          <span>BTC DOM: <strong className="text-orange-400">58.4%</strong></span>
          <span>•</span>
          <span>OPEN INTEREST: <strong className="text-orange-400">$14.8B</strong></span>
          <span>•</span>
          <span>TICKS: <strong className="text-neutral-200">{botState.ticksProcessed}</strong></span>
        </div>
      </div>

      {/* Main Navigation & Brand Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="h-9 w-9 rounded-lg bg-orange-500 flex items-center justify-center font-extrabold text-black font-mono text-sm tracking-tighter shadow-md shadow-orange-500/20 border border-orange-400">
            MS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white font-mono uppercase">
                Market Signals <span className="text-orange-500">SuperBot</span>
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono">
                HIGH DENSITY
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 font-mono">Order Flow • Delta CVD • Open Interest • Fibo Golden Pocket</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-[#050505] p-1 rounded-lg border border-white/10 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('backtest')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all font-mono ${
              activeTab === 'backtest'
                ? 'bg-orange-500 text-black shadow'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            Backtest
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all font-mono ${
              activeTab === 'dashboard'
                ? 'bg-orange-500 text-black shadow'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Tickers
          </button>

          <button
            onClick={() => setActiveTab('signals')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all font-mono ${
              activeTab === 'signals'
                ? 'bg-orange-500 text-black shadow'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Sinais ({botState.signalsGenerated24h})
          </button>

          <button
            onClick={() => setActiveTab('ai_motor')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all font-mono ${
              activeTab === 'ai_motor'
                ? 'bg-orange-500 text-black shadow'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            Motor IA
          </button>

          <button
            onClick={() => setActiveTab('ai_models_config')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all font-mono ${
              activeTab === 'ai_models_config'
                ? 'bg-orange-500 text-black shadow'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            Modelos IA
          </button>
          
          <button
            onClick={() => setActiveTab('ai_dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all font-mono ${
              activeTab === 'ai_dashboard'
                ? 'bg-cyan-500 text-black shadow'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            IA Dash
          </button>

          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all font-mono ${
              activeTab === 'chart'
                ? 'bg-orange-500 text-black shadow'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <LineChart className="h-3.5 w-3.5" />
            Gráfico & Fibo
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all font-mono ${
              activeTab === 'settings'
                ? 'bg-orange-500 text-black shadow'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Pesos
          </button>

          <button
            onClick={() => setActiveTab('binance_logs')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all font-mono ${
              activeTab === 'binance_logs'
                ? 'bg-orange-500 text-black shadow'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <Wifi className="h-3.5 w-3.5" />
            Logs API
          </button>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleBot}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all border font-mono ${
              botState.isMonitoring
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${botState.isMonitoring ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {botState.isMonitoring ? 'ROBÔ ATIVO' : 'PAUSADO'}
          </button>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded bg-neutral-900 border border-white/10 text-neutral-300 hover:bg-neutral-800 hover:text-white transition"
            title="Forçar Atualização"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
