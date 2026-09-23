/**
 * Utility helper para formatação inteligente de preços, percentuais e valores numéricos no SuperBot AI.
 * Suporta ativos de valor ultrabaixo (ex: PEPE, SHIB, BONK) com até 12 casas decimais dinâmicas,
 * evitando exibições truncadas como "$0.00" ou perdas de precisão em cálculos.
 */

/**
 * Normaliza e preserva a precisão de preços de ativos sem truncar prematuramente,
 * garantindo que moedas com valores diminutos (ex: PEPE = 0.00001234) mantenham seus dígitos
 * significativos em vez de serem arredondadas para 0.
 */
export function normalizePricePrecision(value: number | null | undefined): number {
  if (value === null || value === undefined || isNaN(value)) return 0;
  const abs = Math.abs(value);
  if (abs === 0) return 0;
  if (abs >= 1000) return parseFloat(value.toFixed(2));
  if (abs >= 50) return parseFloat(value.toFixed(3));
  if (abs >= 1) return parseFloat(value.toFixed(4));
  const leadingZeros = Math.floor(-Math.log10(abs));
  const decimals = Math.min(12, Math.max(5, leadingZeros + 4));
  return parseFloat(value.toFixed(decimals));
}

export function formatPrice(
  value: number | null | undefined, 
  options?: {
    currency?: boolean;
    minDecimals?: number;
    maxDecimals?: number;
  }
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return options?.currency ? '$0.00' : '0.00';
  }

  const absValue = Math.abs(value);
  const prefix = options?.currency ? '$' : '';

  if (absValue === 0) {
    return `${prefix}0.00`;
  }

  let decimals = 2;

  if (absValue >= 1000) {
    decimals = 2;
    return `${prefix}${value.toLocaleString('en-US', {
      minimumFractionDigits: options?.minDecimals ?? 2,
      maximumFractionDigits: options?.maxDecimals ?? 2
    })}`;
  } else if (absValue >= 50) {
    decimals = 2;
  } else if (absValue >= 1) {
    decimals = 3;
  } else {
    // Para ativos com valor < 1 (ex: PEPEUSDT = 0.00001234, SHIB = 0.00000854, BONK)
    // Calcula zeros à esquerda após o ponto decimal
    const leadingZeros = Math.floor(-Math.log10(absValue));
    // Garante 4 a 5 dígitos significativos visíveis após os zeros iniciais, com teto de até 12 casas decimais
    decimals = Math.min(12, Math.max(4, leadingZeros + 4));
  }

  if (options?.minDecimals !== undefined) {
    decimals = Math.max(decimals, options.minDecimals);
  }
  if (options?.maxDecimals !== undefined) {
    if (absValue >= 1) {
      decimals = Math.min(decimals, options.maxDecimals);
    } else {
      // Para moedas < 1, respeita maxDecimals apenas se ele for maior que os zeros iniciais
      const leadingZeros = Math.floor(-Math.log10(absValue));
      if (options.maxDecimals > leadingZeros) {
        decimals = Math.min(decimals, options.maxDecimals);
      }
    }
  }

  return `${prefix}${value.toFixed(decimals)}`;
}

/**
 * Formata faixa de preços (ex: Entry Zone $0.00001234 - $0.00001250)
 */
export function formatPriceRange(
  min: number | null | undefined, 
  max: number | null | undefined, 
  currency = true
): string {
  const validMin = min !== null && min !== undefined && !isNaN(min) && min > 0;
  const validMax = max !== null && max !== undefined && !isNaN(max) && max > 0;

  if (!validMin && !validMax) {
    return '--';
  }
  if (validMin && !validMax) {
    return formatPrice(min, { currency });
  }
  if (!validMin && validMax) {
    return formatPrice(max, { currency });
  }
  return `${formatPrice(min, { currency })} - ${formatPrice(max, { currency })}`;
}

/**
 * Formata porcentagens com sinal (ex: +2.45% ou -1.20%)
 */
