# Fase 2 — Ingestão, Motor de Sinais, Backtest e TradFi (Especificação SDD)

> **Reescrita em formato SDD.** A versão anterior era uma nota de plano ("proposta, somente implementar
> após a fase 1.1") sem critérios de aceitação. Cada requisito abaixo tem verificação executável e status
> medido contra o código atual.
>
> **Última verificação:** 2026-10-01 (T6.8.3) · `npx tsc --noEmit` 0 erros · `npx vitest run` verde ·
> `npm run build` OK.
>
> **Estado geral:** 2.1 e 2.3 substancialmente entregues; **2.2 foi concluída em conjunto com a Fase 3.1**;
> 2.4 funcional. Os furos de integridade que a revisão anterior apontou foram fechados pela 2.5 (ver
> `phase-2-5-and-phase-3.md`). O que continua aberto está marcado ⚠️/**PENDENTE** e rastreado em
> `phase-4-remaining-gaps.md`.

---

## 1. Objetivo

Fazer a plataforma operar sobre **dado real e verificável**: ingestão só de perps via `fapi`, motor de
sinais sem fator fabricado, backtest que reproduz o live sem lookahead e TradFi descoberto do feed real.

## 2. Ordem de execução (aprovada)

`2.1 → 2.2 → 2.3 → 2.4`, com a Fase 1.1 concluída antes. ✅ executada nessa ordem.

---

## 3. Requisitos e critérios de aceitação

### 2.1 — Ingestão

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 2.1.1 | Endpoints exclusivamente `fapi` para perps (sem fallback spot) | `REST_ENDPOINTS` / `fetchWithFallback` em `server/binanceService.ts` | ✅ |
| 2.1.2 | Controle de peso com backoff em `429`/`418` | `server/utils/binanceRateLimiter.ts` + `tests/networkResilience.test.ts` | ✅ |
| 2.1.3 | **Todas** as chamadas REST passam pelo limiter/backoff | `requestJsonLimited` cobre OI/`openInterestHist`/LSR×3/depth/klines; `tests/rateLimiterCoverage.test.ts` (7) | ✅ **implementado** (R-5) |
| 2.1.4 | WebSocket como feed principal (kline, `markPrice`, liquidações, depth) | `server/binanceWebsocket.ts` só recebe o stream existente; nenhuma inscrição nova | ⚠️ **PENDENTE** → R-6 (Fase 3.2) |
| 2.1.5 | Sem fallback spot, uma região geo-bloqueada degrada de forma explícita (sem dado sintético) | `DataGate` + `source:'STALE'`; decisão 2: **não existe geo-bloqueio** no alvo | ✅ |

### 2.2 — Motor de sinais

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 2.2.1 | Open Interest real (histórico 1h/24h via `openInterestHist`), não estimado | `fetchOpenInterest` → `openInterestHist` | ✅ (era `volume·close·2.5` no backtest) |
| 2.2.2 | Intervalo de funding lido por contrato de `/fapi/v1/fundingInfo` | `getFundingIntervals()` (cache 1h) + `DEFAULT_FUNDING_INTERVAL_HOURS = 8` | ✅ (antes lido de `premiumIndex`, sempre 8h) |
| 2.2.3 | Fator indisponível é **excluído** do score, não pontuado como `0` neutro | `processTickerState(..., availability)` + `dataQuality.unavailableFactors`; `tests/phase2-5-hotfix.test.ts` | ✅ |
| 2.2.4 | Funding indisponível é rotulado `UNAVAILABLE` (não "mercado neutro") | `fundingRateAnalysis.status` ganhou `'UNAVAILABLE'` | ✅ |
| 2.2.5 | Validação multi-timeframe real 1m/5m com klines reais | `buildTradeSignal` sem o bypass de `klines.length < 5` | ✅ (Fase 3.1) |
| 2.2.6 | Sem dado 1m/5m suficiente, o sinal fica `PENDING_VALIDATION` (não `CONFIRMED`) | `tests/phase3.test.ts` → "does NOT auto-confirm a signal when there is not enough 1m/5m data" | ✅ (Fase 3.1) |
| 2.2.7 | Stop/alvo avaliados por high/low do candle no live (não só pelo último preço) | `TickProcessor.evaluatePositionManagement(range)` | ✅ (Fase 3.1) |
| 2.2.8 | Stop tem teto (volatilidade extrema não gera stop arbitrariamente largo) | cap por ATR (`maxStopLossAtrMultiple`, default 2,5×) antes dos alvos; `tests/stopLossCap.test.ts` (6) | ✅ **implementado** (R-7) |
| 2.2.9 | Score recalibrado por faixa com dado real (remove limiares mortos) | não implementado | ⚠️ **PENDENTE** → R-8 (Fase 3.5) |
| 2.2.10 | Sine-wave de long/short e liquidações fabricadas nunca aparecem sem a flag | `fetchLongShortRatio` → `null`; `getLiquidationsSummary` gated + `isSimulated` | ✅ |

### 2.3 — Backtest verdadeiro

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 2.3.1 | Reutiliza `processTickerState`/`buildTradeSignal` (mesma cadeia do live) | `BacktestEngine.runBacktest` | ✅ |
| 2.3.2 | Sinal do candle *i* entra no **open do candle *i+1*** (sem lookahead) | `pendingEntry` em `BacktestEngine.ts` | ✅ (antes entrava no open de *i*) |
| 2.3.3 | Se stop e alvo são tocados no mesmo candle, **stop** decide | bloco "Check Stop Loss FIRST" | ✅ |
| 2.3.4 | Taxas + slippage contadas **uma vez** | `roundtripFee = feePct * 2` (slip só no preço) | ✅ (antes contava slip nos dois) |
| 2.3.5 | Custo de funding do período debita o saldo | `fundingFeePct` no `tradePnlPct` | ✅ (baseline plano 0,01%/8h, declarado em `assumptions`) |
| 2.3.6 | Breakeven e parciais modelados como no live | split 50/50 (TP1 + runner), breakeven no TP1 e taxas/funding proporcionais; `tests/backtestPositionResolution.test.ts` (8) | ✅ **implementado** (R-9) |
| 2.3.7 | Walk-forward com tuning restrito ao in-sample e janelas rolantes | `buildWalkForwardWindows`/`aggregateWalkForward` (janelas por tempo, IS/OOS por janela) + `runAutoTune` restrito ao IS via `isOnlyUntil`, com `oosValidation`/`trainedUntil`; `tests/walkForwardRolling.test.ts` (10) | ✅ **implementado** (R-10) |
| 2.3.8 | Semente fixa e determinística | `seedSyntheticKlines` com PRNG mulberry semeado por símbolo+startTime | ✅ (antes `Math.random()`) |
| 2.3.9 | `overfitRatio` sem default enganoso | razão OOS/IS por trade, `0` quando não computável | ✅ (antes `0.85` fixo) |
| 2.3.10 | Sharpe/Sortino corrigidos por anualização | `sharpeRatio`/`sortinoRatio` em `BacktestEngine.ts` + `tests/backtestMetrics.test.ts` | ✅ |
| 2.3.11 | Janela alinhada ao boundary de candle de 15m (ou `config.asOf` explícito) | `BACKTEST_CANDLE_MS` + `BacktestConfig.asOf` | ✅ |
| 2.3.12 | Chave de cache inclui `days`, `seed`, `asOf`, `walkForward` e `isOnlyUntil` | `generateStrategyId` (`v: 2`) | ✅ (antes omitia days/seed) |
| 2.3.13 | Fatores desativados e premissas são **reportados** no resultado | `BacktestResult.disabledFactors` + `assumptions` | ✅ |
| 2.3.14 | Recusa dado sintético sem a flag (erro explícito) | `runBacktest` lança erro | ✅ |
| 2.3.15 | Janela do teste dimensionada pelo período de OI disponível (~30 dias) com aviso | backtest roda no período disponível; aviso ao usuário via `assumptions` (decisão 3) | ✅ |

### 2.4 — TradFi real

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| 2.4.1 | Nenhuma lista de símbolos hardcoded/inventada | `TRADFI_ASSETS` é um array mutável **vazio** até a descoberta | ✅ |
| 2.4.2 | Contratos descobertos do `exchangeInfo` (`contractType`/`underlyingType`) | `refreshTradfiRegistry()` chamada no boot em `server.ts` | ✅ |
| 2.4.3 | Sem "force-add": validação pode falhar quando o contrato não existe | `fetchBinanceTradfiContracts()` não força símbolos | ✅ |
| 2.4.4 | Classificação em ações / FX / commodity por conjunto de ativos-base + metadados | `classifyTradfiContract()` (retorna `null` em vez de adivinhar) | ✅ |
| 2.4.5 | Horário de mercado correto em horário de verão dos EUA | `isTradfiMarketOpen(category, at?)` via `Intl.DateTimeFormat('America/New_York')` | ✅ (antes fixo UTC 14:30–21:00) |
| 2.4.6 | Consumo do `GET /fapi/v1/tradingSchedule` (feriados/horários oficiais) | não usado | ⚠️ **PENDENTE** → R-11 |
| 2.4.7 | Sem sinais com o mercado TradFi fechado | `signalEngine` usa `isTradfiMarketOpen` | ✅ |
| 2.4.8 | README/docs sem ativos TradFi inventados | — | ⚠️ **PENDENTE** → atualização de docs nesta rodada |

---

## 4. Decisões aprovadas

| # | Decisão | Resposta | Status |
|---|---------|----------|--------|
| 1 | Auth sem token configurado | gerar token aleatório no boot | ✅ |
| 2 | Executar 1.1 inteiro antes da Fase 2 | sim | ✅ |
| 3 | Ordem `2.1 → 2.2 → 2.3 → 2.4` | sim | ✅ |

---

## 5. Definir pronto

Todos os itens acima com verificação executável; os ⚠️ ficam rastreados em `phase-4-remaining-gaps.md`
(não bloqueiam o fechamento da Fase 2, mas **não** podem ser declarados prontos).
