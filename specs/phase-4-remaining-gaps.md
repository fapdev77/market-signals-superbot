# Fase 4 — Re-auditoria e Plano de Correção das Pendências (Fases 1, 2, 2.5 e 3)

> **Criado em:** 2026-09-29 · **Método:** re-auditoria do código após a conclusão da 2.5 e dos itens 3.1/3.4,
> com cada alegação verificada contra o código (`tsc` 0 erros, `vitest` 154/154, build OK,
> `npm audit --omit=dev` 0 vulnerabilidades) e contra greps diretos no fonte — não contra docs.
>
> **Objetivo deste documento:** (a) declarar o que das Fases 1–3 está realmente implementado; (b) listar
> tudo que ficou inconsistente ou faltando, com plano executável e critérios de aceitação para cada item.

---

## 1. Estado verificado das Fases 1–3 (síntese)

| Fase | Estado | Observações |
|------|--------|-------------|
| 1 — Segurança e Integridade | ✅ implementada (com 4 ressalvas rastreadas) | ver `phase-1-security-and-data-integrity.md` |
| 1.1 — Hotfix | ✅ implementada | ver `phase-1-1-hotfix.md` |
| 2 — Ingestão/Motor/Backtest/TradFi | ✅ substancialmente implementada | 2.1.4, 2.2.9, 2.3.7 e 2.4.6 pendentes (2.1.3, 2.2.8 e 2.3.6 fechados por R-5/R-7/R-9) |
| 2.5 — Hotfix de integridade | ✅ completa | ver `phase-2-5-and-phase-3.md` |
| 3 — Institucional | ⚠️ parcial | 3.1 e 3.4 feitas; 3.2, 3.3 e 3.5 pendentes (abaixo) |

**Pendências confirmadas por inspeção direta do código** (não por inferência):

- `server/utils/outboundPolicy.ts` exporta `validateOutboundAIUrlWithDns` — nenhum call site.
- `server/binanceService.ts`: `fetchOpenInterest` (l. ~404), `openInterestHist` (l. ~425), os 3 endpoints
  de long/short (l. ~618/631/644) e depth (l. ~1379) usam `requestJson` direto, fora do rate limiter.
- `server/db.ts`: 7+ `try { ALTER TABLE … } catch {}` e o purge `HIST-%` rodando a cada boot; nenhum
  `PRAGMA user_version`. `package.json` tem `sql.js` **e** `@libsql/client`; o segundo é usado por
  `server/backtest_db/index.ts` (drizzle).
- `server/services/BacktestEngine.ts`: funding é baseline plano (`0.0001/8h`) declarado em `assumptions`;
  OI/funding/LSR desligados por `backtestAvailability`; TP1 ativa breakeven mas o PnL é sobre a posição
  cheia; walk-forward é um único corte 70/30 (l. ~200).
- `server/signalEngine.ts`: stop = mais distante entre swing/suporte/ATR%, sem teto.
- Nenhum handler de exceção engole erros fatais (só o assertion do undici é tolerado).

---

## 2. Inventário consolidado de pendências

| Ref | Título | Origem | Severidade | Esforço |
|-----|--------|--------|------------|---------|
| R-1 | Ativar validação de DNS anti-rebinding nas chamadas de IA | Fase 1 / S4.6 | 🟠 alta (segurança) | S |
| R-2 | Colunas de origem (`LIVE`/`DEMO`) + split `server/demo/` | Fase 1 / D4 | 🟡 média | M |
| R-3 | Migrações versionadas (`PRAGMA user_version`) | Fases 1/3.3 | 🟠 alta (dados) | M |
| R-5 | Rate limiter cobrindo **todas** as chamadas REST | Fase 2.1 / 3.2 | 🟠 alta (fiabilidade) | S |
| R-6 | WebSocket como feed principal (kline, markPrice, depth) | Fase 2.1 / 3.2 | 🟡 média | L |
| R-7 | Teto de stop (volatilidade extrema) | Fase 2.2 / 3.1 | 🟠 alta (risco) | S |
| R-8 | Recalibração do score por faixa com dado real | Fases 2.2/3.5 | 🟡 média (depende de R-18) | M |
| R-9 | Parcial + runner no backtest (fidelidade ao live) | Fase 2.3 / 2.5.4 | 🟠 alta (backtest) | M |
| R-10 | Walk-forward com janelas rolantes e tuning só no IS | Fase 2.3 / 2.5.4 | 🟠 alta (backtest) | M |
| R-11 | Consumir `GET /fapi/v1/tradingSchedule` no TradFi | Fase 2.4 | 🟡 média | S |
| R-12 | Validar `fundingInfo` e linhas TradFi contra a API real | Fase 2.5 | 🟠 alta (validação) | S (exige rede) |
| R-13 | Health por feed com estado observável | Fase 3.3 | 🟡 média | M |
| R-14 | Driver SQLite único (sql.js **ou** libsql) | Fase 3.3 | 🟡 média | M |
| R-15 | Logs estruturados + métricas | Fase 3.3 | 🟡 média | M |
| R-16 | Tratamento explícito de `SQLITE_BUSY` | Fase 3.3 | 🟡 média | S |
| R-17 | Kill-switch e postura de risco visíveis na UI | Fase 3.4 | 🟡 média | S |
| R-18 | Paper trading 60–90 dias + expectativa/drawdown reais | Fase 3.5 | 🟠 alta (evidência) | L |

