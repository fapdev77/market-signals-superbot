# SDD — Backlog Fase 9: paridade de timeframe e calibração de score

> Especificação para implementação sob TDD/SDD. Cada item traz **contrato**, **critérios de
> aceitação verificáveis** e **ordem**. Nenhum item começa sem o teste vermelho correspondente.
>
> Origem: auditoria completa do `market-signals-superbot` (CRÍTICOS 1–3, ALTOS 1–3).

---

## Ordem de implementação (por dependência)

```
S1  Paridade de timeframe dos indicadores   <- pre-requisito de TODOS os numeros
S2  CRÍTICO-3  Calibração do score contra base rate
S3  ALTO-3     isWin bruto vs. líquido (alinhado à decomposição de R)
S4  ALTO-2     P&L do cliente sem custos/slippage/funding
```

**S1 vem primeiro porque é pre-requisito dos outros.** Hoje o backtest calcula os
indicadores sobre velas de **1m** e o live sobre **15m**. Qualquer expectativa medida
no backtest descreve um sistema que não existe em produção. Calibrar o score (S2)
contra números de um sistema diferente produziria uma calibração inválida.

---

## S1 — Paridade de timeframe dos indicadores

### Problema

| Ambiente | Série passada a `processTickerState` |
|---|---|
| Live (`server.ts`) | `fetchKlines(symbol, '15m', …)` |
| Backtest (`BacktestEngine`) | `getBySymbolAndRange(symbol, '1m', …)` |

Volume profile, Fibonacci, FVG, estrutura de mercado, CVD e RSI divergence são
calculados sobre **timeframes diferentes**. O backtest não reproduz o live.

### Contrato

`processTickerState` passa a receber explicitamente o timeframe das velas que recebeu, e
o backtest passa a feeding **15m** — o mesmo timeframe do live.

### Decisão de projeto

Agregar 1m → 15m no backtest (não trocar o live para 1m). Três razões:

1. **Não altera comportamento de produção.** Trocar o live para 1m mudaria o robô real.
2. **O histórico disponível é 1m.** Agregar preserva toda a profundidade já sincronizada.
3. **A janela de lookback continua comparável.** `SIGNAL_LOOKBACK_CANDLES = 60` significa
   60 velas do timeframe *de análise*: 15 horas no live, 1 hora no backtest hoje.

### Critérios de aceitação (TDD)

- `aggregateToTimeframe(candles, minutes)` agrega 1m → Nm corretamente (OHLCV + takerBuyVolume).
- `aggregateToTimeframe` devolve entrada vazia ou já-agregada sem alterar.
- Uma série 15m agregada de 1m tem exatamente `floor(n/15)` velas com timestamps alinhados.
- O backtest chama `processTickerState` com velas de 15m (test com spy).
- **Paridade**: dado o mesmo preço, `processTickerState` produz o mesmo `confluenceScore`
  live e backtest quando ambos recebem velas de 15m (test de paridade real, alimentando
  os dois lados com a **mesma** série 15m — corrige o defeito do teste anterior, que
  alimentava velas de 1m dos dois lados e por isso mascarava a divergência).

### Impacto esperado

Todos os números históricos de backtest e do evidence ledger ficam **desatualizados** e
precisam ser regerados. Isso é o objetivo, não um efeito colateral.

---

## S2 — CRÍTICO-3: `confluenceScore` calibrado contra base rate

### Problema

```
const confluenceScore = Math.min(100, Math.round(Math.abs(netScore) * 1.2 + 25));
```

- `netScore = 0` (neutro perfeito) produz **25%**.
- Satura em 100 com ~4 fatores moderados.
- Sem normalização cross-sectional: num dia volátil "confirma" todo mundo.
- Não é uma probabilidade — e a UI o exibe como se fosse (`Header.tsx`, `SignalsMatrix`,
  `PrimeOpportunityBanner`, `ChartAndProfile`).

`buildTradeSignal` aceita ≥50 e `CONFIRMED` exige ≥60: **um único fator moderado
cruzar o gatilho já produz "60% de confluência, confirmado"**.

### Contrato

Separar **força de confluência** (o que `confluenceScore` já é) de **expectativa
calibrada** (o que o operador precisa para decidir). Novo módulo puro:

