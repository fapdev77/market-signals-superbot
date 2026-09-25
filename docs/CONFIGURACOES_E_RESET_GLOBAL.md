# ⚙️ Diagnóstico do Sistema, Banco de Dados & Reset Global

> Manual de auditoria de persistência, métricas de tabelas SQLite, desfragmentação e rotinas de restauração aos padrões de fábrica do **Market Signals SuperBot**.

---

## 📑 Sumário

1. [Visão Geral do Módulo de Configurações](#1-visão-geral-do-módulo-de-configurações)
2. [Painel de Diagnóstico do Banco de Dados SQLite](#2-painel-de-diagnóstico-do-banco-de-dados-sqlite)
3. [Tabelas Monitoradas & Métricas em Tempo Real](#3-tabelas-monitoradas--métricas-em-tempo-real)
4. [Ferramenta de Otimização & Desfragmentação (VACUUM)](#4-ferramenta-de-otimização--desfragmentação-vacuum)
5. [Modal de Reset Global & Níveis de Restauração](#5-modal-de-reset-global--níveis-de-restauração)
6. [Fluxo de Re-scan Imediato de Mercado](#6-fluxo-de-re-scan-imediato-de-mercado)
7. [Boas Práticas de Manutenção e Backup](#7-boas-práticas-de-manutenção-e-backup)

---

## 1. Visão Geral do Módulo de Configurações

A aba **Ajustes de Estratégia** (`StrategySettings.tsx`) foi projetada para oferecer transparência total sobre o estado do sistema, a distribuição dos pesos e o armazenamento local de dados.

Nesta seção, o operador tem acesso ao painel de **Diagnóstico do Sistema & Banco de Dados**, que se comunica diretamente com a API do servidor para auditar o banco SQLite local (`data/market_bot.sqlite`).

---

## 2. Painel de Diagnóstico do Banco de Dados SQLite

O painel exibe um card com métricas em tempo real sobre a saúde do banco de dados:

* **Tamanho do Banco em Disco:** Exibido em Kilobytes (KB) e Megabytes (MB).
* **Total de Linhas Consolidadas:** Soma de todos os registros persistidos na base.
* **Status de Conexão do Driver:** Indicador visual de integridade da conexão com o SQLite / SQL.js.
* **Caminho Físico do Arquivo:** Localização do arquivo no servidor (`data/market_bot.sqlite`).

---

## 3. Tabelas Monitoradas & Métricas em Tempo Real

A grade de diagnóstico detalha a contagem de registros por tabela:

| Tabela SQLite | Papel no Sistema | Dados Armazenados |
| :--- | :--- | :--- |
| **`trade_signals`** | Histórico de Sinais | Sinais de trade gerados, status (`ACTIVE`, `TARGET_REACHED`, `STOPPED_OUT`, `EXPIRED`), timestamps, métricas de confluência e dados de TTL. |
| **`indicator_weights`** | Pesos & Calibração | Pesos das variáveis matemáticas, estratégias ativas e configurações de TTL. |
| **`market_snapshots`** | Snapshots de Mercado | Registros periódicos de preço, volume 24h, Open Interest e Funding Rate. |
| **`ai_audit_reports`** | Auditorias Gemini IA | Diagnósticos, justificativas e relatórios de risco emitidos pelos modelos de Inteligência Artificial. |
| **`strategy_performance`** | Métricas de Backtest | Taxa de acerto histórica (*Win Rate*), Fator de Lucro (*Profit Factor*) e estatísticas consolidadas por modalidade. |

---

## 4. Ferramenta de Otimização & Desfragmentação (VACUUM)

### O que é o comando VACUUM?
No SQLite, quando registros são deletados ou atualizados (por exemplo, na expiração de sinais ou redefinição de pesos), o espaço em disco não é liberado automaticamente para o sistema operacional — ele fica marcado como espaço livre interno.

### Como acionar?
1. Acesse a aba **Ajustes**.
2. No painel de diagnóstico, clique no botão **"Otimizar Banco (VACUUM)"**.
3. O servidor executará a rotina de desfragmentação, reconstruirá os índices B-Tree e liberará espaço no disco rígido, atualizando o tamanho em tempo real na tela.

---

## 5. Modal de Reset Global & Níveis de Restauração

Para permitir que o usuário comece do zero em caso de inconsistências ou deseje recalibrar a aplicação, o sistema oferece um **Modal de Confirmação com 3 Níveis de Escopo**:

```
                              ┌────────────────────────────────────────────────────────┐
                              │            MODAL DE RESET E RESTAURAÇÃO                │
                              └──────────────────────────┬─────────────────────────────┘
                                                         │
               ┌─────────────────────────────────────────┼────────────────────────────────────────┐
               ▼                                         ▼                                        ▼
   [ESCOPO 1: SINAIS FUTUROS]             [ESCOPO 2: RESET DE SINAIS ATIVOS]        [ESCOPO 3: RESET GLOBAL / FÁBRICA]
• Preserva todo o histórico            • Zera os sinais abertos no momento       • Zera TODAS as tabelas do banco
• Salva os novos pesos                 • Preserva histórico de auditorias        • Restaura pesos de fábrica (100%)
• Aplica apenas para novos sinais      • Dispara Re-scan imediato de mercado     • Restaura presets padrão de TTL
• Risco: Baixo                         • Risco: Moderado                         • Risco: Alto (Começar do zero)
```

### Detalhamento dos 3 Escopos:

#### Escopo 1: Aplicar para Sinais Futuros (Preservar Histórico)
* **Comportamento:** Salva os novos pesos de confluência e configurações de TTL no banco de dados.
* **Impacto:** Os sinais atualmente ativos permanecem intocados. Os novos parâmetros serão aplicados apenas nos próximos sinais identificados.

#### Escopo 2: Reset de Sinais Ativos + Re-scan Geral Imediato
* **Comportamento:** Limpa todas as ordens atualmente ativas no book que foram geradas com parâmetros antigos.
* **Impacto:** Mantém o histórico de auditorias e aciona uma nova varredura instantânea de todos os ativos da Binance Futures com a nova calibração de pesos.

#### Escopo 3: Reset Global Completo (Padrão de Fábrica)
* **Comportamento:** Restaura a aplicação exatamente como no primeiro dia de instalação.
* **Ações Executadas no Servidor:**
  1. Limpa todas as tabelas: `trade_signals`, `market_snapshots`, `ai_audit_reports` e `strategy_performance`.
  2. Restaura a tabela `indicator_weights` com a calibração padrão de fábrica (15% Volume, 20% CVD, 20% OI, 15% Fib, 10% Profile, 10% SMC, 10% RSI).
  3. Restaura as configurações de TTL padrão (Scalp 25m, Day Trade 90m, Intraday 240m, Swing 1440m, Regime Normal 1.0x).
  4. Executa um `VACUUM` completo no arquivo SQLite.
  5. Aciona nova varredura de mercado em tempo real.

---

## 6. Fluxo de Re-scan Imediato de Mercado

Ao acionar o botão **"Salvar & Re-escanear Mercado Agora"** ou confirmar os escopos 2 ou 3:
1. O backend atualiza imediatamente o cache de pesos na memória do processo Node.js.
2. Invoca a rotina `runMarketTick(forced = true)` sem aguardar o temporizador padrão.
3. Notifica o frontend através da atualização do estado `BotState`, refletindo novos sinais no cockpit em menos de 1 segundo.

---

## 7. Boas Práticas de Manutenção e Backup

* **Backup Periódico:** Caso utilize a aplicação em ambiente de produção contínuo, faça cópia do arquivo `data/market_bot.sqlite` semanalmente.
* **Execução do Vacuum:** Recomendado executar a cada 10.000 sinais processados para manter o banco leve e com tempo de resposta sub-milissegundo.
