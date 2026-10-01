# Fase 7 — Desbloqueio, higiene TradFi, decisão da confirmação de entrada e janela de evidência

> **Criado em:** 2026-10-01 · **Base:** commit `4726a51` · **Status:** rascunho para revisão
> **Método:** SDD — Especificar → Planejar → Decompor → Implementar → Validar. Cada item tem critérios de aceitação (CA) verificáveis e os testes que devem existir **antes** da implementação (TDD).
> **Objetivo:** fechar os gaps que sobraram da Fase 6, congelar o motor com uma decisão registrada e iniciar a janela de evidência ao vivo.

---

## 1. Decisões aprovadas

| # | Decisão |
|---|---------|
| D1 | **Remover o fallback de fixture** do registro TradFi: sem `exchangeInfo`, falha fechada com alerta |
| D2 | Lista inicial de TradFi monitorados: os **7 símbolos já fixos** (`TSLAUSDT`, `NVDAUSDT`, `AAPLUSDT`, `SPYUSDT`, `QQQUSDT`, `XAUUSDT`, `PAXGUSDT`), com teto por tick |
| D3 | **Backtest comparativo** da confirmação de entrada antes de ligar a flag |
| D4 | Entrega de um `package-lock.json` corrigido (acompanha este documento) |
| D5 | Formato SDD em `specs/phase-7.md` |
| Herdadas | Banco sql.js mantido; servidor local no Brasil (possível DigitalOcean, instância única); TradFi com sinais em `REGULAR`, `PRE_MARKET` e `AFTER_MARKET` |

## 2. Estado de partida (verificado no commit `4726a51`)

- `tsc` limpo; 98 arquivos e 545 testes passando; `npm run build` ok; `npm audit --omit=dev` com 0 vulnerabilidades.
- Gate de qualidade: 259 `any` e 12 `catch` vazios contra linha de base de 261 e 13.
- Fixtures reais commitadas (`_meta`, `filters`), `docs/UNIVERSE.md` explicando o 787 × 987 (contagem cumulativa de mensagens do WS contra símbolos únicos).
- **Bloqueador:** `npm ci` falha com `EINTEGRITY`. Os hashes de `cors@2.8.6` e `@types/cors@2.8.19` no lock não batem com os do registry (confirmado com `npm view`, com cache limpo).
- **Lock corrigido (D4), verificado em cópia limpa do commit-base:** `npm ci` exit 0, `tsc` limpo, `npm run build` ok e 545 testes passando. O arquivo foi regenerado removendo somente as duas entradas e deixando o npm resolvê-las de novo. Diferenças em relação ao lock atual: os dois hashes corrigidos; metadados `funding` de `cors`; `engines` na raiz; `dev` em dois tipos; e a **remoção de 51 entradas órfãs** (`@libsql/*`, `drizzle-orm`, `drizzle-kit`, `@esbuild-kit/*`, `libsql` e dependências). Essas já tinham saído do `package.json`; os arquivos que ainda citam esses nomes (`server/db.ts`, `server/migrations/index.ts`, `server/backtest_db/index.ts`, `tests/backtestDao.test.ts`) só os mencionam em comentários.

**Não verificado nesta fase de análise:** acesso real à Binance (sandbox bloqueado), frontend, conteúdo dos testes da "Modalidade A" e do `BacktestScheduler`, se o Docker builda, e o comportamento do registro TradFi quando o `exchangeInfo` falha depois de uma carga bem-sucedida.

## 3. Escopo

**Dentro:** 7.0 a 7.7. **Fora:** camada de execução de ordens, multi-exchange, troca de banco, multiusuário, migração para `strict: true` (Fase 8, apenas planejada aqui), redesenho de UI.

## 4. Inventário de gaps

