# Fase 1 — Segurança e Integridade dos Dados (Especificação SDD)

> **Reescrita em formato SDD.** A versão anterior era um plano em prosa, sem critérios de aceitação
> próprios — "pronto" ficava subjetivo. Cada requisito abaixo tem uma verificação executável e um status
> medido contra o código atual (não contra a intenção do plano).
>
> **Última verificação:** 2026-09-29 · `npm ci` OK · `npx tsc --noEmit` 0 erros · `npx vitest run`
> 19 arquivos / 154 testes OK · `npm run build` OK · `npm audit --omit=dev` 0 vulnerabilidades.
>
> **Relação com `phase-1-1-hotfix.md`:** este é o **spec canônico** da Fase 1 (requisitos + critérios).
> `phase-1-1-hotfix.md` é o **registro de implementação** do hotfix que fechou os furos do núcleo. Os dois
> usam as mesmas IDs (S1–S7, D1–D7) de propósito, para rastreio.

---

## 1. Objetivo

Ninguém sem credencial opera ou lê segredos do sistema, e **nenhum sinal, stop ou métrica nasce de dado
falso sem que isso esteja explícito** na interface e na resposta da API.

## 2. Escopo

**Dentro:** autenticação, hardening de rede, proteção de segredos, correção do SSRF, validação de entrada,
remoção do seed falso, proveniência de dados por feed, bloqueio de sinais/gestão com feed degradado ou
velho, TradFi simulado, lockfile/build e vulnerabilidades do `npm audit`.

**Fora (Fases 2+):** reescrita do backtest, correção da lógica de score/OI/funding, guard de exceções,
unificação sql.js/libsql, CI/Docker, camada de execução e risco. Ver `phase-2.md`, `phase-2-5 and
phase-3.md` e `phase-4-remaining-gaps.md`.

---

## 3. Requisitos e critérios de aceitação

### 3.1 Segurança

#### S1 — Autenticação fail-closed

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| S1.1 | Toda rota `/api/*`, exceto `/health` e `auth/status\|verify`, retorna `401` sem token válido | `tests/appHttp.test.ts` → "rejects a protected endpoint without a token" / "…with a wrong token" | ✅ |
| S1.2 | Em `NODE_ENV=production` sem `API_AUTH_TOKEN` o processo não inicia | asserção no topo de `startServer()` em `server.ts` + `process.exit(1)` | ✅ |
| S1.3 | Sem `API_AUTH_TOKEN`, um token aleatório é gerado no boot e impresso uma única vez | `getEffectiveAuthToken()` em `server/middleware/auth.ts` | ✅ |
| S1.4 | A comparação de token é em tempo constante e não vaza o tamanho | `validateTokenConstantTime` (compara tamanho antes do `timingSafeEqual`) | ✅ |
| S1.5 | `/api/auth/status` nunca devolve o token efetivo | `tests/appHttp.test.ts` → "never returns the effective token" | ✅ |
| S1.6 | O contrato HTTP é testado contra o **app real** (não um Express montado no teste) | `server/app.ts` (`createApp`) + `tests/appHttp.test.ts` | ✅ |

#### S2 — Rede e hardening HTTP

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| S2.1 | `HOST` documentado e configurável (padrão `0.0.0.0` para container) | `.env.example` + `server.ts` (`process.env.HOST \|\| '0.0.0.0'`) | ✅ |
| S2.2 | Em produção o CORS é allowlist **exata**; nenhum wildcard, nenhum sufixo `*.run.app` | `tests/appHttp.test.ts` → rejeita origem não listada / aceita origem listada | ✅ |
| S2.3 | Payload JSON limitado a 100 kb | `tests/appHttp.test.ts` → "rejects a payload larger than 100kb" (413) | ✅ |
| S2.4 | Rate-limit global + limites estritos em `/auth/verify` (anti-força-bruta) e rotas destrutivas/IA | `createApp()` → `authBruteForceLimiter` (15/min), `strictSensitiveLimiter` (45/min) | ✅ |
| S2.5 | `trust proxy` configurado para rate-limit atrás de reverse proxy | `app.set('trust proxy', 1)` em `server/app.ts` | ✅ |
| S2.6 | `x-powered-by` não é anunciado | `app.disable('x-powered-by')` + teste | ✅ |
| S2.7 | Helmet ativo com headers de segurança | `helmet()` em `server/app.ts` | ✅ (CSP desligada de propósito; ver R-4 em `phase-4-remaining-gaps.md`) |

#### S3 — Proteção de segredos

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| S3.1 | Nenhuma resposta da API contém chave de API; o GET devolve `hasApiKey` + últimos 4 caracteres | `secretsRedaction.ts` + `redactAIModelConfig` no GET de `marketRoutes` | ✅ |
| S3.2 | POST de `ai-models` com valor mascarado preserva a chave existente | `mergePreservedSecrets` | ✅ |
| S3.3 | `database-export` omite chaves de API | `exportDatabaseJson()` (remove `apiKey`) | ✅ |

