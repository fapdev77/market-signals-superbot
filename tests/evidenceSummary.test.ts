import { describe, it, expect } from 'vitest';
import {
  generateEvidenceSummary,
  calculateWilsonScoreInterval,
  type ClosedSignalEvidence
} from '../server/services/EvidenceService.js';

describe('M3.3 & CA-3.3: Evidence Summary with Wilson Interval, Expectancy & Origin Filtering', () => {
  it('calculates Wilson score interval correctly', () => {
    // 10 trials, 7 wins (p = 0.7)
    const interval = calculateWilsonScoreInterval(7, 10, 0.95);
    expect(interval[0]).toBeGreaterThan(0.39);
    expect(interval[0]).toBeLessThan(0.42);
    expect(interval[1]).toBeGreaterThan(0.88);
    expect(interval[1]).toBeLessThan(0.92);

    // 0 trials
    const zero = calculateWilsonScoreInterval(0, 0);
    expect(zero).toEqual([0, 0]);

    // 100 trials, 50 wins (p = 0.5)
    const mid = calculateWilsonScoreInterval(50, 100, 0.95);
    expect(mid[0]).toBeCloseTo(0.4038, 2);
    expect(mid[1]).toBeCloseTo(0.5962, 2);
  });

  it('filters out DEMO signals by default when calculating evidence summary', () => {
    const fixtureSignals: ClosedSignalEvidence[] = [
      {
        id: 'sig-live-1',
        symbol: 'BTCUSDT',
        category: 'SCALP',
        direction: 'LONG',
        score: 85,
        scoreTier: '80-89',
        tradfiSession: 'REGULAR',
        origin: 'LIVE',
        netR: 1.5,
        mfeR: 2.0,
        maeR: -0.2,
        isWin: true,
        closedAt: 1700001000000
      },
      {
        id: 'sig-live-2',
        symbol: 'ETHUSDT',
        category: 'SCALP',
        direction: 'SHORT',
        score: 82,
        scoreTier: '80-89',
        tradfiSession: 'REGULAR',
        origin: 'LIVE',
        netR: -1.0,
        mfeR: 0.3,
        maeR: -1.0,
        isWin: false,
        closedAt: 1700002000000
      },
      {
        id: 'sig-demo-1',
        symbol: 'SOLUSDT',
        category: 'SCALP',
        direction: 'LONG',
        score: 88,
        scoreTier: '80-89',
        tradfiSession: 'REGULAR',
        origin: 'DEMO',
        netR: 5.0, // Large gain that must NOT affect LIVE summary
        mfeR: 5.5,
        maeR: 0,
        isWin: true,
        closedAt: 1700003000000
      }
    ];

    const summaryLive = generateEvidenceSummary(fixtureSignals, { origin: 'LIVE' });

    // Should only have 2 signals (the LIVE ones)
    expect(summaryLive.totalSignals).toBe(2);
    expect(summaryLive.wins).toBe(1);
    expect(summaryLive.losses).toBe(1);
    expect(summaryLive.winRate).toBe(50.0);
    // Expectancy: (1.5 + (-1.0)) / 2 = 0.25 R
    expect(summaryLive.rExpectancy).toBeCloseTo(0.25, 2);

    // Grouping by scoreTier
    const tier80 = summaryLive.byScoreTier['80-89'];
    expect(tier80).toBeDefined();
    expect(tier80.n).toBe(2);
    expect(tier80.winRate).toBe(50.0);
    expect(tier80.wilsonInterval[0]).toBeGreaterThan(0.09);
    expect(tier80.wilsonInterval[1]).toBeLessThan(0.91);

    // Grouping by category
    const catScalp = summaryLive.byCategory['SCALP'];
    expect(catScalp).toBeDefined();
    expect(catScalp.n).toBe(2);

    // Grouping by TradFi session
    const sessRegular = summaryLive.byTradFiSession['REGULAR'];
    expect(sessRegular).toBeDefined();
    expect(sessRegular.n).toBe(2);
  });

  it('includes DEMO signals only when origin is explicitly set to DEMO or ALL', () => {
    const fixtureSignals: ClosedSignalEvidence[] = [
      {
        id: 'sig-live-1',
        symbol: 'BTCUSDT',
        category: 'DAYTRADE',
        direction: 'LONG',
        score: 75,
        scoreTier: '70-79',
        tradfiSession: 'REGULAR',
        origin: 'LIVE',
        netR: 1.0,
        mfeR: 1.5,
        maeR: -0.1,
        isWin: true,
        closedAt: 1700001000000
      },
      {
        id: 'sig-demo-1',
        symbol: 'ETHUSDT',
        category: 'DAYTRADE',
        direction: 'SHORT',
        score: 78,
        scoreTier: '70-79',
        tradfiSession: 'REGULAR',
        origin: 'DEMO',
        netR: -1.0,
        mfeR: 0.1,
        maeR: -1.0,
        isWin: false,
        closedAt: 1700002000000
      }
    ];

    const demoSummary = generateEvidenceSummary(fixtureSignals, { origin: 'DEMO' });
    expect(demoSummary.totalSignals).toBe(1);
    expect(demoSummary.rExpectancy).toBe(-1.0);

    const allSummary = generateEvidenceSummary(fixtureSignals, { origin: 'ALL' });
    expect(allSummary.totalSignals).toBe(2);
    expect(allSummary.rExpectancy).toBe(0.0);
  });
});