(Sem R-4: a CSP desligada foi tratada como decisão consciente, reavaliável no M4.)

### Estado de implementação (2026-09-29)

✅ **Concluídos e verificados** — suíte **263/263** (33 arquivos), `tsc --noEmit` limpo, `npm run build` ok:

| Ref | Entrega | Evidência |
|-----|---------|-----------|
| R-1 | DNS anti-rebinding nos 4 caminhos de IA, test-connection e POST de modelos | `tests/outboundDnsEnforcement.test.ts` (4) |
| R-2 | `origin` (`LIVE`/`DEMO`) em `trade_signals`/`historical_klines` + geradores sintéticos em `server/demo/` | `tests/dataOriginProvenance.test.ts` (17) |
| R-3 | Migrações versionadas v1–v5 (`schema_migrations` + `user_version`) | `tests/migrations.test.ts` (6) |
| R-5 | `requestJsonLimited` cobre OI/hist/LSR×3/depth/klines; OI e LSR falham fechado em cooldown | `tests/rateLimiterCoverage.test.ts` (7) |
| R-7 | Teto de stop por ATR (`maxStopLossAtrMultiple`, default 2,5×) | `tests/stopLossCap.test.ts` (6) |
| R-9 | Parcial 50% em TP1 + breakeven + runner até TP2 no backtest | `tests/backtestPositionResolution.test.ts` (8) |
| R-10 | Walk-forward rolante: janelas por tempo, métricas IS/OOS por janela e tuning só no IS | `tests/walkForwardRolling.test.ts` (10) |
| R-14 | Driver único (sql.js); `@libsql/client`/drizzle removidos; legado importado one-time | `tests/backtestDao.test.ts` (7) |
| R-16 | `runWithRetry`/`isBusyError` para `SQLITE_BUSY`/`SQLITE_LOCKED` | `tests/dbRetry.test.ts` (7) |
| R-11 | `tradingSchedule` da exchange (cache diário) como autoridade do TradFi + fallback NY documentado | `tests/tradingSchedule.test.ts` (8) |
| R-13 | Registro de health por feed + `GET /api/system/feed-health` + badges reais na UI | `tests/feedHealth.test.ts` (9) |
| R-15 | Logger JSON de 1 linha com redação de segredos + contadores em `GET /api/system/metrics` | `tests/structuredLogging.test.ts` (12) |
| R-17 | `KillSwitchPanel` (halt + postura de risco) no dashboard e na aba de risco | `tsc` + build (UI; endpoints já cobertos) |

Ainda pendentes: R-6, R-8, R-12, R-18.

> **Estado em 2026-10-01 (Fase 6.8).** Desde a última revisão: as Fases 5 e 6.0–6.7 foram entregues
> (ledger append-only, funding real, caps, confirmação de entrada atrás da flag D8 — ver
> `phase-6-plan.md`). O pipeline 15m→REST continua a fonte do tick (R-6 segue pendente). Novos itens
> da 6.8: CSP report-only (CA-8.2) fechou a antiga ressalva de CSP; stream de preços agora passa pelo
> servidor autenticado (CA-8.1); baseline de qualidade `any`/`catch` vazios com gate de CI (CA-8.4)
> e `.env.example` auditado por teste (CA-8.5) — `scripts/quality-baseline.json`, `tests/envDocumented.test.ts`.

