# Fase 6 — Fechamento de gaps: base reprodutível, provas reais, evidência íntegra e motor final

> **Criado em:** 2026-09-30 · **Base:** commit `e05726d` · **Status:** concluída (2026-10-01) — marcos e checkpoints em `specs/phase-6-plan.md`; a evidência operacional (6.9) só inicia após o congelamento do motor na Fase 7 (`specs/phase-7.md`).
> **Método:** SDD — Especificar → Planejar → Decompor → Implementar → Validar. Cada item tem critérios de aceitação (CA) verificáveis e os testes que devem existir **antes** da implementação (TDD).
> **Objetivo:** fechar todos os gaps abertos desde a Fase 1, de modo que o sistema não tenha dado sintético sem rótulo, evidência com viés, suposição sem prova nem modo de falha sem alerta.

---

## 1. Decisões aprovadas

| # | Decisão |
|---|---------|
| D1 | A ordem da Fase 6 está aprovada, com **6.0 e 6.1 antes de qualquer outro item** |
| D2 | Este documento segue o formato SDD, em `specs/phase-6.md` |
| D3 | Herdadas: banco sql.js mantido; execução em servidor local no Brasil (possível DigitalOcean depois, instância única); TradFi com sinais em `REGULAR`, `PRE_MARKET` e `AFTER_MARKET` |

## 2. Estado de partida (verificado no commit `e05726d`)

**Código:** `tsc` limpo; 57 arquivos e 350 testes passando; `npm run build` ok; `npm audit --omit=dev` com 0 vulnerabilidades. **`npm ci` falha** (faltam `cors` e `@types/cors` no lock) e o `bun.lock` voltou ao repositório.

**Smoke test do operador (2026-09-30, servidor no Brasil):**
- REST `/fapi/v1/time` ok (diferença de relógio de 219 ms); `ticker/24hr` ok (787 itens); `exchangeInfo` ok (290 ms).
- WebSocket `wss://fstream.binance.com/market/stream?streams=!ticker@arr`: conectou em ~2,7 s e recebeu 5 pacotes (987 tickers) em 8 s. **Isso fecha o CA-0.5 da Fase 5**: a URL roteada funciona a partir do seu IP.

**Observações do log que geram trabalho:**
1. O `serverTime` dentro da resposta de `exchangeInfo` ficou **5.447.883 ms (~91 min) atrás** do relógio local, enquanto `/fapi/v1/time` mostrou 219 ms. A explicação mais provável é resposta em cache, mas não foi confirmada. O smoke marcou "PASSOU" sem avaliar esse número, o que é enganoso. O `ClockService` usa `/fapi/v1/time`, o que está correto.
2. REST `ticker/24hr` devolveu **787** itens e o WebSocket **987** tickers. A causa da diferença de 200 símbolos **não foi investigada** (não assumir nenhuma).
3. O smoke não cobre `tradingSchedule`, `fundingInfo`, `fundingRate`, `openInterestHist`, `depth` nem a rota `/public` do WebSocket.
4. `scripts/capture-binance-fixtures.ts` captura só `exchangeInfo` e `tradingSchedule`, trata cada falha com `console.warn` e **termina com código 0 mesmo se tudo falhar**, deixando as fixtures antigas no lugar.

**Correção da minha revisão anterior:** eu tinha marcado a Fase 2.1 como "só endpoints `fapi`". O `MarketScreenerService` ainda mantém `https://data-api.binance.vision/api/v3/ticker/24hr` (spot) como terceiro endpoint do screener de futuros, e calcula métricas fabricadas (ver G-11).

## 3. Escopo

**Dentro:** 6.0 a 6.9. **Fora:** camada de execução de ordens, multi-exchange, troca de banco, multiusuário, migração para `strict: true` (Fase 7, apenas planejada aqui), redesenho de UI.

## 4. Limites desta análise

- Não foram lidos o frontend em profundidade, o interior da matemática do `EvidenceService` nem o uso efetivo de `calculateFitnessExpectancy` no loop do auto-tune; esses pontos estão marcados **[VALIDAR]**.
- O sandbox de análise não alcança a Binance (403); toda prova real vem do seu servidor.
- Números de testes em specs anteriores são autodeclarados.

## 5. Inventário de gaps

