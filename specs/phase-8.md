# Fase 8 — Integridade da evidência de backtest, fechamento da Fase 7 e `strict`

> **Criado em:** 2026-10-02 · **Base:** commit `b31b8ba` · **Status:** rascunho para revisão
> **Método:** SDD/TDD — Especificar → Planejar → Decompor → **Teste falhando primeiro** → Implementar → Validar. Cada item tem critérios de aceitação (CA) verificáveis e a lista de testes que devem existir antes do código.
> **Objetivo:** corrigir a base da decisão da 7.2 (métricas e desenho do experimento), fechar o que a Fase 7 deixou aberto, e só então congelar o motor e iniciar a janela de evidência. Incorpora o `docs/PLANO_FASE_8.md` (migração para `strict`) como marco 8.7.

---

## 1. Estado de partida (verificado no commit `b31b8ba`)

**Passa:** `tsc` limpo; 113 arquivos e 598 testes verdes; `npm run build` ok; `npm audit --omit=dev` com 0 vulnerabilidades; `npm ci` limpo em cópia do commit; `verify:lock` com 221/221 integridades conferidas no registry; `bun.lock` ausente; CI com `verify:lock`, job `docker` e auditoria. Gate de qualidade: baseline 161 `any` e 8 `catch` vazios, atual 150 e 7 (o `PLANO_FASE_8.md` cita 167; alinhar).

**Fase 7, situação por marco**

| Marco | Situação |
|-------|----------|
| 7.0 Desbloqueio | ✅ no código; execução do job `docker` e exigência de CI verde para merge **não verificadas** |
| 7.1 Higiene TradFi | ✅ sem referência a `fixtures` em `server/`, lista configurável com teto, último registro bom por 24 h e alerta, testes de matriz de comportamento. ⚠️ não encontrei a métrica `binanceUsedWeight1m` pedida na 7.1.3 |
| 7.2 Confirmação de entrada | ⚠️ **decisão registrada sobre evidência defeituosa** (seção 2) |
| 7.3 Ledger | ✅ retry/alerta de `EXPIRED` com teste. ⚠️ não encontrei `LEDGER_RECONCILE_INTERVAL_MS` nem `ledgerInvariantViolations` com esses nomes (os testes existem; conferir se a implementação cobre a spec) |
| 7.4 Prova operacional | ❌ `docs/evidence/` só tem README, decisão e comparação: **faltam** logs de smoke, `audit:universe` e captura; `BacktestScheduler` sem guardas (só chama a cobertura de funding); sem `fundingSyncLastRunAt`; sem os testes `backtestSchedulerGuards` e `fundingSyncSchedule` |
| 7.5 Simulacro | ❌ nenhum arquivo `drills-*` |
| 7.6 Acabamento | ✅ rótulos de UI sem `fstream`, CSP enforce implementada (padrão `false`), decimal presente no backtest, metas de qualidade atingidas |
| 7.7 Evidência | ❌ não iniciada: **nenhuma tag** (`engine-freeze-*`, `evidence-start`) |

**Não verificado:** acesso real à Binance (sandbox bloqueado), frontend, execução do CI no GitHub, se o Docker builda, a matemática interna do `BacktestEngine` além dos pontos citados.

## 2. Achado crítico: a decisão da 7.2 não se sustenta

Relatório `docs/evidence/entry-confirmation-comparison-2026-10-02.md` (BTCUSDT, 30 dias):

| Problema | Evidência |
|----------|-----------|
| **Os dois braços perdem dinheiro.** | Expectativa líquida por sinal emitido: controle **−1,2221 R**, com confirmação **−0,5255 R**. A regra da 7.2.3 só compara os braços; "melhora" de −1,22 para −0,53 R virou "LIGAR a flag". |
| **Experimento não é pareado.** | 427 sinais emitidos no controle contra 538 com confirmação. O bootstrap trata os dois como amostras independentes de tamanhos diferentes. |
| **Contagem de trades inconsistente.** | Controle: 427 preenchidos e 550 "fechados". Com confirmação: 297 preenchidos e 406 "fechados". Fechados > preenchidos indica que `totalTrades` conta pernas ou resultados, e não posições; o win rate herda a ambiguidade. |
| **Documento de decisão contradiz o relatório.** | `decision-entry-confirmation.md` diz "406 trades preenchidos"; o relatório diz 297. |
| **Amostra estreita.** | Um símbolo, um período de 30 dias, vela de 5m agregada de 1m (limitação declarada). |
| **Congelamento sem tag.** | A flag já está `true` em `.env.example`, mas não existe tag `engine-freeze-*`, violando o CA-2.5 e o gate da própria spec. |
| **README admite correção recente.** | A nota diz que o comparativo só vale depois do conserto do fechamento de posição do runner, mas os números continuam com fechados > preenchidos. |

