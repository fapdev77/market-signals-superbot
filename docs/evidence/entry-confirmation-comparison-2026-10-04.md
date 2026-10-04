# Comparativo PAREADO da confirmação de entrada (8.2) — universo

- **Símbolos (5):** BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT
- **Período:** 30 dias
- **Semente:** 42
- **engineVersion:** 692ddb6
- **Origem dos dados:** LIVE — klines reais da Binance (origin=LIVE; ALLOW_SYNTHETIC_DATA=false)
- **Gerado em:** 2026-10-04T10:00:00.000Z

Experimento pareado por SINAL (mesma chave, prefixada pelo símbolo): mesmo período,
semente e engineVersion; muda só `ENTRY_CONFIRMATION_ENABLED`. Sinal ausente ou não
preenchido em um braço conta 0 R. O bootstrap reamostra PARES (CA-2.1/CA-2.2).

## Por símbolo

| Símbolo | Pares | Preenchidos A/B | Exp. A (R) | Exp. B (R) | Δ R | IC95% Δ | DD A | DD B |
|---|---|---|---|---|---|---|---|---|
| BTCUSDT | 884 | 124/0 | -0.1821 | 0.0000 | 0.1821 | [0.1102, 0.2495] | 13.56% | 0.00% |
| ETHUSDT | 363 | 50/0 | -0.1679 | 0.0000 | 0.1679 | [0.0905, 0.2511] | 8.07% | 0.00% |
| SOLUSDT | 687 | 118/0 | -0.0836 | 0.0000 | 0.0836 | [0.0007, 0.1575] | 15.82% | 0.00% |
| BNBUSDT | 1578 | 169/0 | -0.0662 | 0.0000 | 0.0662 | [0.0199, 0.1085] | 15.98% | 0.00% |
| XRPUSDT | 1063 | 164/0 | -0.1170 | 0.0000 | 0.1170 | [0.0654, 0.1635] | 26.44% | 0.00% |

## Braço A — controle (sem confirmação), agregado

| Controle | |
|---|---|
| Sinais no conjunto pareado | 4575 |
| Posições preenchidas | 625 |
| Posições fechadas | 623 |
| Win rate (por posição) | 17.98% |
| Expectativa líquida (R/sinal pareado) | -0.1111 |
| Drawdown máximo | 26.44% |
| Custo médio (taxas+slippage+funding) | 0.7092 R |
| Não preenchidos (próprios) | 0.0% |

## Braço B — com confirmação (PENDING_ENTRY), agregado

| Com confirmação | |
|---|---|
| Sinais no conjunto pareado | 4575 |
| Posições preenchidas | 0 |
| Posições fechadas | 0 |
| Win rate (por posição) | 0.00% |
| Expectativa líquida (R/sinal pareado) | 0.0000 |
| Drawdown máximo | 0.00% |
| Custo médio (taxas+slippage+funding) | 0.0000 R |
| Não preenchidos (próprios) | 94.8% |

## Diferença PAREADA de expectativa por sinal (B − A), agregado

- Pares: **4575**
- Média: **0.1111 R**
- IC 95% bootstrap pareado: [0.0832, 0.1375]

## Regra de decisão pré-registrada v2 (8.2.2)

- (a) amostra insuficiente: controle 625, confirmação 0 (mínimo 30/braço e 60 no agregado) — barra.
- (b) IC 95% pareado da diferença = [0.0832, 0.1375] R, limite inferior 0.0832 > 0 — OK.
- (c) drawdown 0.00% ≤ 31.73% (limite = controle 26.44% + 20% RELATIVOS, ou seja ×1.20) — OK.
- (d) expectativa líquida absoluta do braço com confirmação = 0.0000 R ≥ 0 — OK.
- Veredito: MANTER a flag DESLIGADA (motivo registrado).

**Veredito: MANTER a flag DESLIGADA**

> Limitação declarada: R4 usa vela de 5m AGREGADA de 1m (o live usa a 5m real da exchange); R por sinal emitido (não preenchido = 0).
