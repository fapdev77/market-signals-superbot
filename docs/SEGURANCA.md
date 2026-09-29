# 🔒 Módulo de Segurança & Integridade dos Dados (Fase 1)

Este documento descreve as diretrizes de segurança, arquitetura de rede, políticas de mitigação de riscos e regras de integridade de dados implementadas no **Market Signals SuperBot**.

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

---

## 2. Proteção de Rede & Hardening HTTP (Critério S2)

* **Helmet:** Headers de segurança HTTP (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc.) ativos.
* **Limite de Payload:** O corpo de requisições JSON é estritamente limitado a **100 KB** (`express.json({ limit: '100kb' })`) para mitigar ataques de Denial of Service (DoS).
* **Rate Limiting:**
  * **Global (`/api/*`):** Máximo de 300 requisições por minuto por IP.
  * **Sensível / IA (`/api/ai/*` e `/api/system/factory-reset`):** Máximo estrito de 45 requisições por minuto por IP.
* **Endereço de Escuta:** O servidor responde no host configurável via variável de ambiente `HOST` (padrão `0.0.0.0` para container / Cloud Run).

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

---

## 6. Integridade de Dados & DataGate (Critérios D1–D7)

* **Eliminação de Sinais Fabricados (D1):** Registros estáticos `HIST-*` foram totalmente removidos. O histórico de acertos reflete apenas dados reais.
* **DataGate no Motor de Ticks (D3):** Se a idade da cotação de mercado for superior a **60 segundos** (`MAX_DATA_AGE_MS`), a geração de novos sinais é pausada e a avaliação de stops/alvos é mantida em segurança.
* **Zero Preços Fictícios em Produção (D5):** `benchmarkPrices` é desativado para geração de sinais reais — apenas tickers com preços válidos da Binance Futures são processados.
* **Remoção de TradFi Simulado (D6):** Ações TradFi sem feed real ativo foram removidas do universo de sinais até a integração de provedor dedicado.
