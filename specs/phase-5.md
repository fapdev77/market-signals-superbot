# Fase 5 — Feed, TradFi, paridade live×backtest, evidência e operação local

> **Criado em:** 2026-09-29 · **Base:** commit `e6e3b6f` · **Status:** rascunho para revisão
> **Método:** SDD — Especificar (O quê) → Planejar (Como) → Decompor (Tarefas) → Implementar → Validar.
> Cada item tem critérios de aceitação (CA) verificáveis e a lista de testes que devem existir **antes** da implementação (TDD).

---

## 1. Decisões aprovadas

| # | Decisão | Consequência direta |
|---|---------|---------------------|
| D1 | O hotfix do WebSocket (5.0) é o primeiro marco | Nenhum outro marco começa antes do M0 fechar |
| D2 | TradFi: sinais permitidos em **REGULAR, PRE_MARKET e AFTER_MARKET** | `OVERNIGHT` e `NO_TRADING` bloqueiam novos sinais (configurável, ver §9) |
| D3 | Banco permanece **sql.js**, sem trocar driver nem engine | Sem migração de banco nesta fase; mitigações no M4 |
| D4 | Execução em **servidor pessoal local no Brasil**, com expansão possível para DigitalOcean | Sem orquestrador gerenciado: supervisão, backup, alerta e relógio passam a ser responsabilidade do projeto |
| D5 | Documento no formato SDD em `specs/phase-5.md` | Este arquivo |

### Implicações derivadas (revisar)

- **sql.js é instância única.** O banco inteiro vive em memória e o arquivo é regravado; duas instâncias não podem compartilhar o mesmo arquivo. Expandir para a DigitalOcean significa mover a **mesma** instância, não escalar horizontalmente. O M4 define gatilhos objetivos para reabrir a decisão do banco.
- **Disco local é persistente**, mas sem backup automático. O M4 cobre backup, verificação de integridade e retenção.
- **Exposição de rede é do operador.** A aplicação deve subir em `127.0.0.1` por padrão; acesso remoto só por proxy reverso com TLS ou VPN.
- **Acesso da Binance a partir do IP do servidor brasileiro não foi verificado.** O sandbox de análise recebeu 403 em todos os hosts `fapi`, então a validação depende de um script de smoke executado no seu servidor (M0).

---

## 2. Escopo

**Dentro:** M0 (WebSocket), M1 (TradFi), M2 (paridade live×backtest), M3 (evidência operacional), M4 (operação local), M5 (precisão e executabilidade), M6 (higiene documental).

**Fora (não tratar nesta fase):** camada de execução de ordens, multi-exchange, troca de banco, autenticação multiusuário, migração para `strict: true` (Fase 6), redesenho de UI.

## 3. Limites da análise que gerou esta spec

- Nenhuma resposta real da API da Binance foi capturada. Itens marcados **[VALIDAR]** dependem das fixtures do M1.
- Não foram lidos: frontend em profundidade, `appHttp.test.ts`, lógica interna do teto de stop, `npm run build`.
- Os números de "testes passando" nas specs anteriores são autodeclarados; foram confirmados apenas `tsc` limpo e 263 testes verdes no commit-base.

## 4. Inventário

