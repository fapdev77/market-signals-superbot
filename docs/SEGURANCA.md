# 🔒 Módulo de Segurança & Integridade dos Dados (Fases 1, 2.5 e 3)

Este documento descreve as diretrizes de segurança, arquitetura de rede, políticas de mitigação de riscos e regras de integridade de dados implementadas no **Market Signals SuperBot**.

> **Referência normativa:** os critérios formais (S1–S7, D1–D7 e seus status medidos) estão nas specs em
> [`/specs`](../specs): `phase-1-security-and-data-integrity.md`, `phase-1-1-hotfix.md`,
> `phase-2.md` e `phase-2-5-and-phase-3.md`.

---

## 1. Autenticação & Controle de Acesso (Critério S1)

### Mecanismo de Autenticação
* **Protocolo:** Token de Autorização estático no formato `Authorization: Bearer <API_AUTH_TOKEN>`.
* **Validação em Tempo Constante:** A validação é executada via `crypto.timingSafeEqual` para prevenir ataques de temporização (*timing attacks*).
* **Obrigatoriedade em Produção:** Quando `NODE_ENV=production`, o servidor Node.js/Express **recusa inicializar** caso a variável `API_AUTH_TOKEN` não esteja configurada no ambiente.
* **Rotas Públicas Isentas:**
  * `/health` e `/api/health`: Probes de liveness e readiness do container Cloud Run.
  * `/api/auth/status`: Consulta de status de autenticação.
  * `/api/auth/verify`: Verificação interativa de tokens.
* **Contrato HTTP Testado Contra o App Real:** O `createApp()` (`server/app.ts`) é a única montagem de middleware; os testes (`tests/appHttp.test.ts`) validam 401 sem token, aceite via `Authorization: Bearer` e `x-api-token`, CORS, limite de corpo e ausência de vazamento de token.

---

## 2. Proteção de Rede & Hardening HTTP (Critério S2)

* **Helmet:** Headers de segurança HTTP (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc.) ativos.
* **Limite de Payload:** O corpo de requisições JSON é estritamente limitado a **100 KB** (`express.json({ limit: '100kb' })`) para mitigar ataques de Denial of Service (DoS).
* **Rate Limiting:**
  * **Global (`/api/*`):** Máximo de 300 requisições por minuto por IP.
  * **Sensível / IA (`/api/ai/*` e `/api/system/factory-reset`):** Máximo estrito de 45 requisições por minuto por IP.
* **Endereço de Escuta:** O servidor responde no host configurável via variável de ambiente `HOST` (padrão `0.0.0.0` para container / Cloud Run).
* **CORS por Allowlist Exata:** Em produção (`NODE_ENV=production`) **somente** as origens listadas em `ALLOWED_ORIGINS` são aceitas — sem wildcard e sem aceitar qualquer subdomínio `*.run.app`. Em desenvolvimento qualquer origem é aceita para ferramentas locais.

---

## 3. Redação de Segredos & Chaves de API (Critério S3)

* **Ocultação de Chaves:** Nenhuma rota de leitura (`GET /api/settings/ai-models`, `GET /api/system/database-export`, logs de telemetria) expõe a chave de API em texto puro.
* **Máscara Segura:** O cliente recebe apenas `{ hasApiKey: true, apiKeyMasked: "••••••••1234" }`.
* **Preservação ao Salvar:** O endpoint `POST /api/settings/ai-models` compara os valores recebidos e preserva a chave já gravada no banco caso o usuário não altere o campo mascarado.
* **Backup Sanitizado:** Exportações de backup em formato JSON (`/api/system/database-export`) removem automaticamente todas as chaves de API antes do download.

---

## 4. Prevenção de SSRF Outbound (Critério S4)

O módulo `server/utils/outboundPolicy.ts` audita todas as chamadas de rede externas e testes de conectividade (`/api/ai/test-connection`):
* **Allowlist Oficial:**
  * Google Gemini: `generativelanguage.googleapis.com`
  * OpenRouter: `openrouter.ai`
  * Anthropic: `api.anthropic.com`
  * OpenAI: `api.openai.com`
* **Provedor Local (Ollama):** Permitido exclusivamente em `localhost` / `127.0.0.1` na porta configurada (ex: `11434`) quando o provedor for explicitamente `local`.
* **Bloqueio de Metadados de Nuvem:** Endereços como `169.254.169.254` (GCP/AWS Metadata Service), IPs de loopback para serviços remotos e faixas privadas RFC 1918 são bloqueados sumariamente.
* **Protocolo Estrito:** Todas as conexões externas para IA devem obrigatoriamente utilizar **HTTPS**.
* **Pendência conhecida (R-1):** a resolução de DNS antes de conectar (`validateOutboundAIUrlWithDns`, mitigação de *DNS rebinding*) já existe em `outboundPolicy.ts`, porém ainda não está no caminho das chamadas — rastreada em [`specs/phase-4-remaining-gaps.md`](../specs/phase-4-remaining-gaps.md).

---

## 5. Validação de Esquema & Ações Destrutivas (Critérios S5 & S6)

* **Zod Schemas:** Validação de formato em todas as rotas críticas:
  * Tickers e Símbolos: Expressão regular `^[A-Z0-9_]{2,20}$`.
  * Pesos dos Indicadores: Valores normalizados entre `0` e `100`.
  * Configurações de Modelos: Schemas tipados e com limites de parâmetros.