```ts
calibrateScore(rawScore, tierMetrics, globalMetrics) → {
  expectancyR,        // R esperado, encolhido em direção à média global
  sampleSize,         // n do bucket
  confidence,         // 'CALIBRATED' | 'THIN_SAMPLE' | 'UNCALIBRATED'
  basisTier,          // bucket usado
}
```

**Regra de ouro: calibrar contra `rExpectancy` (R), nunca contra `winRate`.**
Win rate não é edge — 90% de acerto com R:R 0,2 é prejuízo.

### Encolhimento (shrinkage)

Prior = média global de `rExpectancy`; peso da evidência = `n / (n + k)` com `k = 30`:

```
expectancyR = prior + (empirical - prior) * n / (n + k)
```

`k = 30` faz um bucket com n=0 devolver o prior, n=30 devolver metade do caminho até o
empírico. `confidence` degrada conforme n: `UNCALIBRATED` (sem bucket), `THIN_SAMPLE`
(n < 30), `CALIBRATED` (n ≥ 30).

### Critérios de aceitação (TDD)

- `calibrateScore` com bucket ausente → `UNCALIBRATED` e retorna o prior.
- `calibrateScore` com n grande → aproxima o empírico.
- `calibrateScore` com n pequeno → fica próximo do prior (encolhe).
- Monotonicidade: score maior nunca produz expectancy menor **para o mesmo conjunto empírico**.
- Score exibido deixa de ser apresentado como probabilidade na UI.
- `SignalBadge`/`Header` mostram `expectancyR` calibrado quando `CALIBRATED`, e um
  aviso explícito quando não há amostra suficiente.

### Honestidade

Quando `confidence !== 'CALIBRATED'`, a UI **deve** dizer que não há amostra suficiente.
Exibir um número sem base rate é exatamente o defeito que estamos corrigindo.

---

## S3 — ALTO-3: `isWin` bruto vs. líquido

### Problema

```ts
// BacktestEngine.ts
isWin: netPct > 0,        // called "net" but is GROSS
// EvidenceService.ts
isWin: finalOutcome.netR > 0,   // líquido, pós taxas/slippage/funding
```

Duas definições de "vitória" convivendo; a do backtest é a mais permissiva. Backtest e
ledger medem coisas diferentes.

### Contrato

`isWin` é sempre derivado do **R líquido** (`rDecomposition.rNet` / `netR`), nos dois
motores. O campo `grossPnlPct` continua existindo para auditoria explícita.

### Critérios de aceitação (TDD)

- Um trade com P&L bruto positivo e R líquido negativo é `isWin: false`.
- Teste de paridade: dado o mesmo trade, `BacktestEngine` e `EvidenceService` concordam.
- Nenhum consumidor de `isWin` passa a discordar do ledger.

---

## S4 — ALTO-2: P&L do cliente sem custos

### Problema

`src/utils/tradeMetrics.ts` deriva `pnlR`/`pnlPct` dos campos do próprio sinal
(`target1`, `target2`, `stopLoss`), com **zero taxas, zero slippage, zero funding e sem
caminho de preço**. O backtest usa 0,04%/ordem + 0,02% slippage + funding real.

Não é inconsistência de código — é **inconsistência de modelo**: o painel "Trading
Insights" mostra números de um motor diferente e mais otimista que o backtest.

### Contrato

`tradeMetrics` aplica os mesmos custos do servidor, e a UI rotula o valor como
**estimativa** enquanto não houver caminho de preço resolvido pelo ledger.

### Critérios de aceitação (TDD)

- Custos de ida e volta aplicados: `(feePct*2 + slippagePct)` sobre o notional.
- Funding descontado quando informado.
- `pnlR` líquido ≤ `pnlR` bruto para o mesmo trade.
- UI rotula como estimativa enquanto o desfecho não vier do ledger.

---

## Definição de pronto (DoD)

Cada item só fecha quando:

1. O teste vermelho correspondente existe e **falha** antes da implementação.
2. `npm run typecheck` limpo.
3. `npm test` verde, com contagem de testes **crescente** (nunca afrouxar asserção para
   fazer passar).
4. `npx tsx scripts/quality-baseline.ts` sem regressão de `any`/`catch` vazios.
5. `npm run build` ok.
6. Documentação de evidência regerada quando o item altera números publicados.

---

## Fora de escopo (decidir depois)

- Decorrelação/whitening dos fatores (CVD e OI são correlacionados e contados como
  evidência independente).
