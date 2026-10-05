import type { TradeSignal, StrategyCategory } from '../../src/types.js';
import { getErrorMessage } from '../utils/errors.js';
import type { Database } from 'sql.js';
import { dAdd, dDiv, dMul, dSub, dRound } from '../utils/decimal.js';
import { emitOperationalAlert } from './operationalAlerts.js';

/**
 * Server-side risk primitives (Phase 3.4).
 *
 * The platform emits signals rather than executing orders, so there is no position to size on the
 * exchange. What it *can* do — and previously did not — is limit how much risk it will recommend at once
 * and provide an operator-controlled stop. Everything here is pure and unit-tested.
 *
 * Risk per signal is priced by the stop, which is how these signals resolve (stop-first, see
 * TickProcessor). Two distinct quantities live here and must not be conflated: the *distance* from
 * entry to stop, in percent of price, and the *open risk*, in quote currency, that a signal commits
 * once it is sized. `signalStopDistancePct` answers the first; `signalOpenRiskAmount` and
 * `evaluatePortfolioRisk` work in the second.
 */

export interface RiskLimits {
  /** Account equity used as the sizing base, in quote currency. */
  accountEquity: number;
  /** Percentage of equity risked on a single signal. */
  riskPerTradePct: number;
  /** Maximum number of concurrently open signals across all symbols. */
  maxConcurrentSignals: number;
  /** Maximum aggregate open risk across all signals, as a percentage of equity. */
  maxPortfolioRiskPct: number;
  /** Maximum concurrently open signals per strategy category. */
  maxSignalsPerCategory: number;
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  accountEquity: 10000,
  riskPerTradePct: 1,
  maxConcurrentSignals: 8,
  maxPortfolioRiskPct: 6,
  maxSignalsPerCategory: 3
};

let currentRiskLimits: RiskLimits = { ...DEFAULT_RISK_LIMITS };

export function getRiskLimits(): RiskLimits {
  return { ...currentRiskLimits };
}

export function updateRiskLimits(limits: Partial<RiskLimits>): RiskLimits {
  currentRiskLimits = {
    ...currentRiskLimits,
    ...limits
  };
  return { ...currentRiskLimits };
}

export interface PositionSize {
  valid: boolean;
  reason?: string;
  /** Distance between entry and stop, per unit. */
  riskPerUnit: number;
  /** Currency amount risked if the stop is hit. */
  riskAmount: number;
  /** Position size in units of the base asset. */
  quantity: number;
  /** Notional value of the position. */
  notional: number;
}

/**
 * Sizes a signal from the stop distance. Returns `valid: false` with a reason when the inputs cannot
 * produce a sane position (rather than silently returning a huge or negative size).
 */
export function computePositionSize(params: {
  entryPrice: number;
  stopLossPrice: number;
  equity?: number;
  riskPerTradePct?: number;
  minQuantity?: number;
  quantityDecimals?: number;
}): PositionSize {
  const equity = params.equity ?? DEFAULT_RISK_LIMITS.accountEquity;
  const riskPerTradePct = params.riskPerTradePct ?? DEFAULT_RISK_LIMITS.riskPerTradePct;
  const quantityDecimals = params.quantityDecimals ?? 4;
  const minQuantity = params.minQuantity ?? 0.0001;

  const invalid = (reason: string): PositionSize => ({
    valid: false,
    reason,
    riskPerUnit: 0,
    riskAmount: 0,
    quantity: 0,
    notional: 0
  });

  if (!Number.isFinite(params.entryPrice) || params.entryPrice <= 0) return invalid('Preço de entrada inválido.');
  if (!Number.isFinite(params.stopLossPrice) || params.stopLossPrice <= 0) return invalid('Stop loss inválido.');
  if (!Number.isFinite(equity) || equity <= 0) return invalid('Equity inválida.');
  if (!Number.isFinite(riskPerTradePct) || riskPerTradePct <= 0) return invalid('Risco por trade inválido.');

  const riskPerUnit = dRound(Math.abs(dSub(params.entryPrice, params.stopLossPrice)), 10);
  if (riskPerUnit <= 0) return invalid('Distância de stop nula: tamanho indeterminado.');

  const riskAmount = dMul(equity, dDiv(riskPerTradePct, 100));
  const rawQuantity = dDiv(riskAmount, riskPerUnit);
  const quantity = dRound(rawQuantity, quantityDecimals);

  if (quantity < minQuantity) {
    return invalid(`Tamanho calculado (${quantity}) abaixo do mínimo negociável (${minQuantity}).`);
  }

  return {
    valid: true,
    riskPerUnit,
    riskAmount: dRound(riskAmount, 2),
    quantity,
    notional: dRound(dMul(quantity, params.entryPrice), 2)
  };
}