**Consequência:** a decisão é tratada como **provisória**. Um backtest com expectativa de −0,5 R por sinal também exige diagnóstico (custos contra tamanho do stop, contabilidade por perna) antes de qualquer alegação. Isso não impede operar o ledger em paper trading, que é justamente o teste real, mas impede dizer que o motor está pronto.

## 3. Escopo

**Dentro:** 8.0 a 8.8. **Fora:** camada de execução de ordens, multi-exchange, troca de banco, multiusuário, redesenho de UI.

## 4. Inventário de gaps

| Ref | Gap | Sev. | Marco |
|-----|-----|------|-------|
| J-01 | `totalTrades` mistura pernas e posições; win rate ambíguo | 🔴 | 8.0 |
| J-02 | R sem decomposição (bruto, taxa, slippage, funding) | 🔴 | 8.0 |
| J-03 | Expectativa negativa nos dois braços sem diagnóstico | 🔴 | 8.1 |
| J-04 | Experimento da 7.2 não pareado, amostra de 1 símbolo, regra só relativa | 🔴 | 8.2 |
| J-05 | Decisão com números inconsistentes; flag ligada sem tag de congelamento | 🟠 | 8.2 |
| J-06 | Evidências da 7.4 ausentes (smoke, universo, captura) | 🟠 | 8.3 |
| J-07 | `BacktestScheduler` sem guardas | 🟠 | 8.3 |
| J-08 | Sem `fundingSyncLastRunAt` nem teste de agendamento | 🟡 | 8.3 |
| J-09 | `binanceUsedWeight1m` e orçamento de peso não encontrados | 🟡 | 8.3 |
| J-10 | Reconciliação periódica e invariantes do ledger com nomes diferentes da spec **[VALIDAR]** | 🟡 | 8.3 |
| J-11 | Simulacro de produção (D-1 a D-8) não executado | 🟠 | 8.4 |
| J-12 | Motor sem tag; janela de evidência não iniciada | 🔴 | 8.5 |
| J-13 | CSP em imposição desligada; job `docker` e CI obrigatório não comprovados | 🟡 | 8.6 |
| J-14 | `strict: true` ausente (plano existe em `docs/PLANO_FASE_8.md`) | 🟡 | 8.7 |
| J-15 | Sem teste de fumaça ponta a ponta (tick → sinal → ledger → resumo) | 🟡 | 8.8 |

---

## 5. Especificação por marco

### 8.0 — Integridade das métricas do backtest (J-01, J-02)

**Requisitos**
- **8.0.1 Unidades separadas.** `BacktestResult` passa a distinguir `legs` (pernas/eventos de saída), `positionsClosed` e `positionsFilled`. `totalTrades` fica como sinônimo explícito de `positionsClosed`. Win rate e expectativa são por **posição**; o win rate por perna fica em campo separado, rotulado.
- **8.0.2 Decomposição de R.** Cada posição guarda `rGross`, `rFees`, `rSlippage`, `rFunding` e `rNet = rGross − rFees − rSlippage − rFunding` (decimal). O resultado agrega as quatro médias e informa o custo médio em R.
- **8.0.3 Invariantes.** `positionsClosed ≤ positionsFilled ≤ signalsEmitted`; soma das pernas igual ao PnL da posição; nenhuma posição aberta ao fim do período sem marca a mercado declarada.
- **8.0.4** Atualizar `entryConfirmationComparison.ts` e o relatório para usar as novas contagens, e corrigir o `docs/evidence/README.md`.

**Critérios de aceitação**
- CA-0.1 Cenário de fixture com 1 posição, parcial no TP1 e runner no TP2 devolve `positionsClosed = 1` e `legs = 2`.
- CA-0.2 Teste de propriedade: para sequências aleatórias com semente, `rNet` iguala a soma decimal das pernas menos custos, e os invariantes da 8.0.3 valem.
- CA-0.3 Um exemplo calculado à mão (valores que quebram ponto flutuante) reproduz `rGross`, `rFees`, `rSlippage` e `rFunding` exatos.
- CA-0.4 Nenhum relatório mostra "fechados" maior que "preenchidos".