| Ref | Título | Severidade | Esforço | Marco |
|-----|--------|-----------|---------|-------|
| R-19 | URLs legadas do WebSocket (desativadas em 2026-04-23) | 🔴 crítica | S | M0 |
| R-20 | Gate de calendário TradFi: escopo e política de sessões | 🟠 alta | M | M1 |
| R-12 | Fixtures reais (`exchangeInfo`, `tradingSchedule`, `fundingInfo`) | 🟠 alta | S | M0/M1 |
| R-21 | Funding real por trade no backtest | 🟠 alta | M | M2 |
| R-22 | OI e long/short históricos no backtest, com cobertura reportada | 🟡 média | M | M2 |
| R-23 | Paridade live×backtest (janela de candles e gestão de posição) | 🟠 alta | M | M2 |
| R-24 | Objetivo do auto-tune e holdout final | 🟠 alta | M | M2 |
| R-18 | Livro-razão de sinais no servidor + evidência | 🟠 alta | L | M3 |
| R-8 | Calibração do score por faixa (só com dado real) | 🟡 média | M | M3 |
| R-25 | Kill-switch e limites de risco persistentes | 🟠 alta | S | M4 |
| R-26 | Backup, integridade e retenção do banco (sql.js) | 🟠 alta | M | M4 |
| R-27 | Deriva de relógio local × exchange | 🟠 alta | S | M4 |
| R-28 | Alertas operacionais | 🟠 alta | M | M4 |
| R-29 | Token: log, arquivo, guarda de teste | 🟡 média | S | M4 |
| R-30 | Exposição de rede, CSP e WebSocket direto do navegador | 🟡 média | M | M4 |
| R-31 | Decimal em PnL, taxas e ledger | 🟡 média | M | M5 |
| R-32 | Filtros do `exchangeInfo` (tick, step, notional) | 🟡 média | M | M5 |
| R-33 | Estimativa de slippage por profundidade do book | 🟡 média | S | M5 |
| R-34 | Higiene documental e de código | 🟡 média | S | M6 |

---

## 5. Especificação por marco

### M0 — Hotfix do WebSocket (R-19, R-12 parcial)

**Problema.** A documentação oficial informa que as URLs legadas (`wss://fstream.binance.com/ws` e `/stream`) deixam de existir em 2026-04-23; conexões sem caminho roteado só recebem o endpoint `/public`, e `!ticker@arr` e `!forceOrder@arr` pertencem ao `/market`. O código ainda conecta em `wss://fstream.binance.com/ws/!ticker@arr` (`server/binanceWebsocket.ts:110`) e `/ws/!forceOrder@arr` (`:291`); o hook do frontend também (`src/hooks/useBinanceWebSocket.ts:22`).

**Requisitos**
- **M0.1 Reprodução antes do conserto.** Criar `scripts/binance-smoke.ts` (`npm run smoke:binance`) que, do servidor do operador, testa: REST `fapi` (`/fapi/v1/time`, `ticker/24hr`, `exchangeInfo`), e WebSocket por 20 s contando mensagens em `!ticker@arr`. Rodar contra o código **atual** e anexar a saída ao PR (comprova ou refuta a hipótese).
- **M0.2** Módulo único `buildFuturesWsUrl(category, streams[])` com `category ∈ {public, market, private}`, modo `stream` (`/<category>/stream?streams=a/b`). Rejeita combinar categorias diferentes na mesma conexão.
- **M0.3** Ticker e liquidações usam `/market`. Depth e bookTicker (quando usados) usam `/public`.
- **M0.4 Watchdog de silêncio** apenas para `!ticker@arr` (publica continuamente): sem mensagem por `WS_SILENCE_MS` (padrão 15 s) → feed `ws` degradado e reconexão forçada. Sem watchdog para `!forceOrder@arr` (pode ficar legitimamente calado).
- **M0.5 Reconexão** com backoff exponencial + jitter (teto 60 s), zerando ao receber mensagem saudável. Rotação preventiva da conexão respeitando o limite de vida documentado na página *Connect* **[VALIDAR o valor]**.
- **M0.6** `feed-health` expõe `lastMessageAt`, `reconnects` e `state` reais do WS.
- **M0.7** Frontend: URLs migradas; remover o fallback para `wss://stream.binance.com/ws/!ticker@arr` (spot) ou rotulá-lo como não-perp na UI, pois mistura preço spot com sinais de perpétuo. Atualizar textos de `BinanceConnectionPanel.tsx` e README.

**Critérios de aceitação**
- CA-0.1 Teste com servidor WS falso comprova que o caminho pedido começa com `/market/`.
- CA-0.2 `buildFuturesWsUrl` lança erro ao misturar `market` e `public` (teste).
- CA-0.3 Com relógio falso, 15 s sem mensagem marcam `ws` como degradado e disparam reconexão; mensagem seguinte restaura `healthy` (teste).
- CA-0.4 `grep -rn "fstream.binance.com/ws" server src` retorna vazio.
- CA-0.5 Saída do `smoke:binance` no servidor do operador mostra mensagens recebidas em `/market` (anexada ao PR).

