# Fase 6.7.1 — Confirmação de entrada e ciclo `PENDING_ENTRY` (proposta para aprovação)

> **Status:** PROPOSTA — aguardando aprovação do dono do projeto.
> **Regra do spec:** *"Não implementar regra alguma sem essa aprovação."* Nada em 6.7.2+ começa antes do item **"Aprovação"** ao final ficar marcado.
> **Base:** commit atual, `server/signalEngine.ts` (motor de validação 1m/5m já existente, linhas ~623-700).

---

## 1. Problema (o que existe hoje)

- O motor **já calcula** `validationStatus` (`PENDING_VALIDATION` | `CONFIRMED` | `REJECTED_SPIKE`), `candle1mConfirmed`, `candle5mConfirmed` e `validationDetails` a partir dos candles de 1m — mas o sinal **nasce com `status: 'ACTIVE'`** e o `entryZone` nunca é usado para condicionar o preenchimento.
- O ledger registra `ENTRY` **no instante da emissão**, no preço atual, mesmo que o preço nunca tenha tocado a zona de entrada.
- Consequência: sinais que nunca seriam preenchidos entram no cálculo de R e de win rate como se tivessem sido — o mesmo viés que a 6.2 ataca pelo lado dos expirados.

## 2. Objetivo da 6.7

1. Contrato puro `confirmEntry(direction, klines1m, klines5m) → { confirmed, reasons }` (6.7.2).
2. Ciclo de vida: sinal nasce `PENDING_ENTRY`, vira `ACTIVE` só quando a zona é tocada **e** `confirmEntry` confirma; expira sem preenchimento (6.7.3).
3. Teto de stop `MAX_STOP_PCT` por estratégia (6.7.4).
4. Auto-tune com treino/validação/holdout intocado (6.7.5).

## 3. Regras de confirmação propostas (a aprovar)

Cada regra é binária e produz um motivo em `reasons` quando falha. **Todas as regras marcadas como "obrigatória" precisam passar para `confirmed = true`.**

| # | Regra | Timeframe | Condição (LONG) | Condição (SHORT) | Obrigatória? |
|---|-------|-----------|-----------------|------------------|--------------|
| R1 | Anti-spike (pavio) | 1m (último fechado) | `upperWick / range <= 0.55` | `lowerWick / range <= 0.55` | Sim |
| R2 | Direção do corpo | 1m (último fechado) | `close >= open` | `close <= open` | Sim |
| R3 | Fluxo taker | 1m (agregado) | `takerBuyRatio >= 0.49` | `takerBuyRatio <= 0.51` | Sim |
| R4 | Continuidade de tendência | 5m (último fechado) | `close5m > open5m` | `close5m < open5m` | Sim |
| R5 | Confluência mínima | — | `confluenceScore >= 60` | idem | Sim |
| R6 | Toque da zona de entrada | 1m | `high >= entryMin && low <= entryMax` (interseção com `[entryMin, entryMax]`) | idem | Sim (definido no ciclo, não em `confirmEntry`) |

**Nota sobre o "5m":** hoje o motor deriva a tendência de 5m dos **últimos 5 candles de 1m** (`klines.slice(-5)`). A proposta do 6.7.2 é receber `klines5m` **reais** (candles de 5m da exchange). Isso muda o resultado para setups na borda e é o ponto mais sensível deste documento — ver Decisão D2.

**Thresholds parametrizáveis** (env, com os valores acima como padrão): `ENTRY_MAX_WICK_RATIO=0.55`, `ENTRY_TAKER_BUY_LONG=0.49`, `ENTRY_TAKER_BUY_SHORT=0.51`, `ENTRY_MIN_CONFLUENCE=60`.

## 4. Ciclo de vida proposto

```
                    toque na zona + confirmEntry.confirmed
  PENDING_ENTRY  ───────────────────────────────────────────►  ACTIVE
        │                                                        │
        │ sem toque em N candles                                 │
        ▼                                                        ▼
  ENTRY_NOT_FILLED (terminal)                              (fluxo atual: PARTIAL/TARGET/STOP/EXPIRED)
        │
        │ movimento adverso além da invalidação antes do toque
        ▼
  ENTRY_INVALIDATED (terminal, EXPIRED/ENTRY_INVALIDATED)
```

