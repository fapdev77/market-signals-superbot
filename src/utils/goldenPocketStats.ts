import type { TradeSignal } from '../types';

export interface GoldenPocketOutcome {
  profitable: boolean;
  pnlPct: number;
  timestamp: number;
}

/**
 * FASE 0 (C-02) — estatísticas Golden Pocket derivadas APENAS dos sinais reais.
 *
 * `winRate: number | null`: `null` quando nenhum alerta teve desfecho resolvido
 * (nem sempre = nenhum sinal: sinais ainda ativos não pontuam). A UI mostra
 * "n/d" nesse caso. Nenhum tamanho mínimo de amostra, win-rate de fallback
 * (o antigo 74%) ou curva sintética existe aqui — a função recebe o que houve e
 * devolve o que houve.
 *
 * Extraída de `App.tsx` para ser pura e testável: a decisão "quando o operador
 * pode ver um percentual" não pode viver dentro de um `useMemo` de componente.
 */
export interface GoldenPocketStats {
  symbol: string;
  /** Alertas com desfecho resolvido (lucro ou stop). É a base real do `winRate`. */
  totalAlerts: number;
  profitableCount: number;
  stoppedCount: number;
  /** Alertas ainda em aberto — fora da base do `winRate`. */
  activeCount: number;
  /** `null` quando não há amostra resolvida. */
  winRate: number | null;
  /** Desfechos efetivamente registrados, sem padding sintético. */
  recentOutcomes: GoldenPocketOutcome[];
}

const MAX_RECENT_OUTCOMES = 8;
/** Faixas de desfecho por preço — mesmas do histórico anterior à extração. */
const PROFITABLE_PNL_PCT = 1.2;
const STOPPED_PNL_PCT = -1.0;

export function computeGoldenPocketStats(
  symbol: string,
  signals: TradeSignal[]
): GoldenPocketStats {
  let profitableCount = 0;
  let stoppedCount = 0;
  let activeCount = 0;
  const recentOutcomes: GoldenPocketOutcome[] = [];

  signals.forEach(s => {
    const entry = s.entryZone ? (s.entryZone[0] + s.entryZone[1]) / 2 : s.currentPrice;
    const isLong = s.direction === 'LONG';
    const pnlPct = isLong
      ? ((s.currentPrice - entry) / entry) * 100
      : ((entry - s.currentPrice) / entry) * 100;

    const isProfitable = s.status === 'TARGET_REACHED' || pnlPct >= PROFITABLE_PNL_PCT;
    const isStopped = s.status === 'STOPPED_OUT' || pnlPct <= STOPPED_PNL_PCT;

    if (isProfitable) profitableCount++;
    else if (isStopped) stoppedCount++;
    else activeCount++;

    recentOutcomes.push({
      profitable: isProfitable,
      pnlPct: parseFloat(pnlPct.toFixed(2)),
      timestamp: s.createdAt
    });
  });

  // C-02: sem desfecho resolvido o win-rate é `null`, nunca um percentual de
  // fallback apresentado como histórico real.
  const totalAlerts = profitableCount + stoppedCount;
  const winRate = totalAlerts > 0 ? Math.round((profitableCount / totalAlerts) * 100) : null;

  return {
    symbol,
    totalAlerts,
    profitableCount,
    stoppedCount,
    activeCount,
    winRate,
    recentOutcomes: recentOutcomes.slice(-MAX_RECENT_OUTCOMES)
  };
}