**Testes primeiro:** `tests/wsUrlBuilder.test.ts`, `tests/wsWatchdog.test.ts`, `tests/wsReconnectBackoff.test.ts`.
**Arquivos prováveis:** `server/binanceWebsocket.ts`, `server/utils/wsUrl.ts` (novo), `src/hooks/useBinanceWebSocket.ts`, `src/components/BinanceConnectionPanel.tsx`, `scripts/binance-smoke.ts`.

---

### M1 — TradFi: política de sessões, escopo do gate e fixtures reais (R-20, R-12)

**Problema.** (a) O gate hoje libera apenas `REGULAR` e `OVERNIGHT` e bloqueia pré e pós-mercado, contrariando a decisão D2. (b) O calendário se aplica por categoria, e ativos como PAXG/XAUT podem ser perpétuos cripto comuns que negociam 24/7 sem depender do calendário. (c) A chave do calendário para FX é uma suposição **[VALIDAR]**: a documentação consultada descreve `EQUITY` e `COMMODITY` (o changelog cita depois mercados adicionais, como KR_EQUITY). (d) Sem calendário válido, o código cai em relógio de Nova York, e um TradFi com calendário desconhecido deveria falhar fechado.

**Requisitos**
- **M1.1 Fixtures.** `scripts/capture-binance-fixtures.ts` grava em `tests/fixtures/binance/` (com data de captura): subconjunto `TRADIFI_PERPETUAL` do `exchangeInfo` (mais 3 perpétuos cripto comuns), `tradingSchedule`, `fundingInfo`, `premiumIndex` (1 símbolo), `openInterestHist` (1 símbolo). Endpoints públicos, sem credenciais. Rodar no servidor do operador (respeitando o rate limiter).
- **M1.2** Classificação deriva dos campos reais capturados. Teste garante que **todo** `TRADIFI_PERPETUAL` da fixture é classificado; qualquer exceção fica numa lista explícita e documentada.
- **M1.3 Escopo do gate.** O calendário só bloqueia símbolos com `contractType == TRADIFI_PERPETUAL`. Perpétuos cripto comuns (`PERPETUAL`) nunca são bloqueados por calendário, mesmo que o ativo seja lastreado em ouro.
- **M1.4 Política de sessões.** `getTradfiSession(symbol, at)` devolve `{ type, startsAt, endsAt }` ou `null`. Sessões permitidas por padrão: `REGULAR`, `PRE_MARKET`, `AFTER_MARKET` (env `TRADFI_ALLOWED_SESSIONS`). `OVERNIGHT` e `NO_TRADING` bloqueiam **novos** sinais; posições abertas continuam sendo gerenciadas.
- **M1.5 Fail-closed.** Sem calendário oficial válido para a categoria do símbolo, não emitir novos sinais TradFi. O fallback por relógio de Nova York passa a ser opt-in (`TRADFI_SCHEDULE_FALLBACK=clock`) e registra a suposição.
- **M1.6 Salvaguardas de sessão estendida** *(proposta, ajustável)*: o sinal carrega `tradfiSession`; em `PRE_MARKET` e `AFTER_MARKET` o score mínimo sobe `TRADFI_EXTENDED_MIN_SCORE_BONUS` pontos (padrão 5), pois a liquidez tende a ser menor. UI e `GET /api/tradfi/assets` mostram a sessão vigente.
- **M1.7** *(opcional, avaliar)* Stream `tradingSession` (atualização de 1 s, mensagens separadas por mercado) como fonte complementar ao cache diário. **[VALIDAR]** em qual endpoint (`/market` ou `/public`) ele é roteado antes de implementar.
- **M1.8** Ajustes de texto: README e comentários do `binanceService.ts` que afirmam "verificado contra a API real" só permanecem se as fixtures do M1.1 sustentarem.

