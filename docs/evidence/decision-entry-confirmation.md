# Decisão — Confirmação de entrada (`ENTRY_CONFIRMATION_ENABLED`)

- **Data:** 2026-10-02
- **Marco:** 7.2 (H-06) — decisão e congelamento do motor
- **Regra pré-registrada:** 7.2.3 (parâmetros aprovados pelo dono do projeto em 2026-10-01)
- **Evidência:** `docs/evidence/entry-confirmation-comparison-2026-10-02.md`

## Regra aplicada (7.2.3, valores aprovados)

Liga a flag somente se, no braço **com confirmação**:

1. houver **≥ 30 trades preenchidos**;
2. a **diferença média de expectativa por sinal emitido** (B − A) for **positiva**;
3. o **drawdown máximo** não ficar **mais de 20% pior** que o do controle (limite
   `MIN_FILLED_TRADES_DEFAULT = 30`, `MAX_DRAWDOWN_WORSE_PCT_DEFAULT = 20` em
   `server/services/entryDecisionRule.ts`).

## Resultado do experimento

| Critério | Medido | Veredito |
|---|---|---|
| (a) trades preenchidos | 406 | ✔ (≥ 30) |
| (b) diferença de expectativa/sinal | +0.6966 R (IC95% [0.5350, 0.8529]) | ✔ (> 0) |
| (c) drawdown vs. controle | 18.89% vs. 37.17% (limite 44.60%) | ✔ (dentro de +20%) |

**Decisão recomendada pela regra: LIGAR `ENTRY_CONFIRMATION_ENABLED`.**

## Decisão do dono do projeto

- [x] **Confirmo LIGAR a flag** — `ENTRY_CONFIRMATION_ENABLED=true` como novo padrão em `.env.example` e na documentação.
- [ ] Manter desligada (registrar motivo abaixo).

Motivo (se manter desligada): _não se aplica_

Assinatura / data: **Dono do projeto — 2026-10-02** (decisão registrada na sessão de implementação da Fase 7)

> Nenhum trabalho do marco 7.7 (burn-in / coleta de evidência) começa antes de a decisão
> acima estar preenchida **e** o commit estar marcado com a tag `engine-freeze-<sha>`
> (CA-2.5).

## Congelamento (7.2.4)

A tag `engine-freeze-<sha>` deve apontar para o commit que inclui:

- o `BacktestEngine` com o ciclo `PENDING_ENTRY` (7.2.1);
- a **correção de fechamento de posição**: `resolveBacktestPosition` agora expõe
  `hasClosedFull` (derivado de `resolvePosition`), e o engine fecha a posição por esse
  sinal em vez de `closedSize >= 0.999`. Sem isso, um runner parado após o parcial de
  TP1 (leg de 0.5) nunca fechava e era re-resolvido a cada candle — divergência do live
  (`TickProcessor` sempre usou `hasClosedFull`) que inflava trades e o win rate.

Comando de congelamento (rodar após o commit da correção):

```bash
git tag -a engine-freeze-$(git rev-parse --short HEAD) -m "Congelamento do motor — decisão 7.2 registrada"
```

## Rollback

Desligar a flag (`ENTRY_CONFIRMATION_ENABLED=false`) restaura o comportamento do
backtest/live anterior. A correção de fechamento (`hasClosedFull`) **não** é revertida:
ela é paridade com o live e independe da flag.
