import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserPriceAlert, TickerData } from '../types';
import { formatPrice, formatPercent, formatDateTime, formatTimeAgo } from '../utils/formatters';
import { playSignalTone, sendDesktopNotification, requestNotificationPermission } from '../utils/soundAlerts';
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
  Sliders, 
  Sparkles, 
  RefreshCw, 
  Search, 
  Filter, 
  CheckSquare, 
  Square, 
  Play, 
  Pause, 
  ExternalLink, 
  ArrowUpDown, 
  Download, 
  Upload, 
  Volume2,
  Clock,
  Zap,
  Layers,
  Flame,
  ChevronRight
} from 'lucide-react';
import { Tooltip } from './Tooltip';
import { useToast } from './Toast';

interface BulkAlertManagerProps {
  isOpen: boolean;
  onClose: () => void;
  allTickers: TickerData[];
  currentTickerSymbol?: string;
  onSelectTickerBySymbol?: (symbol: string) => void;
  onAlertsUpdated?: (updatedAlerts: UserPriceAlert[]) => void;
}

const STORAGE_KEY = 'superbot_user_price_alerts';

export const BulkAlertManager: React.FC<BulkAlertManagerProps> = ({
  isOpen,
  onClose,
  allTickers = [],
  currentTickerSymbol,
  onSelectTickerBySymbol,
  onAlertsUpdated
}) => {
  const { showToast } = useToast();

  // Master alert list loaded from localStorage
  const [alerts, setAlerts] = useState<UserPriceAlert[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Selected row IDs for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search, filtering, and sorting state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [tickerFilter, setTickerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'TRIGGERED'>('ALL');
  const [sortBy, setSortBy] = useState<'DISTANCE' | 'DATE_DESC' | 'DATE_ASC' | 'SYMBOL' | 'TARGET_PRICE'>('DISTANCE');

  // Quick Create Alert Drawer State
  const [showCreateDrawer, setShowCreateDrawer] = useState<boolean>(false);
  const [newSymbol, setNewSymbol] = useState<string>(currentTickerSymbol || (allTickers[0]?.symbol || 'BTCUSDT'));
  const [newTargetPrice, setNewTargetPrice] = useState<string>('');
  const [newCondition, setNewCondition] = useState<'CROSS_ABOVE' | 'CROSS_BELOW'>('CROSS_ABOVE');
  const [newNote, setNewNote] = useState<string>('');

  // Ticker lookup map for rapid price calculation
  const tickerMap = useMemo(() => {
    const map = new Map<string, TickerData>();
    allTickers.forEach(t => map.set(t.symbol, t));
    return map;
  }, [allTickers]);

  // Sync state whenever modal opens or external storage changes
  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setAlerts(JSON.parse(stored));
        }
      } catch {
        // ignore
      }
    };

    if (isOpen) {
      loadFromStorage();
    }

    window.addEventListener('storage', loadFromStorage);
    return () => window.removeEventListener('storage', loadFromStorage);
  }, [isOpen]);

  // Save alerts to localStorage and notify parents
  const persistAlerts = useCallback((updatedAlerts: UserPriceAlert[]) => {
    setAlerts(updatedAlerts);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAlerts));
      // Dispatch custom storage event for other components in same window
      window.dispatchEvent(new Event('storage'));
    } catch {
      // ignore
    }
    if (onAlertsUpdated) {
      onAlertsUpdated(updatedAlerts);
    }
  }, [onAlertsUpdated]);

  // Real-time evaluation of all active alerts across all symbols in allTickers
  useEffect(() => {
    if (!allTickers || allTickers.length === 0) return;

    let hasChanges = false;
    const evaluated = alerts.map(alert => {
      if (!alert.active || alert.triggered) return alert;

      const liveTicker = tickerMap.get(alert.symbol);
      if (!liveTicker || !liveTicker.price || liveTicker.price <= 0) return alert;

      let isTriggered = false;
      if (alert.condition === 'CROSS_ABOVE' && liveTicker.price >= alert.targetPrice) {
        isTriggered = true;
      } else if (alert.condition === 'CROSS_BELOW' && liveTicker.price <= alert.targetPrice) {
        isTriggered = true;
      }

      if (isTriggered) {
        hasChanges = true;
        const triggeredAlert: UserPriceAlert = {
          ...alert,
          triggered: true,
          triggeredAt: Date.now(),
          active: false
        };

        // Trigger Audio & Desktop Notification
        playSignalTone(alert.condition === 'CROSS_ABOVE' ? 'LONG' : 'SHORT');
        const condMsg = alert.condition === 'CROSS_ABOVE' ? 'cruzou para cima de' : 'caiu abaixo de';
        sendDesktopNotification(
          `🚨 Alarme Disparado: ${alert.symbol}`,
          `Preço: ${formatPrice(liveTicker.price, { currency: true })} (${condMsg} ${formatPrice(alert.targetPrice, { currency: true })}). ${alert.note ? `Nota: "${alert.note}"` : ''}`
        );
        showToast('info', `🚨 Alarme de ${alert.symbol}`, `Preço atingiu ${formatPrice(alert.targetPrice, { currency: true })}!`);

        return triggeredAlert;
      }

      return alert;
    });

    if (hasChanges) {
      persistAlerts(evaluated);
    }
  }, [allTickers, alerts, tickerMap, persistAlerts, showToast]);

  // Keyboard shortcut ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Helper calculations for alert distance
  const getAlertMetrics = (alert: UserPriceAlert) => {
    const liveTicker = tickerMap.get(alert.symbol);
    const currentPrice = liveTicker?.price;
    if (!currentPrice || currentPrice <= 0) {
      return { currentPrice: null, distancePct: null, isClose: false };
    }

    const distancePct = ((alert.targetPrice - currentPrice) / currentPrice) * 100;
    const absDist = Math.abs(distancePct);
    const isClose = absDist <= 1.0; // within 1% of target

    return { currentPrice, distancePct, isClose };
  };

  // Filtered & Sorted Alerts
  const filteredAlerts = useMemo(() => {
    let result = [...alerts];

    // Filter by Ticker
    if (tickerFilter !== 'ALL') {
      result = result.filter(a => a.symbol === tickerFilter);
    }

    // Filter by Status
    if (statusFilter === 'ACTIVE') {
      result = result.filter(a => a.active && !a.triggered);
    } else if (statusFilter === 'PAUSED') {
      result = result.filter(a => !a.active && !a.triggered);
    } else if (statusFilter === 'TRIGGERED') {
      result = result.filter(a => a.triggered);
    }

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(a => 
        a.symbol.toLowerCase().includes(q) || 
        (a.note && a.note.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'DISTANCE') {
        const distA = Math.abs(getAlertMetrics(a).distancePct ?? 999999);
        const distB = Math.abs(getAlertMetrics(b).distancePct ?? 999999);
        return distA - distB;
      }
      if (sortBy === 'DATE_DESC') {
        return b.createdAt - a.createdAt;
      }
      if (sortBy === 'DATE_ASC') {
        return a.createdAt - b.createdAt;
      }
      if (sortBy === 'SYMBOL') {
        return a.symbol.localeCompare(b.symbol);
      }
      if (sortBy === 'TARGET_PRICE') {
        return b.targetPrice - a.targetPrice;
      }
      return 0;
    });

    return result;
  }, [alerts, tickerFilter, statusFilter, searchTerm, sortBy, tickerMap]);

  // Unique symbols with registered alerts
  const uniqueSymbols = useMemo(() => {
    const set = new Set<string>();
    alerts.forEach(a => set.add(a.symbol));
    return Array.from(set).sort();
  }, [alerts]);

  // Summary counts
  const totalCount = alerts.length;
  const activeCount = alerts.filter(a => a.active && !a.triggered).length;
  const pausedCount = alerts.filter(a => !a.active && !a.triggered).length;
  const triggeredCount = alerts.filter(a => a.triggered).length;

  // Bulk Actions
  const handleSelectAll = () => {
    if (selectedIds.size === filteredAlerts.length && filteredAlerts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAlerts.map(a => a.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkActivate = () => {
    if (selectedIds.size === 0) return;
    const updated = alerts.map(a => {
      if (selectedIds.has(a.id)) {
        return { ...a, active: true, triggered: false, triggeredAt: undefined };
      }
      return a;
    });
    persistAlerts(updated);
    showToast('success', 'Alarmes Ativados', `${selectedIds.size} alarme(s) ativado(s) com sucesso!`);
  };

  const handleBulkPause = () => {
    if (selectedIds.size === 0) return;
    const updated = alerts.map(a => {
      if (selectedIds.has(a.id)) {
        return { ...a, active: false };
      }
      return a;
    });
    persistAlerts(updated);
    showToast('info', 'Alarmes Pausados', `${selectedIds.size} alarme(s) pausado(s).`);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const updated = alerts.filter(a => !selectedIds.has(a.id));
    persistAlerts(updated);
    setSelectedIds(new Set());
    showToast('info', 'Alarmes Excluídos', `${count} alarme(s) excluído(s).`);
  };

  const handleClearAllTriggered = () => {
    const updated = alerts.filter(a => !a.triggered);
    persistAlerts(updated);
    showToast('info', 'Limpeza Concluída', 'Todos os alarmes disparados foram removidos.');
  };

  // Single alert row actions
  const handleToggleSingleActive = (id: string) => {
    const updated = alerts.map(a => {
      if (a.id === id) {
        const nextActive = !a.active;
        return { ...a, active: nextActive, triggered: false };
      }
      return a;
    });
    persistAlerts(updated);
  };

  const handleResetSingle = (id: string) => {
    const updated = alerts.map(a => {
      if (a.id === id) {
        return { ...a, active: true, triggered: false, triggeredAt: undefined };
      }
      return a;
    });
    persistAlerts(updated);
    showToast('success', 'Alarme Rearmado', 'Alarme rearmado com sucesso!');
  };

  const handleDeleteSingle = (id: string) => {
    const updated = alerts.filter(a => !a.id.includes(id) ? a : null).filter(Boolean) as UserPriceAlert[];
    persistAlerts(updated);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleNavigateToTicker = (symbol: string) => {
    if (onSelectTickerBySymbol) {
      onSelectTickerBySymbol(symbol);
    }
    onClose();
  };

  // Quick Create Form Submission
  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(newTargetPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      showToast('error', 'Preço Inválido', 'Por favor, informe um preço-alvo válido.');
      return;
    }

    const newAlert: UserPriceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      symbol: newSymbol.toUpperCase(),
      targetPrice: priceNum,
      condition: newCondition,
      note: newNote.trim() || undefined,
      createdAt: Date.now(),
      triggered: false,
      active: true
    };

    const updated = [newAlert, ...alerts];
    persistAlerts(updated);
    setNewTargetPrice('');
    setNewNote('');
    setShowCreateDrawer(false);
    showToast('success', 'Alarme Criado', `Alarme para ${newAlert.symbol} criado com sucesso!`);
  };

  // Quick target percentage adjustment helper
  const applyPresetPercentage = (pct: number) => {
    const live = tickerMap.get(newSymbol);
    if (!live || !live.price) return;
    const calculated = live.price * (1 + pct / 100);
    setNewTargetPrice(calculated.toFixed(live.price < 1 ? 6 : 2));
    setNewCondition(pct >= 0 ? 'CROSS_ABOVE' : 'CROSS_BELOW');
  };

  // Export alerts as JSON
  const handleExportJson = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(alerts, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `superbot-alarmes-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('success', 'Exportação Concluída', 'Arquivo JSON de alarmes exportado!');
    } catch {
      showToast('error', 'Falha na Exportação', 'Erro ao exportar alarmes.');
    }
  };

  // Import alerts from JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          // Merge unique by id
          const existingIds = new Set(alerts.map(a => a.id));
          const toAdd = parsed.filter((a: any) => a.id && a.symbol && a.targetPrice && !existingIds.has(a.id));
          const merged = [...toAdd, ...alerts];
          persistAlerts(merged);
          showToast('success', 'Importação Concluída', `${toAdd.length} novo(s) alarme(s) importado(s)!`);
        } else {
          showToast('error', 'Arquivo Inválido', 'Formato inválido de arquivo JSON.');
        }
      } catch {
        showToast('error', 'Falha na Leitura', 'Erro ao ler arquivo JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
      <div 
        className="bg-[#09090b] border border-white/15 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 sm:px-6 border-b border-white/10 bg-[#0c0d10]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white uppercase tracking-wider font-mono">
                  Gerenciador Geral de Alarmes (Bulk Manager)
                </h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/30 font-mono">
                  {totalCount} ALARME(S)
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Painel unificado para monitorar, ativar, pausar, criar e excluir alarmes de preço em múltiplos ativos simultaneamente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Quick Create Trigger Button */}
            <button
              onClick={() => setShowCreateDrawer(!showCreateDrawer)}
              className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-xs transition flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Alarme</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              aria-label="Fechar Central de Alarmes"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:px-6 bg-[#070709] border-b border-white/5 text-xs font-mono">
          {/* Card 1: Total */}
          <div className="p-2.5 bg-[#0e0f12] rounded-xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-neutral-400 text-[11px] block">Cadastrados</span>
              <span className="text-lg font-black text-white">{totalCount}</span>
            </div>
            <Layers className="w-5 h-5 text-neutral-500" />
          </div>

          {/* Card 2: Ativos */}
          <div className="p-2.5 bg-[#0e0f12] rounded-xl border border-emerald-500/20 flex items-center justify-between">
            <div>
              <span className="text-neutral-400 text-[11px] block">Monitorando (Ativos)</span>
              <span className="text-lg font-black text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {activeCount}
              </span>
            </div>
            <Play className="w-5 h-5 text-emerald-500" />
          </div>

          {/* Card 3: Pausados */}
          <div className="p-2.5 bg-[#0e0f12] rounded-xl border border-neutral-700/50 flex items-center justify-between">
            <div>
              <span className="text-neutral-400 text-[11px] block">Pausados</span>
              <span className="text-lg font-black text-neutral-400">{pausedCount}</span>
            </div>
            <Pause className="w-5 h-5 text-neutral-500" />
          </div>

          {/* Card 4: Disparados */}
          <div className="p-2.5 bg-[#0e0f12] rounded-xl border border-amber-500/20 flex items-center justify-between">
            <div>
              <span className="text-neutral-400 text-[11px] block">Disparados</span>
              <span className="text-lg font-black text-amber-400">{triggeredCount}</span>
            </div>
            <BellRing className="w-5 h-5 text-amber-500" />
          </div>
        </div>

        {/* Quick Create Drawer (Collapsible) */}
        {showCreateDrawer && (
          <div className="p-4 sm:px-6 bg-[#0d0e12] border-b border-orange-500/20 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-orange-400 font-mono">
                <Plus className="w-4 h-4" />
                <span>Adicionar Novo Alarme de Preço</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateDrawer(false)}
                className="text-neutral-400 hover:text-white text-xs"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleCreateAlert} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                {/* Symbol Select */}
                <div>
                  <label className="block text-neutral-400 font-mono text-[11px] mb-1">Ativo / Ticker</label>
                  <select
                    value={newSymbol}
                    onChange={(e) => {
                      setNewSymbol(e.target.value);
                      const t = tickerMap.get(e.target.value);
                      if (t) {
                        setNewTargetPrice(t.price.toString());
                      }
                    }}
                    className="w-full bg-[#050505] border border-white/15 rounded-lg px-2.5 py-2 text-white font-mono font-bold focus:outline-none focus:border-orange-500"
                  >
                    {allTickers.map(t => (
                      <option key={t.symbol} value={t.symbol}>
                        {t.symbol} ({formatPrice(t.price, { currency: true })})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Price */}
                <div>
                  <label className="block text-neutral-400 font-mono text-[11px] mb-1">Preço-Alvo Desejado</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Ex: 95500.00"
                    value={newTargetPrice}
                    onChange={(e) => setNewTargetPrice(e.target.value)}
                    className="w-full bg-[#050505] border border-white/15 rounded-lg px-2.5 py-2 text-white font-mono font-bold focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* Condition */}
                <div>
                  <label className="block text-neutral-400 font-mono text-[11px] mb-1">Condição de Disparo</label>
                  <div className="grid grid-cols-2 gap-1 bg-[#050505] p-1 rounded-lg border border-white/15">
                    <button
                      type="button"
                      onClick={() => setNewCondition('CROSS_ABOVE')}
                      className={`py-1 rounded text-[10px] font-bold font-mono transition flex items-center justify-center gap-1 ${
                        newCondition === 'CROSS_ABOVE'
                          ? 'bg-emerald-500 text-black font-black'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <TrendingUp className="w-3 h-3" />
                      <span>Cruzar Acima (&ge;)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCondition('CROSS_BELOW')}
                      className={`py-1 rounded text-[10px] font-bold font-mono transition flex items-center justify-center gap-1 ${
                        newCondition === 'CROSS_BELOW'
                          ? 'bg-rose-500 text-white font-black'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <TrendingDown className="w-3 h-3" />
                      <span>Cruzar Abaixo (&le;)</span>
                    </button>
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-neutral-400 font-mono text-[11px] mb-1">Nota / Observação (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Rompimento de Resistência"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="w-full bg-[#050505] border border-white/15 rounded-lg px-2.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Quick % adjustment buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400 font-mono text-[10px]">Ajuste Rápido:</span>
                  {[
                    { label: '+0.5%', val: 0.5 },
                    { label: '+1.0%', val: 1.0 },
                    { label: '+2.0%', val: 2.0 },
                    { label: '-0.5%', val: -0.5 },
                    { label: '-1.0%', val: -1.0 },
                    { label: '-2.0%', val: -2.0 }
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPresetPercentage(p.val)}
                      className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-white/10 font-mono text-[10px]"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-xs font-mono transition"
                >
                  Confirmar e Salvar Alarme
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Toolbar: Search, Filters & Bulk Actions */}
        <div className="p-3 sm:px-6 bg-[#09090b] border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          {/* Left: Search & Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar ticker ou nota..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#050505] border border-white/10 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-white/30 w-44 sm:w-56"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Ticker Filter */}
            <select
              value={tickerFilter}
              onChange={(e) => setTickerFilter(e.target.value)}
              className="bg-[#050505] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-neutral-300 font-mono focus:outline-none focus:border-white/30"
            >
              <option value="ALL">Todos os Ativos ({uniqueSymbols.length})</option>
              {uniqueSymbols.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Status Filter */}
            <div className="flex items-center bg-[#050505] p-0.5 rounded-lg border border-white/10 font-mono text-[10px]">
              {[
                { id: 'ALL', label: 'Todos' },
                { id: 'ACTIVE', label: `Ativos (${activeCount})` },
                { id: 'PAUSED', label: `Pausados (${pausedCount})` },
                { id: 'TRIGGERED', label: `Disparados (${triggeredCount})` }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id as any)}
                  className={`px-2 py-1 rounded font-bold transition ${
                    statusFilter === f.id
                      ? 'bg-neutral-800 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#050505] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-neutral-300 font-mono focus:outline-none focus:border-white/30"
            >
              <option value="DISTANCE">Mais Próximo do Disparo (% Distância)</option>
              <option value="DATE_DESC">Data: Mais Recentes</option>
              <option value="DATE_ASC">Data: Mais Antigos</option>
              <option value="SYMBOL">Ticker: A-Z</option>
              <option value="TARGET_PRICE">Preço Alvo: Maior</option>
            </select>
          </div>

          {/* Right: Bulk Action Buttons when items selected */}
          <div className="flex items-center gap-1.5 font-mono">
            {selectedIds.size > 0 ? (
              <div className="flex items-center gap-1.5 bg-neutral-900/90 border border-orange-500/30 px-2.5 py-1 rounded-lg">
                <span className="text-[11px] font-bold text-orange-400">
                  {selectedIds.size} selecionado(s):
                </span>
                
                <button
                  onClick={handleBulkActivate}
                  className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 transition"
                  title="Ativar alarmes selecionados"
                >
                  <Play className="w-3 h-3" />
                  <span>Ativar</span>
                </button>

                <button
                  onClick={handleBulkPause}
                  className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-white/10 text-[10px] font-bold flex items-center gap-1 transition"
                  title="Pausar alarmes selecionados"
                >
                  <Pause className="w-3 h-3" />
                  <span>Pausar</span>
                </button>

                <button
                  onClick={handleBulkDelete}
                  className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1 transition"
                  title="Excluir alarmes selecionados"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Excluir</span>
                </button>

                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-neutral-400 hover:text-white text-[10px] ml-1"
                  title="Limpar seleção"
                >
                  Limpar
                </button>
              </div>
            ) : (
              <>
                {triggeredCount > 0 && (
                  <button
                    onClick={handleClearAllTriggered}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 transition"
                    title="Remover todos os alarmes que já foram disparados"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Limpar Disparados ({triggeredCount})</span>
                  </button>
                )}

                {/* Export & Import Backup */}
                <button
                  onClick={handleExportJson}
                  className="p-1.5 rounded-lg bg-neutral-900 border border-white/10 text-neutral-400 hover:text-white transition"
                  title="Exportar alarmes como arquivo JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <label
                  className="p-1.5 rounded-lg bg-neutral-900 border border-white/10 text-neutral-400 hover:text-white transition cursor-pointer"
                  title="Importar alarmes de arquivo JSON"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJson}
                    className="hidden"
                  />
                </label>
              </>
            )}
          </div>
        </div>

        {/* Central Table of Price Alerts */}
        <div className="flex-1 overflow-y-auto">
          {filteredAlerts.length === 0 ? (
            <div className="py-16 px-4 flex flex-col items-center justify-center text-center font-mono">
              <div className="p-3 rounded-2xl bg-neutral-900/60 border border-white/10 text-neutral-500 mb-3">
                <Bell className="w-8 h-8 stroke-1" />
              </div>
              <h4 className="text-sm font-bold text-neutral-300">
                {alerts.length === 0 
                  ? 'Nenhum alarme de preço cadastrado' 
                  : 'Nenhum alarme corresponde aos filtros selecionados'}
              </h4>
              <p className="text-xs text-neutral-500 max-w-md mt-1 mb-4">
                {alerts.length === 0
                  ? 'Crie alarmes com preços-alvo para receber notificações sonoras e alertas no desktop no momento em que o ativo atingir sua meta.'
                  : 'Ajuste os filtros de ativo, status ou termo de busca para visualizar outros alarmes.'}
              </p>
              <button
                onClick={() => setShowCreateDrawer(true)}
                className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Primeiro Alarme</span>
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 bg-[#070709] text-[10px] text-neutral-400 uppercase tracking-wider sticky top-0 z-10">
                  {/* Select All Checkbox */}
                  <th className="py-2.5 px-3 w-10 text-center">
                    <button
                      onClick={handleSelectAll}
                      className="text-neutral-400 hover:text-white"
                      title={selectedIds.size === filteredAlerts.length ? 'Desmarcar todos' : 'Marcar todos'}
                    >
                      {selectedIds.size === filteredAlerts.length && filteredAlerts.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-orange-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>

                  <th className="py-2.5 px-3">Ativo (Ticker)</th>
                  <th className="py-2.5 px-3">Condição</th>
                  <th className="py-2.5 px-3">Preço Alvo</th>
                  <th className="py-2.5 px-3">Preço Atual</th>
                  <th className="py-2.5 px-3">Distância para Alvo</th>
                  <th className="py-2.5 px-3">Nota</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Criado</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {filteredAlerts.map(alert => {
                  const isSelected = selectedIds.has(alert.id);
                  const { currentPrice, distancePct, isClose } = getAlertMetrics(alert);
                  const isCrossAbove = alert.condition === 'CROSS_ABOVE';
                  const liveTicker = tickerMap.get(alert.symbol);

                  return (
                    <tr 
                      key={alert.id}
                      className={`transition-colors hover:bg-white/[0.03] ${
                        isSelected ? 'bg-orange-500/10' : ''
                      } ${alert.triggered ? 'opacity-80 bg-amber-950/10' : ''}`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleSelect(alert.id)}
                          className="text-neutral-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-orange-400" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-600" />
                          )}
                        </button>
                      </td>

                      {/* Ticker Symbol */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-xs">
                            {alert.symbol}
                          </span>
                          <button
                            onClick={() => handleNavigateToTicker(alert.symbol)}
                            className="p-1 rounded text-neutral-500 hover:text-orange-400 hover:bg-neutral-800 transition"
                            title="Abrir gráfico técnico deste ativo"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Condition */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          {isCrossAbove ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              <span>&ge; Cruzar Acima</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" />
                              <span>&le; Cruzar Abaixo</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Target Price */}
                      <td className="py-3 px-3 font-bold text-white">
                        {formatPrice(alert.targetPrice, { currency: true })}
                      </td>

                      {/* Current Live Price */}
                      <td className="py-3 px-3">
                        {currentPrice ? (
                          <div>
                            <span className="text-neutral-200 font-bold block">
                              {formatPrice(currentPrice, { currency: true })}
                            </span>
                            {liveTicker && (
                              <span className={`text-[9.5px] font-bold ${
                                liveTicker.priceChangePercent24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {liveTicker.priceChangePercent24h >= 0 ? '+' : ''}{liveTicker.priceChangePercent24h.toFixed(2)}% (24h)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-500 italic">Carregando...</span>
                        )}
                      </td>

                      {/* Distance to Target (% Remaining) */}
                      <td className="py-3 px-3">
                        {alert.triggered ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            Disparado
                          </span>
                        ) : distancePct !== null ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-bold text-[11px] ${
                                isClose 
                                  ? 'text-amber-400 animate-pulse font-black' 
                                  : distancePct > 0 
                                  ? 'text-neutral-300' 
                                  : 'text-neutral-300'
                              }`}>
                                {distancePct > 0 ? '+' : ''}{distancePct.toFixed(2)}%
                              </span>
                              {isClose && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded border border-amber-500/30 font-bold">
                                  IMINENTE
                                </span>
                              )}
                            </div>
                            {/* Proximity Progress Bar */}
                            <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${
                                  isClose ? 'bg-amber-400' : isCrossAbove ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(8, 100 - Math.abs(distancePct) * 10))}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-neutral-500">-</span>
                        )}
                      </td>

                      {/* Note */}
                      <td className="py-3 px-3 text-neutral-400 max-w-[150px] truncate" title={alert.note || ''}>
                        {alert.note || <span className="text-neutral-600 italic">-</span>}
                      </td>

                      {/* Status Toggle / Badge */}
                      <td className="py-3 px-3 text-center">
                        {alert.triggered ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <BellRing className="w-3 h-3 text-amber-400" />
                            <span>Disparado</span>
                          </span>
                        ) : alert.active ? (
                          <button
                            onClick={() => handleToggleSingleActive(alert.id)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition"
                            title="Clique para pausar este alarme"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Ativo</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleSingleActive(alert.id)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-white/10 hover:bg-neutral-700 transition"
                            title="Clique para ativar este alarme"
                          >
                            <Pause className="w-2.5 h-2.5" />
                            <span>Pausado</span>
                          </button>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-3 text-neutral-500 text-[10px]" title={formatDateTime(alert.createdAt)}>
                        {formatTimeAgo(alert.createdAt)}
                      </td>

                      {/* Row Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {alert.triggered && (
                            <button
                              onClick={() => handleResetSingle(alert.id)}
                              className="p-1 rounded text-amber-400 hover:bg-amber-500/20 transition"
                              title="Rearmar alarme"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleToggleSingleActive(alert.id)}
                            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                            title={alert.active ? 'Pausar alarme' : 'Ativar alarme'}
                          >
                            {alert.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                          </button>

                          <button
                            onClick={() => handleDeleteSingle(alert.id)}
                            className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            title="Excluir alarme"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Info & Instructions */}
        <div className="p-3 sm:px-6 bg-[#070709] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-400 font-mono gap-2">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-orange-400" />
            <span>
              O SuperBot monitora continuamente os preços em tempo real com alertas sonoros e notificações na Área de Trabalho.
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span>Exibindo <strong>{filteredAlerts.length}</strong> de <strong>{alerts.length}</strong></span>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white font-bold transition"
            >
              Fechar (Esc)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
