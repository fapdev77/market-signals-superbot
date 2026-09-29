# Revisão das Fases 1, 1.1 e 2 (commit `e022a58`)

**Veredito:** a Fase 1.1 está boa. A Fase 2 está **parcial**: 2.1 e 2.3 avançaram bastante, mas 2.2 e 2.4 estão incompletas. Ainda há dois bugs de integridade que anulam parte do que foi construído, e o build está quebrado.

**Como verifiquei:** li os diffs, rodei `tsc`, testes e `npm audit`, e subi o servidor real com `curl`.

- `tsc` passa e os 99 testes passam.
- O servidor respondeu como esperado: 401 sem token em `/api/tickers`, `ai-models` e `database-export`; `/api/auth/status` não vaza mais token; as chaves de IA saem mascaradas; `factory-reset` exige `RESET`.
- `npm audit`: 0 vulnerabilidades no meu `npm install`.

**Limites:** o sandbox recebeu 403 em todos os hosts `fapi`, então **não testei o feed real da Binance**. Também não li o frontend (`AuthModal`) nem o interior do auto-tune.

**Sobre as specs:** `specs/phase-1-1-hotfix.md` e `specs/phase-2.md` são cópias das minhas mensagens, sem critérios de aceitação próprios. Sem eles, "pronto" fica subjetivo. Vale reescrevê-las no formato SDD.

## Fase 1 / 1.1

**Concluído ✅**

- Auth fail-closed com token aleatório no boot, sem token hardcoded e sem vazamento em `/auth/status`.
- Redação de segredos e confirmação em rotas destrutivas.
- `trust proxy`, limitador anti-força-bruta em `/auth/verify` e limite em `table-clear`.
- SSRF: a política agora é aplicada no `aiMotor` (3 caminhos) e ao salvar modelos.
- Seed falso removido; `ALLOW_SYNTHETIC_DATA` agora é lido de verdade (klines, DataGate, backtest).

**Ainda com falhas**

- **🔴 Cache tratado como dado fresco.** No tick (`server.ts` ~193), quando o símbolo não vem em `rawFutures`, o `raw` é reconstruído do cache **sem `updatedAt`**. O `processTickerState` então usa `Date.now()`, o gate vê idade zero e um preço velho pode gerar sinal e avaliar stops. Além disso, `canEvaluateActiveTrades` ignora `isDegraded` e klines ausentes.
- **🟠 Proveniência incompleta.** `fetchOpenInterest` e `fetchFundingRate` devolvem `isDegraded` e `source`, mas o `server.ts` ignora ambos. Se o histórico de OI ou o funding falham, o valor cai para `0` e entra no score como dado real.
- **🟠 Screener ainda fabrica dados.** `generateFallbackRawTickers()` não checa a flag e usa preços de referência fixos. O resumo de fallback traz um funding inventado (PEPEUSDT 0,00045). O painel mostra isso como real.
- **🟠 Build quebrado.** `npm ci` **falha** (faltam `cors` e `@types/cors` no lock). O `bun.lock` **voltou**, contrariando sua decisão 4. Segue sem CI, Dockerfile ou `engines`.
- **🟡 CORS permissivo.** Fora de produção aceita qualquer origem; em produção aceita **qualquer `*.run.app`**, de qualquer dono. `HOST` continua `0.0.0.0` por padrão e a CSP está desligada.
- **🟡 Detalhes de SSRF.** Existe `validateOutboundAIUrlWithDns`, mas as chamadas que vi usam a versão síncrona. Um Ollama remoto agora só funciona se estiver em `ALLOWED_AI_HOSTS` (mudança de comportamento).
- **🟡 Outros.** O purge de `HIST-%` roda a cada boot (não é migração versionada), o ator de auditoria é fixo `'ADMIN'`, o token é impresso no log (aceitável em dev) e as colunas `origin`/DEMO não existem.
- Os testes HTTP usam um Express **montado no teste**, e não o app do `server.ts`. Ordem de middlewares e limitadores reais só foram cobertos pelo meu smoke test.

## Fase 2

**2.1 Ingestão: ✅ com ressalvas**

- Endpoints só `fapi`, com rate limiter (peso, 429/418, backoff) e testes unitários.
- **Cobertura parcial:** o limiter só protege `fetchWithFallback`. OI, funding, long/short e depth usam `requestJson` direto e ficam fora do controle de peso.
- **Consequência:** sem os fallbacks spot, uma região com geo-bloqueio (403/451) resulta em dashboard vazio. Isso é coerente com "sem dado sintético", mas precisa de decisão de deploy.
- O WebSocket não foi alterado.

**2.2 Motor de sinais: ⚠️ parcial**

- ✅ OI real (1h/24h via `openInterestHist`) e stop ancorado em swing.
- 🟠 **Funding por contrato provavelmente não funciona:** o código lê `fundingIntervalHours` de `premiumIndex`. Pelo que sei, esse campo vem de `/fapi/v1/fundingInfo`, então cairia sempre em 8h. Não consegui confirmar contra a API; valide com uma resposta real.
- 🟠 O stop agora é o **mais distante** entre swing, suporte e ATR%, sem teto. Após uma vela volátil, o stop fica muito largo e o R:R e o tamanho implícito do risco mudam.
- ❌ **Não implementados (nada no diff):** validação real 1m/5m, confirmação de entrada, avaliação de stop/alvo por high/low de candle no live e recalibração do score (o código morto continua).

