import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  PaperAccountState, 
  PaperFeeTier, 
  PaperOrder, 
  PaperOrderType, 
  PaperPosition, 
  PaperPositionSide, 
  PaperSourceType, 
  PaperTradeExitReason, 
  PaperTradingSettings, 
  TickerData 
} from '../types';
import { 
  loadPaperAccountState, 
  savePaperAccountState, 
  executeMarketOrder, 
  placePendingOrder, 
  closePosition, 
  cancelPendingOrder, 
  updatePositionTpSl, 
  processMarketTick, 
  resetPaperSandbox, 
  clearTradeHistory, 
  DEFAULT_FEE_TIERS,
  getActiveFeeRates
} from '../utils/paperTradingEngine';

export function usePaperTrading(tickers: TickerData[] = [], currentTickerSymbol?: string) {
  const [accountState, setAccountState] = useState<PaperAccountState>(() => loadPaperAccountState());

  // Sincronização de estado entre abas e eventos do sandbox
  useEffect(() => {
    const handleStorage = () => {
      setAccountState(loadPaperAccountState());
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('paper_trading_updated', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('paper_trading_updated', handleStorage);
    };
  }, []);

  // Processar ticks de mercado quando tickers atualizam
  useEffect(() => {
    if (!tickers || tickers.length === 0) return;
    setAccountState(prevState => {
      return processMarketTick(prevState, tickers);
    });
  }, [tickers]);

  // Posições e ordens filtradas para o ativo atualmente selecionado no gráfico
  const currentTickerPositions = useMemo(() => {
    if (!currentTickerSymbol) return accountState.positions;
    return accountState.positions.filter(p => p.symbol === currentTickerSymbol);
  }, [accountState.positions, currentTickerSymbol]);

  const currentTickerPendingOrders = useMemo(() => {
    if (!currentTickerSymbol) return accountState.pendingOrders;
    return accountState.pendingOrders.filter(o => o.symbol === currentTickerSymbol);
  }, [accountState.pendingOrders, currentTickerSymbol]);

  const currentTickerTrades = useMemo(() => {
    if (!currentTickerSymbol) return accountState.tradeHistory;
    return accountState.tradeHistory.filter(t => t.symbol === currentTickerSymbol);
  }, [accountState.tradeHistory, currentTickerSymbol]);

  // Taxas ativas
  const activeFeeRates = useMemo(() => {
    return getActiveFeeRates(accountState.settings);
  }, [accountState.settings]);

  // Ações
  const executeMarket = useCallback((params: {
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
  }) => {
    const result = executeMarketOrder(accountState, params);
    if (result.state) setAccountState(result.state);
    return result;
  }, [accountState]);

  const placeOrder = useCallback((params: {
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
  }) => {
    const result = placePendingOrder(accountState, params);
    if (result.state) setAccountState(result.state);
    return result;
  }, [accountState]);

  const closePos = useCallback((
    positionId: string,
    exitPrice: number,
    exitReason: PaperTradeExitReason = 'MANUAL_CLOSE',
    closeRatio = 1.0
  ) => {
    const result = closePosition(accountState, positionId, exitPrice, exitReason, closeRatio);
    if (result.state) setAccountState(result.state);
    return result;
  }, [accountState]);

  const cancelOrder = useCallback((orderId: string) => {
    const updated = cancelPendingOrder(accountState, orderId);
    setAccountState(updated);
    return updated;
  }, [accountState]);

  const updateTpSl = useCallback((
    positionId: string,
    stopLoss?: number,
    takeProfit?: number
  ) => {
    const updated = updatePositionTpSl(accountState, positionId, stopLoss, takeProfit);
    setAccountState(updated);
    return updated;
  }, [accountState]);

  const resetSandbox = useCallback((initialBalance?: number, feeTierId?: string) => {
    const updated = resetPaperSandbox(initialBalance, feeTierId);
    setAccountState(updated);
    return updated;
  }, []);

  const clearHistory = useCallback(() => {
    const updated = clearTradeHistory(accountState);
    setAccountState(updated);
    return updated;
  }, [accountState]);

  const updateSettings = useCallback((newSettings: Partial<PaperTradingSettings>) => {
    setAccountState(prev => {
      const updated: PaperAccountState = {
        ...prev,
        settings: {
          ...prev.settings,
          ...newSettings
        }
      };
      savePaperAccountState(updated);
      return updated;
    });
  }, []);

  return {
    accountState,
    currentTickerPositions,
    currentTickerPendingOrders,
    currentTickerTrades,
    feeTiers: DEFAULT_FEE_TIERS,
    activeFeeRates,
    executeMarket,
    placeOrder,
    closePos,
    cancelOrder,
    updateTpSl,
    resetSandbox,
    clearHistory,
    updateSettings
  };
}
