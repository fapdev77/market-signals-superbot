/**
 * SDD Fase 9 — S1: paridade de timeframe entre live e backtest.
 *
 * DEFEITO DE ORIGEM: `processTickerState` recebia velas de 15m no live (`server.ts`) e
 * velas de 1m no backtest (`BacktestEngine`). Volume profile, Fibonacci, FVG, estrutura de
 * mercado, CVD e RSI divergence eram calculados sobre horizontes temporais diferentes —
 * logo, o backtest nunca reproduziu o sistema que roda em produção. Todo número de
 * expectativa publicado (evidence ledger) descreve um sistema que não existe.
 *
 * DECISÃO: agregar 1m → 15m no BACKTEST, e não trocar o live para 1m.
 *   1. não altera comportamento de produção;
 *   2. preserva toda a profundidade já sincronizada (o histórico só tem 1m);
 *   3. mantém `SIGNAL_LOOKBACK_CANDLES = 60` significando 60 velas do timeframe de análise,
 *      igual nos dois ambientes (15h no live e no backtest).
 */

import type { KlineCandle } from '../../src/types.js';

/**
 * Agrega velas de 1m em velas de `minutes` minutos.
 *
 * Regras:
 *  - `minutes <= 1` devolve a entrada intacta (já é o timeframe desejado);
 *  - a cauda incompleta é DESCARTADA — emitir uma vela parcial criaria um período de
 *    tempo que não existiu e corromperia o volume profile;
 *  - OHLC e volume são exatos: high/low por extremos, volume e takerBuyVolume por soma;
 *  - o timestamp do bucket é o timestamp de abertura da primeira vela do grupo.
 *
 * Função pura e determinística: mesma entrada ⇒ mesma saída, sem I/O e sem estado.
 */
export function aggregateToTimeframe(candles: KlineCandle[], minutes: number): KlineCandle[] {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const step = Math.floor(minutes);
  if (!Number.isFinite(step) || step <= 1) return candles.slice();

  // ACHADO N3/S1.3: a série é partida em trechos CONTÍGUOS e cada trecho é agregado
  // por conta própria. Agrupar só por índice (o comportamento ingênuo) deixa um bucket
  // atravessar buracos de dados: ele juntaria o minuto 16 com o 22 de uma série com um
  // minuto faltando e emitiria uma vela de "15m" que nunca existiu — deslocando todos
  // os buckets seguintes em 1 minuto. Requisito S1.3 do backlog da Fase 9.
  const srcMs = inferSourceSpacingMs(candles);
  const out: KlineCandle[] = [];

  let runStart = 0;
  for (let i = 1; i <= candles.length; i++) {
    const broke = i === candles.length || candles[i].timestamp - candles[i - 1].timestamp !== srcMs;
    if (!broke) continue;
    const run = candles.slice(runStart, i);
    for (let j = 0; j + step <= run.length; j += step) {
      const bucket = run.slice(j, j + step);
      out.push({
        timestamp: bucket[0].timestamp,
        open: bucket[0].open,
        high: Math.max(...bucket.map(k => k.high)),
        low: Math.min(...bucket.map(k => k.low)),
        close: bucket[bucket.length - 1].close,
        volume: bucket.reduce((a, k) => a + (k.volume || 0), 0),
        takerBuyVolume: bucket.reduce((a, k) => a + (k.takerBuyVolume || 0), 0)
      });
    }
    runStart = i;
  }
  return out;
}

/**
 * Timeframe de análise dos indicadores — o mesmo no live e no backtest.
 *
 * Este é o contrato de paridade: se um dos lados mudar, os dois mudam juntos.
 */
export const INDICATOR_TIMEFRAME_MINUTES = 15;

/**
 * Timeframe da vela de 5m usada pela validação multi-timeframe do sinal.
 *
 * O live consome a vela de 5m REAL da exchange; o backtest só tem 1m e a deriva por
 * agregação (limitação declarada, não removível sem sincronizar histórico de 5m).
 */
export const MTF_VALIDATION_TIMEFRAME_MINUTES = 5;

/** Resolve o timeframe em minutos a partir do rótulo usado pela Binance ('15m', '1h', …). */
export function timeframeLabelToMinutes(label: string): number | null {
  const m = /^(\d+)([mhd])$/.exec(String(label).trim().toLowerCase());
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  return unit === 'm' ? n : unit === 'h' ? n * 60 : n * 60 * 24;
}
/**
 * Tamanho do lookback de indicadores, em velas do timeframe de análise.
 *
 * O `BacktestEngine` passa `SIGNAL_LOOKBACK_CANDLES` explicitamente. O default existe
 * para os testes, que garantem que os dois não divergem —
 * 60 velas significam 15h no timeframe de 15m, nos DOIS ambientes.
 */
export const DEFAULT_INDICATOR_LOOKBACK = 60;

/**
 * Passo nominal entre velas da série de origem (o menor delta positivo observável).
 *
 * Serve para detectar BURACOS: um minuto que a exchange não devolve (ou que o sync não
 * conseguiu buscar) aparece como um delta maior que o nominal, e agrupar por índice a
 * partir dali produziria buckets deslocados — velas de "15m" que nunca existiram, e
 * um deslocamento que contaminaria toda a série subsequente.
 */
function inferSourceSpacingMs(candles: KlineCandle[]): number {
  let min = Infinity;
  for (let i = 1; i < candles.length; i++) {
    const d = candles[i].timestamp - candles[i - 1].timestamp;
    if (d > 0 && d < min) min = d;
  }
  return Number.isFinite(min) ? min : 60_000;
}


/**
 * Janela de indicadores disponível no instante do candle de 1m `minuteIndex`.
 *
 * O bucket `k` da série agregada cobre as velas de 1m `[k*minutes .. k*minutes+minutes-1]`
 * e só está FECHADO em `minuteIndex = k*minutes + (minutes-1)`. Antes disso ele não pode
 * entrar na janela — usá-lo seria lookahead, e o backtest publicaria um número que o live
 * não consegue reproduzir.
 *
 * Função pura e O(1) em number de linhas lidas: só a janela é recortada.
 */
export function indicatorWindowAt(
  aggregated: KlineCandle[],
  minuteIndex: number,
  minutes: number = INDICATOR_TIMEFRAME_MINUTES,
  lookback: number = DEFAULT_INDICATOR_LOOKBACK
): KlineCandle[] {
  if (!Array.isArray(aggregated) || aggregated.length === 0) return [];
  const step = Math.floor(minutes);
  if (!Number.isFinite(step) || step <= 1) return aggregated.slice(-lookback);

  const lastCompleteBucket = Math.floor((minuteIndex - (step - 1)) / step);
  if (lastCompleteBucket < 0) return [];
  const k = Math.min(lastCompleteBucket, aggregated.length - 1);
  return aggregated.slice(Math.max(0, k - (lookback - 1)), k + 1);
}