**Critérios de aceitação**
- CA-1.1 Com relógio injetável e fixture, cada tipo de sessão produz o veredito esperado (REGULAR/PRE/AFTER permitem; OVERNIGHT/NO_TRADING bloqueiam).
- CA-1.2 Num sábado, um símbolo `PERPETUAL` lastreado em ouro **não** é bloqueado; um `TRADIFI_PERPETUAL` de ações é.
- CA-1.3 Com `tradingSchedule` indisponível, nenhum novo sinal TradFi é emitido e a métrica `tradingScheduleBlocks` incrementa.
- CA-1.4 Sinal em `PRE_MARKET` com score entre `minScore` e `minScore+5` é suprimido; acima disso é emitido com `tradfiSession='PRE_MARKET'`.
- CA-1.5 Nenhum `TRADIFI_PERPETUAL` da fixture fica sem categoria fora da lista documentada.

**Testes primeiro:** `tests/tradfiSessionPolicy.test.ts`, `tests/tradfiGateScope.test.ts`, `tests/tradfiClassificationFixture.test.ts`.
**Arquivos prováveis:** `server/binanceService.ts`, `server.ts`, `server/routes/marketRoutes.ts`, `scripts/capture-binance-fixtures.ts`, `tests/fixtures/binance/*`.

---

### M2 — Paridade live×backtest (R-21, R-22, R-23, R-24)

**Problema.** O backtest está metodologicamente melhor, mas ainda avalia outra estratégia: OI, funding e long/short ficam desligados; o funding é uma taxa fixa de 0,01%/8h; a janela de indicadores é de 41 candles no backtest contra 60 no live; e a gestão de posição existe em duas implementações diferentes (o backtest realiza 50% no TP1 e leva o restante ao TP2; o live só move o stop para breakeven e fecha no TP2, sem registrar a parcial).

**Requisitos**
- **M2.1 Funding real.** Tabela `historical_funding` (nova migração; o código está hoje na v6, e a spec anterior falava em v1–v5) alimentada por `GET /fapi/v1/fundingRate`. O backtest cobra o funding em cada instante de funding atravessado com a posição aberta, com sinal conforme a direção. Registros com `rateType = Special` (funding adicional por dividendos de ações) entram no custo e são reportados em separado. `fundingRate` e `fundingInfo` compartilham o limite de 500/5min/IP: a sincronização deve passar pelo limiter e ser incremental.
- **M2.2 Fatores históricos.** OI e long/short entram no backtest **apenas** onde há histórico. A janela máxima dos endpoints `/futures/data/*` deve ser confirmada na documentação oficial **[VALIDAR]**. O resultado inclui `factorCoverage` (percentual de candles com cada fator) e `reducedFactorSet: true` quando a cobertura de qualquer fator for menor que 100%.
- **M2.3 Janela única.** Constante compartilhada `SIGNAL_LOOKBACK_CANDLES` usada por `server.ts` e pelo `BacktestEngine`.
- **M2.4 Gestão de posição única.** Extrair uma função pura (`resolvePosition`) usada pelo live (`evaluatePositionManagement`) e pelo backtest, com parcial de 50% no TP1, breakeven e runner até o TP2. O live passa a registrar as pernas (`PARTIAL`, `RUNNER`/`BREAKEVEN`/`STOP`) para o ledger do M3.
- **M2.5 Teste de paridade.** Fixture com candles e entradas derivadas gravadas: o caminho live (`processTickerState` + `buildTradeSignal`) e o caminho do backtest geram o mesmo sinal (direção, stop, alvos) e o mesmo resultado para a mesma sequência de preços.
- **M2.6 Auto-tune.** Fitness passa a ser expectativa líquida por trade (após custos), com penalidade de drawdown e mínimo de trades (padrão 30 no treino e 15 no OOS), no lugar do peso de 35% em win rate. Divisão em três partes: treino, validação (escolha entre candidatos) e **holdout final intocado**. O resultado informa `trialsCount` (quantos candidatos foram avaliados) e um intervalo de confiança bootstrap da expectativa no holdout; `isRobust` exige limite inferior do IC > 0.