- Walk-forward de múltiplos regimes com rebalanceamento de parâmetros.
- Microestrutura: slippage real por profundidade em vez de estimativa fixa.
---

# Plano de implementação (TDD, ciclo red → green → refactor)

Cada passo abaixo é um ciclo TDD fechado. **Nenhum passo verde sem o vermelho correspondente
observado primeiro.** Regressão de contagem de testes é tratada como defeito, não como
"ajuste de teste".

## Fase A — S1 (paridade de timeframe) · fecha o item já iniciado

| # | RED (teste que falha) | GREEN (implementação mínima) | REFACTOR |
|---|---|---|---|
| A1 | `indicatorWindowAt` devolve janela **somente** com buckets fechados até `i` (sem lookahead) e ≤ `SIGNAL_LOOKBACK_CANDLES` | helper puro em `timeframeParity.ts` | mover o cursor monotônico para dentro do helper |
| A2 | série de 1m com 7 velas → **1** vela de 5m (cauda incompleta descartada, nunca 2) | `aggregateToTimeframe(candles, 5)` no lugar do `aggregateTo5m` duplicado | apagar `aggregateTo5m` local |
| A3 | — | import + `npm run typecheck` | rodar a suíte |

**A1 é o teste que fecha o bug de lookahead** que o cursor inline poderia reintroduzir:
o bucket `k` cobre as velas 1m `[k*15 .. k*15+14]` e só está completo em `i = k*15+14`.

## Fase B — S2 (calibração de score)

| # | RED | GREEN |
|---|---|---|
| B1 | `calibrateScore`: sem bucket ⇒ `UNCALIBRATED` + prior; `n=1` ⇒ colado no prior; `n` grande ⇒ colado no empírico; monotônico em `rawScore`; **usa `rExpectancy`, ignora `winRate`** | `server/services/scoreCalibration.ts` (puro, sem I/O) |
| B2 | rota devolve o mapa tier→expectancy calibrado | `GET /api/evidence/calibration` reaproveitando `generateEvidenceSummary` |
| B3 | rótulo compartilhado distingue `CALIBRATED` / `THIN_SAMPLE` / `UNCALIBRATED` | helper puro de rótulo + UI deixa de exibir `%` como se fosse probabilidade |

## Fase C — S3 (definição única de vitória)

| # | RED | GREEN |
|---|---|---|
| C1 | trade com P&L **bruto** positivo e **R líquido** negativo ⇒ `isWin === false` | predicado único `isNetWin(netR)` |
| C2 | backtest e ledger concordam no mesmo trade | `BacktestEngine`, `db.ts` e `EvidenceService` passam a usar o mesmo predicado |

## Fase D — S4 (custos no P&L do cliente)

| # | RED | GREEN |
|---|---|---|
| D1 | `pnlR` líquido ≤ `pnlR` bruto para o mesmo trade; ida e volta = `fee*2 + slippage`; funding descontado | aplicar custos em `tradeMetrics` |
| D2 | `TARGET_REACHED` deriva `pnlR` dos **preços** (`target1`/`target2`), não do `riskRewardRatio` planejado | remover o `pnlR = riskRewardRatio \|\| 2.5` fabricado |

## Fase E — novos achados (ver "Achados novos" abaixo)

| # | RED | GREEN |
|---|---|---|
| E1 | `parseCompareEntryArgs(['--accept-negative-expectancy','--reason','...'])` → aceite + razão; ausente ⇒ nada | flag CLI arrastada até `evaluateEntryConfirmationDecisionV2` e gravada no veredito |
| E2 | motivo (c) diz "+20% **relativo** ao controle", com o limite em % absoluto | corrigir a prosa do critério (c) |

## Gates por fase (DoD)

`npm run typecheck` → `npx vitest run <arquivo do item>` → `npm test` →
`npx tsx scripts/quality-baseline.ts` → `npm run build`.

---

# Achados novos (Fase 9, continuacao da auditoria)

## N1 — Não existe caminho CLI para o aceite do dono (ALTO)

`evaluateEntryConfirmationDecisionV2` aceita `OwnerAcceptance { acceptedNegativeExpectancy,
reason }` e `entryComparisonPaired.ts` já repassa o campo, mas `scripts/compare-entry.ts` não
tem flag que o produza. O critério (d) é, portanto, **inalcançável por operador** — a válvula
existe no código e não existe no mundo. Não é bug do gate; é ausência do interruptor.
**Correção:** E1. Sem isso, um operador que decide ligar a flag em modo experimental não tem
como registrar o motivo, e o veredito gerado mente sobre a própria regra.

