## Fase 2 (proposta, somente implementar apos a fase 1.1-hotfix estiver concluída)

Ordem pensada para que cada etapa sirva de base à seguinte:

- **2.1 Ingestão:** usar só endpoints `fapi` para perps, WebSocket como feed principal, controle de peso e backoff em 429/418.
- **2.2 Motor de sinais:** OI real (histórico) no lugar do estimado, intervalo de funding por contrato, validação 1m/5m com klines reais, confirmação de entrada, stop/alvo por high/low de candle, recalibração dos limiares de score (hoje há código morto).
- **2.3 Backtest verdadeiro:** reutilizar `processTickerState`/`buildTradeSignal`, checar cada candle (stop primeiro se ambos no mesmo candle), taxas, slippage e funding no saldo, breakeven e parciais como no live, walk-forward com out-of-sample, semente fixa e Sharpe corrigido.
- **2.4 TradFi real:** a Binance oferece esses contratos: as linhas do `exchangeInfo` com `contractType` `TRADIFI_PERPETUAL` cobrem ações, FX e metais, e o horário segue o mercado subjacente, com `GET /fapi/v1/tradingSchedule`. Uma fonte de terceiros contava 180 contratos TradFi na Binance em 1º de setembro de 2026, e a Binance lançou perpétuos de FX em setembro de 2026. Então basta filtrar o `exchangeInfo`, respeitar o `tradingSchedule` (sem sinais com o mercado fechado) e confirmar quais dos seus SPY/QQQ/NVDA/AAPL/TSLA/GOLD existem, pois não consegui confirmar SPY e QQQ.

## Decisões para você aprovar

1. Auth sem token configurado: **gerar token aleatório no boot** (minha recomendação) ou **recusar iniciar**? R: gerar token aleatório no boot
2. Aprova executar o 1.1 inteiro antes de qualquer item da Fase 2? R: Sim, implementar a phase-1-1-hotfix primeiro
3. Aprova a ordem 2.1 → 2.2 → 2.3 → 2.4? R: Sim
