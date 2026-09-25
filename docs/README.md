# 📊 Market Signals SuperBot — Central de Documentação Quantitativa

> Manual de referência técnica, arquitetura de sistemas, engenharia de Order Flow e guia operacional do **Market Signals SuperBot**.

---

## 📂 Índice Completo dos Módulos

| Módulo | Arquivo | Descrição |
| :--- | :--- | :--- |
| **📦 01. Instalação & Setup** | [`GUIA_INSTALACAO_E_CONFIGURACAO.md`](./GUIA_INSTALACAO_E_CONFIGURACAO.md) | Passo a passo completo para instalação local, Node.js, Docker, variáveis `.env`, portas, compilação de produção e deploy. |
| **🏛️ 02. Arquitetura & Backend** | [`ARQUITETURA_E_FUNCIONAMENTO.md`](./ARQUITETURA_E_FUNCIONAMENTO.md) | Engenharia de software interna: loops de tick, ingestão em batches, banco SQLite, motor de sinais e cliente React SPA. |
| **⏳ 03. Gestão de TTL & Estratégias** | [`GESTAO_TTL_E_ESTRATEGIAS.md`](./GESTAO_TTL_E_ESTRATEGIAS.md) | Modelagem institucional de decaimento de alpha (*Alpha Half-Life*), regimes de volatilidade, invalidação e trailing stop para breakeven. |
| **⚙️ 04. Configurações & Reset Global** | [`CONFIGURACOES_E_RESET_GLOBAL.md`](./CONFIGURACOES_E_RESET_GLOBAL.md) | Diagnóstico do banco de dados SQLite, métricas de tabelas, otimização (*VACUUM*) e rotinas de reset em 3 níveis. |
| **📐 05. Indicadores & Fórmulas** | [`INDICADORES_E_FORMULAS.md`](./INDICADORES_E_FORMULAS.md) | Fórmulas matemáticas rigorosas de CVD, Open Interest, Volume Profile (POC/VAH/VAL), Fibonacci Golden Pocket, FVG e SMC. |
| **⚖️ 06. Pesos & Confluência** | [`PESOS_E_CONFLUENCIA.md`](./PESOS_E_CONFLUENCIA.md) | Calibração quantitativa dos pesos dos indicadores, algoritmo de confluência (0-100%) e perfis de trading concorrentes. |
| **🔢 07. Exemplos Práticos** | [`EXEMPLOS_PRATICOS_CALCULOS.md`](./EXEMPLOS_PRATICOS_CALCULOS.md) | Simulações numéricas passo a passo de entradas em LONG, SHORT e filtro anti-spike de pavios em 1m/5m. |
| **🤖 08. Skills & Prompts de IA** | [`SKILLS_E_PROMPTS_IA.md`](./SKILLS_E_PROMPTS_IA.md) | Prompting institucional, JSON Schemas estruturados, travas de coerência matemática e auditoria via Gemini GenAI. |
| **🖥️ 09. Interface & Ferramentas** | [`FUNCIONALIDADES_E_INTERFACE.md`](./FUNCIONALIDADES_E_INTERFACE.md) | Manual completo de telas: Cockpit, HUD de Sinais, Radar de Presos, Divergências RSI, Risk Dashboard, Position Sizer e Auto-Tuner. |
| **🎨 10. Sistema de Temas** | [`SISTEMA_DE_TEMAS.md`](./SISTEMA_DE_TEMAS.md) | Guia dos temas visuais integrados (Cyberpunk Neon, Matrix Terminal, Bloomberg Terminal, Dark Minimal). |

---

## 🎯 Filosofia de Trading da Plataforma

O **Market Signals SuperBot** combina a mecânica do **Order Flow de Criptoativos e TradFi** (CVD, Open Interest, Funding Rate, Volume Profile) com a **Análise de Estrutura de Mercado** (Golden Pocket Fibonacci, Fair Value Gaps, BOS), **Modelagem Temporal de Alpha (TTL)** e validação em tempo real por **Inteligência Artificial Gemini**.

### Os 4 Pilares de Operação
1. **Confluência Algorítmica Rígida:** Nenhum sinal é gerado por um único indicador isolado. Exige-se o alinhamento simultâneo de múltiplos fatores quantitativos independentes.
2. **Validação Temporal Multi-Timeframe (1m & 5m):** Filtro ativo contra *fakeouts* e armadilhas de liquidez (rejeição de pavio superior/inferior > 55%).
3. **Decaimento Temporal de Alpha (TTL Institucional):** Setups que não são preenchidos na janela ótima expiram automaticamente para proteger o capital contra obsolescência de sinal.
4. **Gerenciamento de Risco e Breakeven Automático:** Posições são calculadas com base em Relação Risco:Retorno (R:R) mínima pré-configurada e movem o Stop Loss para a entrada assim que o Alvo 1 é alcançado.
