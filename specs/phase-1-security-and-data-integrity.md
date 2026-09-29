# Fase 1: Segurança e Integridade dos Dados (plano para revisão)

## 1. Objetivo e escopo

**Objetivo:** ninguém sem credencial opera ou lê segredos do sistema, e nenhum sinal, stop ou métrica nasce de dado falso sem que isso esteja explícito.

**Dentro:** autenticação, hardening de rede, proteção de segredos, correção do SSRF, validação de entrada, remoção do seed falso, proveniência de dados, bloqueio de sinais com feed degradado, TradFi simulado, correção de lockfile e vulnerabilidades do `npm audit`.

**Fora (Fases 2+):** reescrita do backtest, correções da lógica de score/OI/funding, guard de exceções, unificação sql.js/libsql, CI/Docker, camada de execução.

## 2. Especificação e critérios de aceitação

**Segurança**

- **S1** Toda rota `/api/*`, exceto `/api/health`, retorna `401` sem token válido. Em produção, o servidor **recusa iniciar** sem `API_AUTH_TOKEN`.
- **S2** O servidor escuta em `127.0.0.1` por padrão (`HOST` configurável). Há helmet, CORS por allowlist, limite de corpo de 100 kb e rate-limit global, com limite mais estrito em rotas destrutivas e de IA.
- **S3** Nenhuma resposta da API (incluindo `database-export`) contém chave de API. O GET devolve só `hasApiKey` e os últimos 4 caracteres.
- **S4** `test-connection` e chamadas de IA só alcançam hosts da allowlist do provedor. IPs privados, loopback e `169.254.169.254` são bloqueados. A chave do ambiente **nunca** é enviada a host fora da allowlist.
- **S5** Corpos e parâmetros são validados por schema (zod); entrada inválida retorna `400` com mensagem clara.
- **S6** `factory-reset` e `table-clear` exigem confirmação explícita e geram registro de auditoria.
- **S7** `npm ci` funciona e `npm audit --omit=dev` não reporta severidade alta.

**Integridade de dados**

- **D1** Nenhum sinal fabricado no banco; o gráfico de hit-rate mostra estado vazio com o `n` real.
- **D2** Todo ticker e sinal carrega `dataSource`, `dataAsOf` e `isSynthetic`, por feed (ticker, klines, OI, funding, long/short).
- **D3** Com feed obrigatório sintético ou mais velho que `MAX_DATA_AGE_MS`, **não se cria sinal e não se avalia stop/alvo/TTL** dos sinais abertos com aquele preço.
- **D4** Geradores sintéticos só rodam com `ALLOW_SYNTHETIC_DATA=true`; nesse modo há banner "DADOS DEMO" e tudo é gravado com `origin='DEMO'`.
- **D5** Nenhum preço de `benchmarkPrices` é usado como preço de mercado em produção.
- **D6** TradFi simulado removido do universo monitorado e do README (ou claramente rotulado, ver decisão 5).
- **D7** O backtest recusa rodar em klines sintéticos (erro explícito) e o resultado informa a fonte dos dados.

## 3. Plano técnico

**A. Segurança**

1. Middleware `requireAuth` com `crypto.timingSafeEqual`, montado antes dos routers. O frontend guarda o token em `sessionStorage` (nunca no bundle) e o envia como `Authorization: Bearer`.
2. `helmet`, `cors`, `express-rate-limit`, `express.json({ limit })`. `PORT` e `HOST` vindos de env.
3. `secretsRedaction.ts`: função única que mascara chaves em toda saída. O POST de `ai-models` preserva a chave existente quando recebe o valor mascarado. O export omite o campo.
4. `outboundPolicy.ts`: allowlist por provedor (OpenAI, OpenRouter, Anthropic, Google) mais `ALLOWED_AI_HOSTS` opcional, exigindo https. Resolve o DNS e rejeita faixas privadas antes de conectar. Sem redirects. O fallback para a chave de ambiente só vale para o host padrão do provedor.
5. Schemas zod para weights, ai-models, screener settings e `:symbol` (`^[A-Z0-9]{2,20}$`), com handler global de erro.
6. Ações destrutivas exigem corpo `{ confirm: "RESET" }` e gravam em `audit_log` (ator, rota, timestamp).
7. `npm install` para sincronizar o lock, `npm audit fix`, remoção do `vite` duplicado, `engines.node`.

**B. Integridade de dados**

