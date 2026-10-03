import { backtestScheduleDao, BacktestScheduleRow } from '../backtest_db/index.js';
import { getErrorMessage } from '../utils/errors.js';
import { BacktestEngine } from './BacktestEngine.js';
import { ensureFundingCoverage, defaultFundingBudgetPerMinute, capFundingSymbols, maxFundingSymbolsPerRun } from './FundingCoverageTrigger.js';
import { BotState, TradingProfile } from '../../src/types.js';
import { addBinanceLog } from '../binanceWebsocket.js';
import { getKillSwitch } from './RiskManager.js';
// 8.3.1 — guardas: rate limiter, feed degradado, teto de símbolos, alerta de falha.
import { BinanceRateLimiter } from '../utils/binanceRateLimiter.js';
import { getFeedHealth, type FeedName } from './feedHealth.js';
import { emitOperationalAlert } from './operationalAlerts.js';

let schedulerInterval: NodeJS.Timeout | null = null;
let isExecuting = false;

/** Feeds cujo estado DEGRADED impede a execução agendada. */
export const SCHEDULER_CRITICAL_FEEDS: FeedName[] = ['ticker', 'klines'];

/** 8.3.1 — teto de símbolos por execução (env `SCHEDULER_MAX_SYMBOLS_PER_RUN`). */
export function maxSchedulerSymbolsPerRun(): number {
  const parsed = Number(process.env.SCHEDULER_MAX_SYMBOLS_PER_RUN);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 10;
}

/** 8.3.1 — aplica o teto de símbolos por execução (exportado para teste). */
export function capSchedulerSymbols(
  symbols: string[],
  max: number = maxSchedulerSymbolsPerRun()
): string[] {
  return capFundingSymbols(symbols, Math.max(1, max));
}

export interface SchedulerGuardDeps {
  /** Injeção para teste; default: `BinanceRateLimiter.isAllowed`. */
  isRateLimiterAllowed?: () => boolean;
  /** Injeção para teste; default: `getFeedHealth`. */
  getFeedHealthSnapshot?: (now?: number) => ReturnType<typeof getFeedHealth>;
  now?: () => number;
}

export interface SchedulerGuardResult {
  allowed: boolean;
  code: 'OK' | 'RATE_LIMITED' | 'FEED_DEGRADED';
  reason: string;
}

/**
 * 8.3.1 — guardas puras de execução: não roda com a API em cooldown nem com feed
 * crítico DEGRADED. Retorna o motivo (para log e para o status da agenda).
 */
export function checkSchedulerGuards(deps: SchedulerGuardDeps = {}): SchedulerGuardResult {
  const allowedNow = (deps.isRateLimiterAllowed ?? (() => BinanceRateLimiter.isAllowed()))();
  if (!allowedNow) {
    return {
      allowed: false,
      code: 'RATE_LIMITED',
      reason: 'API da Binance em cooldown preventivo (429/418); execução agendada adiada.'
    };
  }

  const now = (deps.now ?? Date.now)();
  const snapshot = (deps.getFeedHealthSnapshot ?? getFeedHealth)(now);
  const degraded = SCHEDULER_CRITICAL_FEEDS.filter(
    feed => snapshot.feeds[feed]?.status === 'DEGRADED'
  );
  if (degraded.length > 0) {
    return {
      allowed: false,
      code: 'FEED_DEGRADED',
      reason: `Feed(s) crítico(s) DEGRADED: ${degraded.join(', ')}.`
    };
  }

  return { allowed: true, code: 'OK', reason: 'OK' };
}

export interface ScheduleRunResult {
  success: boolean;
  message: string;
  resultId?: string;
  stats?: {
    symbol: string;
    trades: number;
    winRate: number;
    profitFactor: number;
    netProfit: number;
  };
}

export interface NextExecutionInfo {
  nextRunTimestamp: number;
  formattedUTC: string;
  isToday: boolean;
  timeRemainingMs: number;
  timeRemainingFormatted: string;
}

/**
 * Calculates the next planned execution timestamp and formatted label.
 */
