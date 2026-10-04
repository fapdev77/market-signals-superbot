# SDD — Fase 10: honestidade das métricas e integridade do enforcement

> Especificação para implementação sob TDD/SDD. Cada item traz **contrato**, **critérios de
> aceitação verificáveis** e **ordem**. Nenhum item começa sem o teste vermelho correspondente.
>
> Origem: auditoria completa do `market-signals-superbot` (11 achados). Estado na abertura:
> CRÍTICOS 1–2 e ALTOS 1–3 fechados em `61f1e82` (10 arquivos, 5 guards novos, 760 testes verdes).
> Restam **16 itens** + 3 pendências de escopo.

---

## Princípio que governa esta fase

Quatro dos oito MEDIUM restantes são o **mesmo defeito** sob nomes diferentes:

> uma métrica que não pôde ser medida devolve um número plausível, e o consumidor não
> tem como distinguir "medi 0" de "não medi".

`mfeR: 0` (M1), `cumulativeR: 0` (M2), `avgRiskRatio` do preset (M4), `sortinoRatio 4.5`
(M8), `profitFactor 9.9` (M8), `reducedFactorSet: true` hardcoded (M7). Todos da mesma
família. A correção também é única: **quando a medição é indefinida, o campo é `null` e o
relatório diz "n/d"**. Nenhum lote desta fase pode introduced constante inventada para
substituir dado ausente.

O segundo princípio herdado da Fase 9: **fail-closed**. Um controle que não pode avaliar
a condição bloqueia, não aprova.

---

## Achado novo No lote 0 (não previsto na auditoria original)

Com CRÍTICO-1 corrigido (dimensionamento por risco), a estratégia na fixture de paridade
passou a **expectativa negativa a 1% de risco**:

| Métrica | Antes (publicado) | Depois (corrigido) |
|---|---|---|
| `netProfit` | 6.52 | **−12.13** |
| `maxDrawdown` | 3.71% | **18.25%** |
| `profitFactor` | 1.63 | **0.52** |
| `sharpeRatio` | 11.0 | **0.20** |

Causa: os stops da fixture são de **0,1%–0,3%** de distância, não 1,2%–4% como a auditoria
assumia. Dimensionar 1% de equity contra um stop de 0,2% compromete 5–10× o capital. A
premissa da auditoria (100% do notional) estava **sub**-estimando a exposição.

**Os números publicados em `docs/evidence/` estão desatualizados e descrevem um sistema que
não existe mais.** A regra 8.2.4 proíbe editar `entry-confirmation-verdict.json` à mão.

### Decisão do usuário

**Regenerar via `npm run compare:entry` e reclassificar a decisão como `no-go`.** O verdict
é gerado, não escrito. A reconciliação honesta é registrar que a estratégia falha o gate.

> **Bloqueio:** `compare:entry` depende de rede (klines reais da Binance). Não executável
> nesta sessão. O Lote 0 fica aberto até que a rede esteja disponível.

**Consequência para o Lote 1:** as métricas que ele restaura (`avgMfe`/`avgMae`,
`cumulativeR`) são exatamente as que alimentam essa decisão. Executar o Lote 1 **antes**
de `compare:entry` é a ordem correta — mas o Lote 0 não é pré-requisito técnico do Lote 1,
apenas da *interpretação*.

---

## Ordem de execução (decidida)

```
L4  HIGH-4   Rate limit de IA declarado e nunca aplicado
L1  M1 + M2  Métricas de evidência que reportam 0 como se fossem medição
L3  M6 → M5  Suíte dos núcleos de decisão, depois contrato de risco
L2  M3 M4 M7 M8   Métricas que mascaram dado ausente com constante inventada
P   Portfólio no backtest (maxConcurrentSignals + evaluatePortfolioRisk)
L5  L1       Extração do BacktestEngine
L0  Regenerar docs/evidence via compare:entry  (bloqueado: requer rede)
```

