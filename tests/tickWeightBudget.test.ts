import { describe, it, expect, beforeEach } from 'vitest';
import { BinanceRateLimiter } from '../server/utils/binanceRateLimiter.js';
import { setSinksForTests, resetOperationalAlertsForTests } from '../server/services/operationalAlerts.js';
import type { AlertSink, AlertPayload } from '../server/services/AlertService.js';

/**
 * 7.1.3 / CA-1.5 — orçamento de peso REST.
 *
 * O limiter registra `x-mbx-used-weight-1m` (exposto por `getState()` e por
 * `/api/system/metrics` → `binanceUsedWeight1m`) e alerta `RATE_LIMIT_BUDGET`
 * ao passar de 70% do limite real do exchangeInfo.
 */

function makeSink() {
  const sent: AlertPayload[] = [];
  const sink: AlertSink = {
    name: 'fake',
    send: async (payload: AlertPayload) => {
      sent.push(payload);
      return true;
    }
  };
  return { sink, sent };
}

async function waitFor(predicate: () => boolean, timeoutMs = 500): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise(r => setTimeout(r, 10));
  }
  return predicate();
}

const budgetAlerts = (sent: AlertPayload[]) => sent.filter(a => a.key.includes('rate_limit_budget'));

describe('7.1.3 / CA-1.5 — orçamento de peso REST', () => {
  beforeEach(() => {
    resetOperationalAlertsForTests();
  });

  it('registra e expõe o usedWeight1m observado', () => {
    BinanceRateLimiter.setRequestWeightLimit(2400);
    BinanceRateLimiter.updateFromHeaders({ 'x-mbx-used-weight-1m': '500' });
    expect(BinanceRateLimiter.getState().usedWeight1m).toBe(500);
    expect(BinanceRateLimiter.getState().maxWeight1m).toBe(2400);
  });

  it('abaixo de 70% do orçamento não alerta', async () => {
    const { sink, sent } = makeSink();
    setSinksForTests([sink]);
    BinanceRateLimiter.setRequestWeightLimit(2400);
    BinanceRateLimiter.updateFromHeaders({ 'x-mbx-used-weight-1m': '1000' }); // ~42%
    await new Promise(r => setTimeout(r, 30));
    expect(budgetAlerts(sent)).toHaveLength(0);
  });

  it('acima de 70% emite RATE_LIMIT_BUDGET uma única vez por janela de dedup', async () => {
    const { sink, sent } = makeSink();
    setSinksForTests([sink]);
    BinanceRateLimiter.setRequestWeightLimit(2400);
    BinanceRateLimiter.updateFromHeaders({ 'x-mbx-used-weight-1m': '1700' }); // ~71%
    BinanceRateLimiter.updateFromHeaders({ 'x-mbx-used-weight-1m': '1800' }); // ~75%
    await waitFor(() => budgetAlerts(sent).length > 0);
    expect(budgetAlerts(sent)).toHaveLength(1);
  });
});
