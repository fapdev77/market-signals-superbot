import { HistoricalDataService } from '../../server/services/HistoricalDataService.js';

/** 15 min, o mesmo alinhamento da janela de análise do BacktestEngine. */
const BACKTEST_CANDLE_MS = 15 * 60 * 1000;

/** Início da janela alinhada ao candle, igual ao `now` do BacktestEngine. */
export function alignedNow(): number {
  return Math.floor(Date.now() / BACKTEST_CANDLE_MS) * BACKTEST_CANDLE_MS;
}

/**
 * Pré-carrega candles sintéticos determinísticos para que as suítes de backtest
 * não façam rede e leiam sempre os mesmos candles para a mesma janela.
 *
 * `HistoricalDataService.seedSyntheticKlines` deriva o stream pseudoaleatório de
 * (symbol, startTime) — logo o seed é reprodutível — e é chamado uma única vez,
 * então runs consecutivos leem exatamente as mesmas linhas.
 */
export async function seedBacktestKlines(
  symbols: string[],
  days: number
): Promise<void> {
  const now = alignedNow();
  // +2 dias de folga cobrem o deslocamento de 15 min da âncora entre o seed e a
  // execução, sem depender de sincronização de rede.
  const startTime = now - (days + 2) * 24 * 60 * 60 * 1000;
  for (const symbol of symbols) {
    await HistoricalDataService.seedSyntheticKlines(symbol, startTime, now);
  }
}
