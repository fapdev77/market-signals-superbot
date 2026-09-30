# Plano de implementação — Fase 6 (decomposição de tarefas)

> Derivado de `specs/phase-6.md` (SDD). Formato da skill *planning-and-task-breakdown*.
> **Estado de partida verificado em 2026-09-30:** `tsc --noEmit` limpo · `vitest run` 57 arquivos / 350 testes verdes · `bun.lock` presente · `package-lock.json` **sem** `cors`/`@types/cors` · screener com métricas fabricadas + fallback spot.
> Regra de ouro: **cada tarefa entra com o teste falhando antes** (TDD) e fecha com `tsc` + `vitest` + `npm run build`.

## Decisões de arquitetura (herdadas do spec)
- **D1** — 6.0 e 6.1 antes de qualquer outro item.
- **D2** — formato SDD em `specs/`.
- **D3** — sql.js mantido; servidor local BR; TradFi sinaliza em `REGULAR`/`PRE_MARKET`/`AFTER_MARKET`.
- **Padrões da seção 10** (ajustáveis; confirmar na revisão): expirado fechado a mercado; sem ledger sem sinal (fail-closed); universo via `exchangeInfo`; RVOL real só top-60; regras de confirmação de entrada (6.7.1) são decisão do dono; `MAX_STOP_PCT` por estratégia; heartbeat opcional; congelamento do motor na janela.

---

## Fase 6.0 — Base reprodutível (G-01)

- [x] **T6.0.1 — Teste de higiene do repositório** (XS)
  - *CA:* `tests/repoHygiene.test.ts` falha se existir `bun.lock`/`bun.lockb` ou se uma dependência de `package.json` faltar em `package-lock.json`.
  - *Verificação:* teste vermelho antes do fix; verde depois. `npx vitest run tests/repoHygiene.test.ts`.
  - *Deps:* nenhuma. *Arquivos:* `tests/repoHygiene.test.ts`.
- [x] **T6.0.2 — Lock limpo + remoção do bun.lock** (S)
  - *CA:* `npm ci` roda em clone limpo; `.gitignore` ignora `bun.lock`/`bun.lockb`; README diz "somente npm".
  - *Verificação:* `npm install --package-lock-only`, `git rm bun.lock`, `npm ci`.
  - *Deps:* T6.0.1. *Arquivos:* `package-lock.json`, `.gitignore`, `README.md`.
- [x] **T6.0.3 — Conferir CI (Node 20/22 + audit)** (XS)
  - *CA:* CA-0.3 — CI roda `npm ci`, `tsc`, `vitest`, `build`, `audit --omit=dev` nas 2 versões.
  - *Deps:* T6.0.2. *Arquivos:* `.github/workflows/ci.yml`.

### Checkpoint A (após 6.0)
- [x] `tsc` limpo · **372 testes verdes (63 arquivos)** · `build` ok. (`npm ci` não verificável neste sandbox: `allow-remote=none`; lock reconciliado offline a partir do `node_modules/.package-lock.json`.)

---

## Fase 6.1 — Provas reais da Binance (G-02, G-03, G-04)

- [x] **T6.1.1 — Smoke completo com exit code** (M)
  - *CA:* CA-1.1 — falha em qualquer verificação obrigatória → saída 1. Inclui time, exchangeInfo (serverTime só informativo), tradingSchedule, fundingInfo, fundingRate, premiumIndex, openInterestHist, depth, klines 1m, WS `/market` + `/public` + `!forceOrder@arr`, peso `x-mbx-used-weight-1m`, via rate limiter.
  - *Teste primeiro:* `tests/smokeExitCode.test.ts` (fetch/ws mockados). *Arquivos:* `scripts/binance-smoke.ts`.
- [x] **T6.1.2 — Captura atômica de fixtures com `_meta`** (M)
  - *CA:* CA-1.2 (toda fixture tem `_meta.capturedAt`; exchangeInfo com `filters`) e CA-1.3 (falha mantém fixtures antigas e sai ≠ 0 — escrita em temp + swap só se tudo passar).
  - *Testes:* `tests/fixtureCaptureAtomic.test.ts`, `tests/fixturesIntegrity.test.ts`. *Arquivos:* `scripts/capture-binance-fixtures.ts`.
- [x] **T6.1.3 — Capturar fixtures reais e commitar** (M, operador)
  - *CA:* fixtures antigas substituídas; testes TradFi verdes ou ajustados ao real.
  - *Deps:* T6.1.2. *Arquivos:* `tests/fixtures/binance/*`.