export interface PortfolioRisk {
  allowed: boolean;
  reasons: string[];
  concurrentCount: number;
  categoryCounts: Partial<Record<StrategyCategory, number>>;
  /** Aggregate open risk as a percentage of equity, summed from each signal's real open risk. */
  openRiskPct: number;
  /** Aggregate open risk in quote currency. */
  openRiskAmount: number;
  /**
   * Signals that carry no measurable open risk — no derivable stop distance, or a position size
   * below the tradable minimum. They contribute nothing to `openRiskAmount`; this count keeps
   * that exclusion visible instead of silent.
   */
  unmeasurableCount: number;
}

/**
 * Distance between entry and stop as a percentage of entry: |entry − stop| / entry × 100.
 *
 * This is geometry, not risk. It says how far away the stop sits, which is what `enforceStopCap`
 * compares against a per-category cap, and it is independent of equity and of the risk budget.
 * Open risk is a different quantity with a different unit — see `signalOpenRiskAmount`.
 */
export function signalStopDistancePct(signal: TradeSignal): number {
  const entry = signal.entryZone?.[0];
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(signal.stopLoss) || signal.stopLoss <= 0) {
    return 0;
  }
  const stopDistancePct = dMul(dDiv(Math.abs(dSub(entry, signal.stopLoss)), entry), 100);
  return dRound(stopDistancePct, 4);
}

/**
 * Open risk of a single signal, in quote currency: how much equity the signal actually puts at
 * risk when it is hit at the stop.
 *
 * Sizing goes through `computePositionSize` so the portfolio total is the same arithmetic the
 * emitter uses, rather than a budget assumed to be deployable. A signal whose size cannot be
 * computed commits nothing: no price data, no derivable stop distance, or a size below the
 * tradable minimum. Returns 0 in those cases; `evaluatePortfolioRisk` counts them separately.
 */
export function signalOpenRiskAmount(signal: TradeSignal, limits: RiskLimits = DEFAULT_RISK_LIMITS): number {
  const entry = signal.entryZone?.[0];
  if (!Number.isFinite(entry) || entry <= 0) return 0;
  const size = computePositionSize({
    entryPrice: entry,
    stopLossPrice: signal.stopLoss,
    equity: limits.accountEquity,
    riskPerTradePct: limits.riskPerTradePct
  });
  return size.valid ? size.riskAmount : 0;
}

/**
 * Decides whether another signal may be emitted given the currently open set.
 * Callers pass the open signals for the whole portfolio, not just one symbol.
 */
export function evaluatePortfolioRisk(
  openSignals: TradeSignal[],
  limits: RiskLimits = DEFAULT_RISK_LIMITS,
  incoming?: { category: StrategyCategory }
): PortfolioRisk {
  const reasons: string[] = [];
  const concurrentCount = openSignals.length;

  const categoryCounts: Partial<Record<StrategyCategory, number>> = {};
  for (const signal of openSignals) {
    const cat = signal.strategyCategory;
    if (!cat) continue;
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
  }

  // Aggregate open risk is the sum of what each open signal actually puts at the stop, priced by
  // the same sizing the emitter uses. Signals whose risk cannot be measured contribute nothing and
  // are counted in `unmeasurableCount` so the exclusion is observable rather than assumed.
  let openRiskAmount = 0;
  let unmeasurableCount = 0;
  for (const s of openSignals) {
    const amount = signalOpenRiskAmount(s, limits);
    if (amount > 0) {
      openRiskAmount = dAdd(openRiskAmount, amount);
    } else {
      unmeasurableCount += 1;
    }
  }
  openRiskAmount = dRound(openRiskAmount, 2);
  const openRiskPct = limits.accountEquity > 0
    ? dRound(dMul(dDiv(openRiskAmount, limits.accountEquity), 100), 4)
    : 0;

  if (concurrentCount >= limits.maxConcurrentSignals) {
    reasons.push(`Limite de sinais simultâneos atingido (${concurrentCount}/${limits.maxConcurrentSignals}).`);
  }

  if (incoming?.category && (categoryCounts[incoming.category] ?? 0) >= limits.maxSignalsPerCategory) {
    reasons.push(
      `Limite de sinais simultâneos para a categoria ${incoming.category} atingido ` +
      `(${categoryCounts[incoming.category]}/${limits.maxSignalsPerCategory}).`
    );
  }

  if (openRiskPct >= limits.maxPortfolioRiskPct) {
    reasons.push(
      `Risco agregado da carteira no limite (${openRiskPct}% >= ${limits.maxPortfolioRiskPct}%).`
    );
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    concurrentCount,
    categoryCounts,
    openRiskPct,
    openRiskAmount,
    unmeasurableCount
  };
}

// ---------------------------------------------------------------------------------------------
// Kill-switch
// ---------------------------------------------------------------------------------------------

export interface KillSwitchState {
  enabled: boolean;
  reason: string | null;
  activatedAt: number | null;
  activatedBy: string | null;
}