**Testes primeiro:** `tests/backtestPositionCounting.test.ts`, `tests/backtestRDecomposition.test.ts`, `tests/backtestInvariants.test.ts`.
**Arquivos:** `server/services/BacktestEngine.ts`, `server/services/positionResolution.ts`, `src/types.ts`, `server/services/entryConfirmationComparison.ts`.

---

### 8.1 — Diagnóstico do edge (J-03)

**Requisitos**
- **8.1.1 Experimento amplo.** `npm run diagnose:edge`: universo definido por configuração (padrão: os 10 símbolos de maior volume em `TRADING` mais a lista TradFi monitorada), período máximo permitido pelos dados reais, vela de 1m real onde existir. Fatores com janela limitada (OI e long/short) ficam marcados em `factorCoverage` e `reducedFactorSet`.
- **8.1.2 Saídas** em `docs/evidence/edge-diagnosis-<data>.md`: expectativa bruta e líquida por símbolo, por faixa de score, por regime (tendência/lateral, volatilidade), por sessão TradFi; custo médio em R contra distância média do stop; distribuição do tamanho do stop em % do preço; tradeoff de `MAX_STOP`.
- **8.1.3 Walk-forward** com holdout intocado (usa o auto-tune de 3 partes da Fase 6) e IC bootstrap da expectativa líquida **fora da amostra**.
- **8.1.4 Veredito pré-registrado** *(proposto, a aprovar antes de rodar)*: o motor só é declarado "apto para janela de evidência" se a expectativa líquida fora da amostra tiver limite inferior do IC de 95% > 0 em pelo menos 60% dos símbolos testados com n ≥ 30 posições. Caso contrário, o relatório indica a causa dominante (custo, stop, sinal) e a janela só começa com **aceite explícito e registrado do dono** de que o resultado é experimental.

**Critérios de aceitação**
- CA-1.1 Mesma entrada e semente produzem relatório idêntico (teste de determinismo).
- CA-1.2 O relatório traz a decomposição de custos da 8.0.2 por símbolo e por faixa, e o veredito calculado por função pura testada nos limites (59% contra 60% dos símbolos).
- CA-1.3 Todo resultado com fator em cobertura parcial exibe `reducedFactorSet: true`.

**Testes primeiro:** `tests/diagnoseEdgeDeterministic.test.ts`, `tests/edgeVerdictRule.test.ts`, `tests/diagnoseEdgeCoverage.test.ts`.
**Arquivos:** `scripts/diagnose-edge.ts`, `server/services/EdgeDiagnosisService.ts` (novo), `docs/evidence/*`.

---

### 8.2 — Decisão da confirmação de entrada refeita (J-04, J-05)

**Requisitos**
- **8.2.1 Pareamento real.** O braço com confirmação processa **o mesmo fluxo de sinais** do controle (mesmo `signalId`); cada sinal tem resultado nos dois braços (preenchido ou não, com R = 0 quando não preenche). Diferença calculada **por sinal**, e o bootstrap faz reamostragem em pares.
- **8.2.2 Regra pré-registrada v2** *(proposta, a aprovar antes de rodar)*: ligar a flag somente se (a) houver ao menos 30 posições preenchidas **por braço e no agregado**, (b) o limite inferior do IC de 95% da diferença pareada por sinal for > 0, (c) o drawdown do braço com confirmação não passar de 120% do controle e (d) a expectativa líquida absoluta do braço com confirmação seja ≥ 0 **ou** o dono registre o aceite explícito de ligar a flag mesmo com expectativa absoluta negativa, com o motivo.
- **8.2.3 Amostra.** Mesmos símbolos e período da 8.1, não apenas BTCUSDT.
- **8.2.4 Documento de decisão.** `decision-entry-confirmation.md` é regenerado com os números do relatório (sem digitação manual) e marcado `PROVISÓRIA` até a regra v2 passar. A flag em `.env.example` segue o veredito.
- **8.2.5 Congelamento.** Somente após o veredito, criar a tag `engine-freeze-<sha>`. O CI falha se `ENTRY_CONFIRMATION_ENABLED` do `.env.example` divergir do veredito registrado.

