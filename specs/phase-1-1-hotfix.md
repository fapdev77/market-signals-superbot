# Revisão da Fase 1 e planejamento da próxima fase

**Veredito:** a Fase 1 está **cerca de metade implementada**. Segurança de segredos, validação e confirmação de ações destrutivas estão bem feitas. Mas **a autenticação tem um bypass e o "DataGate" na prática nunca bloqueia nada**, então não dá para considerar a fase aprovada.

Verifiquei o commit `e57445e`: `tsc` limpo e 74 testes passando. Mas `npm ci` falha e `npm audit` ainda mostra 4 vulnerabilidades (1 alta).

## Scorecard contra a spec

**Segurança**

- **S1 Auth: ❌.** Existe token, comparação em tempo constante e trava de produção. Mas sem `API_AUTH_TOKEN` e com `NODE_ENV` diferente de `production` (inclusive não definido), **qualquer requisição passa sem token**. O token de dev está hardcoded (`superbot-dev-token-2026`), e o endpoint **público** `/api/auth/status` **devolve esse token**. O `apiClient` adota o token automaticamente.
- **S2 Rede: ⚠️.** Há helmet, limite de corpo e rate-limit. Faltam **CORS** (não existe no código), `HOST` padrão é `0.0.0.0` (a spec pedia `127.0.0.1`) e a CSP está desligada. `/api/auth/verify` só tem o limite global de 300/min, sem proteção contra força bruta.
- **S3 Segredos: ✅.** Redação e merge de chave mascarada bem feitos; o export sanitiza.
- **S4 SSRF: ⚠️.** O `test-connection` valida, mas o **caminho real de inferência (`aiMotor.ts`) não chama `validateOutboundAIUrl`**: o Ollama aceita qualquer `baseUrl` vinda da config salva. Também não há resolução de DNS (rebinding), a decisão de "host customizado" usa `includes()` na string, e os padrões IPv6 são incompletos.
- **S5 Validação: ⚠️.** Os schemas zod existem e têm teste, mas não confirmei que todas as rotas os usam.
- **S6 Ações destrutivas: ✅.** Confirmação literal e `audit_logs`. O ator é fixo `'ADMIN'`.
- **S7 Dependências: ❌.** O lock não tem os `@types/*` (o `npm ci` falha), e o audit segue com 1 alta (`nanoid`) e 3 moderadas. O `bun.lock` foi removido corretamente.

**Integridade de dados**

- **D1 Seed falso: ✅.** A função de seed sumiu e um `DELETE ... 'HIST-%'` roda na inicialização, como você decidiu.
- **D2 Proveniência: ❌.** `dataQuality` é **fixo** em `{ isLive: true, isDegraded: false, source: 'WS' }` dentro do `processTickerState`. `binanceService.ts` não foi alterado.
- **D3 Gate: ❌ na prática.** `updatedAt` é `Date.now()` no momento do processamento, então a idade é sempre ~0, e `isDegraded` é sempre `false`. O gate **nunca dispara**. Os klines sintéticos (`generateFallbackKlines`) continuam alimentando sinais e a avaliação de stops. O tick também reconstrói `raw` a partir do cache e o trata como dado fresco.
- **D4 Flag sintética: ❌.** `ALLOW_SYNTHETIC_DATA` aparece só no `.env.example` e na doc, não é lido em nenhum ponto do código. Não há coluna `origin`.
- **D5 Benchmark: ⚠️.** Saiu do `signalEngine`, mas segue no fallback de klines.
- **D6 TradFi: ⚠️.** A simulação senoidal saiu, mas `TRADFI_ASSETS` continua no código e o README ainda cita PETR4/VALE3/EUR-USD.
- **D7 Backtest: ❌.** Não foi tocado; `BacktestEngine.ts:86` ainda semeia klines sintéticos.

**Testes:** os novos são unitários. O `supertest` foi instalado, mas nenhum teste faz requisição HTTP, então o bypass do S1 passou despercebido. Os testes do DataGate montam tickers à mão e não cobrem o fluxo real.

## Problemas novos trazidos pela Fase 1

- **Falsa sensação de segurança:** o gate e a auth parecem ativos, mas não protegem, o que é pior que não ter.
- Atrás de proxy (Cloud Run), o rate-limit precisa de `trust proxy`; não conferi se está configurado. Verificar.
- `audit_logs` sem retenção e no mesmo banco que pode ser limpo.
- O purge roda a cada inicialização, sem migração versionada.
- Chaves de IA no banco seguem em texto puro (decisão sua; a criptografia opcional fica pendente).
- Continuam de fora, por escopo: o guard que engole exceções e o código sintético dentro do backtest.

## Fase 1.1 (hotfix, antes da Fase 2)

Cada item começa por um teste que falha:

1. **Auth fail-closed:** remover o bypass e o token hardcoded, remover `defaultDevToken` do `/auth/status` e do `apiClient`. Sem `API_AUTH_TOKEN`, gerar um token aleatório no boot e imprimi-lo uma vez no console, ou recusar iniciar. `HOST=127.0.0.1` por padrão.
2. **CORS** por allowlist, limiter estrito em `/auth/verify` e `table-clear`, e conferir `trust proxy`.
3. **Qualidade de dados real:** `FeedResult` com fonte e horário por feed. `updatedAt` passa a ser o timestamp do último dado real da exchange. Eliminar o fallback sintético (ou ler de fato `ALLOW_SYNTHETIC_DATA`) e parar de reaproveitar cache como fresco.
4. **SSRF completo:** aplicar a política no `aiMotor` e ao salvar modelos, resolver DNS, comparar hostname exato, cobrir IPv6.
5. **Lockfile e CI:** commitar o lock regenerado, `npm audit fix` e um workflow que rode `npm ci`, `tsc`, testes e audit.
6. **Testes HTTP** com `supertest`: 401 sem token, sem token vazado, export sem chaves, CORS, gate com feed degradado.
7. Backtest recusa dado sintético; README corrigido.