> **Nota de verificação.** A investigação das falhas da suíte expôs duas fragilidades reais além dos
> itens acima: (1) o banco unificado era **compartilhado** entre workers de teste e o app — como o
> `sql.js` mantém o banco inteiro em memória e reescreve o arquivo a cada save, um `npm run dev`
> desatualizado (schema pré-R-3) sobrescrevia silenciosamente o que o teste acabara de migrar, o que
> tornava as execuções irreprodutíveis; corrigido com `tests/setup.ts` (um arquivo de banco por worker)
> e com o import legado sendo desativado em ambiente de teste. (2) `fetchLongShortRatio` consultava o
> cache de 45 s **antes** do limiter, então durante um cooldown (429/418) ainda devolvia posicionamento;
> o gate de cooldown agora é a primeira coisa da função (fail-closed → `null`).
>
> Pelo mesmo motivo (imagem inteira do banco em memória), todo `saveDbToDisk()` reescrevia
> ~140 MB de forma síncrona a cada mutação de estado. As escritas de estado agora passam por
> `scheduleDbSave()`, que coalesce em uma janela de 1,5 s, enquanto `flushDbSave()` é usado pelos
> caminhos que precisam do arquivo atualizado na hora (VACUUM, limpeza de tabela, factory reset,
> estatísticas do banco) e no shutdown (`SIGINT`/`SIGTERM`/`beforeExit`). `tests/dbSaveCoalescing.test.ts` (4).

---

## 3. Plano por item (com critérios de aceitação)

### M1 — Segurança, rede e validação contra a realidade (quick wins)

**R-1 — DNS rebinding (S4.6)**
- *Ação:* tornar `aiMotor` e o POST de modelos assíncronos na borda (já o são); trocar
  `validateOutboundAIUrl` por `validateOutboundAIUrlWithDns` nos 4 caminhos de saída de IA. Manter a
  validação síncrona apenas onde não há DNS (IP literal já bloqueado).
- *Critérios:* (1) teste unitário com hostname que resolve para IP privado é rejeitado; (2) hostname da
  allowlist que resolve para IP público passa; (3) `tsc` limpo; (4) nenhum caminho de IA chama a versão
  síncrona.
- *Arquivos:* `server/services/aiMotor.ts`, `server/routes/aiRoutes.ts`, `server/utils/outboundPolicy.ts`.
- ✅ *Implementado:* `validateOutboundAIUrlWithDns` aplicada em `aiMotor.ts` (caminhos gemini/local/openai/openrouter/anthropic — o gate do Gemini roda **antes** do cliente, senão o erro de chave mascarava a rejeição), em `aiRoutes.ts` (test-connection) e no POST `/settings/ai-models` (400 se qualquer modelo tiver URL bloqueada). `tests/outboundDnsEnforcement.test.ts`.

**R-5 — Limiter total**
- *Ação:* mover `fetchOpenInterest`, `openInterestHist`, os 3 endpoints de long/short e depth para
  `fetchWithFallback` (ou expor um `requestJsonLimited`). Atenção ao peso: `openInterestHist` é pesado —
  manter os caches existentes e reduzir o peso default do limiter se necessário.
- *Critérios:* (1) `grep requestJson server/binanceService.ts` só mostra usos dentro de
  `fetchWithFallback`; (2) teste de unidade do limiter com as novas rotas; (3) sem `429` em varredura
  normal do screener.
- *Arquivos:* `server/binanceService.ts`, `server/utils/binanceRateLimiter.ts`.
- ✅ *Implementado:* `requestJsonLimited` (assertAllowed → requisição → registra peso dos headers → backoff em 429/418) cobre OI, `openInterestHist`, os 3 endpoints de long/short, depth e o sync de klines; `BinanceRateLimiter.assertAllowed()` exposto. `fetchOpenInterest` degrada para CACHE (`isDegraded`, sem throw) e `fetchLongShortRatio` devolve `null` em cooldown — o gate precede o cache. `tests/rateLimiterCoverage.test.ts`.

**R-16 — `SQLITE_BUSY` explícito**
- *Ação:* no wrapper de execução do `db.ts`, detectar `SQLITE_BUSY` e aplicar retry com backoff curto
  (3 tentativas); log estruturado do evento. Manter `fileParallelism:false` nos testes.
- *Critérios:* (1) teste que simula `SQLITE_BUSY` e espera retry bem-sucedido; (2) nenhum aviso engolido
  silenciosamente em stderr da suíte.
