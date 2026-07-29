# 📊 Market Signals SuperBot - Documentação Quantitativa & Guia do Trader

Bem-vindo à documentação oficial do **Market Signals SuperBot**. Este material foi estruturado pela equipe de Engenharia Quantitativa e Trading Institucional para servir como manual de referência técnica e operacional para traders.

---

## 📂 Estrutura da Documentação

A documentação está dividida em 4 módulos especializados localizados nesta pasta `/docs`:

| Módulo | Arquivo | Descrição |
| :--- | :--- | :--- |
| **01. Indicadores & Fórmulas** | [`INDICADORES_E_FORMULAS.md`](./INDICADORES_E_FORMULAS.md) | Explicação detalhada de cada indicador quantitativo, mecânica de Order Flow, fórmulas matemáticas rigorosas e interpretação operacional de mercado. |
| **02. Pesos & Confluência** | [`PESOS_E_CONFLUENCIA.md`](./PESOS_E_CONFLUENCIA.md) | Configurações de pesos do motor quantitativo, perfis de operação (Scalp, Day Trade, Intraday, Swing Trade) e algoritmo de pontuação de confluência (0-100%). |
| **03. Exemplos Práticos** | [`EXEMPLOS_PRATICOS_CALCULOS.md`](./EXEMPLOS_PRATICOS_CALCULOS.md) | Simulações numéricas reais passo a passo de entradas em LONG, SHORT e filtro anti-spike de pavios em 1m/5m. |
| **04. Skills & Prompts de IA** | [`SKILLS_E_PROMPTS_IA.md`](./SKILLS_E_PROMPTS_IA.md) | Prompting institucional, JSON Schemas, regras de auditoria e diretrizes de IA para o motor Gemini (Google GenAI). |

---

## 🎯 Filosofia de Trading da Plataforma

O **Market Signals SuperBot** combina a mecânica do **Order Flow de Criptoativos e TradFi** (CVD, Open Interest, Funding Rate, Volume Profile) com a **Análise de Estrutura de Mercado** (Golden Pocket Fibonacci, Fair Value Gaps, BOS) e validação em tempo real por **Modelos de Inteligência Artificial Gemini 3.6 / 3.5 Flash**.

### Os 3 Pilares de Entrada
1. **Confluência Algorítmica Rígida:** Nenhum sinal é gerado por um único indicador. Exige-se o alinhamento de no mínimo 3 a 5 fatores quantitativos independentes.
2. **Validação Temporal Multi-Timeframe (1m & 5m):** Filtro ativo contra *fakeouts* e *spikes* de liquidez (rejeição de pavio superior/inferior > 55%).
3. **Gerenciamento de Risco Matemático:** Posições calculadas com base em Relação Risco:Retorno (R:R) mínima pré-configurada por perfil operacional.

---

## 🚀 Como utilizar esta documentação

- **Para Traders Iniciantes/Intermediários:** Leia o guia de [`INDICADORES_E_FORMULAS.md`](./INDICADORES_E_FORMULAS.md) para dominar conceitos cruciais como *CVD*, *POC* e *Golden Pocket*.
- **Para Operadores Quantitativos:** Consulte [`PESOS_E_CONFLUENCIA.md`](./PESOS_E_CONFLUENCIA.md) para ajustar o motor de backtest e calibrar os pesos das variáveis.
- **Para Desenvolvedores & Analistas de IA:** Estude [`SKILLS_E_PROMPTS_IA.md`](./SKILLS_E_PROMPTS_IA.md) para entender a arquitetura de validação por IA e as travas de consistência matemática.