| Ref | Gap | Sev. | Marco |
|-----|-----|------|-------|
| H-01 | `npm ci` falha por hashes inválidos no lock; teste de higiene não os detecta | 🔴 | 7.0 |
| H-02 | Docker nunca é construído no CI | 🟠 | 7.0 |
| H-03 | Registro TradFi lê `tests/fixtures/…/exchangeInfo.json` como contingência (dado velho tratado como vivo; falha em silêncio no Docker, que exclui `tests`) | 🟠 | 7.1 |
| H-04 | `getMonitoredSymbols` soma todos os `TRADFI_ASSETS` (até 213 contratos) a cada tick, sem orçamento de peso medido | 🟠 | 7.1 |
| H-05 | Comportamento de `PAXGUSDT` (perpétuo comum) e dos contratos `PREMARKET` sem teste no fluxo do tick | 🟠 | 7.1 |
| H-06 | `ENTRY_CONFIRMATION_ENABLED=false` por padrão, sem o backtest comparativo que justificaria a decisão | 🟠 | 7.2 |
| H-07 | Falha ao gravar `EXPIRED` só gera `console.warn` e métrica; reconciliação só no boot | 🟠 | 7.3 |
| H-08 | `docs/evidence/` não existe (logs de smoke, captura e universo não commitados) | 🟠 | 7.4 |
| H-09 | `BacktestScheduler` automático sem revisão (limiter, feed degradado, concorrência) | 🟠 | 7.4 |
| H-10 | Agendamento diário da sincronização de funding não confirmado | 🟡 | 7.4 |
| H-11 | Backup, kill-switch, relógio, token e falhas de rede nunca exercitados fora de teste | 🟡 | 7.5 |
| H-12 | Rótulo "WSS (fstream.binance.com)" em `SystemHealthWidget.tsx` e `BinanceConnectionPanel.tsx`; CSP só em modo report-only | 🟡 | 7.6 |
| H-13 | `BacktestEngine` usa decimal apenas em `dRound`; aritmética de PnL fora de `positionResolution` **[VALIDAR]** | 🟡 | 7.6 |
| H-14 | Sem meta de redução de `any`/`catch` vazios e sem plano executável de `strict` | 🟡 | 7.6 |
| H-15 | Evidência operacional ao vivo (≥ 60 dias) inexistente | 🔴 | 7.7 |

---

## 5. Especificação por marco

### 7.0 — Desbloqueio (H-01, H-02)

**Requisitos**
- **7.0.1** Substituir `package-lock.json` pelo arquivo entregue com este documento. Confirmar localmente `npm ci` exit 0 antes do commit.
- **7.0.2 Verificação de hashes.** Script `scripts/verify-lock.ts` (`npm run verify:lock`) que, para cada entrada do lock com `resolved` no registry oficial, consulta `https://registry.npmjs.org/<nome>/<versão>` e compara `dist.integrity` com o `integrity` do lock (concorrência limitada, com retry). Sai com código diferente de 0 se houver divergência. Roda no CI.
- **7.0.3** O teste de higiene (`tests/repoHygiene.test.ts`) passa a também validar, offline, que todo `integrity` é um `sha512-` com base64 de 64 bytes e que `resolved` e `version` são coerentes.
- **7.0.4 CI do Docker.** Novo job `docker`: `docker build` da imagem e execução do contêiner com `API_AUTH_TOKEN` definido, aguardando `GET /api/health` responder 200 em até 60 s.
- **7.0.5 Regra de processo.** Nenhuma edição manual de `package-lock.json`; ele só muda por comando npm. Exigir CI verde para merge em `main` (configuração do repositório, tarefa do operador).

**Critérios de aceitação**
- CA-0.1 `npm ci` em clone limpo termina com código 0, Node 20 e 22 (CI).
- CA-0.2 `verify:lock` retorna 0 com o lock correto e diferente de 0 com um hash adulterado (teste com registry simulado).
- CA-0.3 O teste offline falha para um `integrity` malformado.
- CA-0.4 O job `docker` fica verde: imagem constrói e `/api/health` responde 200.
- CA-0.5 CI inteiro verde em `main` após o merge.

**Testes primeiro:** `tests/verifyLock.test.ts`, extensão de `tests/repoHygiene.test.ts`.
**Arquivos:** `package-lock.json`, `scripts/verify-lock.ts`, `.github/workflows/ci.yml`, `package.json`.

---

### 7.1 — Higiene TradFi (H-03, H-04, H-05)