| Evento | Transição | Ledger | Conta no R? |
|--------|-----------|--------|-------------|
| Emissão | — | **nenhum evento `ENTRY`** | Não |
| Preenchimento | `PENDING_ENTRY → ACTIVE` | `ENTRY` no **preço do preenchimento** | Sim |
| Sem preenchimento | `PENDING_ENTRY → ENTRY_NOT_FILLED` | evento com `reason=ENTRY_NOT_FILLED` (6.2) | Não (R do 6.2: expirado fecha a mercado — **ver D4**) |
| Invalidação | `PENDING_ENTRY → ENTRY_INVALIDATED` | evento com `reason=ENTRY_INVALIDATED` | Não |

**Preço de preenchimento (D3):** proposto o **midpoint do toque** — se o candle de 1m tocar a zona, o preço de entrada é `clamp(close_1m, entryMin, entryMax)` (o preço do candle dentro da zona), e não o topo do pavio. Alternativa: preencher em `entryMin` (limite favorável).

**N candles (D5 proposto):** `ENTRY_MAX_WAIT_CANDLES = 3` (1m) por padrão, parametrizável por estratégia.

## 5. Teto do stop (6.7.4)

Hoje o stop é o mais distante entre swing, suporte/resistência e ATR. Proposta:
- `MAX_STOP_PCT` por estratégia (`SCALP` mais apertado que `SWING`).
- Acima do teto → sinal suprimido com motivo `STOP_TOO_WIDE` (métrica + log).
- Valores iniciais **a definir a partir dos dados** (p25/p75 do stop atual por estratégia) antes de fixar — este documento não crava número.

## 6. Critérios de aceitação (do spec, mantidos)

- **CA-7.1** `confirmEntry` tem teste de tabela para cada regra aprovada aqui.
- **CA-7.2** Preço que nunca toca a zona expira como `ENTRY_NOT_FILLED` e **não** entra no R; **não** há evento `ENTRY`.
- **CA-7.3** Stop acima de `MAX_STOP_PCT` suprime o sinal com motivo registrado.
- **CA-7.4** Um espião garante que o holdout nunca é passado ao avaliador de candidatos.
- **CA-7.5** Pesos positivos só no treino terminam com `isRobust: false`; mesma semente e dados ⇒ resultado idêntico.

## 7. Riscos

| Risco | Mitigação |
|-------|-----------|
| `PENDING_ENTRY` muda o perfil dos resultados (menos sinais, R diferente) | Nova `engineVersion`; evidência (6.9) só começa depois do congelamento |
| 5m real vs 5×1m muda sinais na borda | Medir o delta em backtest antes de ativar em produção; feature flag |
| Sinais "presos" em PENDING_ENTRY confundem a UI | Expor aba/filtro próprio e TTL visível (6.8) |
| Mais um estado quebra consumidores do ledger | Migração + reconciliação (6.2.4) cobrem `ENTRY_NOT_FILLED` |

## 8. Aprovação — checklist do dono

Marque cada item para liberar a implementação do 6.7.2+.

- [ ] **D1 — R1..R5 obrigatórias** como na tabela (ou indicar quais são opcionais).
- [ ] **D2 — 5m:** usar **candles de 5m reais** em vez de 5×1m? (Sim / Não / Só se o delta em backtest for pequeno)
- [ ] **D3 — Preenchimento:** `clamp(close_1m, entryMin, entryMax)` (midpoint) ou `entryMin` (favorável)?
- [ ] **D4 — `ENTRY_NOT_FILLED` conta no denominador do 6.9?** (proposto: **não**, é um não-evento; o 6.2 já resolve o viés dos que *foram* emitidos como ativos)
- [ ] **D5 — `ENTRY_MAX_WAIT_CANDLES`:** 3 (1m) por padrão?
- [ ] **D6 — Thresholds** (`0.55`, `0.49/0.51`, `60`) confirmados?
- [ ] **D7 — `MAX_STOP_PCT`:** autoriza definir por dados antes de fixar?
- [ ] **D8 — Ativação:** atrás de feature flag até o backtest comparativo?
