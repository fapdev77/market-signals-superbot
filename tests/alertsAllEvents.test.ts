import { describe, it, expect, beforeEach } from 'vitest';
import {
  OPERATIONAL_ALERT_TYPES,
  emitOperationalAlert,
  resetOperationalAlertsForTests,
  setSinksForTests
} from '../server/services/operationalAlerts.js';
import type { AlertSink, AlertPayload } from '../server/services/AlertService.js';

/**
 * 6.6.1 / CA-6.1 — cada evento obrigatório produz EXATAMENTE 1 alerta dentro da
 * janela de dedup, com sink falso.
 *
 * Catálogo obrigatório do spec 6.6.1: FEED_DEGRADED (REST degradado >60 s), WS_SILENT
 * (watchdog), RATE_LIMIT_COOLDOWN (backoff 429/418), KILL_SWITCH_CHANGED, BACKUP_FAILED,
 * LEDGER_WRITE_FAILED, DB_SIZE_THRESHOLD, DB_SAVE_SLOW (p95 > 500 ms) — além de
 * CLOCK_DRIFT e falhas de integridade, que já existem.
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

describe('6.6.1 — catálogo e emissão única por evento (CA-6.1)', () => {
  beforeEach(() => {
    resetOperationalAlertsForTests();
  });

  it('o catálogo contém todos os eventos obrigatórios do spec', () => {
    for (const t of [
      'FEED_DEGRADED',
      'WS_SILENT',
      'RATE_LIMIT_COOLDOWN',
      'KILL_SWITCH_CHANGED',
      'BACKUP_FAILED',
      'LEDGER_WRITE_FAILED',
      'DB_SIZE_THRESHOLD',
      'DB_SAVE_SLOW',
      'CLOCK_DRIFT',
      'INTEGRITY_FAILURE'
    ]) {
      expect(OPERATIONAL_ALERT_TYPES, `evento faltando: ${t}`).toContain(t);
    }
  });

  it('cada evento emite exatamente 1 alerta no sink falso', async () => {
    const { sink, sent } = makeSink();
    setSinksForTests([sink]);

    for (const type of OPERATIONAL_ALERT_TYPES) {
      const emitted = await emitOperationalAlert(type, 'HIGH', `disparo de teste de ${type}`, { symbol: 'X' });
      expect(emitted, `${type} deveria ter sido emitido`).toBe(true);
    }
    expect(sent.length).toBe(OPERATIONAL_ALERT_TYPES.length);

    const keys = new Set(sent.map(a => a.key));
    expect(keys.size).toBe(OPERATIONAL_ALERT_TYPES.length);
  });

  it('reemissão do mesmo evento dentro da janela de dedup é suprimida (exatamente 1)', async () => {
    const { sink, sent } = makeSink();
    setSinksForTests([sink]);

    const now = Date.now();
    await emitOperationalAlert('FEED_DEGRADED', 'HIGH', 'primeiro', undefined, now);
    const suppressed = await emitOperationalAlert('FEED_DEGRADED', 'HIGH', 'segundo', undefined, now + 1000);
    expect(suppressed).toBe(false);
    expect(sent.length).toBe(1);
  });

  it('evento desconhecido é rejeitado (catálogo fechado)', async () => {
    await expect(emitOperationalAlert('EVENTO_INVENTADO' as any, 'LOW', 'x')).rejects.toThrow();
  });

  it('payload carrega tipo, severidade, mensagem e metadados', async () => {
    const { sink, sent } = makeSink();
    setSinksForTests([sink]);

    await emitOperationalAlert('LEDGER_WRITE_FAILED', 'CRITICAL', 'falha ao gravar ledger', { signalId: 's1' });
    const alert = sent[0];
    expect(alert.key).toContain('ledger_write_failed');
    expect(alert.severity).toBe('CRITICAL');
    expect(alert.message).toContain('falha ao gravar ledger');
    expect(alert.metadata).toMatchObject({ signalId: 's1' });
  });
});