**Critérios de aceitação**
- CA-2.1 Para o mesmo conjunto de sinais, `signalsEmitted` é igual nos dois braços (teste).
- CA-2.2 O IC da diferença usa pares; com uma fixture em que os braços diferem em 10% dos sinais, o resultado bate com o cálculo manual.
- CA-2.3 A função de decisão cobre os limites (29 contra 30 posições; IC inferior 0 contra 0,001; drawdown 120% contra 121%; aceite do dono presente contra ausente).
- CA-2.4 Os números do documento de decisão são gerados pelo script e iguais aos do relatório (teste de consistência).
- CA-2.5 A tag `engine-freeze-*` existe e o teste de CI do padrão da flag passa.

**Testes primeiro:** `tests/entryComparisonPaired.test.ts`, `tests/entryDecisionRuleV2.test.ts`, `tests/decisionDocConsistency.test.ts`, `tests/flagMatchesDecision.test.ts`.
**Arquivos:** `server/services/entryConfirmationComparison.ts`, `server/services/entryDecisionRule.ts`, `scripts/compare-entry.ts`, `docs/evidence/*`.

---

### 8.3 — Fechamento da Fase 7 em código (J-06 a J-10)

**Tarefas do operador:** rodar e commitar em `docs/evidence/`: log do smoke de 2026-09-30 (linha de base), novo `npm run smoke:binance`, `npm run audit:universe` e a captura de fixtures (com `rateLimits`).

**Requisitos**
- **8.3.1 `BacktestScheduler`.** Usa o `BinanceRateLimiter` e `fetchWithFallback`; não roda com feed degradado nem fora da janela configurada; nunca concorre consigo mesmo; teto de símbolos e de peso por execução; falha dispara alerta; **não aplica pesos sozinho** (aplicação por ação explícita e auditada).
- **8.3.2 Funding.** Métrica `fundingSyncLastRunAt`, log por execução e agendamento diário testado com relógio falso.
- **8.3.3 Peso REST.** O limiter registra `x-mbx-used-weight-1m` das respostas e expõe `binanceUsedWeight1m` em `/api/system/metrics`. Orçamento: média ≤ 50% do limite `REQUEST_WEIGHT` do `exchangeInfo` real (não assumir o número) e alerta `RATE_LIMIT_BUDGET` a partir de 70%.
- **8.3.4 Ledger.** Confirmar (ou implementar) `LEDGER_RECONCILE_INTERVAL_MS` e a métrica `ledgerInvariantViolations`, com os nomes da spec ou com a documentação do nome real.
- **8.3.5** `docs/evidence/README.md` atualizado apontando os arquivos reais.

**Critérios de aceitação**
- CA-3.1 `docs/evidence/` contém as quatro saídas com data.
- CA-3.2 Testes do scheduler: passa pelo limiter, pula com feed degradado, não concorre, respeita o teto, alerta em falha, não altera pesos.
- CA-3.3 Com relógio falso, a sincronização de funding roda uma vez por dia e atualiza a métrica.
- CA-3.4 Com respostas simuladas de header, a métrica de peso reflete o valor e dispara alerta em 70%.
- CA-3.5 A reconciliação periódica corrige um sinal em até um intervalo e `ledgerInvariantViolations` volta a 0.

**Testes primeiro:** `tests/backtestSchedulerGuards.test.ts`, `tests/fundingSyncSchedule.test.ts`, `tests/usedWeightMetric.test.ts`, extensão de `tests/ledgerPeriodicReconcile.test.ts`.
**Arquivos:** `server/services/BacktestScheduler.ts`, `server/utils/binanceRateLimiter.ts`, `server/services/FundingCoverageTrigger.ts`, `server/db.ts`, `docs/evidence/*`.

---

### 8.4 — Simulacro de produção (J-11)

**Natureza:** operação. Cada ensaio é executado no servidor e registrado em `docs/evidence/drills-<data>.md` com procedimento, resultado esperado, trecho de log e resultado (passou/falhou/data).

