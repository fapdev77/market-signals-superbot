# Fase 2.5 (Hotfix de Integridade) + Fase 3 (Institucional) — Especificação SDD

> **Reescrita em formato SDD.** A versão anterior deste arquivo era a revisão da Fase 1/1.1/2 (veredito +
> plano), sem critérios de aceitação próprios. O veredito histórico foi preservado na seção 1; os requisitos
> da 2.5 e da Fase 3 ganham tabelas com verificação executável e status medido.
>
> **Última verificação:** 2026-09-29 · `npx tsc --noEmit` 0 erros · `npx vitest run` 19 arquivos / 154
> testes OK · `npm run build` OK · `npm audit --omit=dev` 0 vulnerabilidades.
>
> **Estado geral:** Fase 2.5 **completa**. Fase 3: 3.1 e 3.4 **implementadas**; 3.2, 3.3 e 3.5
> **pendentes** → `phase-4-remaining-gaps.md`.

---

## 1. Veredito histórico da revisão (commit `e022a58`) — preservado

**Como verifiquei:** li os diffs, rodei `tsc`, testes e `npm audit`, e subi o servidor real com `curl`.
`tsc` passava e os 99 testes passavam. `npm audit` limpo após `npm install`.

**Limites declarados:** o sandbox recebeu `403` em todos os hosts `fapi` — o feed real da Binance **não**
foi testado; o frontend (`AuthModal`) e o interior do auto-tune não foram lidos.

**Falhas encontradas na época** (todas tratadas pela 2.5, salvo indicação):

| Falha | Gravidade | Resolução |
|-------|-----------|-----------|
| Cache reconstruído sem `updatedAt` → DataGate via idade 0; `canEvaluateActiveTrades` ignorava `isDegraded` | 🔴 | 2.5.1 ✅ |
| `isDegraded`/`source` de OI/funding/LSR ignorados; ausência coagida a `0` e pontuada | 🟠 | 2.5.2 ✅ |
| Screener fabricava preços/leaders de fallback sem flag | 🟠 | 2.5.6 ✅ |
| `npm ci` quebrado (lock sem `cors`), `bun.lock` de volta, sem CI/Dockerfile/engines | 🟠 | 2.5.7 ✅ |
| CORS aceitava qualquer `*.run.app` em produção | 🟡 | 2.5.8 ✅ |
| `validateOutboundAIUrlWithDns` aplicada nos 4 caminhos de IA + test-connection + POST de modelos | 🟡 | ✅ R-1 |
| Purge `HIST-*` a cada boot (não migração versionada), ator `'ADMIN'`, colunas `origin` ausentes | 🟡 | ator ✅ (2.5.8); migração ✅ R-3 (one-time); `origin` ✅ R-2 (migração 006 + `server/demo/`) |
| Testes HTTP contra Express montado no teste | 🟡 | 2.5.9 ✅ (`createApp`) |
| Limiter não cobria OI/funding/LSR/depth (`requestJson` direto) | 🟠 | ✅ R-5 (Fase 3.2) |
| Funding interval lido de `premiumIndex` (inexistente) → sempre 8h | 🟠 | 2.5.3 ✅ |
| Backtest: lookahead, slippage duplo, `overfitRatio` default `0.85`, OI inventado, janela/cache instáveis | 🔴/🟠 | 2.5.4 ✅ (walk-forward rolante ✅ R-10; parciais ✅ R-9) |
| TradFi: lista inventada, force-add, horário UTC fixo | 🔴 | 2.5.5 ✅ (`tradingSchedule` ⚠️ R-11) |

---

## 2. Fase 2.5 — Hotfix de integridade

### 2.5.1 Cache nunca é dado fresco + TickProcessor

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 2.5.1.1 | Ticker ausente da resposta da exchange é reconstruído do cache **com o `updatedAt` original** | `resolveRawTicker` em `server/services/TickProcessor.ts` | ✅ |
| 2.5.1.2 | Ticker reconstruído do cache é marcado `source:'STALE'` | `tests/phase2-5-hotfix.test.ts` → "carries the cached timestamp and marks STALE…" | ✅ |
| 2.5.1.3 | `canEvaluateActiveTrades` rejeita `STALE` e `isDegraded` (e klines ausentes) | `server/services/DataGate.ts` + testes "propagates STALE + degraded…" e "blocks position management on a degraded (but not STALE) quote" | ✅ |
| 2.5.1.4 | Decisões de posição extraídas para função pura testável | `evaluatePositionManagement` no `TickProcessor`; `server.ts` consome as três funções | ✅ |
| 2.5.1.5 | `dataQuality.source` aceita o valor `'STALE'` | `src/types.ts` (união `WS\|REST\|CACHE\|SYNTHETIC\|STALE`) | ✅ |

