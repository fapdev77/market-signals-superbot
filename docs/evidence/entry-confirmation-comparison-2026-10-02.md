# Comparativo da confirmação de entrada (7.2)

- **Símbolo:** BTCUSDT
- **Período:** 30 dias
- **Semente:** 42
- **engineVersion:** d31cb5a
- **Gerado em:** 2026-10-02T00:30:00.000Z

Experimento pareado: mesmo período, símbolos, semente e engineVersion; muda só
`ENTRY_CONFIRMATION_ENABLED`. R por SINAL EMITIDO (não preenchido conta 0 R).

## Braço A — controle (sem confirmação)

| Controle | |
|---|---|
| Sinais emitidos | 427 |
| Preenchidos | 427 |
| Taxa de preenchimento | 100.0% |
| Fechados | 550 |
| Win rate | 35.09% |
| Expectativa líquida (R/sinal emitido) | -1.2221 |
| Drawdown máximo | 37.17% |
| Tempo médio até o preenchimento | 1.0 min |
| ENTRY_NOT_FILLED | 0.0% |

## Braço B — com confirmação (PENDING_ENTRY)

| Com confirmação | |
|---|---|
| Sinais emitidos | 538 |
| Preenchidos | 297 |
| Taxa de preenchimento | 55.2% |
| Fechados | 406 |
| Win rate | 40.64% |
| Expectativa líquida (R/sinal emitido) | -0.5255 |
| Drawdown máximo | 18.89% |
| Tempo médio até o preenchimento | 1.7 min |
| ENTRY_NOT_FILLED | 35.5% |

## Diferença de expectativa por sinal emitido (B − A)

- Média: **0.6966 R**
- IC 95% bootstrap: [0.5350, 0.8529]

## Regra de decisão pré-registrada (7.2.3)

- (a) 297 trades preenchidos ≥ 30 — OK.
- (b) diferença de expectativa por sinal emitido = 0.6966 R > 0 — OK.
- (c) drawdown 18.89% ≤ 44.60% (controle 37.17% + 20%) — OK.
- Veredito: flag PODE ser ligada; registrar a decisão e congelar o motor (tag engine-freeze-*).

**Veredito: LIGAR a flag**

> Limitação declarada: R4 usa vela de 5m AGREGADA de 1m (o live usa a 5m real da exchange); R por sinal emitido (não preenchido = 0).
