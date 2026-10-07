/**
 * FASE 0 (C-08) — volatilidade diária REALIZADA, medida sobre velas.
 *
 * É o dado que faltava para o VaR sair de `PARAMETRIC_ASSUMED`: a premissa fixa
 * de 3,5%/dia era uma suposição apresentada junto de um número calculado.
 *
 * Método: desvio-padrão amostral dos retornos log fechamento-a-fechamento,
 * escalado para 1 dia pelo intervalo REAL medido entre as velas (o rótulo do
 * feed não é confiável — ver A-04).
 *
 * `null` quando a amostra não sustenta uma medida: aí o chamador mantém a
 * premissa paramétrica e rotula a procedência. Nenhum valor é "medido" por
 * conveniência.
 */
export interface RealizedVolResult {
  /** Fração diária — 0.035 = 3,5%/dia. */
  dailyVol: number;
  /** Quantos retornos entraram na medida. */
  returnsUsed: number;
  /** Intervalo mediano entre velas, em minutos. */
  intervalMinutes: number;
  /** Span real coberto pela série, em horas. */
  windowHours: number;
}

/** Amostra mínima: menos que isso não sustenta um desvio-padrão confiável. */
const MIN_RETURNS = 20;
const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function computeDailyRealizedVol(
  candles: Array<{ timestamp: number; close: number }>
): RealizedVolResult | null {
  const usable = (candles || []).filter(
    c => Number.isFinite(c?.timestamp) && Number.isFinite(c?.close) && c.close > 0
  );
  if (usable.length < MIN_RETURNS + 1) return null;

  const deltas: number[] = [];
  for (let i = 1; i < usable.length; i++) {
    const delta = usable[i].timestamp - usable[i - 1].timestamp;
    if (delta > 0) deltas.push(delta);
  }
  if (deltas.length < MIN_RETURNS) return null;

  const intervalMs = median(deltas);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;

  const returns: number[] = [];
  for (let i = 1; i < usable.length; i++) {
    const delta = usable[i].timestamp - usable[i - 1].timestamp;
    // Só pares dentro do intervalo mediano entram: uma falha de feed cria um
    // vazio, e o retorno sobre o vazio não é um retorno do mercado.
    if (Math.abs(delta - intervalMs) > intervalMs * 0.5) continue;
    returns.push(Math.log(usable[i].close / usable[i - 1].close));
  }
  if (returns.length < MIN_RETURNS) return null;

  const mean = returns.reduce((acc, r) => acc + r, 0) / returns.length;
  const variance = returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (returns.length - 1);
  if (!Number.isFinite(variance) || variance < 0) return null;

  const intervalVol = Math.sqrt(variance);
  const intervalsPerDay = MS_PER_DAY / intervalMs;
  const dailyVol = intervalVol * Math.sqrt(intervalsPerDay);
  if (!Number.isFinite(dailyVol) || dailyVol <= 0) return null;

  const firstTs = usable[0].timestamp;
  const lastTs = usable[usable.length - 1].timestamp;

  return {
    dailyVol,
    returnsUsed: returns.length,
    intervalMinutes: Number((intervalMs / 60_000).toFixed(2)),
    windowHours: Number(((lastTs - firstTs) / MS_PER_HOUR).toFixed(2))
  };
}