**Requisitos**
- **7.1.1 Sem fixture em produção (D1).** Remover de `server/binanceService.ts` a leitura de `tests/fixtures/binance/exchangeInfo.json`. Política de falha:
  - o registro mantém o **último resultado bom em memória** por até 24 h (`registryAsOf` exposto);
  - sem resultado bom, ou além de 24 h, o registro fica vazio e **nenhum sinal TradFi novo é emitido**;
  - novo alerta `TRADFI_REGISTRY_UNAVAILABLE` no catálogo operacional (com a deduplicação existente).
  - Teste estático: nenhum arquivo de `server/` ou `server.ts` referencia `tests/` ou `fixtures/`.
- **7.1.2 Lista monitorada configurável (D2).** Variável `TRADFI_MONITORED_SYMBOLS`, padrão `TSLAUSDT,NVDAUSDT,AAPLUSDT,SPYUSDT,QQQUSDT,XAUUSDT,PAXGUSDT`. `getMonitoredSymbols` passa a somar **somente** a interseção entre essa lista e o registro (status `TRADING`), e não mais todos os `TRADFI_ASSETS`. Símbolo da lista ausente do registro é ignorado, com aviso uma única vez. Teto `TRADFI_MAX_MONITORED` (padrão 10); lista maior que o teto é truncada com aviso. Remover os símbolos TradFi duplicados de `DEFAULT_SYMBOLS`, deixando a lista configurável como fonte única. `GOOGUSDT` consta do mapa de setores mas não existe no `exchangeInfo` capturado: remover do mapa.
- **7.1.3 Orçamento de peso.** O limiter registra o `x-mbx-used-weight-1m` das respostas e o expõe em `/api/system/metrics` (`binanceUsedWeight1m`). Orçamento: média por minuto ≤ 50% do limite `REQUEST_WEIGHT` do `exchangeInfo` real; alerta `RATE_LIMIT_BUDGET` ao passar de 70%. A fixture capturada **não inclui `rateLimits`**: a captura (6.1) passa a incluí-los **[VALIDAR o valor real; não assumir o limite]**. Teste de simulação: com N símbolos e relógio falso, o peso acumulado em 60 s de ticks fica dentro do orçamento.
- **7.1.4 Comportamento por tipo, no fluxo do tick** (teste no nível do `TickProcessor`/`server.ts`, não só unitário):
  - `PAXGUSDT` (`PERPETUAL`) num sábado **não** é bloqueado por calendário;
  - `TRADIFI_PERPETUAL` de ações: `OVERNIGHT` bloqueia; `PRE_MARKET`, `REGULAR` e `AFTER_MARKET` liberam;
  - `XAUUSDT` (`TRADIFI_PERPETUAL`, `COMMODITY`) segue o calendário `COMMODITY`;
  - contratos com `underlyingType` `PREMARKET` (`OPENAIUSDT`, `ANTHROPICUSDT`, `MOONSHOTUSDT`, `OURAUSDT` na fixture) **não geram sinais** (fail-closed por ausência de calendário), mesmo se incluídos na lista monitorada; política documentada no README.

**Critérios de aceitação**
- CA-1.1 Com `fetch` do `exchangeInfo` falhando no boot, o registro fica vazio, nenhum sinal TradFi sai e há exatamente um alerta na janela de deduplicação.
- CA-1.2 Com falha após carga boa, o registro bom segue valendo até 24 h; passado esse prazo, esvazia.
- CA-1.3 `grep -rn "fixtures" server server.ts` retorna vazio (teste estático).
- CA-1.4 Com a lista padrão e um registro de fixture, `getMonitoredSymbols` inclui exatamente os 7 símbolos TradFi presentes e nenhum outro; com `TRADFI_MAX_MONITORED=3`, inclui 3.
- CA-1.5 Simulação de 60 s de ticks com a lista padrão não excede o orçamento de peso.
- CA-1.6 Os quatro comportamentos da 7.1.4 verificados no fluxo do tick.

**Testes primeiro:** `tests/tradfiRegistryNoFixture.test.ts`, `tests/tradfiMonitoredList.test.ts`, `tests/tickWeightBudget.test.ts`, `tests/tickTradfiBehaviorMatrix.test.ts`, `tests/noFixturesInProduction.test.ts`.
**Arquivos:** `server/binanceService.ts`, `server/services/MarketScreenerService.ts`, `server/utils/binanceRateLimiter.ts`, `server/services/operationalAlerts.ts`, `scripts/capture-binance-fixtures.ts`, `.env.example`.

