import React, { useState, useEffect, useRef } from 'react';
import { TickerData } from '../types';
import { formatPrice, formatPercent } from '../utils/formatters';
import { 
  Search, 
  Command, 
  ArrowRight, 
  Sliders, 
  Activity, 
  Flame, 
  Radar, 
  Zap, 
  ShieldAlert, 
  BrainCircuit, 
  LineChart, 
  Database, 
  Cpu, 
  SlidersHorizontal, 
  X, 
  Sparkles, 
  TrendingUp, 
  TrendingDown,
  Sun,
  Moon,
  Monitor,
  Palette,
  Target,
  PieChart
} from 'lucide-react';

import { useTheme } from '../context/ThemeContext';


interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tickers: TickerData[];
  onSelectTicker: (ticker: TickerData) => void;
  onNavigateToTab: (tab: string) => void;
  onTriggerAutoTune?: () => void;
  onToggleBot?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  tickers,
  onSelectTicker,
  onNavigateToTab,
  onTriggerAutoTune,
  onToggleBot
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme, cycleTheme } = useTheme();


  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Navigation Items
  const navCommands = [
    { id: 'dashboard', label: 'Grid de Tickers & Cotações', icon: Activity, tab: 'dashboard', shortcut: '1' },
    { id: 'heatmap', label: 'Heatmap de Mercado (D3)', icon: Flame, tab: 'heatmap', shortcut: '2' },
    { id: 'volume_screener', label: 'Smart Volume Screener (1h/4h/1d)', icon: Flame, tab: 'volume_screener', shortcut: '3' },
    { id: 'sector_screener', label: 'Screener de Setores & Rotação de Capital', icon: PieChart, tab: 'sector_screener' },
    { id: 'screener', label: 'Radar Screener & Momentum', icon: Radar, tab: 'screener', shortcut: '4' },
    { id: 'signals', label: 'Matriz de Sinais & Order Flow', icon: Zap, tab: 'signals', shortcut: '5' },
    { id: 'risk', label: 'Exposição de Risco, Gregas & VaR', icon: ShieldAlert, tab: 'risk', shortcut: '6' },
    { id: 'ai_motor', label: 'Motor de IA & Auditoria', icon: BrainCircuit, tab: 'ai_motor', shortcut: '7' },
    { id: 'chart', label: 'Análise Técnica & Volume Profile', icon: LineChart, tab: 'chart', shortcut: '8' },
    { id: 'backtest', label: 'Backtest Estatístico', icon: Database, tab: 'backtest', shortcut: '9' },
    { id: 'counter_radar', label: 'Contra-Trade Radar (TTI) — Net Longs/Shorts & Trapped Traders', icon: Target, tab: 'counter_radar', shortcut: '0' },
    { id: 'settings', label: 'Pesos de Confluência & Estratégias', icon: SlidersHorizontal, tab: 'settings' }
  ];

  // Action Commands
  const actionCommands = [
    {
      id: 'action_autotune',
      label: 'Executar Auto-Tuning de Estratégia (Max Sharpe Ratio)',
      icon: Sparkles,
      action: () => {
        onNavigateToTab('settings');
        if (onTriggerAutoTune) onTriggerAutoTune();
      },
      tag: 'ALPHA'
    },
    {
      id: 'action_rsi_divergence',
      label: 'Abrir Monitor de Divergências RSI (14) — Reversão de Tendência',
      icon: Activity,
      action: () => onNavigateToTab('dashboard'),
      tag: 'RSI'
    },
    {
      id: 'action_golden_pocket',
      label: 'Filtrar ativos no Golden Pocket (0.618 - 0.68)',
      icon: Flame,
      action: () => onNavigateToTab('dashboard'),
      tag: 'FIBO'
    },
    {
      id: 'action_toggle_bot',
      label: 'Alternar Execução / Monitoramento do Bot',
      icon: Activity,
      action: () => {
        if (onToggleBot) onToggleBot();
      },
      tag: 'BOT'
    },
    {
      id: 'action_toggle_theme',
      label: `Ciclar Tema UI: ${theme === 'dark' ? 'Dark → Light' : theme === 'light' ? 'Light → Auto' : 'Auto → Dark'}`,
      icon: Palette,
      action: () => cycleTheme(),
      tag: 'THEME'
    },
    {
      id: 'action_theme_dark',
      label: 'Ativar Modo Institutional Dark (OLED High-Contrast)',
      icon: Moon,
      action: () => setTheme('dark'),
      tag: 'THEME'
    },
    {
      id: 'action_theme_light',
      label: 'Ativar Modo Pro Light (Day Trading Visibility)',
      icon: Sun,
      action: () => setTheme('light'),
      tag: 'THEME'
    },
    {
      id: 'action_theme_system',
      label: 'Ativar Modo Automático (segue tema do Sistema Operacional)',
      icon: Monitor,
      action: () => setTheme('system'),
      tag: 'THEME'
    }
  ];

  // Filter items based on query
  const filteredTickers = (tickers || []).filter(t => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
  }).slice(0, 8);

  const filteredNav = navCommands.filter(item => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return item.label.toLowerCase().includes(q) || item.tab.toLowerCase().includes(q);
  });

  const filteredActions = actionCommands.filter(action => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return action.label.toLowerCase().includes(q);
  });

  const allItems = [
    ...filteredTickers.map(t => ({ type: 'ticker' as const, data: t })),
    ...filteredNav.map(n => ({ type: 'nav' as const, data: n })),
    ...filteredActions.map(a => ({ type: 'action' as const, data: a }))
  ];

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, allItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allItems.length) % Math.max(1, allItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = allItems[selectedIndex];
      if (current) {
        if (current.type === 'ticker') {
          onSelectTicker(current.data as TickerData);
          onClose();
        } else if (current.type === 'nav') {
          onNavigateToTab((current.data as any).tab);
          onClose();
        } else if (current.type === 'action') {
          (current.data as any).action();
          onClose();
        }
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/80 backdrop-blur-xs font-mono"
      onClick={onClose}
    >
      <div 
        className="bg-[#0A0B0E] border border-cyan-500/40 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl shadow-cyan-950/40 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input Bar */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-[#0D0E12]">
          <Search className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Digite um ativo (BTC, SOL), comando (/screener) ou ação..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-white text-sm placeholder:text-neutral-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-2 max-h-[60vh] overflow-y-auto space-y-1">
          {allItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">
              Nenhum ativo ou comando encontrado para &quot;{query}&quot;
            </div>
          ) : (
            allItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;

              if (item.type === 'ticker') {
                const t = item.data as TickerData;
                const isPos = (t.priceChangePercent24h || 0) >= 0;

                return (
                  <div
                    key={`ticker_${t.symbol}`}
                    onClick={() => {
                      onSelectTicker(t);
                      onClose();
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                      isSelected ? 'bg-cyan-500/20 text-white border border-cyan-500/40' : 'hover:bg-white/5 text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="p-1.5 rounded-lg bg-neutral-900 border border-white/10 text-cyan-400 font-bold text-xs">
                        {t.symbol.slice(0, 3)}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-sm text-white">{t.symbol}</span>
                          <span className="text-[10px] text-neutral-400">{t.name}</span>
                        </div>
                        <span className="text-[10px] text-neutral-500">
                          {t.marketType === 'crypto_futures' ? 'Binance USDT Futures' : 'TradFi'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className="text-xs font-black text-white tabular-nums">
                          {formatPrice(t.price, { currency: true })}
                        </div>
                        <div className={`text-[10px] font-bold tabular-nums flex items-center justify-end gap-0.5 ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPos ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                          {isPos ? '+' : ''}{formatPercent(t.priceChangePercent24h || 0)}
                        </div>
                      </div>
                      <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-neutral-600'}`} />
                    </div>
                  </div>
                );
              }

              if (item.type === 'nav') {
                const n = item.data as (typeof navCommands)[0];
                const Icon = n.icon;

                return (
                  <div
                    key={`nav_${n.id}`}
                    onClick={() => {
                      onNavigateToTab(n.tab);
                      onClose();
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                      isSelected ? 'bg-cyan-500/20 text-white border border-cyan-500/40' : 'hover:bg-white/5 text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-neutral-900 border border-white/10 text-amber-400">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">{n.label}</span>
                        <span className="text-[10px] text-neutral-500">Acessar aba #{n.tab}</span>
                      </div>
                    </div>

                    {n.shortcut && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 border border-white/10 text-neutral-400">
                        {n.shortcut}
                      </span>
                    )}
                  </div>
                );
              }

              if (item.type === 'action') {
                const a = item.data as (typeof actionCommands)[0];
                const Icon = a.icon;

                return (
                  <div
                    key={`action_${a.id}`}
                    onClick={() => {
                      a.action();
                      onClose();
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                      isSelected ? 'bg-cyan-500/20 text-white border border-cyan-500/40' : 'hover:bg-white/5 text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-emerald-300 block">{a.label}</span>
                        <span className="text-[10px] text-neutral-500">Ação rápida do robô</span>
                      </div>
                    </div>

                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {a.tag}
                    </span>
                  </div>
                );
              }

              return null;
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="p-2.5 border-t border-white/10 bg-[#08090C] text-[10px] text-neutral-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 rounded bg-neutral-900 border border-white/10 text-neutral-300">↑↓</kbd> Navegar</span>
            <span><kbd className="px-1 py-0.5 rounded bg-neutral-900 border border-white/10 text-neutral-300">↵</kbd> Selecionar</span>
            <span><kbd className="px-1 py-0.5 rounded bg-neutral-900 border border-white/10 text-neutral-300">ESC</kbd> Fechar</span>
          </div>
          <span className="text-cyan-400 font-bold">Terminal Quick Command</span>
        </div>
      </div>
    </div>
  );
};
