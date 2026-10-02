# Evidências da Fase 7

Artefatos versionados que provam o comportamento exigido pelos marcos da Fase 7
(`specs/phase-7.md`). Cada arquivo tem **data** e é gerado por um comando reprodutível,
nunca editado à mão (o `compare:entry` é determinístico quando `--as-of` e `--seed` são fixos).

| Arquivo | Prova (CA) | Como gerar |
|---|---|---|
| `entry-confirmation-comparison-<data>.md` | 7.2.2 / CA-2.3, CA-2.4 — experimento pareado controle vs. confirmação, métricas por braço, IC bootstrap da diferença de expectativa por sinal emitido e veredito da regra 7.2.3 | `npm run compare:entry -- --as-of <ms> --seed 42` |
| `decision-entry-confirmation.md` | CA-2.5 — decisão do dono do projeto e parâmetros congelados | handoff (operador) |
| `drills-<data>.md` *(a produzir — 7.5)* | ensaios operacionais (restore, failover de feed, etc.) | `docs/evidence/drills-template.md` |
| smoke do Binance, `audit:universe`, captura de fixtures *(a produzir — 7.4)* | H-08 — evidência operacional de mercado | `npm run smoke:binance`, `npm run audit:universe`, `scripts/capture-binance-fixtures.ts` |

## Arquivos commitados

### `entry-confirmation-comparison-2026-10-02.md`

- **Símbolo/período:** BTCUSDT, 30 dias.
- **Motor:** `engineVersion` registrado no cabeçalho; rodado com `asOf` fixo e `seed 42`.
- **Braço A (controle):** 427 sinais, 550 trades, WR 35.09%, DD 37.17%.
- **Braço B (com confirmação):** 538 sinais, 406 trades, WR 40.64%, DD 18.89%.
- **Diferença de expectativa/sinal:** +0.6966 R (IC95% [0.5350, 0.8529]).
- **Veredito 7.2.3:** critérios (a) ≥ 30 preenchidos ✔, (b) diferença > 0 ✔, (c) drawdown dentro de +20% do controle ✔ → **LIGAR a flag** (registrado em `decision-entry-confirmation.md`).

> Nota de mudança: a comparação só passa a ser representativa após a correção de
> fechamento de posição no `BacktestEngine` (um runner parado após o parcial de TP1 não
> fechava a posição e inflava os trades). Ver a seção de regressão da decisão.
