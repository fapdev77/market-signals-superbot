import { describe, it, expect } from 'vitest';
import { getDb, saveSignal, getActiveSignalsBySymbol, updateSignalStatus, getRecentSignals, saveIndicatorWeights, getIndicatorWeights, saveDbToDisk } from '../server/db.js';
import { TradeSignal, IndicatorWeights } from '../src/types.js';

describe('SQLite Persistence & Data Integrity Suite', () => {
  it('initializes the SQLite database with required tables', async () => {
    const db = await getDb();
    expect(db).toBeDefined();

    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables[0]?.values?.map(row => row[0]) || [];

    expect(tableNames).toContain('trade_signals');
    expect(tableNames).toContain('strategy_settings');
    expect(tableNames).toContain('ai_audits');
  });

  it('saves, queries, updates status, and retrieves trade signals', async () => {
    const testSignal: TradeSignal = {
      id: `TEST-SIG-${Date.now()}`,
      symbol: 'AVAXUSDT',
      marketType: 'crypto_futures',
      signalType: 'LONG',
      direction: 'LONG',
      entryZone: [28.5, 29.0],
      currentPrice: 28.8,
      stopLoss: 27.5,
      target1: 31.0,
      target2: 33.5,
      riskRewardRatio: 3.6,
      confluenceScore: 82,
      confluenceFactors: ['Fibonacci 0.618', 'CVD Positive Delta'],
      timeframe: '15m',
      validationStatus: 'CONFIRMED',
      validationStage: 'VALIDADO',
      candle1mConfirmed: true,
      candle5mConfirmed: true,
      createdAt: Date.now(),
      status: 'ACTIVE'
    };

    await saveSignal(testSignal);

    const activeList = await getActiveSignalsBySymbol('AVAXUSDT');
    const saved = activeList.find(s => s.id === testSignal.id);
    expect(saved).toBeDefined();
    expect(saved?.symbol).toBe('AVAXUSDT');
    expect(saved?.riskRewardRatio).toBe(3.6);
    expect(saved?.confluenceFactors).toContain('Fibonacci 0.618');

    // Update status to EXPIRED
    await updateSignalStatus(testSignal.id, 'EXPIRED');
    const updatedActiveList = await getActiveSignalsBySymbol('AVAXUSDT');
    expect(updatedActiveList.find(s => s.id === testSignal.id)).toBeUndefined();

    // Still accessible in recent signals history
    const recent = await getRecentSignals(10);
    expect(recent.some(s => s.id === testSignal.id)).toBe(true);
  });

  it('persists and retrieves custom indicator weights accurately', async () => {
    const customWeights: IndicatorWeights = {
      volumeSurgeWeight: 25,
      openInterestWeight: 25,
      fundingRateWeight: 10,
      cvdImbalanceWeight: 15,
      fibonacciZoneWeight: 10,
      rangePocWeight: 5,
      supportResistanceWeight: 10,
      volumeProfileRange: 30,
      minRiskRewardRatio: 3.5
    };

    await saveIndicatorWeights(customWeights);
    const retrieved = await getIndicatorWeights();

    expect(retrieved).toBeDefined();
    expect(retrieved?.volumeSurgeWeight).toBe(25);
    expect(retrieved?.minRiskRewardRatio).toBe(3.5);
  });

  it('performs atomic disk flush without throwing errors', () => {
    expect(() => saveDbToDisk()).not.toThrow();
  });
});