---

### 7.2 — Decisão da confirmação de entrada (H-06)

**Problema.** `ENTRY_CONFIRMATION_ENABLED=false` ficou "até o backtest comparativo", que não existe. Sem a decisão, o motor não pode ser congelado e a evidência não pode começar.

**Requisitos**
- **7.2.1 Modelo no backtest.** O `BacktestEngine` usa as **mesmas funções puras** `evaluatePendingEntry` e `confirmEntry` do live para o braço "com confirmação". Se não houver candle de 1m histórico suficiente, usar a menor granularidade disponível e **declarar a limitação** no resultado **[VALIDAR a disponibilidade de 1m]**.
- **7.2.2 Experimento pareado.** `npm run compare:entry`: mesmo período, mesmos símbolos, mesma semente e mesma `engineVersion`, mudando só a flag. Gera `docs/evidence/entry-confirmation-comparison-<data>.md` com, por braço: sinais emitidos, taxa de preenchimento, fechados, win rate, expectativa líquida em R (decimal), drawdown máximo, tempo médio até o preenchimento e parcela de `ENTRY_NOT_FILLED`; mais o IC bootstrap da **diferença** de expectativa **por sinal emitido** (não preenchido conta 0 R).
- **7.2.3 Regra de decisão pré-registrada** *(valores propostos, a aprovar antes de rodar)*: ligar a flag só se, no braço com confirmação, (a) houver pelo menos 30 trades preenchidos, (b) a diferença média de expectativa por sinal emitido for positiva e (c) o drawdown não ficar mais de 20% pior que o do controle. Caso contrário, a flag permanece desligada e o motivo é registrado.
- **7.2.4 Decisão e congelamento.** Registrar a decisão do dono do projeto em `docs/evidence/decision-entry-confirmation.md`, ajustar o padrão em `.env.example` e na documentação, e marcar o commit com a tag `engine-freeze-<sha>`.

**Critérios de aceitação**
- CA-2.1 Para o mesmo conjunto de dados, o braço sem confirmação reproduz o resultado do backtest atual (teste de regressão).
- CA-2.2 O braço com confirmação usa o mesmo código puro do live (importação compartilhada verificada por teste).
- CA-2.3 `compare:entry` com mesma semente produz relatório idêntico em duas execuções.
- CA-2.4 O relatório contém as métricas da 7.2.2 e a regra da 7.2.3 aplicada, com o veredito calculado por função pura testada nos limites (29 versus 30 trades).
- CA-2.5 `decision-entry-confirmation.md` e a tag `engine-freeze-*` existem antes de qualquer marco 7.7.

**Testes primeiro:** `tests/backtestEntryConfirmationParity.test.ts`, `tests/compareEntryDeterministic.test.ts`, `tests/entryDecisionRule.test.ts`.
**Arquivos:** `server/services/BacktestEngine.ts`, `server/services/pendingEntryLifecycle.ts`, `scripts/compare-entry.ts`, `docs/evidence/*`.

---

### 7.3 — Robustez do ledger (H-07)

**Requisitos**
- **7.3.1** Gravações de `EXPIRED` (sweep de TTL, expiração de pendente e reset) passam a usar a mesma rotina com **3 tentativas e backoff** dos demais eventos e, em falha persistente, disparam `LEDGER_WRITE_FAILED` (hoje só `console.warn` e métrica em `server/db.ts`). Refatorar para assíncrono se necessário.
- **7.3.2 Reconciliação periódica.** `reconcileLedgerWithSignals()` roda também a cada 15 minutos (`LEDGER_RECONCILE_INTERVAL_MS`) e depois de cada sweep. Se criar ao menos um evento retroativo, emite o alerta `LEDGER_RECONCILED` (severidade média, deduplicado), pois indica uma falha que passou despercebida.
- **7.3.3 Invariantes.** Métrica `ledgerInvariantViolations` em `/api/system/metrics`: sinais terminais sem evento terminal, mais eventos sem sinal. Alerta se maior que 0 depois da reconciliação.

