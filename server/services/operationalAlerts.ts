/**
 * 6.6 — Alertas completos (G-13) — fachada central de alertas operacionais.
 *
 * `emitOperationalAlert(type, severity, message, metadata, now)` é a única porta de
 * entrada dos eventos operacionais, sobre o `AlertService` (M4.7) e a deduplicação
 * por chave já existente (garante o "exatamente 1 alerta na janela" do CA-6.1).
 *
 * Catálogo FECHADO (6.6.1): FEED_DEGRADED, WS_SILENT, RATE_LIMIT_COOLDOWN,
 * RATE_LIMIT_BUDGET (7.1.3), KILL_SWITCH_CHANGED, BACKUP_FAILED, LEDGER_WRITE_FAILED,
 * LEDGER_RECONCILED (7.3.2), TRADFI_REGISTRY_UNAVAILABLE (7.1.1), DB_SIZE_THRESHOLD,
 * DB_SAVE_SLOW, CLOCK_DRIFT, INTEGRITY_FAILURE (+ OPERATIONAL_TEST para o endpoint
 * de teste). Tipo fora do catálogo lança — alerta inventado não passa.
 *
 * 6.6.2/CA-6.2: falha de sink (throw/reject/false) nunca propaga para o loop de
 * trading — Promise.allSettled no serviço base + captura local aqui.
 */

import { AlertService, defaultAlertService, type AlertSink } from './AlertService.js';
import { getErrorMessage } from '../utils/errors.js';

export type OperationalAlertType =
  | 'FEED_DEGRADED'
  | 'WS_SILENT'
  | 'RATE_LIMIT_COOLDOWN'
  | 'RATE_LIMIT_BUDGET'
  | 'KILL_SWITCH_CHANGED'
  | 'BACKUP_FAILED'
  | 'LEDGER_WRITE_FAILED'
  | 'LEDGER_RECONCILED'
  | 'TRADFI_REGISTRY_UNAVAILABLE'
  | 'DB_SIZE_THRESHOLD'
  | 'DB_SAVE_SLOW'
  | 'CLOCK_DRIFT'
  | 'INTEGRITY_FAILURE'
  // 8.3.1 — falha de execução do backtest agendado (guardas do BacktestScheduler).
  | 'BACKTEST_SCHEDULE_FAILED'
  | 'OPERATIONAL_TEST';

export const OPERATIONAL_ALERT_TYPES: readonly OperationalAlertType[] = [
  'FEED_DEGRADED',
  'WS_SILENT',
  'RATE_LIMIT_COOLDOWN',
  'RATE_LIMIT_BUDGET',
  'KILL_SWITCH_CHANGED',
  'BACKUP_FAILED',
  'LEDGER_WRITE_FAILED',
  'LEDGER_RECONCILED',
  'TRADFI_REGISTRY_UNAVAILABLE',
  'DB_SIZE_THRESHOLD',
  'DB_SAVE_SLOW',
  'CLOCK_DRIFT',
  'INTEGRITY_FAILURE',
  'BACKTEST_SCHEDULE_FAILED',
  'OPERATIONAL_TEST'
];

/** Severidade default por tipo (o caller pode elevar, nunca rebaixar silenciosamente). */
const DEFAULT_SEVERITY: Record<OperationalAlertType, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
  FEED_DEGRADED: 'HIGH',
  WS_SILENT: 'HIGH',
  RATE_LIMIT_COOLDOWN: 'MEDIUM',
  RATE_LIMIT_BUDGET: 'MEDIUM',
  KILL_SWITCH_CHANGED: 'CRITICAL',
  BACKUP_FAILED: 'CRITICAL',
  LEDGER_WRITE_FAILED: 'CRITICAL',
  LEDGER_RECONCILED: 'MEDIUM',
  TRADFI_REGISTRY_UNAVAILABLE: 'HIGH',
  DB_SIZE_THRESHOLD: 'CRITICAL',
  DB_SAVE_SLOW: 'MEDIUM',
  CLOCK_DRIFT: 'MEDIUM',
  INTEGRITY_FAILURE: 'CRITICAL',
  BACKTEST_SCHEDULE_FAILED: 'HIGH',
  OPERATIONAL_TEST: 'LOW'
};

/**
 * Serviço subjacente. Por default o singleton global (mesmos sinks do ambiente);
 * os emissores do app NUNCA trocam isso em produção — só testes.
 */
let service: AlertService = defaultAlertService;

export function setOperationalAlertServiceForTests(svc: AlertService | null): void {
  service = svc ?? defaultAlertService;
}

/** 6.6.3: injeção de sinks de teste para o endpoint e para as suítes (limpa dedup junto). */
export function setSinksForTests(sinks: AlertSink[]): void {
  const svc = new AlertService({ sinks });
  service = svc;
}

export function resetOperationalAlertsForTests(): void {
  service = defaultAlertService;
  service.resetForTests();
}

export interface OperationalDispatchResult {
  sink: string;
  delivered: boolean;
  error?: string;
}

/**
 * Emite um alerta operacional do catálogo. Nunca lança para o caller (6.6.2) —
 * exceto por tipo fora do catálogo, que é bug de código e deve falhar alto.
 */
export async function emitOperationalAlert(
  type: OperationalAlertType,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  message: string,
  metadata?: Record<string, any>,
  now: number = Date.now()
): Promise<boolean> {
  if (!OPERATIONAL_ALERT_TYPES.includes(type)) {
    throw new Error(`Tipo de alerta operacional desconhecido: ${String(type)}`);
  }

  const payload = {
    key: `operational.${type.toLowerCase()}`,
    severity,
    message,
    metadata: { ...metadata, alertType: type },
    timestamp: now
  };

  try {
    return await service.emitAlert(payload.key, payload.severity, payload.message, payload.metadata, now);
  } catch (err) {
    // Última linha de defesa (CA-6.2): o serviço base já isola sinks, mas uma falha
    // inesperada aqui jamais derruba o loop de trading.
    console.error(`[OperationalAlerts] falha inesperada ao emitir ${type}:`, getErrorMessage(err));
    return false;
  }
}

/** 6.6.3 — disparo de teste que retorna o resultado POR SINK (entregue ou não). */
export async function dispatchTestAlert(
  message: string = 'Alerta de teste disparado pelo operador'
): Promise<OperationalDispatchResult[]> {
  const key = 'operational.operational_test';
  const sinks = service.listSinks();

  if (sinks.length === 0) {
    // Sem sinks configurados: registra só no console e devolve lista vazia.
    console.warn(`🔔 [ALERT LOW] [${key}] ${message}`);
    return [];
  }

  const payload = {
    key,
    severity: 'LOW' as const,
    message,
    metadata: { alertType: 'OPERATIONAL_TEST' as const },
    timestamp: Date.now()
  };

  // Bypass da dedup por design: o operador pediu um teste explícito agora.
  const results = await Promise.all(
    sinks.map(async (sink): Promise<OperationalDispatchResult> => {
      try {
        const delivered = await sink.send(payload);
        return { sink: sink.name, delivered: delivered === true };
      } catch (err) {
        return { sink: sink.name, delivered: false, error: String(getErrorMessage(err)) };
      }
    })
  );

  // Nota: este disparo NÃO registra a chave na dedup (bypass deliberado — o operador
  // pediu um teste explícito e quer ver a entrega real em cada sink agora).
  return results;
}

/** Severidade sugerida do catálogo (documentação executável). */
export function defaultSeverityFor(type: OperationalAlertType): string {
  return DEFAULT_SEVERITY[type];
}