- [x] **T6.1.4 — Mapeamento categoria → calendário (fail-closed)** (S)
  - *CA:* CA-1.4 — nenhuma categoria de `TRADIFI_PERPETUAL` do fixture fica sem chave ou sem registro "sem calendário".
  - *Teste:* `tests/tradfiScheduleMapping.test.ts`. *Arquivos:* `server/binanceService.ts`.
- [x] **T6.1.5 — Reconciliação do universo (787 × 987)** (M)
  - *CA:* CA-1.5 — `npm run audit:universe` gera `docs/UNIVERSE.md` com contagem real por grupo e a fonte do universo.
  - *Arquivos:* `scripts/audit-universe.ts`, `docs/UNIVERSE.md`, `package.json` (script).
- [x] **T6.1.6 — Baseline de evidência do smoke** (XS)
  - *CA:* log do smoke de 2026-09-30 commitado em `docs/evidence/`.

### Checkpoint B (após 6.1)
- [x] Smoke real: `EXIT=0`, 12 verificações, peso 51 · 7 fixtures reais com `_meta`+`filters` · `docs/UNIVERSE.md` gerado · baseline em `docs/evidence/binance-smoke-2026-09-30.log`.

---

## Fase 6.2 — Integridade da evidência (G-05, G-06, G-07, G-08)

- [x] **T6.2.1 — Evento `EXPIRED` em toda transição ACTIVE→EXPIRED** (M)
  - *CA:* CA-2.1 — após sweep de TTL o ledger tem `EXPIRED` com `reason` e o resumo conta o sinal; fechamento a mercado pelo último preço, mesmo taxas/slippage.
  - *Teste:* `tests/ledgerExpired.test.ts`. *Arquivos:* `server/db.ts`, `server/services/EvidenceService.ts`.
- [x] **T6.2.2 — Sessão e categoria no ledger** (S)
  - *CA:* CA-2.2 — migração adiciona `tradfi_category`; resumo agrega por sessão **e** por categoria separadamente.
  - *Teste:* `tests/ledgerTradfiSession.test.ts`. *Arquivos:* `server/migrations/index.ts`, `server/db.ts`, `server/services/EvidenceService.ts`.
- [x] **T6.2.3 — Escrita transacional / fail-closed** (M)
  - *CA:* CA-2.3 — falha simulada na gravação do ledger ⇒ sinal não emitido + exatamente 1 alerta; eventos posteriores com 3 tentativas/backoff.
  - *Teste:* `tests/ledgerTransactional.test.ts`. *Arquivos:* `server.ts`, `server/db.ts`.
- [x] **T6.2.4 — Reconciliação no boot** (M)
  - *CA:* CA-2.4 — `reconcileLedgerWithSignals()` cria evento retroativo `reconciled`; rodar 2× não duplica.
  - *Teste:* `tests/ledgerReconcile.test.ts`. *Arquivos:* `server.ts`, `server/db.ts`.
- [x] **T6.2.5 — Denominador completo** (M)
  - *CA:* CA-2.5 — 10 alvos + 10 expirados a preço de entrada ⇒ win rate 50% (nunca 100%); `expiredCount`/`expiredShare` e quebra por motivo.
  - *Teste:* `tests/evidenceDenominator.test.ts`. *Arquivos:* `server/services/EvidenceService.ts`.
- [x] **T6.2.6 — Contexto de reprodutibilidade por emissão** (S)
  - *CA:* CA-2.6 — toda linha nova do ledger tem `engineVersion` (hash do commit), `weightsHash` e perfil.
  - *Arquivos:* `server/db.ts`, `server.ts`.

### Checkpoint C (após 6.2) — ✅ 2026-09-30
- [x] Ledger sem viés de sobrevivência · reconciliação idempotente · fail-closed testado. (`tsc` limpo · **68 arquivos / 389 testes verdes** · `build` ok.)

