import type { OriginFilter } from '../../src/types.js';

/**
 * R-2 — normaliza o filtro de proveniência vindo de uma query string.
 *
 * O default é `LIVE`: as leituras de operador (lista de sinais, histórico, hit-rate) não
 * mostram dado demo a menos que o cliente peça explicitamente `?origin=DEMO|ALL`.
 */
export function parseOriginFilter(value: unknown, fallback: OriginFilter = 'LIVE'): OriginFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return fallback;
  const normalized = raw.trim().toUpperCase();
  return normalized === 'LIVE' || normalized === 'DEMO' || normalized === 'ALL' ? normalized : fallback;
}