| Ref | Gap | Sev. | Marco |
|-----|-----|------|-------|
| G-01 | `npm ci` falha; `bun.lock` presente; lock desatualizado | 🔴 | 6.0 |
| G-02 | Fixtures não são capturas reais; captura incompleta e silenciosa | 🔴 | 6.1 |
| G-03 | Smoke incompleto e com verificação enganosa de `serverTime` | 🟠 | 6.1 |
| G-04 | Divergência REST 787 × WS 987 sem explicação | 🟠 | 6.1 |
| G-05 | Ledger sem evento `EXPIRED` (viés de sobrevivência) | 🔴 | 6.2 |
| G-06 | `tradfiSession` do ledger grava a categoria (EQUITY etc.) | 🔴 | 6.2 |
| G-07 | Escritas no ledger "fire and forget", fora de transação | 🟠 | 6.2 |
| G-08 | Win rate e go/no-go ignoram sinais expirados | 🟠 | 6.2 |
| G-09 | `historical_funding` nunca é alimentada | 🔴 | 6.3 |
| G-10 | Dois gates TradFi divergentes no tick | 🟠 | 6.4 |
| G-11 | Screener: OI e funding fabricados a partir do nome do símbolo decidem o universo monitorado; fallback spot | 🔴 | 6.4 |
| G-12 | M5 ausente: decimal, filtros do exchange, `executable`, slippage | 🟠 | 6.5 |
| G-13 | Alertas cobrem só relógio e falhas de banco | 🟠 | 6.6 |
| G-14 | Validação 1m/5m e confirmação de entrada nunca implementadas; teto do stop **[VALIDAR]** | 🟠 | 6.7 |
| G-15 | Auto-tune sem split validação/holdout e fitness **[VALIDAR]** | 🟠 | 6.7 |
| G-16 | Navegador conecta direto à Binance; CSP desligada | 🟡 | 6.8 |
| G-17 | Specs 1.1 e 2 são cópias de revisões; nome de arquivo com espaços; README e OPERATIONS desalinhados | 🟡 | 6.8 |
| G-18 | Qualidade: `any`, `catch` vazios, variáveis de ambiente não documentadas | 🟡 | 6.8 |
| G-19 | Evidência operacional de ≥ 60 dias inexistente | 🔴 | 6.9 |

---

## 6. Especificação por marco

### 6.0 — Base reprodutível (G-01)

**Requisitos**
- **6.0.1** Regenerar `package-lock.json` a partir do `package.json` (`npm install --package-lock-only`) e commitar.
- **6.0.2** Remover `bun.lock` e adicionar `bun.lock` e `bun.lockb` ao `.gitignore`. Documentar no README "somente npm". Identificar e registrar a ferramenta que recria o `bun.lock` (por exemplo, o ambiente de geração do código).
- **6.0.3** O CI executa `npm ci`, `tsc --noEmit`, `vitest run`, `npm run build` e `npm audit --omit=dev` nas versões 20 e 22 do Node.
- **6.0.4** Teste de higiene do repositório que falha se existir `bun.lock`/`bun.lockb` ou se alguma dependência declarada no `package.json` estiver ausente do `package-lock.json`.

**Critérios de aceitação**
- CA-0.1 `npm ci` em clone limpo termina com código 0 (job de CI). *(Verificado localmente em 2026-09-30 com exit 0; ver detalhes em `specs/phase-6-plan.md`.)*
- CA-0.2 `tests/repoHygiene.test.ts` passa e falha ao reintroduzir `bun.lock` (verificado com um arquivo temporário).
- CA-0.3 CI verde nas versões 20 e 22.

**Testes primeiro:** `tests/repoHygiene.test.ts`. **Arquivos:** `package-lock.json`, `.gitignore`, `.github/workflows/ci.yml`, `README.md`.

---

### 6.1 — Provas reais da Binance (G-02, G-03, G-04)

**Tarefas do operador (no seu servidor):** rodar `npm run smoke:binance` e a captura de fixtures após as mudanças abaixo, commitar as saídas em `docs/evidence/` e as fixtures em `tests/fixtures/binance/`.

