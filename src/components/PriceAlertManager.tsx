import React, { useState, useEffect } from 'react';
import { UserPriceAlert, TickerData } from '../types';
import { 
  Bell, 
  BellRing, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  X, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Volume2, 
  ChevronDown, 
  ChevronUp,
  Sliders,
  Sparkles
} from 'lucide-react';
import { formatPrice } from '../utils/formatters';
import { playSignalTone, sendDesktopNotification, requestNotificationPermission, isNotificationEnabled, setNotificationEnabled } from '../utils/soundAlerts';
import { Tooltip } from './Tooltip';

interface PriceAlertManagerProps {
  ticker: TickerData;
  onAlertTriggered?: (alert: UserPriceAlert) => void;
  onOpenBulkManager?: () => void;
}

const STORAGE_KEY = 'superbot_user_price_alerts';

export const PriceAlertManager: React.FC<PriceAlertManagerProps> = ({
  ticker,
  onAlertTriggered,
  onOpenBulkManager
}) => {
  const [alerts, setAlerts] = useState<UserPriceAlert[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [targetPriceInput, setTargetPriceInput] = useState<string>('');
  const [conditionInput, setConditionInput] = useState<'CROSS_ABOVE' | 'CROSS_BELOW'>('CROSS_ABOVE');
  const [noteInput, setNoteInput] = useState<string>('');
  const [permissionGranted, setPermissionGranted] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });

  // Save alerts to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
      window.dispatchEvent(new Event('storage'));
    } catch {
      // ignore
    }
  }, [alerts]);

  // Current ticker alerts
  const tickerAlerts = alerts.filter(a => a.symbol === ticker.symbol);
  const activeTickerAlerts = tickerAlerts.filter(a => a.active && !a.triggered);

  // Monitor price changes against active alerts
  useEffect(() => {
    const currentPrice = ticker.price;
    if (!currentPrice || currentPrice <= 0) return;

    let hasUpdates = false;
    const updated = alerts.map(alert => {
      if (alert.symbol !== ticker.symbol || !alert.active || alert.triggered) {
        return alert;
      }

      let triggered = false;
      if (alert.condition === 'CROSS_ABOVE' && currentPrice >= alert.targetPrice) {
        triggered = true;
      } else if (alert.condition === 'CROSS_BELOW' && currentPrice <= alert.targetPrice) {
        triggered = true;
      }

      if (triggered) {
        hasUpdates = true;
        const triggeredAlert: UserPriceAlert = {
          ...alert,
          triggered: true,
          triggeredAt: Date.now(),
          active: false
        };

        // Fire audio tone and desktop notification
        playSignalTone(alert.condition === 'CROSS_ABOVE' ? 'LONG' : 'SHORT');
        const title = `🚨 Alarme de Preço: ${alert.symbol}`;
        const conditionText = alert.condition === 'CROSS_ABOVE' ? 'atingiu ou superou' : 'caiu para ou abaixo de';
        const body = `Preço atual: ${formatPrice(currentPrice, { currency: true })} (${conditionText} ${formatPrice(alert.targetPrice, { currency: true })}). ${alert.note ? `Nota: "${alert.note}"` : ''}`;
        sendDesktopNotification(title, body);

        if (onAlertTriggered) {
          onAlertTriggered(triggeredAlert);
        }

        return triggeredAlert;
      }

      return alert;
    });

    if (hasUpdates) {
      setAlerts(updated);
    }
  }, [ticker.price, ticker.symbol]);

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermissionGranted(granted);
    if (granted) {
      setNotificationEnabled(true);
      sendDesktopNotification('🔔 Notificações Ativadas', 'Você receberá alertas na sua área de trabalho sempre que um alvo de preço for atingido.');
    }
  };

  const handleAddAlert = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const priceNum = parseFloat(targetPriceInput);
    if (isNaN(priceNum) || priceNum <= 0) return;

    const newAlert: UserPriceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      symbol: ticker.symbol,
      targetPrice: priceNum,
      condition: conditionInput,
      note: noteInput.trim() || undefined,
      createdAt: Date.now(),
      triggered: false,
      active: true
    };

    setAlerts(prev => [newAlert, ...prev]);
    setTargetPriceInput('');
    setNoteInput('');

    // If notifications aren't enabled or requested yet, prompt gently
    if (!permissionGranted && typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'denied') {
      handleRequestPermission();
    }
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleResetAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, triggered: false, active: true, triggeredAt: undefined } : a));
  };

  // Helper quick preset target calculations
  const setQuickTarget = (type: 'GP_618' | 'GP_68' | 'POC' | 'PLUS_1' | 'MINUS_1') => {
    if (type === 'GP_618' && ticker.fibonacci.fib618) {
      setTargetPriceInput(ticker.fibonacci.fib618.toString());
      setConditionInput(ticker.fibonacci.fib618 > ticker.price ? 'CROSS_ABOVE' : 'CROSS_BELOW');
    } else if (type === 'GP_68' && ticker.fibonacci.fib68) {
      setTargetPriceInput(ticker.fibonacci.fib68.toString());
      setConditionInput(ticker.fibonacci.fib68 > ticker.price ? 'CROSS_ABOVE' : 'CROSS_BELOW');
    } else if (type === 'POC' && ticker.rangeProfile.poc) {
      setTargetPriceInput(ticker.rangeProfile.poc.toString());
      setConditionInput(ticker.rangeProfile.poc > ticker.price ? 'CROSS_ABOVE' : 'CROSS_BELOW');
    } else if (type === 'PLUS_1') {
      const p = ticker.price * 1.015;
      setTargetPriceInput(p.toFixed(ticker.price < 1 ? 6 : 2));
      setConditionInput('CROSS_ABOVE');
    } else if (type === 'MINUS_1') {
      const p = ticker.price * 0.985;
      setTargetPriceInput(p.toFixed(ticker.price < 1 ? 6 : 2));
      setConditionInput('CROSS_BELOW');
    }
  };

  return (
    <div className="relative">
      {/* Trigger Button in Chart Toolbar */}
      <Tooltip
        position="top"
        title="Criar Alarme de Preço"
        badge={activeTickerAlerts.length > 0 ? `${activeTickerAlerts.length} ATIVO(S)` : 'DESKTOP ALERT'}
        content="Defina preços-alvo para este ativo e receba alertas sonoros e notificações na Área de Trabalho quando o preço cruzar o nível desejado."
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`px-2.5 py-1 rounded text-[10px] font-bold transition flex items-center gap-1.5 border active:scale-95 ${
            activeTickerAlerts.length > 0
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
              : 'bg-[#050505] text-neutral-300 border-white/10 hover:border-white/20 hover:text-white'
          }`}
        >
          {activeTickerAlerts.length > 0 ? (
            <BellRing className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
          ) : (
            <Bell className="h-3.5 w-3.5 text-neutral-400" />
          )}
          <span>Alarmes ({activeTickerAlerts.length})</span>
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </Tooltip>

      {/* Popover Card for Setting & Managing Price Alerts */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 z-40 w-80 sm:w-96 bg-[#0B0B0B] border border-white/15 rounded-2xl shadow-2xl p-4 font-sans text-xs animate-fade-in backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-white text-xs font-mono">
                  Alarmes de Preço: {ticker.symbol}
                </h4>
                <p className="text-[10px] text-neutral-400 font-mono">
                  Preço Atual: <strong className="text-white">{formatPrice(ticker.price, { currency: true })}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Permission Notice Banner if not granted */}
          {!permissionGranted && typeof window !== 'undefined' && 'Notification' in window && (
            <div className="mt-3 p-2 bg-cyan-950/40 border border-cyan-500/30 rounded-xl flex items-center justify-between gap-2 text-[10px] text-cyan-300">
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Ative notificações no navegador para receber avisos em segundo plano.</span>
              </div>
              <button
                onClick={handleRequestPermission}
                className="px-2 py-0.5 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold rounded text-[9px] transition whitespace-nowrap"
              >
                Ativar
              </button>
            </div>
          )}

          {/* Quick Presets Bar */}
          <div className="mt-3 space-y-1">
            <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">
              Preenchimento Rápido com Níveis Chave:
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {ticker.fibonacci.fib618 > 0 && (
                <button
                  type="button"
                  onClick={() => setQuickTarget('GP_618')}
                  className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-[10px] font-mono text-amber-400 border border-amber-500/20"
                >
                  Fib 0.618 ({formatPrice(ticker.fibonacci.fib618)})
                </button>
              )}
              {ticker.rangeProfile.poc > 0 && (
                <button
                  type="button"
                  onClick={() => setQuickTarget('POC')}
                  className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-[10px] font-mono text-cyan-400 border border-cyan-500/20"
                >
                  POC ({formatPrice(ticker.rangeProfile.poc)})
                </button>
              )}
              <button
                type="button"
                onClick={() => setQuickTarget('PLUS_1')}
                className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-[10px] font-mono text-emerald-400 border border-emerald-500/20"
              >
                +1.5%
              </button>
              <button
                type="button"
                onClick={() => setQuickTarget('MINUS_1')}
                className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-[10px] font-mono text-rose-400 border border-rose-500/20"
              >
                -1.5%
              </button>
            </div>
          </div>

          {/* Add Alert Form */}
          <form onSubmit={handleAddAlert} className="mt-3 space-y-2 bg-[#050505] p-2.5 rounded-xl border border-white/5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-neutral-400 font-bold uppercase block mb-1">
                  Preço Alvo ($)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder={ticker.price ? ticker.price.toString() : '0.00'}
                  value={targetPriceInput}
                  onChange={(e) => {
                    setTargetPriceInput(e.target.value);
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && ticker.price) {
                      setConditionInput(val >= ticker.price ? 'CROSS_ABOVE' : 'CROSS_BELOW');
                    }
                  }}
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-neutral-400 font-bold uppercase block mb-1">
                  Condição de Disparo
                </label>
                <select
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value as 'CROSS_ABOVE' | 'CROSS_BELOW')}
                  className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-sans focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="CROSS_ABOVE">Cruzar Acima (&ge;)</option>
                  <option value="CROSS_BELOW">Cruzar Abaixo (&le;)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-neutral-400 font-bold uppercase block mb-1">
                Anotação / Lembrete (Opcional)
              </label>
              <input
                type="text"
                maxLength={45}
                placeholder="Ex: Take profit parcial, rompimento Golden Pocket..."
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={!targetPriceInput || parseFloat(targetPriceInput) <= 0}
              className="w-full mt-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-40 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Salvar Alarme para {ticker.symbol}</span>
            </button>
          </form>

          {/* List of active & triggered alerts for this symbol */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-neutral-400 font-bold uppercase">
              <span>Alarmes Cadastrados ({tickerAlerts.length})</span>
              {tickerAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAlerts(prev => prev.filter(a => a.symbol !== ticker.symbol))}
                  className="text-rose-400 hover:underline cursor-pointer"
                >
                  Limpar Todos
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {tickerAlerts.length === 0 ? (
                <div className="text-center py-4 text-neutral-500 text-[11px]">
                  Nenhum alarme configurado para {ticker.symbol}.
                </div>
              ) : (
                tickerAlerts.map(alert => {
                  const distPct = ticker.price ? ((alert.targetPrice - ticker.price) / ticker.price) * 100 : 0;
                  return (
                    <div
                      key={alert.id}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 font-mono text-[11px] ${
                        alert.triggered
                          ? 'bg-neutral-900/40 border-white/5 opacity-60'
                          : alert.condition === 'CROSS_ABOVE'
                            ? 'bg-[#06120a] border-emerald-500/30'
                            : 'bg-[#140608] border-rose-500/30'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {alert.triggered ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          ) : alert.condition === 'CROSS_ABOVE' ? (
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                          )}
                          <span className="font-extrabold text-white">
                            {formatPrice(alert.targetPrice, { currency: true })}
                          </span>
                          <span className={`text-[9px] font-bold px-1 rounded ${
                            alert.triggered 
                              ? 'bg-neutral-800 text-neutral-400' 
                              : distPct >= 0 
                                ? 'text-emerald-400' 
                                : 'text-rose-400'
                          }`}>
                            {alert.triggered ? 'DISPARADO' : `${distPct >= 0 ? '+' : ''}${distPct.toFixed(1)}%`}
                          </span>
                        </div>

                        {alert.note && (
                          <div className="text-[10px] text-neutral-400 truncate max-w-[210px] font-sans">
                            {alert.note}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {alert.triggered && (
                          <button
                            type="button"
                            onClick={() => handleResetAlert(alert.id)}
                            title="Reativar Alarme"
                            className="p-1 rounded text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 transition"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteAlert(alert.id)}
                          title="Excluir Alarme"
                          className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Central Bulk Alert Manager Footer Link */}
            {onOpenBulkManager && (
              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenBulkManager();
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-[#14151a] hover:bg-neutral-800 text-orange-400 hover:text-orange-300 font-mono font-bold text-[11px] flex items-center justify-between border border-orange-500/20 hover:border-orange-500/40 transition"
                >
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Gerenciador Geral em Massa</span>
                  </div>
                  <span className="text-[10px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded">
                    {alerts.length} total &rarr;
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
