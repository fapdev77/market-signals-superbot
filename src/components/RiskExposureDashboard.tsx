import React, { useState, useEffect, useMemo } from 'react';
import { 
  PortfolioPosition, 
  PortfolioRiskSummary, 
  SectorRiskExposure, 
  MarketSector, 
  TradeSignal, 
  TickerData 
} from '../types';
import { 
  SECTOR_METADATA, 
  calculatePortfolioRisk, 
  enrichPosition, 
  simulatePortfolioShock, 
  convertSignalToPosition, 
  getInitialSeedPositions,
  getAssetSectorAndBeta 
} from '../utils/riskCalculations';
import { formatPrice, formatPercent } from '../utils/formatters';
import { useToast } from './Toast';
import { Tooltip } from './Tooltip';
import { 
  ShieldAlert, 
  PieChart, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Sliders, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Percent, 
  Zap, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  Download, 
  Scale, 
  ArrowUpRight, 
  ArrowDownRight, 
  Info, 
  RotateCcw,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Filter,
  X
} from 'lucide-react';

interface RiskExposureDashboardProps {
  tickers: TickerData[];
  signals: TradeSignal[];
  onSelectTickerBySymbol: (symbol: string) => void;
}

const STORAGE_KEY_POSITIONS = 'superbot_portfolio_positions';
const STORAGE_KEY_EQUITY = 'superbot_portfolio_equity';

