/**
 * 6.6.4 — Heartbeat externo opcional (CA-6.4).
 *
 * Com HEARTBEAT_URL configurada, faz ping a cada 5 min para que um serviço
 * externo perceba a AUSÊNCIA do sinal caso o processo inteiro morra (nenhum
 * alerta interno consegue avisar isso). Sem a variável, nada é enviado.
 *
 * Falha de rede no ping nunca derruba o processo — tenta de novo no próximo
 * intervalo (o objetivo é justamente detectar morte do processo; falhas
 * pontuais de rede são toleráveis).
 */

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export const HEARTBEAT_INTERVAL_MS = DEFAULT_INTERVAL_MS;

let timer: ReturnType<typeof setInterval> | null = null;

export function isHeartbeatEnabled(): boolean {
  return Boolean(process.env.HEARTBEAT_URL?.trim());
}

async function ping(url: string): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ts: Date.now(), pid: process.pid }),
      signal: AbortSignal.timeout(5000)
    });
  } catch (err) {
    console.warn('[Heartbeat] ping falhou (tentará novamente no próximo intervalo):', err?.message || err);
  }
}

export function startHeartbeat(): void {
  if (timer) return; // idempotente
  const url = process.env.HEARTBEAT_URL?.trim();
  if (!url) return; // CA-6.4: sem a variável, nada é enviado

  // Ping imediato no start + intervalo fixo.
  void ping(url);
  timer = setInterval(() => void ping(url), HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeat(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
