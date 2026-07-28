# Plano de Implementação: Motor de Backtest e Validação Contínua (IA)

## 1. Visão Geral
O objetivo é criar um motor de backtest robusto que utilize dados históricos (inicialmente de 30 a 90 dias, com resolução de 1 minuto) para testar, validar e ranquear estratégias antes de emitirem sinais no ambiente ao vivo. A inteligência artificial utilizará esses resultados para aprender e otimizar as confluências ao longo do tempo.

## 2. Estratégia de Dados (Histórico)
Para não depender exclusivamente da API da Binance em cada teste e evitar limites de requisição:
- **Resolução de Dados:** Velas (Candles) de 1 minuto (1m) para máxima precisão de entradas e saídas (Scalp, Day Trade).
- **Armazenamento Local:** Utilizaremos um banco de dados local (SQLite com Drizzle ORM ou arquivos Parquet/JSON particionados por ativo e mês) para armazenar os klines.
- **Sincronização Incremental:** O sistema verificará a data do último candle salvo localmente e fará o download apenas dos novos dados até o momento atual (delta sync).

## 3. Estratégia de Caching de Resultados
- **Tabela de Resultados (Backtest Runs):** Cada execução de backtest irá gerar um registro contendo:
  - Hash da estratégia/pesos utilizados.
  - Período do teste (Data Início, Data Fim).
  - Ativo (ex: BTCUSDT).
  - Métricas de Performance (Win Rate, Profit Factor, Max Drawdown, Net Profit, Quantidade de Trades).
- **Reutilização:** Ao solicitar uma análise da IA ou visualizar o dashboard, o sistema lerá o cache do teste anterior caso a estratégia e os parâmetros não tenham mudado, acelerando muito a resposta.
- **Opções do Usuário:** O usuário terá as opções de "Utilizar Cache" ou "Forçar Novo Backtest" na interface.

## 4. Integração com a Inteligência Artificial
- **Filtro de Confiança:** Sinais ao vivo só serão liberados para o usuário se a estratégia geradora possuir um backtest recente validado (ex: Win Rate > 60% e Profit Factor > 1.5).
- **Aprendizado (Feedback Loop):** O LLM (Gemini) terá acesso aos metadados dos backtests passados para entender quais indicadores (MACD, RSI, Order Flow, CVD) tiveram maior peso de sucesso no último mês para aquele ativo específico.

## 5. Cronograma e Tarefas de Implementação

### Fase 1: Infraestrutura de Dados e Sincronização
- [ ] Tarefa 1.1: Configurar Drizzle ORM com SQLite (ou sistema de arquivos) para persistência dos dados de mercado.
- [ ] Tarefa 1.2: Criar esquema de tabelas para `historical_klines` e `backtest_results`.
- [ ] Tarefa 1.3: Desenvolver serviço de ingestão incremental de dados da Binance (`syncHistoricalData(symbol, days)`).
- [ ] Tarefa 1.4: Criar endpoint na API (`/api/backtest/sync`) para disparar a sincronização via painel.

### Fase 2: O Motor de Backtest (Engine)
- [ ] Tarefa 2.1: Criar classe/módulo `BacktestEngine` capaz de rodar em cima do array de klines locais.
- [ ] Tarefa 2.2: Implementar lógica de simulação de preenchimento de ordens (slippage, taxas da Binance, checagem de Stop Loss e Take Profit intra-candle de 1m).
- [ ] Tarefa 2.3: Calcular métricas finais de performance (Sharpe Ratio, Drawdown, Profit Factor, Win Rate).
- [ ] Tarefa 2.4: Salvar/atualizar os resultados na tabela de `backtest_results` (Caching).

### Fase 3: Dashboard e Interface do Usuário
- [ ] Tarefa 3.1: Criar aba `Backtest` no painel principal.
- [ ] Tarefa 3.2: Desenvolver interface de configuração do teste (seleção de ativo, período 30-90 dias, botão de forçar re-teste ou usar cache).
- [ ] Tarefa 3.3: Desenvolver visualização de resultados (Gráfico de Equity/Curva de Capital, lista de trades, cards de métricas).

### Fase 4: Integração com Motor de Sinais e IA
- [ ] Tarefa 4.1: Adicionar middleware no gerador de sinais para verificar se a estratégia está validada no backtest recente.
- [ ] Tarefa 4.2: Injetar histórico de resultados de backtest no prompt do LLM durante a auditoria de IA para refinar o *Reasoning*.
- [ ] Tarefa 4.3: Exibir a métrica de "Confiança do Backtest" diretamente no card do sinal e no Dashboard Unificado do Ativo.

## 6. Próximos Passos
Após a aprovação desta especificação, iniciaremos a **Fase 1**, configurando o banco de dados e a sincronização de Klines de 1m a partir da Binance.