**Critérios de aceitação**
- CA-3.1 Falha persistente simulada na gravação de `EXPIRED` produz exatamente um alerta e deixa o sinal para a reconciliação.
- CA-3.2 A reconciliação periódica corrige o sinal em até um intervalo e a métrica volta a 0.
- CA-3.3 Rodar a reconciliação duas vezes não duplica eventos (já coberto; manter o teste).
- CA-3.4 Eventos retroativos disparam `LEDGER_RECONCILED` uma única vez por janela.

**Testes primeiro:** `tests/ledgerExpiredRetry.test.ts`, `tests/ledgerPeriodicReconcile.test.ts`, `tests/ledgerInvariants.test.ts`.
**Arquivos:** `server/db.ts`, `server.ts`, `server/services/operationalAlerts.ts`.

---

### 7.4 — Prova operacional e agendadores (H-08, H-09, H-10)

**Tarefas do operador (no seu servidor):** rodar e commitar as saídas em `docs/evidence/`: log do smoke de 2026-09-30 (o que você me enviou) como linha de base, novo `npm run smoke:binance`, `npm run audit:universe` e a captura de fixtures (agora com `rateLimits`).

**Requisitos**
- **7.4.1** `docs/evidence/` versionada com os arquivos acima e um `README` listando o que cada um prova e a data.
- **7.4.2 Revisão do `BacktestScheduler`.** Requisitos verificáveis: usa o `BinanceRateLimiter` e `fetchWithFallback` (nenhuma chamada direta); não roda com feed degradado nem fora da janela configurada; nunca executa duas vezes ao mesmo tempo; tem teto de símbolos e de peso por execução; falha dispara alerta; **não aplica pesos automaticamente** (resultado de auto-tune só vira configuração por ação explícita e auditada) **[VALIDAR o comportamento atual]**.
- **7.4.3** Confirmar o agendamento diário da sincronização de funding: métrica `fundingSyncLastRunAt`, log por execução e teste com relógio falso.

**Critérios de aceitação**
- CA-4.1 `docs/evidence/` existe e contém as quatro saídas com data.
- CA-4.2 Testes do `BacktestScheduler` cobrem: passa pelo limiter, pula com feed degradado, não concorre consigo mesmo, respeita o teto, alerta em falha e não altera pesos sozinho.
- CA-4.3 Com relógio falso, a sincronização de funding roda uma vez por dia e atualiza `fundingSyncLastRunAt`.

**Testes primeiro:** `tests/backtestSchedulerGuards.test.ts`, `tests/fundingSyncSchedule.test.ts`.
**Arquivos:** `server/services/BacktestScheduler.ts`, `server/services/FundingCoverageTrigger.ts`, `docs/evidence/*`.

---

### 7.5 — Simulacro de produção (H-11)

**Natureza:** operação. Cada ensaio é executado no seu servidor e registrado em `docs/evidence/drills-<data>.md`, com procedimento, resultado esperado, evidência (trecho de log) e resultado (passou/falhou/data). Um modelo `docs/evidence/drills-template.md` acompanha a fase.

| # | Ensaio | Resultado esperado |
|---|--------|--------------------|
| D-1 | Corromper o arquivo do banco e reiniciar | Restaura o backup válido mais recente ou recusa iniciar com mensagem clara |
| D-2 | Acionar o kill-switch e reiniciar o processo | Segue suspenso após o restart |
| D-3 | Deslocar o relógio do servidor em mais de 2 s | Sistema degradado e um alerta `CLOCK_DRIFT` |
| D-4 | Rotacionar `API_AUTH_TOKEN` | Token antigo recebe 401 e o novo funciona |
| D-5 | Bloquear o host `fapi` no firewall do servidor | Feed degradado, alerta e nenhum sinal novo |
| D-6 | `kill -9` durante gravação do banco | Reinício com `quick_check` ok, sem perda do ledger |
| D-7 | `POST /api/system/alerts/test` com webhook/Telegram reais | Mensagem chega ao canal |
| D-8 | Parar o processo com `HEARTBEAT_URL` configurada | O serviço externo percebe a ausência de pings |

