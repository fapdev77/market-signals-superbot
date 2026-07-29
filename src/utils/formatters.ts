/**
 * Utility helper para formatação inteligente de preços, percentuais e valores numéricos no SuperBot AI.
 * Suporta ativos de valor ultrabaixo (ex: PEPE, SHIB, BONK) com até 10 casas decimais dinâmicas,
 * evitando exibições truncadas como "$0.0000".
 */

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
  } else if (absValue >= 10) {
    decimals = 2;
  } else if (absValue >= 1) {
    decimals = 3;
  } else {
    // Para ativos com valor < 1 (ex: PEPEUSDT = 0.00001234, SHIB = 0.00000854)
    // Calcula zeros à esquerda após o ponto decimal
    const leadingZeros = Math.floor(-Math.log10(absValue));
    // Garante pelo menos 3 a 4 dígitos significativos visíveis após os zeros iniciais
    decimals = Math.min(10, Math.max(4, leadingZeros + 3));
  }

  if (options?.minDecimals !== undefined) {
    decimals = Math.max(decimals, options.minDecimals);
  }
  if (options?.maxDecimals !== undefined) {
    decimals = Math.min(decimals, options.maxDecimals);
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

  if (!entryPrice || entryPrice <= 0 || !stopLoss || !target1) {
    return {
      entryPrice,
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

  const validRiskPct = Math.max(0.0001, Math.abs(riskPct));
  const rrRatio1 = Math.max(0, target1GainPct / validRiskPct);
  const rrRatio2 = target2GainPct > 0 ? Math.max(0, target2GainPct / validRiskPct) : 0;

  return {
    entryPrice,
    riskPct: Math.abs(riskPct),
    target1GainPct: Math.abs(target1GainPct),
    target2GainPct: Math.abs(target2GainPct),
    rrRatio1,
    rrRatio2,
  };
}

