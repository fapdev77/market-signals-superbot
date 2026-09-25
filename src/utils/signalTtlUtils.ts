import { SignalTtlSettings, MarketRegimeType, StrategyCategory, TradeSignal } from '../types.js';

export const DEFAULT_SIGNAL_TTL_SETTINGS: SignalTtlSettings = {
  scalpTtlMinutes: 25,         // Scalp 5m
  dayTradeTtlMinutes: 90,      // Day Trade 15m (1h30)
  intradayTtlMinutes: 240,     // Intraday 30m (4h)
  swingTtlMinutes: 1440,       // Swing 1h/4h (24h)
  positionTtlMinutes: 4320,    // Position 4h/1d (72h / 3 dias)
  counterTradeTtlMinutes: 60,  // Contra-Trade TTI (1h)
  customTtlMinutes: 120,       // Custom (2h)
  marketRegime: 'NORMAL',
  regimeMultiplier: 1.0,
  autoExpireEnabled: true,
  adverseMoveInvalidationPct: 1.2,
  breakevenOnTarget1: true
};

export interface RegimePresetInfo {
  key: MarketRegimeType;
  label: string;
  shortLabel: string;
  multiplier: number;
  badgeColor: string;
  textColor: string;
  borderColor: string;
  description: string;
  icon: string;
}

export const REGIME_PRESETS: Record<MarketRegimeType, RegimePresetInfo> = {
  CALM: {
    key: 'CALM',
    label: 'Mercado Calmo (Baixa Volatilidade)',
    shortLabel: 'Calmo',
    multiplier: 1.5,
    badgeColor: 'bg-emerald-500/15',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    description: 'Fluxo ordenado e baixa dispersão. Sinais recebem 50% a mais de tempo (1.5x) para testar POIs e POCs sem expirar prematuramente.',
    icon: '🟢'
  },
  NORMAL: {
    key: 'NORMAL',
    label: 'Mercado Padrão (Volatilidade Neutra)',
    shortLabel: 'Padrão',
    multiplier: 1.0,
    badgeColor: 'bg-blue-500/15',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    description: 'Condições típicas de liquidez dos derivativos e spread regular. TTL base ideal (1.0x).',
    icon: '🔵'
  },
  VOLATILE: {
    key: 'VOLATILE',
    label: 'Mercado Agitado (Alta Volatilidade)',
    shortLabel: 'Agitado',
    multiplier: 0.6,
    badgeColor: 'bg-amber-500/15',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    description: 'Dias de notícias, earnings ou rallies agressivos. Sinais expiram 40% mais rápido (0.6x) para evitar armadilhas de reversão rápida.',
    icon: '🟠'
  },
  EXTREME: {
    key: 'EXTREME',
    label: 'Volatilidade Extrema (Eventos Macro / CPI)',
    shortLabel: 'Extrema',
    multiplier: 0.4,
    badgeColor: 'bg-rose-500/15',
    textColor: 'text-rose-400',
    borderColor: 'border-rose-500/30',
    description: 'FOMC, CPI, deslistagens ou cascatas de liquidação. Janela ultra-curta (0.4x) de sobrevivência de setup para máxima conservação de capital.',
    icon: '🔴'
  }
};

/**
 * Retorna o TTL efetivo em minutos para uma dada categoria de estratégia,
 * aplicando o multiplicador de regime de mercado e garantindo limites mínimos seguros.
 */
export function calculateEffectiveTtlMinutes(
  category: StrategyCategory | string | undefined,
  settings: SignalTtlSettings = DEFAULT_SIGNAL_TTL_SETTINGS
): number {
  const multiplier = Math.max(0.2, Math.min(3.0, settings.regimeMultiplier || 1.0));
  let baseMinutes = 240;

  switch (category) {
    case 'SCALP':
      baseMinutes = settings.scalpTtlMinutes || 25;
      break;
    case 'DAY_TRADE':
      baseMinutes = settings.dayTradeTtlMinutes || 90;
      break;
    case 'INTRADAY':
      baseMinutes = settings.intradayTtlMinutes || 240;
      break;
    case 'SWING':
      baseMinutes = settings.swingTtlMinutes || 1440;
      break;
    case 'POSITION':
      baseMinutes = settings.positionTtlMinutes || 4320;
      break;
    case 'COUNTER_TRADE':
      baseMinutes = settings.counterTradeTtlMinutes || 60;
      break;
    case 'CUSTOM':
      baseMinutes = settings.customTtlMinutes || 120;
      break;
    default:
      baseMinutes = settings.intradayTtlMinutes || 240;
      break;
  }

  const effective = Math.round(baseMinutes * multiplier);
  // Garante pelo menos 5 minutos para scalps e máximo razoável de 10 dias
  return Math.max(5, Math.min(14400, effective));
}

/**
 * Formata minutos em string legível de duração (ex: 25 min, 1h 30m, 24h, 72h)
 */
export function formatTtlDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = (hours / 24).toFixed(1).replace('.0', '');
  return `${days}d (${hours}h)`;
}

export interface TtlProgressResult {
  remainingMs: number;
  totalMs: number;
  percentRemaining: number;
  isExpired: boolean;
  isNearExpiry: boolean; // Menos de 20% do tempo restante
  formattedRemaining: string;
  effectiveTtlMinutes: number;
}

/**
 * Calcula o progresso e tempo restante de um sinal de trade.
 */
export function calculateTtlProgress(
  signal: TradeSignal,
  fallbackSettings: SignalTtlSettings = DEFAULT_SIGNAL_TTL_SETTINGS,
  now: number = Date.now()
): TtlProgressResult {
  const effectiveMinutes = signal.ttlMinutes || calculateEffectiveTtlMinutes(signal.strategyCategory, fallbackSettings);
  const totalMs = effectiveMinutes * 60 * 1000;
  const expiresAt = signal.expiresAt || (signal.createdAt + totalMs);

  const remainingMs = Math.max(0, expiresAt - now);
  const percentRemaining = Math.max(0, Math.min(100, Math.round((remainingMs / totalMs) * 100)));
  const isExpired = signal.status === 'EXPIRED' || remainingMs <= 0;
  const isNearExpiry = !isExpired && percentRemaining <= 20;

  let formattedRemaining = 'EXPIRADO';
  if (!isExpired) {
    const totalSec = Math.floor(remainingMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const hours = Math.floor(min / 60);

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      formattedRemaining = `${days}d ${remHours}h`;
    } else if (hours >= 1) {
      const remMin = min % 60;
      formattedRemaining = `${hours}h ${remMin}m`;
    } else if (min >= 1) {
      formattedRemaining = `${min}m ${sec}s`;
    } else {
      formattedRemaining = `${sec}s`;
    }
  }

  return {
    remainingMs,
    totalMs,
    percentRemaining,
    isExpired,
    isNearExpiry,
    formattedRemaining,
    effectiveTtlMinutes: effectiveMinutes
  };
}