**Critérios de aceitação:** CA-5.1 todos os ensaios com resultado "passou" ou com problema aberto e priorizado. CA-5.2 `docs/OPERATIONS.md` ajustado conforme o que os ensaios revelarem.

---

### 7.6 — Acabamento (H-12, H-13, H-14)

**Requisitos**
- **7.6.1 Rótulos.** Em `SystemHealthWidget.tsx` e `BinanceConnectionPanel.tsx`, substituir "WSS (fstream.binance.com)" pelo estado real: stream do servidor para o navegador e, separado, o estado do WebSocket a montante (do `feed-health`).
- **7.6.2 CSP.** Com pelo menos 7 dias de modo report-only sem violações inesperadas (via `CSP_REPORT_URI` ou logs), ativar o cabeçalho `Content-Security-Policy` em produção por `CSP_ENFORCE=true` e manter o report-only desligado nesse caso. Teste do app para os dois modos.
- **7.6.3 Precisão residual.** Levar a aritmética de PnL e custos do `BacktestEngine` para decimal **[VALIDAR o que ainda é ponto flutuante]**. Teste de propriedade: o PnL total do backtest iguala a soma decimal das pernas.
- **7.6.4 Qualidade.** Metas ao fim da fase *(propostas)*: no máximo 200 `any` e 8 `catch` vazios. O `scripts/quality-baseline.json` só pode ser atualizado para baixo (catraca). Plano escrito da Fase 8 para `strict: true`, habilitando primeiro `noImplicitAny` por diretório.
- **7.6.5 Documentação.** README, `OPERATIONS.md`, `SEGURANCA.md` e `.env.example` alinhados às mudanças (variáveis novas: `TRADFI_MONITORED_SYMBOLS`, `TRADFI_MAX_MONITORED`, `LEDGER_RECONCILE_INTERVAL_MS`, `CSP_ENFORCE`). Atualizar o status final das specs 5 e 6.

**Critérios de aceitação**
- CA-6.1 Nenhum arquivo de `src/` contém a string "fstream.binance.com" em rótulos de UI.
- CA-6.2 Com `CSP_ENFORCE=true`, a resposta traz `Content-Security-Policy` (e não a versão report-only).
- CA-6.3 Teste de propriedade do PnL em decimal passa com valores que quebram ponto flutuante.
- CA-6.4 O gate de qualidade falha se `any` ou `catch` vazios subirem e atinge as metas da 7.6.4.
- CA-6.5 O teste de variáveis de ambiente documentadas continua passando com as variáveis novas.

**Testes primeiro:** `tests/uiLabelsNoLegacyWss.test.ts`, `tests/cspEnforceMode.test.ts`, `tests/backtestDecimalProperty.test.ts`.

---

### 7.7 — Evidência operacional (H-15)

**Natureza:** operação. Depende de 7.0 a 7.5 fechados e do congelamento do motor (7.2.4). O 7.6 pode terminar durante a janela se não alterar a lógica de sinais.

**Requisitos**
- **7.7.1 Burn-in de 7 dias** (não conta para a evidência): verificar alertas, reconciliação do ledger, saúde dos feeds e consumo de peso.
- **7.7.2** Marcar o commit com a tag `evidence-start`. Qualquer mudança na lógica de sinais cria uma nova `engineVersion` e uma série separada.
- **7.7.3 Relatório semanal** a partir de `/api/evidence/summary` e `/api/evidence/burnin-report`: n, win rate com intervalo de Wilson, expectativa em R com IC, drawdown, expirados por motivo, por faixa de score, categoria e sessão TradFi.
- **7.7.4 Critérios go/no-go** (da Fase 5, adotados pelo dono do projeto): n ≥ 100 sinais fechados **e** ≥ 60 dias; expectativa líquida ≥ +0,10 R com limite inferior do IC de 95% > 0; drawdown máximo ≤ 15 R; nenhuma faixa de score com expectativa negativa e n ≥ 30 permanece habilitada. Sem cumprir tudo, **não se faz alegação de desempenho**.
- **7.7.5 Calibração do score** somente depois dos limites do 7.7.4, por configuração auditada, iniciando nova série.

