import { describe, it, expect, beforeEach } from 'vitest';
import { BinanceRateLimiter } from '../server/utils/binanceRateLimiter.js';
import {
  setSinksForTests,
  resetOperationalAlertsForTests
} from '../server/services/operationalAlerts.js';
import type { AlertSink } from '../server/services/AlertService.js';

/** 8.3.3 / CA-3.4 — peso REST observado e alerta de orçamento (70%). */

function captureSink(): { sink: AlertSink; captured: any[] } {
  const captured: any[] = [];
  const sink: AlertSink = {
    name: 'capture',
    send: async payload => {
      captured.push(payload);
      return true;
    }
  };
  return { sink, captured };
}

describe('8.3.3 / CA-3.4 — métrica de peso REST e alerta de orçamento', () => {
  beforeEach(() => {
    resetOperationalAlertsForTests();
  });

  it('reflete x-mbx-used-weight-1m dos headers simulados', () => {
    BinanceRateLimiter.updateFromHeaders({ 'x-mbx-used-weight-1m': '123' });
    expect(BinanceRateLimiter.getState().usedWeight1m).toBe(123);
  });

  it('dispara RATE_LIMIT_BUDGET a partir de 70% do limite real', async () => {
    const { sink, captured } = captureSink();
    setSinksForTests([sink]);
    BinanceRateLimiter.setRequestWeightLimit(1000);

    BinanceRateLimiter.updateFromHeaders({ 'x-mbx-used-weight-1m': '700' }); // 70%
    await new Promise(r => setTimeout(r, 20));

    expect(
      captured.some(p => p?.metadata?.alertType === 'RATE_LIMIT_BUDGET')
    ).toBe(true);
    expect(BinanceRateLimiter.getState().usedWeight1m).toBe(700);
  });

  it('não alerta abaixo de 70%', async () => {
    const { sink, captured } = captureSink();
    setSinksForTests([sink]);
    BinanceRateLimiter.setRequestWeightLimit(2000);

    BinanceRateLimiter.updateFromHeaders({ 'x-mbx-used-weight-1m': '300' }); // 15%
    await new Promise(r => setTimeout(r, 20));

    expect(captured.some(p => p?.metadata?.alertType === 'RATE_LIMIT_BUDGET')).toBe(false);
  });
});
