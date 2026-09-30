/**
 * 6.5.2 — Filtros do exchange (G-12) — módulo PURO, sem I/O.
 *
 * Lê PRICE_FILTER (tickSize), LOT_SIZE (stepSize, minQty) e o filtro de notional
 * mínimo do `exchangeInfo` da fapi. Nomes validados na fixture real de 2026-09-30
 * (tests/fixtures/binance/exchangeInfo.json): o filtro de notional na fapi chama-se
 * `MIN_NOTIONAL` com campo `notional` (NÃO `minNotional`, como no spot).
 *
 * Sem filtro ⇒ null e o caller trata como "executabilidade desconhecida" (não bloqueia).
 */

export interface SymbolFilters {
  symbol: string;
  tickSize: number;
  stepSize: number;
  minQty: number;
  minNotional: number;
}

interface RawFilter {
  filterType?: string;
  tickSize?: string;
  stepSize?: string;
  minQty?: string;
  notional?: string;
  minNotional?: string;
}

/** Dobra um número float em inteiro seguro na escala usada (12 dígitos). */
function toScaledInt(value: number): bigint {
  return BigInt(Math.round(value * 1e12));
}

/**
 * Extrai os filtros de um símbolo do exchangeInfo. Retorna null quando o símbolo não
 * tem os três filtros essenciais (PRICE_FILTER/LOT_SIZE/notional) — o caller decide
 * como tratar (não bloqueamos sinais por falta de metadado).
 */
export function extractSymbolFilters(exchangeInfoSymbol: {
  symbol?: string;
  filters?: RawFilter[];
} | null | undefined): SymbolFilters | null {
  if (!exchangeInfoSymbol?.filters || !Array.isArray(exchangeInfoSymbol.filters)) {
    return null;
  }

  let tickSize: number | null = null;
  let stepSize: number | null = null;
  let minQty: number | null = null;
  let minNotional: number | null = null;

  for (const f of exchangeInfoSymbol.filters) {
    const type = String(f?.filterType || '').toUpperCase();
    if (type === 'PRICE_FILTER' && f.tickSize !== undefined) {
      const v = Number(f.tickSize);
      if (Number.isFinite(v) && v > 0) tickSize = v;
    } else if (type === 'LOT_SIZE' && f.stepSize !== undefined) {
      const v = Number(f.stepSize);
      if (Number.isFinite(v) && v > 0) stepSize = v;
      if (f.minQty !== undefined) {
        const v = Number(f.minQty);
        if (Number.isFinite(v) && v >= 0) minQty = v;
      }
    } else if (type === 'MIN_NOTIONAL' && f.notional !== undefined) {
      const v = Number(f.notional);
      if (Number.isFinite(v) && v >= 0) minNotional = v;
    }
  }

  if (tickSize === null || stepSize === null || minQty === null) {
    return null;
  }

  return {
    symbol: String(exchangeInfoSymbol.symbol || ''),
    tickSize,
    stepSize,
    minQty,
    minNotional: minNotional ?? 0
  };
}

/**
 * Arredonda o preço para múltiplo do tickSize (half-away-from-zero).
 * Modos de arredondamento do stop (o spec pede o lado conservador):
 *  - 'conservative-long-stop': para BAIXO — stop LONG dispara antes (mais seguro);
 *  - 'conservative-short-stop': para CIMA — stop SHORT dispara antes (mais seguro);
 *  - 'nearest' (default): múltiplo mais próximo — usado em entrada/alvos.
 */
export function roundPriceToTick(
  price: number,
  tickSize: number,
  mode: 'nearest' | 'conservative-long-stop' | 'conservative-short-stop' = 'nearest'
): number {
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(tickSize) || tickSize <= 0) {
    return price;
  }
  const ticks = toScaledInt(price) / toScaledInt(tickSize); // BigInt division truncates toward zero
  let roundedTicks: bigint;
  if (mode === 'conservative-long-stop') {
    roundedTicks = ticks; // floor
  } else if (mode === 'conservative-short-stop') {
    roundedTicks = (toScaledInt(price) % toScaledInt(tickSize) === 0n) ? ticks : ticks + 1n; // ceil
  } else {
    // nearest: soma meio tick antes de truncar
    roundedTicks = (toScaledInt(price) + toScaledInt(tickSize) / 2n) / toScaledInt(tickSize);
  }
  return Number(roundedTicks * toScaledInt(tickSize)) / 1e12;
}

export interface ExecutabilityCheck {
  executable: boolean;
  reason?: string;
  /** Quantidade arredondada para baixo ao stepSize (a efetivamente sugerida). */
  suggestedQuantity: number;
}

/**
 * Arredonda a quantidade para baixo ao stepSize e valida mínimos do exchange
 * (minQty e notional). Sem passos de step, uma quantidade válida pode ser
 * rejeitada pelo exchange — pior do que não emitir o sinal.
 */
export function checkExecutability(params: {
  quantity: number;
  entryPrice: number;
  filters: SymbolFilters;
}): ExecutabilityCheck {
  const { quantity, entryPrice, filters } = params;
  const step = filters.stepSize > 0 ? filters.stepSize : 0;

  // Floor ao stepSize em aritmética inteira (evita 0.0010000000000000002)
  const scaled = toScaledInt(quantity);
  const stepScaled = toScaledInt(step);
  const floored = stepScaled > 0n ? (scaled / stepScaled) * stepScaled : scaled;
  const suggestedQuantity = Number(floored) / 1e12;

  if (suggestedQuantity <= 0 || suggestedQuantity < filters.minQty) {
    return {
      executable: false,
      reason: `Quantidade ${suggestedQuantity} abaixo do minQty do exchange (${filters.minQty}).`,
      suggestedQuantity
    };
  }

  const notional = suggestedQuantity * entryPrice;
  if (filters.minNotional > 0 && notional < filters.minNotional) {
    return {
      executable: false,
      reason: `Notional ${notional} abaixo do mínimo do exchange (${filters.minNotional}).`,
      suggestedQuantity
    };
  }

  return { executable: true, suggestedQuantity };
}