- *Arquivos:* `server/db.ts`.
- ✅ *Implementado:* `server/utils/dbRetry.ts` expõe `runWithRetry(op, { maxAttempts: 3, baseDelayMs: 20, maxDelayMs: 200 })` e `isBusyError` (códigos `SQLITE_BUSY`/`SQLITE_LOCKED` + mensagens "database is locked"), consumido pelo `insertMany` da DAO. `tests/dbRetry.test.ts`.

**R-12 — Validação contra a API real (exige rede)**
- *Ação:* em ambiente com acesso à Binance: gravar uma resposta real de `/fapi/v1/fundingInfo` e uma
  fatia de `exchangeInfo` com linhas TradFi como fixtures; ajustar parsers se a forma real divergir.
- *Critérios:* (1) fixture commitada em `tests/fixtures/`; (2) parser do intervalo de funding e do
  registro TradFi testados contra as fixtures; (3) `getFundingIntervals` e `classifyTradfiContract`
  não mudam de contrato sem atualizar fixtures.

### M2 — Fidelidade do backtest e do risco

**R-9 — Parcial + runner no backtest**
- *Ação:* ao tocar TP1, realizar 50% ao preço de TP1 (com slippage), mover stop para a entrada e levar o
  restante até TP2 ou breakeven. PnL = soma ponderada. Espelhar `evaluatePositionManagement`.
- *Critérios:* (1) trade com TP1+TP2 tem PnL ≈ 0,5·TP1 + 0,5·TP2 (± taxas/slippage); (2) stop após
  breakeven resulta em PnL ≈ 0,5·TP1 − taxas; (3) testes novos cobrem os 3 caminhos; (4) nenhum teste
  antigo muda de resultado sem revisão.
- *Arquivos:* `server/services/BacktestEngine.ts`.
- ✅ *Implementado:* `resolveBacktestPosition()` exportado (stop-first: stop e alvo no mesmo candle ⇒ stop; TP1 fecha 50% com slippage e move o stop para a entrada; runner de 50% até TP2 ou breakeven; `openedThisCandle` nunca resolve no próprio candle). O loop grava `partialClosed`/`closedSize` por trade, taxas/funding proporcionais ao tamanho fechado e só encerra a posição com `closedSize ≥ 0,999`. `tests/backtestPositionResolution.test.ts`.

**R-10 — Walk-forward real**
- *Ação:* substituir o corte único 70/30 por janelas rolantes (ex.: treino 30d → teste 7d, passo 7d);
  tuning (pesos/limiares) restrito à janela IS; agregação de métricas OOS entre janelas.
- *Critérios:* (1) nenhum dado OOS participa da escolha de parâmetros (teste de fuga: alterar OOS não
  muda os parâmetros escolhidos); (2) resultado expõe nº de janelas e métricas OOS agregadas;
  (3) `BacktestResult` ganha campos sem quebrar o cache existente (bump da chave).
- *Arquivos:* `server/services/BacktestEngine.ts`, `src/types.ts`.
- ✅ *Implementado:* `buildWalkForwardWindows(startTime, endTime, options?, days?)` gera janelas rolantes **por tempo** (defaults `trainDays = 50%`, `testDays = 20%`, `stepDays = testDays` da janela pedida) com passo `stepDays` e clampa a cauda em `endTime`; `aggregateWalkForward(trades, windows)` separa IS (`entryTime < windows[0].isEnd`) de OOS e devolve `windowResults` por janela. `BacktestConfig.walkForward` + o novo `isOnlyUntil` restringem a série ao treino, e `runAutoTune(..., walkForward?)` roda um *probe* para achar `trainedUntil`, pontua **baseline e candidatos somente no IS** (sem vazamento OOS→IS) e devolve `oosValidation` + `trainedUntil`. `BacktestResult.walkForward` expõe `windows`, `outOfSampleTrades` e `windowResults`, e `generateStrategyId` foi para `v: 2` incluindo `walkForward`/`isOnlyUntil` (invalida o cache pré-R-10). `tests/walkForwardRolling.test.ts` (10).

**R-7 — Teto de stop**
- *Ação:* limitar a distância do stop a um múltiplo do ATR% (ex.: 2,5×ATR%) ou a um percentual máximo do
  preço, configurável; sinal que exigir stop maior é rejeitado ou reancorado na estrutura válida mais
  próxima (decidir por padrão conservador: reancorar).