export function formatPercent(value: number | null | undefined, includeSign = true): string {
  if (value === null || value === undefined || isNaN(value)) return '0.00%';
  const sign = includeSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Formata timestamps numéricos ou strings de datas para formato legível de hora/data (HH:mm ou dd/MM HH:mm)
 */
export function formatTimestamp(
  timestamp: number | string | Date | null | undefined,
  includeDate = false
): string {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '--:--';

  if (includeDate) {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Formata data e hora completas no padrão brasileiro (DD/MM/AAAA HH:mm:ss)
 */
export function formatDateTime(
  timestamp: number | string | Date | null | undefined,
  includeSeconds = true
): string {
  if (!timestamp) return '--/--/---- --:--';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '--/--/---- --:--';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  if (includeSeconds) {
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Retorna tempo relativo amigável (ex: "há 10s", "há 2 min", "há 1h")
 */
export function formatTimeAgo(
  timestamp: number | string | Date | null | undefined
): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const time = date.getTime();
  if (isNaN(time)) return '';

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - time) / 1000));

  if (diffSec < 5) return 'agora';
  if (diffSec < 60) return `há ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays}d`;
}

/**
 * Formata valores em dólares com suporte dinâmico a micro-ativos (ex: PEPE = $0.00001234)
 */
export function formatUsd(value: number | null | undefined, minDecimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '$0.00';
  return formatPrice(value, { currency: true, minDecimals });
}

/**
 * Formata grandes volumes e CVD em K, M, B (ex: $12.5M, -450K)
 */
export function formatCompactNumber(value: number | null | undefined, currency = false): string {
  if (value === null || value === undefined || isNaN(value)) return currency ? '$0' : '0';
  const prefix = currency ? '$' : '';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${prefix}${(abs / 1_000).toFixed(1)}K`;
  }
  return `${sign}${prefix}${abs.toFixed(2)}`;
}

/**
 * Formata volumes em notação monetária compacta (ex: $4.20B, $85.4M)
 */
export function formatVolume(value: number | null | undefined): string {
  return formatCompactNumber(value, true);
}

export interface TradeMetrics {
  entryPrice: number;
  riskPct: number;
  target1GainPct: number;
  target2GainPct: number;
  rrRatio1: number;
  rrRatio2: number;
}

/**
 * Calcula métricas detalhadas de Risco/Retorno e Porcentagens de Lucro e Stop
 */
export function calculateTradeMetrics(params: {
  entry: number | [number, number] | undefined;
  stopLoss: number | undefined;
  target1: number | undefined;
  target2?: number | undefined;
  direction?: 'LONG' | 'SHORT' | string;
  currentPrice?: number;
}): TradeMetrics {
  const { entry, stopLoss, target1, target2, direction = 'LONG', currentPrice = 0 } = params;

  let entryPrice = currentPrice;
  if (Array.isArray(entry) && entry.length === 2 && entry[0] > 0 && entry[1] > 0) {
    entryPrice = (entry[0] + entry[1]) / 2;
  } else if (typeof entry === 'number' && entry > 0) {
    entryPrice = entry;
  }

  // Fallback se entry for 0 ou inválido
  if (!entryPrice || entryPrice <= 0) {
    if (currentPrice > 0) {
      entryPrice = currentPrice;
    } else if (Array.isArray(entry) && (entry[0] > 0 || entry[1] > 0)) {
      entryPrice = Math.max(entry[0] || 0, entry[1] || 0);
    }
  }

  if (!entryPrice || entryPrice <= 0 || !stopLoss || stopLoss <= 0 || !target1 || target1 <= 0) {
    return {
      entryPrice: entryPrice || 0,
      riskPct: 0,
      target1GainPct: 0,
      target2GainPct: 0,
      rrRatio1: 0,
      rrRatio2: 0,
    };
  }

  const isLong = direction.toUpperCase() === 'LONG';

  const riskPct = isLong
    ? ((entryPrice - stopLoss) / entryPrice) * 100
    : ((stopLoss - entryPrice) / entryPrice) * 100;

  const target1GainPct = isLong
    ? ((target1 - entryPrice) / entryPrice) * 100
    : ((entryPrice - target1) / entryPrice) * 100;

  const target2GainPct = target2 && target2 > 0
    ? (isLong ? ((target2 - entryPrice) / entryPrice) * 100 : ((entryPrice - target2) / entryPrice) * 100)
    : 0;

  const validRiskPct = Math.max(0.000001, Math.abs(riskPct));
  const rrRatio1 = Math.max(0, Math.abs(target1GainPct) / validRiskPct);
  const rrRatio2 = target2GainPct !== 0 ? Math.max(0, Math.abs(target2GainPct) / validRiskPct) : 0;

  return {
    entryPrice,
    riskPct: Math.abs(riskPct),
    target1GainPct: Math.abs(target1GainPct),
    target2GainPct: Math.abs(target2GainPct),
    rrRatio1,
    rrRatio2,
  };
}

