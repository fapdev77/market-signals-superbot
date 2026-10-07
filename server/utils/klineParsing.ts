/**
 * A-06 — parsing com PROVENIÊNCIA de campos numéricos vindos da exchange.
 *
 * Um campo ausente, vazio ou inválido vira `null`, nunca um número fabricado:
 * um percentual inventado (0.5/0.52) contaminaria CVD e `entryConfirmation`,
 * e um `0` silencioso significaria "venda integral" em `volume - takerBuyVolume`.
 *
 * Um `0` REAL permanece `0` — a ausência é só ausência.
 *
 * Fonte única usada pelo ingest de klines (`binanceService.mapRawKlineToCandle`)
 * e pelo ingest de histórico (`HistoricalDataService`), para que os dois lados
 * (live e backtest) apliquem a MESMA regra.
 */
export function parseMeasuredNumber(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  const text = String(raw).trim();
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}
