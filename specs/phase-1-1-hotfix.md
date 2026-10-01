# Fase 1.1 — Hotfix de segurança e integridade

> **Reescrita em formato SDD.** A versão anterior deste arquivo era uma cópia de mensagem de revisão, sem
> critérios de aceitação próprios — o que tornava "pronto" subjetivo. Cada requisito abaixo tem uma
> verificação executável e um status medido contra o código em `main`.
>
> **Última verificação:** 2026-10-01 (T6.8.3) · `npm ci` OK · `tsc --noEmit` 0 erros · `vitest run` verde ·
> `vite build` + `esbuild` OK · `npm audit --omit=dev` 0 vulnerabilidades.

## 1. Objetivo

Fechar os furos que faziam a Fase 1 *parecer* implementada sem proteger: bypass de autenticação, DataGate
que nunca disparava, feeds que fabricavam dado e build irreprodutível.

## 2. Requisitos

### S1 — Autenticação fail-closed

| ID | Requisito | Verificação | Status |
|----|-----------|-------------|--------|
| S1.1 | Toda rota `/api/*`, exceto `health` e `auth/status|verify`, retorna `401` sem token válido | `tests/appHttp.test.ts` → "rejects a protected endpoint without a token" | ✅ |
| S1.2 | Em `NODE_ENV=production` sem `API_AUTH_TOKEN` o processo não inicia | `server.ts` → asserção no topo de `startServer()` + `process.exit(1)` | ✅ |
| S1.3 | Sem `API_AUTH_TOKEN`, um token aleatório é gerado no boot e impresso uma única vez | `getEffectiveAuthToken()` em `server/middleware/auth.ts` | ✅ |
| S1.4 | Comparação de token em tempo constante | `validateTokenConstantTime` (compara os buffers iguais antes do `timingSafeEqual` quando o tamanho difere) | ✅ |
| S1.5 | `/api/auth/status` não devolve o token efetivo | `tests/appHttp.test.ts` → "never returns the effective token" | ✅ |

### S2 — Rede

| ID | Requisito | Verificação | Status |
|----|-----------|-------------|--------|
| S2.1 | `HOST` documentado e configurável (padrão `0.0.0.0` para container) | `.env.example` com a justificativa e a alternativa `127.0.0.1` | ✅ |
| S2.2 | CORS por allowlist exata em produção | `tests/appHttp.test.ts` → rejeita `*.run.app` de terceiros; aceita origem allowlistada | ✅ |
| S2.3 | Limite de corpo de 100 kb | `tests/appHttp.test.ts` → "rejects a payload larger than 100kb" (413) | ✅ |
| S2.4 | Limiter estrito em `/api/auth/verify` (anti-força-bruta) e em rotas destrutivas | `createApp()` → `authBruteForceLimiter` 15/min, `strictSensitiveLimiter` 45/min | ✅ |
| S2.5 | `trust proxy` configurado para o rate-limit atrás de reverse proxy | `app.set('trust proxy', 1)` | ✅ |
| S2.6 | `x-powered-by` não anunciado | `app.disable('x-powered-by')` + teste | ✅ |

### S3 — Segredos

| ID | Requisito | Verificação | Status |
|----|-----------|-------------|--------|
| S3.1 | Nenhuma resposta da API contém chave de API; o GET devolve `hasApiKey` + últimos 4 caracteres | `secretsRedaction.ts` + `redactAIModelConfig` no GET de `marketRoutes` | ✅ |
| S3.2 | POST de `ai-models` com valor mascarado preserva a chave existente | `mergePreservedSecrets` | ✅ |
| S3.3 | `database-export` omite chaves | `exportDatabaseJson()` (strips `apiKey`) + teste S1.5-like | ✅ |

### S4 — SSRF

| ID | Requisito | Verificação | Status |
|----|-----------|-------------|--------|
| S4.1 | As chamadas de IA só alcançam hosts da allowlist | `validateOutboundAIUrl` chamado nos 4 caminhos de `aiMotor` e ao salvar modelos | ✅ |
| S4.2 | IPs privados, loopback, CGNAT, link-local e IPv6 mapeado bloqueados | `FORBIDDEN_IP_PATTERNS` em `outboundPolicy.ts` | ✅ |
| S4.3 | Hostname comparado exatamente (não `includes()`) | `validateOutboundAIUrl` | ✅ |
| S4.4 | Resolução de DNS (rebinding) antes de conectar | `validateOutboundAIUrlWithDns` existe | ⚠️ **não usada** — ver R-1 em `phase-4-remaining-gaps.md` |
| S4.5 | HTTPS obrigatório para host externo | `validateOutboundAIUrl` | ✅ |