## N2 — A prosa do critério (c) contradiz o código (MÉDIO)

O código calcula `ddLimit = control.maxDrawdownPct * (1 + 20/100)` — **+20% relativo**.
A mensagem impressa diz `controle 58.48% + 20%`, que lido como leitura natural sugere
`58.48% + 20 p.p. = 78.48%`. Com controle ≠ 100% os dois números divergem, e a razão
registrada no documento de decisão é a evidência que o revisor lê.
**Correção:** E2.

## N3 — Duas implementações divergentes da mesma agregação (MÉDIO)

`BacktestEngine` tinha `aggregateTo5m` local (mantendo a **cauda incompleta**) enquanto
`timeframeParity.aggregateToTimeframe` a descarta. Duas funções, mesmo nome implícito,
semanticas diferentes — a segunda e a correta (uma vela parcial é um período que não
existiu). **Correção:** A2, com teste.

## N4 — `pnlR` do cliente é fabricado a partir do R:R **planejado** (ALTO)

```ts
if (signal.status === 'TARGET_REACHED') {
  pnlR = signal.riskRewardRatio || 2.5;   // objetivo do sinal, não resultado realizado
}
```

`riskRewardRatio` é a relação alvo/stop **definida na emissão**. Usá-la como R realizado
presupõe que os dois alvos foram preenchidos exatamente nos preços previstos — o que o
próprio `pnlPct` do bloco já desmente (assume 50/50 sem caminho de preço). Todo
`expectancyR` do painel "Trading Insights" herda esse otimismo. **Correção:** D2.

## N5 — `confluenceScore` é rotulado como probabilidade em 8 pontos da UI (ALTO)

`Header`, `TickerGrid`, `SignalsMatrix`, `PrimeOpportunityBanner`, `ChartAndProfile`,
`PromptPreviewModal`, `TradeHistory`, `BacktestDashboard` exibem `NN%`. `netScore = 0`
produz 25% (CRÍTICO-3). **Correção:** B3 + S2.

---

# Estado final da Fase 9 (verificado)

Todos os itens S1–S4 e os achados N1–N5 estão implementados e verificados.

| Item | Onde | Status |
|---|---|---|
| S1 paridade de timeframe | `server/services/timeframeParity.ts`, `BacktestEngine.ts` | ok |
| S2 calibração de score | `server/services/scoreCalibration.ts`, `src/utils/scoreTier.ts`, `scoreDisplay.ts`, `useScoreCalibration.ts`, `GET /api/evidence/calibration` | ok |
| S3 definição única de vitória | `server/services/winDefinition.ts`, `positionResolution.ts` | ok |
| S4 custos no P&L do cliente | `src/utils/tradeCosts.ts`, `tradeMetrics.ts` | ok |
| N1 (E1) aceite do dono no CLI | `scripts/compare-entry.ts` | ok |
| N2 (E2) prosa do critério (c) | `server/services/entryDecisionRuleV2.ts` | ok |
| N3 agregação contígua | `timeframeParity.aggregateToTimeframe` | ok |
| N4 `pnlR` fabricado | `tradeMetrics.realizedR` a partir dos preços | ok |
| N5 score como probabilidade | 9 pontos da UI corrigidos + guard de fonte `B3.4` | ok |

## Gates

| Gate | Baseline | Resultado |
|---|---|---|
| `npm run typecheck` | limpo | limpo |
| `npm test` | 132 arquivos / 709 testes | **135 arquivos / 742 testes**, todos verdes |
| `npx tsx scripts/quality-baseline.ts` | `any=161 catchVazios=8` | `any=160 catchVazios=8` (melhorou) |
| `npm run build` | ok | ok |

Nenhuma asserção foi afrouxada para fazer algo passar. As duas asserções alteradas em
`tests/tradeHistoryMetrics.test.ts` foram corrigidas porque o valor **fabricado**
(`pnlR` herdado do R:R planejado, N4) deixou de existir: `pnlR` agora vem de `realizedR`,
derivado dos preços. O número became mais pessimisticamente correto.

## Evidência de entry confirmation — REGENERADA (2026-10-04)

