import './server/utils/bootstrap.js';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  DEFAULT_SYMBOLS,
  getTradfiAsset,
  isTradfiMarketOpen,
  refreshTradfiRegistry,
  refreshTradingSchedule,
  fetchBinanceFuturesTickers,
  fetchOpenInterest,
  fetchFundingRate,
  fetchKlines,
  fetchLongShortRatio,
  DEFAULT_FUNDING_INTERVAL_HOURS
} from './server/binanceService.js';
import { initBinanceWebSocket } from './server/binanceWebsocket.js';
import { processTickerState, buildTradeSignal, SIGNAL_LOOKBACK_CANDLES } from './server/signalEngine.js';
import {
  saveSignal,
  getIndicatorWeights,
  getActiveSignalsBySymbol,
  updateSignalStatus,
  updateSignal,
  getAIModels,
  expireStaleSignals,
  expireActiveSignalsByCategory,
  expireAllActiveSignals,
  getActiveSignals,
  flushDbSave,
  signalLedgerDao
} from './server/db.js';
import { marketScreener } from './server/services/MarketScreenerService.js';
import { TickerData, BotState, IndicatorWeights, LongShortRatioData } from './src/types.js';
import { resolveActiveStrategies, configToWeights, getDefaultIndicatorWeights } from './src/constants/strategyPresets.js';
import { canGenerateSignals, canEvaluateActiveTrades } from './server/services/DataGate.js';
import { resolveRawTicker, resolveMarketInputs, evaluatePositionManagement } from './server/services/TickProcessor.js';
import { DEFAULT_RISK_LIMITS, evaluatePortfolioRisk, isTradingHalted, loadAppStateFromDb, getRiskLimits } from './server/services/RiskManager.js';
import { resolveServerHost, enforceHostBinding } from './server/utils/hostGuard.js';
import { initOrLoadSessionToken } from './server/middleware/auth.js';
import { initOrRestoreDatabase, createScheduledBackup, ensureSqlInstance } from './server/services/BackupService.js';
import { checkBinanceServerTimeDrift } from './server/services/ClockService.js';
import { getDb } from './server/db.js';
import { createApp } from './server/app.js';
// R-15: logger estruturado + métricas em memória.
import { logJson } from './server/utils/logger.js';
import { incrementMetric, METRIC_NAMES } from './server/utils/metrics.js';

// correlationId do tick corrente (logs do tick carregam o mesmo id — critério 1).
let currentTickId = '';

// Phase 3.3: a process-level handler must not silently absorb arbitrary failures.
//
// The previous version logged *every* uncaught exception and carried on, which leaves the process in an
// undefined state (half-written state, dead sockets, stale caches) while still claiming to run. Only the
// one known upstream Node/undici socket-parser assertion is tolerated, because it is benign and frequent;
// anything else exits so a supervisor can restart the process cleanly.
const TOLERATED_ASSERTION_SIGNATURE = 'false == true';

function isToleratedUndiciAssertion(err: any): boolean {
  if (err?.code !== 'ERR_ASSERTION') return false;
  const stack = String(err?.stack || '');
  const message = String(err?.message || '');
  return stack.includes('undici') && message.includes(TOLERATED_ASSERTION_SIGNATURE);
}

process.on('uncaughtException', (err: any) => {
  if (isToleratedUndiciAssertion(err)) {
    console.warn('⚠️ [Node.js Engine Guard] Intercepted internal Undici socket assertion (false == true); process preserved.');
    return;
  }

  console.error('❌ [FATAL] Uncaught Exception — terminating so the process can be restarted cleanly:', err);
  // Give the log a chance to flush before exiting — including any pending DB write,
  // which is debounced and would otherwise be lost.
  setTimeout(() => {
    try {
      flushDbSave();
    } catch (flushErr) {
      console.error('Failed to flush pending DB write before exit:', flushErr);
    }
    process.exit(1);
  }, 100);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('❌ [Unhandled Promise Rejection]:', reason?.message || reason);
});

