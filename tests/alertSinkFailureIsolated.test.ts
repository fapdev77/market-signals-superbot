import { describe, it, expect, beforeEach } from 'vitest';
import { emitOperationalAlert, resetOperationalAlertsForTests, setSinksForTests } from '../server/services/operationalAlerts.js';
import type { AlertSink, AlertPayload } from '../server/services/AlertService.js';

/**
 * 6.6.2 / CA-6.2 — falha no envio de alertas NUNCA lança exceção para o loop de trading.
 * Sink que lança, rejeita ou devolve false é isolado; a emissão segue para os outros sinks.
 */
function throwingSink(name: string, mode: 'throw' | 'reject' | 'false'): AlertSink {
  return {
    name,
    send: async (payload: AlertPayload) => {
      if (mode === 'throw') throw new Error(`sink ${name} explodiu`);
      if (mode === 'reject') return Promise.reject(new Error(`sink ${name} rejeitou`));
      return false;
    }
  };
}

describe('6.6.2 — isolamento de falha de sink (CA-6.2)', () => {
  beforeEach(() => {
    resetOperationalAlertsForTests();
  });

  it('sink que lança não interrompe a emissão nem os demais sinks', async () => {
    const sent: AlertPayload[] = [];
    setSinksForTests([
      throwingSink('bad-throw', 'throw'),
      { name: 'good', send: async p => { sent.push(p); return true; } },
      throwingSink('bad-reject', 'reject'),
      throwingSink('bad-false', 'false')
    ]);

    await expect(emitOperationalAlert('BACKUP_FAILED', 'CRITICAL', 'teste de isolamento')).resolves.toBe(true);
    expect(sent.length).toBe(1); // o sink bom recebeu apesar dos dois vizinhos falharem
  });

  it('todos os sinks falhando ainda resolve sem lançar (e marca não-entregue)', async () => {
    setSinksForTests([throwingSink('a', 'throw'), throwingSink('b', 'reject')]);
    await expect(emitOperationalAlert('WS_SILENT', 'HIGH', 'todos falham')).resolves.toBe(true);
  });

  it('falha de alerta não propaga erro para o caller do loop', async () => {
    setSinksForTests([throwingSink('x', 'throw')]);
    // Se lançasse, o loop de trading quebraria; aqui apenas não lança.
    await expect(emitOperationalAlert('DB_SAVE_SLOW', 'MEDIUM', 'p95 alto')).resolves.not.toThrow();
    await expect(emitOperationalAlert('DB_SAVE_SLOW', 'MEDIUM', 'p95 alto de novo')).resolves.toBe(false); // dedup
  });
});
