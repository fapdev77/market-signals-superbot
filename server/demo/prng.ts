/**
 * R-2 — `server/demo/`: todo gerador de dado fabricado do projeto vive aqui.
 *
 * REGRA DO DIRETÓRIO
 * ------------------
 * Nada em `server/demo/` pode ser chamado sem que `ALLOW_SYNTHETIC_DATA === 'true'` (ou, no
 * caso de seeds de teste). Os chamadores ficam responsáveis
 * pelo gate; este diretório só produz o dado e o marca como `DEMO` na persistência.
 *
 * Motivo: antes das Fases 1/2.5 os geradores estavam espalhados por `binanceService`,
 * `binanceWebsocket`, `MarketScreenerService` e `HistoricalDataService`, e um deles alimentava
 * score de confluência com posicionamento inventado. Concentrar a fabricação aqui torna a
 * superfície de dado sintético auditável por leitura de diretório.
 */

/**
 * PRNG determinístico (mulberry32) — a única fonte de aleatoriedade dos geradores sintéticos
 * que precisam ser reprodutíveis (ex.: candles de backtest).
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Soma dos char codes do símbolo — semente estável usada pelos geradores por símbolo. */
export function symbolSeed(symbol: string): number {
  return symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
}
