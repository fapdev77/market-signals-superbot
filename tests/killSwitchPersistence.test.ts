import { describe, it, expect, beforeEach } from 'vitest';
import initSqlJs, { Database } from 'sql.js';
import { applyMigrations } from '../server/migrations/index.js';
import {
  loadAppStateFromDb,
  saveKillSwitchToDb,
  saveRiskLimitsToDb,
  getKillSwitch,
  setKillSwitch,
  isTradingHalted,
  resetRiskManagerForTests,
  getRiskLimits,
  updateRiskLimits
} from '../server/services/RiskManager.js';

describe('M4.2 & CA-4.1, CA-4.2: Kill-Switch & Risk Limits Persistence', () => {
  let db: Database;

  beforeEach(async () => {
    resetRiskManagerForTests();
    const SQL = await initSqlJs();
    db = new SQL.Database();
    applyMigrations(db);
  });

  it('CA-4.1: setting kill-switch persists to app_state and keeps trading halted after reload', async () => {
    // 1. Initially trading is not halted
    expect(isTradingHalted()).toBe(false);

    // 2. Set kill-switch with actor and reason
    setKillSwitch(true, 'operator-1', 'Market volatility anomaly');
    await saveKillSwitchToDb(db);

    // 3. Reset in-memory state as if server restarted
    resetRiskManagerForTests();
    expect(isTradingHalted()).toBe(false);

    // 4. Reload from database
    const loadResult = await loadAppStateFromDb(db);
    expect(loadResult.success).toBe(true);
    expect(isTradingHalted()).toBe(true);

    const ks = getKillSwitch();
    expect(ks.enabled).toBe(true);
    expect(ks.reason).toBe('Market volatility anomaly');
    expect(ks.activatedBy).toBe('operator-1');
  });

  it('CA-4.2: unreadable or corrupted app_state fails closed and starts suspended', async () => {
    // Insert corrupted JSON into app_state
    db.run(
      `INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)`,
      ['kill_switch', '{corrupted_not_valid_json', Date.now()]
    );

    resetRiskManagerForTests();
    expect(isTradingHalted()).toBe(false);

    // Loading corrupted state must trigger fail-closed behavior
    const loadResult = await loadAppStateFromDb(db);
    expect(loadResult.failClosedTriggered).toBe(true);
    expect(isTradingHalted()).toBe(true);
    expect(getKillSwitch().reason).toContain('Fail-closed');
  });

  it('persists and reloads updated risk limits', async () => {
    const newLimits = {
      accountEquity: 50000,
      riskPerTradePct: 2,
      maxConcurrentSignals: 5,
      maxPortfolioRiskPct: 10,
      maxSignalsPerCategory: 2
    };

    updateRiskLimits(newLimits);
    await saveRiskLimitsToDb(db);

    resetRiskManagerForTests();
    expect(getRiskLimits().accountEquity).toBe(10000); // default

    await loadAppStateFromDb(db);
    expect(getRiskLimits()).toEqual(newLimits);
  });
});
