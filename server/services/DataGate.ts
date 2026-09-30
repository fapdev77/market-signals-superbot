import { TickerData } from '../../src/types.js';
import { isClockDegraded, getClockDriftMs } from './ClockService.js';

export const MAX_DATA_AGE_MS = 60000; // 60 seconds tolerance

export interface DataGateDecision {
  allow: boolean;
  reason?: string;
  isDegraded: boolean;
  ageMs: number;
}

/**
 * Evaluates whether market ticker data is fresh and trustworthy enough to generate new trading signals.
 * Rules (D3):
 * - If data is older than MAX_DATA_AGE_MS (60s) -> BLOCK signal generation.
 * - If price <= 0 or NaN -> BLOCK signal generation.
 * - If data is marked synthetic or degraded -> BLOCK signal generation (unless ALLOW_SYNTHETIC_DATA=true).
 */
export function canGenerateSignals(ticker: TickerData, now: number = Date.now()): DataGateDecision {
  if (!ticker || !ticker.price || isNaN(ticker.price) || ticker.price <= 0) {
    return {
      allow: false,
      reason: 'Preço de mercado inválido ou ausente.',
      isDegraded: true,
      ageMs: Infinity
    };
  }

  const ageMs = now - (ticker.updatedAt || 0);
  if (ageMs > MAX_DATA_AGE_MS) {
    return {
      allow: false,
      reason: `Feed de dados desatualizado (${Math.round(ageMs / 1000)}s > ${MAX_DATA_AGE_MS / 1000}s). Geração de sinais bloqueada por segurança.`,
      isDegraded: true,
      ageMs
    };
  }

  if (ticker.dataQuality?.source === 'SYNTHETIC' && process.env.ALLOW_SYNTHETIC_DATA !== 'true') {
    return {
      allow: false,
      reason: 'Sinais bloqueados para dados sintéticos/simulados (ALLOW_SYNTHETIC_DATA=false).',
      isDegraded: true,
      ageMs
    };
  }

  if (ticker.dataQuality?.isDegraded) {
    return {
      allow: false,
      reason: 'Qualidade do feed degradada ou instável.',
      isDegraded: true,
      ageMs
    };
  }

  if (isClockDegraded()) {
    return {
      allow: false,
      reason: `Relógio do sistema degradado por deriva (${getClockDriftMs()}ms > 2000ms). Sinais bloqueados para prevenir distorções temporais.`,
      isDegraded: true,
      ageMs
    };
  }

  return {
    allow: true,
    isDegraded: false,
    ageMs
  };
}

/**
 * Evaluates whether open signals for this symbol can be safely updated (stops, targets, breakeven).
 * Sinais abertos não devem ser stopados ou finalizados com base em dados corrompidos ou defasados.
 *
 * Phase 2.5.1: this gate now honours `dataQuality.isDegraded` and a STALE source marker. A cached /
 * degraded quote must never be used to close a position, because a stale price can trigger a fake
 * stop-out or a fake target hit.
 */
export function canEvaluateActiveTrades(ticker: TickerData, now: number = Date.now()): DataGateDecision {
  if (!ticker || !ticker.price || isNaN(ticker.price) || ticker.price <= 0) {
    return {
      allow: false,
      reason: 'Preço de mercado ausente; posições mantidas em proteção.',
      isDegraded: true,
      ageMs: Infinity
    };
  }

  if (ticker.dataQuality?.source === 'STALE') {
    return {
      allow: false,
      reason: 'Cotação marcada como STALE; avaliação de stops suspensa para evitar falsas saídas.',
      isDegraded: true,
      ageMs: now - (ticker.updatedAt || 0)
    };
  }

  const ageMs = now - (ticker.updatedAt || 0);
  if (ageMs > MAX_DATA_AGE_MS * 2) {
    return {
      allow: false,
      reason: `Feed congelado há mais de ${Math.round(ageMs / 1000)}s. Avaliação de stops suspensa para evitar falsas saídas.`,
      isDegraded: true,
      ageMs
    };
  }

  // A degraded feed (missing klines, unreachable exchange, stale reconstruction) is not trustworthy
  // enough to resolve a live position. Hold the position until the feed recovers.
  if (ticker.dataQuality?.isDegraded) {
    return {
      allow: false,
      reason: 'Qualidade do feed degradada; posições mantidas em proteção.',
      isDegraded: true,
      ageMs
    };
  }

  return {
    allow: true,
    isDegraded: false,
    ageMs
  };
}

/**
 * True when the quote came from the in-memory reconstruction of a previous tick rather than from a
 * live exchange response (Phase 2.5.1). Such quotes are marked STALE + degraded so the gates reject them.
 */
export function isStaleQuote(ticker: Partial<TickerData> | undefined | null): boolean {
  return ticker?.dataQuality?.source === 'STALE';
}
