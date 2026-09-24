import { 
  PaperAccountState, 
  PaperFeeTier, 
  PaperOrder, 
  PaperPosition, 
  PaperPositionSide, 
  PaperTradeExitReason, 
  PaperTradeRecord, 
  PaperTradingSettings,
  PaperOrderType,
  PaperSourceType,
  TickerData
} from '../types';

export const PAPER_STORAGE_KEY = 'superbot_paper_trading_state_v2';

export const DEFAULT_FEE_TIERS: PaperFeeTier[] = [
  {
    id: 'binance_vip0',
    name: 'Binance VIP 0 (Padrão)',
    makerFeePct: 0.02,
    takerFeePct: 0.05,
    description: 'Maker: 0.020% | Taker: 0.050% (Padrão Futuros Cripto)'
  },
  {
    id: 'binance_vip1',
    name: 'Binance VIP 1 / BNB Fee Discount',
    makerFeePct: 0.016,
    takerFeePct: 0.04,
    description: 'Maker: 0.016% | Taker: 0.040% (Desconto BNB / Volume)'
  },
  {
    id: 'bybit_standard',
    name: 'Bybit / OKX Standard',
    makerFeePct: 0.02,
    takerFeePct: 0.055,
    description: 'Maker: 0.020% | Taker: 0.055%'
  },
  {
    id: 'zero_fees',
    name: 'Zero Fee Promo (Sem Taxas)',
    makerFeePct: 0.0,
    takerFeePct: 0.0,
    description: 'Maker: 0.00% | Taker: 0.00% (Modo Puro de Teste de Setup)'
  },
  {
    id: 'retail_spot',
    name: 'Spot Retail / Alta Taxa',
    makerFeePct: 0.1,
    takerFeePct: 0.1,
    description: 'Maker: 0.100% | Taker: 0.100% (Impacto Alto de Corretagem)'
  }
];

export const DEFAULT_SETTINGS: PaperTradingSettings = {
  initialBalance: 10000,
  feeTierId: 'binance_vip0',
  slippagePct: 0.02, // 0.02% slippage on market fills
  autoExecuteTpSl: true,
  soundAlerts: true
};

export const INITIAL_ACCOUNT_STATE: PaperAccountState = {
  initialBalance: 10000,
  cashBalance: 10000,
  marginInUse: 0,
  totalUnrealizedPnl: 0,
  totalRealizedPnl: 0,
  totalEquity: 10000,
  totalFeesPaid: 0,
  netPnlPercentage: 0,
  peakEquity: 10000,
  maxDrawdownPct: 0,
  totalTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  winRate: 0,
  profitFactor: 0,
  averageWin: 0,
  averageLoss: 0,
  positions: [],
  pendingOrders: [],
  tradeHistory: [],
  settings: DEFAULT_SETTINGS,
  lastUpdatedAt: Date.now()
};

/**
 * Carrega o estado persistido do Paper Trading no LocalStorage com fallback seguro
 */
export function loadPaperAccountState(): PaperAccountState {
  try {
    const raw = localStorage.getItem(PAPER_STORAGE_KEY);
    if (!raw) return INITIAL_ACCOUNT_STATE;
    const parsed = JSON.parse(raw) as PaperAccountState;
    
    // Assegura integridade dos campos caso novas propriedades tenham sido adicionadas
    return {
      ...INITIAL_ACCOUNT_STATE,
      ...parsed,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings || {})
      },
      positions: Array.isArray(parsed.positions) ? parsed.positions : [],
      pendingOrders: Array.isArray(parsed.pendingOrders) ? parsed.pendingOrders : [],
      tradeHistory: Array.isArray(parsed.tradeHistory) ? parsed.tradeHistory : []
    };
  } catch (err) {
    console.error('Falha ao carregar estado do Paper Trading Sandbox:', err);
    return INITIAL_ACCOUNT_STATE;
  }
}

/**
 * Salva o estado atual no LocalStorage e dispara evento para sincronização entre abas
 */
export function savePaperAccountState(state: PaperAccountState): void {
  try {
    state.lastUpdatedAt = Date.now();
    localStorage.setItem(PAPER_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event('paper_trading_updated'));
  } catch (err) {
    console.error('Falha ao salvar estado do Paper Trading:', err);
  }
}

