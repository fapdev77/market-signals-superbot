# Evidências — Fases 7 e 8

Artefatos versionados que provam o comportamento exigido pelos marcos das Fases 7 e 8
(`specs/phase-7.md`, `specs/phase-8.md`). Cada arquivo tem **data** e é gerado por um
comando reprodutível, nunca editado à mão (`compare:entry` e `diagnose:edge` são
determinísticos quando `--as-of` e `--seed` são fixos).

| Arquivo | Prova (CA) | Como gerar |
|---|---|---|
| `entry-confirmation-comparison-<data>.md` | 8.2.1–8.2.3 / CA-2.1..CA-2.4 — experimento **pareado** por sinal, métricas por posição, decomposição de R e IC bootstrap da diferença | `npm run compare:entry -- --universe --register` |
| `entry-confirmation-verdict.json` | 8.2.5 / CA-2.5 — veredito registrado; o CI (`tests/flagMatchesDecision.test.ts`) falha se `.env.example` divergir | gerado pelo comando acima |
| `decision-entry-confirmation.md` | 8.2.4 / CA-2.4 — documento de decisão gerado (sem digitação manual); marcado `PROVISÓRIA` até o desenho exigido ser cumprido | gerado pelo comando acima |
| `edge-diagnosis-<data>.md` *(a produzir — 8.1)* | 8.1.1–8.1.4 / CA-1.x — diagnóstico do edge por símbolo/faixa/regime e veredito pré-registrado | `npm run diagnose:edge` |
| `drills-<data>.md` *(a produzir — 8.4)* | ensaios operacionais D-1..D-9 | operador |
| smoke do Binance, `audit:universe`, captura de fixtures *(a produzir — 8.3)* | J-06 — evidência operacional de mercado | `npm run smoke:binance`, `npm run audit:universe`, `scripts/capture-binance-fixtures.ts` |

## Arquivos commitados

### `entry-confirmation-comparison-2026-10-02.md` (histórico — Fase 7, defeituoso)

- **Símbolo/período:** BTCUSDT, 30 dias.
- **Braço A (controle):** 427 sinais, 550 trades, WR 35.09%, DD 37.17%.
- **Braço B (com confirmação):** 538 sinais, 406 trades, WR 40.64%, DD 18.89%.
- **Veredito 7.2.3:** "LIGAR a flag". Mantido só como registro: o experimento **não era
  pareado** e as contagens misturavam pernas e posições (`fechados > preenchidos`).

### `entry-confirmation-comparison-2026-10-03.md` (8.2 — pareado, dados reais)

- **Universo:** BTCUSDT, ETHUSDT, SOLUSDT, AAVEUSDT, PEPEUSDT · 30 dias · seed 42.
- **Dados:** klines **reais** da Binance (`origin=LIVE`, `ALLOW_SYNTHETIC_DATA=false`).
- **Braço A (controle), agregado:** 2148 preenchidos / 2143 fechados, WR 30.52%, DD 58.48%, expectativa **−0.4123 R**.
- **Braço B (com confirmação), agregado:** 1524 preenchidos / 1519 fechados, WR 39.10%, DD 27.30%, expectativa **−0.1659 R**.
- **Diferença PAREADA/sinal:** **+0.2464 R** (IC95% [0.2073, 0.2853], 3321 pares).
- **Veredito 8.2.2 (v2):** (a) ✔ amostra, (b) ✔ IC>0, (c) ✔ drawdown, (d) ✖ expectativa
  absoluta do braço com confirmação < 0 e sem aceite do dono → **MANTER DESLIGADA**.
- **Status do veredito:** **DEFINITIVO** (`provisional: false`) — o desenho exigido pela
  8.2.3 (universo de símbolos reais + regra v2) foi cumprido; um veredito definitivo pode
  ser "manter desligada". A tag `engine-freeze-*` (8.2.5) só é criada quando a regra v2
  **passar**, portanto não é criada aqui.