**Requisitos**
- **6.1.1 Smoke completo.** Incluir: `/fapi/v1/time` (falha se a diferença passar de 2 s), `exchangeInfo` (o `serverTime` é exibido apenas como informativo, sem diferença de relógio), `tradingSchedule`, `fundingInfo`, `fundingRate?symbol=BTCUSDT&limit=5`, `premiumIndex?symbol=BTCUSDT`, `openInterestHist?symbol=BTCUSDT&period=5m&limit=5`, `depth?symbol=BTCUSDT&limit=20`, klines de 1m. No WebSocket: manter `/market` (`!ticker@arr`) e adicionar uma conexão em `/public` (um stream de book ticker de um símbolo) e `!forceOrder@arr` (conectar sem mensagens conta como ok, pois o stream pode ficar calado). Imprimir o peso usado (`x-mbx-used-weight-1m`). **Código de saída diferente de 0 se qualquer verificação obrigatória falhar.** Passar pelo rate limiter.
- **6.1.2 Captura de fixtures.** Capturar: `exchangeInfo` (subconjunto `TRADIFI_PERPETUAL` mais 3 perpétuos cripto, **com `filters`**), `tradingSchedule`, `fundingInfo`, `premiumIndex` (um cripto e um TradFi), `fundingRate` (BTCUSDT e um TradFi, limite 100), `openInterestHist` (BTCUSDT, 5m e 1h) e a lista de símbolos de `ticker/24hr`. Cada arquivo inclui `_meta: { capturedAt, endpoint, query, serverTimeFromTimeEndpoint }`. O script grava primeiro em arquivos temporários e só substitui o conjunto quando **todas** as capturas passam; qualquer falha encerra com código diferente de 0 sem alterar as fixtures existentes.
- **6.1.3 Fixtures antigas** (escritas à mão) são substituídas. Os testes TradFi passam a ler as novas e devem continuar verdes ou ter o código ajustado ao que a API real devolve.
- **6.1.4 Mapeamento categoria → chave do calendário.** `TRADFI_CATEGORY_TO_SCHEDULE_MARKET` é validado contra as chaves reais do `tradingSchedule` capturado. Toda categoria de `TRADIFI_PERPETUAL` presente no `exchangeInfo` fixture precisa mapear para uma chave existente; caso contrário fica documentada como "sem calendário" e o gate fecha (fail-closed).
- **6.1.5 Reconciliação do universo.** Script `npm run audit:universe` que compara os conjuntos: símbolos do REST `ticker/24hr`, símbolos do `exchangeInfo` por `status` e `contractType`, e símbolos vistos no WS `!ticker@arr` por 10 s. Gera `docs/UNIVERSE.md` explicando a diferença 787 × 987 **a partir dos dados**.
- **6.1.6** Commitar o log do smoke de 2026-09-30 como linha de base em `docs/evidence/`.

**Critérios de aceitação**
- CA-1.1 Com `fetch` simulado, uma falha em qualquer verificação obrigatória do smoke produz código de saída 1 (teste).
- CA-1.2 Um teste falha se alguma fixture não tiver `_meta.capturedAt` ou se o `exchangeInfo` fixture tiver símbolos sem `filters`.
- CA-1.3 Simular falha de uma captura mantém as fixtures anteriores intactas e sai com código diferente de 0 (teste).
- CA-1.4 Teste de mapeamento: nenhuma categoria de `TRADIFI_PERPETUAL` do fixture fica sem chave do calendário ou sem registro de "sem calendário".
- CA-1.5 `docs/UNIVERSE.md` existe, cita a contagem real por grupo e diz qual fonte define o universo (decisão em 6.4).

**Testes primeiro:** `tests/smokeExitCode.test.ts`, `tests/fixtureCaptureAtomic.test.ts`, `tests/fixturesIntegrity.test.ts`, `tests/tradfiScheduleMapping.test.ts`.
**Arquivos:** `scripts/binance-smoke.ts`, `scripts/capture-binance-fixtures.ts`, `scripts/audit-universe.ts`, `tests/fixtures/binance/*`, `docs/evidence/*`.

---

### 6.2 — Integridade da evidência (G-05, G-06, G-07, G-08)

**Problema.** O ledger só recebe `ENTRY`, `PARTIAL`, `TARGET2` e stop/breakeven. Sinais que expiram por TTL ou reset somem da contagem, o que infla win rate e expectativa. A sessão TradFi gravada é a categoria do ativo. As escritas não são aguardadas nem transacionais.

**Requisitos**
- **6.2.1 Evento `EXPIRED`.** Toda transição `ACTIVE → EXPIRED` (TTL, redefinição de estratégia, reset manual) grava um evento `EXPIRED` com `reason` (`TTL`, `STRATEGY_RESET`, `MANUAL_RESET`). O sinal é fechado a mercado pelo último preço conhecido (inclui a parcial já realizada) e o R resultante é calculado com as mesmas taxas e slippage do backtest.
- **6.2.2 Sessão correta.** O ledger recebe `tradfiSession` (tipo de sessão calculado no sinal) e uma coluna nova `tradfi_category` (migração na próxima versão disponível em `server/migrations/index.ts`). O resumo agrega por sessão e por categoria separadamente.
- **6.2.3 Escrita confiável.** O registro do sinal no ledger ocorre na **mesma transação** do `saveSignal`. **Fail-closed:** se o ledger não puder ser gravado, o sinal não é emitido, um alerta é disparado e o símbolo é marcado como degradado. Eventos posteriores (`PARTIAL`, `TARGET2`, `STOP`, `EXPIRED`) são aguardados, com até 3 tentativas com backoff; falha persistente dispara alerta e incrementa métrica.
- **6.2.4 Reconciliação.** `reconcileLedgerWithSignals()` roda no boot: para todo sinal em `trade_signals` terminal (alvo, stop, expirado) sem evento terminal no ledger, cria o evento retroativo com `reconciled = true`. Cobre também o histórico anterior a esta correção.
- **6.2.5 Denominador completo.** Win rate, expectativa e go/no-go consideram **todos** os sinais fechados, incluindo expirados. O resumo passa a informar `expiredCount` e `expiredShare`, e quebra os expirados por motivo.
- **6.2.6 Contexto de reprodutibilidade.** Cada emissão grava `engineVersion` (hash do commit), `weightsHash` e o perfil de estratégia vigente.