export function computeNextExecutionTime(
  schedule: { timeOfDay?: string; enabled?: boolean; lastRunAt?: number | null },
  nowMs: number = Date.now()
): NextExecutionInfo | null {
  if (!schedule.enabled) return null;

  const [hStr, mStr] = (schedule.timeOfDay || '00:00').split(':');
  const targetH = parseInt(hStr, 10) || 0;
  const targetM = parseInt(mStr, 10) || 0;

  const now = new Date(nowMs);
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    targetH,
    targetM,
    0,
    0
  ));

  if (next.getTime() <= nowMs || (schedule.lastRunAt && (nowMs - schedule.lastRunAt) < 23 * 3600 * 1000 && next.getTime() <= (schedule.lastRunAt + 23 * 3600 * 1000))) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  const isToday = next.getUTCDate() === now.getUTCDate() && next.getUTCMonth() === now.getUTCMonth();
  const hours = String(next.getUTCHours()).padStart(2, '0');
  const minutes = String(next.getUTCMinutes()).padStart(2, '0');
  const day = String(next.getUTCDate()).padStart(2, '0');
  const month = String(next.getUTCMonth() + 1).padStart(2, '0');

  const diffMs = Math.max(0, next.getTime() - nowMs);
  const diffHours = Math.floor(diffMs / (3600 * 1000));
  const diffMins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));

  return {
    nextRunTimestamp: next.getTime(),
    formattedUTC: `${isToday ? 'Hoje' : 'Amanhã'} (${day}/${month}) às ${hours}:${minutes} UTC`,
    isToday,
    timeRemainingMs: diffMs,
    timeRemainingFormatted: diffHours > 0 ? `${diffHours}h ${diffMins}m` : `${diffMins}m`
  };
}

/**
 * Calculates whether the current moment matches the target HH:MM schedule
 * and has not already executed within the past 23 hours.
 */
export function isScheduleDue(schedule: BacktestScheduleRow, nowMs: number = Date.now()): boolean {
  if (!schedule.enabled) return false;

  const now = new Date(nowMs);
  const curH = String(now.getUTCHours()).padStart(2, '0');
  const curM = String(now.getUTCMinutes()).padStart(2, '0');
  const currentHHMM = `${curH}:${curM}`;

  if (currentHHMM !== schedule.timeOfDay) {
    return false;
  }

  // Prevent multiple executions in the same minute or day
  if (schedule.lastRunAt) {
    const elapsedMs = nowMs - schedule.lastRunAt;
    if (elapsedMs < 23 * 3600 * 1000) {
      return false;
    }
  }

  return true;
}

export interface SchedulerRunDeps extends SchedulerGuardDeps {
  runBacktest?: typeof BacktestEngine.runBacktest;
  ensureFunding?: typeof ensureFundingCoverage;
  updateLastRun?: (id: string, status: string, resultId?: string) => Promise<void>;
}