#### S4 — Anti-SSRF outbound

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| S4.1 | As chamadas de IA só alcançam hosts da allowlist (4 caminhos do `aiMotor` + salvar modelo) | `validateOutboundAIUrl` chamado nos pontos de saída | ✅ |
| S4.2 | IPs privados, loopback, CGNAT, link-local (`169.254.169.254`) e IPv6 mapeado bloqueados | `FORBIDDEN_IP_PATTERNS` em `server/utils/outboundPolicy.ts` | ✅ |
| S4.3 | Hostname comparado exatamente (não `includes()`) | `validateOutboundAIUrl` | ✅ |
| S4.4 | HTTPS obrigatório para host externo | `validateOutboundAIUrl` | ✅ |
| S4.5 | Ollama remoto só funciona se listado em `ALLOWED_AI_HOSTS` (comportamento intencional) | `outboundPolicy.ts` + `.env.example` | ✅ |
| S4.6 | Resolução de DNS (rebinding) antes de conectar | `validateOutboundAIUrlWithDns` aplicada nos 4 caminhos de IA, no test-connection e no POST `/settings/ai-models`; `tests/outboundDnsEnforcement.test.ts` (4) | ✅ **(R-1)** |

#### S5 — Validação de entrada

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| S5.1 | Schema zod em `:symbol`, weights, ai-models e screener settings | `server/middleware/validation.ts` + uso nas rotas | ✅ |
| S5.2 | Entrada inválida retorna `400` com mensagem clara | `validateBody` / `validateParams` | ✅ |

#### S6 — Ações destrutivas

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| S6.1 | `factory-reset` e `table-clear` exigem confirmação literal | `resetConfirmationSchema` (`confirm: literal('RESET')`), `tableClearConfirmationSchema` | ✅ |
| S6.2 | Toda ação destrutiva grava auditoria | `recordAuditLog` nas 6 rotas | ✅ |
| S6.3 | O ator da auditoria identifica quem agiu (não `'ADMIN'` fixo) | `getAuditActor(req)` → `token:<sha256[:8]>@<ip>` | ✅ |

#### S7 — Build, lockfile e dependências

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| S7.1 | `npm ci` funciona a partir do lock commitado | executado a partir de `node_modules` limpo; exit 0 | ✅ |
| S7.2 | `npm audit --omit=dev` sem severidade alta/moderada | 0 vulnerabilidades | ✅ |
| S7.3 | Somente `package-lock.json` versionado; `bun.lock` removido | `git status` → `D bun.lock` | ✅ |
| S7.4 | `engines.node` declarado e testado | `package.json` → `>=20.0.0`; CI roda em 20.x e 22.x | ✅ |
| S7.5 | CI roda `npm ci`, typecheck, testes, build e audit | `.github/workflows/ci.yml` | ✅ |
| S7.6 | Imagem de container reprodutível, non-root, com volume e healthcheck | `Dockerfile` + `.dockerignore` | ✅ |

### 3.2 Integridade de dados

| ID | Critério de aceitação | Verificação | Status |
|----|----------------------|-------------|--------|
| D1 | Nenhum sinal fabricado no banco; `HIST-*` removidos no boot, **sem backup** (decisão 3) | `server/db.ts` → `DELETE FROM trade_signals WHERE id LIKE 'HIST-%'` | ✅ |
| D2 | Todo ticker carrega proveniência por feed (fonte, idade, fatores indisponíveis) | `TickerData.dataQuality` = `{ source, lastPriceAgeMs, unavailableFactors }` em `src/types.ts`; `tests/phase2-5-hotfix.test.ts` | ✅ (nomes diferem do plano original — ver nota) |
| D3 | Feed `STALE`/degradado **bloqueia** geração de sinal **e** avaliação de stop/alvo/TTL | `DataGate.canGenerateSignals` + `canEvaluateActiveTrades` (rejeita `source==='STALE'` e `isDegraded`) | ✅ |
| D4 | Geradores sintéticos só rodam com `ALLOW_SYNTHETIC_DATA='true'` | klines, `DataGate`, backtest, LSR, liquidações, screener | ✅ (flag + split físico em `server/demo/` + coluna `origin='DEMO'` — R-2 entregue) |
| D5 | Nenhum preço de `benchmarkPrices` é usado como preço de mercado em produção | klines sintéticas só atrás da flag | ✅ |
| D6 | TradFi simulado removido do universo monitorado; contratos descobertos do feed real | `TRADFI_ASSETS` populado só por `refreshTradfiRegistry()` via `exchangeInfo`; chamado no boot em `server.ts` | ✅ (✅ código · ⚠️ README ainda cita ativos antigos) |
| D7 | O backtest recusa dado sintético sem a flag e reporta a fonte | `BacktestEngine.runBacktest` lança erro explícito | ✅ |

> **Nota sobre D2:** o plano original propunha campos `dataSource` / `dataAsOf` / `isSynthetic`. A
> implementação usa `dataQuality.source` (`'WS' \| 'REST' \| 'CACHE' \| 'SYNTHETIC' \| 'STALE'`),
> `dataQuality.lastPriceAgeMs` e `dataQuality.unavailableFactors`. O critério (proveniência por feed) é
> atendido; os nomes planejados não foram usados.