| # | Ensaio | Esperado |
|---|--------|----------|
| D-1 | Corromper o arquivo do banco e reiniciar | Restaura backup válido ou recusa iniciar com mensagem clara |
| D-2 | Kill-switch ligado e reinício | Continua suspenso |
| D-3 | Relógio do servidor deslocado em mais de 2 s | Sistema degradado e alerta `CLOCK_DRIFT` |
| D-4 | Rotacionar `API_AUTH_TOKEN` | Token antigo recebe 401 |
| D-5 | Bloquear o host `fapi` no firewall | Feed degradado, alerta, nenhum sinal novo |
| D-6 | `kill -9` durante gravação do banco | Reinício com `quick_check` ok e ledger íntegro |
| D-7 | `POST /api/system/alerts/test` com canais reais | Mensagem chega |
| D-8 | Parar o processo com `HEARTBEAT_URL` | Serviço externo percebe a falta de pings |
| D-9 | Alterar a lista TradFi e reiniciar com `exchangeInfo` bloqueado | Registro vazio, nenhum sinal TradFi e alerta `TRADFI_REGISTRY_UNAVAILABLE` |

**CA-4.1** Todos os ensaios com "passou" ou com problema aberto e priorizado. **CA-4.2** `docs/OPERATIONS.md` ajustado ao que os ensaios revelarem (hoje não há seção de ensaios).

---

### 8.5 — Congelamento e janela de evidência (J-12)

**Natureza:** operação. Depende de 8.0 a 8.4 fechados e da tag do 8.2.5.

**Requisitos**
- **8.5.1 Burn-in de 7 dias** (não conta): verificar alertas, reconciliação, saúde dos feeds, consumo de peso e `ledgerInvariantViolations = 0`.
- **8.5.2** Tag `evidence-start`. Qualquer mudança na lógica de sinais gera nova `engineVersion` e série separada.
- **8.5.3 Relatório semanal** por `/api/evidence/summary` e `/api/evidence/burnin-report`, com expirados por motivo, faixa de score, categoria e sessão TradFi, e agora também **custo médio em R** (decomposição da 8.0.2) para acompanhar se o live reproduz o backtest.
- **8.5.4 Go/no-go** (da Fase 5, adotado): n ≥ 100 sinais fechados e ≥ 60 dias; expectativa líquida ≥ +0,10 R com limite inferior do IC de 95% > 0; drawdown máximo ≤ 15 R; nenhuma faixa de score com expectativa negativa e n ≥ 30 permanece habilitada. Sem cumprir tudo, **não se faz alegação de desempenho**.
- **8.5.5** Calibração do score só depois dos limites do 8.5.4, por configuração auditada e nova série.

**Critérios de aceitação:** CA-5.1 tags `engine-freeze-*` e `evidence-start` existem e o ledger tem uma única `engineVersion` na janela. CA-5.2 relatório semanal gerado sem edição manual. CA-5.3 veredito go/no-go vem da função pura testada.

---

### 8.6 — Endurecimento final (J-13)

**Requisitos**
- **8.6.1** Com 7 dias de CSP report-only sem violações inesperadas, `CSP_ENFORCE=true` como padrão de produção; registrar o resultado.
- **8.6.2** Comprovar o job `docker` e o CI obrigatório para merge: salvar em `docs/evidence/` o identificador da execução verde e a captura da regra de proteção do branch.
- **8.6.3** Alinhar README, `OPERATIONS.md`, `SEGURANCA.md` e `.env.example` e atualizar o status final das specs 5, 6 e 7.

**CA-6.1** Cabeçalho `Content-Security-Policy` presente com a flag ligada (teste existente) e padrão atualizado. **CA-6.2** O CI do `main` está verde e a evidência foi commitada. **CA-6.3** Nenhuma spec contradiz o código (checklist manual).

---

### 8.7 — Migração para `strict` (J-14)

Segue o `docs/PLANO_FASE_8.md` (ondas 0 a 4), com as regras desta fase:
- **8.7.1** Ordem: `noImplicitAny` por diretório (folha → raiz), `catch` tipado com `unknown`, `Record<string, any>` → `unknown`, `any` de fronteira com `zod`, por fim `strictNullChecks` e `strict: true`.
- **8.7.2** Cada onda é um PR pequeno e reversível, com `tsc` limpo, suíte verde e baseline só descendo (alinhar o número do plano com `scripts/quality-baseline.json`).
- **8.7.3** **Não alterar lógica de sinais** durante a janela de evidência: ondas que toquem `signalEngine`, `TickProcessor`, `BacktestEngine` ou `positionResolution` só ocorrem antes da tag `evidence-start` ou criam nova `engineVersion`.