#### Notas de implementação (6.2, 2026-09-30)
- **6.2.1:** razões canônicas `TTL`/`STRATEGY_RESET`/`MANUAL_RESET` mapeadas dos textos existentes; fechamento a mercado usa o último preço de `ticker_snapshots` (fallback: `current_price` → `entry_min`), com parcial já computada pelo cálculo de R existente. O sweep em si é fail-open (o sinal já está EXPIRADO); eventos perdidos são cobertos pela reconciliação no boot. `expireStaleSignals` agora retorna a quantidade **real** expirada (antes contava antes do UPDATE).
- **6.2.2/6.2.3:** `saveSignalAndLedger()` grava `trade_signals` + ledger + ENTRY num único `BEGIN/COMMIT/ROLLBACK`. Falha ⇒ sinal NÃO emitido, exatamente 1 alerta (`ledger_write_failure`, dedup injetável), símbolo marcado degradado e métrica `ledger_write_failures`. Eventos posteriores via `recordEventWithRetry` (3 tentativas, backoff exponencial). **Correção de bug aproveitada:** o `server.ts` gravava a CATEGORIA do ativo em `tradfi_session`; agora grava a sessão calculada e a categoria vai para a coluna própria.
- **6.2.2:** migração `010-ledger-evidence-integrity` (v10) adiciona `tradfi_category`, `engine_version`, `weights_hash`, `strategy_profile` + índice de reconciliação.
- **6.2.4:** `reconcileLedgerWithSignals()` mapeia `TARGET_REACHED→TARGET2`, `STOPPED_OUT→STOP`, `EXPIRED→EXPIRED`, cria retroativo com `reconciled: true`, idempotente (2ª passada cria 0); chamada no boot do `server.ts`.
- **6.2.5:** evidência carrega `outcomeType`/`expiredReason`; resumo expõe `expiredCount`, `expiredShare` e `expiredByReason`. Expirado a preço de entrada é perda líquida (custos), nunca vitória.
- **6.2.6:** `engineVersion` de `ENGINE_VERSION`/`GIT_COMMIT_SHA` (env) com fallback `git rev-parse --short HEAD`; `weightsHash` = FNV-1a dos pesos; `strategyProfile` = `multi:<habilitadas>` ou `single:<ativa>`.
- Métricas novas: `ledger_write_failures`, `signals_suppressed_ledger_failure`.

---

## Fase 6.3 — Funding real (G-09)

- [x] **T6.3.1 — `FundingSyncService` paginado e idempotente** (M)
  - *CA:* CA-3.1 — >1000 registros paginam e gravam; 2ª execução não duplica. *CA-3.4* respeita limiter.
  - *Testes:* `tests/fundingSyncPaging.test.ts`, `tests/fundingSyncIdempotent.test.ts`. *Arquivos:* `server/services/FundingSyncService.ts` (novo), `server/backtest_db/index.ts`.
- [x] **T6.3.2 — `rateType` por registro** (S)
  - *CA:* validar na fixture real; coluna por migração se faltar. *Arquivos:* `server/migrations/index.ts`, `FundingService.ts`.
- [x] **T6.3.3 — Gatilhos de sincronização** (S)
  - *CA:* antes de cada backtest cobre o intervalo; diário para monitorados com orçamento/minuto.
- [x] **T6.3.4 — Backtest cobra funding real por trecho** (M)
  - *CA:* CA-3.2/3.3 — soma exata dos registros da janela, `fundingCoverage` correto; trecho sem dado usa taxa fixa e declara em `assumptions`.
  - *Teste:* `tests/backtestFundingCoverage.test.ts`. *Arquivos:* `server/backtest_db/index.ts`, `server/services/BacktestEngine.ts`.
- [x] **T6.3.5 — R do ledger desconta funding real** (M)
  - *CA:* CA-3.5 — sinal atravessando 2 eventos bate o cálculo manual em decimal.
  - *Teste:* `tests/ledgerFundingR.test.ts`.

### Checkpoint D (após 6.3) — ✅ 2026-09-30
- [x] `historical_funding` alimentada · backtest com cobertura real · R com funding. (`tsc` limpo · **72 arquivos / 400 testes verdes** · `build` ok.)