**Critérios de aceitação**
- CA-2.1 Após o sweep de TTL, o ledger contém o evento `EXPIRED` e o resumo conta o sinal (teste de integração com banco temporário).
- CA-2.2 Resumo por sessão e por categoria separados para um conjunto de fixture.
- CA-2.3 Falha simulada na gravação do ledger: o sinal não é emitido e existe exatamente um alerta.
- CA-2.4 Sinais terminais sem evento no ledger ganham evento `reconciled`; rodar a reconciliação duas vezes não duplica eventos.
- CA-2.5 10 sinais com alvo e 10 expirados a preço de entrada produzem win rate de 50%, e nunca 100%.
- CA-2.6 Toda linha nova do ledger tem `engineVersion` preenchido.

**Testes primeiro:** `tests/ledgerExpired.test.ts`, `tests/ledgerTradfiSession.test.ts`, `tests/ledgerTransactional.test.ts`, `tests/ledgerReconcile.test.ts`, `tests/evidenceDenominator.test.ts`.
**Arquivos:** `server.ts`, `server/db.ts`, `server/services/EvidenceService.ts`, `server/migrations/index.ts`.

---

### 6.3 — Funding real (G-09)

**Problema.** `historicalFundingDao` só lê. Nada busca `/fapi/v1/fundingRate` nem grava em `historical_funding`, então o backtest sempre cai na taxa fixa.

**Requisitos**
- **6.3.1** `FundingSyncService`: sincronização incremental de `/fapi/v1/fundingRate` (paginação por `startTime`, até 1000 por chamada) para `historical_funding`, **idempotente** (sem duplicar registros), pelo rate limiter. Esse endpoint divide com `fundingInfo` o limite de 500 requisições por 5 min por IP, segundo a documentação.
- **6.3.2** `rateType` (`Regular`/`Special`) gravado por registro, se a resposta real o trouxer **[VALIDAR na fixture]**; adicionar coluna por migração se faltar.
- **6.3.3** Gatilhos: antes de cada backtest, garantir cobertura do intervalo do símbolo; diariamente para os símbolos monitorados, com orçamento máximo por minuto.
- **6.3.4** O backtest cobra funding por intervalo: onde houver registro real usa o real; onde não houver, usa a suposição fixa **somente naquele trecho** e declara em `assumptions`. O resultado traz `fundingCoverage` (percentual dos eventos cobertos por dado real).
- **6.3.5** O R do ledger (6.2) desconta os eventos de funding reais atravessados durante a vida do sinal, com o mesmo método do backtest.

**Critérios de aceitação**
- CA-3.1 Com `fetch` simulado devolvendo mais de 1000 registros, a sincronização pagina e grava todos; uma segunda execução não cria duplicados.
- CA-3.2 Backtest com registros gravados cobra exatamente a soma dos registros da janela (fixture real) e reporta `fundingCoverage = 100`.
- CA-3.3 Com cobertura parcial, só o trecho sem dado usa a taxa fixa e isso aparece em `assumptions`.
- CA-3.4 A sincronização respeita o limiter (teste de contagem de chamadas e peso).
- CA-3.5 R do ledger de um sinal que atravessou dois eventos de funding iguala o cálculo manual em decimal.

**Testes primeiro:** `tests/fundingSyncPaging.test.ts`, `tests/fundingSyncIdempotent.test.ts`, `tests/backtestFundingCoverage.test.ts`, `tests/ledgerFundingR.test.ts`.
**Arquivos:** `server/services/FundingService.ts`, `server/services/FundingSyncService.ts` (novo), `server/backtest_db/index.ts`, `server/services/BacktestEngine.ts`, `server/migrations/index.ts`.

---

### 6.4 — Gate TradFi único e universo de monitoramento íntegro (G-10, G-11)

