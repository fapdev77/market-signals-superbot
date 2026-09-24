import React, { useState, useMemo } from 'react';
import { 
  TickerData, 
  TradeSignal, 
  AIReviewResponse, 
  PaperPositionSide, 
  PaperOrderType, 
  PaperTradeExitReason,
  PaperPosition,
  PaperOrder,
  PaperTradeRecord
} from '../types';
import { 
  formatPrice, 
  formatPriceRange, 
  formatPercent, 
  formatCompactNumber, 
  formatDateTime, 
  formatTimeAgo 
} from '../utils/formatters';
import { usePaperTrading } from '../hooks/usePaperTrading';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Target, 
  Zap, 
  RotateCcw, 
  Sliders, 
  ChevronDown, 
  ChevronUp, 
  XCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Layers, 
  FileText, 
  Download, 
  Sparkles, 
  Percent, 
  ArrowUpRight, 
  ArrowDownRight,
  HelpCircle,
  BarChart2,
  Trash2,
  Lock,
  Crosshair,
  Award,
  Wallet,
  Search,
  Filter,
  Check,
  X,
  History,
  Activity,
  ArrowUpDown
} from 'lucide-react';
import { Tooltip } from './Tooltip';
import { useToast } from './Toast';
import { PaperTradingEquityCurveD3 } from './PaperTradingEquityCurveD3';

interface PaperTradingSandboxProps {
  ticker: TickerData;
  allTickers: TickerData[];
  activeSignal: TradeSignal | null;
  aiReview: AIReviewResponse | null;
  onSelectTickerBySymbol?: (symbol: string) => void;
}