**L4 primeiro por decisão do usuário**, não por dependência técnica — nenhum dos quatro
lotes o bloqueia. É o único HIGH restante e o controle efetivo hoje é mais frouxo que o
declarado.

**L3 antes de L2** porque a suíte de caracterização (M6) é o que permite alterar o
`BacktestEngine` (L2) com confiança. **L2 antes de L5** porque o `BacktestEngine` é o
arquivo mais tocado da fase e a extração multiplica o custo de cada correção posterior.

### Custo

| Lote | Itens | Estimativa | Depende |
|---|---|---|---|
| L4 | HIGH-4 | ~2h | — |
| L1 | M1, M2 | ~1h | — |
| L3 | M6, M5 | ~3h | — |
| L2 | M3, M4, M7, M8 | ~2h | L3 |
| P | portfólio | ~1 dia | L2 |
| L5 | L1 | ~3h | L2 |
| L0 | evidência | bloqueado | rede |

Núcleo: **~11h**. Cada lote fecha com `npm run typecheck` + `npm test` + `npm run build` e
um commit Conventional próprio — lotes nunca misturados, porque a prova do vermelho precisa
ser reproduzível por lote.

---

## L4 — HIGH-4: rate limit de IA declarado e nunca aplicado

### Problema

`rateLimit: { maxReqPerMinute, maxReqPerDay }` é declarado em quatro lugares
(`aiMotor.ts:118`, `db.ts:980/995/1011/1022`) e validado em `validation.ts:98-99`
(`z.number().min(1)`). **Nenhum consumidor no runtime.** O único controle real é o limiter
de rota em `app.ts:127` (45/min agregado em `/api/ai`).

Isso é pior do que "não implementado": o controle efetivo (45/min agregado) é **mais
permissivo** que os limites declarados por modelo (`m2` = 15/min, `m4` = 100/min). O
sistema afirma uma contenção de custo que não existe, e a que existe é mais frouxa que a
anunciada.

### Contrato

Enforcement no **caminho de dispatch**, não na camada HTTP. Um rate limit por modelo pertence
ao motor de IA; um limiter de rota não conhece qual modelo foi resolvido dentro da cadeia de
fallback. `generateContentWithModel` (`aiMotor.ts:142`) é o único ponto por onde passam as
três entradas (`reviewSignalWithAI`, `auditMarketWithAI`, `chatWithAITrader`) e é onde a
contagem deve ocorrer.

Decisão de desenho: **contador persistido**. Contador em memória reinicia com o processo, o
que torna o limite de custo um bypass trivial. Para um controle cujo propósito é gastar
menos, reiniciabilidade é falha.

### Critérios de aceitação

```
RED  tests/aiRateLimitEnforcement.test.ts
  - 3 chamadas no mesmo minuto em modelo com maxReqPerMinute=2
      → 3ª lança AIRateLimitError com retryAfterSeconds > 0
      → hoje: todas passam (não existe enforcement)
  - estouro de maxReqPerDay no mesmo dia → rejeita
  - limite é POR MODELO: 2 req no m1 + 2 req no m4 não esgota o m1
  - a janela reseta (relógio injetado): passado 60s, volta a permitir
  - a cadeia de fallback não contorna o limite do modelo que falhou
  - failover para o próximo modelo da cadeia só ocorre DEPOIS de contabilizar
GREEN enforcement em generateContentWithModel, antes de qualquer fetch
     consumo persistido (sobrevive a restart do processo)
```

### Notas de implementação

- `aiLogsStore` (`aiLogger.ts`) é in-memory e limitado a 200 entradas — **não serve** como
  fonte de contagem. Um dia com 10.000 requisições trunca o histórico.
- Novo erro de domínio `AIRateLimitError` distingue "estourou limite" de "chamada falhou",
  para que a cadeia de fallback não treata limite estourado como erro do modelo e escada
  para o próximo provider — o que seria outro bypass.
- Tabela nova em `getDb()` (`ai_rate_usage`) seguindo o padrão de `ai_audits`. Sem migration
  versionada: o schema de `getDb()` é baseline `CREATE TABLE IF NOT EXISTS`.

