import { TickerData } from '../../src/types.js';

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

  if (ticker.dataQuality?.isDegraded) {
    return {
      allow: false,
      reason: 'Qualidade do feed degradada ou instável.',
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

  const ageMs = now - (ticker.updatedAt || 0);
  if (ageMs > MAX_DATA_AGE_MS * 2) {
    return {
      allow: false,
      reason: `Feed congelado há mais de ${Math.round(ageMs / 1000)}s. Avaliação de stops suspensa para evitar falsas saídas.`,
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
