import React, { useState, useEffect } from 'react';
import { Bot, Zap, Activity, RefreshCw, Sliders, LineChart, BrainCircuit, ShieldAlert, Wifi, BarChart2, Cpu, Database, Menu, X, ChevronRight, Volume2, VolumeX, Bell, BellOff } from 'lucide-react';
import { BotState, TickerData } from '../types';
import { formatPrice, formatPercent } from '../utils/formatters';
import { isAudioEnabled, setAudioEnabled, requestNotificationPermission, isNotificationEnabled, setNotificationEnabled, sendDesktopNotification, playSignalTone } from '../utils/soundAlerts';
import { Tooltip } from './Tooltip';
import { useToast } from './Toast';

interface HeaderProps {
  botState: BotState;
  tickers: TickerData[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onToggleBot: () => void;
  onRefresh: () => void | Promise<void>;
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
  const [soundOn, setSoundOn] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setSoundOn(isAudioEnabled());
    setNotifEnabled(isNotificationEnabled());
  }, []);

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setAudioEnabled(next);
    if (next) {
      playSignalTone('ALERT');
      showToast('info', 'Alertas Sonoros Ativados', 'Sintetizador Web Audio ativado para novos sinais de LONG e SHORT.');
    } else {
      showToast('info', 'Alertas Sonoros Silenciados', 'O sintetizador de áudio foi desativado.');
    }
  };

  const handleToggleNotif = async () => {
    if (notifEnabled) {
      // Turn off
      setNotificationEnabled(false);
      setNotifEnabled(false);
      showToast('info', 'Notificações Desativadas', 'Alertas em segundo plano foram silenciados.');
    } else {
      // Turn on
      const granted = await requestNotificationPermission();
      setNotificationEnabled(true);
      setNotifEnabled(true);
      if (granted) {
        showToast('success', 'Notificações Desktop Ativadas', 'Você receberá alertas automáticos quando novos sinais forem gerados.');
        sendDesktopNotification('Market Signals SuperBot', 'Notificações desktop ativadas com sucesso!');
        if (soundOn) playSignalTone('ALERT');
      } else {
        showToast('info', 'Notificações no App Ativadas', 'Alertas visuais e sonoros em tempo real ativados no aplicativo.');
        if (soundOn) playSignalTone('ALERT');
      }
    }
  };

  const handleRefreshClick = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
      if (soundOn) {
        playSignalTone('ALERT');
      }
      showToast('success', 'Mercado Sincronizado', 'Cotações Binance, confluências e sinais atualizados com sucesso.');
    } catch (err) {
      showToast('error', 'Falha na Sincronização', 'Não foi possível buscar dados mais recentes da Binance.');
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  };

  const topTickers = (tickers || []).slice(0, 6);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Tickers',
      icon: Activity,
      badge: null,
      desc: 'Grid de pares de cripto futures e ativos tradicionais com variações, volume e métricas.'
    },
    {
      id: 'signals',
      label: 'Sinais',
      icon: Zap,
      badge: botState.signalsGenerated24h,
      desc: 'Matriz com sinais validados de entrada, stop loss, take profit e confluências de Order Flow.'
    },
    {
      id: 'ai_motor',
      label: 'Motor IA',
      icon: BrainCircuit,
      badge: null,
      desc: 'Auditoria de gráficos por IA, chat interativo de análise quantitativa e personas de trading.'
    },
    {
      id: 'chart',
      label: 'Análise Detalhada',
      icon: LineChart,
      badge: null,
      desc: 'Gráfico interativo com Volume Profile (VAH/VAL/POC), Heatmap de Liquidez e níveis Fibonacci.'
    },
    {
      id: 'backtest',
      label: 'Backtest',
      icon: Database,
      badge: null,
      desc: 'Simulação estatística com Sharpe, Sortino, Drawdown, taxas, slippage e exportação CSV.'
    },
    {
      id: 'ai_models_config',
      label: 'Modelos IA',
      icon: Cpu,
      badge: null,
      desc: 'Configuração de prioridade, chave de API, teste de latência e contingência (fallback) dos LLMs.'
    },
    {
      id: 'ai_dashboard',
      label: 'IA Dash',
      icon: BarChart2,
      badge: null,
      highlight: true,
      desc: 'Telemetria de chamadas de IA, métricas de custo, tempo de resposta e taxa de acertos.'
    },
    {
      id: 'settings',
      label: 'Pesos',
      icon: Sliders,
      badge: null,
      desc: 'Ajuste de pesos para confluência de Delta CVD, Open Interest, Funding Rate e Otimizador Genético.'
    },
    {
      id: 'binance_logs',
      label: 'Logs API & IA',
      icon: Wifi,
      badge: null,
      desc: 'Monitor de conexão WebSocket em tempo real, latência de pacotes e stream de eventos.'
    },
  ];

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const activeModels = (botState.aiModels || []).filter(m => m.isActive).sort((a, b) => a.priority - b.priority);
  const activeModelLabel = activeModels.length > 0
    ? `${activeModels[0].name.toUpperCase()}${activeModels.length > 1 ? ` (+${activeModels.length - 1} FB)` : ''}`
    : 'NENHUM MODELO ATIVO';

  return (
    <header className="bg-[#0A0A0A] border-b border-white/10 text-neutral-100 sticky top-0 z-50">
      {/* Top Ticker Tape */}
      <div className="bg-[#050505] px-3 sm:px-4 py-1 border-b border-white/5 text-xs overflow-x-auto flex items-center justify-between gap-4 sm:gap-6 whitespace-nowrap scrollbar-none font-mono">
        <div className="flex items-center gap-3 sm:gap-5">
          <Tooltip
            position="bottom"
            title="Telemetria & Logs Binance"
            badge="WEBSOCKET"
            content="Clique para inspecionar a conexão com os endpoints da Binance Futures, latência do stream em tempo real e telemetria de chamadas de IA."
          >
            <div
              onClick={() => handleSelectTab('binance_logs')}
              className="flex items-center gap-1.5 font-bold text-emerald-400 uppercase tracking-wider text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition shrink-0"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              BINANCE & IA LOGS
            </div>
          </Tooltip>

          <Tooltip
            position="bottom"
            title="Motor de Inteligência Artificial"
            badge={botState.aiAnalysisEnabled ? 'ATIVO' : 'DESLIGADO'}
            content={
              botState.aiAnalysisEnabled
                ? `Modelo primário: ${activeModelLabel}. Análise contínua com verificação de contexto e fallback de contingência caso ocorra timeout.`
                : 'Motor de IA pausado. O bot está operando exclusivamente pela confluência matemática de indicadores (CVD, OI, Funding e Fibo).'
            }
          >
            <div
              onClick={() => handleSelectTab('ai_motor')}
              className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded border cursor-pointer transition shrink-0 ${
                botState.aiAnalysisEnabled
                  ? 'text-orange-400 bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20'
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20'
              }`}
            >
              <span>AI:</span>
              <span>{botState.aiAnalysisEnabled ? `${activeModelLabel} (ON)` : 'INDICADORES (IA OFF)'}</span>
            </div>
          </Tooltip>

          <div className="flex items-center gap-4 text-neutral-300 text-[11px]">
            {topTickers.map(t => (
              <Tooltip
                key={t.symbol}
                position="bottom"
                title={`${t.name || t.symbol} (${t.marketType === 'tradfi' ? 'TradFi' : 'Futures'})`}
                badge={`${t.confluenceScore}% Confluência`}
                content={`Preço: ${formatPrice(t.price, { currency: true })} • Variação 24h: ${formatPercent(t.priceChangePercent24h)} • CVD: ${t.cvdDirection} • Bias de Funding: ${t.fundingRateAnalysis.bias}`}
              >
                <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition">
                  <span className="font-bold text-neutral-200">{t.symbol}</span>
                  <span className="text-neutral-300">{formatPrice(t.price, { currency: true })}</span>
                  <span className={`text-[10px] font-bold ${(t.priceChangePercent24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatPercent(t.priceChangePercent24h)}
                  </span>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-neutral-400 text-[10px]">
          <Tooltip
            position="bottom"
            title="Volume Global 24h"
            badge="MERCADO"
            content="Volume financeiro transacionado somado nos pares de derivativos perpétuos de cripto nas últimas 24 horas."
          >
            <span className="cursor-help">VOL 24H: <strong className="text-neutral-200">$48.2B</strong></span>
          </Tooltip>
          <span>•</span>
          <Tooltip
            position="bottom"
            title="Dominância do Bitcoin"
            badge="BTC.D"
            content="Participação percentual do Bitcoin sobre o valor de mercado total de criptoativos, indicando rotação entre BTC e altcoins."
          >
            <span className="cursor-help">BTC DOM: <strong className="text-orange-400">58.4%</strong></span>
          </Tooltip>
          <span>•</span>
          <Tooltip
            position="bottom"
            title="Open Interest (Contratos em Aberto)"
            badge="DERIVATIVOS"
            content="Montante nocional de posições alavancadas ativas abertas no mercado futuro. Expansões rápidas sinalizam potencial de squeeze."
          >
            <span className="cursor-help">OPEN INTEREST: <strong className="text-orange-400">$14.8B</strong></span>
          </Tooltip>
          <span>•</span>
          <Tooltip
            position="bottom"
            title="Ticks de Mercado Processados"
            badge="MOTOR QUANT"
            content="Total de ciclos de cotações, books e cálculos de confluência executados pelo servidor desde a inicialização."
          >
            <span className="cursor-help">TICKS: <strong className="text-neutral-200">{botState.ticksProcessed}</strong></span>
          </Tooltip>
        </div>
      </div>

      {/* Main Navigation & Brand Header */}
      <div className="max-w-[2400px] mx-auto px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-2">
        <Tooltip
          position="bottom"
          title="Market Signals SuperBot"
          badge="QUANT TRADING"
          content="Painel analítico e robô de confluência algorítmica para cripto futuros e ativos TradFi com Order Flow e IA."
        >
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
        </Tooltip>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-[#050505] p-1 rounded-lg border border-white/10 overflow-x-auto scrollbar-none">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <Tooltip
                key={item.id}
                position="bottom"
                title={item.label}
                badge={item.badge !== null ? `${item.badge} sinais` : undefined}
                content={item.desc}
              >
                <button
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
              </Tooltip>
            );
          })}
        </nav>

        {/* Action Controls & Mobile Menu Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Bot Monitoring Toggle */}
          <Tooltip
            position="bottom-right"
            title={`Robô de Monitoramento: ${botState.isMonitoring ? 'ATIVO' : 'PAUSADO'}`}
            badge={botState.isMonitoring ? 'ONLINE' : 'OFFLINE'}
            content={
              botState.isMonitoring
                ? 'O robô está processando ticks continuamente, calculando confluências de Order Flow e validando novos sinais a cada 4 segundos. Clique para pausar.'
                : 'O monitoramento está pausado. O motor não gerará novos sinais ou atualizará ordens automáticas até que você o religue. Clique para ativar.'
            }
          >
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
          </Tooltip>

          {/* Refresh Action */}
          <Tooltip
            position="bottom-right"
            title="Sincronizar Dados do Mercado"
            badge="MANUAL"
            content="Força uma nova leitura das cotações da Binance, recalcula os níveis de confluência dos pares e sincroniza a telemetria do robô."
          >
            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="p-1.5 rounded bg-neutral-900 border border-white/10 text-neutral-300 hover:bg-neutral-800 hover:text-white transition disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-orange-400' : ''}`} />
            </button>
          </Tooltip>

          {/* Sound Tone Toggle */}
          <Tooltip
            position="bottom-right"
            title={`Alertas Sonoros: ${soundOn ? 'LIGADOS' : 'DESLIGADOS'}`}
            badge={soundOn ? 'WEB AUDIO' : 'MUTE'}
            content={
              soundOn
                ? 'Sons ativados. O sintetizador melódico Web Audio tocará um acorde ascendente para LONG, descendente para SHORT e bips para alertas. Clique para mutar.'
                : 'Sons desativados. Nenhum áudio será emitido quando surgirem novos sinais de entrada. Clique para ativar.'
            }
          >
            <button
              onClick={handleToggleSound}
              className={`p-1.5 rounded border transition ${
                soundOn 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' 
                  : 'bg-neutral-900 border-white/10 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
          </Tooltip>

          {/* Push Notification Toggle */}
          <Tooltip
            position="bottom-right"
            title={`Notificações Desktop: ${notifEnabled ? 'ATIVADAS' : 'DESATIVADAS'}`}
            badge={notifEnabled ? 'ALERTAS ON' : 'SILENCIADO'}
            content={
              notifEnabled
                ? 'Notificações ativadas. Você receberá avisos do navegador ou do sistema operacional quando confluências fortes forem identificadas. Clique para desativar.'
                : 'Notificações desativadas. Clique para habilitar e ser notificado sobre sinais e rompimentos mesmo navegando em outra janela.'
            }
          >
            <button
              onClick={handleToggleNotif}
              className={`p-1.5 rounded border transition hidden sm:flex items-center justify-center ${
                notifEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-neutral-900 border-white/10 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {notifEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
            </button>
          </Tooltip>

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

            {/* Quick Actions in Mobile Drawer */}
            <div className="grid grid-cols-2 gap-2 pb-2 border-b border-white/10 font-mono">
              <button
                onClick={handleToggleSound}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition ${
                  soundOn
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-neutral-900 border-white/10 text-neutral-400'
                }`}
              >
                {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                <span>{soundOn ? 'Sons: ON' : 'Sons: OFF'}</span>
              </button>

              <button
                onClick={handleToggleNotif}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition ${
                  notifEnabled
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-neutral-900 border-white/10 text-neutral-400'
                }`}
              >
                {notifEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                <span>{notifEnabled ? 'Notif: ON' : 'Notif: OFF'}</span>
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
                      <div className="text-left">
                        <div className="text-sm font-bold">{item.label}</div>
                        <div className="text-[10px] text-neutral-400 font-normal">{item.desc}</div>
                      </div>
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


