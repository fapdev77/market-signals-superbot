/**
 * SDD Fase 9 — S3: a definição ÚNICA de "vitória".
 *
 * Este arquivo tem uma função. Isso é proposital.
 *
 * Antes desta fase, `isWin` media três coisas diferentes ao mesmo tempo:
 *
 *   - ledger (`server/db.ts`):        `netR > 0`           — R líquido;
 *   - backtest (posição fechada):     `positionNetPct > 0` — % líquido, com
 *                                                         arredondamento próprio;
 *   - pernas (`positionResolution`):  `grossPnlPct > 0`    — BRUTO, sem taxa e
 *                                                         sem funding.
 *
 * Duas consequências que não são acadêmicas:
 *
 *   1. Um trade com bruto de +0,05% e taxa de ida e volta de 0,08% é PERDA. Pelo bruto
 *      é vitória; pelo ledger é derrota. O painel de Trading Insights e o evidence ledger
 *      discordam do MESMO trade, e o operador não tem como saber qual dos dois mente.
 *   2. O bruto alimenta `TickProcessor`, que decide entre "Alvo 2 atingido (+100%
 *      expansão de lucro)" e "Stop Loss Atingido". Um alvo que não paga a taxa não é
 *      lucro, e o log de execução afirma que é.
 *
 * A DEFINIÇÃO: um trade é vitória se, e somente se, o R LÍQUIDO é estritamente positivo.
 * Liquido significa: depois de taxa de ida e volta, slippage e funding — o dinheiro que
 * de fato entrou na conta.
 *
 * Por que R e não porcentagem: o operador arrisca uma fração FIXA do capital por trade
 * (é assim que o motor dimensiona posição). Logo, a unidade comparável entre trades é o
 * múltiplo do risco, não o retorno percentual. Um trade de +0,5% com risco de 2% é
 * +0,25R; o mesmo +0,5% com risco de 0,25% é +2R. Tratar os dois como "ganho de 0,5%"
 * é comparar coisas diferentes.
 *
 * Por que `> 0` e não `>= 0`: empate não é vitória. Um trade que fecha exatamente no zero
 * depois de custos não pagou o risco nem o custo de oportunidade de tê-lo aberto.
 *
 * Por que os degenerados são derrota: `NaN > 0` é falso em JavaScript, mas a comparação
 * com `Number.POSITIVE_INFINITY` é verdadeira — e um R infinito é sempre um bug de
 * divisão (risco zero), nunca uma boa notícia. Falhar para o lado conservador é a única
 * escolha segura num campo que decide se o operador confia no número.
 */
export function isNetWin(netR: number | null | undefined): boolean {
  return typeof netR === 'number' && Number.isFinite(netR) && netR > 0;
}