export async function executeScheduledBacktest(
  schedule: BacktestScheduleRow,
  botState: BotState,
  deps: SchedulerRunDeps = {}
): Promise<ScheduleRunResult> {
  if (isExecuting) {
    return { success: false, message: 'Execução de backtest já em andamento' };
  }

  isExecuting = true;
  const symbol = schedule.symbol || 'BTCUSDT';
  const days = schedule.days || 30;
  const profile = (schedule.profile || 'daytrade') as TradingProfile;
  const updateLastRun =
    deps.updateLastRun ??
    ((id: string, status: string, resultId?: string) =>
      backtestScheduleDao.updateLastRun(id, status, resultId));

  // 8.3.1 — guardas antes de qualquer chamada de rede.
  const guard = checkSchedulerGuards(deps);
  if (!guard.allowed) {
    isExecuting = false;
    addBinanceLog('WARN', 'REST_API', `Backtest agendado (${symbol}) pulado pela guarda: ${guard.reason}`);
    await updateLastRun(schedule.id, `SKIPPED_${guard.code}`);
    return { success: false, message: `Pulado: ${guard.reason}` };
  }

  addBinanceLog(
    'INFO',
    'REST_API',
    `Iniciando backtest diário agendado para ${symbol} (${days}d, perfil ${profile}).`
  );

  try {
    const runBacktest = deps.runBacktest ?? BacktestEngine.runBacktest;
    const ensureFunding = deps.ensureFunding ?? ensureFundingCoverage;

    // 1. Ensure funding coverage before running
    try {
      await ensureFunding(symbol, days, {
        budgetPerMinute: defaultFundingBudgetPerMinute()
      });
    } catch (fundErr) {
      console.warn(`[scheduler] Aviso ao sincronizar funding para ${symbol}:`, getErrorMessage(fundErr));
    }

    // 2. Run backtest with current bot indicator weights
    // 8.3.1 — o scheduler NÃO aplica pesos sozinho: só lê `botState.weights`.
    const weights = botState.weights;
    const result = await runBacktest({
      symbol,
      days,
      profile,
      weights
    }, false); // fresh run, no stale cache

    // 3. Update database record
    await updateLastRun(schedule.id, 'SUCCESS', result.id);

    addBinanceLog(
      'SUCCESS',
      'REST_API',
      `Backtest diário agendado para ${symbol} concluído com sucesso. WR: ${result.winRate.toFixed(1)}%, PF: ${result.profitFactor.toFixed(2)}, Trades: ${result.totalTrades}.`
    );

    return {
      success: true,
      message: `Backtest diário agendado executado com sucesso para ${symbol}`,
      resultId: result.id,
      stats: {
        symbol: result.symbol,
        trades: result.totalTrades,
        winRate: result.winRate,
        profitFactor: result.profitFactor,
        netProfit: result.netProfit
      }
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await updateLastRun(schedule.id, `FAILED: ${errorMsg}`);

    addBinanceLog(
      'ERROR',
      'REST_API',
      `Falha na execução do backtest diário agendado para ${symbol}: ${errorMsg}`
    );

    // 8.3.1 — falha dispara alerta operacional.
    void emitOperationalAlert(
      'BACKTEST_SCHEDULE_FAILED',
      'HIGH',
      `Backtest agendado (${symbol}) falhou: ${errorMsg}`,
      { symbol, scheduleId: schedule.id }
    );

    return { success: false, message: errorMsg };
  } finally {
    isExecuting = false;
  }
}

export async function checkAndRunDueSchedule(getBotState: () => BotState): Promise<ScheduleRunResult | null> {
  const schedule = await backtestScheduleDao.getSchedule();
  if (!schedule) {
    // Bootstrap initial default schedule
    await backtestScheduleDao.saveSchedule({
      id: 'daily-default',
      enabled: true,
      timeOfDay: '00:00',
      timezone: 'UTC',
      symbol: 'BTCUSDT',
      days: 30,
      profile: 'daytrade'
    });
    return null;
  }

  const botState = getBotState();
  const killSwitch = getKillSwitch();
  if (killSwitch.enabled) {
    if (isScheduleDue(schedule)) {
      addBinanceLog('WARN', 'REST_API', 'Backtest diário agendado ignorado pois o Kill Switch está ativo.');
      await backtestScheduleDao.updateLastRun(schedule.id, 'SKIPPED_BOT_HALTED');
    }
    return null;
  }

  if (isScheduleDue(schedule)) {
    return await executeScheduledBacktest(schedule, botState);
  }

  return null;
}

export function initBacktestScheduler(getBotState: () => BotState) {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }

  // Periodic check every 60 seconds
  schedulerInterval = setInterval(() => {
    checkAndRunDueSchedule(getBotState).catch(err => {
      console.error('[scheduler] Erro no tick do BacktestScheduler:', err);
    });
  }, 60000);

  // Initial trigger check
  checkAndRunDueSchedule(getBotState).catch(() => {});
  console.log('⏰ [SCHEDULER] BacktestScheduler iniciado (verificação a cada 60s).');
}

export function stopBacktestScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