**Critérios de aceitação**
- CA-2.1 Trade de 24 h com duas passagens de funding tem custo igual à soma dos registros reais da fixture (teste); sem dados de funding, o resultado declara a suposição.
- CA-2.2 Backtest sobre janela sem histórico de OI retorna `reducedFactorSet: true` e cobertura < 100%.
- CA-2.3 Uma única implementação de resolução de posição; `grep` mostra o live e o backtest importando a mesma função.
- CA-2.4 Teste de paridade passa com sinais idênticos nas duas rotas.
- CA-2.5 Mesma semente e mesmos dados produzem resultado idêntico; mudar a semente altera os candidatos, mas o holdout é o mesmo conjunto.
- CA-2.6 Um conjunto de pesos com expectativa positiva só no treino termina com `isRobust: false`.

**Testes primeiro:** `tests/backtestFundingReal.test.ts`, `tests/backtestFactorCoverage.test.ts`, `tests/positionResolutionShared.test.ts`, `tests/liveBacktestParity.test.ts`, `tests/autoTuneHoldout.test.ts`.
**Arquivos prováveis:** `server/services/BacktestEngine.ts`, `server/services/TickProcessor.ts`, `server/services/HistoricalDataService.ts`, `server/migrations/index.ts`, `server.ts`.

---

### M3 — Evidência operacional (R-18, R-8)

**Problema.** Sem um livro-razão no servidor, não há como afirmar desempenho real. O paper trading atual vive só no cliente (`usePaperTrading`).

**Requisitos**
- **M3.1 Ledger append-only.** Tabelas `signal_ledger` (emissão: símbolo, categoria, direção, entrada, stop, alvos, score, fatores, fatores indisponíveis, `origin`, fonte de dados, `tradfiSession`) e `signal_events` (eventos: `PARTIAL`, `BREAKEVEN`, `TARGET2`, `STOP`, `EXPIRED`, com preço e horário). *Triggers* SQLite impedem `UPDATE` e `DELETE`. O factory reset **não** apaga o ledger sem confirmação dedicada (`{ confirm: "RESET_LEDGER" }`).
- **M3.2 Resultado em R.** Cada sinal fechado registra R líquido (usando as mesmas constantes de taxa e slippage do backtest), MFE e MAE calculados a partir das faixas de candle enquanto esteve aberto.
- **M3.3 Endpoint** `GET /api/evidence/summary`: por faixa de score, categoria e sessão TradFi devolve `n`, win rate com intervalo de Wilson, expectativa em R, MFE/MAE médios e drawdown da curva de R acumulado. Somente `origin = LIVE` entra por padrão.
- **M3.4 Critérios go/no-go pré-registrados** *(valores propostos, a aprovar; definidos antes de olhar dados)*: n ≥ 100 sinais fechados **e** ≥ 60 dias corridos; expectativa líquida ≥ +0,10 R com limite inferior do IC bootstrap de 95% > 0; drawdown máximo ≤ 15 R; nenhuma faixa de score com expectativa negativa e n ≥ 30 permanece habilitada. Sem cumprir tudo, o sistema **não** faz alegação de desempenho.
- **M3.5 Calibração (R-8).** Só depois de atingir os limites do M3.4. Relatório de recomendação de limiares por faixa; qualquer mudança passa por configuração auditada, nunca automática.
- **M3.6** O paper trading do cliente é rotulado na UI como simulação local, distinta do ledger.

**Critérios de aceitação**
- CA-3.1 `UPDATE`/`DELETE` em `signal_ledger` e `signal_events` falham (teste); factory reset comum preserva o ledger.
- CA-3.2 Sequência sintética de eventos (parcial, breakeven, alvo) gera o R esperado, calculado em decimal.
- CA-3.3 `summary` com dados de fixture devolve n, IC de Wilson e expectativa corretos; sinais `DEMO` não entram.
- CA-3.4 O critério go/no-go é uma função pura testada nos limites (99 vs 100 sinais, 59 vs 60 dias).