### 2.5.2 Proveniência por fator

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 2.5.2.1 | OI/funding/LSR indisponíveis são **excluídos** do score (não pontuados como `0`) | `processTickerState(..., availability)` em `server/signalEngine.ts`; testes "reports Open Interest as unavailable…", "does not award Open Interest points…" | ✅ |
| 2.5.2.2 | Funding indisponível → `status:'UNAVAILABLE'` (não "mercado neutro") | `src/types.ts` + teste "marks funding UNAVAILABLE in the engine…" | ✅ |
| 2.5.2.3 | Trapped Traders não roda sem dado real de long/short | `fetchLongShortRatio` retorna `null` na falha; teste "treats a null long/short response as unavailable…" | ✅ |
| 2.5.2.4 | `unavailableFactors` listado em `dataQuality` | `src/types.ts` + `signalEngine.ts` | ✅ |
| 2.5.2.5 | LSR sine-wave e liquidações fabricadas só com `ALLOW_SYNTHETIC_DATA='true'` | `binanceService.ts` / `binanceWebsocket.ts` (`isSimulated`) | ✅ |

### 2.5.3 Intervalo de funding real

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 2.5.3.1 | Intervalo lido de `/fapi/v1/fundingInfo` (não de `premiumIndex`) | `getFundingIntervals()` em `server/binanceService.ts`, cache 1h | ✅ |
| 2.5.3.2 | Fallback explícito de 8h quando o contrato não está na resposta | `DEFAULT_FUNDING_INTERVAL_HOURS = 8` | ✅ |
| 2.5.3.3 | ⚠️ Formato real da resposta validado contra a Binance | sandbox sem rede para `fapi` — validação pendente em produção | ⚠️ **R-12** |

### 2.5.4 Backtest sem trapaça

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 2.5.4.1 | Entrada no open do candle **seguinte** ao sinal | `pendingEntry` em `server/services/BacktestEngine.ts` | ✅ |
| 2.5.4.2 | Slippage contado **uma** vez | `roundtripFee = feePct * 2` | ✅ |
| 2.5.4.3 | `overfitRatio` = OOS/IS por trade, `0` quando não computável (sem default `0.85`) | bloco "robustness is measured on profit per trade…" | ✅ |
| 2.5.4.4 | OI/funding/LSR não inventados no motor real | `backtestAvailability = { openInterest:false, funding:false, longShort:false }` + `disabledFactors` | ✅ |
| 2.5.4.5 | Premissas declaradas no resultado (funding baseline plano, fatores off) | `assumptions` em `BacktestResult` | ✅ |
| 2.5.4.6 | Janela alinhada ao boundary de 15m ou `config.asOf` | `BACKTEST_CANDLE_MS` + `BacktestConfig.asOf` | ✅ |
| 2.5.4.7 | Chave de cache inclui `days`, `seed`, `asOf` | `generateStrategyId` | ✅ |
| 2.5.4.8 | Seed sintético determinístico | `seedSyntheticKlines` com PRNG mulberry por símbolo+startTime | ✅ |
| 2.5.4.9 | Walk-forward com tuning restrito ao in-sample e janelas rolantes | `buildWalkForwardWindows` (janelas por tempo) + `aggregateWalkForward` (IS/OOS por janela) + `runAutoTune` limitado ao IS por `isOnlyUntil`; `tests/walkForwardRolling.test.ts` | ✅ |
| 2.5.4.10 | TP1 modela parcial + runner (como no live) | `resolveBacktestPosition`: 50% em TP1 (slippage) + breakeven + runner de 50% até TP2; `tests/backtestPositionResolution.test.ts` | ✅ |

### 2.5.5 TradFi real

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 2.5.5.1 | Zero símbolos hardcoded; registro vazio até a descoberta | `TRADFI_ASSETS` mutável vazio + `refreshTradfiRegistry()` no boot (`server.ts`) | ✅ |
| 2.5.5.2 | Descoberta via `exchangeInfo` com classificação estrita (null em vez de adivinhar) | `classifyTradfiContract()` | ✅ |
| 2.5.5.3 | Horário correto com DST americano (injetável para teste) | `isTradfiMarketOpen(category, at?)` via `Intl.DateTimeFormat('America/New_York')`; `tests/phase2Complete.test.ts` | ✅ |
| 2.5.5.4 | ⚠️ Linhas reais de TradFi confirmadas contra `exchangeInfo` de produção | sem rede no sandbox | ⚠️ **R-12** |