---

## L1 — M1 + M2: métricas de evidência que reportam 0 como se fossem medição

### Problema

`db.ts:1942-43` grava `mfeR: 0, maeR: 0` literal ao fechar sinal.
`calculateMfeMaeFromCandles` (`EvidenceService.ts:276`) existe, está correta, e **nunca é
chamada** — nenhuma referência fora da própria definição (verificado por grep).

Consequência: `/api/evidence/calibration` reporta `avgMfe`/`avgMae` sempre `0.0000`, e
`evidenceRoutes.ts:69` monta `cumulativeR: 0` forçado. Quem lê o relatório de calibração
conclui que a estratégia nunca teve follow-through favorável e nunca teve drawdown — duas
afirmações fortes que o sistema não mediu.

### Contrato

`calculateMfeMaeFromCandles` passa a ser chamada no fechamento do sinal, alimentada pelas
velas do intervalo em que o sinal ficou aberto. `cumulativeR` passa a ser a soma dos `netR`
da janela, derivada da mesma fonte.

M1 antes de M2 porque M2 é a *fonte* que M1 precisa produzir — fazer juntos evita um estado
intermediário em que a rota soma um campo ainda não medido.

### Critérios de aceitação

```
RED  tests/evidenceMfeMae.test.ts
  - fixture: LONG fechado, stop a 0,4% abaixo da entrada, velas com
    high +0,8% e low −0,2%  →  mfeR 2.0, maeR −0.5
  - getClosedSignalsEvidence() devolve mfeR/maeR calculados (hoje: 0)
  - /api/evidence/calibration devolve avgMfe/avgMae != 0
  - cumulativeR == Σ netR da janela (hoje: 0)
  - SHORT inverte os sinais (mfeR positivo quando preço CAI)
  - sem velas no intervalo → { mfeR: 0, maeR: 0 } + log; fail-closed, não inventar
GREEN db.ts:1942 → calculateMfeMaeFromCandles(signalParams, velasDoLedger)
     evidenceRoutes.ts:69 → soma dos netR da janela
```

### Risco único do lote

O ledger tem `events` com timestamp, mas **cabe confirmar se há OHLC persistido** do
intervalo aberto. `calculateMfeMaeFromCandles` exige `CandleRangeRecord[]`. Se não houver
OHLC persistido, M1 exige migration de schema e **muda de lote** — nesse caso o
`db.ts:1942` permanece literal e o honesto é declarar o campo ausente (`null`) no schema de
resposta em vez de continuar reportando `0`.

---

## L3 — M6 (suíte) → M5 (contrato)

### M6: núcleos de decisão sem suíte

`TickProcessor` e `EvidenceService` não têm suíte dedicada. Existem testes indiretos
(`tickTradfiGate`, `tickWeightBudget`, `evidenceSummary`, `evidenceDenominator`), mas
nenhum sobre `resolveMarketInputs:103` nem `evaluatePositionManagement:163` — que é onde o
sistema decide entrada e gestão de posição.

### M5: nome e unidade divergem do contrato

`signalRiskPct` (`RiskManager.ts:127`) retorna a **distância do stop em %**, não o risco
aberto. O nome promete unidade de risco; o consumidor (`evaluatePortfolioRisk:162`) compara
esse valor contra um limiar de portfolio, e a soma dos "riscos" é comparada contra
`maxTotalRiskPct`. A premissa da auditoria aqui está correta e **não implementada**.

### Ordem

M6 primeiro. Sem suíte de caracterização, mudar contrato em `RiskManager` é mudança às
cegas. O guard de contrato nasce **junto** da mudança, não depois.

### Critérios de aceitação