**Critérios de aceitação:** CA-7.1 a tag `evidence-start` existe e o ledger tem `engineVersion` único durante a janela. CA-7.2 o relatório semanal é gerado sem edição manual e inclui expirados. CA-7.3 o veredito go/no-go sai da função pura já testada, com os números do período.

---

## 6. Ordem de execução e gates

```
7.0 ─► 7.1 ─┐
       7.3 ─┼─► 7.2 ─► 7.4 ─► 7.5 ─► 7.7 (burn-in 7d + janela ≥ 60d)
            └──────────── 7.6 em paralelo, sem alterar a lógica de sinais
```

**Gate entre marcos:** `npm ci` limpo, `tsc --noEmit`, suíte verde, `npm run build`, `npm audit --omit=dev` sem severidade alta, `verify:lock`, CI verde (Node 20 e 22, mais o job `docker`) e os CA do marco cobertos por testes que falharam antes. **7.7 só começa** com a tag `engine-freeze-*` e os ensaios do 7.5 concluídos.

## 7. Riscos

| Risco | Mitigação |
|-------|-----------|
| Lock corrompido volta a entrar | `verify:lock` no CI, regra de não editar à mão, CI obrigatório para merge |
| Backtest não reproduz bem a confirmação de entrada (granularidade) | Declarar a limitação no relatório; decisão só com a regra pré-registrada |
| Registro TradFi vazio por falha prolongada | Último bom por 24 h, alerta e fail-closed |
| Lista TradFi pequena demais para gerar evidência | Aumentar `TRADFI_MONITORED_SYMBOLS` por configuração, sem mudar código, e só antes do congelamento |
| Peso REST acima do orçamento | Medição por header, alerta em 70%, teto de símbolos |
| Servidor local como ponto único de falha | Ensaios D-1 a D-8, heartbeat externo, backups |
| Alegação de desempenho sem base | Go/no-go pré-registrado; sem cumprir, sem alegação |

## 8. Definição de pronto da fase

1. CA de todos os marcos cobertos por testes que falharam antes da implementação.
2. `npm ci`, `tsc --noEmit`, `vitest`, `npm run build`, `npm audit --omit=dev` e `verify:lock` limpos; CI verde, inclusive o job `docker`.
3. Nenhum arquivo de produção lê `tests/` ou fixtures; nenhum dado sintético fora de `ALLOW_SYNTHETIC_DATA`.
4. `docs/evidence/` com smoke, universo, captura (com `rateLimits`), comparação de entrada e ensaios.
5. Decisão da confirmação de entrada registrada e motor congelado com tag.
6. Janela de evidência iniciada com `evidence-start`.

## 9. Tarefas que só o operador executa

1. Substituir `package-lock.json`, rodar `npm ci` e commitar.
2. Ativar a exigência de CI verde para merge em `main`.
3. Rodar e commitar as saídas da 7.4 (smoke, universo, captura com `rateLimits`).
4. Executar e registrar os ensaios D-1 a D-8.
5. Aprovar os valores propostos da §10 e a decisão da 7.2.3.
6. Operar os 7 dias de burn-in e a janela de evidência.

## 10. Padrões assumidos (ajustáveis; confirmar na revisão)

1. **Teto de TradFi monitorados:** 10 (`TRADFI_MAX_MONITORED`); você aprovou a lista, mas não um número.
2. **Contratos `PREMARKET` bloqueados** por falta de calendário (política conservadora).
3. **Registro TradFi:** último resultado bom por até 24 h antes de esvaziar.
4. **Orçamento de peso:** 50% do limite, alerta em 70%.
5. **Regra de decisão da 7.2.3:** 30 trades preenchidos, diferença de expectativa positiva, drawdown até 20% pior.
6. **Reconciliação periódica:** a cada 15 minutos.
7. **Metas de qualidade:** 200 `any` e 8 `catch` vazios.
8. **CSP:** passar para modo de imposição após 7 dias sem violações inesperadas.

## 11. Referências

- `specs/phase-5.md`, `specs/phase-6.md` e `docs/UNIVERSE.md` (estado anterior e linha de base de universo).
- Documentação oficial da Binance para derivativos USDⓈ-M: `https://developers.binance.com/docs/derivatives/usds-margined-futures`