---

## 4. Plano técnico (as-built)

**A. Segurança**

1. `server/app.ts` expõe `createApp({botState, tickerStateCache, triggerMarketScan})` — todo o
   middleware/CORS/helmet/limiters/auth/routers vive lá, e `server.ts` só adiciona a camada estática/Vite,
   o `listen` e o loop de tick. É o que permite testar o app real (`tests/appHttp.test.ts`).
2. `requireAuth` com `crypto.timingSafeEqual`, montado antes dos routers. O frontend guarda o token em
   `sessionStorage` (nunca no bundle) e envia `Authorization: Bearer`.
3. `secretsRedaction.ts` centraliza a máscara; o POST preserva a chave quando recebe o valor mascarado; o
   export remove o campo.
4. `outboundPolicy.ts`: allowlist por provedor + `ALLOWED_AI_HOSTS`, exigindo HTTPS e bloqueando faixas
   privadas/loopback/link-local.
5. Schemas zod para weights, ai-models, screener settings e `:symbol` (`^[A-Z0-9_]{2,20}$`).
6. Ações destrutivas exigem corpo literal (`RESET` / `TABLE_CLEAR`) e gravam em `audit_log` com ator real.
7. `package.json` com `engines.node >=20`, scripts `typecheck`/`audit:prod`/`ci`, CI no GitHub Actions e
   `Dockerfile` multi-stage non-root.

**B. Integridade de dados**

1. `DataGate` decide, por símbolo, se pode gerar sinal e se pode avaliar sinais abertos; feed ruim marca
   `DEGRADED`/`STALE` e **não toca** nos sinais abertos.
2. `server/services/TickProcessor.ts` extrai do `server.ts` o que antes vivia inline: `resolveRawTicker`
   (propaga `updatedAt` do cache e marca `STALE`), `resolveMarketInputs` (disponibilidade por fator, sem
   coagir ausência para `0`) e `evaluatePositionManagement` (decisões puras de stop/alvo/breakeven).
3. `signalEngine.processTickerState` recebe `availability` e, quando o fator está indisponível, **pula** o
   fator no score e o registra em `dataQuality.unavailableFactors` (em vez de pontuar `0`).
4. Geradores sintéticos ficam atrás da flag `ALLOW_SYNTHETIC_DATA` **e** vivem todos em `server/demo/`
   (`prng`, `syntheticKlines`, `syntheticMarket`, `syntheticTickers`); a persistência marca o dado como
   `origin='DEMO'`, e as leituras de operador filtram `LIVE` por default.
5. Purge de `HIST-*` no boot (não é migração versionada — ver R-3).

---

## 5. Pendências conhecidas

Itens do plano original **não** entregues na Fase 1, rastreados em `phase-4-remaining-gaps.md`:

| Ref | Pendência | Motivo |
|-----|-----------|--------|
| ~~R-1~~ | S4.6 — usar `validateOutboundAIUrlWithDns` antes de conectar | ✅ entregue (2026-09-29): `tests/outboundDnsEnforcement.test.ts` |
| ~~R-2~~ | D4 — split `server/demo/` + coluna `origin` (`LIVE`/`DEMO`) nas tabelas | ✅ entregue (2026-09-29): `server/demo/` + coluna `origin` (migração 006) em `trade_signals`/`historical_klines`, leituras default em `LIVE`; `tests/dataOriginProvenance.test.ts` (16) |
| ~~R-3~~ | Purge `HIST-*` como migração versionada (`PRAGMA user_version`) | ✅ entregue (2026-09-29): `server/migrations/` v1–v5, one-time, sem backup (decisão 3); `tests/migrations.test.ts` |
| R-4 | CSP de conteúdo desligada | decisão consciente; reavaliar antes de expor publicamente |

---

## 6. Decisões aprovadas

| # | Decisão | Resposta | Status |
|---|---------|----------|--------|
| 1 | Autenticação | token estático em `Authorization: Bearer` | ✅ |
| 2 | Chaves de IA | variável de ambiente **e** banco | ✅ |
| 3 | Sinais `HIST-*` | apagar, **sem backup** | ✅ |
| 4 | Lockfile | manter só `package-lock.json`, remover `bun.lock` | ✅ |
| 5 | TradFi | usar dado real da Binance; remover se não houver | ✅ (descoberta via `exchangeInfo`) |
| 6 | Deploy | teste em AI Studio/Cloud Run; **produção real = Ollama com LLM local** | ✅ (configurável no Motor de IA) |

---

## 7. Definição de pronto

Checklist S1–S7 e D1–D7 **verde** — S4.6 (R-1) foi entregue em 2026-09-29 (`tests/outboundDnsEnforcement.test.ts`),
assim como R-3 (migrações versionadas) e R-2 (`origin`/`server/demo/`); da Fase 1 só R-4 (CSP) segue como
pendência consciente, reavaliável antes de expor publicamente.
`tsc` sem erros, suíte **233/233** verde, `npm ci` e `npm audit --omit=dev` limpos, documentação atualizada.