/**
 * Obtém as taxas configuradas no estado atual
 */
export function getActiveFeeRates(settings: PaperTradingSettings): { makerFeePct: number; takerFeePct: number; slippagePct: number } {
  const tier = DEFAULT_FEE_TIERS.find(t => t.id === settings.feeTierId) || DEFAULT_FEE_TIERS[0];
  const makerFeePct = settings.customMakerFeePct !== undefined ? settings.customMakerFeePct : tier.makerFeePct;
  const takerFeePct = settings.customTakerFeePct !== undefined ? settings.customTakerFeePct : tier.takerFeePct;
  const slippagePct = settings.slippagePct ?? 0.02;
  return { makerFeePct, takerFeePct, slippagePct };
}

/**
 * Calcula preço de liquidação teórico com base na alavancagem e margem de manutenção
 */
export function calculateLiquidationPrice(
  entryPrice: number,
  side: PaperPositionSide,
  leverage: number,
  mmrPct = 0.5 // 0.5% standard maintenance margin for crypto
): number {
  if (leverage <= 1) {
    return side === 'LONG' ? 0 : entryPrice * 2;
  }
  
  const factor = (1 / leverage) - (mmrPct / 100);
  if (side === 'LONG') {
    return Math.max(0, entryPrice * (1 - factor));
  } else {
    return entryPrice * (1 + factor);
  }
}

/**
 * Recalcula PnL e métricas de uma posição aberta contra o preço atual de mercado
 */
export function calculateLivePositionMetrics(
  pos: PaperPosition,
  currentPrice: number,
  settings: PaperTradingSettings
): PaperPosition {
  const { takerFeePct } = getActiveFeeRates(settings);
  const diff = pos.side === 'LONG' ? (currentPrice - pos.entryPrice) : (pos.entryPrice - currentPrice);
  const unrealizedPnlGross = diff * pos.quantity;
  
  // Taxa de saída estimada ao fechar a mercado
  const currentNotional = currentPrice * pos.quantity;
  const estimatedExitFeeUsd = currentNotional * (takerFeePct / 100);
  const totalEstimatedFeesUsd = pos.entryFeePaidUsd + estimatedExitFeeUsd;
  
  const unrealizedPnlNet = unrealizedPnlGross - totalEstimatedFeesUsd;
  const unrealizedRoePct = pos.marginUsd > 0 ? (unrealizedPnlNet / pos.marginUsd) * 100 : 0;
  
  // Preço de Break-Even considerando taxas totais
  let breakEvenPrice = pos.entryPrice;
  if (pos.quantity > 0) {
    if (pos.side === 'LONG') {
      breakEvenPrice = (pos.entryPrice * pos.quantity + totalEstimatedFeesUsd) / pos.quantity;
    } else {
      breakEvenPrice = (pos.entryPrice * pos.quantity - totalEstimatedFeesUsd) / pos.quantity;
    }
  }

  return {
    ...pos,
    currentPrice,
    unrealizedPnlGross,
    unrealizedPnlNet,
    unrealizedRoePct,
    breakEvenPrice,
    estimatedExitFeeUsd,
    totalEstimatedFeesUsd,
    updatedAt: Date.now()
  };
}

/**
 * Recalcula o resumo da conta (Equity, Win Rate, PnL, Drawdown, Profit Factor)
 */
