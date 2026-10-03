# Decisão — confirmação de entrada (ciclo PENDING_ENTRY)

> **Status:** FINAL — gerada automaticamente por `npm run compare:entry -- --register`.
> Números derivados do relatório pareado; NÃO editar à mão (regra 8.2.4).

- **engineVersion:** 4566b37
- **Símbolo:** BTCUSDT, ETHUSDT, SOLUSDT, AAVEUSDT, PEPEUSDT · **Período:** 30 dias · **Semente:** 42
- **Origem dos dados:** LIVE — klines reais da Binance (origin=LIVE; ALLOW_SYNTHETIC_DATA=false)
- **Amostra:** universo de 5 símbolos reais (BTCUSDT, ETHUSDT, SOLUSDT, AAVEUSDT, PEPEUSDT) — 8.2.3
- **Gerado em:** 2026-10-03T11:45:00.000Z
- **Regra:** 8.2.2 (v2, pareada)

## Números do relatório

| Métrica | Controle | Com confirmação |
|---|---|---|
| Posições preenchidas | 2148 | 1524 |
| Posições fechadas | 2143 | 1519 |
| Win rate (posição) | 30.52% | 39.10% |
| Expectativa líquida (R/sinal pareado) | -0.4123 | -0.1659 |
| Drawdown máximo | 58.48% | 27.30% |

- **Diferença pareada (B − A):** 0.2464 R — IC 95% [0.2073, 0.2853]

## Veredito

- (a) preenchidos por braço 2148/1524 ≥ 30 e agregado 3672 ≥ 60 — OK.
- (b) IC 95% pareado da diferença = [0.2073, 0.2853] R, limite inferior 0.2073 > 0 — OK.
- (c) drawdown 27.30% ≤ 70.18% (controle 58.48% + 20%) — OK.
- (d) expectativa absoluta = -0.1659 R < 0 e sem aceite do dono — barra.
- Veredito: MANTER a flag DESLIGADA (motivo registrado).

**MANTER DESLIGADA a flag `ENTRY_CONFIRMATION_ENABLED`.**

## Congelamento

A tag `engine-freeze-*` só pode ser criada depois de a regra v2 passar (8.2.5).

```bash
git tag -a engine-freeze-$(git rev-parse --short HEAD) -m "Congelamento do motor — decisão 8.2 registrada"
```