#### Notas de implementação (6.3, 2026-09-30)
- **6.3.1:** `server/services/FundingSyncService.ts` novo — paginação por `startTime` com `limit=1000` (máximo do endpoint), avançando estritamente além do último registro recebido; gravação idempotente via `INSERT OR REPLACE` na chave única `symbol+funding_time` (migração 007). Resultado traz `status` (`COMPLETE`/`BUDGET_EXHAUSTED`) e `nextStartTime` para retomada.
- **6.3.2:** fixture real de 2026-09-30 traz `rateType: "Regular"` em 200/200 registros → coluna já existia (migração 007, default `Normal`) e é persistida por registro; ausência na resposta vira `Normal`.
- **6.3.3/CA-3.4:** orçamento de páginas/minuto (`FUNDING_SYNC_BUDGET_PER_MINUTE`, default 60; o endpoint divide com `fundingInfo` o limite de 500 req/5min) e gatilhos em `FundingCoverageTrigger`: `ensureFundingCoverage` antes de cada `POST /api/backtest/run` (incremental a partir do último registro, não bloqueante) e `scheduleDailyFundingSync` no boot para os símbolos monitorados (idempotente por dia UTC). Toda chamada REST passa pelo `requestJsonLimited` (limiter).
- **6.3.4/CA-3.2/3.3:** `calculateFundingCostWithCoverage` em `FundingService` — eventos esperados = piso(janela/intervalo); real onde há registro, taxa fixa SOMENTE nos eventos sem dado; `fundingCoverage` agregado no `BacktestResult` + suposição declarada em `assumptions` quando há trecho de fallback. Corrige o comportamento anterior, que zerava o custo do trecho sem dado.
- **6.3.5/CA-3.5:** `calculateSignalOutcomeR` aceita `options.funding` e expõe `fundingR`; `getClosedSignalsEvidence` busca o histórico do símbolo (import dinâmico para evitar ciclo db↔backtest_db) e desconta com o mesmo método do backtest. Falha na busca é fail-open (R sem funding), não quebra a leitura.
- Testes novos: `tests/fundingSyncPaging.test.ts` (3), `tests/fundingSyncIdempotent.test.ts` (2), `tests/backtestFundingCoverage.test.ts` (4), `tests/ledgerFundingR.test.ts` (2).

---

## Fase 6.4 — Gate TradFi único e universo íntegro (G-10, G-11)

- [x] **T6.4.1 — Gate único no tick** (S)
  - *CA:* CA-4.1 — sábado: `PERPETUAL` de ouro não é bloqueado; `TRADIFI_PERPETUAL` de ações bloqueia em `OVERNIGHT`, libera em `REGULAR`/`PRE_MARKET`/`AFTER_MARKET`. O tick só usa `canGenerateSignalsForAsset`.
  - *Teste:* `tests/tickTradfiGate.test.ts`. *Arquivos:* `server.ts`, `server/binanceService.ts`.
- [x] **T6.4.2 — Escopo do gate + `scheduleGated`** (S). *CA-4.5*.
  - *Arquivos:* `server/binanceService.ts`.
- [x] **T6.4.3 — Sem fallback spot no screener** (S)
  - *CA:* CA-4.2 — `fapi` fora ⇒ lista vazia, feed degradado, nenhuma chamada a `/api/v3/`.
  - *Teste:* `tests/screenerNoSpotFallback.test.ts`. *Arquivos:* `server/services/MarketScreenerService.ts`.
- [x] **T6.4.4 — Remover métricas fabricadas + renormalizar score** (M)
  - *CA:* CA-4.3 (dois símbolos com entradas idênticas e nomes diferentes ⇒ scores idênticos) e CA-4.4 (sem OI o fator sai do score e `availableFactors`; mudar o peso de OI não muda o resultado).
  - *Testes:* `tests/screenerNameIndependence.test.ts`, `tests/screenerFactorRenorm.test.ts`. *Arquivos:* `MarketScreenerService.ts`, `server/demo/*`.
- [x] **T6.4.5 — RVOL real top-60** (S). *Arquivos:* `MarketScreenerService.ts`.
- [x] **T6.4.6 — Universo a partir do `exchangeInfo`** (S)
  - *CA:* CA-4.5 — símbolos em `SETTLING`/`BREAK` ficam fora.
  - *Teste:* `tests/universeFromExchangeInfo.test.ts`.

### Checkpoint E (após 6.4) — ✅ 2026-09-30
- [x] Nenhuma métrica derivada do nome · nenhum endpoint spot no caminho de futuros · gate único. (`tsc` limpo · **77 arquivos / 419 testes verdes** · `build` ok.)