- *Critérios:* (1) teste com candle de volatilidade extrema produz stop ≤ teto; (2) R:R recalculado após
  o cap; (3) configurável em Ajustes com default seguro.
- *Arquivos:* `server/signalEngine.ts`, `server/services/TickProcessor.ts`, `src/types.ts`.
- ✅ *Implementado:* `buildTradeSignal` ganhou o 7º parâmetro opcional `weights`; o stop é limitado a `maxStopLossAtrMultiple` (novo campo de `IndicatorWeights`, default 2,5×) do True Range de 15 candles, reancorado **antes** do cálculo dos alvos (o R:R é recalculado pela lógica existente). `tests/stopLossCap.test.ts`; o teste legado "anchors stop loss" passou a injetar cap alto para preservar o contrato de ancoragem nos swing lows.

**R-11 — `tradingSchedule`**
- *Ação:* buscar `/fapi/v1/tradingSchedule` (cache diário) e cruzar com `isTradfiMarketOpen`; sem
  resposta, manter o cálculo por `America/New_York` e registrar `assumptions`.
- *Critérios:* (1) feriado/horário reduzido na fixture bloqueia sinais do contrato afetado;
  (2) fallback documentado quando o endpoint não responder.
- *Arquivos:* `server/binanceService.ts`.
- ✅ *Implementado (TDD):* `refreshTradingSchedule()` busca `/fapi/v1/tradingSchedule` com cache de
  24h (formato real verificado contra a API: `marketSchedules` com chaves `EQUITY`, `COMMODITY`, `FX`,
  `CN_EQUITY`... e sessões `{startTime, endTime, type}` — tipos `REGULAR`, `NO_TRADING`, `PRE_MARKET`,
  `AFTER_MARKET`, `OVERNIGHT`). `isTradfiMarketOpen` consulta o calendário **antes** do relógio:
  sessão `REGULAR`/`OVERNIGHT` = aberto, fora de sessão = fechado, mercado ausente do endpoint →
  fallback por `America/New_York` (comportamento anterior). Falha do endpoint nunca propaga: mantém
  o último calendário por até 2× TTL e registra a suposição em `getTradingScheduleStatus().assumptions`
  (fallback documentado — critério 2). Critério 1 coberto por fixture com feriado de segunda e horário
  reduzido (REGULAR até 13:00 NY): EQUITY/INDEX bloqueados mesmo com relógio dizendo pregão, e o
  teste ponta a ponta suprime o sinal no motor (`NEUTRAL`, motivo "fechado"). COMMODITY/FOREX passam
  a seguir o calendário oficial. Boot: `refreshTradingSchedule` no startup + re-tentativa a cada 6h.
  `tests/tradingSchedule.test.ts` (8).

### M3 — Confiabilidade e dados

**R-3 — Migrações versionadas**
- *Ação:* tabela `schema_migrations` (ou `PRAGMA user_version`); cada migração idempotente com registro;
  substituir os `ALTER` em try/catch; purge `HIST-%` vira migração única marcada como executada
  (sem backup, conforme decisão 3 — registrar isso no log da migração).
- *Critérios:* (1) boot em banco novo aplica tudo em ordem; (2) boot em banco existente não reexecuta;
  (3) teste que roda o migrador duas vezes e espera efeito único; (4) nenhum `try { ALTER } catch {}`.
- *Arquivos:* `server/db.ts`, `server/migrations/` (novo).
- ✅ *Implementado:* `server/migrations/index.ts` com v1 (colunas de ciclo de vida: TTL/breakeven), v2 (purge `HIST-*` one-time, **sem backup** — decisão 3), v3 (`historical_klines` + índice único `symbol/interval/open_time`), v4 (`backtest_results`), v5 (marcador do import legado). `applyMigrations()` é idempotente por `PRAGMA user_version` + `schema_migrations`, chamado no `getDb()`; os 7 `try { ALTER } catch {}` e o purge silencioso foram removidos. `tests/migrations.test.ts`.

**R-14 — Driver único**
- *Ação:* decidir o destino do `server/backtest_db` (drizzle+libsql): ou portar as tabelas de backtest
  para o `db.ts` (sql.js) e remover `@libsql/client`, ou padronizar o app inteiro em libsql. Recomendo
  **portar e remover** — menos uma dependência nativa, um só arquivo de banco, uma só política de backup.