**2.3 Backtest: ⚠️ avançou, com falhas de fidelidade**

- ✅ Reusa `processTickerState`/`buildTradeSignal`, checa cada candle, stop primeiro, taxas/slippage/funding no PnL, semente fixa, recusa dado sintético.
- 🔴 **Lookahead:** o sinal usa o `close` do candle *i*, e a entrada é no `open` do mesmo candle.
- 🔴 **`isRobust` pode ser falso-positivo:** `overfitRatio` vira `0.85` fixo quando algum lucro é ≤ 0, então um OOS perdedor passa se o win rate for ≥ 45%.
- 🟠 **Entradas fabricadas no motor real:** OI simulado (`volume·close·2.5`), OI change fixo (+1,2%/+0,4%), funding fixo e sem long/short. Esses fatores viram constantes e o backtest não reproduz o live.
- 🟠 **Walk-forward é só um corte 70/30 dentro de uma única execução.** Não encontrei no diff o tuning restrito ao in-sample.
- 🟡 Slippage contado duas vezes (no preço e no `roundtripFee`). O TP1 fecha tudo, sem modelar parcial + runner com breakeven como no live. A janela é de 41 candles contra 60 no live. `(config as any)` no lugar de tipos.

**2.4 TradFi: ❌ não funcional**

- Os símbolos `NVDABUSDT`, `TSLABUSDT`, `AAPLBUSDT`, `SPYBUSDT`, `QQQBUSDT`, `EURUSDT`, `GBPUSDT` e `JPYUSDT` parecem inventados. Fontes públicas citam perpétuos de ações como `TSLAUSDT` e `PATHUSDT`, e ouro como `XAUUSDT`; os perpétuos de FX anunciados têm subjacente USD/BRL. Confirme com o `exchangeInfo` real.
- `fetchBinanceTradfiContracts()` **nunca é chamada** e, mesmo se fosse, adiciona à força todos os símbolos hardcoded ao conjunto, anulando a validação.
- Nada inscreve esses ativos nos símbolos monitorados.
- O horário está fixo em UTC (14:30–21:00), ignora horário de verão e feriados, e `/fapi/v1/tradingSchedule` não foi usado, como a spec pedia.
- O README ainda cita PETR4, VALE3 e EUR/USD.

## Próxima etapa

**Fase 2.5 (hotfix), antes de qualquer novidade.** Testes falhando primeiro:

1. **Cache/gate:** propagar `updatedAt` e `source` do cache, marcar `STALE`, e fazer `canEvaluateActiveTrades` respeitar `isDegraded`. Extrair o tick para um `TickProcessor` testável.
2. **Proveniência:** usar `isDegraded` de OI/funding/long-short e não pontuar valor ausente como `0`.
3. **Funding:** ler o intervalo de `/fapi/v1/fundingInfo`, com teste sobre resposta gravada.
4. **Backtest:** entrada no candle seguinte, `overfitRatio` sem default, walk-forward real (tuning só no in-sample, janelas rolantes), slippage contado uma vez, OI/funding históricos reais ou fatores desativados e reportados, e um `TradeManager` compartilhado entre live e backtest.
5. **TradFi:** descobrir contratos pelo `exchangeInfo` (`contractType`) no boot, remover a lista hardcoded e o "force-add", usar `tradingSchedule` e corrigir o README.
6. **Screener:** remover ou gatear o fallback fabricado.
7. **Build:** regenerar o lock, remover `bun.lock`, criar CI (`npm ci`, `tsc`, vitest, audit) e Dockerfile.
8. **CORS/rede:** allowlist exata, `HOST` documentado e ator de auditoria real.
9. **Testes:** extrair `createApp()` do `server.ts` e testar o app real.

**Fase 3 (institucional), depois do 2.5:**

- **3.1 Motor:** o que sobrou da 2.2 (validação 1m/5m real, confirmação de entrada, stop/alvo por candle, recalibração do score).
- **3.2 Ingestão:** WebSocket como fonte principal (kline, markPrice, liquidações, depth) e limiter único para todas as chamadas.
- **3.3 Confiabilidade:** banco único com migrações versionadas, remover o guard que engole exceções (crash + restart supervisionado), healthcheck por feed, logs estruturados e métricas.
- **3.4 Risco:** position sizing, limites de exposição, kill-switch e biblioteca decimal para cálculo financeiro.
- **3.5 Evidência:** 60–90 dias de paper trading, calibração do score por faixa, expectativa e drawdown, com estatísticas só de dados reais.

## Decisões que preciso de você

1. Aprova o **2.5 completo** antes da Fase 3? R: Sim, aprovado.
2. **Onde vai rodar em produção?** Se a região tiver geo-bloqueio, preciso de uma variável de hosts `fapi` configuráveis ou proxy, e de um estado "sem feed" claro na UI. R: Nao existe geo-bloqueio
3. O OI histórico da Binance cobre só ~30 dias; aceita que o fator OI seja backtestado apenas nesse período (ou que fique desativado além dele)? R: Backtest dentro do periodo disponível e aviso ao usuario sobre o periodo que pode ser testado.
4. Reescrevo as specs no formato SDD com critérios de aceitação verificáveis? R: Sim