**Problema.** (a) O tick usa `isTradfiMarketOpen` (cai em relógio de Nova York sem cache e ignora `contractType`), enquanto o motor usa `canGenerateSignalsForAsset`. Como PAXG/XAUT são classificados como commodity só pelo ativo-base, o gate do tick pode bloquear perpétuos cripto comuns. (b) O screener calcula `oiEstimated`, `oiChange1h/24h` e `fundingRate` a partir da soma dos códigos dos caracteres do nome do símbolo, e esses valores entram no score composto (30% OI e 15% funding) que decide o universo monitorado. Também mantém um fallback para o ticker spot e um RVOL contra benchmark fixo de 50 milhões.

**Requisitos**
- **6.4.1 Gate único.** O tick usa somente `canGenerateSignalsForAsset`. `isTradfiMarketOpen` deixa de ser chamado no caminho ao vivo (remover ou reduzir a um invólucro não usado).
- **6.4.2 Escopo do gate.** O gate se aplica só a `contractType == TRADIFI_PERPETUAL`. O registro passa a expor `scheduleGated` por símbolo. PAXG/XAUT seguem com categoria informativa, sem bloqueio por calendário.
- **6.4.3 Sem fallback spot.** Remover `data-api.binance.vision/api/v3/ticker/24hr` do screener. Se os endpoints `fapi` falharem, o screener retorna vazio, marca o feed como degradado e não inventa dados.
- **6.4.4 Sem métricas fabricadas.** Proibido derivar OI, variação de OI ou funding do nome do símbolo. Fontes: funding de `premiumIndex` (chamada em lote, **[VALIDAR o peso]**), OI de `openInterestHist` apenas para os N melhores candidatos por volume e momento, com cache de 5 min. Dado ausente vira `null` e o fator sai do score, que é renormalizado entre os fatores disponíveis; a resposta traz `availableFactors`. A UI mostra "n/d". A anualização de funding usa o intervalo real do contrato (8 h apenas como padrão, de acordo com `fundingInfo`).
- **6.4.5 RVOL real.** Volume 24h dividido pela média de 20 dias do próprio símbolo (klines diários, cache de 24 h) para os N melhores por volume (padrão 60). Fora do top-N, `rvol: null`. Sem benchmark fixo.
- **6.4.6 Universo.** Definido por `exchangeInfo` com `status == TRADING`, `contractType` em `PERPETUAL` ou `TRADIFI_PERPETUAL` e moeda de cotação configurável (padrão USDT; USDC opcional por variável), no lugar de `endsWith('USDT')` sobre a lista do ticker. A decisão final considera o `docs/UNIVERSE.md` do 6.1.5.

**Critérios de aceitação**
- CA-4.1 Teste no fluxo do tick: num sábado, perpétuo `PERPETUAL` lastreado em ouro **não** é bloqueado; `TRADIFI_PERPETUAL` de ações é bloqueado em `OVERNIGHT` e liberado em `REGULAR`, `PRE_MARKET` e `AFTER_MARKET`.
- CA-4.2 Com `fapi` indisponível, o screener retorna lista vazia, feed degradado, e nenhuma requisição a `/api/v3/` é feita (teste com `fetch` simulado).
- CA-4.3 Propriedade: dois símbolos com entradas idênticas e nomes diferentes recebem scores idênticos (prova que não há dependência do nome).
- CA-4.4 Sem dado de OI, o score exclui o fator e `availableFactors` não o lista; o resultado não muda se o peso de OI for alterado.
- CA-4.5 Um `exchangeInfo` fixture com símbolos em `SETTLING` ou `BREAK` não entra no universo.

**Testes primeiro:** `tests/tickTradfiGate.test.ts`, `tests/screenerNoSpotFallback.test.ts`, `tests/screenerNameIndependence.test.ts`, `tests/screenerFactorRenorm.test.ts`, `tests/universeFromExchangeInfo.test.ts`.
**Arquivos:** `server.ts`, `server/binanceService.ts`, `server/services/MarketScreenerService.ts`, `server/demo/*`.

---

### 6.5 — Precisão e executabilidade (G-12)