**Testes primeiro:** `tests/ledgerAppendOnly.test.ts`, `tests/ledgerResultR.test.ts`, `tests/evidenceSummary.test.ts`, `tests/goNoGo.test.ts`.
**Arquivos prováveis:** `server/migrations/index.ts`, `server/services/EvidenceService.ts` (novo), `server/routes/systemRoutes.ts`, `server.ts`.

---

### M4 — Operação local e endurecimento (R-25 a R-30) — banco mantido (D3)

**Requisitos**
- **M4.1 Rede.** `HOST` padrão `127.0.0.1`. Documentar acesso remoto por proxy reverso com TLS ou VPN. Em produção, a aplicação recusa iniciar com `HOST=0.0.0.0` sem `ALLOW_PUBLIC_BIND=true`.
- **M4.2 Kill-switch e limites de risco persistentes (R-25).** Estado em tabela `app_state` (chave/valor). Ao iniciar, o estado é carregado. **Fail-closed:** se o estado for ilegível, o sistema inicia **suspenso**. Limites de risco editáveis por endpoint validado (zod, com faixas), gravando no audit log.
- **M4.3 Integridade e backup do banco (R-26).** `PRAGMA quick_check` ao carregar; falha → restaura o backup válido mais recente ou recusa iniciar. Backup agendado (padrão a cada 6 h) copiando o arquivo já gravado, de forma atômica, para `data/backups/`, com retenção (últimos 8 mais 1 por dia por 14 dias). Documentar cópia externa (rsync/rclone) no runbook.
- **M4.4 Retenção.** Política por tabela: `historical_klines` por intervalo, `audit_logs` (padrão 365 dias), logs de IA. O **ledger nunca é podado**. Métricas de tamanho do arquivo e duração do save em `/api/system/metrics`.
- **M4.5 Gatilhos para reabrir a decisão do banco** *(valores propostos)*: arquivo > 250 MB, p95 de duração do save > 500 ms, ou necessidade de mais de uma instância. Ao cruzar qualquer um, emitir alerta e abrir spec de migração.
- **M4.6 Deriva de relógio (R-27).** No boot e a cada 10 min, comparar o relógio local com `GET /fapi/v1/time`. Deriva > 2 s marca o sistema degradado (o DataGate compara o `updatedAt` da exchange com `Date.now()`, então relógio errado gera falsos bloqueios ou falsa frescura) e dispara alerta.
- **M4.7 Alertas (R-28).** Interface `AlertSink` com sink de webhook genérico e sink de Telegram, configurados só por variáveis de ambiente (nunca por API). Eventos: feed degradado por mais de 60 s, WS silencioso, cooldown do rate limiter ativo, kill-switch acionado, falha de save ou backup, deriva de relógio, gatilho de tamanho do banco. Deduplicação por chave com intervalo mínimo (padrão 10 min).
- **M4.8 Token (R-29).** O token aleatório no boot continua (decisão anterior), com **refinamento a aprovar**: em produção o token gerado é gravado em `data/session-token` (modo 0600) e o log mostra apenas o caminho; em desenvolvimento segue no console. O token fixo de teste só é aceito com `NODE_ENV=test` **e** `VITEST` definido.
- **M4.9 Supervisão.** `docker-compose.yml` (restart `unless-stopped`, volume `./data`, healthcheck) e exemplo de unit `systemd`. Teste de desligamento gracioso: `SIGTERM` grava o banco e encerra com código 0.
- **M4.10 Navegador (R-30).** O frontend consome preços por um endpoint do servidor (SSE) em vez de conectar direto à Binance, para que os gates se apliquem e exista uma única conexão a montante. CSP passa a operar em modo *report-only* no build de produção antes de ser imposta.