export function recomputeAccountSummary(state: PaperAccountState): PaperAccountState {
  const marginInUse = state.positions.reduce((acc, p) => acc + p.marginUsd, 0);
  const totalUnrealizedPnl = state.positions.reduce((acc, p) => acc + p.unrealizedPnlNet, 0);
  const totalEquity = state.cashBalance + marginInUse + totalUnrealizedPnl;
  
  const netPnlPercentage = state.initialBalance > 0 ? ((totalEquity - state.initialBalance) / state.initialBalance) * 100 : 0;
  const peakEquity = Math.max(state.peakEquity || state.initialBalance, totalEquity);
  
  const drawdownPct = peakEquity > 0 ? ((peakEquity - totalEquity) / peakEquity) * 100 : 0;
  const maxDrawdownPct = Math.max(state.maxDrawdownPct || 0, drawdownPct);
  
  const closedTrades = state.tradeHistory;
  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter(t => t.netPnl > 0).length;
  const losingTrades = closedTrades.filter(t => t.netPnl < 0).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  
  const grossWins = closedTrades.filter(t => t.netPnl > 0).reduce((acc, t) => acc + t.netPnl, 0);
  const grossLosses = Math.abs(closedTrades.filter(t => t.netPnl < 0).reduce((acc, t) => acc + t.netPnl, 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : (grossWins > 0 ? 99.9 : 0);
  
  const averageWin = winningTrades > 0 ? grossWins / winningTrades : 0;
  const averageLoss = losingTrades > 0 ? grossLosses / losingTrades : 0;
  const totalFeesPaid = closedTrades.reduce((acc, t) => acc + t.feesPaid, 0) + state.positions.reduce((acc, p) => acc + p.entryFeePaidUsd, 0);
  const totalRealizedPnl = closedTrades.reduce((acc, t) => acc + t.netPnl, 0);

  return {
    ...state,
    marginInUse,
    totalUnrealizedPnl,
    totalRealizedPnl,
    totalEquity,
    totalFeesPaid,
    netPnlPercentage,
    peakEquity,
    maxDrawdownPct,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    profitFactor,
    averageWin,
    averageLoss,
    lastUpdatedAt: Date.now()
  };
}

/**
 * Executa uma ordem a mercado (Market Order)
 */
export function executeMarketOrder(
  state: PaperAccountState,
  params: {
    symbol: string;
    baseAsset: string;
    side: PaperPositionSide;
    marketPrice: number;
    marginUsd: number;
    leverage: number;
    stopLoss?: number;
    takeProfit?: number;
    sourceType?: PaperSourceType;
    sourceSignalId?: string;
    notes?: string;
  }
): { state: PaperAccountState; position?: PaperPosition; error?: string } {
  if (params.marginUsd <= 0) {
    return { state, error: 'O valor da margem deve ser maior que zero.' };
  }
  if (params.marginUsd > state.cashBalance) {
    return { state, error: `Margem insuficiente. Saldo disponível: $${state.cashBalance.toFixed(2)}` };
  }
  if (params.marketPrice <= 0) {
    return { state, error: 'Preço de mercado inválido para execução.' };
  }

  const { takerFeePct, slippagePct } = getActiveFeeRates(state.settings);
  
  // Aplica slippage simulado
  const slippageMultiplier = params.side === 'LONG' ? (1 + slippagePct / 100) : (1 - slippagePct / 100);
  const effectiveEntryPrice = params.marketPrice * slippageMultiplier;
  
  const notionalUsd = params.marginUsd * params.leverage;
  const quantity = notionalUsd / effectiveEntryPrice;
  const entryFeePaidUsd = notionalUsd * (takerFeePct / 100);
  const slippageCostUsd = Math.abs(effectiveEntryPrice - params.marketPrice) * quantity;
  
  const liquidationPrice = calculateLiquidationPrice(effectiveEntryPrice, params.side, params.leverage);
  
  // Deduz margem e taxa do saldo disponível
  const newCashBalance = state.cashBalance - params.marginUsd - entryFeePaidUsd;
  
  const newPosition: PaperPosition = {
    id: `pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    symbol: params.symbol,
    baseAsset: params.baseAsset,
    side: params.side,
    entryPrice: effectiveEntryPrice,
    currentPrice: params.marketPrice,
    quantity,
    notionalUsd,
    marginUsd: params.marginUsd,
    leverage: params.leverage,
    liquidationPrice,
    stopLoss: params.stopLoss,
    takeProfit: params.takeProfit,
    unrealizedPnlGross: -slippageCostUsd,
    unrealizedPnlNet: -entryFeePaidUsd - slippageCostUsd,
    unrealizedRoePct: -((entryFeePaidUsd + slippageCostUsd) / params.marginUsd) * 100,
    breakEvenPrice: params.side === 'LONG' ? effectiveEntryPrice * (1 + takerFeePct / 100 * 2) : effectiveEntryPrice * (1 - takerFeePct / 100 * 2),
    entryFeePaidUsd,
    estimatedExitFeeUsd: entryFeePaidUsd,
    totalEstimatedFeesUsd: entryFeePaidUsd * 2,
    openedAt: Date.now(),
    updatedAt: Date.now(),
    sourceType: params.sourceType || 'MANUAL',
    sourceSignalId: params.sourceSignalId,
    notes: params.notes
  };

  const updatedPositions = [newPosition, ...state.positions];
  const updatedState = recomputeAccountSummary({
    ...state,
    cashBalance: Math.max(0, newCashBalance),
    positions: updatedPositions
  });

  savePaperAccountState(updatedState);
  return { state: updatedState, position: newPosition };
}

/**
 * Cria uma ordem pendente (Limit ou Stop Market)
 */
export function placePendingOrder(
  state: PaperAccountState,
  params: {
    symbol: string;
    baseAsset: string;
    side: PaperPositionSide;
    type: PaperOrderType;
    triggerPrice: number;
    marginUsd: number;
    leverage: number;
    stopLoss?: number;
    takeProfit?: number;
    sourceType?: PaperSourceType;
    sourceSignalId?: string;
    notes?: string;
  }
): { state: PaperAccountState; order?: PaperOrder; error?: string } {
  if (params.marginUsd <= 0) {
    return { state, error: 'O valor da margem deve ser maior que zero.' };
  }
  if (params.marginUsd > state.cashBalance) {
    return { state, error: `Saldo insuficiente. Disponível: $${state.cashBalance.toFixed(2)}` };
  }
  if (params.triggerPrice <= 0) {
    return { state, error: 'Preço de disparo inválido.' };
  }

  const notionalUsd = params.marginUsd * params.leverage;
  const quantity = notionalUsd / params.triggerPrice;

  const newOrder: PaperOrder = {
    id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    symbol: params.symbol,
    baseAsset: params.baseAsset,
    side: params.side,
    type: params.type,
    quantity,
    price: params.type === 'LIMIT' ? params.triggerPrice : undefined,
    stopPrice: params.type === 'STOP_MARKET' ? params.triggerPrice : undefined,
    leverage: params.leverage,
    marginUsd: params.marginUsd,
    notionalUsd,
    stopLoss: params.stopLoss,
    takeProfit: params.takeProfit,
    status: 'PENDING',
    createdAt: Date.now(),
    sourceType: params.sourceType || 'MANUAL',
    sourceSignalId: params.sourceSignalId,
    notes: params.notes
  };

  const updatedPending = [newOrder, ...state.pendingOrders];
  const updatedState = recomputeAccountSummary({
    ...state,
    pendingOrders: updatedPending
  });

  savePaperAccountState(updatedState);
  return { state: updatedState, order: newOrder };
}

/**
 * Cancela uma ordem pendente
 */
export function cancelPendingOrder(
  state: PaperAccountState,
  orderId: string
): PaperAccountState {
  const updatedOrders = state.pendingOrders.filter(o => o.id !== orderId);
  const updatedState = recomputeAccountSummary({
    ...state,
    pendingOrders: updatedOrders
  });
  savePaperAccountState(updatedState);
  return updatedState;
}

/**
 * Fecha uma posição aberta (total ou parcialmente)
 */
export function closePosition(
  state: PaperAccountState,
  positionId: string,
  exitPrice: number,
  exitReason: PaperTradeExitReason = 'MANUAL_CLOSE',
  closeRatio = 1.0 // 1.0 = 100% fechamento
): { state: PaperAccountState; closedTrade?: PaperTradeRecord; error?: string } {
  const pos = state.positions.find(p => p.id === positionId);
  if (!pos) {
    return { state, error: 'Posição não encontrada.' };
  }

  const clampedRatio = Math.max(0.1, Math.min(1.0, closeRatio));
  const closedQty = pos.quantity * clampedRatio;
  const closedMargin = pos.marginUsd * clampedRatio;
  const closedNotional = closedQty * exitPrice;
  
  const { takerFeePct, makerFeePct } = getActiveFeeRates(state.settings);
  const feeRate = (exitReason === 'TAKE_PROFIT' || exitReason === 'STOP_LOSS') ? makerFeePct : takerFeePct;
  const exitFeeUsd = closedNotional * (feeRate / 100);
  const allocatedEntryFee = pos.entryFeePaidUsd * clampedRatio;
  const totalFees = allocatedEntryFee + exitFeeUsd;

  const diff = pos.side === 'LONG' ? (exitPrice - pos.entryPrice) : (pos.entryPrice - exitPrice);
  const grossPnl = diff * closedQty;
  const netPnl = grossPnl - totalFees;
  const roePct = closedMargin > 0 ? (netPnl / closedMargin) * 100 : 0;
  
  const returnedCash = closedMargin + grossPnl - exitFeeUsd;

  const tradeRecord: PaperTradeRecord = {
    id: `trd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    symbol: pos.symbol,
    baseAsset: pos.baseAsset,
    side: pos.side,
    entryPrice: pos.entryPrice,
    exitPrice,
    quantity: closedQty,
    notionalUsd: closedNotional,
    marginUsd: closedMargin,
    leverage: pos.leverage,
    grossPnl,
    netPnl,
    roePct,
    feesPaid: totalFees,
    slippageImpactUsd: 0,
    exitReason,
    openedAt: pos.openedAt,
    closedAt: Date.now(),
    durationMinutes: Math.max(1, Math.round((Date.now() - pos.openedAt) / 60000)),
    sourceType: pos.sourceType,
    sourceSignalId: pos.sourceSignalId,
    notes: pos.notes
  };

  let newPositions: PaperPosition[];
  if (clampedRatio >= 0.999) {
    newPositions = state.positions.filter(p => p.id !== positionId);
  } else {
    const remainingQty = pos.quantity - closedQty;
    const remainingMargin = pos.marginUsd - closedMargin;
    const remainingNotional = remainingQty * pos.entryPrice;
    const remainingEntryFee = pos.entryFeePaidUsd - allocatedEntryFee;

    newPositions = state.positions.map(p => {
      if (p.id !== positionId) return p;
      return {
        ...p,
        quantity: remainingQty,
        marginUsd: remainingMargin,
        notionalUsd: remainingNotional,
        entryFeePaidUsd: remainingEntryFee,
        updatedAt: Date.now()
      };
    });
  }

  const updatedCashBalance = Math.max(0, state.cashBalance + returnedCash);
  const updatedHistory = [tradeRecord, ...state.tradeHistory];

  const updatedState = recomputeAccountSummary({
    ...state,
    cashBalance: updatedCashBalance,
    positions: newPositions,
    tradeHistory: updatedHistory
  });

  savePaperAccountState(updatedState);
  return { state: updatedState, closedTrade: tradeRecord };
}

/**
 * Atualiza Take Profit e Stop Loss de uma posição existente
 */
export function updatePositionTpSl(
  state: PaperAccountState,
  positionId: string,
  stopLoss?: number,
  takeProfit?: number
): PaperAccountState {
  const updatedPositions = state.positions.map(p => {
    if (p.id !== positionId) return p;
    return {
      ...p,
      stopLoss,
      takeProfit,
      updatedAt: Date.now()
    };
  });

  const updatedState = recomputeAccountSummary({
    ...state,
    positions: updatedPositions
  });
  savePaperAccountState(updatedState);
  return updatedState;
}

/**
 * Atualiza todas as posições e ordens pendentes contra um novo tick de preço de mercado
 * Dispara automaticamente Take Profit, Stop Loss, Liquidações ou Execuções de Ordens Limite
 */
export function processMarketTick(
  state: PaperAccountState,
  tickers: TickerData[]
): PaperAccountState {
  if (!tickers || tickers.length === 0) return state;
  const tickerMap = new Map<string, TickerData>();
  tickers.forEach(t => tickerMap.set(t.symbol, t));

  let modified = false;
  let currentCash = state.cashBalance;
  const currentPositions = [...state.positions];
  const currentPending = [...state.pendingOrders];
  const newTrades: PaperTradeRecord[] = [];
  const remainingPositions: PaperPosition[] = [];
  const remainingPending: PaperOrder[] = [];

  // 1. Processar Ordens Pendentes (Limit e Stop Orders)
  for (const order of currentPending) {
    const ticker = tickerMap.get(order.symbol);
    if (!ticker) {
      remainingPending.push(order);
      continue;
    }

    let isFilled = false;
    let fillPrice = ticker.price;

    if (order.type === 'LIMIT' && order.price) {
      if (order.side === 'LONG' && ticker.price <= order.price) {
        isFilled = true;
        fillPrice = order.price;
      } else if (order.side === 'SHORT' && ticker.price >= order.price) {
        isFilled = true;
        fillPrice = order.price;
      }
    } else if (order.type === 'STOP_MARKET' && order.stopPrice) {
      if (order.side === 'LONG' && ticker.price >= order.stopPrice) {
        isFilled = true;
        fillPrice = ticker.price;
      } else if (order.side === 'SHORT' && ticker.price <= order.stopPrice) {
        isFilled = true;
        fillPrice = ticker.price;
      }
    }

    if (isFilled && currentCash >= order.marginUsd) {
      modified = true;
      const { makerFeePct, takerFeePct } = getActiveFeeRates(state.settings);
      const feePct = order.type === 'LIMIT' ? makerFeePct : takerFeePct;
      const entryFee = order.notionalUsd * (feePct / 100);
      currentCash -= (order.marginUsd + entryFee);

      const liqPrice = calculateLiquidationPrice(fillPrice, order.side, order.leverage);
      const newPos: PaperPosition = {
        id: `pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        symbol: order.symbol,
        baseAsset: order.baseAsset,
        side: order.side,
        entryPrice: fillPrice,
        currentPrice: ticker.price,
        quantity: order.notionalUsd / fillPrice,
        notionalUsd: order.notionalUsd,
        marginUsd: order.marginUsd,
        leverage: order.leverage,
        liquidationPrice: liqPrice,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
        unrealizedPnlGross: 0,
        unrealizedPnlNet: -entryFee * 2,
        unrealizedRoePct: -(entryFee * 2 / order.marginUsd) * 100,
        breakEvenPrice: order.side === 'LONG' ? fillPrice * 1.0008 : fillPrice * 0.9992,
        entryFeePaidUsd: entryFee,
        estimatedExitFeeUsd: entryFee,
        totalEstimatedFeesUsd: entryFee * 2,
        openedAt: Date.now(),
        updatedAt: Date.now(),
        sourceType: order.sourceType,
        sourceSignalId: order.sourceSignalId,
        notes: `Executado a partir de Ordem ${order.type}`
      };
      currentPositions.push(newPos);
    } else {
      remainingPending.push(order);
    }
  }

  // 2. Processar Posições Abertas (Preço live, TP, SL, Liquidação)
  for (const pos of currentPositions) {
    const ticker = tickerMap.get(pos.symbol);
    if (!ticker) {
      remainingPositions.push(pos);
      continue;
    }

    const livePos = calculateLivePositionMetrics(pos, ticker.price, state.settings);

    // Checar Liquidação
    let isLiquidated = false;
    if (livePos.side === 'LONG' && ticker.price <= livePos.liquidationPrice) {
      isLiquidated = true;
    } else if (livePos.side === 'SHORT' && ticker.price >= livePos.liquidationPrice) {
      isLiquidated = true;
    }

    if (isLiquidated) {
      modified = true;
      const trade: PaperTradeRecord = {
        id: `trd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        symbol: livePos.symbol,
        baseAsset: livePos.baseAsset,
        side: livePos.side,
        entryPrice: livePos.entryPrice,
        exitPrice: livePos.liquidationPrice,
        quantity: livePos.quantity,
        notionalUsd: livePos.notionalUsd,
        marginUsd: livePos.marginUsd,
        leverage: livePos.leverage,
        grossPnl: -livePos.marginUsd,
        netPnl: -livePos.marginUsd - livePos.entryFeePaidUsd,
        roePct: -100,
        feesPaid: livePos.entryFeePaidUsd,
        slippageImpactUsd: 0,
        exitReason: 'LIQUIDATION',
        openedAt: livePos.openedAt,
        closedAt: Date.now(),
        durationMinutes: Math.max(1, Math.round((Date.now() - livePos.openedAt) / 60000)),
        sourceType: livePos.sourceType,
        sourceSignalId: livePos.sourceSignalId,
        notes: 'Posição liquidada por perda total da margem.'
      };
      newTrades.push(trade);
      continue;
    }

    // Checar Take Profit / Stop Loss se auto-execução estiver ativa
    let isTp = false;
    let isSl = false;
    if (state.settings.autoExecuteTpSl) {
      if (livePos.takeProfit && livePos.takeProfit > 0) {
        if (livePos.side === 'LONG' && ticker.price >= livePos.takeProfit) isTp = true;
        if (livePos.side === 'SHORT' && ticker.price <= livePos.takeProfit) isTp = true;
      }
      if (livePos.stopLoss && livePos.stopLoss > 0) {
        if (livePos.side === 'LONG' && ticker.price <= livePos.stopLoss) isSl = true;
        if (livePos.side === 'SHORT' && ticker.price >= livePos.stopLoss) isSl = true;
      }
    }

    if (isTp || isSl) {
      modified = true;
      const targetExitPrice = isTp ? livePos.takeProfit! : livePos.stopLoss!;
      const { makerFeePct } = getActiveFeeRates(state.settings);
      const exitFee = (livePos.quantity * targetExitPrice) * (makerFeePct / 100);
      const totalFees = livePos.entryFeePaidUsd + exitFee;
      
      const diff = livePos.side === 'LONG' ? (targetExitPrice - livePos.entryPrice) : (livePos.entryPrice - targetExitPrice);
      const grossPnl = diff * livePos.quantity;
      const netPnl = grossPnl - totalFees;
      const roePct = livePos.marginUsd > 0 ? (netPnl / livePos.marginUsd) * 100 : 0;
      
      currentCash += (livePos.marginUsd + grossPnl - exitFee);

      const trade: PaperTradeRecord = {
        id: `trd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        symbol: livePos.symbol,
        baseAsset: livePos.baseAsset,
        side: livePos.side,
        entryPrice: livePos.entryPrice,
        exitPrice: targetExitPrice,
        quantity: livePos.quantity,
        notionalUsd: livePos.quantity * targetExitPrice,
        marginUsd: livePos.marginUsd,
        leverage: livePos.leverage,
        grossPnl,
        netPnl,
        roePct,
        feesPaid: totalFees,
        slippageImpactUsd: 0,
        exitReason: isTp ? 'TAKE_PROFIT' : 'STOP_LOSS',
        openedAt: livePos.openedAt,
        closedAt: Date.now(),
        durationMinutes: Math.max(1, Math.round((Date.now() - livePos.openedAt) / 60000)),
        sourceType: livePos.sourceType,
        sourceSignalId: livePos.sourceSignalId,
        notes: isTp ? 'Alvo atingido com sucesso!' : 'Stop Loss acionado para proteção de capital.'
      };
      newTrades.push(trade);
    } else {
      remainingPositions.push(livePos);
    }
  }

  const updatedState = recomputeAccountSummary({
    ...state,
    cashBalance: Math.max(0, currentCash),
    positions: remainingPositions,
    pendingOrders: remainingPending,
    tradeHistory: [...newTrades, ...state.tradeHistory]
  });

  if (modified || remainingPositions.length > 0) {
    savePaperAccountState(updatedState);
  }

  return updatedState;
}

/**
 * Reseta o Sandbox para o saldo inicial desejado
 */
export function resetPaperSandbox(initialBalance = 10000, feeTierId = 'binance_vip0'): PaperAccountState {
  const resetState: PaperAccountState = {
    ...INITIAL_ACCOUNT_STATE,
    initialBalance,
    cashBalance: initialBalance,
    totalEquity: initialBalance,
    peakEquity: initialBalance,
    settings: {
      ...DEFAULT_SETTINGS,
      initialBalance,
      feeTierId
    },
    lastUpdatedAt: Date.now()
  };
  savePaperAccountState(resetState);
  return resetState;
}

/**
 * Limpa apenas o histórico de trades fechados
 */
export function clearTradeHistory(state: PaperAccountState): PaperAccountState {
  const updatedState = recomputeAccountSummary({
    ...state,
    tradeHistory: []
  });
  savePaperAccountState(updatedState);
  return updatedState;
}