#### Notas de implementação (6.4, 2026-09-30)
- **Núcleo puro novo:** `server/services/screenerScoring.ts` — `buildUniverseFromExchangeInfo` (status `TRADING`, `PERPETUAL`/`TRADIFI_PERPETUAL`, quoteAssets configurável), `computeScreenerCompositeScore` (**ignora o nome do símbolo** — CA-4.3; fator ausente sai do score com renormalização pela soma dos pesos disponíveis + `availableFactors` — CA-4.4; piso 15/teto 99), `computeRealRvol` (cap 8), `averageDailyQuoteVolume`, `topSymbolsByVolume` (top-60).
- **6.4.1/CA-4.1:** gate único no tick — `evaluateTickTradfiGate({symbol, contractType, tradfiCategory})` em `binanceService` (invólucro de `canGenerateSignalsForAsset` + campo `scheduleGated`); `PERPETUAL` nunca bloqueado; `server.ts` não usa mais `isTradfiMarketOpen` no caminho do tick.
- **6.4.2/CA-4.5:** `isScheduleGatedSymbol` = true apenas para `TRADIFI_PERPETUAL`; `scheduleGated` exposto no gate do tick (métricas com os callers; fail-closed continua contado dentro de `canGenerateSignalsForAsset`, sessões no branch do tick).
- **6.4.3/CA-4.2:** screener só fapi — candidatos vêm de `buildScreenerCandidates` (ticker/24hr + exchangeInfo); sem dados ⇒ `assets: []`, `dataUnavailable: true`, log WARN; zero chamadas a `/api/v3/` e zero ticks sintéticos.
- **6.4.4:** métricas fabricadas removidas — rvol/OI/funding `null` quando sem dado (UI mostra "n/d", ordenação null-last, propagação com `?? 0`); sem OI/funding ⇒ `topOiSurge`/`highestFundingRate` ficam `undefined` (fim do fallback `'SOLUSDT'`/`'BTCUSDT'` com 0, que era dado fabricado).
- **6.4.5:** RVOL real por klines 1d (`limit=21`, descarta o candle em formação, média das últimas 20 sessões fechadas) para o top-60 por volume, em bateladas de 8, cache 24h; OI: `openInterestHist` 5m×500 (janela ~41h), cache 5min/símbolo; funding: `premiumIndex` em lote + `fundingInfo` (intervalos, fallback 8h), cache 5min + promise-sharing. **Todas as chamadas passam pelo `requestJsonLimited`.**
- **6.4.6/CA-4.5:** universo derivado do `exchangeInfo` da fapi — `SETTLING`/`BREAK` ficam fora.
- Desvio do plano: `server/demo/*` não existia mais; a lógica de score foi extraída para o módulo puro `screenerScoring.ts` (testável sem rede), que implementa o T6.4.4.
- Testes novos (19): `tests/tickTradfiGate.test.ts` (7), `tests/screenerNoSpotFallback.test.ts` (3), `tests/screenerNameIndependence.test.ts` (3), `tests/screenerFactorRenorm.test.ts` (3), `tests/universeFromExchangeInfo.test.ts` (3).

---

## Fase 6.5 — Precisão e executabilidade (G-12)

- [ ] **T6.5.1 — Aritmética decimal em PnL/taxas/slippage/R** (M)
  - *CA:* CA-5.1 (0,1 + 0,2 exato) e CA-5.2 (teste estático proíbe `toFixed` nos arquivos de cálculo).
  - *Testes:* `tests/decimalPnl.test.ts`, `tests/noToFixedInCalc.test.ts`. *Arquivos:* `server/utils/decimal.ts` (novo), `BacktestEngine.ts`, `positionResolution*`, `EvidenceService.ts`, `server/db.ts`.
- [ ] **T6.5.2 — Filtros do exchange + `executable`** (M)
  - *CA:* CA-5.3 — preços múltiplos do `tickSize`; quantidade abaixo do mínimo ⇒ `executable: false` com motivo; `suggestedQuantity` arredondada ao `stepSize`.
  - *Teste:* `tests/exchangeFilters.test.ts`.
- [ ] **T6.5.3 — Slippage por profundidade** (S)
  - *CA:* CA-5.4 — book raso ⇒ slippage > `MAX_ESTIMATED_SLIPPAGE_PCT` e sinal marcado.
  - *Teste:* `tests/depthSlippage.test.ts`.

### Checkpoint F (após 6.5)
- [ ] Nenhum `toFixed` em cálculo · sinais executáveis com preço/quantidade válidos.

---

## Fase 6.6 — Alertas completos (G-13)

- [ ] **T6.6.1 — `emitOperationalAlert` + todos os eventos** (M)
  - *CA:* CA-6.1 — cada evento emite exatamente 1 alerta na janela de dedup.
  - *Teste:* `tests/alertsAllEvents.test.ts`.