### S5 — Validação de entrada

| ID | Requisito | Verificação | Status |
|----|-----------|-------------|--------|
| S5.1 | Schema zod em `:symbol`, weights, ai-models, screener settings | `server/middleware/validation.ts` + uso nas rotas | ✅ |
| S5.2 | Entrada inválida retorna `400` | `validateBody` / `validateParams` | ✅ |

### S6 — Ações destrutivas

| ID | Requisito | Verificação | Status |
|----|-----------|-------------|--------|
| S6.1 | `factory-reset` e `table-clear` exigem confirmação literal | `resetConfirmationSchema` (`confirm: literal('RESET')`), `tableClearConfirmationSchema` | ✅ |
| S6.2 | Toda ação destrutiva grava auditoria | `recordAuditLog` nas 6 rotas | ✅ |
| S6.3 | O ator registrado identifica quem agiu | `getAuditActor(req)` → `token:<sha256[:8]>@<ip>` | ✅ (era `'ADMIN'` fixo) |

### S7 — Build e dependências

| ID | Requisito | Verificação | Status |
|----|-----------|-------------|--------|
| S7.1 | `npm ci` funciona a partir do lock commitado | executado; exit 0 | ✅ |
| S7.2 | `npm audit --omit=dev` sem severidade alta/moderada | 0 vulnerabilidades | ✅ |
| S7.3 | Somente `package-lock.json` versionado; `bun.lock` removido | `git ls-files` → apenas `package-lock.json` | ✅ |
| S7.4 | `engines.node` declarado | `package.json` → `>=20.0.0`, testado na CI em 20.x e 22.x | ✅ |
| S7.5 | CI roda `npm ci`, `tsc`, testes, build e audit | `.github/workflows/ci.yml` | ✅ |

### D1–D7 — Integridade de dados (escopo do hotfix)

| ID | Requisito | Verificação | Status |
|----|-----------|-------------|--------|
| D1 | Nenhum sinal fabricado; `HIST-*` removidos no boot (sem backup, conforme decisão 3) | `db.ts` purge no boot | ✅ |
| D2 | Todo ticker carrega `dataQuality` com `source`, `lastPriceAgeMs` e `unavailableFactors` por feed | `signalEngine.ts` → bloco `dataQuality`; `tests/phase2-5-hotfix.test.ts` | ✅ |
| D3 | Cache nunca tratado como dado fresco | `resolveRawTicker` propaga `updatedAt` + `source:'STALE'` | ✅ |
| D4 | Geradores sintéticos só com `ALLOW_SYNTHETIC_DATA=true` | klines, `DataGate`, backtest, LSR, liquidações, screener | ✅ |
| D5 | Preço de `benchmarkPrices` não usado como preço de mercado em produção | klines sintéticas só atrás da flag | ✅ |
| D6 | TradFi simulado removido do universo monitorado | `TRADFI_ASSETS` agora é registro descoberto via `exchangeInfo` | ✅ |
| D7 | Backtest recusa dado sintético sem a flag | `BacktestEngine.runBacktest` lança erro explícito | ✅ |

## 3. Critério de pronto

`tsc` limpo, suíte verde, `npm ci` e `npm audit --omit=dev` limpos, todos os requisitos acima com
verificação executável. **Pendência conhecida e aceita:** S4.4 (validação por DNS) — rastreada em
`phase-4-remaining-gaps.md`.

## 4. Decisões aprovadas

1. Autenticação: **token estático Bearer**. ✅ implementado
2. Chaves de IA: **variável de ambiente e banco**. ✅ implementado
3. Sinais `HIST-*`: **apagar, sem backup**. ✅ implementado
4. Lockfile: **manter só `package-lock.json`**, remover `bun.lock`. ✅ implementado
5. TradFi: **usar dado real da Binance; remover se não houver**. ✅ implementado (descoberta por `exchangeInfo`)
6. Deploy: teste em AI Studio/Cloud Run; **produção real = Ollama com LLM local**. ✅ configurável no Motor de IA
