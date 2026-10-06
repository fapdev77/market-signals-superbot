import { describe, it, expect, beforeEach } from 'vitest';
import {
  INITIAL_ACCOUNT_STATE,
  executeMarketOrder,
  closePosition,
  calculateLiquidationPrice,
  calculateLivePositionMetrics,
  processMarketTick,
  recomputeAccountSummary,
  type PaperAccountState
} from '../src/utils/paperTradingEngine.js';
import type { TickerData } from '../src/types.js';

describe('Épico 3: Integridade Matemática do Paper Trading Engine (TDD)', () => {
  let state: PaperAccountState;

  function makeMockTicker(symbol: string, price: number): TickerData {
    return {
      symbol,
      baseAsset: symbol.replace('USDT', ''),
      quoteAsset: 'USDT',
      name: symbol,
      marketType: 'crypto_futures',
      price,
      priceChangePercent24h: 1.0,
      high24h: price * 1.05,
      low24h: price * 0.95,
      volume24h: 10000000,
      quoteVolume24h: 10000000 * price,
      openInterest: 5000000,
      openInterestChange24h: 2.0,
      openInterestChange1h: 0.5,
      fundingRate: 0.0001,
      fundingRateDaily: 0.0003,
      fundingRateAnnualized: 10.95,
      cvd: 1000000,
      cvdDelta: 50000,
      cvdDeltaPercent: 1.0,
      cvdDirection: 'BUY',
      takerBuyRatio: 0.52,
      fibonacci: { swingHigh: price * 1.05, swingLow: price * 0.95, fib50: price, fib618: price * 0.98, fib68: price * 0.975, inGoldenPocket: false },
      rangeProfile: { vah: price * 1.02, val: price * 0.98, poc: price, inValueArea: true },
      keyLevels: { support1: price * 0.97, support2: price * 0.95, resistance1: price * 1.03, resistance2: price * 1.05, structureBreak: 'NONE', hasSinglePrintFVG: false },
      confluenceScore: 70,
      signalType: 'LONG',
      signalReason: 'Test',
      confluenceFactors: [],
      updatedAt: Date.now()
    };
  }

  beforeEach(() => {
    state = {
      ...INITIAL_ACCOUNT_STATE,
      initialBalance: 10000,
      cashBalance: 10000,
      marginInUse: 0,
      totalEquity: 10000,
      positions: [],
      pendingOrders: [],
      tradeHistory: []
    };
  });

  it('T3.1: Executa ordem Market Long com dedução correta de margem e taxas', () => {
    const res = executeMarketOrder(state, {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      side: 'LONG',
      marketPrice: 50000,
      marginUsd: 1000,
      leverage: 10,
      stopLoss: 48000,
      takeProfit: 55000
    });

    expect(res.error).toBeUndefined();
    expect(res.position).toBeDefined();
    if (!res.position) return;

    expect(res.position.side).toBe('LONG');
    expect(res.position.marginUsd).toBe(1000);
    expect(res.position.notionalUsd).toBe(10000);
    expect(res.position.quantity).toBeCloseTo(10000 / res.position.entryPrice, 5);

    // Saldo disponível reduzido pela margem alocada + taxa de entrada
    expect(res.state.cashBalance).toBeLessThan(9000);
    expect(res.state.marginInUse).toBe(1000);
    // Invariante de saldo
    expect(res.state.totalEquity).toBeCloseTo(res.state.cashBalance + res.state.marginInUse + res.state.totalUnrealizedPnl, 2);
  });

  it('T3.2: Rejeita ordem quando o saldo disponível é insuficiente', () => {
    const res = executeMarketOrder(state, {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      side: 'LONG',
      marketPrice: 50000,
      marginUsd: 15000, // Maior que os $10.000 disponíveis
      leverage: 5
    });

    expect(res.error).toBeDefined();
    expect(res.position).toBeUndefined();
    expect(res.state.cashBalance).toBe(10000);
  });

  it('T3.3: Fecha 100% de posição Long com lucro e registra no histórico de trades', () => {
    const openRes = executeMarketOrder(state, {
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      side: 'LONG',
      marketPrice: 3000,
      marginUsd: 1000,
      leverage: 5
    });
    expect(openRes.position).toBeDefined();
    if (!openRes.position) return;

    // Fechamento a $3300 (+10% no preço base)
    const closeRes = closePosition(openRes.state, openRes.position.id, 3300, 'TAKE_PROFIT', 1.0);

    expect(closeRes.closedTrade).toBeDefined();
    if (!closeRes.closedTrade) return;

    expect(closeRes.closedTrade.grossPnl).toBeGreaterThan(450);
    expect(closeRes.closedTrade.netPnl).toBeGreaterThan(400);
    expect(closeRes.state.positions.length).toBe(0);
    expect(closeRes.state.tradeHistory.length).toBe(1);
    expect(closeRes.state.cashBalance).toBeGreaterThan(10400);
    expect(closeRes.state.totalEquity).toBeGreaterThan(10400);
  });

  it('T3.4: Fecha 50% de posição parcialmente (Partial Close)', () => {
    const openRes = executeMarketOrder(state, {
      symbol: 'SOLUSDT',
      baseAsset: 'SOL',
      side: 'LONG',
      marketPrice: 100,
      marginUsd: 1000,
      leverage: 5
    });
    expect(openRes.position).toBeDefined();
    if (!openRes.position) return;

    const initialQty = openRes.position.quantity;
    const partialCloseRes = closePosition(openRes.state, openRes.position.id, 110, 'PARTIAL_CLOSE', 0.5);

    expect(partialCloseRes.state.positions.length).toBe(1);
    const remPos = partialCloseRes.state.positions[0];
    expect(remPos.quantity).toBeCloseTo(initialQty * 0.5, 4);
    expect(remPos.marginUsd).toBeCloseTo(500, 2);
    expect(partialCloseRes.state.tradeHistory.length).toBe(1);
  });

  it('T3.5: Calcula preço de liquidação teórico com precisão para Long e Short', () => {
    // Long 10x em $100 com MMR 0.5%: Liquidação ~ $90.5
    const longLiq = calculateLiquidationPrice(100, 'LONG', 10, 0.5);
    expect(longLiq).toBeCloseTo(90.5, 1);

    // Short 10x em $100 com MMR 0.5%: Liquidação ~ $109.5
    const shortLiq = calculateLiquidationPrice(100, 'SHORT', 10, 0.5);
    expect(shortLiq).toBeCloseTo(109.5, 1);
  });

  it('T3.6: processMarketTick dispara Take Profit e Stop Loss automaticamente', () => {
    const openRes = executeMarketOrder(state, {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      side: 'LONG',
      marketPrice: 50000,
      marginUsd: 1000,
      leverage: 5,
      takeProfit: 55000,
      stopLoss: 47000
    });
    expect(openRes.position).toBeDefined();

    // Novo tick onde o preço atingiu o Take Profit ($55,200)
    const tickTicker = makeMockTicker('BTCUSDT', 55200);
    const tickState = processMarketTick(openRes.state, [tickTicker]);

    expect(tickState.positions.length).toBe(0);
    expect(tickState.tradeHistory.length).toBe(1);
    expect(tickState.tradeHistory[0].exitReason).toBe('TAKE_PROFIT');
  });

  it('T3.7: processMarketTick executa liquidação quando preço atinge o limite', () => {
    const openRes = executeMarketOrder(state, {
      symbol: 'DOGEUSDT',
      baseAsset: 'DOGE',
      side: 'LONG',
      marketPrice: 0.20,
      marginUsd: 1000,
      leverage: 20 // 20x -> Liquidação ~ 0.1905
    });
    expect(openRes.position).toBeDefined();

    // Preço despenca para $0.18
    const crashTicker = makeMockTicker('DOGEUSDT', 0.18);
    const tickState = processMarketTick(openRes.state, [crashTicker]);

    expect(tickState.positions.length).toBe(0);
    expect(tickState.tradeHistory.length).toBe(1);
    expect(tickState.tradeHistory[0].exitReason).toBe('LIQUIDATION');
  });
});