export const PaperTradingSandbox: React.FC<PaperTradingSandboxProps> = ({
  ticker,
  allTickers = [],
  activeSignal,
  aiReview,
  onSelectTickerBySymbol
}) => {
  const { showToast } = useToast();
  const baseAsset = ticker.baseAsset || ticker.symbol.replace(/USDT|BUSD|USDC/g, '');

  const {
    accountState,
    currentTickerPositions,
    currentTickerPendingOrders,
    currentTickerTrades,
    feeTiers,
    activeFeeRates,
    executeMarket,
    placeOrder,
    closePos,
    cancelOrder,
    updateTpSl,
    resetSandbox,
    clearHistory,
    updateSettings
  } = usePaperTrading(allTickers, ticker.symbol);

  // UI state
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showEquityCurve, setShowEquityCurve] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'analytics'>('positions');
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showEditTpSlModal, setShowEditTpSlModal] = useState<PaperPosition | null>(null);

  // Order Form State
  const [orderType, setOrderType] = useState<PaperOrderType>('MARKET');
  const [side, setSide] = useState<PaperPositionSide>('LONG');
  const [leverage, setLeverage] = useState<number>(10);
  const [marginUsd, setMarginUsd] = useState<number>(250);
  const [limitPrice, setLimitPrice] = useState<number>(ticker.price);
  const [stopPrice, setStopPrice] = useState<number>(ticker.price);
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Log Table Filter & Search State
  const [logFilter, setLogFilter] = useState<'ALL' | 'CURRENT_TICKER' | 'WINS' | 'LOSSES' | 'TP' | 'SL' | 'LIQ'>('ALL');
  const [logSearch, setLogSearch] = useState<string>('');
  const [logSortBy, setLogSortBy] = useState<'NEWEST' | 'OLDEST' | 'PNL_DESC' | 'PNL_ASC' | 'ROE_DESC'>('NEWEST');

  // Settings Modal State
  const [resetBalanceInput, setResetBalanceInput] = useState<number>(10000);
  const [selectedFeeTierId, setSelectedFeeTierId] = useState<string>(accountState.settings.feeTierId);
  const [slippageSetting, setSlippageSetting] = useState<number>(accountState.settings.slippagePct);

  // Edit TP/SL Modal state
  const [editSlInput, setEditSlInput] = useState<string>('');
  const [editTpInput, setEditTpInput] = useState<string>('');

  // Sincronizar preço limite com preço atual se o ticker mudar e tipo for Limit
  React.useEffect(() => {
    if (orderType === 'LIMIT' && (!limitPrice || limitPrice === 0)) {
      setLimitPrice(ticker.price);
    }
  }, [ticker.price, orderType, limitPrice]);

  // Sincronização em 1-clique com o Sinal Quant ou Auditoria de IA
  const handleSyncWithSignal = (source: 'QUANT' | 'AI') => {
    if (source === 'AI' && aiReview) {
      const dir: PaperPositionSide = aiReview.recommendedDirection === 'SHORT' ? 'SHORT' : 'LONG';
      setSide(dir);
      if (aiReview.stopLoss) setStopLoss(aiReview.stopLoss.toString());
      if (aiReview.takeProfit1) setTakeProfit(aiReview.takeProfit1.toString());
      if (aiReview.entryZone && aiReview.entryZone[0]) {
        const avgEntry = (aiReview.entryZone[0] + aiReview.entryZone[1]) / 2;
        setLimitPrice(avgEntry);
      }
      setNotes(`Executado via Auditoria IA (${aiReview.confidenceScore}% Conf)`);
      showToast('success', 'Parâmetros sincronizados com a Auditoria IA!');
    } else if (source === 'QUANT' && activeSignal) {
      setSide(activeSignal.direction);
      if (activeSignal.stopLoss) setStopLoss(activeSignal.stopLoss.toString());
      if (activeSignal.target1) setTakeProfit(activeSignal.target1.toString());
      if (activeSignal.entryZone && activeSignal.entryZone[0]) {
        const avgEntry = (activeSignal.entryZone[0] + activeSignal.entryZone[1]) / 2;
        setLimitPrice(avgEntry);
      }
      setNotes(`Executado via Bot Quant (${activeSignal.strategyCategory || 'SINAL'} - ${activeSignal.confluenceScore}%)`);
      showToast('success', 'Parâmetros sincronizados com o Sinal Quant!');
    }
  };

  // Cálculos em tempo real da ordem a ser executada
  const orderCalculations = useMemo(() => {
    const execPrice = orderType === 'MARKET' ? ticker.price : (orderType === 'LIMIT' ? limitPrice : stopPrice);
    if (!execPrice || execPrice <= 0 || marginUsd <= 0) {
      return {
        notionalUsd: 0,
        quantity: 0,
        liquidationPrice: 0,
        entryFeeEst: 0,
        exitFeeEst: 0,
        totalFeesEst: 0,
        slippageEst: 0,
        breakEvenPrice: 0,
        potentialProfitUsd: 0,
        potentialProfitRoe: 0,
        maxLossUsd: 0,
        maxLossRoe: 0,
        riskRewardRatio: 0
      };
    }

    const notionalUsd = marginUsd * leverage;
    const quantity = notionalUsd / execPrice;
    
    // Liquidação aproximada
    const factor = (1 / leverage) - 0.005;
    const liquidationPrice = side === 'LONG' ? Math.max(0, execPrice * (1 - factor)) : execPrice * (1 + factor);

    const isMaker = orderType === 'LIMIT';
    const entryFeePct = isMaker ? activeFeeRates.makerFeePct : activeFeeRates.takerFeePct;
    const exitFeePct = activeFeeRates.takerFeePct;
    
    const entryFeeEst = notionalUsd * (entryFeePct / 100);
    const exitFeeEst = notionalUsd * (exitFeePct / 100);
    const totalFeesEst = entryFeeEst + exitFeeEst;
    const slippageEst = orderType === 'MARKET' ? notionalUsd * (activeFeeRates.slippagePct / 100) : 0;

    const breakEvenPrice = side === 'LONG' 
      ? (execPrice * quantity + totalFeesEst) / quantity 
      : (execPrice * quantity - totalFeesEst) / quantity;

    // Métricas de TP e SL
    const tpNum = parseFloat(takeProfit);
    const slNum = parseFloat(stopLoss);
    
    let potentialProfitUsd = 0;
    let potentialProfitRoe = 0;
    let maxLossUsd = 0;
    let maxLossRoe = 0;
    let riskRewardRatio = 0;

    if (!isNaN(tpNum) && tpNum > 0) {
      const tpDiff = side === 'LONG' ? (tpNum - execPrice) : (execPrice - tpNum);
      potentialProfitUsd = tpDiff * quantity - totalFeesEst;
      potentialProfitRoe = marginUsd > 0 ? (potentialProfitUsd / marginUsd) * 100 : 0;
    }

    if (!isNaN(slNum) && slNum > 0) {
      const slDiff = side === 'LONG' ? (execPrice - slNum) : (slNum - execPrice);
      maxLossUsd = Math.abs(slDiff * quantity) + totalFeesEst;
      maxLossRoe = marginUsd > 0 ? (maxLossUsd / marginUsd) * 100 : 0;
    }

    if (maxLossUsd > 0 && potentialProfitUsd > 0) {
      riskRewardRatio = potentialProfitUsd / maxLossUsd;
    }

    return {
      notionalUsd,
      quantity,
      liquidationPrice,
      entryFeeEst,
      exitFeeEst,
      totalFeesEst,
      slippageEst,
      breakEvenPrice,
      potentialProfitUsd,
      potentialProfitRoe,
      maxLossUsd,
      maxLossRoe,
      riskRewardRatio
    };
  }, [orderType, side, leverage, marginUsd, limitPrice, stopPrice, ticker.price, takeProfit, stopLoss, activeFeeRates]);

  // Handler de envio de ordem
  const handleExecuteOrder = () => {
    if (marginUsd <= 0) {
      showToast('error', 'Por favor, defina um valor de margem positivo.');
      return;
    }
    if (marginUsd > accountState.cashBalance) {
      showToast('error', `Saldo insuficiente. Disponível: $${accountState.cashBalance.toFixed(2)}`);
      return;
    }

    const slNum = parseFloat(stopLoss);
    const tpNum = parseFloat(takeProfit);
    const validSl = !isNaN(slNum) && slNum > 0 ? slNum : undefined;
    const validTp = !isNaN(tpNum) && tpNum > 0 ? tpNum : undefined;

    if (orderType === 'MARKET') {
      const res = executeMarket({
        symbol: ticker.symbol,
        baseAsset,
        side,
        marketPrice: ticker.price,
        marginUsd,
        leverage,
        stopLoss: validSl,
        takeProfit: validTp,
        sourceType: notes.includes('Auditoria') ? 'AI_REVIEW' : (notes.includes('Quant') ? 'QUANT_SIGNAL' : 'MANUAL'),
        sourceSignalId: activeSignal?.id,
        notes: notes || undefined
      });

      if (res.error) {
        showToast('error', res.error);
      } else {
        showToast('success', `Ordem virtual ${side} executada a $${formatPrice(ticker.price)}!`);
        setActiveTab('positions');
      }
    } else {
      const triggerPrice = orderType === 'LIMIT' ? limitPrice : stopPrice;
      const res = placeOrder({
        symbol: ticker.symbol,
        baseAsset,
        side,
        type: orderType,
        triggerPrice,
        marginUsd,
        leverage,
        stopLoss: validSl,
        takeProfit: validTp,
        sourceType: notes.includes('Auditoria') ? 'AI_REVIEW' : (notes.includes('Quant') ? 'QUANT_SIGNAL' : 'MANUAL'),
        sourceSignalId: activeSignal?.id,
        notes: notes || undefined
      });

      if (res.error) {
        showToast('error', res.error);
      } else {
        showToast('success', `Ordem ${orderType} de ${side} registrada com sucesso a $${formatPrice(triggerPrice)}!`);
        setActiveTab('orders');
      }
    }
  };

  // Filtragem e ordenação do Log de Auditoria de Trades
  const filteredAndSortedTrades = useMemo(() => {
    let trades = [...accountState.tradeHistory];

    // Filtros de status/tipo
    if (logFilter === 'CURRENT_TICKER') {
      trades = trades.filter(t => t.symbol === ticker.symbol);
    } else if (logFilter === 'WINS') {
      trades = trades.filter(t => t.netPnl > 0);
    } else if (logFilter === 'LOSSES') {
      trades = trades.filter(t => t.netPnl <= 0);
    } else if (logFilter === 'TP') {
      trades = trades.filter(t => t.exitReason === 'TAKE_PROFIT');
    } else if (logFilter === 'SL') {
      trades = trades.filter(t => t.exitReason === 'STOP_LOSS');
    } else if (logFilter === 'LIQ') {
      trades = trades.filter(t => t.exitReason === 'LIQUIDATION');
    }

    // Busca por texto
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase().trim();
      trades = trades.filter(t => 
        t.symbol.toLowerCase().includes(q) || 
        t.side.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.exitReason && t.exitReason.toLowerCase().includes(q))
      );
    }

    // Ordenação
    trades.sort((a, b) => {
      if (logSortBy === 'NEWEST') return b.closedAt - a.closedAt;
      if (logSortBy === 'OLDEST') return a.closedAt - b.closedAt;
      if (logSortBy === 'PNL_DESC') return b.netPnl - a.netPnl;
      if (logSortBy === 'PNL_ASC') return a.netPnl - b.netPnl;
      if (logSortBy === 'ROE_DESC') return b.roePct - a.roePct;
      return b.closedAt - a.closedAt;
    });

    return trades;
  }, [accountState.tradeHistory, logFilter, logSearch, logSortBy, ticker.symbol]);

  // Contagens para os botões de filtro do log
  const logCounts = useMemo(() => {
    const all = accountState.tradeHistory;
    const wins = all.filter(t => t.netPnl > 0).length;
    const losses = all.filter(t => t.netPnl <= 0).length;
    const current = all.filter(t => t.symbol === ticker.symbol).length;
    const tp = all.filter(t => t.exitReason === 'TAKE_PROFIT').length;
    const sl = all.filter(t => t.exitReason === 'STOP_LOSS').length;
    const liq = all.filter(t => t.exitReason === 'LIQUIDATION').length;
    const totalGrossPnl = all.reduce((acc, t) => acc + t.grossPnl, 0);
    const totalFees = all.reduce((acc, t) => acc + t.feesPaid, 0);
    const avgDuration = all.length > 0 ? Math.round(all.reduce((acc, t) => acc + t.durationMinutes, 0) / all.length) : 0;
    
    return {
      total: all.length,
      wins,
      losses,
      current,
      tp,
      sl,
      liq,
      totalGrossPnl,
      totalFees,
      avgDuration
    };
  }, [accountState.tradeHistory, ticker.symbol]);

  // Exportar histórico de trades para CSV
  const handleExportCSV = () => {
    if (accountState.tradeHistory.length === 0) {
      showToast('info', 'Nenhum histórico de trades para exportar.');
      return;
    }

    const headers = [
      'ID',
      'Data/Hora Abertura',
      'Data/Hora Fechamento',
      'Ativo',
      'Direção',
      'Alavancagem',
      'Preço Entrada',
      'Preço Saída',
      'Quantidade',
      'Margem (USD)',
      'Notional (USD)',
      'PnL Bruto (USD)',
      'Taxas Pagas (USD)',
      'PnL Líquido (USD)',
      'ROE (%)',
      'Motivo Saída',
      'Origem / Setup',
      'Notas'
    ];

    const rows = accountState.tradeHistory.map(t => [
      t.id,
      new Date(t.openedAt).toISOString(),
      new Date(t.closedAt).toISOString(),
      t.symbol,
      t.side,
      `${t.leverage}x`,
      t.entryPrice,
      t.exitPrice,
      t.quantity,
      t.marginUsd.toFixed(2),
      t.notionalUsd.toFixed(2),
      t.grossPnl.toFixed(4),
      t.feesPaid.toFixed(4),
      t.netPnl.toFixed(4),
      t.roePct.toFixed(2),
      t.exitReason,
      t.sourceType || 'MANUAL',
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `superbot_paper_trading_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Relatório CSV exportado com sucesso!');
  };

  // Salvar novo TP/SL da posição
  const handleSaveEditTpSl = () => {
    if (!showEditTpSlModal) return;
    const sl = parseFloat(editSlInput);
    const tp = parseFloat(editTpInput);
    updateTpSl(
      showEditTpSlModal.id,
      !isNaN(sl) && sl > 0 ? sl : undefined,
      !isNaN(tp) && tp > 0 ? tp : undefined
    );
    setShowEditTpSlModal(null);
    showToast('success', 'Níveis de TP/SL da posição virtual atualizados!');
  };

  return (
    <div className="w-full bg-[#070707] rounded-xl border border-white/10 shadow-2xl overflow-hidden font-sans">
      {/* HEADER RIBBON */}
      <div className="bg-[#0c0c0c] px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                Paper Trading Sandbox
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                  100% SEM RISCO
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-neutral-400 font-sans">
              Simulador em tempo real com book ao vivo, cálculo de corretagem (maker/taker), slippage e rastreamento de PnL/ROE.
            </p>
          </div>
        </div>

        {/* Global Virtual Portfolio Summary Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* Total Equity */}
          <div className="bg-[#050505] px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
            <span className="text-neutral-400 text-[10px] uppercase font-bold">Patrimônio:</span>
            <span className="text-white font-black text-sm">
              ${formatPrice(accountState.totalEquity)}
            </span>
            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
              accountState.netPnlPercentage >= 0 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/20 text-rose-400'
            }`}>
              {accountState.netPnlPercentage >= 0 ? '+' : ''}{accountState.netPnlPercentage.toFixed(2)}%
            </span>
          </div>

          {/* Cash Available */}
          <div className="bg-[#050505] px-2.5 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-neutral-400 text-[10px]">Disponível:</span>
            <span className="text-cyan-300 font-bold">${formatPrice(accountState.cashBalance)}</span>
          </div>

          {/* Win Rate & Trades */}
          <div className="bg-[#050505] px-2.5 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-neutral-400 text-[10px]">Win Rate:</span>
            <span className="text-orange-300 font-bold">
              {accountState.winRate.toFixed(1)}% <span className="text-neutral-500 font-normal">({accountState.totalTrades}T)</span>
            </span>
          </div>

          {/* Total Fees Paid */}
          <Tooltip
            position="bottom"
            title="Total de Taxas Pagas"
            badge="IMPACTO DE CORRETAGEM"
            content="Soma de todas as comissões de exchange pagas na simulação (maker/taker) + slippage. Mostra o impacto real das taxas no seu resultado líquido."
          >
            <div className="bg-[#050505] px-2.5 py-1.5 rounded-lg border border-amber-500/20 flex items-center gap-1.5 cursor-help">
              <Percent className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-neutral-400 text-[10px]">Taxas:</span>
              <span className="text-amber-300 font-bold">-${accountState.totalFeesPaid.toFixed(2)}</span>
            </div>
          </Tooltip>

          {/* Toggle Equity Curve */}
          <button
            onClick={() => setShowEquityCurve(!showEquityCurve)}
            className={`px-2.5 py-1.5 rounded-lg border font-bold transition flex items-center gap-1.5 cursor-pointer ${
              showEquityCurve 
                ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' 
                : 'bg-[#050505] text-neutral-400 border-white/10 hover:text-white'
            }`}
            title="Exibir/Ocultar Gráfico de Curva de Patrimônio D3"
          >
            <TrendingUp className="h-3.5 w-3.5 text-orange-400" />
            <span className="hidden sm:inline text-[10px]">Curva D3</span>
          </button>

          {/* Settings & Reset Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-1.5 rounded-lg border border-white/10 bg-[#050505] text-neutral-400 hover:text-white hover:border-orange-500/40 transition cursor-pointer"
            title="Configurar Taxas e Reiniciar Sandbox"
          >
            <Sliders className="h-4 w-4" />
          </button>

          {/* Toggle Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg border border-white/10 bg-[#050505] text-neutral-400 hover:text-white transition cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* MAIN EXECUTION TERMINAL GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* LEFT: ORDER INPUT FORM (7 COLS) */}
            <div className="lg:col-span-7 bg-[#0a0a0a] p-4 rounded-xl border border-white/10 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    Nova Ordem Virtual
                  </span>
                  <span className="text-[10px] bg-neutral-900 text-orange-400 font-mono px-2 py-0.5 rounded font-bold border border-white/5">
                    {ticker.symbol} • ${formatPrice(ticker.price)}
                  </span>
                </div>

                {/* 1-Click Sync with AI or Quant Signal */}
                <div className="flex items-center gap-1.5">
                  {aiReview && (
                    <button
                      type="button"
                      onClick={() => handleSyncWithSignal('AI')}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30 hover:bg-orange-500/25 transition flex items-center gap-1 cursor-pointer"
                      title="Copiar Alvos e Direção da Auditoria de IA"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Sync IA</span>
                    </button>
                  )}

                  {activeSignal && (
                    <button
                      type="button"
                      onClick={() => handleSyncWithSignal('QUANT')}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition flex items-center gap-1 cursor-pointer"
                      title="Copiar Alvos e Direção do Bot Quant"
                    >
                      <Zap className="h-3 w-3" />
                      <span>Sync Bot Quant</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Order Type & Direction Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Order Type (Market, Limit, Stop) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase">Tipo de Ordem</label>
                  <div className="grid grid-cols-3 gap-1 bg-[#050505] p-1 rounded-lg border border-white/10">
                    {(['MARKET', 'LIMIT', 'STOP_MARKET'] as PaperOrderType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setOrderType(t)}
                        className={`py-1 text-[10px] font-bold rounded transition text-center cursor-pointer ${
                          orderType === t 
                            ? 'bg-neutral-800 text-white shadow-xs' 
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {t === 'MARKET' ? 'Mercado' : (t === 'LIMIT' ? 'Limite' : 'Stop')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Side Selector (Long / Short) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase">Direção da Posição</label>
                  <div className="grid grid-cols-2 gap-1 bg-[#050505] p-1 rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => setSide('LONG')}
                      className={`py-1 text-[10px] font-black rounded transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        side === 'LONG' 
                          ? 'bg-emerald-600 text-white shadow-md' 
                          : 'text-neutral-400 hover:text-emerald-400'
                      }`}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <span>LONG (Compra)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSide('SHORT')}
                      className={`py-1 text-[10px] font-black rounded transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        side === 'SHORT' 
                          ? 'bg-rose-600 text-white shadow-md' 
                          : 'text-neutral-400 hover:text-rose-400'
                      }`}
                    >
                      <ArrowDownRight className="h-3.5 w-3.5" />
                      <span>SHORT (Venda)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Trigger Price Inputs for Limit / Stop */}
              {orderType === 'LIMIT' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-neutral-400 uppercase">Preço Limite ($)</span>
                    <button 
                      type="button"
                      onClick={() => setLimitPrice(ticker.price)}
                      className="text-orange-400 hover:underline cursor-pointer"
                    >
                      Usar Atual (${formatPrice(ticker.price)})
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {orderType === 'STOP_MARKET' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-neutral-400 uppercase">Preço de Disparo (Stop Price) ($)</span>
                    <button 
                      type="button"
                      onClick={() => setStopPrice(ticker.price)}
                      className="text-orange-400 hover:underline cursor-pointer"
                    >
                      Usar Atual (${formatPrice(ticker.price)})
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={stopPrice}
                      onChange={(e) => setStopPrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Leverage Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-neutral-400 uppercase">Alavancagem Virtual</span>
                  <span className="text-orange-400 font-mono font-black text-xs">{leverage}x</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={leverage}
                    onChange={(e) => setLeverage(parseInt(e.target.value) || 1)}
                    className="flex-1 accent-orange-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                  />
                  <div className="flex gap-1">
                    {[1, 5, 10, 20, 50].map((lev) => (
                      <button
                        key={lev}
                        type="button"
                        onClick={() => setLeverage(lev)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition cursor-pointer ${
                          leverage === lev 
                            ? 'bg-orange-500 text-black shadow' 
                            : 'bg-[#050505] text-neutral-400 border border-white/5 hover:text-white'
                        }`}
                      >
                        {lev}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Margin (USD) & % Sizing Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-neutral-400 uppercase">Margem Virtual Alocada ($)</span>
                  <span className="text-neutral-400 font-mono">
                    Disponível: <strong className="text-white">${formatPrice(accountState.cashBalance)}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2 text-neutral-500 text-xs font-mono">$</span>
                    <input
                      type="number"
                      min="10"
                      step="10"
                      value={marginUsd}
                      onChange={(e) => setMarginUsd(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#050505] border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-1">
                    {[10, 25, 50, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          const val = Math.floor((accountState.cashBalance * (pct / 100)));
                          setMarginUsd(Math.max(10, val));
                        }}
                        className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-[#050505] text-neutral-400 border border-white/10 hover:text-white hover:border-orange-500/30 transition cursor-pointer"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Take Profit & Stop Loss Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Take Profit */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-emerald-400 uppercase flex items-center gap-1">
                      <Target className="h-3 w-3" /> Take Profit ($)
                    </span>
                    {orderCalculations.potentialProfitUsd > 0 && (
                      <span className="text-emerald-400 font-mono font-bold">
                        +${orderCalculations.potentialProfitUsd.toFixed(2)} (+{orderCalculations.potentialProfitRoe.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="any"
                    placeholder="Opcional (Preço Alvo)"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    className="w-full bg-[#050505] border border-emerald-500/20 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-300 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Stop Loss */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-rose-400 uppercase flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" /> Stop Loss ($)
                    </span>
                    {orderCalculations.maxLossUsd > 0 && (
                      <span className="text-rose-400 font-mono font-bold">
                        -${orderCalculations.maxLossUsd.toFixed(2)} (-{orderCalculations.maxLossRoe.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="any"
                    placeholder="Opcional (Preço Stop)"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="w-full bg-[#050505] border border-rose-500/20 rounded-lg px-3 py-1.5 text-xs font-mono text-rose-300 placeholder:text-neutral-600 focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Execution Action Button */}
              <button
                type="button"
                onClick={handleExecuteOrder}
                className={`w-full py-2.5 rounded-xl font-mono font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.99] ${
                  side === 'LONG'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40'
                }`}
              >
                <Zap className="h-4 w-4" />
                <span>
                  {orderType === 'MARKET' ? 'Executar Ordem Virtual' : `Registrar Ordem ${orderType}`} {side} ({leverage}x)
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/30">
                  ${formatPrice(orderCalculations.notionalUsd)}
                </span>
              </button>
            </div>

            {/* RIGHT: REAL-TIME SIMULATION & FEE IMPACT BREAKDOWN (5 COLS) */}
            <div className="lg:col-span-5 bg-[#0a0a0a] p-4 rounded-xl border border-white/10 space-y-3 font-mono text-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                  <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart2 className="h-4 w-4 text-orange-400" />
                    Auditoria de Execução & Taxas
                  </span>
                  <span className="text-[9px] text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded border border-white/5">
                    {activeFeeRates.takerFeePct}% Taker / {activeFeeRates.makerFeePct}% Maker
                  </span>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between items-center text-neutral-300">
                    <span className="text-neutral-400">Tamanho da Posição:</span>
                    <span className="font-bold text-white">
                      {orderCalculations.quantity.toFixed(4)} {baseAsset}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-300">
                    <span className="text-neutral-400">Valor Nocional Total:</span>
                    <span className="font-bold text-white">
                      ${formatPrice(orderCalculations.notionalUsd)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-300">
                    <span className="text-neutral-400">Preço de Liquidação Est.:</span>
                    <span className="font-bold text-rose-400">
                      ${formatPrice(orderCalculations.liquidationPrice)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-neutral-300">
                    <span className="text-neutral-400">Preço de Break-Even (c/ taxas):</span>
                    <span className="font-bold text-amber-300">
                      ${formatPrice(orderCalculations.breakEvenPrice)}
                    </span>
                  </div>

                  <div className="border-t border-white/10 pt-2 space-y-1.5">
                    <div className="flex justify-between items-center text-neutral-300">
                      <span className="text-neutral-400 flex items-center gap-1">
                        <Percent className="h-3 w-3 text-orange-400" />
                        Comissão Entrada ({orderType === 'LIMIT' ? 'Maker' : 'Taker'}):
                      </span>
                      <span className="text-orange-400 font-bold">
                        -${orderCalculations.entryFeeEst.toFixed(4)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-neutral-300">
                      <span className="text-neutral-400">Comissão Saída Estimada:</span>
                      <span className="text-neutral-400 font-bold">
                        -${orderCalculations.exitFeeEst.toFixed(4)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-neutral-300">
                      <span className="text-neutral-400">Slippage Simulado ({activeFeeRates.slippagePct}%):</span>
                      <span className="text-neutral-400 font-bold">
                        -${orderCalculations.slippageEst.toFixed(4)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-neutral-900/90 p-2 rounded border border-white/5">
                      <span className="text-neutral-300 font-bold text-[10px] uppercase">Custo Total de Corretagem:</span>
                      <span className="text-amber-400 font-black">
                        -${(orderCalculations.totalFeesEst + orderCalculations.slippageEst).toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strategy Risk/Reward Pill Box */}
              {orderCalculations.riskRewardRatio > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/25 p-2.5 rounded-lg text-center font-mono">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                    Relação Risco : Retorno Projetada
                  </span>
                  <span className="text-sm font-black text-emerald-300">
                    1 : {orderCalculations.riskRewardRatio.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* D3 CUMULATIVE EQUITY CURVE CHART */}
          {showEquityCurve && (
            <PaperTradingEquityCurveD3
              accountState={accountState}
              currentTickerSymbol={ticker.symbol}
            />
          )}

          {/* ACTIVE POSITIONS & WORKING ORDERS SUB-TABS */}
          <div className="bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden">
            <div className="bg-[#050505] px-4 py-2 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('positions')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'positions'
                      ? 'bg-orange-500 text-black shadow-sm font-black'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Posições Ativas em Aberto</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-mono font-bold">
                    {accountState.positions.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'orders'
                      ? 'bg-orange-500 text-black shadow-sm font-black'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Ordens Limite/Stop Pendentes</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-mono font-bold">
                    {accountState.pendingOrders.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('analytics')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'analytics'
                      ? 'bg-orange-500 text-black shadow-sm font-black'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Percent className="h-3.5 w-3.5" />
                  <span>Impacto de Comissões & Fee Drag</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT: ACTIVE POSITIONS */}
            {activeTab === 'positions' && (
              <div className="p-4">
                {accountState.positions.length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-500 space-y-1 font-sans">
                    <p>Nenhuma posição virtual aberta no momento.</p>
                    <p className="text-[11px] text-neutral-400">
                      Configure a margem e execute ordens a mercado ou limite acima para testar seus setups.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-[10px] text-neutral-400 uppercase">
                          <th className="pb-2">Ativo / Lado</th>
                          <th className="pb-2">Preço Entrada</th>
                          <th className="pb-2">Preço Atual</th>
                          <th className="pb-2">Tamanho / Margem</th>
                          <th className="pb-2">PnL Líquido (ROE %)</th>
                          <th className="pb-2">Preço Liq. / Break-Even</th>
                          <th className="pb-2">TP / SL</th>
                          <th className="pb-2 text-right">Ações Rápidas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {accountState.positions.map((pos) => {
                          const isProfit = pos.unrealizedPnlNet >= 0;
                          return (
                            <tr key={pos.id} className="hover:bg-white/[0.02] transition">
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onSelectTickerBySymbol && onSelectTickerBySymbol(pos.symbol)}
                                    className="font-black text-white hover:text-orange-400 transition"
                                  >
                                    {pos.symbol}
                                  </button>
                                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${
                                    pos.side === 'LONG' 
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  }`}>
                                    {pos.side} {pos.leverage}x
                                  </span>
                                </div>
                                <span className="text-[9px] text-neutral-500 font-sans block mt-0.5">
                                  {formatTimeAgo(pos.openedAt)}
                                </span>
                              </td>

                              <td className="py-3 font-semibold text-white">
                                ${formatPrice(pos.entryPrice)}
                              </td>

                              <td className="py-3 font-semibold text-white">
                                ${formatPrice(pos.currentPrice)}
                              </td>

                              <td className="py-3">
                                <span className="text-white font-bold block">
                                  {pos.quantity.toFixed(4)} {pos.baseAsset}
                                </span>
                                <span className="text-[10px] text-neutral-400">
                                  Margem: ${pos.marginUsd.toFixed(2)}
                                </span>
                              </td>

                              <td className="py-3">
                                <div className={`font-black text-sm flex items-center gap-1 ${
                                  isProfit ? 'text-emerald-400' : 'text-rose-400'
                                }`}>
                                  <span>{isProfit ? '+' : ''}${pos.unrealizedPnlNet.toFixed(2)}</span>
                                </div>
                                <span className={`text-[10px] font-bold ${
                                  isProfit ? 'text-emerald-400' : 'text-rose-400'
                                }`}>
                                  {isProfit ? '+' : ''}{pos.unrealizedRoePct.toFixed(2)}% ROE
                                </span>
                              </td>

                              <td className="py-3 text-[11px]">
                                <div className="text-rose-400 font-bold">
                                  Liq: ${formatPrice(pos.liquidationPrice)}
                                </div>
                                <div className="text-neutral-400">
                                  BE: ${formatPrice(pos.breakEvenPrice)}
                                </div>
                              </td>

                              <td className="py-3 text-[11px]">
                                <div className="text-emerald-400">
                                  TP: {pos.takeProfit ? `$${formatPrice(pos.takeProfit)}` : '--'}
                                </div>
                                <div className="text-rose-400">
                                  SL: {pos.stopLoss ? `$${formatPrice(pos.stopLoss)}` : '--'}
                                </div>
                              </td>

                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Edit TP/SL */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowEditTpSlModal(pos);
                                      setEditSlInput(pos.stopLoss ? pos.stopLoss.toString() : '');
                                      setEditTpInput(pos.takeProfit ? pos.takeProfit.toString() : '');
                                    }}
                                    className="px-2 py-1 rounded text-[10px] font-bold bg-[#050505] text-neutral-300 border border-white/10 hover:border-orange-500/40 hover:text-white transition cursor-pointer"
                                    title="Ajustar Take Profit e Stop Loss"
                                  >
                                    TP / SL
                                  </button>

                                  {/* Partial Close 50% */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      closePos(pos.id, pos.currentPrice, 'PARTIAL_CLOSE', 0.5);
                                      showToast('info', `50% da posição ${pos.symbol} fechada.`);
                                    }}
                                    className="px-2 py-1 rounded text-[10px] font-bold bg-[#050505] text-neutral-300 border border-white/10 hover:border-amber-500/40 hover:text-white transition cursor-pointer"
                                    title="Fechar 50% da posição a mercado"
                                  >
                                    50%
                                  </button>

                                  {/* Close 100% Market */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      closePos(pos.id, pos.currentPrice, 'MANUAL_CLOSE', 1.0);
                                      showToast('success', `Posição ${pos.symbol} encerrada a mercado.`);
                                    }}
                                    className="px-2.5 py-1 rounded text-[10px] font-black bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer shadow-xs"
                                    title="Fechar 100% a mercado"
                                  >
                                    Fechar (100%)
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: PENDING ORDERS */}
            {activeTab === 'orders' && (
              <div className="p-4">
                {accountState.pendingOrders.length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-500 space-y-1 font-sans">
                    <p>Nenhuma ordem limite ou stop pendente no livro virtual.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-[10px] text-neutral-400 uppercase">
                          <th className="pb-2">Ativo / Tipo</th>
                          <th className="pb-2">Direção</th>
                          <th className="pb-2">Preço de Disparo</th>
                          <th className="pb-2">Preço Atual</th>
                          <th className="pb-2">Distância (%)</th>
                          <th className="pb-2">Margem / Notional</th>
                          <th className="pb-2 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {accountState.pendingOrders.map((ord) => {
                          const triggerPrice = ord.price || ord.stopPrice || 0;
                          const distancePct = triggerPrice > 0 ? (((triggerPrice - ticker.price) / ticker.price) * 100) : 0;
                          return (
                            <tr key={ord.id} className="hover:bg-white/[0.02] transition">
                              <td className="py-3">
                                <span className="font-black text-white block">{ord.symbol}</span>
                                <span className="text-[9px] text-orange-400 uppercase font-bold">
                                  {ord.type}
                                </span>
                              </td>

                              <td className="py-3">
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${
                                  ord.side === 'LONG' 
                                    ? 'bg-emerald-500/20 text-emerald-400' 
                                    : 'bg-rose-500/20 text-rose-400'
                                }`}>
                                  {ord.side} {ord.leverage}x
                                </span>
                              </td>

                              <td className="py-3 font-bold text-white">
                                ${formatPrice(triggerPrice)}
                              </td>

                              <td className="py-3 text-neutral-300">
                                ${formatPrice(ticker.price)}
                              </td>

                              <td className="py-3">
                                <span className="text-[11px] font-bold text-neutral-300">
                                  {distancePct >= 0 ? '+' : ''}{distancePct.toFixed(2)}%
                                </span>
                              </td>

                              <td className="py-3">
                                <span className="text-white font-bold block">${ord.notionalUsd.toFixed(2)}</span>
                                <span className="text-[10px] text-neutral-400">Margem: ${ord.marginUsd.toFixed(2)}</span>
                              </td>

                              <td className="py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    cancelOrder(ord.id);
                                    showToast('info', 'Ordem cancelada.');
                                  }}
                                  className="px-2.5 py-1 rounded text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 transition cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: ANALYTICS & FEE DRAG */}
            {activeTab === 'analytics' && (
              <div className="p-4 space-y-4 font-mono">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="bg-[#050505] p-3 rounded-lg border border-white/10">
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">PnL Realizado Bruto</span>
                    <span className="text-base font-black text-white">
                      ${logCounts.totalGrossPnl.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-[#050505] p-3 rounded-lg border border-amber-500/30">
                    <span className="text-[10px] text-amber-400 uppercase font-bold block mb-1">Taxas Totais de Corretagem</span>
                    <span className="text-base font-black text-amber-400">
                      -${logCounts.totalFees.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-[#050505] p-3 rounded-lg border border-white/10">
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">PnL Líquido Final</span>
                    <span className={`text-base font-black ${
                      accountState.totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {accountState.totalRealizedPnl >= 0 ? '+' : ''}${accountState.totalRealizedPnl.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-[#050505] p-3 rounded-lg border border-white/10">
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">Profit Factor Líquido</span>
                    <span className="text-base font-black text-orange-400">
                      {accountState.profitFactor.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/25 p-3.5 rounded-xl font-sans text-xs text-amber-200/90 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <Sparkles className="h-4 w-4" />
                    <span>Diagnóstico de Eficiência & Fricção de Corretagem (Fee Drag)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Em estratégias de Scalping e alta frequência (1m/5m), as taxas de corretagem da exchange podem corroer mais de 30% dos ganhos brutos. 
                    O SuperBot calcula e desconta a taxa exata na abertura e no fechamento para garantir que seu backtest e teste de estratégia reflitam a realidade de uma conta real.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* DETAILED AUDIT LOG TABLE BELOW THE SIMULATOR (REQUESTED CORE FEATURE) */}
          {/* ========================================================================= */}
          <div className="bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden space-y-0">
            {/* AUDIT LOG HEADER & CONTROLS BAR */}
            <div className="bg-[#0c0c0c] px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400">
                  <History className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    Registro de Auditoria & Diário de Trades Executados
                    <span className="text-[10px] bg-neutral-900 text-orange-400 px-2 py-0.5 rounded font-mono font-bold border border-white/5">
                      {filteredAndSortedTrades.length} de {logCounts.total} Trades
                    </span>
                  </h4>
                  <p className="text-[10px] text-neutral-400 font-sans mt-0.5">
                    Histórico detalhado de execução com preços de entrada/saída, carimbo de data/hora, comissões e PnL auditável.
                  </p>
                </div>
              </div>

              {/* Action Buttons: Export CSV & Clear Log */}
              <div className="flex items-center gap-2">
                {accountState.tradeHistory.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#050505] text-neutral-300 border border-white/10 hover:border-orange-500/40 hover:text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Exportar tabela de auditoria para arquivo CSV"
                    >
                      <Download className="h-3.5 w-3.5 text-orange-400" />
                      <span>Exportar CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Tem certeza de que deseja limpar todo o histórico de trades executados?')) {
                          clearHistory();
                          showToast('info', 'Histórico de auditoria limpo com sucesso.');
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 transition flex items-center gap-1.5 cursor-pointer"
                      title="Limpar histórico de trades"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Limpar</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* AUDIT SUMMARY STATS BAR */}
            {accountState.tradeHistory.length > 0 && (
              <div className="bg-[#060606] px-4 py-2.5 border-b border-white/5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block font-bold">Total Auditado</span>
                  <span className="text-white font-black">{logCounts.total} Trades</span>
                </div>

                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block font-bold">Taxa de Acerto</span>
                  <span className="text-orange-300 font-bold">
                    {accountState.winRate.toFixed(1)}% <span className="text-neutral-500 text-[10px]">({logCounts.wins}W / {logCounts.losses}L)</span>
                  </span>
                </div>

                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block font-bold">PnL Líquido Realizado</span>
                  <span className={`font-black ${accountState.totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {accountState.totalRealizedPnl >= 0 ? '+' : ''}${accountState.totalRealizedPnl.toFixed(2)}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block font-bold">Fator de Lucro</span>
                  <span className="text-white font-bold">{accountState.profitFactor.toFixed(2)}</span>
                </div>

                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block font-bold">Comissões Pagas</span>
                  <span className="text-amber-400 font-bold">-${logCounts.totalFees.toFixed(2)}</span>
                </div>

                <div>
                  <span className="text-[9px] text-neutral-400 uppercase block font-bold">Duração Média</span>
                  <span className="text-cyan-300 font-bold">{logCounts.avgDuration} min</span>
                </div>
              </div>
            )}

            {/* AUDIT FILTERS & SEARCH ROW */}
            <div className="px-4 py-2.5 bg-[#080808] border-b border-white/5 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono">
              {/* Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { id: 'ALL', label: `Todos (${logCounts.total})` },
                  { id: 'CURRENT_TICKER', label: `${ticker.symbol} (${logCounts.current})` },
                  { id: 'WINS', label: `Vitórias (${logCounts.wins})` },
                  { id: 'LOSSES', label: `Prejuízos (${logCounts.losses})` },
                  { id: 'TP', label: `Take Profit (${logCounts.tp})` },
                  { id: 'SL', label: `Stop Loss (${logCounts.sl})` },
                  { id: 'LIQ', label: `Liquidados (${logCounts.liq})` }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLogFilter(item.id as any)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                      logFilter === item.id
                        ? 'bg-orange-500 text-black shadow-xs font-black'
                        : 'bg-[#050505] text-neutral-400 border border-white/5 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Search Box & Sort Dropdown */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3 w-3 text-neutral-500 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Filtrar por ativo ou nota..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="bg-[#050505] border border-white/10 rounded-lg pl-7 pr-2.5 py-1 text-[11px] font-mono text-white placeholder:text-neutral-600 focus:border-orange-500 focus:outline-none w-44"
                  />
                  {logSearch && (
                    <button
                      type="button"
                      onClick={() => setLogSearch('')}
                      className="absolute right-2 top-1.5 text-neutral-500 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-[#050505] px-2 py-1 rounded-lg border border-white/10">
                  <ArrowUpDown className="h-3 w-3 text-neutral-400" />
                  <select
                    value={logSortBy}
                    onChange={(e) => setLogSortBy(e.target.value as any)}
                    className="bg-transparent text-[10px] font-mono text-neutral-300 focus:outline-none cursor-pointer"
                  >
                    <option value="NEWEST">Mais Recentes</option>
                    <option value="OLDEST">Mais Antigos</option>
                    <option value="PNL_DESC">Maior Lucro ($)</option>
                    <option value="PNL_ASC">Maior Prejuízo ($)</option>
                    <option value="ROE_DESC">Maior ROE (%)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* AUDIT LOG TABLE BODY */}
            <div className="p-0">
              {filteredAndSortedTrades.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-500 space-y-2 font-sans">
                  <Activity className="h-7 w-7 text-neutral-600 mx-auto animate-pulse" />
                  <p className="font-bold text-neutral-400">
                    {accountState.tradeHistory.length === 0 
                      ? 'Nenhum trade virtual finalizado ainda no histórico de auditoria.' 
                      : 'Nenhum trade corresponde aos filtros selecionados.'}
                  </p>
                  <p className="text-[11px] text-neutral-500 max-w-md mx-auto">
                    Abra posições simuladas no painel acima e realize fechamentos ou aguarde o mercado atingir seus alvos para construir seu histórico de testes.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#050505] border-b border-white/10 text-[10px] text-neutral-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3"># / Data-Hora Execução</th>
                        <th className="py-2.5 px-3">Ativo & Direção</th>
                        <th className="py-2.5 px-3">Preço Entrada</th>
                        <th className="py-2.5 px-3">Preço Saída</th>
                        <th className="py-2.5 px-3">Volume & Margem</th>
                        <th className="py-2.5 px-3">Taxas Pagas</th>
                        <th className="py-2.5 px-3">PnL Líquido ($)</th>
                        <th className="py-2.5 px-3">Retorno ROE (%)</th>
                        <th className="py-2.5 px-3">Motivo Fechamento</th>
                        <th className="py-2.5 px-3">Origem / Setup</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredAndSortedTrades.map((trd, index) => {
                        const isProfit = trd.netPnl > 0;
                        const isLoss = trd.netPnl < 0;
                        return (
                          <tr key={trd.id} className="hover:bg-white/[0.03] transition-colors">
                            {/* 1. Date & Time */}
                            <td className="py-3 px-3 text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-neutral-500 font-bold">#{filteredAndSortedTrades.length - index}</span>
                                <span className="text-white font-bold">{formatDateTime(trd.closedAt)}</span>
                              </div>
                              <div className="text-[9px] text-neutral-400 flex items-center gap-1 mt-0.5 font-sans">
                                <span>Aberto: {formatTimeAgo(trd.openedAt)}</span>
                                <span>·</span>
                                <span className="text-cyan-400 font-mono font-semibold">{trd.durationMinutes} min de duração</span>
                              </div>
                            </td>

                            {/* 2. Symbol & Side */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onSelectTickerBySymbol && onSelectTickerBySymbol(trd.symbol)}
                                  className="font-black text-white hover:text-orange-400 transition"
                                >
                                  {trd.symbol}
                                </button>
                                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                  trd.side === 'LONG' 
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                }`}>
                                  {trd.side} {trd.leverage}x
                                </span>
                              </div>
                            </td>

                            {/* 3. Entry Price */}
                            <td className="py-3 px-3 font-semibold text-neutral-300">
                              ${formatPrice(trd.entryPrice)}
                            </td>

                            {/* 4. Exit Price */}
                            <td className="py-3 px-3 font-bold text-white">
                              ${formatPrice(trd.exitPrice)}
                            </td>

                            {/* 5. Size & Margin */}
                            <td className="py-3 px-3 text-[11px]">
                              <span className="text-white font-bold block">
                                {trd.quantity.toFixed(4)} {trd.baseAsset}
                              </span>
                              <span className="text-[10px] text-neutral-400">
                                Margem: ${trd.marginUsd.toFixed(2)} (${trd.notionalUsd.toFixed(2)} total)
                              </span>
                            </td>

                            {/* 6. Fees */}
                            <td className="py-3 px-3 text-[11px] text-amber-400 font-bold">
                              -${trd.feesPaid.toFixed(3)}
                            </td>

                            {/* 7. Net PnL ($) */}
                            <td className="py-3 px-3">
                              <div className={`font-black text-sm flex items-center gap-1 ${
                                isProfit ? 'text-emerald-400' : (isLoss ? 'text-rose-400' : 'text-neutral-400')
                              }`}>
                                <span>{isProfit ? '+' : ''}${trd.netPnl.toFixed(2)}</span>
                              </div>
                              <span className="text-[9px] text-neutral-500 font-sans block">
                                Bruto: ${trd.grossPnl.toFixed(2)}
                              </span>
                            </td>

                            {/* 8. ROE (%) */}
                            <td className="py-3 px-3">
                              <span className={`text-xs font-black px-2 py-0.5 rounded inline-block ${
                                isProfit 
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                  : (isLoss 
                                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                                      : 'bg-neutral-900 text-neutral-400')
                              }`}>
                                {isProfit ? '+' : ''}{trd.roePct.toFixed(2)}%
                              </span>
                            </td>

                            {/* 9. Exit Reason */}
                            <td className="py-3 px-3">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border whitespace-nowrap ${
                                trd.exitReason === 'TAKE_PROFIT' 
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                                  : (trd.exitReason === 'STOP_LOSS' 
                                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' 
                                      : (trd.exitReason === 'LIQUIDATION' 
                                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 font-black animate-pulse' 
                                          : (trd.exitReason === 'PARTIAL_CLOSE'
                                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                              : 'bg-neutral-900 text-neutral-300 border-white/10')))
                              }`}>
                                {trd.exitReason === 'TAKE_PROFIT' ? '🎯 Take Profit' : (trd.exitReason === 'STOP_LOSS' ? '🛑 Stop Loss' : (trd.exitReason === 'LIQUIDATION' ? '💀 Liquidação' : (trd.exitReason === 'PARTIAL_CLOSE' ? '⚡ Fech. Parcial' : 'Fechamento Manual')))}
                              </span>
                            </td>

                            {/* 10. Origin / Setup */}
                            <td className="py-3 px-3 text-[10px] text-neutral-400 font-sans">
                              {trd.sourceType === 'AI_REVIEW' ? (
                                <span className="text-orange-400 font-semibold flex items-center gap-1">
                                  <Sparkles className="h-3 w-3 shrink-0" />
                                  <span>Auditoria IA</span>
                                </span>
                              ) : trd.sourceType === 'QUANT_SIGNAL' ? (
                                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                  <Zap className="h-3 w-3 shrink-0" />
                                  <span>Bot Quant</span>
                                </span>
                              ) : (
                                <span className="text-neutral-400">Manual</span>
                              )}
                              {trd.notes && (
                                <span className="text-[9px] text-neutral-500 block truncate max-w-[140px]" title={trd.notes}>
                                  {trd.notes}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT TP/SL MODAL */}
      {showEditTpSlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#0c0c0c] border border-white/15 rounded-xl max-w-sm w-full p-4 space-y-3 font-mono shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-black text-white uppercase">
                Ajustar TP/SL ({showEditTpSlModal.symbol})
              </span>
              <button 
                type="button" 
                onClick={() => setShowEditTpSlModal(null)}
                className="text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[10px] text-emerald-400 font-bold uppercase block mb-1">
                  Take Profit ($)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editTpInput}
                  onChange={(e) => setEditTpInput(e.target.value)}
                  placeholder="Preço Alvo"
                  className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-rose-400 font-bold uppercase block mb-1">
                  Stop Loss ($)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editSlInput}
                  onChange={(e) => setEditSlInput(e.target.value)}
                  placeholder="Preço Stop"
                  className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditTpSlModal(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditTpSl}
                className="px-4 py-1.5 rounded-lg text-xs font-black bg-orange-500 text-black hover:bg-orange-400"
              >
                Salvar Níveis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS & RESET SANDBOX MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#0c0c0c] border border-white/15 rounded-xl max-w-md w-full p-4.5 space-y-4 font-mono shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-orange-400" />
                <span className="text-xs font-black text-white uppercase">
                  Configurações do Sandbox & Taxas
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowSettingsModal(false)}
                className="text-neutral-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs font-sans">
              {/* Fee Tier Selector */}
              <div className="space-y-1 font-mono">
                <label className="text-[10px] text-neutral-400 uppercase font-bold">
                  Tabela de Taxas da Exchange
                </label>
                <select
                  value={selectedFeeTierId}
                  onChange={(e) => setSelectedFeeTierId(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-orange-500 focus:outline-none"
                >
                  {feeTiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.description})
                    </option>
                  ))}
                </select>
              </div>

              {/* Slippage Setting */}
              <div className="space-y-1 font-mono">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-neutral-400 uppercase">Slippage Simulado (%)</span>
                  <span className="text-orange-400">{slippageSetting}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="range"
                    min="0"
                    max="0.2"
                    step="0.01"
                    value={slippageSetting}
                    onChange={(e) => setSlippageSetting(parseFloat(e.target.value) || 0)}
                    className="flex-1 accent-orange-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                  />
                </div>
              </div>

              {/* Reset Initial Balance */}
              <div className="border-t border-white/10 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-400 uppercase font-mono flex items-center gap-1">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reiniciar Sandbox Virtual
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Limpa todas as posições abertas e restaura o saldo inicial para o valor desejado.
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2 text-neutral-500 text-xs font-mono">$</span>
                    <input
                      type="number"
                      value={resetBalanceInput}
                      onChange={(e) => setResetBalanceInput(Math.max(100, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#050505] border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div className="flex gap-1">
                    {[1000, 10000, 50000, 100000].map((bal) => (
                      <button
                        key={bal}
                        type="button"
                        onClick={() => setResetBalanceInput(bal)}
                        className="px-2 py-1 rounded text-[9px] font-mono font-bold bg-[#050505] text-neutral-400 border border-white/10 hover:text-white"
                      >
                        ${bal >= 1000 ? `${bal / 1000}k` : bal}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Tem certeza de que deseja resetar o Sandbox com saldo de $${resetBalanceInput}?`)) {
                    resetSandbox(resetBalanceInput, selectedFeeTierId);
                    setShowSettingsModal(false);
                    showToast('success', `Sandbox reiniciado com saldo de $${resetBalanceInput}!`);
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition cursor-pointer"
              >
                Resetar Conta
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateSettings({
                      feeTierId: selectedFeeTierId,
                      slippagePct: slippageSetting
                    });
                    setShowSettingsModal(false);
                    showToast('success', 'Configurações de taxas salvas!');
                  }}
                  className="px-4 py-1.5 rounded-lg text-xs font-black bg-orange-500 text-black hover:bg-orange-400"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