1. As funções de fetch passam a retornar `FeedResult<T> = { value, source: 'WS'|'REST'|'CACHE'|'SYNTHETIC', fetchedAt }`. **Nenhuma função fabrica valor silenciosamente**; em falha retorna `null` com motivo.
2. `TickerData` ganha `dataQuality` (por feed e agregado). `processTickerState` deixa de cair em `benchmark` e devolve `null` sem preço real.
3. `DataGate` no `runMarketTick`: decide por símbolo se pode gerar sinais e se pode avaliar sinais abertos. Feed ruim: registra, marca o símbolo `DEGRADED` e segue sem tocar nos sinais.
4. Geradores sintéticos movidos para `server/demo/`, carregados só com a flag. Rotas de leitura filtram `origin='LIVE'` por padrão.
5. Migração versionada (`PRAGMA user_version`) que substitui os `ALTER` em `try/catch` vazio: adiciona `origin`, `data_source`, `is_synthetic` e a tabela `audit_log`.
6. Migração 1: faz backup do banco em `data/backups/`, remove `HIST-*` e limpa klines sintéticos de `historical_klines`.
7. UI: `DataQualityBadge` por ticker, banner global de degradação/demo e estado vazio no hit-rate.
8. Docs: README, `docs/SEGURANCA.md`, `.env.example` (com `API_AUTH_TOKEN`, `HOST`, `ALLOWED_ORIGINS`, `ALLOWED_AI_HOSTS`, `ALLOW_SYNTHETIC_DATA`, `MAX_DATA_AGE_MS`) e uma seção "o que é real e o que é simulado".

## 4. Decomposição (testes primeiro, em PRs pequenos)

**Marco M1: segurança núcleo**

- T1 Testes de contrato (supertest): 401 sem token, health aberto, ausência de segredos, 400 em entrada inválida (S1, S3, S5).
- T2 `requireAuth` + bind/helmet/CORS/rate-limit/limite de corpo.
- T3 Redação de segredos + ajuste do export + POST que preserva chave.
- T4 Testes do `outboundPolicy` (hosts, IPs privados, fallback de chave), depois implementação, depois aplicação em `aiRoutes`/`aiMotor`.
- T5 Schemas zod + handler de erro.
- T6 Confirmação e auditoria das rotas destrutivas.
- T7 Frontend: entrada do token e envio no `apiClient`.
- T8 Lockfile, audit fix, `engines`.

**Marco M2: proveniência e bloqueio**

- T9 Testes do `DataGate` e do `FeedResult` (feed sintético, feed velho, feed faltando).
- T10 Refatorar `binanceService` para `FeedResult`, sem fabricação.
- T11 `processTickerState` sem fallback de benchmark; `DataGate` no tick; sinais abertos intocados com feed ruim.
- T12 Migração versionada + colunas de origem/qualidade + `audit_log`.

**Marco M3: limpeza, UI, docs**

- T13 Migração de purge (com backup) e remoção do seed de `db.ts`.
- T14 Geradores sintéticos para `server/demo/` atrás da flag; remoção do TradFi simulado.
- T15 Backtest recusa dado sintético e reporta fonte.
- T16 UI de qualidade de dados, banner e estado vazio do hit-rate.
- T17 Documentação e README.
- T18 Verificação final: `tsc`, suíte completa, `npm audit`, checklist S1–S7/D1–D7.

## 5. Riscos e mudanças que quebram compatibilidade

- O frontend passa a exigir token: sem T7 a interface para de funcionar. Por isso T7 entra no mesmo marco.
- Chaves de IA já salvas no banco continuam lá, mas mascaradas na UI. Como a chave nunca sai do servidor, o uso continua funcionando.
- O dashboard vai parecer "vazio" quando a Binance estiver bloqueada (ex.: geo-bloqueio 451 no Cloud Run). É o comportamento correto, mas muda a experiência de demo.
- A purga apaga dados: só roda depois do backup, e o rollback é restaurar o arquivo.
- Adicionam-se dependências: `zod`, `helmet`, `express-rate-limit` e `supertest` (dev).

## 6. Definição de pronto

Checklist S1–S7 e D1–D7 verde, `tsc` sem erros, testes novos e antigos passando, `npm ci` e `npm audit --omit=dev` limpos, documentação atualizada.

## 7. Decisões que preciso que você aprove

1. **Autenticação:** token estático em Bearer (simples, uso individual, minha recomendação) ou login com sessão por cookie httpOnly (mais trabalho, melhor para múltiplos usuários)? R: token estático em Bearer
2. **Chaves de IA:** só por variável de ambiente, ou também no banco? Recomendo env como padrão e banco criptografado (AES-256-GCM) como opcional. R: Variavel e Banco
3. **Sinais falsos:** apagar os `HIST-*` (recomendo, com backup) ou apenas marcá-los como `DEMO`? R: Apagar e sem backup.
4. **Lockfile:** manter só `package-lock.json` e remover `bun.lock` (recomendo), ou o contrário? R:  manter só `package-lock.json` e remover `bun.lock`
5. **TradFi:** remover até existir provedor real (recomendo) ou manter rotulado como demo? R: montar plano para termos dados reais de stocks verificar documentação binance se temos isso, caso contrario remover por enquanto.
6. **Deploy alvo:** o `metadata.json` aponta para AI Studio/Cloud Run. Confirma que é esse o ambiente? Isso define o valor padrão de `HOST` e a origem CORS. O ambiente de teste sim, e esse, mas o ambiente real de produção sera ollama com llm local (ja temos isso configuravel pronto no app em Configuração e Parâmetros do Motor de IA)