**Requisitos**
- **6.5.1 Decimal** (`server/utils/decimal.ts`) em PnL, taxas, slippage, R e agregações no `BacktestEngine`, `positionResolution`, ledger e `EvidenceService`. Sem `toFixed` em caminhos de cálculo; apenas na apresentação.
- **6.5.2 Filtros do exchange.** Ler `PRICE_FILTER` (`tickSize`), `LOT_SIZE` (`stepSize`, `minQty`) e o filtro de notional mínimo do `exchangeInfo` **[VALIDAR os nomes na fixture real do 6.1]**. Entrada, stop e alvos arredondados ao `tickSize` (stop arredondado para o lado conservador). O sinal traz `suggestedQuantity` (do `RiskManager`, arredondada ao `stepSize`) e `executable: false` com motivo quando a quantidade ou o notional ficam abaixo dos mínimos.
- **6.5.3 Slippage por profundidade.** Usar o book (`depth`, já sob o limiter) para estimar o impacto do notional sugerido; acima de `MAX_ESTIMATED_SLIPPAGE_PCT` (padrão 0,15%) o sinal sai `executable: false` com o motivo.

**Critérios de aceitação**
- CA-5.1 Soma das pernas de um trade igual ao total em decimal, com valores que quebram ponto flutuante (por exemplo, 0,1 + 0,2).
- CA-5.2 Teste estático falha se surgir `toFixed` nos arquivos de cálculo listados em uma configuração explícita.
- CA-5.3 Preços de sinal são múltiplos do `tickSize` da fixture; quantidade abaixo do mínimo gera `executable: false`.
- CA-5.4 Book raso produz slippage estimado acima do limite e marca o sinal.

**Testes primeiro:** `tests/decimalPnl.test.ts`, `tests/noToFixedInCalc.test.ts`, `tests/exchangeFilters.test.ts`, `tests/depthSlippage.test.ts`.

---

### 6.6 — Alertas completos (G-13)

**Requisitos**
- **6.6.1** Emissão central `emitOperationalAlert(type, severity, payload)`, sobre o `AlertService` existente e sua deduplicação. Eventos obrigatórios: `FEED_DEGRADED` (REST degradado por mais de 60 s), `WS_SILENT` (watchdog), `RATE_LIMIT_COOLDOWN` (backoff por 429/418 ativo), `KILL_SWITCH_CHANGED`, `BACKUP_FAILED`, `LEDGER_WRITE_FAILED`, `DB_SIZE_THRESHOLD`, `DB_SAVE_SLOW` (p95 acima de 500 ms), além de `CLOCK_DRIFT` e falhas de integridade, que já existem.
- **6.6.2** Falha no envio de alertas nunca lança exceção para o loop de trading.
- **6.6.3** Endpoint autenticado `POST /api/system/alerts/test` que dispara um alerta de teste pelos sinks configurados.
- **6.6.4 Heartbeat externo (opcional).** `HEARTBEAT_URL`: ping a cada 5 min, para que a ausência do sinal seja percebida por um serviço externo caso o processo inteiro morra (nenhum alerta interno consegue avisar isso).

**Critérios de aceitação**
- CA-6.1 Cada evento da lista produz exatamente um alerta dentro da janela de deduplicação (teste com sink falso).
- CA-6.2 Sink que lança erro não interrompe o tick (teste).
- CA-6.3 O endpoint de teste exige autenticação e devolve o resultado por sink.
- CA-6.4 Sem `HEARTBEAT_URL` nada é enviado; com a variável, o ping respeita o intervalo (relógio falso).

**Testes primeiro:** `tests/alertsAllEvents.test.ts`, `tests/alertSinkFailureIsolated.test.ts`, `tests/heartbeat.test.ts`.

---

### 6.7 — Motor e auto-tune rigorosos (G-14, G-15)

**Problema.** Nunca houve validação real com candles de 1m e 5m nem confirmação de entrada: o sinal nasce ativo no preço atual, e o ledger registra `ENTRY` no instante da emissão. O auto-tune usa uma única validação fora da amostra. O teto do stop não foi verificado.

**Requisitos**
- **6.7.1 Decisão de desenho antes do código.** Escrever `specs/phase-6-7-entry-confirmation.md` com as regras de confirmação (o que o candle de 1m e o de 5m precisam mostrar), aprovado pelo dono do projeto. **Não implementar regra alguma sem essa aprovação.**
- **6.7.2 Contrato.** `confirmEntry(direction, klines1m, klines5m) → { confirmed, reasons }`, pura e testável, alimentada por klines reais de 1m e 5m (buscados pelo limiter e com cache).
- **6.7.3 Estado de entrada.** O sinal nasce `PENDING_ENTRY`. Vira `ACTIVE` quando a faixa high/low de um candle toca a zona de entrada **e** `confirmEntry` confirma; expira sem preenchimento após N candles configuráveis. O evento `ENTRY` do ledger é gravado no preenchimento, não na emissão.
- **6.7.4 Teto do stop.** Verificar o cálculo atual (mais distante entre swing, suporte e ATR) e impor `MAX_STOP_PCT` por estratégia; acima dele o sinal é suprimido com motivo. Valor inicial definido a partir dos dados históricos antes de fixar **[VALIDAR]**.
- **6.7.5 Auto-tune.** Três partes: treino, validação (escolha entre candidatos) e **holdout final intocado**. O fitness do loop é a expectativa líquida com penalidade de drawdown e mínimo de trades (`calculateFitnessExpectancy`), substituindo o fitness dominado por win rate. O resultado informa `trialsCount` e o IC bootstrap do holdout; `isRobust` exige limite inferior do IC > 0 e mínimo de trades.