- *Critérios:* (1) `package.json` sem `@libsql/client` (ou sem `sql.js`, se a outra via for escolhida);
  (2) export/backup cobre os dados de backtest; (3) testes de backtest passam no driver único.
- *Arquivos:* `server/backtest_db/*`, `server/db.ts`, `package.json`.
- ✅ *Implementado:* DAO sql.js única em `server/backtest_db/index.ts` (`historicalKlinesDao`, `backtestResultsDao`); `@libsql/client`, `drizzle-orm` e `drizzle-kit` removidos (0 referências) e um só arquivo de banco. O `data/backtest.db` legado (287.935 klines + 331 resultados) é importado **uma vez** de forma síncrona dentro do `getDb()` — depois das migrações e em blocos multi-row numa transação — e nunca em ambiente de teste; o arquivo legado é arquivado como `.migrated-bak`. `tests/backtestDao.test.ts`.

**R-2 — Proveniência persistida (`origin`/DEMO)**
- *Ação:* migração (via R-3) que adiciona `origin TEXT CHECK(origin IN ('LIVE','DEMO'))` default `LIVE`
  em `trade_signals` e `historical_klines`; gravação passa a setar conforme `ALLOW_SYNTHETIC_DATA`;
  rotas de leitura filtram `origin='LIVE'` por default com parâmetro explícito para demo.
  Opcionalmente mover geradores sintéticos para `server/demo/`.
- *Critérios:* (1) sem a flag, nenhuma linha nasce `DEMO`; (2) com a flag, linhas demo ficam invisíveis
  nas leituras default; (3) hit-rate considera só `LIVE` por default.
- *Arquivos:* `server/db.ts`, `server/migrations/`, `server/signalEngine.ts`, `server/services/HistoricalDataService.ts`.
- ✅ *Implementado:* migração **006** adiciona `origin TEXT NOT NULL DEFAULT 'LIVE'` em `trade_signals` e
  `historical_klines` (registros anteriores viram `LIVE` — proveniência retroactiva não é verificável, foi
  a decisão registrada). A gravação herda a proveniência do dado: `buildTradeSignal` marca `DEMO` só quando
  `ticker.dataQuality.source === 'SYNTHETIC'` (o que exige a flag, senão o `DataGate` nem deixa gerar sinal),
  `seedSyntheticKlines` grava `DEMO`, o fetch real da Binance grava `LIVE`. As leituras de operador
  (`/api/signals`, `/ai/performance`, `getRecentSignals`, `getSignalsByDateRange`, `getActiveSignals*`) filtram
  `LIVE` por default e aceitam `?origin=DEMO|ALL`; o motor passa `'ALL'` explícito (ele gerencia o que criou) e
  `/risk-status` também, porque descreve a postura que o motor aplica. Em klines, `getLatestOpenTime` é `LIVE`
  por default para o resync não retomar de uma cauda sintética, e o backtest segue lendo as duas origens.
  Os geradores foram movidos para `server/demo/` (`prng`, `syntheticKlines`, `syntheticMarket`,
  `syntheticTickers`). `tests/dataOriginProvenance.test.ts`.
- ✅ *Revisão de código (2026-09-29) — 2 correções aplicadas:*
  (1) o fallback sintético de `syncSymbol` (`HistoricalDataService`, linha do `attemptsFailed > 2`)
  semeava candles `DEMO` **sem** checar `ALLOW_SYNTHETIC_DATA` — todo outro gerador (BacktestEngine,
  fetchKlines, screener, WS) faz o gate; agora o sync sem flag termina `DONE` sem fabricar histórico
  (teste novo: gate do chamador + zero linhas DEMO);
  (2) `getActiveSignalsBySymbol` interpolava `symbol`/`category` direto na SQL e
  `getRecentSignals`/`getSignalsByDateRange` interpolavam `limit`/bounds — os callers eram controlados,
  mas o contrato passou a ser parametrizado (mesma disciplina de `saveSignal`; teste com símbolo
  `x' OR '1'='1`). Observações sem ação: `originClause`/`klinesOriginClause` seguem seguras (union
  fechado); `sleepSync` bloqueia no máx ~150 ms no pior caso (4 tentativas), aceitável; `/performance`
  faz uma 2ª query DEMO só quando filtro é `LIVE` (custo baixo, comportamento documentado).

