import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Zap, Activity, RefreshCw, Sliders, LineChart, BrainCircuit, 
  ShieldAlert, Wifi, BarChart2, Cpu, Database, Menu, X, ChevronRight, 
  ChevronDown, Volume2, VolumeX, Bell, BellOff, Radar, Flame, Command, 
  Sparkles, Search, Sun, Moon, Check, Layers, BarChart3, Radio, Target,
  MoreVertical, SlidersHorizontal, PieChart
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
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
  onOpenCommandPalette?: () => void;
  onOpenAutoTune?: () => void;
}

interface NavSubItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge: string | number | null;
  highlight?: boolean;
  desc: string;
  shortcut?: string;
}

interface NavCategory {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  desc: string;
  items: NavSubItem[];
  badge?: string | number | null;
}

export const Header: React.FC<HeaderProps> = ({
  botState,
  tickers,
  activeTab,
  setActiveTab,
  onToggleBot,
  onRefresh,
  onOpenCommandPalette,
  onOpenAutoTune
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [networkPing, setNetworkPing] = useState<number>(14);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    // Simulate slight natural ping variation 12-24ms
    const interval = setInterval(() => {
      setNetworkPing(12 + Math.floor(Math.random() * 14));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setSoundOn(isAudioEnabled());
    setNotifEnabled(isNotificationEnabled());
  }, []);

  // Close dropdown on outside click or ESC key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) {
        setIsQuickActionsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdownId(null);
        setIsMobileMenuOpen(false);
        setIsQuickActionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
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

  // Categorized Navigation Structure (Option 1)
  const navCategories: NavCategory[] = [
    {
      id: 'market_group',
      label: 'Mercado & Screeners',
      shortLabel: 'Mercado',
      icon: Activity,
      desc: 'Catálogo de ativos, visualização em mapa de calor e rastreadores de fluxo.',
      items: [
        {
          id: 'dashboard',
          label: 'Grid de Tickers',
          icon: Activity,
          badge: null,
          desc: 'Grid de pares de cripto futures e ativos tradicionais com variações, volume e métricas.'
        },
        {
          id: 'heatmap',
          label: 'Heatmap Global',
          icon: Flame,
          badge: 'D3',
          highlight: true,
          desc: 'Mapa de calor global D3 por volume 24h e desvio da média móvel 24h (MA24h).'
        },
        {
          id: 'volume_screener',
          label: 'Volume Screener',
          icon: BarChart3,
          badge: 'SPIKE',
          highlight: true,
          desc: 'Smart Volume Screener: Identifica picos anômalos de volume relativo (R-Vol) e fluxo taker institucional.'
        },
        {
          id: 'sector_screener',
          label: 'Screener de Setores & Rotação',
          icon: PieChart,
          badge: 'ALPHA',
          highlight: true,
          desc: 'Agregação setorial (L1/L2, DeFi, IA, Memes, DePIN, RWA) e fluxo de rotação de capital vs BTC.'
        },
        {
          id: 'screener',
          label: 'Radar Screener Pro',
          icon: Radar,
          badge: 'PRO',
          highlight: true,
          desc: 'Universo dinâmico: Top Momentum, favoritos (★), expansão de Open Interest e RVOL.'
        }
      ]
    },
    {
      id: 'trading_group',
      label: 'Operacional & Sinais',
      shortLabel: 'Sinais & Análise',
      icon: Zap,
      badge: botState.signalsGenerated24h > 0 ? botState.signalsGenerated24h : null,
      desc: 'Sinais de confluência algorítmica, gráficos com Volume Profile e gestão de risco.',
      items: [
        {
          id: 'signals',
          label: 'Sinais & Confluências',
          icon: Zap,
          badge: botState.signalsGenerated24h > 0 ? `${botState.signalsGenerated24h} sinais` : null,
          highlight: true,
          desc: 'Matriz com sinais validados de entrada, stop loss, take profit e confluências de Order Flow.'
        },
        {
          id: 'chart',
          label: 'Análise Detalhada (Gráfico)',
          icon: LineChart,
          badge: 'PRO',
          desc: 'Gráfico interativo com Volume Profile (VAH/VAL/POC), Heatmap de Liquidez e níveis Fibonacci.'
        },
        {
          id: 'risk',
          label: 'Exposição & Gregas (Risco)',
          icon: ShieldAlert,
          badge: 'RISK',
          highlight: true,
          desc: 'Dashboard de exposição de risco da carteira: Delta Líquido, Gamma, VaR, stress test e concentração setorial.'
        },
        {
          id: 'counter_radar',
          label: 'Contra-Trade Radar (TTI)',
          icon: Target,
          badge: 'INSTITUCIONAL',
          highlight: true,
          desc: 'Radar de Traders Presos: Net Longs/Shorts, Índice TTI Wyckoff, Absorção CVD, Smart Money Divergence e sinalização de Fade & Short Squeeze.'
        }
      ]
    },
    {
      id: 'ai_group',
      label: 'Inteligência Artificial',
      shortLabel: 'Motor IA',
      icon: BrainCircuit,
      desc: 'Auditoria de gráficos por IA, chat quantitativo, personas e telemetria de LLMs.',
      items: [
        {
          id: 'ai_motor',
          label: 'Motor IA & Chat',
          icon: BrainCircuit,
          badge: botState.aiAnalysisEnabled ? 'ON' : 'OFF',
          desc: 'Auditoria de gráficos por IA, chat interativo de análise quantitativa e personas de trading.'
        },
        {
          id: 'ai_models_config',
          label: 'Modelos LLM & Contingência',
          icon: Cpu,
          badge: null,
          desc: 'Configuração de prioridade, chave de API, teste de latência e contingência (fallback) dos LLMs.'
        },
        {
          id: 'ai_dashboard',
          label: 'IA Telemetria & Custos',
          icon: BarChart2,
          badge: null,
          highlight: true,
          desc: 'Telemetria de chamadas de IA, métricas de custo, tempo de resposta e taxa de acertos.'
        }
      ]
    },
    {
      id: 'system_group',
      label: 'Quant & Sistema',
      shortLabel: 'Quant & Config',
      icon: Sliders,
      desc: 'Backtest estatístico, pesos algorítmicos e monitor de conexão WebSocket.',
      items: [
        {
          id: 'backtest',
          label: 'Backtest Quantitativo',
          icon: Database,
          badge: null,
          desc: 'Simulação estatística com Sharpe, Sortino, Drawdown, taxas, slippage e exportação CSV.'
        },
        {
          id: 'settings',
          label: 'Pesos & Otimizador',
          icon: Sliders,
          badge: null,
          desc: 'Ajuste de pesos para confluência de Delta CVD, Open Interest, Funding Rate e Otimizador Genético.'
        },
        {
          id: 'binance_logs',
          label: 'Logs API & WebSocket',
          icon: Wifi,
          badge: `${networkPing}ms`,
          desc: 'Monitor de conexão WebSocket em tempo real, latência de pacotes e stream de eventos.'
        }
      ]
    }
  ];

  // Flattened nav items for mobile and search reference
  const allNavItems: NavSubItem[] = navCategories.flatMap(c => c.items);

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setOpenDropdownId(null);
    setIsMobileMenuOpen(false);
  };

  const handleCategoryClick = (category: NavCategory) => {
    // If the category is already open, close it
    if (openDropdownId === category.id) {
      setOpenDropdownId(null);
      return;
    }
    // Open the dropdown for inspection
    setOpenDropdownId(category.id);
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

          <Tooltip
            position="bottom"
            title="Estratégia Quantitativa do Motor"
            badge={botState.weights?.multiStrategyMode !== false ? "MULTI-CONCORRENTE" : "ESTRATÉGIA ÚNICA"}
            content={
              botState.weights?.multiStrategyMode !== false
                ? `Motor Multi-Estratégia CONCORRENTE ATIVO! O robô avalia simultaneamente todas as estratégias habilitadas (${(botState.weights?.enabledStrategies || ['scalp', 'daytrade', 'intraday', 'swing', 'position']).map(s => s.toUpperCase()).join(', ')}) para cada par a cada tick, gerando oportunidades independentes em 5m, 15m, 30m, 1h e 4h.`
                : `Modo foco único: ${botState.weights?.strategyLabel || botState.weights?.activeStrategy?.toUpperCase() || 'INTRADAY'}. Clique para gerenciar ou ativar o modo multi-estratégia concorrente.`
            }
          >
            <div
              onClick={() => handleSelectTab('settings')}
              className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded border cursor-pointer transition shrink-0 text-cyan-400 bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/20"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
              </span>
              <span className="text-neutral-400">ESTRATÉGIAS:</span>
              <span className="text-white uppercase font-black">
                {botState.weights?.multiStrategyMode !== false 
                  ? `MULTI (${(botState.weights?.enabledStrategies || ['scalp', 'daytrade', 'intraday', 'swing', 'position']).length} ATIVAS)`
                  : (botState.weights?.activeStrategy || 'intraday')}
              </span>
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
      <div className="max-w-[2400px] mx-auto px-2 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-1.5 sm:gap-4 relative" ref={dropdownRef}>
        {/* Brand Logo & Name */}
        <Tooltip
          position="bottom"
          title="Market Signals SuperBot"
          badge="QUANT TRADING"
          content="Painel analítico e robô de confluência algorítmica para cripto futuros e ativos TradFi com Order Flow e IA."
        >
          <div className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer min-w-0 shrink-0" onClick={() => handleSelectTab('dashboard')}>
            <div className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-lg bg-orange-500 flex items-center justify-center font-extrabold text-black font-mono text-xs sm:text-sm tracking-tighter shadow-md shadow-orange-500/20 border border-orange-400">
              MS
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <h1 className="text-xs sm:text-base font-extrabold tracking-tight text-white font-mono uppercase truncate">
                  <span className="hidden sm:inline">Market Signals </span><span className="text-orange-500">SuperBot</span>
                </h1>
                <span className="hidden lg:inline-block px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono shrink-0">
                  HIGH DENSITY
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-neutral-400 font-mono truncate hidden xl:block">Order Flow • Delta CVD • Open Interest • Fibo Golden Pocket</p>
            </div>
          </div>
        </Tooltip>

        {/* Desktop Categorized Navigation (Option 1: Categorized Dropdown / Mega-Menu Clusters) */}
        <nav className="hidden md:flex items-center gap-1.5 bg-[#050505] p-1 rounded-xl border border-white/10 font-mono text-xs z-40">
          {navCategories.map(category => {
            const Icon = category.icon;
            const isCategoryActive = category.items.some(sub => sub.id === activeTab);
            const isDropdownOpen = openDropdownId === category.id;
            const activeSubItem = category.items.find(sub => sub.id === activeTab);

            return (
              <div 
                key={category.id} 
                className="relative"
                onMouseEnter={() => setOpenDropdownId(category.id)}
                onMouseLeave={() => setOpenDropdownId(null)}
              >
                {/* Master Category Button */}
                <button
                  type="button"
                  onClick={() => handleCategoryClick(category)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                    isCategoryActive
                      ? 'bg-orange-500/15 text-orange-300 border-orange-500/40 shadow-xs shadow-orange-500/10'
                      : isDropdownOpen
                        ? 'bg-neutral-800/80 text-white border-white/20'
                        : 'bg-transparent text-neutral-300 border-transparent hover:text-white hover:bg-white/5'
                  }`}
                  aria-expanded={isDropdownOpen}
                >
                  <Icon className={`h-3.5 w-3.5 ${isCategoryActive ? 'text-orange-400' : 'text-neutral-400'}`} />
                  
                  {/* Category Title or Active Subitem */}
                  <span>{category.shortLabel}</span>

                  {/* Active Sub-item Pill or Category Badge */}
                  {isCategoryActive && activeSubItem ? (
                    <span className="hidden xl:inline-block text-[10px] px-1.5 py-0.2 rounded font-black bg-orange-500 text-black shadow-xs">
                      {activeSubItem.label.split(' ')[0]}
                    </span>
                  ) : null}

                  {category.badge && !isCategoryActive && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      {category.badge}
                    </span>
                  )}

                  <ChevronDown className={`h-3 w-3 text-neutral-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-orange-400' : ''}`} />
                </button>

                {/* Dropdown Popover Card */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-72 sm:w-80 bg-[#0A0A0C] border border-white/15 rounded-xl shadow-2xl p-2 z-50 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Category Header */}
                    <div className="px-2.5 py-1.5 border-b border-white/10 mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-neutral-300 tracking-wider">
                        <Icon className="w-3.5 h-3.5 text-orange-400" />
                        <span>{category.label}</span>
                      </div>
                      <span className="text-[9px] text-neutral-500 font-mono">
                        {category.items.length} módulos
                      </span>
                    </div>

                    {/* Sub-items List */}
                    <div className="space-y-1">
                      {category.items.map(subItem => {
                        const SubIcon = subItem.icon;
                        const isSubActive = activeTab === subItem.id;

                        return (
                          <button
                            key={subItem.id}
                            type="button"
                            onClick={() => handleSelectTab(subItem.id)}
                            className={`w-full text-left p-2 rounded-lg transition flex items-start justify-between gap-2.5 border group ${
                              isSubActive
                                ? 'bg-orange-500/20 border-orange-500/50 text-white shadow-xs'
                                : 'bg-[#050507] border-white/5 hover:border-white/20 hover:bg-neutral-900/80 text-neutral-300 hover:text-white'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className={`p-1.5 rounded-md mt-0.5 shrink-0 ${
                                isSubActive 
                                  ? 'bg-orange-500 text-black' 
                                  : 'bg-white/5 text-neutral-400 group-hover:text-orange-400 group-hover:bg-orange-500/10'
                              }`}>
                                <SubIcon className="h-3.5 w-3.5" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-bold truncate ${isSubActive ? 'text-orange-300 font-black' : 'text-neutral-200'}`}>
                                    {subItem.label}
                                  </span>
                                  {isSubActive && (
                                    <Check className="w-3 h-3 text-orange-400 shrink-0" />
                                  )}
                                </div>
                                <p className="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed mt-0.5 font-sans">
                                  {subItem.desc}
                                </p>
                              </div>
                            </div>

                            {/* Badges */}
                            {subItem.badge !== null && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase shrink-0 border ${
                                isSubActive
                                  ? 'bg-orange-500 text-black border-orange-400'
                                  : 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                              }`}>
                                {subItem.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Action Controls & Mobile Menu Toggle */}
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
          {/* Universal Command Palette Trigger (Ctrl + K) - Visible on lg+ */}
          <Tooltip
            position="bottom-right"
            title="Paleta de Comandos Rápidos (Ctrl + K)"
            badge="SHORTCUT"
            content="Abre a busca universal instantânea para ativos, atalhos de abas e comandos operacionais do robô."
          >
            <button
              onClick={onOpenCommandPalette}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0D0E12] border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 hover:text-white transition font-mono text-xs cursor-pointer shadow-xs shadow-cyan-500/20"
            >
              <Search className="w-3.5 h-3.5 text-cyan-400" />
              <span className="inline font-bold">Comandos</span>
              <kbd className="hidden sm:inline-block px-1 py-0.2 rounded bg-black/60 border border-white/10 text-[9px] text-neutral-400 font-bold">
                ⌘K
              </kbd>
            </button>
          </Tooltip>

          {/* Strategy Auto-Tuning Trigger Button - Visible on xl+ */}
          <Tooltip
            position="bottom-right"
            title="Strategy Auto-Tuning Quantitativo"
            badge="SHARPE"
            content="Abre o otimizador genético para calibrar pesos de confluência e maximizar o Sharpe Ratio das operações."
          >
            <button
              onClick={onOpenAutoTune || (() => handleSelectTab('settings'))}
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-cyan-500/20 border border-amber-500/40 text-amber-300 hover:from-amber-500/30 hover:to-cyan-500/30 transition font-mono text-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="inline font-black">Auto-Tune</span>
            </button>
          </Tooltip>

          {/* Network Latency & WebSocket Health - Visible on 2xl+ */}
          <Tooltip
            position="bottom-right"
            title="Latência do WebSocket Binance"
            badge="PRO FEED"
            content={`Conexão de baixa latência ativa com feed Binance Futures. Ping estimado: ${networkPing}ms.`}
          >
            <div className="hidden 2xl:flex items-center gap-1 px-2 py-1.5 rounded-lg bg-neutral-900 border border-white/5 text-[10px] font-mono text-neutral-400 tabular-nums">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-white font-bold">{networkPing}ms</span>
            </div>
          </Tooltip>

          {/* Bot Monitoring Toggle - Always Visible, Ultra-compact on mobile */}
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
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border font-mono shrink-0 ${
                botState.isMonitoring
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${botState.isMonitoring ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="hidden sm:inline">{botState.isMonitoring ? 'ROBÔ ATIVO' : 'PAUSADO'}</span>
              <span className="sm:hidden text-[10.5px]">{botState.isMonitoring ? 'ON' : 'OFF'}</span>
            </button>
          </Tooltip>

          {/* Refresh Action - Always Visible */}
          <Tooltip
            position="bottom-right"
            title="Sincronizar Dados do Mercado"
            badge="MANUAL"
            content="Força uma nova leitura das cotações da Binance, recalcula os níveis de confluência dos pares e sincroniza a telemetria do robô."
          >
            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="p-1.5 sm:p-2 rounded-lg bg-neutral-900 border border-white/10 text-neutral-300 hover:bg-neutral-800 hover:text-white transition disabled:opacity-60 shrink-0"
              aria-label="Sincronizar Dados"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-orange-400' : ''}`} />
            </button>
          </Tooltip>

          {/* Sound Tone Toggle - Visible on sm+ */}
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
              className={`p-2 rounded-lg border transition hidden sm:flex items-center justify-center shrink-0 ${
                soundOn 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' 
                  : 'bg-neutral-900 border-white/10 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>
          </Tooltip>

          {/* Push Notification Toggle - Visible on sm+ */}
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
              className={`p-2 rounded-lg border transition hidden sm:flex items-center justify-center shrink-0 ${
                notifEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-neutral-900 border-white/10 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {notifEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
            </button>
          </Tooltip>

          {/* Theme Engine Switcher - Visible on sm+ */}
          <Tooltip
            position="bottom-right"
            title={`Tema do Terminal: ${theme === 'dark' ? 'INSTITUTIONAL DARK' : 'PRO LIGHT'}`}
            badge="TEMA UI"
            content={
              theme === 'dark'
                ? 'Modo Dark Institucional ativo com fundo OLED e alto contraste. Clique para alternar para o modo Pro Light diurno.'
                : 'Modo Pro Light diurno de alto contraste ativo para ambientes iluminados. Clique para alternar para Institutional Dark.'
            }
          >
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg border transition hidden sm:flex items-center justify-center shrink-0 ${
                theme === 'light'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-600 hover:bg-amber-500/30'
                  : 'bg-neutral-900 border-white/10 text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
              aria-label="Alternar Tema Visual"
            >
              {theme === 'light' ? (
                <Sun className="h-3.5 w-3.5 text-amber-500 animate-spin-slow" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-cyan-400" />
              )}
            </button>
          </Tooltip>

          {/* Mobile Quick Actions Dropdown / Popover - Only on Mobile (< sm) */}
          <div className="sm:hidden relative" ref={quickActionsRef}>
            <Tooltip
              position="bottom-right"
              title="Ações Rápidas & Configurações"
              badge="CONTROLES"
              content="Abre o menu compacto de ferramentas: tema, áudio, notificações, comandos e auto-tune."
            >
              <button
                onClick={() => setIsQuickActionsOpen(prev => !prev)}
                className={`p-1.5 rounded-lg border transition flex items-center justify-center shrink-0 ${
                  isQuickActionsOpen
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-sm shadow-orange-500/20'
                    : 'bg-neutral-900 border-white/10 text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
                aria-label="Ações Rápidas e Configurações"
                aria-expanded={isQuickActionsOpen}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </Tooltip>

            {/* Floating Dropdown Popover */}
            {isQuickActionsOpen && (
              <div 
                className={`absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl shadow-2xl p-3 z-50 text-xs font-mono space-y-2.5 border transition-all animate-in fade-in slide-in-from-top-2 duration-150 ${
                  theme === 'light'
                    ? 'bg-white border-slate-300 text-slate-900 shadow-slate-900/20'
                    : 'bg-[#0d1017] border-white/15 text-slate-100 shadow-black/80'
                }`}
              >
                {/* Popover Header */}
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-[11px] font-black uppercase text-orange-400 tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-orange-400" />
                    Ações Rápidas
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                    {networkPing}ms FEED
                  </span>
                </div>

                {/* Theme Switcher in Mobile Popover */}
                <button
                  onClick={() => {
                    toggleTheme();
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl border transition ${
                    theme === 'light'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 hover:bg-amber-500/20'
                      : 'bg-neutral-900/80 border-white/10 text-neutral-200 hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {theme === 'light' ? (
                      <Sun className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Moon className="w-4 h-4 text-cyan-400" />
                    )}
                    <span className="font-bold">Tema da Interface</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-black/20">
                    {theme === 'light' ? 'Diurno' : 'Dark OLED'}
                  </span>
                </button>

                {/* Audio & Notifications in 2 columns */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleToggleSound}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border transition ${
                      soundOn
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 font-bold'
                        : 'bg-neutral-900/80 border-white/10 text-neutral-400'
                    }`}
                  >
                    {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{soundOn ? 'Sons: ON' : 'Mudo'}</span>
                  </button>

                  <button
                    onClick={handleToggleNotif}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border transition ${
                      notifEnabled
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold'
                        : 'bg-neutral-900/80 border-white/10 text-neutral-400'
                    }`}
                  >
                    {notifEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                    <span>{notifEnabled ? 'Notif: ON' : 'Silencioso'}</span>
                  </button>
                </div>

                {/* Command Palette Trigger */}
                {onOpenCommandPalette && (
                  <button
                    onClick={() => {
                      setIsQuickActionsOpen(false);
                      onOpenCommandPalette();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition font-bold"
                  >
                    <div className="flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Paleta de Comandos</span>
                    </div>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 border border-cyan-500/20 text-cyan-300">
                      ⌘K
                    </span>
                  </button>
                )}

                {/* Auto Tune Trigger */}
                <button
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    if (onOpenAutoTune) {
                      onOpenAutoTune();
                    } else {
                      handleSelectTab('settings');
                    }
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-amber-500/15 to-cyan-500/15 border border-amber-500/30 text-amber-300 hover:opacity-90 transition font-bold"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Auto-Tuning Sharpe</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                    OTIMIZAR
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Hamburger Button */}
          <button
            onClick={() => {
              setIsMobileMenuOpen(!isMobileMenuOpen);
              setIsQuickActionsOpen(false);
            }}
            className="md:hidden p-1.5 sm:p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition shrink-0"
            aria-label="Abrir Menu Principal"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Horizontal Quick-Nav Scroll Bar */}
      <div className="md:hidden bg-[#050505] px-3 py-1.5 border-t border-white/5 overflow-x-auto flex items-center gap-1.5 scrollbar-none font-mono">
        {allNavItems.map(item => {
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
          <div className="bg-[#0A0A0A] border-b border-white/10 p-4 space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto">
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

            {/* Categorized Modules in Mobile Drawer */}
            <div className="space-y-4 font-mono">
              {navCategories.map(category => {
                const CatIcon = category.icon;
                return (
                  <div key={category.id} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-neutral-400 px-1">
                      <CatIcon className="w-3.5 h-3.5 text-orange-400" />
                      <span>{category.label}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      {category.items.map(item => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelectTab(item.id)}
                            className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-bold transition-all border min-h-[44px] ${
                              isActive
                                ? 'bg-orange-500/15 text-orange-400 border-orange-500/40'
                                : 'bg-[#050505] text-neutral-300 border-white/5 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`p-1.5 rounded ${isActive ? 'bg-orange-500 text-black' : 'bg-white/5 text-neutral-400'}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="text-left min-w-0">
                                <div className="text-xs font-bold truncate">{item.label}</div>
                                <div className="text-[9.5px] text-neutral-400 font-normal truncate">{item.desc}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {item.badge !== null && (
                                <span className="text-[9px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded font-black">
                                  {item.badge}
                                </span>
                              )}
                              <ChevronRight className="h-4 w-4 text-neutral-500" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
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