**Critérios de aceitação**
- CA-4.1 Reiniciar o processo com kill-switch ligado mantém a emissão suspensa (teste de integração com banco temporário).
- CA-4.2 Estado ilegível em `app_state` faz o sistema iniciar suspenso.
- CA-4.3 Banco corrompido (arquivo truncado) é restaurado a partir do backup; sem backup válido, o processo recusa iniciar com mensagem clara.
- CA-4.4 Backup gera arquivos conforme a retenção definida (teste com relógio falso).
- CA-4.5 Deriva simulada de 3 s marca degradado e emite exatamente um alerta dentro da janela de deduplicação.
- CA-4.6 Nenhum log de produção contém o token; o arquivo de token tem modo 0600.
- CA-4.7 Boot em produção com `HOST=0.0.0.0` sem a flag falha.

**Testes primeiro:** `tests/killSwitchPersistence.test.ts`, `tests/dbIntegrityRestore.test.ts`, `tests/backupRetention.test.ts`, `tests/clockDrift.test.ts`, `tests/alertDedup.test.ts`, `tests/tokenHandling.test.ts`, `tests/bindGuard.test.ts`, `tests/gracefulShutdown.test.ts`.
**Arquivos prováveis:** `server/db.ts`, `server/services/RiskManager.ts`, `server/services/BackupService.ts`, `server/services/AlertService.ts`, `server/middleware/auth.ts`, `server/app.ts`, `docker-compose.yml`, `docs/OPERATIONS.md`.

---

### M5 — Precisão e executabilidade (R-31, R-32, R-33)

**Requisitos**
- **M5.1 Decimal.** PnL, taxas, slippage, R e agregações do ledger usam `server/utils/decimal.ts`. Sem `toFixed` em caminhos de cálculo (só em apresentação).
- **M5.2 Filtros do exchange.** Ler `PRICE_FILTER`, `LOT_SIZE` e `MIN_NOTIONAL` do `exchangeInfo` **[VALIDAR os nomes exatos nas fixtures]**. Entrada, stop e alvos são arredondados ao `tickSize` (stop arredondado para o lado conservador). O sinal traz `suggestedQuantity` (do `RiskManager`, arredondada ao `stepSize`) e `executable: false` com motivo quando a quantidade ou o notional ficam abaixo dos mínimos.
- **M5.3 Slippage por profundidade.** Usar o book (`fetchOrderBookDepth`, já sob o limiter) para estimar o impacto do notional sugerido; acima de `MAX_ESTIMATED_SLIPPAGE_PCT` (padrão 0,15%) marcar o sinal como não executável.

**Critérios de aceitação**
- CA-5.1 Soma das pernas de um trade igual ao total em decimal, em teste com valores que quebram ponto flutuante (ex.: 0,1 + 0,2).
- CA-5.2 Teste estático falha se surgir `toFixed` em arquivos de cálculo de PnL.
- CA-5.3 Preços de sinal são múltiplos do `tickSize` da fixture; sinal abaixo do `minNotional` sai com `executable: false`.
- CA-5.4 Book raso gera slippage estimado acima do limite e marca o sinal.

**Testes primeiro:** `tests/decimalPnl.test.ts`, `tests/exchangeFilters.test.ts`, `tests/depthSlippage.test.ts`.

---

### M6 — Higiene documental e de código (R-34)

- **M6.1** Reescrever `phase-1-1-hotfix.md` e `phase-2.md` no formato SDD (hoje contêm o texto das revisões), com CA verificáveis e status por item. Corrigir a numeração de migrações (v1–v5 nas specs, v6 no código).
- **M6.2** `README.md`: ingestão por WebSocket refletindo as URLs roteadas, instruções de execução local (compose e systemd), lista completa de variáveis no `.env.example`.
- **M6.3** `docs/OPERATIONS.md` (runbook): iniciar/parar, backup e restauração, rotação do token, uso do kill-switch, resposta a 403/451/429/418, deriva de relógio, gatilhos do banco.
- **M6.4** Regra de código para arquivos tocados na Fase 5: comentários em inglês, sem `any` novo, sem `catch` vazio novo. Registrar a linha de base (131 `any`, 72 `catch` vazios na primeira auditoria; remedir no início da fase) e exigir "sem regressão". A migração para `strict: true` fica para a Fase 6.