**CA-7.1** `strict: true` sem `@ts-ignore` ou `as any` novos. **CA-7.2** Baseline dentro da meta. **CA-7.3** O teste de fumaça da 8.8 verde.

---

### 8.8 — Teste de fumaça ponta a ponta (J-15)

**Requisitos:** um teste que sobe o `createApp()` com Binance simulado (fixtures só no teste) e percorre: tick → sinal → ledger (`ENTRY`) → resultado → `/api/evidence/summary`, e também o ramo de feed degradado (nenhum sinal) e o de TradFi fora de sessão (bloqueio).

**CA-8.1** O teste roda no CI e falha se qualquer elo do fluxo quebrar. **CA-8.2** O ramo degradado não deixa linha no ledger.

**Testes primeiro:** `tests/e2eSmokeSignalToEvidence.test.ts`.

---

## 6. Ordem de execução e gates

```
8.0 ─► 8.1 ─► 8.2 ─┐
8.3 ───────────────┼─► 8.4 ─► 8.5 (burn-in 7d + janela ≥ 60d)
8.6 e 8.8 em paralelo; 8.7 por ondas, respeitando o congelamento
```

**Gate entre marcos:** `npm ci` limpo, `tsc --noEmit`, suíte verde, `npm run build`, `npm audit --omit=dev`, `verify:lock`, CI verde (Node 20 e 22, job `docker`) e os CA do marco com testes que falharam antes. **8.5 só começa** com 8.0 a 8.4 fechados e a tag `engine-freeze-*`.

## 7. Riscos

| Risco | Mitigação |
|-------|-----------|
| Edge líquido negativo permanece depois da correção das métricas | Diagnóstico por componente (8.1); sem alegação; decisão explícita do dono |
| Dados limitam o período e os fatores históricos | `reducedFactorSet`, `factorCoverage` e janela live como prova principal |
| Pareamento por sinal ainda enviesa a comparação | Mesmo `signalId` nos dois braços e bootstrap em pares |
| Mudar a contagem de trades altera métricas antigas | Campo explícito por unidade; regenerar relatórios; nada de reuso de números antigos |
| Migração `strict` mexe em código de sinais | Regra 8.7.3 e `engineVersion` |
| Servidor local como ponto único de falha | Ensaios D-1 a D-9, heartbeat externo, backups |

## 8. Definição de pronto da fase

1. Todos os CA com testes que falharam antes da implementação.
2. `npm ci`, `tsc --noEmit` (com `strict` ao fim), `vitest`, `npm run build`, `npm audit --omit=dev` e `verify:lock` limpos; CI verde, inclusive `docker`.
3. Métricas de backtest por posição e decomposição de R em todos os relatórios; nenhum "fechados > preenchidos".
4. Decisão da confirmação de entrada refeita, sem inconsistência numérica, com tag `engine-freeze-*`.
5. `docs/evidence/` com smoke, universo, captura, diagnóstico de edge, comparação v2 e ensaios.
6. Janela de evidência iniciada com `evidence-start`.

## 9. Tarefas que só o operador executa

1. Rodar e commitar smoke, `audit:universe` e captura (com `rateLimits`).
2. Executar os ensaios D-1 a D-9 e registrar.
3. Aprovar as regras v2 (8.1.4 e 8.2.2) **antes** de rodar os experimentos.
4. Registrar o aceite explícito caso o veredito seja negativo e você queira operar em paper mesmo assim.
5. Ativar e comprovar CI obrigatório para merge.
6. Operar o burn-in e a janela de evidência.

## 10. Padrões assumidos (ajustáveis)

1. Universo do diagnóstico: 10 símbolos de maior volume mais a lista TradFi monitorada.
2. Veredito do edge: limite inferior do IC > 0 em 60% dos símbolos com n ≥ 30.
3. Regra v2 da confirmação de entrada: pares, IC inferior > 0, drawdown ≤ 120% do controle, expectativa absoluta ≥ 0 ou aceite do dono.
4. Orçamento de peso: 50%, alerta em 70%.
5. Reconciliação periódica a cada 15 minutos.
6. `CSP_ENFORCE=true` após 7 dias sem violações.

## 11. Referências

- `specs/phase-7.md`, `docs/PLANO_FASE_8.md`, `docs/evidence/*` e `docs/UNIVERSE.md`.
- Documentação oficial da Binance para derivativos USDⓈ-M: `https://developers.binance.com/docs/derivatives/usds-margined-futures`