Regerada com `npm run compare:entry -- --universe --register` após S1. Artefatos:

- `docs/evidence/entry-confirmation-comparison-2026-10-04.md`
- `docs/evidence/decision-entry-confirmation.md`
- `docs/evidence/entry-confirmation-verdict.json`

`engineVersion` 4566b37 -> 692ddb6; veredito `entryConfirmationEnabled: false`
("MANTER DESLIGADA"), `ownerAcceptance: null` (nenhum aceite do dono registrado), e
`ENTRY_CONFIRMATION_ENABLED="false"` em `.env`/`.env.example` — **flag e veredito casam**,
`tests/flagMatchesDecision.test.ts` verde. Nenhum arquivo foi editado à mão (8.2.4).

## ACHADO N6 (novo, BLOQUEANTE) — o braço B não consegue preencher por construção

O veredito acima é **correto como decisão** (a flag fica desligada) mas **não é um
experimento válido**: o braço com confirmação preencheu **0 de 4575 sinais** (94,8% não
preenchidos). Os critérios (b) e (d) "passaram" por acidente — um braço que não faz
nada tem R = 0 por construção, então a diferença pareada é positiva e a expectativa
absoluta é ≥ 0. Só o critério (a) (amostra insuficiente) barrou, e por acidente.

**Causa-raiz (provada, não inferida):** em `BacktestEngine.ts` o braço B monta
`klines5m` a partir do recorte pós-sinal —
`aggregateToTimeframe(candleObjects.slice(pc.startIndex + 1, i + 1), 5)` — e esse recorte
tem no máximo `entryWaitCandlesFor(DAY_TRADE)` = 3 velas de 1m. `aggregateToTimeframe`
(S1/N3) só emite bucket com **5 velas completas**; 1–4 velas produzem **zero** velas de 5m.
`confirmEntry` R4 é *fail-closed* sem vela de 5m -> `confirmed: false` sempre ->
`entriesFilled = 0` sempre.

Reproduzido: `slice=1..4 velas 1m -> klines5m=0 -> ["R4 trend: vela de 5m real ausente
(fail-closed)"]`; `slice=5 -> confirmed=true`.

**Por que isso só apareceu agora:** a função antiga `aggregateTo5m` (removida em S1)
aceitava chunks **parciais** — 1 vela de 1m virava uma "vela de 5m" fabricada. O bug
disfarçava o problema: R4 recebia uma vela 5m sempre presente e o braço B preenchia
(1524 preenchimentos no run de 2026-10-03). S1 corrigiu a agregação e, ao remover a
fabricação, expôs a incompatibilidade entre a janela de espera (3 velas) e a exigência de
5 velas completas do R4.

**Não é bug do live:** `server.ts:512` busca a 5m **real** da exchange
(`fetchKlines(symbol, '5m', 2)`), então o R4 em produção tem a vela que precisa. É
específico do backtest.

**Correção proposta (NÃO aplicada — muda número de decisão):** alimentar o R4 com a série
de 5m já agregada e **já fechada** no instante `i` (a mesma `aggregated5mForValidation` +
cursor monotônico já usados na validação MTF do sinal, `BacktestEngine.ts:757-764`), em vez
de re-agregar o recorte pós-sinal. Assim o backtest passa a usar 5m derivada das 1m do
histórico com a mesma linha de "não lookahead" do resto do motor, e o braço B volta a
poder preencher.

**Enquanto N6 não for corrigido:** o veredito "MANTER DESLIGADA" vale como decisão
conservadora e é o estado correto do código, mas `docs/evidence/entry-confirmation-comparison-2026-10-04.md`
**não** deve ser lido como evidência de que a confirmação de entrada não tem edge — ele só
demonstra que o braço B está inoperante no backtest. Nenhum aceite do dono (E1) deve ser
registrado com base nele.

## Como rodar o aceite do dono (E1)

```bash
npm run compare:entry -- --universe --register \
  --accept-negative-expectancy --reason "edge pareado confirmado; aceito para observacao"
```

Sem a flag, nada muda. `--reason` sozinho **não** habilita o aceite — aceite implícito
seria exatamente o atalho que a regra v2 existe para impedir. Com a flag, o motivo (d)
passa a citar o aceite no relatório e o `entry-confirmation-verdict.json` grava
`ownerAcceptance` (`null` quando ninguém aceitou), tornando a afirmação verificável por
terceiros.