```
RED  tests/tickProcessor.test.ts            (caracterização)
  - resolveMarketInputs: ticker STALE rejeita (fail-closed, :67-69)
  - feed misto: símbolo degradado não invalida o mercado (:113-115)
  - proveniência de feed preservada
  - evaluatePositionManagement: TP1 partial + stop no mesmo candle → ordem definida
RED  tests/riskManagerContract.test.ts
  - signalStopDistancePct(stop 0,3%) e risco aberto (1% de equity, notional 3,3x)
    são grandezas DISTINTAS — o teste prova que hoje são a mesma função
GREEN renomear signalRiskPct → signalStopDistancePct
     introduzir getter de risco aberto real
     evaluatePortfolioRisk passa a somar risco aberto
     atualizar consumidores
```

### O que M6 deve preservar (não quebrar)

- proveniência de feed (`TickProcessor.resolveMarketInputs:113-115`)
- quote STALE fail-closed (`:67-69`)
- calibração com encolhimento (`scoreCalibration.ts:133`, `n/(n+k)`)

---

## L2 — M3, M4, M7, M8: métrica que mascara dado ausente

### M3 — `annualFactor` mascara Sharpe não-anualizado

`BacktestEngine.ts:1085`: `annualFactor = Math.sqrt(Math.max(1, tradesPerDay * 252))`.
O `max(1, …)` cola o fator em 1 quando há poucos trades, e o resultado continua rotulado
`sharpeRatio`. Com 29 trades numa janela curta, `sqrt(29/dias × 252)` é ruído com
aparência de métrica anualizada.

### M4 — `avgRiskReward` herda o preset

`BacktestEngine.ts:1053`: `avgRiskReward = avgLossPct > 0 ? avgWinPct / avgLossPct : preset.targetRiskRatio`.
Com zero perdas, devolve o R-alvo do preset como se fosse R-realizado.

### M8 — duas constantes inventadas

`BacktestEngine.ts:1087`: `sortinoRatio = downsideDev > 0.0001 ? … : (meanReturn > 0 ? 4.5 : 0)`
`BacktestEngine.ts:1050`: `profitFactor = totalLoss > 0 ? … : totalProfit > 0 ? 9.9 : 0`

Uma estratégia com 100% de wins e zero perdas reporta PF 9.9 e Sortino 4.5 **sem ter medido
nenhum dos dois**. O segundo (`9.9`) não estava no achado original da auditoria — foi
encontrado na verificação deste plano, e é o mesmo defeito.

### M7 — `reducedFactorSet` sempre true

`BacktestEngine.ts:473/475`: `candlesWithOi: 0, candlesWithLongShort: 0` hardcoded →
`reducedFactorSet` é **sempre** `true`. O motor sempre reporta que rodou com conjunto
reduzido de fatores, independentemente dos dados, e nada no relatório distingue "realmente
reduzido" de "nunca instrumentado".

### Contrato único dos quatro

Medição indefinida → `null`. `assumptions[]` registra o motivo. O consumidor (UI/rotas)
renderiza "n/d". Nenhuma constante substitui ausência.

M7 vai por último do lote porque muda **semântica de campo de saída**, não só valor — o
schema de resposta precisa carregar `oiCoverageAvailable: false` como sinal explícito, e o
resto do lote não depende disso.

### Critérios de aceitação

```
RED  tests/backtestMetricIntegrity.test.ts
  - backtest só com wins (zero perdas)
      → profitFactor null, sortinoRatio null, avgRiskReward null
      → assumptions[] contém "n/d (0 perdas)" (hoje: 9.9 / 4.5 / preset.targetRiskRatio)
  - Sharpe com < 30 trades
      → campo carrega tradesUsed e isAnnualized: false
  - backtest sem perp nem long/short nas velas
      → reducedFactorSet true COM oiCoverageAvailable: false explícito
        (hoje: true, indistinguível de "realmente reduzido")
GREEN usar null em todas as branches de ausência
     ajustar o tipo do resultado
     propagar "n/d" aos consumers (rotas, UI)
     nomear o hardcode de M7
```

---

## P — Portfólio no backtest