**Critérios de aceitação**
- CA-7.1 `confirmEntry` tem testes de tabela para cada regra aprovada em 6.7.1.
- CA-7.2 Um sinal cujo preço nunca toca a zona expira como `ENTRY_NOT_FILLED` e **não** entra no cálculo de R do ledger; não aparece evento `ENTRY`.
- CA-7.3 Stop acima de `MAX_STOP_PCT` suprime o sinal com motivo registrado.
- CA-7.4 Um espião garante que o trecho de holdout nunca é passado ao avaliador de candidatos.
- CA-7.5 Pesos com expectativa positiva só no treino terminam com `isRobust: false`; mesma semente e mesmos dados dão resultado idêntico.

**Testes primeiro:** `tests/confirmEntry.test.ts`, `tests/pendingEntryLifecycle.test.ts`, `tests/stopCap.test.ts`, `tests/autoTuneThreeWaySplit.test.ts`.
**Arquivos:** `server/signalEngine.ts`, `server/services/TickProcessor.ts`, `server/services/BacktestEngine.ts`, `server/services/autoTuneOptimizer.ts`, `server.ts`.

---

### 6.8 — Navegador, documentação e qualidade (G-16, G-17, G-18)

**Requisitos**
- **6.8.1 Fluxo de preços pelo servidor.** O servidor expõe um stream autenticado de tickers (resposta em streaming, consumida com `fetch` e `ReadableStream`, enviando `Authorization: Bearer`; o token **não** vai em URL). O hook `useBinanceWebSocket` deixa de conectar direto à Binance, de modo que os gates (qualidade de dados, TradFi, kill-switch) valem também para o que a UI mostra.
- **6.8.2 CSP.** Ativar em modo *report-only* no build de produção e endurecer depois de 1 semana sem violações inesperadas.
- **6.8.3 Specs.** Reescrever `phase-1-1-hotfix.md` e `phase-2.md` no formato SDD, com critérios e status final por item. Renomear `phase-2-5 and phase-3.md` (nome com espaços) e atualizar `phase-4-remaining-gaps.md` com o estado real. Numeração de migrações coerente com o código.
- **6.8.4 README e OPERATIONS.** Alinhar ao estado real. Explicar o `docker-compose` (`HOST=0.0.0.0` dentro do contêiner, porta publicada só em `127.0.0.1`). Runbook: restauração de backup, rotação do token, resposta a 403/451/429/418, deriva de relógio.
- **6.8.5 Qualidade.** Script `scripts/quality-baseline.ts` que mede `any` e `catch` vazios, commitado como linha de base, e etapa de CI "sem aumento". Teste estático: toda `process.env.X` usada em `server/` e `server.ts` aparece no `.env.example`. A migração para `strict: true` fica planejada para a Fase 7.

**Critérios de aceitação**
- CA-8.1 `grep` não encontra `wss://fstream.binance.com` em `src/`; o stream do servidor responde 401 sem token.
- CA-8.2 Cabeçalho `Content-Security-Policy-Report-Only` presente no build de produção (teste do app).
- CA-8.3 As specs têm CA por item e status final; nenhuma contradiz o código (checklist manual).
- CA-8.4 A contagem de `any` e de `catch` vazios não aumenta em relação à linha de base (CI).
- CA-8.5 O teste de variáveis de ambiente falha ao usar uma variável não documentada.

**Testes primeiro:** `tests/priceStreamAuth.test.ts`, `tests/cspReportOnly.test.ts`, `tests/envDocumented.test.ts`.

---

### 6.9 — Evidência operacional (G-19)

**Natureza:** operação, não código. Depende de 6.0 a 6.7 concluídos, porque a evidência só vale para um motor congelado.