**R-13 — Health por feed**
- *Ação:* mapa por feed (`ticker`, `klines`, `openInterest`, `funding`, `longShort`, `depth`, `ws`) com
  último sucesso/erro/idade; exposto em `GET /api/system/feed-health` (protegido) e resumido no
  `SystemHealthWidget`.
- *Critérios:* (1) falha repetida muda o estado do feed para `DEGRADED` visível; (2) recuperação volta
  a `OK` com timestamp; (3) a UI mostra badge por feed.
- *Arquivos:* `server/binanceService.ts`, `server/binanceWebsocket.ts`, `server/routes/systemRoutes.ts`, `src/components/SystemHealthWidget.tsx`.
- ✅ *Implementado (TDD):* registro in-memory central `server/services/feedHealth.ts` com 8 feeds
  (`ticker`, `klines`, `openInterest`, `funding`, `longShort`, `depth`, `ws`, `tradingSchedule`).
  Regras: feed sem registro nasce `UNKNOWN` (nunca OK inventado); 3 falhas seguidas → `DEGRADED`
  (falha isolada fica OK com erro anotado); sucesso reseta e atualiza `lastSuccessAt`/`lastLatencyMs`;
  sem sucesso por >90s o feed é reportado `STALE` (leitura aceita `now` injetado — critérios 1 e 2).
  Os caminhos de fetch em `binanceService` (tickers REST/WS, OI, funding, klines, longShort, depth,
  tradingSchedule) e `binanceWebsocket` (open/error) gravam no registro. Exposto em
  `GET /api/system/feed-health` (atrás do auth do `/api`), com o estado do WS (`getWebSocketStatus`)
  e do calendário R-11 (`getTradingScheduleStatus`, incluindo `assumptions` do fallback) — critério 3:
  `SystemHealthWidget` consulta o endpoint a cada 30s e sobrepõe o estado real (badge + último erro)
  aos valores estáticos; sem resposta do endpoint mantém a visão estática. `tests/feedHealth.test.ts` (9).

### M4 — Observabilidade, UI e evidência

**R-15 — Logs estruturados e métricas**
- *Ação:* logger JSON mínimo (sem dependência nova: `JSON.stringify` com nível, módulo, msg, ts,
  correlationId do tick) substituindo `console.log` nos caminhos quentes; contadores em memória
  (ticks, sinais emitidos, bloqueios do DataGate/risco, erros por feed) expostos em
  `GET /api/system/metrics` (JSON simples; Prometheus só se houver demanda).
- *Critérios:* (1) logs de tick parseáveis; (2) métricas refletem bloqueios do kill-switch;
  (3) nenhum segredo em log.
- *Arquivos:* `server/utils/logger.ts` (novo), `server.ts`, `server/services/*`.
- ✅ *Implementado (TDD):* `server/utils/logger.ts` — uma linha JSON por evento (`level`, `module`,
  `msg`, `ts`, `correlationId` opcional, `data`) com redação ANTES da serialização: chaves sensíveis
  (match por substring: `apiKey`, `GEMINI_API_KEY`, `authorization`, `token`, ...) viram `[REDACTED]`
  e padrões token-like no texto (`Bearer …`, `sk-…`, `AIza…`, `apiKey=…`) são mascarados; quebras de
  linha nos valores são escapadas pelo `JSON.stringify` (o formato de 1 linha nunca quebra).
  `server/utils/metrics.ts` — contadores em memória (`Map` + `startedAt`/`uptimeMs`), canônicos
  pré-seedados em 0, mais o prefixo `feed_errors.<feed>` (integrado ao `recordFeedFailure` do R-13).
  Caminhos quentes instrumentados no `runMarketTick` (`server.ts`): tick concluído (com duração e
  `correlationId = tick-<ts>`), sinais emitidos, suprimidos por **kill-switch** (critério 2), bloqueios
  de DataGate, limite de risco e tradingSchedule, erros de tick. Expostos em `GET /api/system/metrics`
  (JSON simples, protegido). `tests/structuredLogging.test.ts` (12).

**R-17 — Kill-switch na UI**
- *Ação:* widget no Header/SystemHealthWidget mostrando estado do halt + botão de ativação/desativação
  com confirmação e motivo, consumindo os endpoints existentes.
- *Critérios:* (1) ativar pela UI interrompe emissões no próximo tick; (2) estado visível para outros
  clientes em seguida; (3) ação aparece em `audit-logs`.