- [ ] **T6.6.2 — Isolamento de falha de sink** (S) — CA-6.2. *Teste:* `tests/alertSinkFailureIsolated.test.ts`.
- [ ] **T6.6.3 — `POST /api/system/alerts/test` autenticado** (S) — CA-6.3. *Arquivos:* `server/routes/systemRoutes.ts`.
- [ ] **T6.6.4 — Heartbeat externo opcional** (S) — CA-6.4. *Teste:* `tests/heartbeat.test.ts`.

### Checkpoint G (após 6.6)
- [ ] Alertas cobrem todos os modos de falha listados · falha de alerta não derruba o tick.

---

## Fase 6.7 — Motor e auto-tune (G-14, G-15) — **bloqueada por aprovação do dono**

- [ ] **T6.7.0 — Escrever `specs/phase-6-7-entry-confirmation.md`** (S, entrega de design)
  - *Bloqueio:* nenhuma regra implementada sem aprovação explícita do dono.
- [ ] **T6.7.1 — `confirmEntry(direction, klines1m, klines5m)` pura** (M) — CA-7.1. *Teste:* `tests/confirmEntry.test.ts`.
- [ ] **T6.7.2 — Ciclo `PENDING_ENTRY`** (M) — CA-7.2 (sem toque ⇒ `ENTRY_NOT_FILLED`, sem R e sem evento ENTRY). *Teste:* `tests/pendingEntryLifecycle.test.ts`.
- [ ] **T6.7.3 — Teto do stop `MAX_STOP_PCT`** (S) — CA-7.3. *Teste:* `tests/stopCap.test.ts` (já existe — revisar/expandir).
- [ ] **T6.7.4 — Auto-tune treino/validação/holdout** (M) — CA-7.4/7.5. *Teste:* `tests/autoTuneThreeWaySplit.test.ts` (revisar `autoTuneHoldout.test.ts`).

---

## Fase 6.8 — Navegador, docs e qualidade (G-16, G-17, G-18) — paralela a partir de 6.2

- [ ] **T6.8.1 — Stream de preços pelo servidor + auth** (L)
  - *CA:* CA-8.1 — sem `wss://fstream` em `src/`; stream responde 401 sem token. *Teste:* `tests/priceStreamAuth.test.ts`.
- [ ] **T6.8.2 — CSP report-only** (S) — CA-8.2. *Teste:* `tests/cspReportOnly.test.ts`.
- [ ] **T6.8.3 — Reescrever specs 1.1/2 e renomear `phase-2-5 and phase-3.md`** (M).
- [ ] **T6.8.4 — README/OPERATIONS alinhados** (M).
- [ ] **T6.8.5 — Baseline de qualidade + `.env.example`** (M) — CA-8.4/8.5. *Teste:* `tests/envDocumented.test.ts`.

---

## Fase 6.9 — Evidência operacional (G-19) — não é código
- [ ] Burn-in 7d → tag `evidence-start` → janela ≥60d → relatório semanal → go/no-go (CA-9.x). Só após 6.0–6.7.

---

## Checkpoints gerais
| Checkpoint | Quando | Gate |
|---|---|---|
| A | após 6.0 | `npm ci` 0, tsc, testes, build |
| B | após 6.1 | smoke real, fixtures `_meta`, UNIVERSE.md |
| C | após 6.2 | ledger sem viés, reconciliação idempotente |
| D | após 6.3 | funding real no backtest e no R |
| E | após 6.4 | sem métrica do nome, sem spot, gate único |
| F | após 6.5 | decimal, executabilidade |
| G | após 6.6 | todos os alertas |
| Final | após 6.0–6.7 | definição de pronto da seção 9 do spec |

## Riscos e mitigação
| Risco | Impacto | Mitigação |
|---|---|---|
| API Binance muda | Médio | fixtures `_meta`, testes de contrato, recaptura mensal |
| Fail-closed do ledger bloqueia sinais | Alto | alerta imediato, reconciliação, teste de falha |
| `PENDING_ENTRY` muda perfil dos resultados | Alto | nova `engineVersion`; evidência só após congelamento |
| Ban de IP nos scripts | Médio | limiter + poucas chamadas de baixo peso |
| Overfitting no auto-tune | Médio | holdout intocado, `trialsCount`, IC bootstrap |

