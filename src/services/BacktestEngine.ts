import { db } from '../db';
import { historicalKlines, backtestResults } from '../db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import crypto from 'crypto';

export interface BacktestConfig {
  symbol: string;
  days: number;
  weights: any;
  // Outras configurações da estratégia podem entrar aqui
}

export interface BacktestResult {
  id: string;
  symbol: string;
  strategyId: string;
  startTime: number;
  endTime: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  netProfit: number;
  config: any;
  createdAt: number;
}

export class BacktestEngine {
  static async runBacktest(config: BacktestConfig, useCache: boolean = true): Promise<BacktestResult> {
    const strategyId = this.generateStrategyId(config);
    
    if (useCache) {
      const cached = await db.select().from(backtestResults)
        .where(
          and(
             eq(backtestResults.symbol, config.symbol),
             eq(backtestResults.strategyId, strategyId)
          )
        )
        .orderBy(desc(backtestResults.createdAt))
        .limit(1);

      if (cached.length > 0) {
        return {
           ...cached[0],
           config: JSON.parse(cached[0].config)
        };
      }
    }

    const now = Date.now();
    const startTime = now - config.days * 24 * 60 * 60 * 1000;

    // Load klines
    const klines = await db.select().from(historicalKlines)
      .where(
        and(
          eq(historicalKlines.symbol, config.symbol),
          gte(historicalKlines.openTime, startTime),
          lte(historicalKlines.openTime, now)
        )
      )
      .orderBy(historicalKlines.openTime);

    if (klines.length === 0) {
      throw new Error(`Sem dados históricos para ${config.symbol}. Execute o sync primeiro.`);
    }

    // SIMULAÇÃO SIMPLIFICADA DE BACKTEST
    // O motor real rodaria vela a vela calculando indicadores, cruzamentos, stop loss e take profit.
    // Como os pesos da IA são dinâmicos e dependem de complexidade, vamos simular o resultado 
    // com base numa lógica pseudo-aleatória determinística baseada na variação de preço para fins de mock/prova de conceito.
    
    let balance = 1000;
    const initialBalance = balance;
    let peakBalance = balance;
    let maxDrawdown = 0;
    
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    
    let inPosition = false;
    let entryPrice = 0;
    let stopLoss = 0;
    let takeProfit = 0;

    for (let i = 20; i < klines.length; i++) {
       const candle = klines[i];

       // Simula um sinal longo com base numa forte variação do volume (Taker Buy vs Sell) e price action
       if (!inPosition) {
          const prev = klines[i-1];
          const takerRatio = prev.takerBuyBaseVolume / (prev.volume || 1);
          const isGreen = prev.close > prev.open;
          
          if (takerRatio > 0.6 && isGreen) { // Pseudo-Sinal de Compra
             inPosition = true;
             entryPrice = candle.open;
             // Risk reward 1:2
             const atrMock = candle.open * 0.005; // 0.5% ATR
             stopLoss = entryPrice - atrMock;
             takeProfit = entryPrice + (atrMock * 2);
          }
       } else {
          // Checagem intra-candle se pegou TP ou SL (simulando que SL pode ter sido pego primeiro)
          let exitPrice = 0;
          let isWin = false;

          if (candle.low <= stopLoss) {
             exitPrice = stopLoss;
             isWin = false;
          } else if (candle.high >= takeProfit) {
             exitPrice = takeProfit;
             isWin = true;
          }

          if (exitPrice > 0) {
             const profit = (exitPrice - entryPrice) / entryPrice * balance; // Usando todo o balanço
             balance += profit;
             
             if (isWin) {
                wins++;
                totalProfit += profit;
             } else {
                losses++;
                totalLoss += Math.abs(profit);
             }

             if (balance > peakBalance) {
                peakBalance = balance;
             } else {
                const drawdown = (peakBalance - balance) / peakBalance * 100;
                if (drawdown > maxDrawdown) maxDrawdown = drawdown;
             }

             inPosition = false;
          }
       }
    }

    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 99 : 0;
    const netProfitPct = ((balance - initialBalance) / initialBalance) * 100;

    const result: BacktestResult = {
       id: crypto.randomUUID(),
       symbol: config.symbol,
       strategyId,
       startTime: klines[0].openTime,
       endTime: klines[klines.length - 1].openTime,
       totalTrades,
       winRate,
       profitFactor,
       maxDrawdown,
       netProfit: netProfitPct,
       config,
       createdAt: Date.now()
    };

    // Save to DB
    await db.insert(backtestResults).values({
       ...result,
       config: JSON.stringify(result.config)
    });

    return result;
  }

  static async getLatestBacktest(symbol: string, weights: any): Promise<BacktestResult | null> {
    const config = { symbol, days: 30, weights };
    const strategyId = this.generateStrategyId(config);
    const cached = await db.select().from(backtestResults)
      .where(
        and(
           eq(backtestResults.symbol, symbol),
           eq(backtestResults.strategyId, strategyId)
        )
      )
      .orderBy(desc(backtestResults.createdAt))
      .limit(1);

    if (cached.length > 0) {
      return {
         ...cached[0],
         config: JSON.parse(cached[0].config)
      };
    }
    return null;
  }

  private static generateStrategyId(config: BacktestConfig): string {
    const str = JSON.stringify(config.weights);
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
  }
}