**Requisitos**
- **6.9.1 Burn-in de 7 dias** (não conta para a evidência): operar ao vivo verificando alertas, reconciliação do ledger e saúde dos feeds.
- **6.9.2 Início da janela.** Marcar o commit com a tag `evidence-start`. **Congelamento:** qualquer alteração na lógica de sinais durante a janela cria uma nova `engineVersion` e uma série de evidência separada; não se mistura.
- **6.9.3 Relatório semanal** gerado por endpoint a partir de `/api/evidence/summary`: n, win rate com intervalo de Wilson, expectativa em R com IC, drawdown, expirados por motivo, por faixa de score, categoria e sessão TradFi.
- **6.9.4 Critérios go/no-go** (da Fase 5, M3.4, agora formalmente adotados **pelo dono do projeto**): n ≥ 100 sinais fechados **e** ≥ 60 dias; expectativa líquida ≥ +0,10 R com limite inferior do IC de 95% > 0; drawdown máximo ≤ 15 R; nenhuma faixa de score com expectativa negativa e n ≥ 30 permanece habilitada. Sem cumprir tudo, **não se faz alegação de desempenho**.
- **6.9.5 Calibração do score (R-8).** Somente após os limites do 6.9.4; gera relatório de recomendação por faixa, e qualquer mudança vai por configuração auditada e inicia nova série.

**Critérios de aceitação**
- CA-9.1 A tag `evidence-start` existe e o ledger tem `engineVersion` único durante a janela (consulta documentada).
- CA-9.2 O relatório semanal é gerado sem edição manual e inclui os expirados.
- CA-9.3 A decisão go/no-go é produzida pela função pura já testada, com os números do período.

---

## 7. Ordem de execução e gates

```
6.0 ─► 6.1 ─┬─► 6.2 ──┐
            ├─► 6.3 ──┼─► 6.6 ─► 6.5 ─► 6.7 ─► 6.9 (burn-in 7d + janela ≥ 60d)
            └─► 6.4 ──┘         6.8 corre em paralelo a partir de 6.2
```

- **Gate entre marcos:** `tsc` limpo, suíte verde, `npm ci` limpo, `npm audit --omit=dev` sem severidade alta, CI verde (Node 20 e 22) e os CA do marco cobertos por testes que falharam antes.
- **6.9 só começa** com 6.0 a 6.7 fechados. O 6.8 pode terminar durante a janela, desde que não altere a lógica de sinais.

## 8. Riscos

| Risco | Mitigação |
|-------|-----------|
| A API da Binance muda (há vários ajustes no changelog de 2026) | Fixtures com `_meta`, testes de contrato, recaptura mensal, leitura do changelog a cada marco |
| Falha do ledger bloqueia sinais (fail-closed) | Alerta imediato, reconciliação no boot, teste de falha |
| PENDING_ENTRY muda o perfil dos resultados | Nova `engineVersion`; evidência só após o congelamento |
| Servidor local é ponto único de falha | Heartbeat externo, backups, restart automático, kill-switch persistente |
| Overfitting no auto-tune | Holdout intocado, `trialsCount`, IC bootstrap, mínimo de trades |
| Ban de IP por scripts | Smoke e captura usam o limiter e poucas chamadas de baixo peso |

## 9. Definição de pronto da fase

1. Todos os CA cobertos por testes que falharam antes da implementação.
2. `npm ci`, `tsc --noEmit`, `vitest`, `npm run build` e `npm audit --omit=dev` limpos, CI verde.
3. Fixtures reais, saídas do smoke e do `audit:universe` commitadas.
4. Nenhuma métrica derivada do nome do símbolo, nenhum endpoint spot no caminho de futuros, nenhum dado sintético fora de `ALLOW_SYNTHETIC_DATA`.
5. Ledger sem viés de sobrevivência, com reconciliação e transação.
6. Alertas para todos os modos de falha listados.
7. Specs, README e OPERATIONS coerentes com o código.
8. Janela de evidência iniciada com a tag `evidence-start`.

## 10. Padrões assumidos (ajustáveis; confirmar na revisão)

1. **Expirado é fechado a mercado** no último preço conhecido (em vez de R = 0).
2. **Sem ledger, sem sinal** (fail-closed).
3. **Universo vindo do `exchangeInfo`** (`TRADING`), com USDT por padrão.
4. **RVOL real para o top 60** por volume; o restante fica `null`.
5. **Regras de confirmação de entrada** são decisão do dono do projeto (6.7.1); não há padrão proposto.
6. **`MAX_STOP_PCT`** definido por estratégia depois de olhar os dados históricos.
7. **Heartbeat externo** opcional.
8. **Congelamento do motor** durante a janela e burn-in de 7 dias.

## 11. Referências oficiais consultadas

- WebSocket Change Notice: `https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Important-WebSocket-Change-Notice`
- Trading Schedule: `https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Trading-Schedule`
- Get Funding Info: `https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Get-Funding-Rate-Info`
- Change Log (derivativos): `https://developers.binance.com/docs/derivatives/change-log`