export const RiskExposureDashboard: React.FC<RiskExposureDashboardProps> = ({
  tickers,
  signals,
  onSelectTickerBySymbol
}) => {
  const { showToast } = useToast();

  // Portfolio capital / equity
  const [portfolioEquity, setPortfolioEquity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EQUITY);
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch {
      // ignore
    }
    return 10000;
  });

  const [isEditingEquity, setIsEditingEquity] = useState<boolean>(false);
  const [tempEquityInput, setTempEquityInput] = useState<string>(portfolioEquity.toString());

  // Positions in state
  const [positions, setPositions] = useState<PortfolioPosition[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POSITIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return getInitialSeedPositions(tickers);
  });

  // Aggregation View Mode
  // 'ALL_MERGED' = Real Positions + Active Signals
  // 'REAL_ONLY' = Only user's real open positions
  // 'SIGNALS_ONLY' = Only theoretical positions from active signals
  const [aggregationMode, setAggregationMode] = useState<'ALL_MERGED' | 'REAL_ONLY' | 'SIGNALS_ONLY'>('ALL_MERGED');

  // Filter and search
  const [sectorFilter, setSectorFilter] = useState<MarketSector | 'ALL'>('ALL');
  const [sideFilter, setSideFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Stress test interactive slider shock (-25% to +25%)
  const [customShockPct, setCustomShockPct] = useState<number>(0);

  // Position Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [modalSymbol, setModalSymbol] = useState<string>('BTCUSDT');
  const [modalDirection, setModalDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [modalMargin, setModalMargin] = useState<string>('500');
  const [modalLeverage, setModalLeverage] = useState<string>('10');
  const [modalEntryPrice, setModalEntryPrice] = useState<string>('');
  const [modalStopLoss, setModalStopLoss] = useState<string>('');
  const [modalTakeProfit1, setModalTakeProfit1] = useState<string>('');
  const [modalNotes, setModalNotes] = useState<string>('');

  // Persist positions
  const persistPositions = (newPositions: PortfolioPosition[]) => {
    setPositions(newPositions);
    try {
      localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(newPositions));
    } catch {
      // ignore
    }
  };

  // Sync positions live with latest ticker prices
  const enrichedPositions = useMemo(() => {
    const tickerPriceMap = new Map<string, number>();
    tickers.forEach(t => tickerPriceMap.set(t.symbol, t.price));

    return positions.map(p => {
      const curPrice = tickerPriceMap.get(p.symbol) || p.currentPrice;
      return enrichPosition({
        ...p,
        currentPrice: curPrice
      });
    });
  }, [positions, tickers]);

  // Synthetic positions derived from active signals
  const signalDerivedPositions = useMemo(() => {
    const activeSignals = signals.filter(s => s.status === 'ACTIVE');
    const tickerPriceMap = new Map<string, number>();
    tickers.forEach(t => tickerPriceMap.set(t.symbol, t.price));

    return activeSignals.map(sig => {
      const liveTicker = tickers.find(t => t.symbol === sig.symbol);
      return convertSignalToPosition(sig, liveTicker, 250, 10);
    });
  }, [signals, tickers]);

  // Combined positions based on aggregation mode
  const activeEffectivePositions = useMemo(() => {
    if (aggregationMode === 'REAL_ONLY') {
      return enrichedPositions;
    }
    if (aggregationMode === 'SIGNALS_ONLY') {
      return signalDerivedPositions;
    }
    // ALL_MERGED
    // Avoid double counting if the user already has a real position for the exact same symbol and direction
    const realKeys = new Set(enrichedPositions.map(p => `${p.symbol}_${p.direction}`));
    const uniqueSignals = signalDerivedPositions.filter(s => !realKeys.has(`${s.symbol}_${s.direction}`));
    return [...enrichedPositions, ...uniqueSignals];
  }, [aggregationMode, enrichedPositions, signalDerivedPositions]);

  // Comprehensive portfolio risk metrics
  const riskSummary: PortfolioRiskSummary = useMemo(() => {
    return calculatePortfolioRisk(activeEffectivePositions, portfolioEquity);
  }, [activeEffectivePositions, portfolioEquity]);

  // Filtered positions for the table
  const displayedPositions = useMemo(() => {
    return activeEffectivePositions.filter(p => {
      if (sectorFilter !== 'ALL' && p.sector !== sectorFilter) return false;
      if (sideFilter !== 'ALL' && p.direction !== sideFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSymbol = p.symbol.toLowerCase().includes(query);
        const matchesNotes = (p.notes || '').toLowerCase().includes(query);
        const matchesTag = (p.categoryTag || '').toLowerCase().includes(query);
        if (!matchesSymbol && !matchesNotes && !matchesTag) return false;
      }
      return true;
    });
  }, [activeEffectivePositions, sectorFilter, sideFilter, searchQuery]);

  // Stress testing scenarios
  const stressScenarios = useMemo(() => {
    const scenarios = [-10, -5, -2, 0, 2, 5, 10];
    return scenarios.map(shock => simulatePortfolioShock(activeEffectivePositions, portfolioEquity, shock));
  }, [activeEffectivePositions, portfolioEquity]);

  // Custom live slider stress result
  const customStressResult = useMemo(() => {
    return simulatePortfolioShock(activeEffectivePositions, portfolioEquity, customShockPct);
  }, [activeEffectivePositions, portfolioEquity, customShockPct]);

  // Handle Equity update
  const handleSaveEquity = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(tempEquityInput);
    if (!isNaN(val) && val > 0) {
      setPortfolioEquity(val);
      try {
        localStorage.setItem(STORAGE_KEY_EQUITY, val.toString());
      } catch {
        // ignore
      }
      setIsEditingEquity(false);
      showToast('success', 'Capital Atualizado', `Capital base do portfolio ajustado para $${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`);
    } else {
      showToast('error', 'Valor Inválido', 'Informe um valor numérico positivo para o capital.');
    }
  };

  // Open modal for new position
  const handleOpenNewPositionModal = () => {
    setEditingPositionId(null);
    const initialSymbol = tickers[0]?.symbol || 'BTCUSDT';
    const curTicker = tickers.find(t => t.symbol === initialSymbol);
    const curPrice = curTicker ? curTicker.price : 65000;

    setModalSymbol(initialSymbol);
    setModalDirection('LONG');
    setModalMargin('500');
    setModalLeverage('10');
    setModalEntryPrice(curPrice.toString());
    setModalStopLoss((curPrice * 0.975).toFixed(2));
    setModalTakeProfit1((curPrice * 1.05).toFixed(2));
    setModalNotes('');
    setIsModalOpen(true);
  };

  // Open modal for editing position
  const handleOpenEditPositionModal = (pos: PortfolioPosition) => {
    setEditingPositionId(pos.id);
    setModalSymbol(pos.symbol);
    setModalDirection(pos.direction);
    setModalMargin(pos.marginUsd.toFixed(2));
    setModalLeverage(pos.leverage.toString());
    setModalEntryPrice(pos.entryPrice.toString());
    setModalStopLoss(pos.stopLoss ? pos.stopLoss.toString() : '');
    setModalTakeProfit1(pos.takeProfit1 ? pos.takeProfit1.toString() : '');
    setModalNotes(pos.notes || '');
    setIsModalOpen(true);
  };

  // When symbol changes in modal, auto fill current price and smart stops
  const handleModalSymbolChange = (sym: string) => {
    setModalSymbol(sym);
    const curTicker = tickers.find(t => t.symbol === sym);
    if (curTicker) {
      const p = curTicker.price;
      setModalEntryPrice(p.toString());
      const isLong = modalDirection === 'LONG';
      setModalStopLoss((isLong ? p * 0.975 : p * 1.025).toFixed(p < 1 ? 6 : 2));
      setModalTakeProfit1((isLong ? p * 1.05 : p * 0.95).toFixed(p < 1 ? 6 : 2));
    }
  };

  // Save Position from Modal
  const handleSaveModalPosition = (e: React.FormEvent) => {
    e.preventDefault();
    const margin = parseFloat(modalMargin);
    const lev = parseFloat(modalLeverage);
    const entry = parseFloat(modalEntryPrice);
    const stop = modalStopLoss ? parseFloat(modalStopLoss) : undefined;
    const tp1 = modalTakeProfit1 ? parseFloat(modalTakeProfit1) : undefined;

    if (isNaN(margin) || margin <= 0 || isNaN(lev) || lev <= 0 || isNaN(entry) || entry <= 0) {
      showToast('error', 'Campos Inválidos', 'Verifique margem, alavancagem e preço de entrada.');
      return;
    }

    const curTicker = tickers.find(t => t.symbol === modalSymbol);
    const currentPrice = curTicker ? curTicker.price : entry;
    const notional = margin * lev;
    const quantity = notional / entry;

    if (editingPositionId) {
      const updated = positions.map(p => {
        if (p.id === editingPositionId) {
          return enrichPosition({
            ...p,
            symbol: modalSymbol,
            direction: modalDirection,
            entryPrice: entry,
            currentPrice,
            quantity,
            leverage: lev,
            stopLoss: stop,
            takeProfit1: tp1,
            notes: modalNotes
          });
        }
        return p;
      });
      persistPositions(updated);
      showToast('success', 'Posição Atualizada', `Posição em ${modalSymbol} recalculada com sucesso.`);
    } else {
      const newPos = enrichPosition({
        id: `user-pos-${Date.now()}`,
        symbol: modalSymbol,
        direction: modalDirection,
        entryPrice: entry,
        currentPrice,
        quantity,
        leverage: lev,
        stopLoss: stop,
        takeProfit1: tp1,
        openedAt: Date.now(),
        notes: modalNotes
      });
      persistPositions([newPos, ...positions]);
      showToast('success', 'Posição Registrada', `Nova posição de ${modalDirection} em ${modalSymbol} adicionada ao portfolio.`);
    }

    setIsModalOpen(false);
  };

  // Delete position
  const handleDeletePosition = (id: string, symbol: string) => {
    const updated = positions.filter(p => p.id !== id);
    persistPositions(updated);
    showToast('info', 'Posição Encerrada', `Posição em ${symbol} removida do portfolio.`);
  };

  // Reset to Seed Positions
  const handleResetToSeed = () => {
    const seed = getInitialSeedPositions(tickers);
    persistPositions(seed);
    showToast('success', 'Portfolio Resetado', 'Carteira redefinida para os ativos padrão de referência quantitativa.');
  };

  // Export JSON Report
  const handleExportRiskReport = () => {
    try {
      const report = {
        generatedAt: new Date().toISOString(),
        portfolioEquity,
        riskSummary,
        positions: activeEffectivePositions
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `risk_exposure_report_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('success', 'Relatório Exportado', 'Arquivo JSON de exposição de risco baixado.');
    } catch {
      showToast('error', 'Falha na Exportação', 'Não foi possível exportar os dados do portfolio.');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Overview Bar */}
      <div className="bg-[#050505] rounded-2xl border border-white/10 p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        {/* Background glow ambient */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-cyan-500/30 text-cyan-400 shadow-inner">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black text-white tracking-wide uppercase font-mono">
                  Risk Exposure Dashboard
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono uppercase">
                  Institutional Greeks
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                  riskSummary.directionalBias.includes('LONG') 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : riskSummary.directionalBias.includes('SHORT')
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-neutral-800 text-neutral-300 border border-white/10'
                }`}>
                  {riskSummary.directionalBias.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-sans mt-0.5">
                Análise agregada de Delta Líquido ($\Delta$), Convexidade Gamma ($\Gamma$), Value at Risk (VaR) e Concentração por Setores de Mercado.
              </p>
            </div>
          </div>

          {/* Capital Setting & Global Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Capital Box */}
            <div className="bg-[#090909] px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
              <span className="text-[10px] text-neutral-400 font-mono uppercase">Capital Base:</span>
              {isEditingEquity ? (
                <form onSubmit={handleSaveEquity} className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={tempEquityInput}
                    onChange={(e) => setTempEquityInput(e.target.value)}
                    className="w-24 bg-black border border-cyan-500/50 rounded px-1.5 py-0.5 text-xs text-white font-mono focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-bold text-[10px]"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingEquity(false)}
                    className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 text-[10px]"
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <div 
                  onClick={() => {
                    setTempEquityInput(portfolioEquity.toString());
                    setIsEditingEquity(true);
                  }}
                  className="flex items-center gap-1.5 cursor-pointer group"
                  title="Clique para editar o capital base do portfolio"
                >
                  <strong className="text-white font-mono text-sm group-hover:text-cyan-400 transition">
                    ${portfolioEquity.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </strong>
                  <Edit3 className="w-3 h-3 text-neutral-500 group-hover:text-cyan-400 transition" />
                </div>
              )}
            </div>

            {/* Aggregation Mode Selector */}
            <div className="bg-[#090909] p-1 rounded-xl border border-white/10 flex items-center text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setAggregationMode('ALL_MERGED')}
                className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                  aggregationMode === 'ALL_MERGED'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Posições + Sinais ({activeEffectivePositions.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setAggregationMode('REAL_ONLY')}
                className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                  aggregationMode === 'REAL_ONLY'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                <span>Apenas Carteira ({enrichedPositions.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setAggregationMode('SIGNALS_ONLY')}
                className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                  aggregationMode === 'SIGNALS_ONLY'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Sinais Teóricos ({signalDerivedPositions.length})</span>
              </button>
            </div>

            {/* Add Position Button */}
            <button
              type="button"
              onClick={handleOpenNewPositionModal}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs font-mono flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition transform active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Posição</span>
            </button>

            {/* Quick Actions Dropdown / Tools */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetToSeed}
                title="Redefinir posições para carteira padrão de teste"
                className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-white/5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleExportRiskReport}
                title="Exportar Relatório JSON Completo"
                className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-white/5 transition"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 6 High-Impact Institutional Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mt-4">
          {/* Card 1: Net Delta Exposure */}
          <div className="bg-[#090909] p-3.5 rounded-xl border border-white/5 relative overflow-hidden group hover:border-cyan-500/30 transition">
            <div className="flex items-center justify-between text-[10px] text-neutral-400 uppercase font-mono">
              <span>Delta Líquido ($\Delta$)</span>
              <Tooltip content="Delta em dólar: representa a variação monetária direta do portfolio caso o mercado suba 100% linearmente.">
                <Info className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400" />
              </Tooltip>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={`text-xl font-black font-mono tracking-tight ${
                riskSummary.netDeltaUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {riskSummary.netDeltaUsd >= 0 ? '+' : ''}${riskSummary.netDeltaUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-neutral-400 border-t border-white/5 pt-1.5">
              <span>Sensibilidade 1%:</span>
              <span className="font-bold text-white">
                {riskSummary.netDeltaUsd >= 0 ? '+' : ''}${(riskSummary.netDeltaUsd * 0.01).toFixed(1)}
              </span>
            </div>
          </div>

          {/* Card 2: Beta-Weighted Delta (BTC-Equiv) */}
          <div className="bg-[#090909] p-3.5 rounded-xl border border-white/5 relative overflow-hidden group hover:border-cyan-500/30 transition">
            <div className="flex items-center justify-between text-[10px] text-neutral-400 uppercase font-mono">
              <span>Delta Beta ($\Delta_\beta$)</span>
              <Tooltip content="Delta ponderado pelo Beta em relação ao Bitcoin. Normaliza a volatilidade dos altcoins para o equivalente em BTC.">
                <Info className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400" />
              </Tooltip>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={`text-xl font-black font-mono tracking-tight ${
                riskSummary.betaWeightedDeltaUsd >= 0 ? 'text-cyan-400' : 'text-amber-400'
              }`}>
                {riskSummary.betaWeightedDeltaUsd >= 0 ? '+' : ''}${riskSummary.betaWeightedDeltaUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-neutral-400 border-t border-white/5 pt-1.5">
              <span>Beta Médio Portfolio:</span>
              <span className="font-bold text-white">{riskSummary.portfolioBeta.toFixed(2)}x</span>
            </div>
          </div>

          {/* Card 3: Portfolio Gamma Convexity */}
          <div className="bg-[#090909] p-3.5 rounded-xl border border-white/5 relative overflow-hidden group hover:border-cyan-500/30 transition">
            <div className="flex items-center justify-between text-[10px] text-neutral-400 uppercase font-mono">
              <span>Gamma ($\Gamma$ Convexidade)</span>
              <Tooltip content="Sensibilidade não linear e aceleração do Delta por variação percentual dos ativos próximos aos clusters de stop-loss e barreiras.">
                <Info className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400" />
              </Tooltip>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black font-mono tracking-tight text-purple-400">
                ${riskSummary.portfolioGammaUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className={`text-[9px] px-1 rounded font-bold uppercase font-mono ${
                riskSummary.gammaRiskLevel === 'HIGH' ? 'bg-rose-500/20 text-rose-300' :
                riskSummary.gammaRiskLevel === 'ELEVATED' ? 'bg-amber-500/20 text-amber-300' :
                'bg-neutral-800 text-neutral-300'
              }`}>
                {riskSummary.gammaRiskLevel}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-neutral-400 border-t border-white/5 pt-1.5">
              <span>Aceleração por 1%:</span>
              <span className="font-bold text-white">~${(riskSummary.portfolioGammaUsd * 0.05).toFixed(1)}/pct</span>
            </div>
          </div>

          {/* Card 4: Gross Notional & Leverage */}
          <div className="bg-[#090909] p-3.5 rounded-xl border border-white/5 relative overflow-hidden group hover:border-cyan-500/30 transition">
            <div className="flex items-center justify-between text-[10px] text-neutral-400 uppercase font-mono">
              <span>Notional Bruto</span>
              <Tooltip content="Valor total somado de todas as posições compradas e vendidas abertas, antes da margem.">
                <Info className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400" />
              </Tooltip>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black font-mono tracking-tight text-white">
                ${riskSummary.grossNotionalUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-neutral-400 border-t border-white/5 pt-1.5">
              <span>Alavancagem Real:</span>
              <span className="font-bold text-cyan-400">{riskSummary.effectiveLeverage.toFixed(2)}x</span>
            </div>
          </div>

          {/* Card 5: Value at Risk (VaR 95% Daily) */}
          <div className="bg-[#090909] p-3.5 rounded-xl border border-white/5 relative overflow-hidden group hover:border-cyan-500/30 transition">
            <div className="flex items-center justify-between text-[10px] text-neutral-400 uppercase font-mono">
              <span>VaR 95% (1 Dia)</span>
              <Tooltip content="Perda máxima estatística esperada em 1 dia sob condições normais de mercado com 95% de confiança quantitativa.">
                <Info className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400" />
              </Tooltip>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black font-mono tracking-tight text-amber-400">
                -${riskSummary.var95DailyUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                ({portfolioEquity > 0 ? ((riskSummary.var95DailyUsd / portfolioEquity) * 100).toFixed(1) : 0}%)
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-neutral-400 border-t border-white/5 pt-1.5">
              <span>VaR 99% Stress:</span>
              <span className="font-bold text-rose-400">-${riskSummary.var99DailyUsd.toFixed(0)}</span>
            </div>
          </div>

          {/* Card 6: Unrealized PnL & Worst-Case Stop */}
          <div className="bg-[#090909] p-3.5 rounded-xl border border-white/5 relative overflow-hidden group hover:border-cyan-500/30 transition">
            <div className="flex items-center justify-between text-[10px] text-neutral-400 uppercase font-mono">
              <span>PnL Atual Não Realizado</span>
              <Tooltip content="Soma do lucro/prejuízo flutuante de todas as posições ativas da carteira.">
                <Info className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400" />
              </Tooltip>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={`text-xl font-black font-mono tracking-tight ${
                riskSummary.totalUnrealizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {riskSummary.totalUnrealizedPnlUsd >= 0 ? '+' : ''}${riskSummary.totalUnrealizedPnlUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-[10px] font-mono font-bold ${
                riskSummary.totalUnrealizedPnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                ({riskSummary.totalUnrealizedPnlPct >= 0 ? '+' : ''}{riskSummary.totalUnrealizedPnlPct.toFixed(2)}%)
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-neutral-400 border-t border-white/5 pt-1.5">
              <span>Risco Total Stops:</span>
              <span className="font-bold text-rose-400">-${riskSummary.maxStopLossLossUsd.toFixed(0)} ({riskSummary.maxStopLossLossPct.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sector Exposure Breakdown & Macro Stress Test Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Sector Distribution & Concentration Analysis */}
        <div className="lg:col-span-2 bg-[#050505] rounded-2xl border border-white/10 p-5 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase font-mono tracking-wider">
                  Exposição e Concentração por Setores de Mercado
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Distribuição de capital notional, viés direcional e peso percentual por narrativa cripto & tradfi.
                </p>
              </div>
            </div>

            {riskSummary.sectorBreakdown.some(s => s.concentrationWarning) && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Alerta: Concentração Setorial Elevada (&gt;40%)</span>
              </div>
            )}
          </div>

          {/* Visual Sector Bar Allocator */}
          {riskSummary.grossNotionalUsd > 0 ? (
            <div className="space-y-2">
              <div className="flex h-4 w-full rounded-lg overflow-hidden bg-neutral-900 border border-white/5">
                {riskSummary.sectorBreakdown.map((sec) => (
                  <div
                    key={sec.sector}
                    style={{ 
                      width: `${Math.max(2, sec.grossNotionalPct)}%`,
                      backgroundColor: SECTOR_METADATA[sec.sector]?.color || '#6366f1'
                    }}
                    title={`${sec.sectorName}: ${sec.grossNotionalPct.toFixed(1)}% ($${sec.grossNotionalUsd.toFixed(0)})`}
                    className="h-full transition-all relative group cursor-pointer"
                  />
                ))}
              </div>

              {/* Legend with percentages */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
                {riskSummary.sectorBreakdown.map(sec => (
                  <div key={sec.sector} className="flex items-center gap-1.5">
                    <span 
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: SECTOR_METADATA[sec.sector]?.color || '#6366f1' }}
                    />
                    <span className="text-neutral-300">{sec.sectorName}:</span>
                    <strong className="text-white">{sec.grossNotionalPct.toFixed(1)}%</strong>
                    <span className="text-[10px] text-neutral-500">(${sec.grossNotionalUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-neutral-500 font-mono">
              Nenhuma posição aberta no momento para compor a análise setorial.
            </div>
          )}

          {/* Sector Detailed Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {riskSummary.sectorBreakdown.map((sec) => {
              const meta = SECTOR_METADATA[sec.sector] || SECTOR_METADATA.L1_L2;
              const netLong = sec.netDeltaUsd >= 0;
              return (
                <div 
                  key={sec.sector}
                  className={`p-3.5 rounded-xl border transition ${
                    sec.concentrationWarning 
                      ? 'bg-amber-950/10 border-amber-500/30' 
                      : 'bg-[#090909] border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="font-bold text-xs text-white font-mono">{sec.sectorName}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">({sec.positionsCount} pos)</span>
                    </div>

                    <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                      netLong ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {netLong ? '▲ NET LONG' : '▼ NET SHORT'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-2.5 text-center font-mono">
                    <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                      <span className="text-[9.5px] text-neutral-400 uppercase block">Notional</span>
                      <strong className="text-white text-xs">
                        ${sec.grossNotionalUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </strong>
                    </div>
                    <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                      <span className="text-[9.5px] text-neutral-400 uppercase block">Delta Setorial</span>
                      <strong className={`text-xs ${netLong ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {netLong ? '+' : ''}${sec.netDeltaUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </strong>
                    </div>
                    <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                      <span className="text-[9.5px] text-neutral-400 uppercase block">PnL Aberto</span>
                      <strong className={`text-xs ${sec.unrealizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {sec.unrealizedPnlUsd >= 0 ? '+' : ''}${sec.unrealizedPnlUsd.toFixed(1)}
                      </strong>
                    </div>
                  </div>

                  {/* Long vs Short bar */}
                  <div className="mt-2.5 space-y-1 text-[10px] font-mono">
                    <div className="flex justify-between text-neutral-400">
                      <span className="text-emerald-400">Long: ${sec.longNotionalUsd.toFixed(0)}</span>
                      <span className="text-rose-400">Short: ${sec.shortNotionalUsd.toFixed(0)}</span>
                    </div>
                    <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-neutral-800">
                      <div 
                        style={{ width: `${sec.grossNotionalUsd > 0 ? (sec.longNotionalUsd / sec.grossNotionalUsd) * 100 : 50}%` }}
                        className="bg-emerald-500 h-full"
                      />
                      <div 
                        style={{ width: `${sec.grossNotionalUsd > 0 ? (sec.shortNotionalUsd / sec.grossNotionalUsd) * 100 : 50}%` }}
                        className="bg-rose-500 h-full"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Macro Stress Testing & Shock Matrix */}
        <div className="bg-[#050505] rounded-2xl border border-white/10 p-5 shadow-2xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase font-mono tracking-wider">
                  Simulador de Choque & Stress Test
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Impacto estimado no patrimônio para variações macro sistêmicas no Bitcoin e altcoins.
                </p>
              </div>
            </div>

            {/* Interactive Live Slider */}
            <div className="mt-4 p-3.5 rounded-xl bg-[#090909] border border-white/5 space-y-3 font-mono">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400 uppercase text-[10px]">Simular Choque de Mercado:</span>
                <strong className={`px-2 py-0.5 rounded text-xs font-black ${
                  customShockPct > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  customShockPct < 0 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                  'bg-neutral-800 text-neutral-300'
                }`}>
                  {customShockPct > 0 ? '+' : ''}{customShockPct}%
                </strong>
              </div>

              <input
                type="range"
                min="-25"
                max="25"
                step="1"
                value={customShockPct}
                onChange={(e) => setCustomShockPct(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />

              <div className="flex justify-between text-[9px] text-neutral-500">
                <span>-25% (Crash)</span>
                <span>0% (Neutro)</span>
                <span>+25% (Super Rally)</span>
              </div>

              {/* Dynamic Result Display */}
              <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-center">
                <div className="bg-black/60 p-2 rounded-lg border border-white/5">
                  <span className="text-[9.5px] text-neutral-400 uppercase block">Impacto PnL</span>
                  <strong className={`text-sm font-black ${
                    customStressResult.estimatedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {customStressResult.estimatedPnlUsd >= 0 ? '+' : ''}${customStressResult.estimatedPnlUsd.toFixed(1)}
                  </strong>
                  <span className={`text-[10px] block ${
                    customStressResult.estimatedPnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    ({customStressResult.estimatedPnlPct >= 0 ? '+' : ''}{customStressResult.estimatedPnlPct.toFixed(2)}%)
                  </span>
                </div>
                <div className="bg-black/60 p-2 rounded-lg border border-white/5">
                  <span className="text-[9.5px] text-neutral-400 uppercase block">Novo Capital Est.</span>
                  <strong className="text-white text-sm font-black">
                    ${customStressResult.newEquity.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </strong>
                  <span className="text-[9.5px] text-neutral-500 block">
                    {customStressResult.stoppedOutCount} stop(s) atingido(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Standard Scenario Table */}
            <div className="mt-4 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                Matriz de Cenários Predefinidos:
              </span>
              <div className="space-y-1">
                {stressScenarios.map((scen) => (
                  <div 
                    key={scen.shockPct}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#090909] border border-white/5 text-[11px]"
                  >
                    <span className={`font-bold w-12 ${
                      scen.shockPct > 0 ? 'text-emerald-400' : scen.shockPct < 0 ? 'text-rose-400' : 'text-neutral-400'
                    }`}>
                      {scen.shockPct > 0 ? '+' : ''}{scen.shockPct}%
                    </span>
                    <span className={`font-mono font-bold ${
                      scen.estimatedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {scen.estimatedPnlUsd >= 0 ? '+' : ''}${scen.estimatedPnlUsd.toFixed(0)} ({scen.estimatedPnlPct >= 0 ? '+' : ''}{scen.estimatedPnlPct.toFixed(1)}%)
                    </span>
                    <span className="text-neutral-400 text-[10px]">
                      Patrimônio: ${scen.newEquity.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-[11px] text-cyan-300 font-sans mt-2">
            💡 <strong>Dica Quant:</strong> Se o seu Delta $\Delta_\beta$ estiver excessivamente inclinado para o lado comprado, posições táticas SHORT em ativos de alta correlação ou compras de ouro (XAU) reduzem o VaR diário sem necessidade de fechar posições longas principais.
          </div>
        </div>
      </div>

      {/* Unified Positions & Signals Matrix Table */}
      <div className="bg-[#050505] rounded-2xl border border-white/10 p-5 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase font-mono tracking-wider">
                Matriz Unificada de Posições & Sinais Abertos ({displayedPositions.length})
              </h3>
              <p className="text-[11px] text-neutral-400">
                Detalhamento individual de cotações, alavancagem, Delta, Gamma, Stop Loss e retorno não realizado (ROE).
              </p>
            </div>
          </div>

          {/* Table Filters & Search */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {/* Search input */}
            <input
              type="text"
              placeholder="Buscar por símbolo ou nota..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1 text-white text-[11px] placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500 w-44"
            />

            {/* Sector Filter */}
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value as any)}
              className="bg-neutral-900 border border-white/10 rounded-lg px-2 py-1 text-white text-[11px] focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">Todos os Setores</option>
              <option value="L1_L2">Layer 1 & 2</option>
              <option value="DEFI">DeFi</option>
              <option value="AI">Inteligência Artificial</option>
              <option value="MEME">Meme & High Beta</option>
              <option value="TRADFI">TradFi / Ouro</option>
            </select>

            {/* Side Filter */}
            <div className="flex items-center bg-neutral-900 p-0.5 rounded-lg border border-white/10 text-[10px]">
              <button
                type="button"
                onClick={() => setSideFilter('ALL')}
                className={`px-2 py-0.5 rounded font-bold transition ${
                  sideFilter === 'ALL' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setSideFilter('LONG')}
                className={`px-2 py-0.5 rounded font-bold transition ${
                  sideFilter === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'text-neutral-500 hover:text-white'
                }`}
              >
                Longs
              </button>
              <button
                type="button"
                onClick={() => setSideFilter('SHORT')}
                className={`px-2 py-0.5 rounded font-bold transition ${
                  sideFilter === 'SHORT' ? 'bg-rose-500/20 text-rose-400' : 'text-neutral-500 hover:text-white'
                }`}
              >
                Shorts
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/10 text-neutral-400 text-[10px] uppercase">
                <th className="py-2.5 px-3">Ativo & Setor</th>
                <th className="py-2.5 px-3">Direção / Alav.</th>
                <th className="py-2.5 px-3">Entrada / Atual</th>
                <th className="py-2.5 px-3">Tamanho / Notional</th>
                <th className="py-2.5 px-3">Stop Loss</th>
                <th className="py-2.5 px-3">Delta ($\Delta$)</th>
                <th className="py-2.5 px-3">Gamma ($\Gamma$)</th>
                <th className="py-2.5 px-3">PnL Aberto (ROE)</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {displayedPositions.length > 0 ? (
                displayedPositions.map((pos) => {
                  const isLong = pos.direction === 'LONG';
                  const secMeta = SECTOR_METADATA[pos.sector] || SECTOR_METADATA.L1_L2;

                  return (
                    <tr key={pos.id} className="hover:bg-white/[0.02] transition group">
                      {/* Ativo & Setor */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectTickerBySymbol(pos.symbol)}
                            className="font-bold text-white hover:text-cyan-400 transition flex items-center gap-1"
                            title="Abrir gráfico detalhado deste ativo"
                          >
                            <span>{pos.symbol}</span>
                            <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-cyan-400 transition opacity-0 group-hover:opacity-100" />
                          </button>
                          {pos.isSyntheticFromSignal && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              Sinal
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: secMeta.color }}
                          />
                          <span className="text-[10px] text-neutral-400">{secMeta.name}</span>
                          <span className="text-[9.5px] text-neutral-500">· $\beta$ {pos.beta.toFixed(2)}</span>
                        </div>
                        {pos.notes && (
                          <p className="text-[9.5px] text-neutral-500 italic truncate max-w-xs mt-0.5">
                            "{pos.notes}"
                          </p>
                        )}
                      </td>

                      {/* Direção / Alav. */}
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isLong 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {pos.direction} {pos.leverage}x
                        </span>
                      </td>

                      {/* Entrada / Atual */}
                      <td className="py-3 px-3">
                        <div className="text-white font-bold">
                          {formatPrice(pos.entryPrice, { currency: true })}
                        </div>
                        <div className="text-[10px] text-neutral-400 flex items-center gap-1">
                          <span>Atual:</span>
                          <strong className="text-neutral-300">{formatPrice(pos.currentPrice, { currency: true })}</strong>
                        </div>
                      </td>

                      {/* Tamanho / Notional */}
                      <td className="py-3 px-3">
                        <div className="text-white font-bold">
                          ${pos.notionalUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          Margem: ${pos.marginUsd.toFixed(0)}
                        </div>
                      </td>

                      {/* Stop Loss */}
                      <td className="py-3 px-3">
                        {pos.stopLoss ? (
                          <div>
                            <span className="text-rose-400 font-bold">
                              {formatPrice(pos.stopLoss, { currency: true })}
                            </span>
                            {pos.maxLossAtStopUsd && (
                              <span className="text-[9.5px] text-neutral-500 block">
                                Risco: -${pos.maxLossAtStopUsd.toFixed(0)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-500 text-[10px] italic">Sem Stop</span>
                        )}
                      </td>

                      {/* Delta */}
                      <td className="py-3 px-3">
                        <div className={`font-bold ${pos.deltaUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pos.deltaUsd >= 0 ? '+' : ''}${pos.deltaUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[9.5px] text-neutral-500">
                          $\Delta_\beta$: ${(pos.betaWeightedDeltaUsd).toFixed(0)}
                        </div>
                      </td>

                      {/* Gamma */}
                      <td className="py-3 px-3">
                        <span className="text-purple-400 font-bold">
                          ${pos.gammaUsd.toFixed(0)}
                        </span>
                        <span className="text-[9.5px] text-neutral-500 block">
                          {(pos.gammaUsd / (pos.notionalUsd || 1) * 100).toFixed(1)}% conv.
                        </span>
                      </td>

                      {/* PnL Aberto (ROE) */}
                      <td className="py-3 px-3">
                        <div className={`font-bold text-sm ${
                          pos.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                        </div>
                        <div className={`text-[10px] font-bold ${
                          pos.roePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          ROE: {pos.roePct >= 0 ? '+' : ''}{pos.roePct.toFixed(1)}%
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!pos.isSyntheticFromSignal && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditPositionModal(pos)}
                              title="Editar parâmetros desta posição"
                              className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!pos.isSyntheticFromSignal ? (
                            <button
                              type="button"
                              onClick={() => handleDeletePosition(pos.id, pos.symbol)}
                              title="Encerrar/Remover posição"
                              className="p-1 rounded hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[9.5px] text-neutral-500 italic">Automático</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-neutral-500 font-mono">
                    Nenhuma posição correspondente aos filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Drawer for Creating or Editing Position */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border border-white/15 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-white uppercase font-mono">
                  {editingPositionId ? 'Editar Posição na Carteira' : 'Registrar Nova Posição no Portfolio'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-white transition p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModalPosition} className="p-5 space-y-4 font-mono text-xs">
              {/* Asset Selector & Direction */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-neutral-400 uppercase block mb-1">
                    Ativo (Ticker)
                  </label>
                  <select
                    value={modalSymbol}
                    onChange={(e) => handleModalSymbolChange(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/15 rounded-lg px-2.5 py-2 text-white font-bold focus:outline-none focus:border-cyan-500"
                  >
                    {tickers.map(t => (
                      <option key={t.symbol} value={t.symbol}>
                        {t.symbol} (${formatPrice(t.price)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-neutral-400 uppercase block mb-1">
                    Direção (Side)
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-neutral-900 p-1 rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => setModalDirection('LONG')}
                      className={`py-1.5 rounded font-bold transition text-xs ${
                        modalDirection === 'LONG'
                          ? 'bg-emerald-500 text-slate-950 shadow'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      LONG ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalDirection('SHORT')}
                      className={`py-1.5 rounded font-bold transition text-xs ${
                        modalDirection === 'SHORT'
                          ? 'bg-rose-500 text-white shadow'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      SHORT ▼
                    </button>
                  </div>
                </div>
              </div>

              {/* Margin & Leverage */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-neutral-400 uppercase block mb-1">
                    Margem Alocada (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-neutral-500">$</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={modalMargin}
                      onChange={(e) => setModalMargin(e.target.value)}
                      placeholder="500"
                      className="w-full bg-neutral-900 border border-white/15 rounded-lg pl-6 pr-2.5 py-2 text-white font-bold focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-neutral-400 uppercase block mb-1">
                    Alavancagem
                  </label>
                  <select
                    value={modalLeverage}
                    onChange={(e) => setModalLeverage(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/15 rounded-lg px-2.5 py-2 text-white font-bold focus:outline-none focus:border-cyan-500"
                  >
                    {[1, 2, 3, 5, 8, 10, 15, 20, 25, 50].map(lev => (
                      <option key={lev} value={lev}>{lev}x Alavancado</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Entry Price & Stop Loss */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-neutral-400 uppercase block mb-1">
                    Preço de Entrada
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={modalEntryPrice}
                    onChange={(e) => setModalEntryPrice(e.target.value)}
                    placeholder="Ex: 65400"
                    className="w-full bg-neutral-900 border border-white/15 rounded-lg px-2.5 py-2 text-white font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-neutral-400 uppercase block mb-1">
                    Preço de Stop Loss (Opcional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={modalStopLoss}
                    onChange={(e) => setModalStopLoss(e.target.value)}
                    placeholder="Ex: 63800"
                    className="w-full bg-neutral-900 border border-white/15 rounded-lg px-2.5 py-2 text-rose-300 font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] text-neutral-400 uppercase block mb-1">
                  Notas da Tese / Estratégia
                </label>
                <input
                  type="text"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Ex: Rompimento de VAH com confluência de Delta CVD"
                  className="w-full bg-neutral-900 border border-white/15 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Summary of Notional and Greek Impact */}
              {parseFloat(modalMargin) > 0 && parseFloat(modalLeverage) > 0 && (
                <div className="bg-black/60 p-3 rounded-xl border border-white/10 space-y-1 text-[11px]">
                  <div className="flex justify-between text-neutral-400">
                    <span>Tamanho Notional Total:</span>
                    <strong className="text-white">
                      ${(parseFloat(modalMargin) * parseFloat(modalLeverage)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Delta Direcional:</span>
                    <strong className={modalDirection === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}>
                      {modalDirection === 'LONG' ? '+' : '-'}${(parseFloat(modalMargin) * parseFloat(modalLeverage)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black transition shadow-lg shadow-cyan-500/20"
                >
                  {editingPositionId ? 'Salvar Alterações' : 'Adicionar ao Portfolio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
