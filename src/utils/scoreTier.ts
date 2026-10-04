/**
 * Chave de tier de score — DEFINIÇÃO ÚNICA, compartilhada pelo servidor e pela UI.
 *
 * Antes desta consolidação a mesma fórmula aparecia em três lugares
 * (`EvidenceService.generateEvidenceSummary`, `server/db.ts` e a rota de calibração).
 * Três cópias da mesma chave é exatamente como o ledger passa a agrupar por um bucket e
 * a tela lê outro: o operador vê a expectativa de um tier e o sistema agrupa em outro,
 * e nenhum teste acusa nada porque ambos os lados "funcionam".
 *
 * Vive em `src/` porque o servidor já importa de `src/` (tipos e constantes) — a
 * dependência vai no sentido que já existe no projeto, e não na direção nova.
 */
export function tierKeyForScore(score: number): string {
  const safe = Number.isFinite(score) ? Math.min(100, Math.max(0, Math.floor(score))) : 0;
  const lo = Math.floor(safe / 10) * 10;
  return `${lo}-${lo + 9}`;
}