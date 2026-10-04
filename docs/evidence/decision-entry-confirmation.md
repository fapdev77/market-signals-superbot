# Decisão — confirmação de entrada (ciclo PENDING_ENTRY)

> **Status:** FINAL — gerada automaticamente por `npm run compare:entry -- --register`.
> Números derivados do relatório pareado; NÃO editar à mão (regra 8.2.4).

- **engineVersion:** 692ddb6
- **Símbolo:** BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT · **Período:** 30 dias · **Semente:** 42
- **Origem dos dados:** LIVE — klines reais da Binance (origin=LIVE; ALLOW_SYNTHETIC_DATA=false)
- **Amostra:** universo de 5 símbolos reais (BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT) — 8.2.3
- **Gerado em:** 2026-10-04T10:00:00.000Z
- **Regra:** 8.2.2 (v2, pareada)

## Números do relatório

| Métrica | Controle | Com confirmação |
|---|---|---|
| Posições preenchidas | 625 | 0 |
| Posições fechadas | 623 | 0 |
| Win rate (posição) | 17.98% | 0.00% |
| Expectativa líquida (R/sinal pareado) | -0.1111 | 0.0000 |
| Drawdown máximo | 26.44% | 0.00% |

- **Diferença pareada (B − A):** 0.1111 R — IC 95% [0.0832, 0.1375]

## Veredito

- (a) amostra insuficiente: controle 625, confirmação 0 (mínimo 30/braço e 60 no agregado) — barra.
- (b) IC 95% pareado da diferença = [0.0832, 0.1375] R, limite inferior 0.0832 > 0 — OK.
- (c) drawdown 0.00% ≤ 31.73% (limite = controle 26.44% + 20% RELATIVOS, ou seja ×1.20) — OK.
- (d) expectativa líquida absoluta do braço com confirmação = 0.0000 R ≥ 0 — OK.
- Veredito: MANTER a flag DESLIGADA (motivo registrado).

**MANTER DESLIGADA a flag `ENTRY_CONFIRMATION_ENABLED`.**

## Congelamento

A tag `engine-freeze-*` só pode ser criada depois de a regra v2 passar (8.2.5).

```bash
git tag -a engine-freeze-$(git rev-parse --short HEAD) -m "Congelamento do motor — decisão 8.2 registrada"
```
