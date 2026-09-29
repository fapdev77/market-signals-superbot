# 🚀 Market Signals SuperBot — Plataforma Quantitativa de Trading Institucional

> Sistema de inteligência quantitativa, análise de fluxo de ordens (*Order Flow*), confluência algorítmica multi-estratégia, gestão de TTL (*Time-To-Live / Alpha Half-Life*) e validação preditiva com IA para criptoativos perpétuos e mercados tradicionais (*TradFi*).

---

## 📑 Sumário

- [1. Visão Geral](#1-visão-geral)
- [2. Principais Funcionalidades](#2-principais-funcionalidades)
- [3. Arquitetura do Sistema](#3-arquitetura-do-sistema)
- [4. Requisitos e Pré-requisitos](#4-requisitos-e-pré-requisitos)
- [5. Guia Rápido de Instalação e Execução](#5-guia-rápido-de-instalação-e-execução)
- [6. Configuração de Variáveis de Ambiente](#6-configuração-de-variáveis-de-ambiente)
- [7. Módulos & Ferramentas da Aplicação](#7-módulos--ferramentas-da-aplicação)
- [8. Gestão Institucional de TTL & Breakeven](#8-gestão-institucional-de-ttl--breakeven)
- [9. Diagnóstico de Banco de Dados & Reset Global](#9-diagnóstico-de-banco-de-dados--reset-global)
- [10. Endpoints da API REST](#10-endpoints-da-api-rest)
- [11. Documentação Complementar](#11-documentação-complementar)
- [12. Solução de Problemas (Troubleshooting)](#12-solução-de-problemas-troubleshooting)

---

## 1. Visão Geral

O **Market Signals SuperBot** é uma plataforma quantitativa *full-stack* desenvolvida para operadores profissionais, analistas de risco e mesas proprietárias. A aplicação ingere dados de mercado em tempo real via WebSocket e REST da **Binance Futures**, **Binance Spot** e **Mercados Tradicionais (TradFi: SPY, QQQ, NVDA, AAPL, PETR4, VALE3, Ouro, EUR/USD)**, processando uma esteira de indicadores institucionais:

* **Cumulative Volume Delta (CVD)** e agressão taker compradora/vendedora.
* **Open Interest (OI)** e posicionamento institucional (*Long/Short Ratio* e *Top Trader Positioning*).
* **Volume Profile** em tempo real com identificação de **POC (Point of Control)**, **VAH (Value Area High)** e **VAL (Value Area Low)**.
* **Retrações e Expansões de Fibonacci** com foco na **Zona Áurea (Golden Pocket 0.618 - 0.68)**.
* **Smart Money Concepts (SMC)**: Fair Value Gaps (**FVG / Single Prints**) e Quebras de Estrutura de Mercado (**BOS**).
* **Filtro Anti-Spike e Validação Multi-Timeframe**: Confirmação obrigatória de sustentação no candle de 1 min e alinhamento de tendência no candle de 5 min antes da validação do sinal.
* **Modelagem Temporal Institucional (TTL / Alpha Half-Life)**: Decaimento temporal de sinal baseado em regimes de volatilidade (*Calmo, Padrão, Agitado, Extremo*) com ajuste fino via multiplicador contínuo.
* **Proteção de Capital com Breakeven Automático**: Ao atingir o Alvo 1 (+50% de realização parcial), o Stop Loss é automaticamente elevado para a entrada (0.00% de risco).
* **Auditoria Quantitativa por IA com Personas & Customização de Prompt**: Integração com modelos Gemini (Flash / Pro) e provedores externos (Ollama/Claude), com seletor de Personas Operacionais (*Conservador, Agressivo, Scalper, Swing*), injeção de notas do trader e modal de conferência prévia (`PromptPreviewModal`).

---

## 2. Principais Funcionalidades

| Módulo | Descrição |
| :--- | :--- |
| **Cockpit Principal & Screener** | Monitor em tempo real de ativos com ranking de confluência, variação 24h, volume, CVD, funding rate e status operacional. |
| **Matriz de Sinais Institucional** | Painel de sinais com HUD superior em tempo real, contagem regressiva de TTL, barra visual de decaimento de alpha, filtros por ciclo de vida (*Ativos, Próximos de Expirar, Breakeven, Alvo Atingido, Stop Loss, Expirados*) e ordenação avançada. |
| **Gráfico Interativo & Candlesticks** | Visualização avançada com overlays de POC, VAH, VAL, Golden Pocket, Níveis de Entrada, Stop Loss e Alvos parciais/finais. |
| **Auditoria & PromptPreviewModal** | Sistema de pré-visualização e customização de prompts antes do disparo para a IA, com seletor de personas, injeção de contexto extra do trader e modo de edição livre. |
| **Radar de Traders Presos (Trapped Traders)** | Mapa de calor e detecção de zonas de liquidação de comprados/vendidos alavancados presos em topos e fundos. |
| **Monitor de Divergências RSI** | Detecção automatizada de divergências clássicas e ocultas de RSI com confirmação de volume e CVD. |
| **Dashboard de Gestão de Risco** | Value-at-Risk (VaR 95%/99%), concentração setorial, matriz de correlação cruzada e exposição total de capital. |
| **Position Sizer Institucional** | Calculadora de tamanho ideal de lote baseada em risco fixo de conta (% ou $), margem e Critério de Kelly. |
| **Auto-Tuner de Estratégias** | Algoritmo genético e otimizador quantitativo com backtest walk-forward para calibração de pesos de indicadores. |
| **Paper Trading Sandbox** | Simulador em tempo real de execução de ordens com tracking de PnL não-realizado, saldo simulado e histórico de trades. |
| **Configurações & Reset de Fábrica** | Diagnóstico do banco SQLite (tabelas, contagem de registros, tamanho em KB), ferramentas de otimização (*Vacuum*) e Reset Global de 3 níveis. |

---

## 3. Arquitetura do Sistema

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND (React 19)                                 │
│  Vite SPA · Tailwind CSS v4 · Lucide Icons · Recharts & D3 · Responsive Grid & Tabs   │
│  Cockpit · Signals Matrix · Charts · Risk Dashboard · Trapped Traders · Auto-Tuner    │
└───────────────────────────────────────────▲────────────────────────────────────────────┘
                                            │ HTTP REST / Server-Sent Sync
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                                    BACKEND (Node.js)                                  │
│  Express API Server (`server.ts`) · Multi-Strategy Evaluation Pool                    │
│  Signal Engine (`server/signalEngine.ts`) · Quantitative Indicators Calculation        │
│  Institutional TTL Sweep Engine · Stale Signals Expirer · Trailing Breakeven Worker   │
└─────────────────────▲─────────────────────▲─────────────────────────────▲──────────────┘
                      │                     │                             │
┌─────────────────────▼───────┐ ┌───────────▼──────────────┐ ┌────────────▼─────────────┐
│       BANCO DE DADOS        │ │    FEEDS DE MERCADO      │ │        IA & AUDITORIA      │
│ SQLite / SQL.js             │ │ Binance Futures WS & REST│ │ Google Gemini 3.7/3.5 GenAI│
│ Persistência Local          │ │ TradFi Yahoo/Macro Proxy │ │ JSON Schema Validation     │
│ Sinais, Configs, Logs, Pesos│ │ CVD, OI, Funding & Book  │ │ Diagnóstico de Riscos      │
└─────────────────────────────┘ └──────────────────────────┘ └────────────────────────────┘
```

---

## 4. Requisitos e Pré-requisitos

Para instalar e executar o projeto em qualquer ambiente (Windows, macOS ou Linux), você precisará de:

* **Node.js**: Versão `18.x`, `20.x` ou `22.x` (LTS recomendada).
* **Gerenciador de Pacotes**: `npm` (versão 9+), `pnpm`, `yarn` ou `bun`.
* **Navegador Web Moderno**: Google Chrome, Brave, Firefox, Edge ou Safari (compatível com ES2022+).
* **Chave de API Gemini (Opcional)**: Para habilitar as auditorias de setup e diagnósticos por Inteligência Artificial (obtenha em [Google AI Studio](https://aistudio.google.com/)).

---

## 5. Guia Rápido de Instalação e Execução

### Passo 1: Clonar o Repositório
```bash
git clone <URL_DO_REPOSITORIO>
cd market-signals-superbot
```

### Passo 2: Instalar as Dependências
```bash
npm install
```

### Passo 3: Configurar as Variáveis de Ambiente
Copie o arquivo de exemplo `.env.example` para `.env`:
```bash
cp .env.example .env
```
Abra o `.env` e configure sua chave da API Gemini caso deseje usar o motor de auditoria por IA:
```env
GEMINI_API_KEY=sua_chave_aqui
PORT=3000
```

### Passo 4: Iniciar a Aplicação em Modo de Desenvolvimento
```bash
npm run dev
```
Acesse a aplicação no navegador em: **`http://localhost:3000`**

### Passo 5: Compilação para Produção (Build)
Para gerar a versão otimizada para produção:
```bash
npm run build
npm start
```

---

## 6. Configuração de Variáveis de Ambiente & Segurança Fail-Closed

O arquivo `.env` suporta as seguintes configurações de operação e proteção:

| Variável | Tipo | Padrão | Descrição |
| :--- | :---: | :---: | :--- |
| `API_AUTH_TOKEN` | `string` | *dinâmico* | Token de autenticação Bearer obrigatório para rotas `/api/*`. Em dev, se não definido, o servidor gera uma chave segura criptográfica impressa no terminal. Em produção (`NODE_ENV=production`), o servidor falha imediatamente (*fail-closed*) caso não esteja presente. |
| `ALLOWED_ORIGINS` | `string` | `http://localhost:3000,http://127.0.0.1:3000` | Lista de origens permitidas pelo middleware de CORS separadas por vírgula. |
| `ALLOWED_AI_HOSTS` | `string` | *vazio* | Hostnames adicionais permitidos para conexões de IA externas além dos oficiais (`googleapis.com`, `openrouter.ai`, `anthropic.com`, `openai.com`). |
| `ALLOW_SYNTHETIC_DATA`| `boolean`| `false` | Se `false`, o sistema opera em modo estritamente real: recusa fabricar candles sintéticos caso a Binance esteja fora do ar e bloqueia backtests sem dados reais históricos pré-sincronizados. |
| `GEMINI_API_KEY` | `string` | *vazio* | Chave de API do Google Gemini para auditoria e diagnósticos de IA. |
| `PORT` | `number` | `3000` | Porta TCP em que o servidor Express escuta. |
| `HOST` | `string` | `0.0.0.0` | Endereço de interface de rede para escuta (definir `127.0.0.1` para ambientes estritamente locais). |
| `NODE_ENV` | `string` | `development` | Ambiente de execução (`development`, `test` ou `production`). |

### 🔒 Particularidades de Ambiente & Exceções

1. **Ambiente em Nuvem / Contêineres (Cloud Run, Docker, AI Studio):**
   * O servidor escuta em `HOST=0.0.0.0` por padrão com `trust proxy: 1` para permitir que o tráfego do gateway da nuvem alcance a aplicação sem mascarar o IP real nos limitadores de taxa (*rate limiting*).
   * O dev server é estritamente fixado na porta `3000` para compatibilidade com o supervisor de iframes. Em produção, portas dinâmicas injetadas pelo orquestrador (`process.env.PORT`) são respeitadas automaticamente.
   * Não é possível conectar modelos Ollama locais utilizando IPs privados locais (como `192.168.x.x` ou `localhost`) a partir da nuvem. Nestes casos, recomenda-se criar um túnel seguro HTTPS (ex.: via Ngrok ou Cloudflare Tunnel) ou executar o SuperBot localmente.

2. **Proteção Anti-SSRF e DNS Rebinding:**
   * Todas as requisições externas para provedores de IA passam pelo módulo `outboundPolicy.ts` com validação de hostname, bloqueio estrito de faixas privadas (RFC 1918, RFC 3927, RFC 4193, loopback, CGNAT e metadados de nuvem `169.254.169.254`) e resolução prévia de DNS para mitigar ataques de DNS rebinding.

3. **Integridade de Dados e DataGate Ativo:**
   * O robô possui um guardião de dados (`DataGate.ts`). Sinais quantitativos são bloqueados se o feed de cotações estiver desatualizado (>60s) ou se a integridade dos dados estiver degradada. Avaliações de trailing stop em ordens abertas são congeladas em caso de queda de rede para evitar saídas em falsos stops.

---

## 7. Módulos & Ferramentas da Aplicação

### ⚡ 1. Matriz de Sinais & HUD Institucional
* Visualização em tempo real de todas as oportunidades ativas, com cálculo dinâmico de Risco:Retorno (R:R), alvo 1 (+50% parcial), alvo 2 (+100% expansão) e Stop Loss estrutural.
* **HUD Superior:** Métricas em tempo real de confluência média, sinais ativos no book, posições em breakeven protegido, alertas de expiração próxima e indicador do regime de mercado ativo com atalho para os ajustes de TTL.
* **Filtros de Ciclo de Vida:** Separe facilmente ordens `Ativas`, `Prestes a Expirar`, `Em Breakeven`, `Alvos Atingidos`, `Stop Loss` e `TTL Expirado`.

### 🎛️ 2. Motor Multi-Estratégia Concorrente
O bot avalia simultaneamente em paralelo múltiplos horizontes operacionais para cada ativo:
* **Scalp (5m):** Reteste dinâmico rápido em zonas de micro-liquidez e desequilíbrios de CVD.
* **Day Trade (15m):** Rompimentos de estrutura sustentados e confluência em POCs intradiárias.
* **Intraday (30m):** Reteste em Golden Pocket Fibonacci e absorções com divergência de CVD.
* **Swing Trade (1h/4h):** Expansão estrutural macro e rejeições em Value Area High/Low.
* **Position Trade (4h/1d):** Rastreamento de grandes ciclos de liquidez e tendências institucionais.
* **Contra-Trade / TTI (15m):** Reversão à média em exaustão extrema de Open Interest e Funding Rate.

---

## 8. Gestão Institucional de TTL & Breakeven

Para evitar que ordens obsoletas fiquem pendentes após o mercado perder o *timing* estatístico de entrada (*Alpha Half-Life*), a aplicação conta com um sistema de expiração e proteção:

### 🕒 TTL Base por Categoria
* **Scalp:** 25 minutos
* **Day Trade:** 90 minutos (1h 30m)
* **Intraday:** 240 minutos (4h)
* **Swing Trade:** 1.440 minutos (24h)
* **Position Trade:** 4.320 minutos (72h / 3 dias)
* **Contra-Trade:** 60 minutos (1h)

### 🌪️ Regimes de Volatilidade e Multiplicador de Fine-Tuning
$$\text{TTL Efetivo} = \text{TTL Base} \times \text{Multiplicador de Regime}$$
* **🟢 Mercado Calmo (1.5x):** +50% de tempo de vida útil para consolidações lentas.
* **🔵 Mercado Padrão (1.0x):** Condições típicas de volatilidade e spread.
* **🟠 Mercado Agitado (0.6x):** Sinais expiram 40% mais rápido em dias de alta volatilidade.
* **🔴 Volatilidade Extrema (0.4x):** Janela ultra-curta para eventos macro e notícias de alto impacto (CPI, FOMC).
* **Slider Contínuo (0.2x a 3.0x):** Ajuste manual fino disponível na aba **Ajustes**.

### 🛡️ Trailing Stop para Breakeven Automático
Quando o preço de mercado atinge o **Alvo 1**, o robô aciona a proteção institucional:
1. Registra a realização parcial de 50% dos lucros da posição.
2. Eleva o **Stop Loss** para o preço exato de entrada da ordem.
3. Transfere a posição para status **Risco Zero (0.00% de risco residual)**.

---

## 9. Diagnóstico de Banco de Dados & Reset Global

Na aba **Ajustes de Estratégia**, a seção **Diagnóstico do Sistema & Banco de Dados** fornece controle total sobre a persistência da aplicação:

* **Métricas do Banco:** Contagem de linhas em tempo real para `trade_signals`, `market_snapshots`, `ai_audit_reports`, `indicator_weights` e `strategy_performance`.
* **Tamanho e Armazenamento:** Exibição do tamanho do arquivo SQLite em KB/MB e botão de **Otimização (VACUUM)** para recuperar espaço em disco.
* **Modal de Reset Global (3 Escopos de Segurança):**
  1. **Apenas Futuros:** Mantém todo o histórico e aplica as novas configurações para novos sinais.
  2. **Reset de Sinais Ativos + Re-scan:** Limpa sinais ativos e executa nova varredura de mercado com os pesos atuais.
  3. **Reset Global Completo (Padrão de Fábrica):** Zera completamente o banco de dados, histórico, pesos, logs e restaura os padrões de instalação.

---

## 10. Endpoints da API REST

O backend disponibiliza uma API REST documentada:

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/signals` | Retorna a lista de sinais de trading recentes e ativos com dados de TTL. |
| `GET` | `/api/tickers` | Retorna o snapshot quantitativo de todos os tickers monitorados. |
| `GET` | `/api/state` | Retorna o estado operacional global do bot (status, monitoramento, pesos). |
| `GET` | `/api/settings/weights` | Retorna a calibração atual de pesos e configurações de TTL. |
| `POST` | `/api/settings/weights` | Salva novos pesos de confluência e configurações de TTL. |
| `GET` | `/api/system/db-info` | Retorna diagnóstico do banco de dados (tabelas, linhas, tamanho). |
| `POST` | `/api/system/vacuum` | Executa o comando VACUUM no banco SQLite para desfragmentação. |
| `POST` | `/api/system/reset` | Executa o reset parcial ou total do sistema com base no escopo selecionado. |
| `POST` | `/api/ai/review` | Executa auditoria quantitativa de setup com Inteligência Artificial (suporta `customNotes` e `customPromptOverride`). |
| `POST` | `/api/ai/review/preview-prompt` | Sintetiza e retorna a pré-visualização completa do prompt para conferência antes do envio à IA. |
| `GET` | `/api/screener/settings` | Retorna a lista de pares ativos e classes de mercado configuradas. |

---

## 11. Documentação Complementar

Para aprofundamento técnico e operacional, consulte os guias especializados na pasta [`/docs`](./docs):

* 📘 [`docs/GUIA_INSTALACAO_E_CONFIGURACAO.md`](./docs/GUIA_INSTALACAO_E_CONFIGURACAO.md) — Guia detalhado de instalação, Docker, troubleshooting e deploy.
* 🏗️ [`docs/ARQUITETURA_E_FUNCIONAMENTO.md`](./docs/ARQUITETURA_E_FUNCIONAMENTO.md) — Arquitetura interna do backend, threads de cálculo e ingestion.
* ⏳ [`docs/GESTAO_TTL_E_ESTRATEGIAS.md`](./docs/GESTAO_TTL_E_ESTRATEGIAS.md) — Modelagem matemática de TTL, half-life e breakeven.
* ⚙️ [`docs/CONFIGURACOES_E_RESET_GLOBAL.md`](./docs/CONFIGURACOES_E_RESET_GLOBAL.md) — Manual do painel de controle do banco e rotinas de reset.
* 📐 [`docs/INDICADORES_E_FORMULAS.md`](./docs/INDICADORES_E_FORMULAS.md) — Fórmulas matemáticas rigorosas de todos os indicadores.
* ⚖️ [`docs/PESOS_E_CONFLUENCIA.md`](./docs/PESOS_E_CONFLUENCIA.md) — Matriz de confluência, pesos e presets por perfil.
* 🤖 [`docs/SKILLS_E_PROMPTS_IA.md`](./docs/SKILLS_E_PROMPTS_IA.md) — Prompts institucionais e JSON Schemas do Gemini.
* 🖥️ [`docs/FUNCIONALIDADES_E_INTERFACE.md`](./docs/FUNCIONALIDADES_E_INTERFACE.md) — Manual completo de telas, botões e atalhos do teclado.

---

## 12. Solução de Problemas (Troubleshooting)

### 1. Erro de Porta em Uso (`EADDRINUSE: port 3000`)
Caso a porta 3000 já esteja sendo utilizada por outro processo:
```bash
# No Linux/macOS:
lsof -i :3000
kill -9 <PID>

# Ou inicie em outra porta:
PORT=3001 npm run dev
```

### 2. Sinais Não Estão Sendo Gerados
* Verifique se o botão **"Monitoramento Ativo"** no topo da tela está ligado (verde).
* Verifique se o mercado está em baixa volatilidade ou se o corte de confluência mínima na aba de Ajustes está muito restritivo (experimente reduzir de 80% para 60%).
* Abra a aba **Ajustes** $\rightarrow$ **Diagnóstico do Banco** e verifique se as tabelas estão respondendo normalmente.

### 3. Erro na Auditoria com Inteligência Artificial
* Certifique-se de que a variável `GEMINI_API_KEY` está configurada corretamente no seu arquivo `.env`.
* Verifique se você possui cotas ativas no Google AI Studio.

---

<div align="center">
  <sub>Desenvolvido com padrão de engenharia quantitativa e trading institucional.</sub>
</div>
