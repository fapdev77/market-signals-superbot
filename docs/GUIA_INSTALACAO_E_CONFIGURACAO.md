# 📦 Guia de Instalação, Configuração & Implantação

> Manual passo a passo para instalação local, configuração de ambiente, execução em modo de desenvolvimento, compilação de produção e deploy do **Market Signals SuperBot**.

---

## 📑 Sumário

1. [Pré-Requisitos do Sistema](#1-pré-requisitos-do-sistema)
2. [Clonagem e Estrutura do Projeto](#2-clonagem-e-estrutura-do-projeto)
3. [Instalação das Dependências](#3-instalação-das-dependências)
4. [Configuração do Arquivo de Ambiente (.env)](#4-configuração-do-arquivo-de-ambiente-env)
5. [Execução em Modo de Desenvolvimento](#5-execução-em-modo-de-desenvolvimento)
6. [Compilação e Execução para Produção (Build & Start)](#6-compilação-e-execução-para-produção-build--start)
7. [Configuração do Banco de Dados SQLite](#7-configuração-do-banco-de-dados-sqlite)
8. [Execução com Docker (Opcional)](#8-execução-com-docker-opcional)
9. [Diagnóstico de Conectividade e APIs Externas](#9-diagnóstico-de-conectividade-e-apis-externas)
10. [Perguntas Frequentes & Resolução de Erros](#10-perguntas-frequentes--resolução-de-erros)

---

## 1. Pré-Requisitos do Sistema

Antes de iniciar a instalação, certifique-se de que sua máquina atende aos requisitos mínimos:

### Hardware Recomendado
* **Processador:** 2 núcleos (Dual Core) ou superior.
* **Memória RAM:** 2 GB de RAM disponível (4 GB recomendado).
* **Armazenamento:** 500 MB de espaço livre em disco.

### Softwares e Runtimes
* **Node.js:** Versão `18.18.0` ou superior (recomendado `20.x LTS` ou `22.x LTS`).
  * Para verificar sua versão: `node -v`
* **Gerenciador de Pacotes:** `npm` (versão 9+), `pnpm`, `yarn` ou `bun`.
  * Para verificar a versão do npm: `npm -v`
* **Git:** Para clonagem e controle de versão.

---

## 2. Clonagem e Estrutura do Projeto

Abra o seu terminal e execute:

```bash
# Clone o repositório
git clone <URL_DO_REPOSITORIO>

# Acesse o diretório do projeto
cd market-signals-superbot
```

### Estrutura de Diretórios Principais
```
market-signals-superbot/
├── data/                      # Armazenamento do arquivo SQLite local (market_bot.sqlite)
├── docs/                      # Documentação técnica e quantitativa completa
├── server/                    # Módulos de backend
│   ├── db.ts                  # Camada de banco de dados SQLite / SQL.js
│   ├── routes/                # Rotas da API REST (AI, System, Screener, etc.)
│   └── signalEngine.ts        # Motor de cálculo quantitativo e geração de sinais
├── src/                       # Frontend React 19 + TypeScript
│   ├── components/            # Componentes visuais do cockpit, matriz, gráficos, etc.
│   ├── constants/             # Presets de estratégias e configurações padrão
│   ├── hooks/                 # Custom hooks (keybinds, stream polling, etc.)
│   ├── services/              # Cliente HTTP e WebSocket
│   ├── types.ts               # Tipos TypeScript centralizados
│   └── utils/                 # Formatadores, cálculos de risco, TTL e métricas
├── server.ts                  # Servidor Express e ponto de entrada da API
├── package.json               # Dependências e scripts de execução
├── tsconfig.json              # Configuração do TypeScript
└── vite.config.ts             # Configuração do empacotador Vite
```

---

## 3. Instalação das Dependências

Instale todas as dependências do projeto executando o comando correspondente ao seu gerenciador:

```bash
# Usando NPM (Padrão)
npm install

# Ou usando PNPM
pnpm install

# Ou usando Yarn
yarn install

# Ou usando Bun
bun install
```

O comando irá baixar e configurar bibliotecas como `react`, `lucide-react`, `tailwindcss`, `express`, `sql.js`, `@google/genai`, `recharts` e ferramentas de build do `vite` e `typescript`.

---

## 4. Configuração do Arquivo de Ambiente (.env)

O projeto possui um arquivo de exemplo denominado `.env.example`. Crie o seu arquivo `.env` a partir dele:

```bash
cp .env.example .env
```

Abra o arquivo `.env` em seu editor de código favorito (ex: VS Code) e configure os parâmetros:

```env
# ==============================================================================
# CONFIGURAÇÕES DE AMBIENTE - MARKET SIGNALS SUPERBOT
# ==============================================================================

# Porta TCP do Servidor (Padrão: 3000)
PORT=3000

# Ambiente de Execução (development / production)
NODE_ENV=development

# Chave de API do Google Gemini para Auditoria de Sinais por IA
# Obtenha sua chave gratuita em: https://aistudio.google.com/
GEMINI_API_KEY=AIzaSy...sua_chave_aqui
```

> **Nota sobre a chave Gemini:** A chave é opcional para as funções de indicadores matemáticos, Order Flow e gráficos. No entanto, ela é necessária caso você queira utilizar a função **"Auditar com IA"** ou diagnósticos automáticos via LLM.

---

## 5. Execução em Modo de Desenvolvimento

Para iniciar o servidor backend e o servidor de desenvolvimento frontend com hot-reloading integrado:

```bash
npm run dev
```

Você verá a saída no terminal informando que o servidor está rodando:
```
  VITE v6.x.x  ready in 320 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

Abra o navegador e acesse: **`http://localhost:3000`**

O backend iniciará automaticamente os loops de varredura da Binance Futures, cálculo dos indicadores de Volume Profile, CVD, Open Interest e geração contínua de sinais multi-timeframe.

---

## 6. Compilação e Execução para Produção (Build & Start)

Para implantar a aplicação em um ambiente de produção (VPS, Cloud Server, AWS EC2, DigitalOcean, Google Cloud Run, etc.):

### Passo 1: Validar tipos TypeScript e compilar os bundles
```bash
npm run build
```
Esse comando executa o `tsc` (TypeScript Compiler) e o `vite build`, gerando os arquivos estáticos otimizados na pasta `dist/`.

### Passo 2: Iniciar o servidor de produção
```bash
npm start
```
O servidor Express servirá os assets estáticos da pasta `dist/` e todas as rotas da API REST `/api/*` com máxima performance e baixo consumo de memória.

---

## 7. Configuração do Banco de Dados SQLite

A persistência do **Market Signals SuperBot** utiliza um banco de dados SQLite local acionado via `sql.js` com escrita periódica no disco:

* **Local do arquivo de banco:** `data/market_bot.sqlite`
* **Criação Automática:** Se o arquivo não existir, ele será criado automaticamente na primeira execução com todas as tabelas e índices necessários (`trade_signals`, `market_snapshots`, `ai_audit_reports`, `indicator_weights`, `strategy_performance`).
* **Migrações Automáticas:** Ao atualizar a aplicação, novas colunas (como `expires_at`, `ttl_minutes`, `is_breakeven_active`) são migradas sem perda dos seus dados anteriores.
* **Manutenção e Backup:** Você pode fazer backup do arquivo `data/market_bot.sqlite` a qualquer momento ou utilizar as ferramentas de **Diagnóstico & Vacuum** na aba **Ajustes** da aplicação.

---

## 8. Execução com Docker (Opcional)

Se preferir rodar a aplicação em contêiner Docker:

### Exemplo de `Dockerfile`
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/types.ts ./src/types.ts
COPY --from=builder /app/src/constants ./src/constants
COPY --from=builder /app/src/utils ./src/utils
EXPOSE 3000
CMD ["npm", "start"]
```

### Comandos de Construção e Execução Docker
```bash
# Construir a imagem Docker
docker build -t market-signals-superbot .

# Executar o contêiner mapeando a porta 3000 e persistindo os dados
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e GEMINI_API_KEY="sua_chave_aqui" \
  --name superbot \
  market-signals-superbot
```

---

## 9. Diagnóstico de Conectividade e APIs Externas

A aplicação conecta-se aos seguintes serviços externos públicos:
* **Binance Futures REST & WebSocket:**
  * Endpoints públicos da Binance: `https://fapi.binance.com/fapi/v1/...`
  * Não exige chave de API privada da Binance para ler dados de mercado abertos (*Order Book, Tickers, Klines, Open Interest, Funding Rate*).
* **Yahoo Finance / TradFi Macro Proxy:**
  * Para cotações de SPY, QQQ, NVDA, AAPL, PETR4, VALE3, GLD e Moedas.
* **Google Gemini API:**
  * Endpoint seguro: `https://generativelanguage.googleapis.com/...`

---

## 10. Perguntas Frequentes & Resolução de Erros

### Q1: O que fazer se a porta 3000 estiver ocupada?
Defina a variável `PORT` ao iniciar:
```bash
PORT=3005 npm run dev
```

### Q2: Os dados da Binance estão bloqueados por restrição regional (Geoblocking)?
Caso seu servidor esteja hospedado em uma região onde a Binance restringe conexões de futuros (ex: EUA continental sem VPN), a aplicação conta com um gerador quantitativo sintético de fallback que simula a física de book e klines realistas sem travar a interface.

### Q3: Como redefinir o bot para o padrão de fábrica?
Abra a aplicação $\rightarrow$ clique na aba **Ajustes** $\rightarrow$ role até a seção **Diagnóstico do Sistema & Banco de Dados** $\rightarrow$ clique em **"Reset Global / Padrão de Fábrica"** e confirme o escopo de restauração total.