### 2.5.6 Screener honesto

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 2.5.6.1 | Fallback fabricado só com a flag | `MarketScreenerService.ts` (`ALLOW_SYNTHETIC_DATA`) | ✅ |
| 2.5.6.2 | Resumo sem dado informa `dataUnavailable` e omite leaders (em vez de inventar) | `buildFallbackSummary()` + `ScreenerScanSummary` com campos opcionais em `src/types.ts` | ✅ |
| 2.5.6.3 | UI não estoura em leaders ausentes | `ScreenerDashboard.tsx` com optional chaining | ✅ |

### 2.5.7 Build, CI, Docker

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 2.5.7.1 | `npm ci` limpo; só `package-lock.json` | executado de `node_modules` limpo; `D bun.lock` | ✅ |
| 2.5.7.2 | `engines.node` + scripts `typecheck`/`audit:prod`/`ci` | `package.json` | ✅ |
| 2.5.7.3 | CI: `npm ci` → typecheck → testes → build (Node 20/22) + audit de produção | `.github/workflows/ci.yml` | ✅ |
| 2.5.7.4 | Dockerfile multi-stage non-root com volume e healthcheck | `Dockerfile` + `.dockerignore` | ✅ |

### 2.5.8 CORS, auditoria e app real

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 2.5.8.1 | Produção aceita **apenas** `ALLOWED_ORIGINS` (sem sufixo `*.run.app`) | `server/app.ts` + `tests/appHttp.test.ts` | ✅ |
| 2.5.8.2 | Ator de auditoria real (`token:<sha256[:8]>@<ip>`) em todas as rotas | `getAuditActor` em `marketRoutes` (2×) e `systemRoutes` (4×) | ✅ |
| 2.5.8.3 | `createApp()` extraído; contrato HTTP testado contra o app real | `server/app.ts` + `tests/appHttp.test.ts` (11 testes: 401, headers, CORS, 413, `x-powered-by`) | ✅ |

---

## 3. Fase 3 — Institucional

### 3.1 Motor de sinais (resíduos da 2.2)

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 3.1.1 | Sem dados 1m/5m suficientes, o sinal fica `PENDING_VALIDATION` com flags false (sem bypass) | `buildTradeSignal`; `tests/phase3.test.ts` → "does NOT auto-confirm a signal…" | ✅ |
| 3.1.2 | Com dados suficientes, a validação multi-timeframe real roda | teste "runs the real multi-timeframe validation…" | ✅ |
| 3.1.3 | Stop avaliado **antes** dos alvos | `evaluatePositionManagement` (ordem stop → T1 → T2) | ✅ |
| 3.1.4 | Alvo tocado entre ticks (via high/low do candle) é detectado | testes "detects a target touched between ticks…", "mirrors the range logic for SHORT" | ✅ |
| 3.1.5 | Candle que toca stop **e** alvo resolve como stop | teste "prefers the stop when a candle touches both…" | ✅ |
| 3.1.6 | Ignora o range do candle em que a posição foi aberta | teste "ignores the candle range for a position opened inside that same candle" | ✅ |
| 3.1.7 | T1 ajusta breakeven a partir do high/low real do candle | `evaluatePositionManagement(range)` em `server.ts` com o candle em formação | ✅ |
| 3.1.8 | Teto para o stop em volatilidade extrema | `maxStopLossAtrMultiple` (default 2,5×) aplicado antes dos alvos, com R:R recalculado; `tests/stopLossCap.test.ts` | ✅ |

### 3.2 Ingestão — WebSocket primário + limiter único

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 3.2.1 | WebSocket como fonte principal (kline, `markPrice`, liquidações, depth) | `binanceWebsocket.ts` inalterado; REST é a fonte de fato | ⚠️ **R-6** |
| 3.2.2 | Limiter único cobre **todas** as chamadas REST (OI, funding, LSR, depth incluídos) | `requestJsonLimited` em todos; OI degrada para CACHE e LSR devolve `null` em cooldown; `tests/rateLimiterCoverage.test.ts` | ✅ |
| 3.2.3 | Health por feed com estado observável | não implementado | ⚠️ **R-13** |