* **Confirmação Explícita em Rotas Destrutivas:**
  * `POST /api/system/factory-reset`: Exige payload `{ confirm: "RESET" }`.
  * `POST /api/system/table-clear`: Exige payload `{ confirm: "TABLE_CLEAR", table: "nome_da_tabela" }`.
* **Trilha de Auditoria (`audit_logs`):** Todas as operações destrutivas e alterações de pesos são persistidas na tabela `audit_logs` com timestamp, rota, autor e dados alterados.
* **Ator de Auditoria Real:** O autor registrado é derivado da requisição por `getAuditActor(req)` → `token:<sha256[:8]>@<ip>` — o token em si nunca é gravado, apenas os 8 primeiros caracteres do seu hash. Nenhum log usa mais o ator fixo `'ADMIN'`.

---

## 6. Integridade de Dados & DataGate (Critérios D1–D7)

* **Eliminação de Sinais Fabricados (D1):** Registros estáticos `HIST-*` são removidos a cada boot. O histórico de acertos reflete apenas dados reais.
* **DataGate no Motor de Ticks (D3):** Se a idade da cotação de mercado for superior a **60 segundos** (`MAX_DATA_AGE_MS`), se a fonte for `STALE` (ticker reconstruído do cache) ou se a integridade estiver degradada, a geração de novos sinais é pausada **e** a avaliação de stops/alvos/TTL é congelada — evitando saídas em falsos stops.
* **Proveniência por Fator (D2):** Cada feed (OI, Funding, Long/Short) carrega fonte e idade próprias. Feed falho ⇒ o fator é **excluído** da confluência e listado em `dataQuality.unavailableFactors`; funding indisponível é rotulado `UNAVAILABLE` (não "mercado neutro"). Nunca se pontua ausência como `0`.
* **Zero Preços Fictícios em Produção (D5):** `benchmarkPrices` é desativado para geração de sinais reais — apenas tickers com preços válidos da Binance Futures são processados.
* **Geradores Sintéticos Atrás de Flag (D4):** Klines sintéticas, fallback do screener, sine-wave de long/short e liquidações simuladas só existem com `ALLOW_SYNTHETIC_DATA=true`. Liquidações simuladas vêm marcadas com `isSimulated`.
* **TradFi por Descoberta Real (D6):** Nenhum símbolo TradFi é fixado em código. Contratos de ações/FX/commodities são descobertos no `exchangeInfo` da Binance no boot (`refreshTradfiRegistry`), com horário de mercado calculado em `America/New_York` (DST correto). Sem contrato real, o ativo não é monitorado.
* **Backtest Honesto (D7):** Recusa klines sintéticos sem a flag; entrada no candle seguinte ao sinal (sem lookahead); slippage contado uma vez; `overfitRatio` sem default enganoso; premissas e fatores desativados reportados no resultado (`assumptions`, `disabledFactors`).

---

## 7. Risco & Kill-Switch (Fase 3.4)

* **Aritmética Decimal Exata:** Cálculos financeiros passam por `server/utils/decimal.ts` (BigInt fixo de 8 casas) — sem drift de ponto flutuante em posição, PnL ou risco.
* **Position Sizing por Risco:** O tamanho da posição deriva da distância até o stop (`RiskManager.computePositionSize`), respeitando risco fixo por trade e mínimo tradável.
* **Limites de Portfólio:** Concorrência máxima de sinais, teto de risco por categoria e orçamento agregado são avaliados a cada tick (`evaluatePortfolioRisk`) e bloqueiam novas emissões quando estourados.
* **Kill-Switch:** `POST /api/system/kill-switch` interrompe a emissão de novos sinais imediatamente (motivo obrigatório ≥ 3 caracteres, ação auditada como `KILL_SWITCH`); `GET /api/system/risk-status` expõe limites, sinais abertos e estado do halt. O halt é verificado no `server.ts` antes de qualquer nova emissão.

---

## 8. CI, Build e Dependências (Critérios S7)

* **CI (`.github/workflows/ci.yml`):** `npm ci` → `npm run typecheck` → `npx vitest run` → `npm run build` em Node 20.x e 22.x, além de job de `npm audit --omit=dev`.
* **Lockfile Único:** Somente `package-lock.json` é versionado (`bun.lock` removido); `engines.node >= 20.0.0`.
* **Docker:** `Dockerfile` multi-stage, usuário `node` (non-root), volume `/app/data` para o SQLite e `HEALTHCHECK` contra `/api/health`.

---

## 9. Content-Security-Policy (7.6.2)

* Em produção, o app sempre emite CSP. O padrão é **report-only**
  (`Content-Security-Policy-Report-Only`), que apenas registra violações — sem bloquear nada.
* Depois de pelo menos 7 dias em report-only **sem violações inesperadas** (via `CSP_REPORT_URI`
  ou logs), ative o modo bloqueante com `CSP_ENFORCE=true`. Neste caso o cabeçalho passa a ser o
  `Content-Security-Policy` (e o report-only é desligado nessa resposta).
* Fora de produção nenhum dos dois cabeçalhos é emitido (o dev server do Vite injeta o próprio CSP para HMR).
* Rótulos de UI não expõem o host do WebSocket a montante: o painel separa o stream servidor→navegador do
  estado do feed a montante (`/api/health` / `feed-health`).
