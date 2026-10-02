import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AlertSink, AlertPayload } from '../server/services/AlertService.js';

/**
 * 7.1.1/D1 / CA-1.1, CA-1.2 — registro TradFi sem fixture de contingência.
 *
 * `requestJson` é mockado para falhar (sem rede no teste), de modo que
 * `refreshTradfiRegistry` exercita exatamente o caminho de falha:
 *  - sem resultado bom: registro esvazia e um alerta TRADFI_REGISTRY_UNAVAILABLE sai;
 *  - com resultado bom recente: o registro é mantido por até 24 h;
 *  - com resultado bom antigo (>24 h): esvazia.
 *
 * Nenhum arquivo de fixtures é lido (também coberto pelo teste estático
 * `noFixturesInProduction`).
 */

vi.mock('../server/utils/httpClient.js', () => ({
  requestJson: vi.fn(async () => {
    throw new Error('sem rede (teste)');
  }),
  requestJsonLimited: vi.fn(async () => {
    throw new Error('sem rede (teste)');
  })
}));

import {
  refreshTradfiRegistry,
  TRADFI_ASSETS,
  getTradfiRegistryAsOf,
  __resetTradfiRegistryForTests,
  __seedTradfiRegistryForTests,
  type TradfiAsset
} from '../server/binanceService.js';
import { setSinksForTests, resetOperationalAlertsForTests } from '../server/services/operationalAlerts.js';

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

function asset(symbol: string): TradfiAsset {
  return {
    symbol,
    name: symbol,
    baseAsset: symbol.replace('USDT', ''),
    quoteAsset: 'USDT',
    tradfiCategory: 'EQUITY',
    contractType: 'TRADIFI_PERPETUAL'
  };
}

describe('7.1.1 / CA-1.1, CA-1.2 — registro TradFi sem fixture', () => {
  beforeEach(() => {
    resetOperationalAlertsForTests();
    __resetTradfiRegistryForTests();
  });

  it('CA-1.1: sem resultado bom ⇒ registro vazio e nenhum sinal TradFi', async () => {
    await refreshTradfiRegistry();
    expect(TRADFI_ASSETS).toEqual([]);
    expect(getTradfiRegistryAsOf()).toBe(0);
  });

  it('CA-1.1: emite exatamente 1 alerta TRADFI_REGISTRY_UNAVAILABLE na janela de dedup', async () => {
    const { sink, sent } = makeSink();
    setSinksForTests([sink]);

    await refreshTradfiRegistry();
    await refreshTradfiRegistry(); // segunda tentativa na mesma janela

    await waitFor(() => sent.some(a => a.key.includes('tradfi_registry_unavailable')));
    const alerts = sent.filter(a => a.key.includes('tradfi_registry_unavailable'));
    expect(alerts.length).toBe(1);
  });

  it('CA-1.2: mantém o último registro bom dentro de 24 h', async () => {
    __seedTradfiRegistryForTests([asset('AAPLUSDT'), asset('NVDAUSDT')], Date.now() - 60_000);
    await refreshTradfiRegistry();
    expect(TRADFI_ASSETS.map(a => a.symbol)).toEqual(['AAPLUSDT', 'NVDAUSDT']);
  });

  it('CA-1.2: esvazia o registro quando o último resultado bom passou de 24 h', async () => {
    __seedTradfiRegistryForTests([asset('AAPLUSDT')], Date.now() - 25 * 60 * 60 * 1000);
    await refreshTradfiRegistry();
    expect(TRADFI_ASSETS).toEqual([]);
    expect(getTradfiRegistryAsOf()).toBe(0);
  });
});