### 3.3 Confiabilidade

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 3.3.1 | Nenhum handler engole exceção fatal; crash + restart supervisionado | `server.ts`: só o assertion do undici é tolerado; demais → log + `process.exit(1)`; `unhandledRejection` idem | ✅ |
| 3.3.2 | Migrações versionadas (`PRAGMA user_version`) substituem `ALTER` em try/catch vazio | `server/migrations/` v1–v5 + `schema_migrations`/`user_version`; `tests/migrations.test.ts` | ✅ |
| 3.3.3 | Um único driver SQLite (sem sql.js + libsql em paralelo) | sql.js único; `@libsql/client`/drizzle removidos; DAO unificada em `server/backtest_db/` | ✅ |
| 3.3.4 | Logs estruturados e métricas | não implementado | ⚠️ **R-15** |
| 3.3.5 | Aviso de `SQLITE_BUSY` observado em teste é tratado (serialização/WAL) | `runWithRetry`/`isBusyError` (`server/utils/dbRetry.ts`) + isolamento de banco por worker; `tests/dbRetry.test.ts` | ✅ |

### 3.4 Risco e aritmética

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 3.4.1 | Aritmética decimal exata (sem drift de ponto flutuante) | `server/utils/decimal.ts` (BigInt 8-dp); `tests/phase3.test.ts` → "avoids binary floating point drift…" | ✅ |
| 3.4.2 | Position sizing derivado da distância ao stop, com mínimo tradável | `computePositionSize`; testes "sizes from the stop distance…", "refuses a position below the tradable minimum" | ✅ |
| 3.4.3 | Limites de portfólio (concorrência, cap por categoria, orçamento de risco) | `evaluatePortfolioRisk` + `DEFAULT_RISK_LIMITS`; testes "blocks new signals once the concurrency limit…" etc. | ✅ |
| 3.4.4 | Kill-switch com motivo obrigatório e auditoria | `setKillSwitch` (reason ≥ 3) + `POST /api/system/kill-switch` (`KILL_SWITCH` audited) | ✅ |
| 3.4.5 | `GET /api/system/risk-status` expõe a postura de risco | `systemRoutes.ts` | ✅ |
| 3.4.6 | Emissão de sinal gated por kill-switch + limites no tick | `server.ts` → `isTradingHalted()` + `evaluatePortfolioRisk` antes de emitir; `openSignals` sincronizado | ✅ |
| 3.4.7 | Kill-switch observável na UI (não só via API) | não implementado | ⚠️ **R-17** |

### 3.5 Evidência / calibração

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 3.5.1 | 60–90 dias de paper trading com estatísticas só de dado real | não implementado (não há backend de paper trading) | ⚠️ **R-18** |
| 3.5.2 | Calibração do score por faixa com dado real | não implementado (limiares mortos permanecem) | ⚠️ **R-8** |
| 3.5.3 | Expectativa e drawdown calculados de dados reais | `BacktestDashboard` expõe métricas do backtest; não há trilha de paper trading real | ⚠️ **R-18** |

---

## 4. Decisões aprovadas

| # | Decisão | Resposta | Status |
|---|---------|----------|--------|
| 1 | Executar a 2.5 completa antes da Fase 3 | sim | ✅ |
| 2 | Geo-bloqueio | **não existe** (sem variável de hosts/proxy) | ✅ (decisão aplicada: sem fallback spot) |
| 3 | Backtest limitado ao período de OI disponível | sim, com aviso ao usuário sobre o período testável | ✅ (`assumptions`) |
| 4 | Specs reescritas em formato SDD | sim | ✅ (esta rodada) |

---

## 5. Pendências consolidadas

Todas as ⚠️ desta spec estão rastreadas com plano em `specs/phase-4-remaining-gaps.md`.
**Entregues em 2026-09-29:** R-1 (DNS SSRF), R-3 (migrações), R-5 (limiter total), R-7 (teto de stop),
R-9 (parciais no backtest), R-10 (walk-forward rolante), R-14 (driver único) e R-16 (`SQLITE_BUSY`).
R-2 (`origin`/`server/demo/`) foi entregue na sequência do mesmo dia e re-verificado por revisão de código
(revisão corrigiu: gate `ALLOW_SYNTHETIC_DATA` faltando no fallback do sync; SQL parametrizada nas leituras de sinais).
R-11 (`tradingSchedule` como autoridade do gate TradFi) e R-13 (health por feed com
`GET /api/system/feed-health` + badges reais) fecharam o mesmo dia, seguidos de R-15 (logger JSON
com redação de segredos + métricas em `GET /api/system/metrics`) e R-17 (painel de kill-switch e
postura de risco no dashboard e na aba de risco). Suíte: 263/263, 33 arquivos.
**Ainda abertas:** R-6 (WS primário), R-8 (calibração do score), R-12 (validação contra API real)
e R-18 (paper trading/evidência).