## Oportunidades de paralelização
- **Pode paralelizar:** 6.3, 6.4 e 6.6 (após 6.2); 6.8 a partir de 6.2.
- **Sequencial:** 6.0 → 6.1; migrações de banco; contrato do ledger (6.2) antes de 6.3.5.
- **Coordenação:** contrato `_meta` das fixtures antes de 6.1.3/6.1.4.

## Questões abertas (precisam de resposta do dono)
1. Escopo desta sessão (6.0+6.1, 6.0 só, ou outra combinação).
2. Onde rodar smoke/captura reais (este ambiente × servidor do operador).
3. Regras de confirmação de entrada (6.7.1) — quem aprova e quando.
4. Confirmação dos padrões assumidos da seção 10 (fail-closed, expirado a mercado, etc.).

---

## Notas de implementação (6.0 + 6.1, 2026-09-30)

- **Correção de rota na API real:** o OI histórico é `/futures/data/openInterestHist`, **não** `/fapi/v1/openInterestHist` (este devolve 404). O spec 6.1.1 estava impreciso; smoke e captura usam o caminho correto (o próprio app já usava).
- **Reconciliação 787 × 987 (real):** `ticker/24hr` = 787 = `exchangeInfo.TRADING`; WS únicos em 10 s = ~490. O 987 do smoke antigo era **soma cumulativa por mensagem** (com duplicatas), não símbolos únicos. Os símbolos só-no-WS são `*_PERP` (coin-margined), fora do `/fapi`. Detalhado em `docs/UNIVERSE.md`.
- **Categorias TradFi reais:** apareceram `PREMARKET`, `KR_EQUITY`, `HK_EQUITY`, `CN_EQUITY`; `EURUSDT`/`SPYUSDT` não existem mais. Adicionado `TRADFI_UNDERLYING_TO_SCHEDULE_MARKET` + `TRADFI_UNDERLYING_NO_CALENDAR` (PREMARKET = sem calendário, fail-closed).
- **Limitação do sandbox (contornada):** `npm install`/`npm ci` com download falham aqui (`allow-remote=none`). O `package-lock.json` foi reconciliado offline com as 6 entradas faltantes (cors, @types/cors e 4 pacotes win32 opcionais) vindas do `node_modules/.package-lock.json`.
- **CA-0.1 — FECHADO (2026-09-30):** `npm ci` em clone git limpo (HEAD + `package.json`/`package-lock.json` reconciliados sobrepostos; equivalente ao estado pós-commit) terminou com **exit 0**: 0 vulnerabilidades, 248 pacotes, e `npm run build` exit 0 no clone. Observação: o primeiro `npm ci` detectou **39 entradas opcionais de plataforma ausentes no lock** (binários `@rollup/rollup-*` 4.62.3, `@tailwindcss/oxide-*` 4.3.3, `lightningcss-*` 1.32.0 e `fsevents` 2.3.3 — inclusões de outras plataformas que a instalação win32 local não tinha) e falhou com `EUSAGE`; as entradas foram completadas com metadados oficiais do registry npm (sem flag `dev`, pois sobem via `vite`, dependência de produção), e o `npm ci` re-executado passou. Validação adicional sem rede: `npm install --package-lock-only --dry-run --offline` exit 0 (lock em sincronia com o `package.json`). O job de CI (Node 20/22) permanece como verificação contínua (CA-0.3).
- **6.7.1:** documento de design criado em `specs/phase-6-7-entry-confirmation.md` — **bloqueia** o 6.7.2+ até a aprovação do dono.

### Artefatos novos/modificados
- `tests/repoHygiene.test.ts`, `tests/smokeExitCode.test.ts`, `tests/fixtureCaptureAtomic.test.ts`, `tests/fixturesIntegrity.test.ts`, `tests/tradfiScheduleMapping.test.ts`, `tests/auditUniverse.test.ts`.
- `scripts/binance-smoke.ts`, `scripts/capture-binance-fixtures.ts`, `scripts/audit-universe.ts`.
- `tests/fixtures/binance/*` (reais, com `_meta`), `docs/UNIVERSE.md`, `docs/evidence/binance-smoke-2026-09-30.log`, `specs/phase-6-7-entry-confirmation.md`.
- `package.json` (scripts `capture:fixtures`, `audit:universe`), `package-lock.json`, `.gitignore`, `README.md`, `server/binanceService.ts`.
