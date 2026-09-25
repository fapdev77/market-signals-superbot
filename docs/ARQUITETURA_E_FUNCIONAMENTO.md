# 🏛️ Arquitetura Interna & Funcionamento do Sistema

> Especificação da engenharia de software, fluxo de dados em tempo real, pipeline de cálculo quantitativo e comunicação cliente-servidor do **Market Signals SuperBot**.

---

## 📑 Sumário

1. [Visão Arquitetural de Alto Nível](#1-visão-arquitetural-de-alto-nível)
2. [Ciclo de Execução do Backend (Tick Loop)](#2-ciclo-de-execução-do-backend-tick-loop)
3. [Motor de Sinais Quantitativos (Signal Engine)](#3-motor-de-sinais-quantitativos-signal-engine)
4. [Validação Multi-Timeframe & Filtro Anti-Spike](#4-validação-multi-timeframe--filtro-anti-spike)
5. [Gerenciador de TTL & Worker de Breakeven](#5-gerenciador-de-ttl--worker-de-breakeven)
6. [Camada de Persistência e Estrutura do Banco SQLite](#6-camada-de-persistência-e-estrutura-do-banco-sqlite)
7. [Mecanismo de Ingestão & Cache de Dados de Mercado](#7-mecanismo-de-ingestão--cache-de-dados-de-mercado)
8. [Pipeline de Auditoria por IA (Gemini GenAI)](#8-pipeline-de-auditoria-por-ia-gemini-genai)
9. [Arquitetura do Frontend React SPA](#9-arquitetura-do-frontend-react-spa)

---

## 1. Visão Arquitetural de Alto Nível

O sistema opera no modelo **Servidor Central de Cálculo + Cliente React Reativo**. Todo o cálculo matemático pesado (Volume Profile de alta resolução, CVD, retrações de Fibonacci, matriz de confluência e expirações de TTL) ocorre no **Node.js backend**, garantindo que o navegador do usuário permaneça ágil, fluido e sem gargalos de CPU.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FEEDS EXTERNOS DE MERCADO                         │
│   • Binance Futures REST/WS (Tickers 24h, Klines 1m/5m/15m/30m/1h/4h)       │
│   • Open Interest & Funding Rates API                                       │
│   • Long/Short Positioning & Top Trader Ratios                              │
│   • TradFi Macro Feed (Yahoo Finance / Índices & Ações Globais)             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Ingestão em Batches com Rate-Limiting
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     BACKEND EXPRESS (`server.ts`)                            │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Institutional TTL Sweep: expireStaleSignals()                      │  │
│  │    • Invalida sinais cujo timestamp atual > expiresAt                 │  │
│  │    • Grava status 'EXPIRED' e motivo no SQLite                        │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 2. Quantitative Ticker Processing: processTickerState()               │  │
│  │    • Volume Profile (POC, VAH, VAL) via matriz de preços ponderada    │  │
│  │    • Retração/Expansão Fibonacci com Golden Pocket (0.618 - 0.68)      │  │
│  │    • Detecção de Fair Value Gaps (FVG) e Quebras de Estrutura (BOS)   │  │
│  │    • Agressão Taker & Cumulative Volume Delta (CVD)                   │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 3. Target, Stop Loss & Trailing Breakeven Tracker                     │  │
│  │    • Verifica se ativo tocou Alvo 2 -> Marca 'TARGET_REACHED'         │  │
│  │    • Verifica se ativo tocou Stop Loss -> Marca 'STOPPED_OUT'         │  │
│  │    • Se tocou Alvo 1 -> Move Stop Loss para Entrada (Breakeven)       │  │
│  │    • Se preço desviou adverso (>1.2%) -> Invalidação Técnica          │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 4. Concurrent Multi-Strategy Evaluation Pool                          │  │
│  │    • SCALP (5m) · DAY TRADE (15m) · INTRADAY (30m)                    │  │
│  │    • SWING (1h) · POSITION (4h) · CONTRA-TRADE (15m)                  │  │
│  │    • Geração de sinais independentes com cálculo de TTL efetivo       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 ▼                                           ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│       BANCO DE DADOS LOCAL      │         │         CLIENTE FRONTEND        │
│ SQLite / SQL.js (`data/*.sqlite`)│         │ React 19 + Tailwind CSS SPA     │
│ Sinais, Pesos, Snapshots, Logs  │         │ Visualização de Sinais, Gráfico │
└─────────────────────────────────┘         │ Cockpit, HUD e Radar de Risco   │
                                            └─────────────────────────────────┘
```

---

## 2. Ciclo de Execução do Backend (Tick Loop)

O núcleo do backend executa a rotina `runMarketTick(forced)` a cada 3 a 5 segundos de forma contínua:

1. **Trava de Concorrência (`isMarketTickRunning`):** Garante que duas varreduras não se sobreponham em caso de lentidão temporária da rede.
2. **Varredura Preventiva de TTL (`expireStaleSignals`):** Itera sobre o banco de dados e marca como `EXPIRED` qualquer sinal ativo cujo tempo limite de validade tenha expirado.
3. **Ingestão em Lotes (Batch Size = 4):** Para evitar bloqueios de socket e respeitar o limite de requisições por minuto da Binance, os pares monitorados são processados em grupos concorrentes de 4 ativos.
4. **Resolução de Klines & Timeframes:**
   * Busca velas do timeframe primário (ex: 30m) para cálculo do Volume Profile.
   * Busca Open Interest atualizado e Funding Rate do ativo.
   * Busca Klines dos timeframes específicos de cada estratégia ativada (5m, 15m, 1h, 4h).
5. **Cálculo dos Indicadores:** Converte os dados brutos no estado `TickerData` enriquecido com métricas quantitativas.
6. **Atualização de Sinais Ativos:** Atualiza o `currentPrice` de todos os sinais abertos, checando se atingiram Alvo 1, Alvo 2, Stop Loss ou Breakeven.
7. **Avaliação Multi-Estratégia:** Invoca `buildTradeSignal(...)` para cada estratégia habilitada, gerando novos sinais caso a confluência supere o limiar configurado.

---

## 3. Motor de Sinais Quantitativos (Signal Engine)

Localizado em `server/signalEngine.ts`, o motor calcula os seguintes componentes:

### A. Volume Profile em Tempo Real (`calculateVolumeProfile`)
Divide a amplitude de preços das últimas $N$ velas em 50 a 100 *price buckets*. Cada tick de volume é alocado no seu respectivo nível de preço.
* **Point of Control (POC):** O nível de preço com o maior volume acumulado negociado no período.
* **Value Area High (VAH) & Value Area Low (VAL):** A faixa de preços que concentra exatamente 70% de todo o volume negociado no intervalo.

### B. Níveis de Fibonacci & Golden Pocket (`calculateFibonacci`)
Identifica a máxima e mínima mais recentes do balanço de mercado (*Swing High / Swing Low*):
* Níveis calculados: $0.236$, $0.382$, $0.500$, $0.618$, $0.680$, $0.786$, $-0.272$, $-0.618$.
* **Golden Pocket:** Faixa entre $0.618$ e $0.680$. Sinais gerados quando o preço retesta essa zona recebem pontuação máxima de confluência.

### C. Fair Value Gaps (FVG) & Single Prints (`detectFVG`)
Identifica desbalanços de liquidez onde a mínima da vela $i+2$ não encosta na máxima da vela $i$ (em movimentos altistas) ou a máxima da vela $i+2$ não encosta na mínima da vela $i$ (em movimentos baixistas).

### D. Algoritmo de Confluência Ponderada (0 a 100%)
A pontuação final de confluência $\mathcal{C}$ é calculada somando os pesos das variáveis alinhadas:
$$\mathcal{C} = \sum_{k=1}^{n} w_k \cdot \mathbb{I}_k$$
Onde $w_k$ é o peso configurado da variável $k$ e $\mathbb{I}_k \in \{0, 1\}$ é o indicador booleano de confirmação daquela métrica.

---

## 4. Validação Multi-Timeframe & Filtro Anti-Spike

Para evitar que o robô seja induzido a erro por falsos rompimentos (*fakeouts*) e absorções efêmeras, todo sinal passa por um pipeline de validação em 2 etapas:

```
Sinal Detectado no Book
         │
         ▼
[Vela de 1m Sustentou Volume?] ─── NÃO ───► REJECTED_SPIKE (Spike Descartado)
         │ SIM
         ▼
[Vela de 5m Alinhada com Tendência?] ─── NÃO ───► PENDING_VALIDATION (Aguardando)
         │ SIM
         ▼
    CONFIRMED (Sinal Validado & Liberado para Execução)
```

1. **`PENDING_VALIDATION`:** O sinal foi detectado no book e aguarda o fechamento dos candles para atestar que o volume não foi absorvido.
2. **`CONFIRMED`:** O sinal sustentou volume após fechamento de 1m e confirmou alinhamento no gráfico de 5m.
3. **`REJECTED_SPIKE`:** A agressão sumiu após tocar na zona e o preço reverteu com rejeição de pavio superior/inferior $> 55\%$.

---

## 5. Gerenciador de TTL & Worker de Breakeven

O ciclo de vida dos sinais é controlado com base na modelagem matemática de *Alpha Half-Life*:

```typescript
// Estrutura de Validade de Sinal
export interface TradeSignal {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  strategyCategory?: StrategyCategory;
  entryZone: [number, number];
  currentPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  createdAt: number;
  expiresAt?: number;
  ttlMinutes?: number;
  isBreakevenActive?: boolean;
  expirationReason?: string;
  status: 'ACTIVE' | 'TARGET_REACHED' | 'STOPPED_OUT' | 'EXPIRED';
}
```

### Regras de Transição de Estado:
1. **`ACTIVE` $\rightarrow$ `TARGET_REACHED`:** Quando `currentPrice >= target2` (LONG) ou `currentPrice <= target2` (SHORT).
2. **`ACTIVE` $\rightarrow$ `STOPPED_OUT`:** Quando `currentPrice <= stopLoss` (LONG) ou `currentPrice >= stopLoss` (SHORT).
3. **`ACTIVE` $\rightarrow$ `EXPIRED`:** Quando `now > expiresAt` (TTL temporal) ou ocorre movimento adverso de preço antes do preenchimento da ordem.
4. **Proteção de Breakeven:** Quando `currentPrice >= target1` (LONG), o sistema seta `isBreakevenActive = true`, move `stopLoss = entryZone[0]` e atualiza a mensagem descritiva para *Risco Zero*.

---

## 6. Camada de Persistência e Estrutura do Banco SQLite

O banco `data/market_bot.sqlite` contém as seguintes tabelas otimizadas com índices:

### 1. `trade_signals`
Armazena todos os sinais gerados, parâmetros operacionais, métricas de confluência, timestamps de detecção/validação e campos de TTL:
* `id` (TEXT PRIMARY KEY)
* `symbol` (TEXT)
* `market_type` (TEXT)
* `signal_type` (TEXT)
* `direction` (TEXT)
* `strategy_category` (TEXT)
* `entry_min` / `entry_max` (REAL)
* `current_price` / `stop_loss` / `target1` / `target2` (REAL)
* `confluence_score` (INTEGER)
* `confluence_factors` (TEXT JSON)
* `timeframe` (TEXT)
* `validation_status` / `validation_stage` (TEXT)
* `created_at` / `validated_at` / `rejected_at` (INTEGER)
* `expires_at` / `ttl_minutes` (INTEGER)
* `expiration_reason` (TEXT)
* `is_breakeven_active` (INTEGER BOOLEAN)
* `status` (TEXT)

### 2. `indicator_weights`
Armazena os pesos calibrados dos indicadores, estratégias ativas, limiares de R:R e configurações de TTL de fábrica/customizadas.

### 3. `market_snapshots`
Histórico de capturas periódicas de preço, volume 24h, open interest, CVD e funding rate.

### 4. `ai_audit_reports`
Registro histórico de todas as revisões e auditorias executadas pelos modelos Gemini.

---

## 7. Mecanismo de Ingestão & Cache de Dados de Mercado

Para garantir baixa latência e consumo eficiente de rede:
* **Cache em Memória de Klines:** Klines recentes são mantidos em cache volátil por 10 segundos para reaproveitamento entre diferentes módulos.
* **Ticker State Cache:** O estado consolidado de cada ativo fica acessível instantaneamente na memória para resposta imediata das rotas da API REST.

---

## 8. Pipeline de Auditoria por IA (Gemini GenAI)

Ao solicitar auditoria de sinal (`/api/ai/review`):
1. O backend extrai o contexto completo do ativo: dados de Order Flow, delta CVD, zona de POC, alinhamento de Fibonacci, Funding Rate e parâmetros da ordem.
2. Formata a requisição utilizando **JSON Schema Estruturado** com tipagem estrita para o modelo `gemini-3.7-flash` ou `gemini-3.5-flash`.
3. O modelo avalia a robustez estatística do setup e retorna a resposta com:
   * `decision`: `CONFIRM` | `ADJUST` | `REJECT`
   * `adjustedEntryZone`, `adjustedStopLoss`, `adjustedTakeProfit1`, `adjustedTakeProfit2`
   * `confidenceScore` (0 a 100%)
   * `reasoning`: Explicação textual das confluências e riscos identificados.
4. O resultado é salvo no banco de dados e sincronizado em tempo real com o card visual do sinal.

---

## 9. Arquitetura do Frontend React SPA

O frontend foi construído utilizando **React 19**, **TypeScript** e **Tailwind CSS**, organizado de forma modular:

* **`SignalsMatrix.tsx`:** Renderização da matriz institucional de sinais, HUD de métricas, controles de filtro por ciclo de vida e gauges de decaimento de TTL.
* **`ChartAndProfile.tsx`:** Gráfico interativo de velas com camadas de POC, VAH, VAL, FVGs e níveis operacionais.
* **`StrategySettings.tsx`:** Painel de configuração de pesos, ativador multi-estratégia, sliders de TTL, seleção de regimes de volatilidade e ferramentas de diagnóstico do SQLite.
* **`RiskExposureDashboard.tsx`:** Métricas de VaR, concentração de portfólio e matriz de correlação cruzada.
* **`PositionSizerCalculator.tsx`:** Calculadora de dimensionamento de lote baseada em risco financeiro e Critério de Kelly.
* **`StrategyAutoTuner.tsx`:** Algoritmo genético de otimização de pesos com simulação de Monte Carlo e walk-forward.
* **`SystemDatabaseSettings.tsx`:** Widget de monitoramento de saúde do banco de dados e acionador de rotinas de reset.
