# Comparativo PAREADO da confirmação de entrada (8.2) — universo

- **Símbolos (5):** BTCUSDT, ETHUSDT, SOLUSDT, AAVEUSDT, PEPEUSDT
- **Período:** 30 dias
- **Semente:** 42
- **engineVersion:** 4566b37
- **Origem dos dados:** LIVE — klines reais da Binance (origin=LIVE; ALLOW_SYNTHETIC_DATA=false)
- **Gerado em:** 2026-10-03T11:45:00.000Z

Experimento pareado por SINAL (mesma chave, prefixada pelo símbolo): mesmo período,
semente e engineVersion; muda só `ENTRY_CONFIRMATION_ENABLED`. Sinal ausente ou não
preenchido em um braço conta 0 R. O bootstrap reamostra PARES (CA-2.1/CA-2.2).

## Por símbolo

| Símbolo | Pares | Preenchidos A/B | Exp. A (R) | Exp. B (R) | Δ R | IC95% Δ | DD A | DD B |
|---|---|---|---|---|---|---|---|---|
| BTCUSDT | 597 | 427/297 | -0.8212 | -0.4309 | 0.3903 | [0.2860, 0.4979] | 37.17% | 18.89% |
| ETHUSDT | 279 | 200/149 | -0.6672 | -0.3374 | 0.3298 | [0.1835, 0.4835] | 21.50% | 10.44% |
| SOLUSDT | 861 | 602/433 | -0.4322 | -0.1532 | 0.2790 | [0.2085, 0.3497] | 53.00% | 20.09% |
| AAVEUSDT | 1303 | 793/549 | -0.1997 | -0.0287 | 0.1710 | [0.1148, 0.2292] | 58.48% | 12.78% |
| PEPEUSDT | 281 | 126/96 | -0.2154 | -0.1072 | 0.1082 | [0.0110, 0.2136] | 45.22% | 27.30% |

## Braço A — controle (sem confirmação), agregado

| Controle | |
|---|---|
| Sinais no conjunto pareado | 3321 |
| Posições preenchidas | 2148 |
| Posições fechadas | 2143 |
| Win rate (por posição) | 30.52% |
| Expectativa líquida (R/sinal pareado) | -0.4123 |
| Drawdown máximo | 58.48% |
| Custo médio (taxas+slippage+funding) | 0.5610 R |
| Não preenchidos (próprios) | 0.0% |

## Braço B — com confirmação (PENDING_ENTRY), agregado

| Com confirmação | |
|---|---|
| Sinais no conjunto pareado | 3321 |
| Posições preenchidas | 1524 |
| Posições fechadas | 1519 |
| Win rate (por posição) | 39.10% |
| Expectativa líquida (R/sinal pareado) | -0.1659 |
| Drawdown máximo | 27.30% |
| Custo médio (taxas+slippage+funding) | 0.5663 R |
| Não preenchidos (próprios) | 45.0% |

## Diferença PAREADA de expectativa por sinal (B − A), agregado

- Pares: **3321**
- Média: **0.2464 R**
- IC 95% bootstrap pareado: [0.2073, 0.2853]

## Regra de decisão pré-registrada v2 (8.2.2)

- (a) preenchidos por braço 2148/1524 ≥ 30 e agregado 3672 ≥ 60 — OK.
- (b) IC 95% pareado da diferença = [0.2073, 0.2853] R, limite inferior 0.2073 > 0 — OK.
- (c) drawdown 27.30% ≤ 70.18% (controle 58.48% + 20%) — OK.
- (d) expectativa absoluta = -0.1659 R < 0 e sem aceite do dono — barra.
- Veredito: MANTER a flag DESLIGADA (motivo registrado).

**Veredito: MANTER a flag DESLIGADA**

> Limitação declarada: R4 usa vela de 5m AGREGADA de 1m (o live usa a 5m real da exchange); R por sinal emitido (não preenchido = 0).