- *Arquivos:* `src/components/Header.tsx` ou `SystemHealthWidget.tsx`, `src/services/apiClient.ts`.
- ✅ *Implementado:* novo `src/components/KillSwitchPanel.tsx` — banner de halt (ativo/inativo, motivo,
  autor, timestamp), postura agregada da carteira (abertos/limite, risco % vs `maxPortfolioRiskPct`,
  emissão liberada/limitada + motivos) e botões de suspender (exige motivo ≥3 caracteres, com
  confirmação) / reativar (com confirmação), consumindo `GET /api/system/risk-status` e
  `POST /api/system/kill-switch` via `apiClient.getRiskStatus`/`setKillSwitch`. Critério 1: o POST
  alimenta `isTradingHalted()`, que o motor consulta a cada tick — a suspensão vale no próximo tick;
  critério 2: polling de 15s propaga o estado a todos os clientes; critério 3: o POST já grava em
  `audit_logs` (`KILL_SWITCH`), visível em `/api/system/audit-logs`. O painel entrou no dashboard
  (widget `kill_switch` no `DashboardGridLayout`, layouts lg/md/sm, storage bumpado para v10) e no
  topo da aba `risk`.

**R-8 — Calibração do score (depende de R-18)**
- *Ação:* com dados de paper trading reais, calcular hit-rate/expectativa por faixa de score e reajustar
  pesos/limiares; guardar a curva de calibração no banco com data e `n`.
- *Critérios:* (1) faixa sem `n` mínimo (ex.: 30 amostras) não altera pesos; (2) curva exposta na UI do
  Auto-Tuner; (3) processo repetível (script/rota), não manual.

**R-18 — Paper trading 60–90 dias (Fase 3.5)**
- *Ação:* backend mínimo que persista cada sinal emitido com decisão/stop/alvo e resolva pelo mesmo
  `evaluatePositionManagement` do live (sem execução real); relatório de expectativa, drawdown máximo,
  curva de calibração e cobertura do período.
- *Critérios:* (1) cada trade resolvido tem preço/timestamp de entrada e saída provenientes de dado real
  (`dataQuality` ok); (2) relatório só usa `origin='LIVE'`; (3) drawdown e expectativa batem com o
  recálculo independente (teste de propriedade); (4) roda 60–90 dias sem intervenção.
- *Arquivos:* `server/services/PaperTradingRecorder.ts` (novo), `server.ts`, rotas de leitura,
  `src/components/PaperTradingSandbox.tsx` (consumo).

**R-6 — WebSocket primário (maior item; planejar à parte)**
- *Ação:* inscrever `kline_1m` (preço/volume), `markPrice` (funding), `!forceOrder` (liquidações) e
  `depth` dos símbolos monitorados; REST vira backfill/verificação periódica; o `TickProcessor` passa a
  consumir o estado do WS com `source:'WS'`. Manter o limiter (R-5) para o REST remanescente.
- *Critérios:* (1) `dataQuality.source === 'WS'` em tick com feed ativo; (2) queda do WS degrada para
  REST sem fabricar dado (STALE se REST falhar); (3) reconexão com resubscribe e backoff;
  (4) latência média de preço medida e documentada.
- *Arquivos:* `server/binanceWebsocket.ts`, `server.ts`, `server/services/TickProcessor.ts`.

---

## 4. Ordem de execução sugerida

```
M1 (S–M, ~1 sessão):  R-1 ✅ → R-5 ✅ → R-16 ✅ → R-12 (se houver rede para a Binance)
M2 (M, ~1–2 sessões): R-7 ✅ → R-9 ✅ → R-10 ✅ → R-11 ✅
M3 (M, ~2 sessões):   R-3 ✅ → R-14 ✅ → R-2 ✅ → R-13 ✅
M4 (M–L, contínuo):   R-15 ✅ → R-17 ✅ → R-6 → R-18 (60–90 dias rodando) → R-8
```

Regra de ouro mantida das fases anteriores: **cada item entra com teste que falha primeiro**, e o
`phase-4` é atualizado (status por critério) à medida que os itens fecham.

## 5. Definição de pronto da Fase 4

- Todos os R-1…R-18 com critérios verificados nesta tabela (ou decisão explícita de descarte com motivo).
- `tsc` limpo, suíte verde, `npm ci` e `npm audit --omit=dev` limpos a cada marco.
- Specs 1–2.5/3 atualizadas apontando para a resolução de cada R.
- Docs (README, `docs/`) refletem o comportamento final.