CRÍTICO-1 corrigiu **sizing**, não **concorrência**. `maxConcurrentSignals` e
`evaluatePortfolioRisk` continuam ausentes da simulação: o backtest pode abrir posições
simultâneas que o live rejeitaria. Os números publicados são, por construção, otimistas.

Decisão do usuário: **entra neste lote**.

Escopo: aplicar `evaluatePortfolioRisk` sobre os sinais pendentes no loop do motor, com os
mesmos limites que o live (`getRiskLimits()`), e barrar emissão quando o portfolio exceder.
Fecha com re-run da fixture de paridade e diff contra os números de `61f1e82`.

~1 dia. Depende de L2 (métricas) porque o resultado precisa ser legível nas métricas
corretas antes de ser comparado.

---

## L5 — L1: extração do `BacktestEngine` (1.437 linhas)

Por último, deliberadamente. O arquivo é o mais tocado da fase. Extrair antes
transformaria cada correção seguinte em conflito de merge.

Duas unidades com fronteira natural:

1. **Bloco PENDING_ENTRY** (`~:640-830`) — entrada, saída e estado próprios; a correção N6
   já tocou este bloco duas vezes.
2. **Cálculo de métricas** (`~:1040-1180`) — puro, sem `await`, sem I/O. Concentra
   M3/M4/M7/M8.

Extrair **só a unidade 2 primeiro**: vira função pura testável sem infraestrutura e é onde
concentra a dívida. Custo ~3h, puramente mecânico, sem mudança de comportamento.

---

## Fora do lote, com motivo

| Item | Motivo |
|---|---|
| **L2** `ChartAndProfile.tsx` (2.358), `PaperTradingSandbox.tsx` (1.823), zero testes de componente | Dívida, não bug. Exige novo eixo no setup (jsdom + RTL) desproporcional ao valor. |
| **L3** `strategyAutoTuning` deletado mas citado em 3 comentários (`StrategyAutoTuner.tsx:23`, `apiClient.ts:347`, `types.ts:1000`) | Os comentários estão **corretos** — documentam que a versão anterior sorteava vitória/derrota. É rastro histórico desejado, não referência quebrada. **Não mexer.** |
| **L4** `dRound` (`decimal.ts:59`) | Dois defeitos reais: pass-through silencioso quando `decimals >= DECIMALS`, e `step/2n === 0n` quando `step === 1n` (arredondamento vira truncamento). Barato, mas é primitiva usada por todo o backtest — mexer depois de fechar os lotes que dependem dela. |
| **L5** DNS lookup sem ancorar no IP (TOCTOU) | Correção exige rewrite do agente HTTP. Risco real, escopo grande. |
| **L6** CSP report-only + `unsafe-inline` | Enforcing sem `unsafe-inline` quebra a UI. Decisão de produto, não de engenharia. |

---

## Pendência de escopo do CRÍTICO-2

Com entrada no preço-limite, um trade que resolve **no mesmo candle do fill** mede a
distância ao stop contra um preço que já o ultrapassou. O guard
`tests/backtestSlippageAccounting.test.ts` prova contabilidade e paridade live↔backtest,
**não** que o risco intra-candle do fill fica dentro do orçamento.

Fechar isso exige modelar o pior caso do candle e tornar explícita a ordem de prioridade
quando stop e alvo ocorrem no mesmo candle — que hoje é um pressuposto não escrito.

Não entra nos lotes acima (escopo escolhido pelo usuário: portfólio sim, caveat não).
Rastreado como item aberto.

---

## Regra de execução (herdada da Fase 9)

- Nenhum item começa sem o teste vermelho correspondente.
- Prova do vermelho pelo método já usado: aplicar fix, reverter o fix temporariamente, rodar,
  confirmar a falha, restaurar.
- **Nunca** afrouxar asserção, adicionar supressão de tipo ou engolir erro para fazer a
  verificação passar.
- Regra 8.2.4: `docs/evidence/entry-confirmation-verdict.json` nunca editado à mão.
- `tests/noFixturesInProduction.test.ts` reprova se `server/` citar `tests/`/`fixtures`.