import React, { useState } from 'react';
import { Bot, Zap, Activity, RefreshCw, Sliders, LineChart, BrainCircuit, ShieldAlert, Wifi, BarChart2, Cpu, Database, Menu, X, ChevronRight } from 'lucide-react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const topTickers = (tickers || []).slice(0, 6);

  const navItems = [
    { id: 'dashboard', label: 'Tickers', icon: Activity, badge: null },
    { id: 'signals', label: 'Sinais', icon: Zap, badge: botState.signalsGenerated24h },
    { id: 'ai_motor', label: 'Motor IA', icon: BrainCircuit, badge: null },
    { id: 'chart', label: 'Gráfico & Fibo', icon: LineChart, badge: null },
    { id: 'backtest', label: 'Backtest', icon: Database, badge: null },
    { id: 'ai_models_config', label: 'Modelos IA', icon: Cpu, badge: null },
    { id: 'ai_dashboard', label: 'IA Dash', icon: BarChart2, badge: null, highlight: true },
    { id: 'settings', label: 'Pesos', icon: Sliders, badge: null },
    { id: 'binance_logs', label: 'Logs API', icon: Wifi, badge: null },
  ];

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-[#0A0A0A] border-b border-white/10 text-neutral-100 sticky top-0 z-50">
      {/* Top Ticker Tape */}
      <div className="bg-[#050505] px-3 sm:px-4 py-1 border-b border-white/5 text-xs overflow-x-auto flex items-center justify-between gap-4 sm:gap-6 whitespace-nowrap scrollbar-none font-mono">
        <div className="flex items-center gap-3 sm:gap-5">
          <div
            onClick={() => handleSelectTab('binance_logs')}
            className="flex items-center gap-1.5 font-bold text-emerald-400 uppercase tracking-wider text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition shrink-0"
            title="Clique para ver Status e Logs de Conexão com Binance"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            BINANCE LIVE / LOGS
          </div>

          <div
            onClick={() => handleSelectTab('ai_motor')}
            className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded border cursor-pointer transition shrink-0 ${
              botState.aiAnalysisEnabled
                ? 'text-orange-400 bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20'
                : 'text-rose-400 bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20'
            }`}
            title="Clique para gerenciar o Motor de IA"
          >
            <span>AI:</span>
            <span>{botState.aiAnalysisEnabled ? 'GEMINI 3.6 FLASH (ON)' : 'INDICADORES (IA OFF)'}</span>
          </div>

          <div className="flex items-center gap-4 text-neutral-300 text-[11px]">
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

        <div className="hidden sm:flex items-center gap-4 text-neutral-400 text-[10px]">
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
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 cursor-pointer min-w-0" onClick={() => handleSelectTab('dashboard')}>
          <div className="h-9 w-9 shrink-0 rounded-lg bg-orange-500 flex items-center justify-center font-extrabold text-black font-mono text-sm tracking-tighter shadow-md shadow-orange-500/20 border border-orange-400">
            MS
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs sm:text-base font-extrabold tracking-tight text-white font-mono uppercase truncate">
                Market Signals <span className="text-orange-500">SuperBot</span>
              </h1>
              <span className="hidden xs:inline-block px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono shrink-0">
                HIGH DENSITY
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-neutral-400 font-mono truncate hidden xs:block">Order Flow • Delta CVD • Open Interest • Fibo Golden Pocket</p>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-[#050505] p-1 rounded-lg border border-white/10 overflow-x-auto scrollbar-none">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all font-mono whitespace-nowrap ${
                  isActive
                    ? item.highlight ? 'bg-cyan-500 text-black shadow font-bold' : 'bg-orange-500 text-black shadow font-bold'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
                {item.badge !== null && (
                  <span className={`text-[9px] px-1 rounded font-bold ${isActive ? 'bg-black/30 text-black' : 'bg-orange-500/20 text-orange-400'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Action Controls & Mobile Menu Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={onToggleBot}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all border font-mono ${
              botState.isMonitoring
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${botState.isMonitoring ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="hidden xs:inline">{botState.isMonitoring ? 'ROBÔ ATIVO' : 'PAUSADO'}</span>
            <span className="xs:hidden">{botState.isMonitoring ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded bg-neutral-900 border border-white/10 text-neutral-300 hover:bg-neutral-800 hover:text-white transition"
            title="Forçar Atualização"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {/* Mobile Menu Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1.5 rounded bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition ml-1"
            aria-label="Abrir Menu Principal"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Horizontal Quick-Nav Scroll Bar */}
      <div className="md:hidden bg-[#050505] px-3 py-1.5 border-t border-white/5 overflow-x-auto flex items-center gap-1.5 scrollbar-none font-mono">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap shrink-0 border ${
                isActive
                  ? 'bg-orange-500 text-black border-orange-400 shadow-md shadow-orange-500/20'
                  : 'bg-[#0A0A0A] text-neutral-400 border-white/5 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
              {item.badge !== null && (
                <span className={`text-[9px] px-1 rounded font-black ${isActive ? 'bg-black/30 text-black' : 'bg-orange-500/20 text-orange-400'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mobile Drawer Navigation Menu Modal Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 top-24 z-50 bg-black/80 backdrop-blur-sm md:hidden flex flex-col animate-fade-in">
          <div className="bg-[#0A0A0A] border-b border-white/10 p-4 space-y-3 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-bold font-mono text-orange-400 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="h-4 w-4" />
                Navegação Completa do Bot
              </span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 font-mono">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`flex items-center justify-between p-3 rounded-lg text-xs font-bold transition-all border min-h-[44px] ${
                      isActive
                        ? 'bg-orange-500/15 text-orange-400 border-orange-500/40'
                        : 'bg-[#050505] text-neutral-300 border-white/5 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded ${isActive ? 'bg-orange-500 text-black' : 'bg-white/5 text-neutral-400'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.badge !== null && (
                        <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded font-black">
                          {item.badge} sinais
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-neutral-500" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-md border-t border-white/10 md:hidden flex items-center justify-around py-1.5 px-2 font-mono">
        <button
          onClick={() => handleSelectTab('dashboard')}
          className={`flex flex-col items-center gap-1 p-1 rounded transition-all min-w-[56px] ${
            activeTab === 'dashboard' ? 'text-orange-400 font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Activity className="h-5 w-5" />
          <span className="text-[9px]">Tickers</span>
        </button>

        <button
          onClick={() => handleSelectTab('signals')}
          className={`flex flex-col items-center gap-1 p-1 rounded transition-all min-w-[56px] relative ${
            activeTab === 'signals' ? 'text-orange-400 font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Zap className="h-5 w-5" />
          <span className="text-[9px]">Sinais</span>
          {botState.signalsGenerated24h > 0 && (
            <span className="absolute top-0 right-2 h-2 w-2 rounded-full bg-orange-500 animate-ping" />
          )}
        </button>

        <button
          onClick={() => handleSelectTab('ai_motor')}
          className={`flex flex-col items-center gap-1 p-1 rounded transition-all min-w-[56px] ${
            activeTab === 'ai_motor' ? 'text-orange-400 font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <BrainCircuit className="h-5 w-5" />
          <span className="text-[9px]">Motor IA</span>
        </button>

        <button
          onClick={() => handleSelectTab('chart')}
          className={`flex flex-col items-center gap-1 p-1 rounded transition-all min-w-[56px] ${
            activeTab === 'chart' ? 'text-orange-400 font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <LineChart className="h-5 w-5" />
          <span className="text-[9px]">Gráfico</span>
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`flex flex-col items-center gap-1 p-1 rounded transition-all min-w-[56px] ${
            isMobileMenuOpen ? 'text-orange-400 font-bold' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Menu className="h-5 w-5" />
          <span className="text-[9px]">Mais</span>
        </button>
      </nav>
    </header>
  );
};