**CA-6.1** README e specs não contradizem o código (revisão manual com checklist). **CA-6.2** A contagem de `any` e de `catch` vazios não sobe em relação à linha de base.

---

## 6. Ordem de execução e dependências

```
M0 (WebSocket + smoke) ─┬─► M1 (TradFi + fixtures) ─► M2 (paridade) ─► M3 (ledger/evidência)
                        └─► M4 (operação local) ──────────────────────────────┘
M5 (precisão) depende de M3 (ledger) e das fixtures do M1
M6 acompanha cada marco e fecha por último
```

**Gate entre marcos:** o marco seguinte só começa com `tsc` limpo, suíte verde, `npm ci` limpo, `npm audit --omit=dev` sem severidade alta, CI verde nas versões 20 e 22 do Node e os CA do marco atual cobertos por teste. O M4 pode andar em paralelo ao M1/M2, mas nada em produção sem o M0.

## 7. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| A API da Binance muda com frequência (o changelog de 2026 tem várias alterações) | Fixtures com data, testes de contrato, recaptura mensal e leitura do changelog no início de cada marco |
| Pré e pós-mercado têm liquidez menor | Bônus de score, campo `tradfiSession` no ledger e análise por sessão no M3 |
| Overfitting no auto-tune | Holdout final, `trialsCount`, IC bootstrap e mínimo de trades |
| Servidor local é ponto único de falha (energia, internet) | Kill-switch persistente, alertas, backups, compose com restart automático; considerar nobreak |
| Deriva de relógio distorce o DataGate | Verificação periódica contra `/fapi/v1/time` e alerta |
| Ban de IP (418) por scripts de smoke | Smoke usa o rate limiter e poucas chamadas de baixo peso |
| sql.js cresce em memória | Retenção, métricas, gatilhos de reabertura do banco |
| Alegação de desempenho sem base | Critérios go/no-go pré-registrados; sem cumprir, sem alegação |

## 8. Definição de pronto da fase

1. Todos os CA acima cobertos por testes que falharam antes da implementação.
2. `tsc --noEmit` limpo, `vitest` verde, `npm run build` ok, `npm ci` limpo, audit sem severidade alta, CI verde.
3. Saída do `smoke:binance` e as fixtures reais commitadas.
4. README, `.env.example`, `docs/OPERATIONS.md` e specs atualizados.
5. Nenhuma afirmação de "verificado contra a API real" sem fixture que a sustente.

## 9. Pontos assumidos como padrão (ajustáveis; confirmar na revisão)

1. **OVERNIGHT bloqueado.** A decisão D2 lista regular, pré e pós; `OVERNIGHT` ficou de fora. Mudar é editar `TRADFI_ALLOWED_SESSIONS`.
2. **Bônus de score de 5 pontos** em sessões estendidas (M1.6).
3. **Critérios go/no-go** do M3.4 (100 sinais, 60 dias, +0,10 R, IC > 0, drawdown ≤ 15 R).
4. **Canal de alerta:** webhook genérico e Telegram, ambos opcionais (M4.7).
5. **Token em arquivo 0600 em produção** (M4.8), refinando a decisão anterior de token aleatório no boot.
6. **Gatilhos do banco:** 250 MB, p95 do save > 500 ms, ou mais de uma instância (M4.5).

## 10. Referências oficiais consultadas

- Important WebSocket Change Notice — Base URL Split & Migration: `https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Important-WebSocket-Change-Notice`
- Trading Schedule (`GET /fapi/v1/tradingSchedule`): `https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Trading-Schedule`
- Trading Session Stream (`tradingSession`): `https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Trading-Session-Stream`
- Get Funding Info (`GET /fapi/v1/fundingInfo`): `https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Get-Funding-Rate-Info`
- Change Log (derivativos): `https://developers.binance.com/docs/derivatives/change-log`