// Database writes are coalesced behind a debounce timer, so a graceful shutdown must
// flush the last image to disk explicitly — otherwise the most recent state is lost.
function flushDbAndExit(signal: string, exitCode: number): void {
  console.log(`🛑 [Shutdown] ${signal} recebido — gravando estado pendente do banco em disco...`);
  try {
    flushDbSave();
  } catch (err) {
    console.error('Failed to flush pending DB write during shutdown:', err);
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => flushDbAndExit('SIGINT', 0));
process.on('SIGTERM', () => flushDbAndExit('SIGTERM', 0));
process.on('beforeExit', () => {
  try {
    flushDbSave();
  } catch (err) {
    console.error('Failed to flush pending DB write on exit:', err);
  }
});

async function startServer() {
  // M4.8: Initialize session token (auto-generates & stores 0600 file in prod, or uses env var)
  initOrLoadSessionToken();

  // Environment constraint: Dev server must run on port 3000 in AI Studio
  const PORT = process.env.NODE_ENV === 'production' ? (Number(process.env.PORT) || 3000) : 3000;
  // M4.1: Host binding security guard (defaults to 127.0.0.1; forbids 0.0.0.0 in prod without flag)
  const HOST = resolveServerHost(process.env.HOST);
  enforceHostBinding(HOST, process.env.NODE_ENV, process.env.ALLOW_PUBLIC_BIND === 'true');

  // M4.3: Check database integrity and restore from backup if corrupted
  const dbPath = path.join(process.cwd(), 'data', 'superbot.sqlite');
  const backupDir = path.join(process.cwd(), 'data', 'backups');
  try {
    await ensureSqlInstance();
    initOrRestoreDatabase(dbPath, backupDir);
  } catch (err: any) {
    console.error('❌ [FATAL DATABASE INTEGRITY ERROR]:', err?.message || err);
    process.exit(1);
  }

  // M4.2: Load persistent app_state (kill-switch and risk limits) at boot
  try {
    const database = await getDb();
    await loadAppStateFromDb(database);
  } catch (err: any) {
    console.warn('⚠️ Falha ao inicializar banco para app_state:', err?.message || err);
  }

  // M4.6: Clock drift initial verification and 10m periodic check
  checkBinanceServerTimeDrift().catch(err => console.warn('Falha no check inicial de relógio:', err));
  const clockCheckTimer = setInterval(() => {
    checkBinanceServerTimeDrift().catch(err => console.warn('Falha periódica no check de relógio:', err));
  }, 10 * 60 * 1000);
  clockCheckTimer.unref();

  // M4.3: Scheduled database backup every 6 hours
  const scheduledBackupTimer = setInterval(() => {
    try {
      createScheduledBackup(dbPath, backupDir);
    } catch (err) {
      console.error('Falha ao executar backup agendado:', err);
    }
  }, 6 * 60 * 60 * 1000);
  scheduledBackupTimer.unref();

  // Default indicator weights and models for immediate startup
  const defaultWeights: IndicatorWeights = getDefaultIndicatorWeights();

  // In-memory active ticker state cache
  const tickerStateCache: Record<string, TickerData> = {};

  const botState: BotState = {
    isMonitoring: true,
    activeTickersCount: DEFAULT_SYMBOLS.length,
    lastTickTime: Date.now(),
    ticksProcessed: 0,
    signalsGenerated24h: 0,
    weights: defaultWeights,
    aiModels: [],
    aiAnalysisEnabled: true
  };

  // Async load weights & models from DB without blocking server bind
  getIndicatorWeights().then(w => {
    botState.weights = w;
  }).catch(e => console.warn('Could not load weights from DB, using defaults:', e));

  getAIModels().then(m => {
    botState.aiModels = m;
  }).catch(e => console.warn('Could not load AI models from DB:', e));

  /**
   * Continuous Tick-by-Tick Market Monitoring Loop
   */
  let isMarketTickRunning = false;
  async function runMarketTick(forced = false) {
    if ((!botState.isMonitoring && !forced) || isMarketTickRunning) return;
    isMarketTickRunning = true;
    currentTickId = `tick-${Date.now()}`;
    const startedAt = Date.now();

    try {
      // Periodic institutional TTL sweep across all active signals
      await expireStaleSignals();

      // Phase 3.4: risk posture is evaluated once per tick. `openSignals` is kept in sync as new signals
      // are emitted so the concurrency and exposure limits hold within the same tick.
      // R-2: o motor enxerga todas as origens — se ele gerou um sinal DEMO, tem que gerenciá-lo.
      const openSignals = await getActiveSignals('ALL');
      const tradingHalted = isTradingHalted();

      // 1. Fetch live Binance Futures 24h Tickers
      const activeSymbols = marketScreener.getMonitoredSymbols();
      const rawFutures = await fetchBinanceFuturesTickers(activeSymbols);
      const weights = botState.weights;
      botState.activeTickersCount = activeSymbols.length;

      // Process in batches of 4 to prevent socket burst congestion and avoid rate limits
      const BATCH_SIZE = 4;
      for (let i = 0; i < activeSymbols.length; i += BATCH_SIZE) {
        const batch = activeSymbols.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(batch.map(async (symbol) => {
          try {
            const existingCache = tickerStateCache[symbol];
            // Phase 2.5.1: a quote rebuilt from cache keeps its original timestamp and is marked STALE
            // so the DataGate rejects it instead of treating a frozen price as fresh.
            const resolved = resolveRawTicker(
              symbol,
              rawFutures.find((t: any) => t.symbol === symbol),
              existingCache
            );
            if (!resolved) {
              return;
            }
            const { raw } = resolved;

            // Fetch live Kline data (15m timeframe, standard lookback candles - M2.3)
            const klines = await fetchKlines(symbol, '15m', SIGNAL_LOOKBACK_CANDLES);

            // Fetch live Open Interest with real change tracking (Phase 2.2)
            const oiData = await fetchOpenInterest(symbol);

            // Fetch live Funding Rate with contract interval (Phase 2.2 / 2.5.3)
            const fundingData = await fetchFundingRate(symbol);

            // Fetch Long/Short Ratio. Null means "unavailable" — it is never fabricated (Phase 2.5.2).
            let lsData: LongShortRatioData | null = null;
            try {
              lsData = await fetchLongShortRatio(symbol, raw?.lastPrice ? parseFloat(raw.lastPrice) : undefined);
            } catch {
              // Non-blocking
            }

            // Phase 2.5.2: carry per-factor provenance instead of coercing missing feeds to 0.
            const inputs = resolveMarketInputs({
              cached: existingCache,
              oiData,
              fundingData,
              longShortData: lsData,
              defaultFundingIntervalHours: DEFAULT_FUNDING_INTERVAL_HOURS
            });

            // D3/D5 & Phase 2.2: Process ticker state strictly from real live data
            const processed = processTickerState(
              raw,
              klines,
              inputs.openInterest,
              inputs.fundingRate,
              weights,
              inputs.longShortData,
              undefined,
              inputs.realOiChange,
              inputs.fundingIntervalHours,
              inputs.availability
            );
            if (!processed) {
              return;
            }

            tickerStateCache[symbol] = processed;

            // D3: DataGate Evaluation (Geração e avaliação bloqueadas se dados forem desatualizados ou degradados)
            const gateDecision = canGenerateSignals(processed);
            const activeTradeGate = canEvaluateActiveTrades(processed);

            // Strategy & Signal Evaluation across enabled presets
            const activeConfigs = resolveActiveStrategies(weights);

            for (const stratConfig of activeConfigs) {
              const targetCategory = stratConfig.category;
              const targetTimeframe = stratConfig.timeframe;

              // R-2: mesmo motivo do openSignals acima — o motor deduplica contra tudo que ele criou.
              const activeSignalsForCategory = await getActiveSignalsBySymbol(symbol, targetCategory, 'ALL');

              if (activeSignalsForCategory.length === 0) {
                const minScore = weights.minConfluenceScore ?? 65;

                // Phase 2.4/2.5.5: Ensure underlying TradFi market is open before emitting signals.
                // Classification comes from the exchangeInfo-discovered registry, not a hardcoded list.
                const tradfiAsset = getTradfiAsset(symbol);
                const isTradfiAllowed = !tradfiAsset || isTradfiMarketOpen(tradfiAsset.tradfiCategory);

                // Phase 3.4: the kill-switch and the portfolio limits gate emission.
                const risk = evaluatePortfolioRisk(openSignals, DEFAULT_RISK_LIMITS, { category: targetCategory });
                if (tradingHalted && processed.confluenceScore >= minScore) {
                  // R-15 (critério 2): bloqueios do kill-switch viram métrica.
                  incrementMetric(METRIC_NAMES.signalsSuppressedKillswitch);
                  logJson('INFO', 'tick', 'Sinal suprimido pelo kill-switch', { symbol, category: targetCategory, correlationId: currentTickId });
                  console.log(`⛔ [KILL-SWITCH] Sinal ${symbol}/${targetCategory} suprimido (trading suspenso).`);
                } else if (!risk.allowed && processed.confluenceScore >= minScore) {
                  incrementMetric(METRIC_NAMES.signalsBlockedRiskLimit);
                  logJson('INFO', 'tick', 'Sinal suprimido por limite de risco', { symbol, category: targetCategory, reasons: risk.reasons, correlationId: currentTickId });
                  console.log(`⛔ [RISK LIMIT] Sinal ${symbol}/${targetCategory} suprimido: ${risk.reasons.join(' ')}`);
                } else if (!gateDecision.allow && processed.confluenceScore >= minScore) {
                  incrementMetric(METRIC_NAMES.signalsBlockedDatagate);
                  logJson('INFO', 'tick', 'Sinal bloqueado pelo DataGate', { symbol, category: targetCategory, gateReason: gateDecision.reason, correlationId: currentTickId });
                } else if (!isTradfiAllowed && processed.confluenceScore >= minScore) {
                  incrementMetric(METRIC_NAMES.tradingScheduleBlocks);
                  logJson('INFO', 'tick', 'Sinal bloqueado: mercado TradFi subjacente fechado', { symbol, category: targetCategory, correlationId: currentTickId });
                } else if (gateDecision.allow && isTradfiAllowed && processed.confluenceScore >= minScore) {
                  const newSignal = buildTradeSignal(
                    processed,
                    klines,
                    stratConfig.minRiskRewardRatio,
                    targetCategory,
                    targetTimeframe,
                    weights.signalTtlSettings
                  );
                  if (newSignal) {
                    await saveSignal(newSignal);
                    // M3.1: Server-authoritative append-only signal ledger & events
                    signalLedgerDao.recordSignal({
                      id: newSignal.id,
                      symbol: newSignal.symbol,
                      category: newSignal.strategyCategory || targetCategory,
                      direction: newSignal.direction,
                      entryPrice: newSignal.currentPrice,
                      stopLoss: newSignal.stopLoss,
                      takeProfit1: newSignal.target1,
                      takeProfit2: newSignal.target2,
                      score: newSignal.confluenceScore,
                      factors: newSignal.confluenceFactors,
                      origin: newSignal.origin || 'LIVE',
                      tradfiSession: tradfiAsset?.tradfiCategory,
                      createdAt: newSignal.createdAt
                    }).catch(e => console.warn('Ledger signal record error:', e));

                    signalLedgerDao.recordEvent({
                      signalId: newSignal.id,
                      eventType: 'ENTRY',
                      price: newSignal.currentPrice,
                      timestamp: newSignal.createdAt || Date.now()
                    }).catch(e => console.warn('Ledger event entry error:', e));

                    // Keep the in-tick risk snapshot current so limits hold for the rest of this tick.
                    openSignals.push(newSignal);
                    botState.signalsGenerated24h++;
                    incrementMetric(METRIC_NAMES.signalsEmitted);
                    logJson('INFO', 'tick', 'Novo sinal emitido', { symbol, category: targetCategory, direction: newSignal.direction, score: newSignal.confluenceScore, origin: newSignal.origin, correlationId: currentTickId });
                    console.log(`⚡ [NEW ${targetCategory} SIGNAL] ${symbol} ${newSignal.direction} Score: ${newSignal.confluenceScore}% RR: 1:${newSignal.riskRewardRatio}`);
                  }
                }
              } else if (activeTradeGate.allow) {
                // Monitor active trades for targets, stop-loss or breakeven updates
                // Phase 2.5.1: decision logic lives in the unit-tested TickProcessor module.
                // Phase 3.1: also pass the forming candle's range so a stop or target touched between
                // ticks is not missed.
                const lastKline = klines.length > 0 ? klines[klines.length - 1] : undefined;
                const positionActions = evaluatePositionManagement(
                  activeSignalsForCategory,
                  processed.price,
                  lastKline ? { high: lastKline.high, low: lastKline.low, openTime: lastKline.timestamp } : undefined
                );
                for (const action of positionActions) {
                  if (action.type === 'HIT_TARGET2') {
                    await updateSignalStatus(action.signalId, 'TARGET_REACHED', action.reason);
                    console.log(`🎯 [TARGET 2 HIT] ${symbol} hit final take profit.`);
                    signalLedgerDao.recordEvent({
                      signalId: action.signalId,
                      eventType: 'TARGET2',
                      price: processed.price,
                      timestamp: Date.now()
                    }).catch(e => console.warn('Ledger event TARGET2 error:', e));
                  } else if (action.type === 'STOPPED_OUT') {
                    await updateSignalStatus(action.signalId, 'STOPPED_OUT', action.reason);
                    console.log(`🛑 [STOPPED OUT] ${symbol} (${action.reason})`);
                    const isBreakeven = action.reason?.includes('Breakeven');
                    signalLedgerDao.recordEvent({
                      signalId: action.signalId,
                      eventType: isBreakeven ? 'BREAKEVEN' : 'STOP',
                      price: processed.price,
                      timestamp: Date.now()
                    }).catch(e => console.warn('Ledger event STOP/BREAKEVEN error:', e));
                  } else {
                    console.log(`🛡️ [BREAKEVEN ACTIVATED] ${symbol} stop moved to entry.`);
                    await updateSignal(action.signal);
                    signalLedgerDao.recordEvent({
                      signalId: action.signal.id,
                      eventType: 'PARTIAL',
                      price: processed.price,
                      timestamp: Date.now()
                    }).catch(e => console.warn('Ledger event PARTIAL error:', e));
                  }
                }
              }
            }
          } catch (itemErr) {
            console.warn(`Error processing tick for ${symbol}:`, itemErr);
          }
        }));
      }

      botState.ticksProcessed++;
      botState.lastTickTime = Date.now();
      incrementMetric(METRIC_NAMES.ticksProcessed);
      logJson('INFO', 'tick', 'Tick concluído', {
        symbols: activeSymbols.length,
        durationMs: Date.now() - startedAt,
        correlationId: currentTickId
      });
    } catch (tickErr) {
      incrementMetric('tick_errors');
      logJson('ERROR', 'tick', 'Exceção no tick de mercado', { error: String(tickErr), correlationId: currentTickId });
      console.error('Market tick scan exception:', tickErr);
    } finally {
      isMarketTickRunning = false;
    }
  }

  // Scan trigger helper for strategy changes
  const triggerMarketScan = async (options?: { resetCategory?: string }) => {
    if (options?.resetCategory) {
      if (options.resetCategory === 'ALL') {
        await expireAllActiveSignals();
      } else {
        await expireActiveSignalsByCategory(options.resetCategory);
      }
    }
    await runMarketTick(true);
  };

  // Phase 2.5.9: build the real Express application (middleware, CORS, limiters, auth, routers).
  const app = createApp({ botState, tickerStateCache, triggerMarketScan });

  // VITE MIDDLEWARE (Dev) / STATIC FILES (Prod)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`🤖 Market Signals SuperBot running securely on http://${HOST}:${PORT}`);
    console.log(`🔒 Authentication: Bearer Token active. (Effective token initialized)`);

    // Initialize background workers AFTER server is listening
    try {
      initBinanceWebSocket();
    } catch (wsErr) {
      console.warn('WebSocket init warning:', wsErr);
    }

    // Phase 2.5.5: discover TradFi instruments from exchangeInfo at boot. Until this resolves the
    // registry is empty, which means no TradFi signal gating is applied to unknown symbols.
    refreshTradfiRegistry()
      .then(assets => console.log(`📊 Registro TradFi: ${assets.length} contrato(s) descoberto(s).`))
      .catch(err => console.warn('TradFi registry discovery warning:', err));

    // R-11: calendário oficial de feriados/horários reduzidos (cache diário). Sem isso o gate
    // TradFi decide só pelo relógio de NY, que trata feriado como dia útil.
    const refreshScheduleLoop = () => {
      refreshTradingSchedule()
        .then(ok => {
          if (ok) console.log('🗓️ Calendário de trading da exchange carregado (cache diário).');
          else console.warn('⚠️ tradingSchedule indisponível — TradFi usando relógio America/New_York (sem feriados).');
        })
        .catch(() => {}); // refreshTradingSchedule não propaga, mas o loop não pode morrer
    };
    refreshScheduleLoop();
    setInterval(refreshScheduleLoop, 6 * 60 * 60 * 1000).unref(); // re-tenta a cada 6h (TTL 24h

    runMarketTick();
    setInterval(runMarketTick, 4000);

    // Initial Market Screener scan & recurring periodic rescan
    marketScreener.runScreenerScan().then(() => {
      runMarketTick(true);
    }).catch(err => {
      console.warn('Initial market screener scan warning:', err);
    });

    // Check periodically (every 5 minutes) if screener is due for rescan
    setInterval(async () => {
      try {
        const { getScreenerSettings } = await import('./server/db.js');
        const settings = await getScreenerSettings();
        const intervalMs = (settings.rescanIntervalMinutes || 15) * 60 * 1000;
        if (Date.now() - settings.lastRescanTimestamp >= intervalMs) {
          await marketScreener.runScreenerScan();
          runMarketTick(true);
        }
      } catch (err) {
        console.warn('Scheduled screener rescan error:', err);
      }
    }, 60000);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting Market Signals SuperBot server:', err);
  process.exit(1);
});