let killSwitch: KillSwitchState = {
  enabled: false,
  reason: null,
  activatedAt: null,
  activatedBy: null
};

export function getKillSwitch(): KillSwitchState {
  return { ...killSwitch };
}

/**
 * Enables or disables the halt. Enabling requires an actor and a reason so the audit trail explains who
 * stopped trading and why — the previous code had no way to stop signal generation at all.
 */
export function setKillSwitch(
  enabled: boolean,
  actor: string,
  reason?: string
): KillSwitchState {
  if (enabled && !reason?.trim()) {
    throw new Error('Ativar o kill-switch exige um motivo.');
  }

  killSwitch = enabled
    ? { enabled: true, reason: reason!.trim(), activatedAt: Date.now(), activatedBy: actor }
    : { enabled: false, reason: null, activatedAt: null, activatedBy: actor };

  // 6.6: KILL_SWITCH_CHANGED é evento operacional do catálogo (fire-and-forget;
  // falha de alerta jamais interfere na decisão de trading).
  void emitOperationalAlert(
    'KILL_SWITCH_CHANGED',
    'CRITICAL',
    `Kill-switch ${enabled ? 'ATIVADO' : 'desativado'} por ${actor}${reason ? `: ${reason.trim()}` : ''}.`,
    { enabled, actor, reason: reason?.trim() || null }
  );

  return getKillSwitch();
}

/** True when signal generation must be suppressed entirely. */
export function isTradingHalted(): boolean {
  return killSwitch.enabled;
}

export function resetKillSwitchForTests(): void {
  killSwitch = { enabled: false, reason: null, activatedAt: null, activatedBy: null };
}

export function resetRiskManagerForTests(): void {
  resetKillSwitchForTests();
  currentRiskLimits = { ...DEFAULT_RISK_LIMITS };
}

/**
 * Persists kill-switch state into app_state table.
 */
export async function saveKillSwitchToDb(db: Database): Promise<void> {
  const serialized = JSON.stringify(killSwitch);
  db.run(
    `INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES ('kill_switch', ?, ?);`,
    [serialized, Date.now()]
  );
}

/**
 * Persists risk limits into app_state table.
 */
export async function saveRiskLimitsToDb(db: Database): Promise<void> {
  const serialized = JSON.stringify(currentRiskLimits);
  db.run(
    `INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES ('risk_limits', ?, ?);`,
    [serialized, Date.now()]
  );
}

/**
 * Loads app_state from DB at boot (M4.2 / R-25).
 * Fail-closed: If state is unreadable or corrupted, starts suspended.
 */
export async function loadAppStateFromDb(db: Database): Promise<{
  success: boolean;
  failClosedTriggered: boolean;
  error?: string;
}> {
  try {
    const res = db.exec(`SELECT key, value FROM app_state WHERE key IN ('kill_switch', 'risk_limits');`);
    if (!res || res.length === 0 || !res[0].values) {
      return { success: true, failClosedTriggered: false };
    }

    for (const row of res[0].values) {
      const key = String(row[0]);
      const rawValue = String(row[1]);

      if (key === 'kill_switch') {
        try {
          const parsed = JSON.parse(rawValue);
          if (typeof parsed !== 'object' || parsed === null || typeof parsed.enabled !== 'boolean') {
            throw new Error('Kill switch state schema invalid');
          }
          killSwitch = {
            enabled: parsed.enabled,
            reason: parsed.reason || null,
            activatedAt: parsed.activatedAt || null,
            activatedBy: parsed.activatedBy || null
          };
        } catch (err) {
          // CA-4.2: Estado ilegivel em app_state faz o sistema iniciar suspenso (Fail-closed)
          killSwitch = {
            enabled: true,
            reason: `Fail-closed: Estado app_state corrompido ou ilegível no boot (${getErrorMessage(err)}).`,
            activatedAt: Date.now(),
            activatedBy: 'SYSTEM_FAIL_CLOSED'
          };
          return { success: false, failClosedTriggered: true, error: getErrorMessage(err) };
        }
      } else if (key === 'risk_limits') {
        try {
          const parsed = JSON.parse(rawValue);
          if (typeof parsed === 'object' && parsed !== null) {
            updateRiskLimits(parsed);
          }
        } catch (err) {
          console.warn('⚠️ Falha ao carregar limites de risco do app_state; mantendo padrões.');
        }
      }
    }

    return { success: true, failClosedTriggered: false };
  } catch (err) {
    // If table read fails altogether, fail-closed as safety measure
    killSwitch = {
      enabled: true,
      reason: `Fail-closed: Erro crítico ao ler app_state do banco (${getErrorMessage(err)}).`,
      activatedAt: Date.now(),
      activatedBy: 'SYSTEM_FAIL_CLOSED'
    };
    return { success: false, failClosedTriggered: true, error: getErrorMessage(err) };
  }
}

