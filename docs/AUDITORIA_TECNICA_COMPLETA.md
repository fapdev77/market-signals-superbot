# AUDITORIA TÉCNICA COMPLETA — Market Signals SuperBot

**Commit auditado:** `47b559b` — *feat: implement historical CVD analysis and OBI heatmap* (2026-10-06)
**Data da auditoria:** 2026-10-06
**Escopo:** backend (Node/Express + sql.js), motor de sinais, indicadores, backtest, paper trading, frontend (React 19 / Vite), suíte de testes.
**Método:** inspeção estática linha a linha + execução real da suíte + verificação de cada afirmação contra o código no commit acima. **Nenhum achado deste relatório é herdado de auditoria anterior: todos foram reconferidos no código atual.** Onde um problema antigo já foi corrigido, isso está registrado explicitamente na seção 2.

---

## 0. LINHA DE BASE VERIFICADA (executada nesta auditoria)

| Checagem | Comando | Resultado |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ **EXIT 0** — zero erros, `strict: true` |
| Testes | `npm test` | ✅ **165 arquivos / 963 testes, 100% passando** (397 s) |
| Build | `npm run build` | ✅ `vite build` + `esbuild dist/server.cjs` — EXIT 0 |
| Dependências | `npm run audit:prod` | ❌ **EXIT 1 — 2 vulnerabilidades em dependências de PRODUÇÃO (1 crítica, 1 alta)** — ver A-09 |
| Baseline de qualidade | `npx tsx scripts/quality-baseline.ts --report` | ⚠️ **160 `any` explícitos, 8 `catch` vazios** |
| Dados sintéticos em runtime | `.env` | ✅ `ALLOW_SYNTHETIC_DATA="false"` |

### A conclusão central desta auditoria

> **O projeto não tem erro de compilação, teste vermelho nem build quebrado.** A dívida real está em dois lugares que a suíte **não cobre**: (a) a *correção conceitual* de indicadores e thresholds, e (b) a *integridade dos números que chegam à tela do operador*. A suíte é verde enquanto **9 achados críticos de fabricação de dado continuam ativos** — e todos eles vivem em código sem teste.
>
> Portanto, repetindo com precisão o que o briefing pede: **"963 testes passando" NÃO é evidência de que o robô produz sinais válidos.** É evidência de que o que está testado está correto. Este relatório mapeia exatamente o que não está.

### 0.1 Correções desde a auditoria anterior (o que já mudou no código)

Registro honesto — estes problemas existiam e **foram corrigidos**; não devem ser reabertos:

| Item | Situação atual | Evidência |
|---|---|---|
| Value Area descontígua | ✅ **Corrigido** — expansão iterativa a partir do POC | `server/utils/volumeProfileCore.ts:147-172` |
| RSI fabricado **no motor do servidor** | ✅ **Corrigido no caminho do motor** — Wilder(14) real sobre `klines` + pivôs por fractal | `src/utils/wilderRsi.ts`, `src/utils/rsiDivergenceUtils.ts:104-236`, `server/signalEngine.ts:360` |
| Métricas "inventadas" quando não medidas (9.9 / 5.0 / 4.5) | ✅ **Corrigido** — contrato é `null` + `assumptions[]` | `server/services/backtestMetrics.ts`, `src/utils/backtestMetrics.ts`, `tests/unmeasuredMetricConstants.test.ts` |
| Backtest calculando indicadores em 1m enquanto o live usa 15m | ✅ **Corrigido** — agregação 1m→15m sem lookahead | `server/services/BacktestEngine.ts:690-712`, `tests/timeframeParity.test.ts` |

**O que a auditoria anterior apontou e continua ativo:** RSI fabricado **no monitor de divergências do frontend** (C-01), win-rate/outcomes do Golden Pocket (C-02), OI aleatório (C-03), `TickerData` sintético do Screener (C-04) e ping de rede fictício (C-05).

**O que esta auditoria eleva a crítico** (não estava classificado assim antes): o fallback inventado do Radar de Trapped Traders (C-06), a ausência de proveniência no contrato do livro de ofertas — que permite book sintético indistinguível (C-07) — o VaR paramétrico com volatilidade assumida (C-08, antes classificado como alto) e o portfólio de demonstração exibido como posições reais (C-09). Também é novo o achado **A-09**: `npm run audit:prod` **falha** com 2 CVEs em dependências de produção.

---

## 1. VEREDITO EXECUTIVO

| Dimensão | Nota | Comentário |
|---|---|---|
| Segurança / fail-closed / autenticação | **8/10** | `DataGate`, `ClockService`, kill-switch, auth constant-time, CSP report-only, CORS allowlist, rate limits por rota, `outboundPolicy` — **mas o gate de dependências de produção está vermelho (A-09)** |
| Contabilidade (R, taxas, slippage, funding, ledger) | **8.5/10** | Decimal exato, identidade de R testada, ledger transacional fail-closed, reconciliação |
| Paridade live ↔ backtest | **7/10** | Mesmo código decide; mas `filters`/`weights`/`ttl` divergem entre os dois lados (A-05) |
| Infra de evidência e calibração | **7/10** | `EvidenceService` (MFE/MAE em R, Wilson) e `scoreCalibration` corretos — **porém não gateiam decisão** (A-08) |
| Correção dos indicadores | **4/10** | Wilder RSI correto no motor; Fibonacci, FVG e o timeframe declarado seguem aproximados/rotulados errado (A-02, A-03, A-04) |
| **Integridade do dado exibido ao operador** | **2/10** | **9 pontos de fabricação ativos** — é o que impede o rótulo "institucional" |
| Configurabilidade dos parâmetros | **4/10** | ~45 limiares fixos no motor; um knob tipado e validado (`maxStopLossAtrMultiple`) nunca é aplicado |
| Cobertura de testes (qualidade, não quantidade) | **5/10** | 963 testes, **zero testes de componente**; nenhuma garantia "nada na tela é fabricado" |

### Os 9 achados que impedem chamar o produto de "institucional"

1. **CRÍTICO** — O **Monitor de Divergências de RSI** exibe "RSI (14)" e "RSI Médio Global" calculados por uma **fórmula sintética**, não por Wilder. O motor do servidor foi corrigido; **esta tela não foi**.
2. **CRÍTICO** — O card "Prime Opportunity" exibe **win-rate e histórico de trades inventados** (derivados do próprio score + 7 PnL fixos).
3. **CRÍTICO** — Selecionar um ativo no **Screener** injeta um `TickerData` **inteiramente sintético** na pipeline de análise, do gráfico e da IA.
4. **CRÍTICO** — A curva de **Open Interest** do gráfico é preenchida com `Math.random()`.
5. **CRÍTICO** — Os **pings/latências** exibidos no header e no widget de saúde (`ms`, `±jitter`, `99.98% uptime`) são `Math.random()` e literais.
6. **CRÍTICO** — O **Radar de Trapped Traders** cai em valores **inventados** de liquidação em USD e de Long/Short quando o dado não existe.
7. **CRÍTICO** — O **livro de ofertas** pode ser 100% sintético (gerado no servidor e no cliente) **sem nenhum campo de proveniência no contrato** — o operador não tem como distinguir.
8. **CRÍTICO** — O **VaR do dashboard de risco** usa volatilidade **assumida** (3,5%/dia) e betas de uma tabela fixa — não é o VaR da carteira.
9. **CRÍTICO** — O **dashboard de risco abre com um portfólio de demonstração fixo** (BTC/ETH/SOL/LINK/PEPE/NEAR com margem, alavancagem e PnL) apresentado como se fossem as posições do operador.

> **Veredito:** o *backbone* (gates, contabilidade, risco, ledger, segurança) está em nível institucional e deve ser preservado. A *camada de decisão e de apresentação* não está. Enquanto C-01..C-09 existirem, a resposta honesta à pergunta *"o robô está produzindo sinais válidos?"* é: **não é possível afirmar** — parte da evidência que o operador vê não foi medida, foi inventada.

---

## 2. ACHADOS CRÍTICOS (bloqueadores de uso real)

### C-01 — O Monitor de Divergências de RSI exibe RSI sintético rotulado como "RSI (14)"

**Arquivos:**
- `src/utils/rsiDivergenceUtils.ts:435-453` — `scanUniverseRSIDivergences()` chama `scanRSIDivergence(t, timeframe)` **sem o terceiro parâmetro (`klines`)**.
- `src/utils/rsiDivergenceUtils.ts:239-270` — sem `klines`, `scanRSIDivergence` cai em `estimateRSI()`, que **não recebe velas**:

```ts
let rawRsi = 50 + (changePct * 2.8 * tfMultiplier) + (devPct * 1.5);
if (cvdDir === 'BUY')  rawRsi += 3.5;
if (cvdDir === 'SELL') rawRsi -= 3.5;
if (inGP && changePct < 0) rawRsi -= 4;
if (inGP && changePct > 0) rawRsi += 4;
```

- A "divergência" no ramo de fallback é construída, não detectada: `prevSwing` é derivado de `currentRsi` por tabela (`rsiDivergenceUtils.ts:258-266`), e os testes de divergência (`:165-168`, `:183-186`) comparam o RSI atual com esse valor derivado dele mesmo.

**Onde isso aparece para o operador:**
- `src/components/RSIDivergenceMonitor.tsx:94` → texto copiado com `RSI (14): ${item.rsiCurrent}`
- `:128` → *"Detecção algorítmica de divergências regulares e ocultas no RSI (14)"*
- `:225` → cartão **"RSI Médio Global"**
- `:238` → regime de mercado (`Sobrecomprado`/`Sobrevendido`) derivado dessa média
- `:432` → campo **"RSI (14):"**

**Impacto:** a tela inteira de divergência de RSI — inclusive o "RSI médio global" que o operador usa como termômetro de mercado — é uma função da variação 24h e do desvio da MM24. É o indicador central de momentum, exibido com o rótulo de um indicador canônico que ele não é.

**Risco adicional no servidor (borda real):** `server/signalEngine.ts:360` passa `klines` — correto. Porém, se `klines.length` estiver entre **5 e 14**, `calculateWilderRSI` retorna `isValid: false` e o motor cai no `estimateRSI` sintético, e o `DataGate` **ainda permite o sinal** (só marca degradado com `< 5` velas, `signalEngine.ts:478`). O fator continua valendo `rsiDivergenceWeight` (10–30) sobre um número fabricado.

**Correção (TDD):**
1. Escrever primeiro o teste que falha: `tests/rsiDivergenceRealSeries.test.ts` — para uma série de candles de referência (valores calculados por biblioteca independente, ex.: `technicalindicators`), `scanRSIDivergence` **sem klines** deve retornar `divergenceType: 'NO_DIVERGENCE'` + `verdict: 'RSI indisponível: sem série de velas'` — nunca um número de RSI.
2. `scanUniverseRSIDivergences` deve propagar um mapa de velas (ou um `klinesProvider`) — ou **parar de exibir RSI** quando não houver série.
3. Apagar `estimateRSI` (dead code após o item 2) e remover o rótulo "RSI (14)" do fallback.

---

### C-02 — Win-rate e histórico de trades fabricados no card "Prime Opportunity"

**Arquivo:** `src/App.tsx:328-397` (consumido em `:482` via `stats={goldenPocketStats}`)

```ts
const baselineAlerts = Math.max(symbolSignals.length, 7);            // sempre ≥ 7 amostras
const baselineProfitable = symbolSignals.length >= 4
  ? profitableCount
  : Math.round(baselineAlerts * (0.70 + ((score - 60) * 0.003)));    // derivado do PRÓPRIO score
const winRate = effectiveTotal > 0 ? Math.round(...) : 74;           // literal 74%
const outcomesSeries = recentOutcomes.length >= 5 ? recentOutcomes.slice(-8) : [
  { profitable: true,  pnlPct:  2.4 }, { profitable: true,  pnlPct:  1.8 },
  { profitable: false, pnlPct: -1.1 }, { profitable: true,  pnlPct:  3.1 },
  { profitable: true,  pnlPct:  2.2 }, { profitable: false, pnlPct: -0.9 },
  { profitable: true,  pnlPct:  2.6 }
];
```

**Impacto:** quando há menos de 4 sinais reais, o "win rate" exibido **é uma função crescente do confluenceScore do próprio ativo** — circular — e o gráfico de resultados recebe 7 trades com PnL fixo. O `Math.max(..., 7)` garante que **sempre** existam 7 amostras, mesmo com zero dados. É exatamente o "dado fictício que não mostra a realidade do mercado" que o briefing proíbe.

**Correção:** com amostra insuficiente, exibir **"Amostra insuficiente (n/N)"** e gráfico vazio. O dado real já existe: `server/services/EvidenceService.ts` + `scoreCalibration.ts` (ver §9). Teste primeiro: `tests/goldenPocketStats.test.ts` — com 0 sinais, `winRate` deve ser `null` e `recentOutcomes` `[]`.

---

### C-03 — Curva de Open Interest preenchida com `Math.random()`

**Arquivo:** `src/components/ChartAndProfile.tsx:303-311`

```ts
for (let i = data.length - 1; i >= 0; i--) {
  data[i].openInterest = currentOI;
  data[i].cvd = currentCVD;
  currentOI -= (Math.abs(delta) * (Math.random() * 2 - 0.5));   // <-- aleatório
  currentCVD -= delta;
}
```

O `cvd` é reconstruído por acumulação (legítimo, dado que o delta vem das velas), mas o **openInterest é um passeio aleatório**. A Binance fornece histórico real (`/futures/data/openInterestHist`) e existe `openInterestChange24h/1h` reais no ticker — nenhum dos dois é usado para a série.

**Correção:** usar a série real de OI (endpoint + cache) ou **remover a curva** e manter apenas o ponto atual. Teste primeiro: um teste que proíbe `Math.random` em `ChartAndProfile` (ver §7, guarda de integridade).

---

### C-04 — Selecionar ativo no Screener injeta `TickerData` sintético na pipeline

**Arquivo:** `src/components/ScreenerDashboard.tsx:519-548` e `:697-726`

```ts
onSelectTicker({
  ...
  cvd: 0, cvdDelta: 0, cvdDeltaPercent: 0, cvdDirection: 'NEUTRAL', takerBuyRatio: 0.5,
  fibonacci:    { fib50: price, fib618: price*0.995, fib68: price*0.992, swingHigh: high24h, swingLow: low24h, inGoldenPocket: false },
  rangeProfile: { vah: price*1.01, val: price*0.99, poc: price, inValueArea: true },   // inValueArea FIXO
  keyLevels:    { support1: price*0.98, support2: price*0.96, resistance1: price*1.02, resistance2: price*1.04, structureBreak: 'NONE', hasSinglePrintFVG: false },
  confluenceFactors: ['Screener Radar'],
});
```

Esse objeto vira o `selectedTicker` global e alimenta `ChartAndProfile`, `aiPatternScanner` (`+6` de confiança quando `inValueArea`, `src/utils/aiPatternScanner.ts:76`) e o motor de IA — **a auditoria por IA passa a raciocinar sobre um livro/volume profile/Fibonacci inventados**.

**Contradição interna reveladora:** ~35 linhas acima, o próprio arquivo contém `// 6.4.4: null = "n/d" (nunca 0, que fingiria dado real)`. O princípio é conhecido pelo time e aplicado ao OI — e violado nos campos de indicador logo abaixo.

**Correção:** ao selecionar, buscar o ticker **real** já processado pelo servidor (o `tickerStateCache` já o tem) pelo símbolo; se ausente, marcar os campos derivados como `null`/"n/d" e bloquear a auditoria por IA com motivo explícito.

---

### C-05 — Telemetria de rede fictícia exibida como saúde do sistema

**Arquivos:**
- `src/components/Header.tsx:77-80`
  ```ts
  // Simulate slight natural ping variation 12-24ms
  const interval = setInterval(() => setNetworkPing(12 + Math.floor(Math.random() * 14)), 4000);
  ```
  Exibido como *"Conexão de baixa latência ativa… Ping estimado: NNms"*, badge `NNms` e `NNms FEED`.
- `src/components/SystemHealthWidget.tsx:80-87` — `binancePing`, `orderFlowPing`, `aiPing`, `dbPing` aleatórios a cada 3 s, renderizados como `latencyMs` (`:317`), **`±{jitterMs}`** (`:325`) e média `{avgLatency}ms` (`:231`).
- `src/components/SystemHealthWidget.tsx:239` → **`99.98%`** de uptime é literal; `:247` → **`~142`** é literal.
- `~142` e `99.98%` não têm fonte alguma no backend.

**Impacto:** o operador usa exatamente essa leitura para decidir *se pode confiar no feed agora*. O servidor **tem** a verdade (`GET /api/system/feed-health`, `server/services/feedHealth.ts`, com sucesso/falha por fonte e `wsStatus.lastTickAt`) — o widget já o consome, mas continua renderizando os números aleatórios acima dele.

**Correção:** apagar o efeito de jitter; renderizar latência/uptime reais ou `"—"`. Teste primeiro: proibir `Math.random` nesses dois arquivos (guarda de integridade, §7).

---

### C-06 — Radar de Trapped Traders exibe liquidações e posicionamento inventados

**Arquivo:** `src/components/TrappedTradersRadar.tsx:61-95`

```ts
const trapped = currentTicker.trappedTraders || { /* ... */ trappedVolumeUSD: 15000000, absorptionRatio: 30,
  liquidationsSummary: { totalBuyLiqUSD: 120000, totalSellLiqUSD: 150000, netLiqUSD: -30000, recentEvents: [] } };
const ls = currentTicker.longShortData || { longAccountPct: 53.5, shortAccountPct: 46.5, takerBuyVolUsd: 12000000, ... };
```

**Nota importante (para não confundir a origem):** no **servidor** a liquidação é honesta — `server/binanceWebsocket.ts:79-110` agrega eventos reais dos últimos 30 min e só simula quando `ALLOW_SYNTHETIC_DATA === 'true'`. **O defeito é o fallback do componente**: quando `trappedTraders`/`longShortData` não existem, ele inventa cifras em USD e percentuais de posicionamento e os apresenta como leitura de fluxo institucional.

**Correção:** renderizar `"—"`/"dado indisponível" no fallback. Teste primeiro: sem `trappedTraders`, o componente não deve conter nenhum número de liquidação.

---

### C-07 — Livro de ofertas pode ser 100% sintético sem qualquer marca de proveniência

**Servidor:** `server/binanceService.ts:1769-1820` (`generateSimulatedDepth`) — quando o book real falha, gera níveis com `Math.random()` e **injeta "paredes institucionais" deliberadas** em `i === 7` e `i === 18`:

```ts
let bidQty = (baseUnitQty * (1 + i * 0.35)) * (0.7 + Math.random() * 0.6) * (1 + biasFactor);
...
if (i === 7 || i === 18) { /* Bid Wall / Ask Wall */ bidQty *= 3.4; }
```

**Cliente:** `src/components/LiquidityDepth.tsx:118-190` — mantém um segundo gerador sintético, também com `Math.random()` e paredes fixas em `i === 8/19` (bids) e `i === 7/21` (asks); é acionado em `:244` **em silêncio**, sob o comentário `// Fallback`.

**Contrato:** `src/types.ts:165-184` — `OrderBookDepthData` **não possui** campo de origem/sintético. Logo, a UI **não tem como** distinguir um book real de um inventado, mesmo que quisesse avisar.

**Impacto direto no risco:** o book alimenta `estimateDepthSlippagePct` (`server/services/depthSlippage.ts`) na emissão do sinal; um book sintético produz um veredito de executabilidade (`executable`) que descreve liquidez que não existe.

**Correção:** adicionar `source: 'EXCHANGE' | 'SIMULATED'` ao contrato, propagar do servidor e **renderizar banner de aviso** no cliente; nunca gerar book no cliente (o servidor já é a fonte). Teste primeiro: `tests/orderBookProvenance.test.ts` — `fetchOrderBookDepth` em falha deve devolver `source: 'SIMULATED'`.

---

### C-08 — VaR do dashboard usa volatilidade assumida, não a realizada

**Arquivo:** `src/utils/riskCalculations.ts:283-288`

```ts
const assumedDailyBtcVol = 0.035;
const portfolioDailyVol = assumedDailyBtcVol * Math.max(0.2, portfolioBeta);
const var95DailyUsd = absDelta * portfolioDailyVol * 1.645;
const var99DailyUsd = absDelta * portfolioDailyVol * 2.326;
```

Os betas vêm de `ASSET_SECTOR_MAP` (`riskCalculations.ts:15+`), uma **tabela fixa por símbolo** (BTC 1.0, ETH 1.15, SOL 1.4…), e não de regressão sobre preços. Além disso, `:540` usa outro literal (`stopOffsetPct: 0.035`).

**Impacto:** o número rotulado como VaR 95/99 da carteira é uma aproximação paramétrica com **volatilidade escolhida a dedo**. Ele *parece* institucional e não reconcilia com o servidor — cujo `RiskManager.ts` faz o cálculo correto de risco aberto real.

**Correção:** calcular volatilidade realizada (desvio padrão dos retornos das últimas N velas de cada ativo, ponderada pelos pesos da carteira) e/ou **consumir o risco do servidor** como fonte única. Enquanto isso, rotular o painel como "estimativa paramétrica (vol. assumida)" — nunca "VaR da carteira".

---

### C-09 — O dashboard de risco abre com um portfólio de demonstração fixo, apresentado como posições reais do operador

**Arquivo:** `src/utils/riskCalculations.ts:468-560`, consumido por `src/components/RiskExposureDashboard.tsx:99` e `:345`

`getInitialSeedPositions()` devolve 6 posições **hardcoded** (BTC LONG 1000 USDT ×10, ETH LONG 500 ×10, SOL LONG 400 ×8, LINK SHORT 300 ×5, PEPE LONG 200 ×5, NEAR SHORT 250 ×6) com stop/T1 por offsets fixos:

```ts
export function getInitialSeedPositions(tickers: TickerData[]): PortfolioPosition[] {
  const seedConfigs = [
    { symbol: 'BTCUSDT', direction: 'LONG', entryRatio: 0.988, margin: 1000, leverage: 10, stopOffsetPct: 0.02, tp1OffsetPct: 0.04, notes: 'Hedge core spot…' },
    { symbol: 'ETHUSDT', direction: 'LONG', entryRatio: 0.992, margin: 500,  leverage: 10, stopOffsetPct: 0.025, tp1OffsetPct: 0.05, notes: '…' },
    // SOL, LINK, PEPE, NEAR…
  ];
  return seedConfigs.map(...);   // preço real do ticker × entryRatio → PnL realista sobre entrada INVENTADA
}
```

E é chamado exatamente quando **não existe portfólio do usuário**:

```tsx
// RiskExposureDashboard.tsx:93-100 — estado inicial
if (Array.isArray(parsed) && parsed.length > 0) return parsed;
...
return getInitialSeedPositions(tickers);   // localStorage vazio → mostra as 6 posições de demonstração

// :345 — botão "reset"
const handleResetToSeed = () => { persistPositions(getInitialSeedPositions(tickers)); ... };
```

**Impacto:** na primeira abertura (ou ao clicar em reset), o painel de **exposição de risco, VaR, alavancagem e PnL** mostra um portfólio que o operador **não tem**. Como o preço de entrada é derivado do preço real de mercado (`curPrice * entryRatio`), o PnL, o stop e o alvo **parecem dados de mercado verdadeiros** — o valor "inventado" é só a posição em si. É o mesmo defeito de C-08 (escopo diferente): um número que parece medida e não é.

**Correção (TDD):**
1. Renomear para `buildDemoSeedPositions()` e **consumi-la apenas em modo demonstração** (`ALLOW_SYNTHETIC_DATA === 'true'` ou flag `DEMO_MODE`), nunca no caminho padrão.
2. Caminho padrão: portfólio **vazio** com estado vazio explícito ("Sem posições abertas") — e o operador adiciona posições manualmente via `buildPositionFromSignal`.
3. Teste de caracterização: com `localStorage` vazio e demo **desligada**, `positions` deve ser `[]`; o badge/origem do painel deve dizer `VAZIO` (não `LIVE`).
4. Marcar cada `PortfolioPosition` com procedência (`origin: 'USER' | 'SIGNAL' | 'DEMO'`) e exibir a tag no card — assim nenhuma posição de demonstração volta a se disfarçar de real.

---

## 3. ACHADOS DE ALTA GRAVIDADE

### A-01 — `confluenceScore` satura, usa `abs()` e contém 2 gates mortos

**Arquivo:** `server/signalEngine.ts:379`

```ts
const confluenceScore = Math.min(100, Math.round(Math.abs(netScore) * 1.2 + 25));
```

1. **Satura:** `netScore ≥ 62,5` → score 100. Todo o propósito de um motor de sinais é **ranquear**; acima desse ponto todos os sinais são indistinguíveis. Com `Math.round`, faixas inteiras colapsam no mesmo inteiro.
2. **`abs()`:** um LONG fraco e um SHORT fraco recebem o mesmo score — a magnitude não codifica direção.
3. **`1.2` e `25` são mágicos:** sem derivação, sem teste, sem configuração.
4. **Gates mortos:** o sinal só existe com `|netScore| ≥ 35` (`:384`, `:391`) ⇒ score ≥ `round(35·1.2+25) = 67`. Portanto:
   - `buildTradeSignal`: `ticker.confluenceScore < 50` (`:535`) **nunca é verdadeiro** — não protege nada;
   - validação MTF: `ticker.confluenceScore >= 60` (`:814`) **é sempre verdadeiro** — não valida nada.
5. A UI exibe o score como `%` (ex.: `avgConfluence` em `src/components/SignalsMatrix.tsx:735`), e o operador lê como probabilidade — a própria equipe documenta o contrário em `server/services/scoreCalibration.ts:1-22`.

**Correção:** separar **direção** de **magnitude**; remover saturação (cap no denominador, não no numerador); extrair `1.2 / 25` para um `ScoringModel` versionado e calibrável; remover os dois gates mortos; trocar o rótulo "%" por "pontuação".

---

### A-02 — FVG entra com peso fixo `10` e sem verificação de obsolescência

**Arquivos:** `server/signalEngine.ts:280,283` (literais `bullishPoints += 10` / `bearishPoints += 10`) e `server/binanceService.ts:1621-1645`

Todos os outros fatores usam `weights.<x>Weight` (configuráveis em `StrategySettings`). O FVG está **fora do sistema de pesos** — o Auto-Tuner não consegue calibrá-lo, e o operador não consegue desligá-lo.

Além disso, `detectFVG` varre do fim para trás até encontrar o primeiro gap, **sem janela temporal**: um FVG de ontem recebe os mesmos 10 pontos de um FVG recém-formado.

**Correção:** `weights.fvgWeight` + `fvgMaxAgeCandles` (com teste de regressão: gap fora da janela não pontua).

---

### A-03 — Fibonacci por extremos da janela e tendência decidida por ordem cronológica

**Arquivo:** `server/binanceService.ts:1487-1600`

- `swingHigh`/`swingLow` = **máximo/mínimo de toda a janela de 60 velas** (`:1516-1526`), não pivôs/fractais.
- A direção é `const isDownTrend = hhIndex < llIndex` (`:1558`): decidida pela **ordem em que os extremos apareceram**, não por estrutura de mercado.

**Impacto:** em mercado lateral/rango — exatamente quando a Golden Pocket mais importa — essa ordem é quase arbitrária e a classificação de tendência **inverte entre avaliações consecutivas**, movendo `fib618`/`fib68`, `inGoldenPocket`, `support1`/`resistance1` e, por consequência, **stop e alvo** (que são ancorados nesses níveis em `signalEngine.ts:671-682`).

**Correção:** detecção de pivô por fractal (mesma família de `findMarketPivots` já existente em `rsiDivergenceUtils.ts:42`) para escolher o último swing válido; teste com série sintética de rali-fundo-rali validando a direção.

---

### A-04 — Timeframe declarado ≠ timeframe medido (indicadores e MM24)

**Evidência 1 — todos os indicadores usam 15m, independente da estratégia:**
`server.ts:325` → `await fetchKlines(symbol, '15m', SIGNAL_LOOKBACK_CANDLES)` é o **único** array de velas entregue a `processTickerState`, para **todas** as categorias ativas — SCALP (5m), DAY_TRADE (15m), INTRADAY (30m), SWING (1h/4h), POSITION (4h/1d). Volume Profile, Fibonacci, FVG, CVD, estrutura e ATR do stop são calculados sobre 15m em todos os casos, mas o sinal é rotulado com o timeframe da estratégia (`buildTradeSignal` `tf`, `signalEngine.ts:547-580`).

**Evidência 2 — o rótulo da divergência de RSI é arbitrário:**
`server/signalEngine.ts:352-361`:

```ts
let divTimeframe = '1h';
if (weights.volumeProfileTimeframe === '15m') divTimeframe = '15m';
else if (weights.volumeProfileTimeframe === '4h') divTimeframe = '4h';
else if (weights.volumeProfileTimeframe === '1d' || '1D') divTimeframe = '1D';
```

O default de `volumeProfileTimeframe` é **`'30m'`** (`src/constants/strategyPresets.ts:152`) → nenhum ramo casa → **rótulo `'1h'` sobre velas de 15m**. Uma divergência "de 1h" exibida ao operador é medida em 15m.

**Evidência 3 — `ma24h` não é uma média de 24h:**
`server/signalEngine.ts:110-118`:

```ts
if (klines && klines.length > 0) {
  const sumCloses = klines.reduce((acc, k) => acc + (k.close || price), 0);
  ma24h = sumCloses / klines.length;          // 60 velas de 15m = 15 HORAS
}
```

`ma24h` e `ma24hDeviationPct` (exibidos e usados por `estimateRSI`) são a média de ~15 h no live e de **60 minutos** no backtest — o rótulo "24h" não corresponde a nenhuma das duas janelas.

**Correção:** derivar as velas do **timeframe da própria estratégia** (ou declarar explicitamente o timeframe do indicador e nomeá-lo); `ma24h` deve usar janela de 24 h real ou ser renomeada para `maWindow`.

---

### A-05 — Paridade live ↔ backtest quebrada em 3 pontos concretos

| Ponto | Live | Backtest | Consequência |
|---|---|---|---|
| Filtros do exchange (`tickSize`) | `getSymbolFilters(symbol)` (`server.ts:434`) | `undefined` (`BacktestEngine.ts:868-878`) | No live o stop é arredondado ao tick no lado conservador e o **R:R é recalculado** (`signalEngine.ts:703-713`), podendo **reprovar** o sinal; no backtest não. Sinais aceitos nos dois lados diferem |
| `weights` | `undefined` (`server.ts:433`, comentário "default do R-7 preservado") | `undefined` | `maxStopLossAtrMultiple` — **tipado** (`src/types.ts:332`) e **validado** (`server/middleware/validation.ts:57`) — **nunca é aplicado**; o teto é sempre o literal `2.5` (`signalEngine.ts:645`) |
| `customTimeframe` / TTL | `stratConfig.timeframe` + `weights.signalTtlSettings` | `undefined` / `undefined` | O rótulo e a expiração do sinal **não** são os mesmos objetos nos dois caminhos |

**Correção:** construir **um único** `SignalContext` (weights, ttl, filters, timeframe) no live e no backtest, a partir da mesma função. Teste de paridade que compare o objeto de contexto, não só o resultado.

---

### A-06 — `takerBuyVolume` pode ser fabricado silenciosamente

**Arquivo:** `server/binanceService.ts:1444`

```ts
takerBuyVolume: parseFloat(k[9]) || parseFloat(k[5]) * 0.52
```

Se o campo vier `0` (ausente ou genuinamente zero), o operador `||` cai no fallback e **inventa 52% de compra taker**. Isso contamina, em cascata: CVD, `cvdDelta`, `cvdDeltaPercent`, `takerBuyRatio`, `cvdDirection`, a checagem de BOS (`signalEngine.ts:157-159`) e o fator `cvdImbalanceWeight`.

**Correção:** `Number.isFinite(v) ? v : null` e marcar o fator como indisponível (o padrão `availability` já existe em `processTickerState`).

---

### A-07 — Proveniência dos fatores existe mas não chega ao operador; o selo afirma o oposto

- `server/signalEngine.ts:65-68, 320, 481` — `unavailableFactors` lista Open Interest / Funding / Long-Short / Trapped Traders quando o feed falha.
- `server/db.ts:1743` — é persistido com o sinal (reprodutibilidade correta).
- **Nenhum componente consome `unavailableFactors`** (grep em todo `src/`: zero ocorrências de renderização).
- Pior: `src/components/DataQualityBadge.tsx:15-20,31,50` mostra, de forma **estática**, *"Feed 100% verificado da Binance Futures"*, *"DADOS REAIS"* e *"Zero fabricação de preço"* — inclusive quando `ticker.dataQuality` está ausente, caso em que o próprio componente cria `{ isLive: true, isDegraded: false, source: 'WS' }`.

**Correção:** o badge deve (a) mostrar os fatores indisponíveis do ticker, (b) nunca afirmar verificação a partir de defaults, (c) usar linguagem proporcional à evidência real.

---

### A-08 — A calibração correta não participa de nenhuma decisão

`server/services/scoreCalibration.ts` implementa encolhimento bayesiano (`k = 30`), expectativa em **R** e nível de confiança explícito (`UNCALIBRATED` / `THIN_SAMPLE` / `CALIBRATED`) — metodologicamente correto. Mas ela é exposta **apenas** como probe:

- `server/routes/evidenceRoutes.ts:53-90` → `GET /api/evidence/calibration` (leitura).
- **Nenhum** ponto de decisão a consulta: o gate de emissão continua sendo `weights.minConfluenceScore ?? 65` sobre o **score cru** (`server.ts:418`, `BacktestEngine.ts:856`), e o Auto-Tuner otimiza contra o mesmo score.

**Correção:** o gate de emissão (ou ao menos o **tamanho/rotulagem** do sinal) deve consultar a expectativa calibrada do tier; tier com `n < MIN_SAMPLE_FOR_CALIBRATION` deve **suprimir a recomendação**, não apenas o probe.

---

### A-09 — O gate de dependências de produção está VERMELHO (2 CVEs, uma crítica)

**Comando:** `npm run audit:prod` (`npm audit --omit=dev --audit-level=moderate`) → **EXIT 1**

```
proxy-addr  1.1.0 - 2.0.7   Severity: CRITICAL
  proxy-addr vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet
  https://github.com/advisories/GHSA-jqcg-44mw-7w3h

source-map-js  1.0.0 - 1.2.1  Severity: HIGH
  source-map-js allows event-loop denial of service through indexed source-map section offsets
  https://github.com/advisories/GHSA-68fv-2mgg-jv7q

2 vulnerabilities (1 high, 1 critical)
```

**Por que isso é de alta gravidade neste projeto especificamente:**

1. `proxy-addr` é a dependência que o Express usa para **resolver o IP do cliente** — e `server/app.ts:29-30` ativa `app.set('trust proxy', 1)`, com o comentário *"essential for Cloud Run, reverse proxies and rate-limiting"*. Esse é exatamente o caminho explorado pelo CVE de *IP spoofing via IPv4-mapped IPv6*: um cliente que consiga influenciar o cabeçalho de encaminhamento pode **forjar o próprio IP** e, com isso, **contornar os rate limiters** (global 300/min, sensível 45/min, brute-force de token 15/min) que são parte do modelo de segurança descrito em `docs/SEGURANCA.md`.
2. `source-map-js` (high, DoS de event loop) está no *runtime* de produção porque pacotes de **build** foram declarados em `dependencies` (ver M-09).

**Correção:** `npm audit fix` (as duas correções são patch/minor não-breaking segundo o próprio npm) e, na sequência, validar `npm run ci` (a suíte inclui `tests/rateLimiterCoverage.test.ts` e `tests/securityContract.test.ts`). Enquanto não for corrigido, **o gate de dependência do produto está aberto** — e nenhuma afirmação de "institucional" é sustentável com um CVE crítico na cadeia de produção.

---

## 4. ACHADOS DE MÉDIA GRAVIDADE

- **M-01 — ATR duplicado, média simples, multiplicadores fixos.**
  `server/signalEngine.ts:580-600` e `:640-660` recalculam o mesmo ATR (TR média simples de 15 velas — não Wilder) em dois blocos separados; `atrMultipliers` (`:586-596`) é um dicionário literal por categoria. Duplicação + não configurável.

- **M-02 — Risco por trade fora do sistema de pesos.**
  `slPct` por categoria em `switch` hardcoded (`signalEngine.ts:547-580`); buffers `0.9985` / `1.0015` (`:637-638`); `slDist` mínimo `0.3%` (`:623`); spread da zona de entrada `0.3%` (`:543`); espaçamento de alvos `0.8`/`1.5` (`:693-697`); spike/wick `0.55` + `0.49`/`0.51` (`:784-795`). O `stopCap` por categoria **é** calibrável por env (`MAX_STOP_PCT_*`) — o que torna a inconsistência mais visível: metade do risco é configurável, metade não.

- **M-03 — Trapped Traders: ~15 constantes + defaults inventados.**
  `server/binanceService.ts:1313-1400`: `0.52/0.48`, pavio `35%`, `60/72%` de sentimento, TTI mínimo `52`, bônus `15`, absorção `×0.45`, volume `×0.65`, crowding `×1.5`, proximidade `0.015`. E, com menos de 5 velas (`:1273-1287`), devolve **`trappedIndex: 30`, `trappedVolumeUSD: 1000000`, `absorptionRatio: 25`** — valores com aparência de medição para quem não tem dado nenhum.

- **M-04 — Tabela de preços estática.**
  `src/utils/benchmarkPrices.ts` fixa BTC 92.450, ETH 3.420 etc. Está corretamente isolada em código demo/sintético (`server/demo/*`, protegido por `ALLOW_SYNTHETIC_DATA`), mas **`server/db.ts:15` importa `getBenchmarkPrice` e nunca o usa** (import morto; `tsconfig` não habilita `noUnusedLocals`).

- **M-05 — Duas fontes de verdade para risco.**
  `src/utils/riskCalculations.ts` (frontend) recalcula exposição/VaR por fora de `server/services/RiskManager.ts`. Não existe teste de reconciliação servidor↔UI. Duas implementações do mesmo conceito divergem em silêncio.

- **M-06 — Código de cálculo sem consumidor no produto.**
  `calculateAdvancedRiskMetrics` (`src/utils/backtestMetrics.ts:25`) só é referenciada por testes; o dashboard usa as métricas do resultado do backtest do servidor. Manter os testes é correto, mas a função precisa de um dono claro (ou ser removida).

- **M-07 — Higiene de tipos.**
  `scripts/quality-baseline.ts --report` → **160 `any` explícitos, 8 `catch` vazios** (baseline commitada impede piorar, mas não converge). `tsconfig.json` tem `strict: true` mas **não** habilita `noUnusedLocals`/`noUnusedParameters` — foi assim que o import morto de M-04 passou.

- **M-09 — Pacotes de build e tipos declarados como dependências de PRODUÇÃO.**
  `package.json` lista em `dependencies` (não em `devDependencies`): `vite` (duplicado nos dois blocos), `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `autoprefixer`, `@types/d3`, `@types/react-grid-layout`, `@types/ws`. Consequências reais: (a) a árvore de produção carrega um bundler e definições de tipo, engordando a imagem e a superfície de auditoria — é o que traz `source-map-js` (A-09) para dentro do `npm audit --omit=dev`; (b) o container precisa de `node_modules` de desenvolvimento para rodar um servidor que só precisa do `dist/server.cjs`.
  **Correção:** mover bundler/tipos para `devDependencies` e rodar `npm audit --omit=dev` novamente — a lista de CVEs de produção deve encolher só com essa reorganização.

- **M-08 — Pressão de peso de API por tick.**
  O loop roda a cada 4 s (`server.ts:~700`) e, por símbolo monitorado, busca klines 15m + 1m + 5m + OI + funding + Long/Short. Existem `binanceRateLimiter` com `REQUEST_WEIGHT` **real** capturado do `exchangeInfo` (`server/binanceService.ts:175-195`) e um teste de orçamento (`tests/tickWeightBudget.test.ts`) — o mecanismo é bom, mas o custo cresce com o universo do screener e merece medição contínua.

---

## 5. MAPA COMPLETO DE VALORES FIXOS

### 5.1 `server/signalEngine.ts` (motor)

| Linha | Literal | Conceito | Deveria ser |
|---|---|---|---|
| 133 | `0.53` / `0.47` | Direção do CVD (taker buy ratio) | Configurável |
| 157,159 | `0.54` / `0.46` | Confirmação de BOS | Configurável |
| 181 | `1.5` | Limiar de OI 1h (%) | Configurável |
| 193,197 | `1.2` | Boost de CVD com delta > 10% | Configurável |
| 204 | `0.005` | Distância ao POC | Configurável |
| 209,213 | `1.003/0.995`, `0.997/1.005` | Janelas VAL / VAH (**assimétricas**) | Configurável + simétrico |
| 232,239,246,253 | `0.0004 / 0.00015 / -0.0003 / -0.0001` | Faixas de funding | Configurável |
| 237,244,251,258 | `1.5` / `0.8` | Multiplicadores de funding | Configurável |
| 280,283 | **`10`** | Peso do FVG | **Bug** — deveria ser `weights.fvgWeight` |
| 323,329 | `1.5` | Intensidade do contra-trade | Configurável |
| 379 | `1.2`, `25`, cap `100` | Fórmula do confluenceScore | Calibrável (A-01) |
| 384,391 | `35` / `55` | Limiares de netScore | Configurável |
| 526,645 | `2.5` | Fallback do cap ATR do stop | **Knob existe e é ignorado** (A-05) |
| 535 | `< 50` | Gate **morto** | Remover |
| 547-580 | `0.008/0.012/0.015/0.025/0.040/0.010/0.015` | SL% por categoria | Configurável (M-02) |
| 586-596 | `1.0/1.4/1.6/2.2/3.5/1.3/1.5` | Multiplicadores ATR | Configurável |
| 623 | `0.003` (0,3%) | SL mínimo | Configurável |
| 637-638 | `0.9985` / `1.0015` | Buffer do stop | Configurável |
| 693-697 | `0.8` / `1.5` | Espaçamento de alvos | Configurável |
| 784-795 | `0.55` / `0.49` / `0.51` | Anti-spike e confirmação 1m | Configurável |
| 814 | `>= 60` | Gate **sempre verdadeiro** | Remover |
| 862 | `sustainSeconds: 60` | Metadado fixo | Derivar do timeframe |

### 5.2 `server/binanceService.ts`

| Linha | Literal | Conceito |
|---|---|---|
| 1273-1287 | `30` / `1000000` / `25` | Defaults inventados sem velas |
| 1313,1314 | `0.015`, `0.995/1.005` | Proximidade a extremos |
| 1317-1322 | `0.52`/`0.48`, `35` | Absorção Wyckoff |
| 1327-1332 | `60` / `72` | Sentimento da multidão |
| 1349,1364 | `0.00015` / `-0.0001`, bônus `15` | Bônus de funding no TTI |
| 1352,1367 | `0.45` | Peso da absorção |
| 1355,1371 | `52` | TTI mínimo para "trapped" |
| 1338,1353 | `1.5` | Bônus de crowding |
| 1385 | `0.65` | Fração do volume do candle |
| 1444 | `0.52` | **Fallback silencioso do takerBuyVolume** (A-06) |
| 1478 | `0.70` | Fração da Value Area |
| 1487-1600 | — | Fibonacci por extremos (A-03) |
| 1621-1645 | — | FVG sem janela (A-02) |
| 1743 | `2.3` | Limiar de "wall" no book |
| 1807-1810 | `Math.random()`, `3.4`, `i===7/18` | **Paredes institucionais fabricadas** (C-07) |

### 5.3 Frontend (camada de apresentação e cálculo)

| Arquivo:Linha | Literal/aleatório | Impacto |
|---|---|---|
| `src/App.tsx:366-386` | `0.70 + (score-60)*0.003`, `74`, 7 PnL fixos | **Win-rate e histórico fabricados** (C-02) |
| `src/components/ChartAndProfile.tsx:309` | `Math.random()` | **OI aleatório** (C-03) |
| `src/components/Header.tsx:78` | `12 + rand(14)` | **Ping fictício** (C-05) |
| `src/components/SystemHealthWidget.tsx:82-85` | `rand()` ×4 | **Latência fictícia** (C-05) |
| `src/components/SystemHealthWidget.tsx:239,247` | `99.98%`, `~142` | **Uptime e métrica literais** |
| `src/components/LiquidityDepth.tsx:140,167,244` | `Math.random()`, paredes `i===8/19`, `i===7/21` | **Book sintético silencioso** (C-07) |
| `src/components/ScreenerDashboard.tsx:519-548, 697-726` | `±1%`, `±2/4%`, `0.5`, `0`, `inValueArea:true` | **TickerData sintético** (C-04) |
| `src/components/TrappedTradersRadar.tsx:61-95` | liquidações e L/S inventados | **Fluxo institucional fabricado** (C-06) |
| `src/utils/rsiDivergenceUtils.ts:239-270` | `2.8 / 1.5 / ±3.5 / ±4` | **RSI fabricado** (C-01) |
| `src/utils/riskCalculations.ts:283-288, 15+, 540` | `0.035`, tabela de betas, `1.645/2.326` | **VaR paramétrico com vol. assumida** (C-08) |
| `src/components/DataQualityBadge.tsx:15-20,31,50` | `'DADOS REAIS'`, `'100% verificado'` | **Afirmação estática** (A-07) |
| `src/utils/riskCalculations.ts:468-560` | 6 posições fixas (margem/alav./offsets) | **Portfólio de demonstração exibido como real** (C-09; consumido em `RiskExposureDashboard.tsx:99,345`) |
| `src/utils/benchmarkPrices.ts` | tabela fixa de preços | Isolada em demo (M-04) |

**Total:** ~45 limiares fixos no motor + ~9 valores fabricados na camada de apresentação + 3 tabelas estáticas (`benchmarkPrices`, `ASSET_SECTOR_MAP`, portfólio-semente de `getInitialSeedPositions`).

---

## 6. TESTES — COBERTURA REAL E PONTOS CEGOS

**Números verificados:** 165 arquivos, **963 testes, 100% verdes**, 397 s, typecheck limpo.

### 6.1 O que a suíte cobre bem

- Contabilidade e ledger: `backtestRDecomposition`, `backtestInvariants`, `ledgerInvariants`, `ledgerTransactional`, `ledgerAppendOnly`, `ledgerReconcile`, `decimalPnl`, `backtestAccounting*`.
- Paridade e determinismo: `timeframeParity`, `liveBacktestParity`, `compareEntryDeterministic`, `diagnoseEdgeDeterministic`.
- Segurança e resiliência: `securityContract`, `cspEnforceMode`, `cspReportOnly`, `hostGuard`/`bindGuard`, `outboundDnsEnforcement`, `tokenHandling`, `rateLimiterCoverage`, `wsReconnectBackoff`.
- Gates e risco: `dataGate`, `riskManagerContract`, `riskLimitsRuntimeConsistency`, `stopCap`, `stopLossCap`, `clockDrift`, `feedHealth`, `killSwitchPersistence`.
- Evidência/calibração: `evidence*`, `scoreCalibration`, `winDefinition`, `backtestFundingReal`, `walkForwardRolling`, `autoTuneHoldout`, `autoTuneThreeWaySplit`.
- Anti-invenção de métrica: `unmeasuredMetricConstants`, `noToFixedInCalc`, `repoHygiene`, `noFixturesInProduction`.

### 6.2 Pontos cegos que **exatamente** deixaram C-01..C-09 passarem

| Área | Status | Teste que faltava |
|---|---|---|
| `estimateRSI` / `scanUniverseRSIDivergences` | **zero testes** | RSI deve ser `NO_DIVERGENCE` sem velas (C-01) |
| `goldenPocketStats` (`src/App.tsx`) | **zero testes** | `winRate === null` com amostra insuficiente (C-02) |
| `ChartAndProfile` construção de `chartData` | **zero testes** | nenhuma série pode usar `Math.random` (C-03) |
| `ScreenerDashboard` → `TickerData` de seleção | **zero testes** | campos derivados devem ser `null`, não inventados (C-04) |
| `Header` / `SystemHealthWidget` | **zero testes** | latência só pode vir do `feed-health` (C-05) |
| `TrappedTradersRadar` fallback | **zero testes** | sem dado ⇒ sem número (C-06) |
| `LiquidityDepth` fallback + contrato do book | **zero testes** | book precisa de `source` (C-07) |
| `riskCalculations` (VaR) vs servidor | sem teste de reconciliação | dois cálculos do mesmo risco devem coincidir |
| `signalTtlUtils` (TTL por categoria + multiplicador de regime) | **zero testes** | limites mínimo/máximo e multiplicador |
| `detectFVG` obsolescência | sem teste | gap antigo não pontua |
| **Componentes React (57 arquivos `.tsx`)** | **zero testes** | nenhum teste de componente no projeto |
| `benchmarkPrices` | sem teste (e import morto) | — |

### 6.3 Fragilidade das guardas existentes

- `tests/noFixturesInProduction.test.ts` verifica apenas que arquivos de `server/` **não citam** `tests/` ou `fixtures` — é **higiene de import**, não integridade de dado. Passa 100% enquanto `Math.random()` popula a tela.
- `tests/noToFixedInCalc.test.ts` aplica-se a uma **lista explícita de 8 arquivos** que **não inclui `server/signalEngine.ts`** (que usa `Number(...toFixed(2))` em caminhos de cálculo, ex. `cvdDeltaPercent`, `ma24hDeviationPct`).
- **A lacuna estrutural:** não existe nenhum teste que afirme *"nenhum valor numérico exibido ao operador foi sintetizado"*. Esse é o único teste que pegaria C-01..C-09 de uma vez — e é o primeiro item da Fase 0 do plano abaixo.

---

## 7. O QUE ESTÁ FEITO BEM (preservar, não regredir)

1. **Fail-closed na pipeline de dados:** `DataGate` bloqueia sinal por dado com mais de 60 s, preço inválido, fonte `STALE` ou qualidade degradada; `canEvaluateActiveTrades` impede que dado ruim feche posição; `ClockService` detecta deriva de relógio. É rigor de nível institucional.
2. **Contabilidade em decimal exato** (`server/utils/decimal.ts`), com slippage aplicado **uma única vez** (na saída), taxas por lado, funding real e uma **identidade de R testada** que impede compensação de erros.
3. **Paridade estrutural live↔backtest:** `BacktestEngine.ts` importa `processTickerState` / `buildTradeSignal` do mesmo módulo do live; a agregação 1m→15m é feita **sem lookahead** (`timeframeParity.ts`), com cursar monotônico.
4. **Ledger transacional fail-closed:** sinal e evento na mesma transação; sem ledger, o sinal **não** é emitido, com alerta e métrica (`tests/ledgerTransactional.test.ts`).
5. **`scoreCalibration.ts`** — encolhimento bayesiano (`k=30`), expectativa em **R** (não win rate), confiança declarada. Só falta ligar à decisão (A-08).
6. **`EvidenceService.ts`** — MFE/MAE em R, intervalo de Wilson, go/no-go com denominador explícito.
7. **Contrato "medição ausente ≠ número":** métricas não medidas são `null` com `assumptions[]`, e há teste dedicado (`unmeasuredMetricConstants.test.ts`).
8. **Segurança:** auth constant-time, brute-force limiter, CORS allowlist (fim do `endsWith('.run.app')`), CSP report-only com coleta de violação, `trust proxy`, limite de payload, host guard, outbound DNS enforcement, rate limiter com `REQUEST_WEIGHT` real capturado do `exchangeInfo`.
9. **Decisões gated por evidência:** `ENTRY_CONFIRMATION_ENABLED="false"` segue o veredito registrado, e `flagMatchesDecision.test.ts` falha se a flag divergir do veredito. Isso é governança de mudança de comportamento rara e valiosa.

**Nada nesses 9 itens deve ser simplificado durante a remediação.** O problema do projeto é *ao lado* deles, não neles.

---

## 8. PLANO DE REMEDIAÇÃO PRIORIZADO (TDD / SDD / Clean Code)

**Regra transversal:** cada item começa pelo **teste que falha** (TDD), é registrado como item de spec (SDD, em `docs/specs/`) e termina com `npm run ci` verde. Nenhuma correção de indicador pode ser feita sem teste de referência — é assim que C-01 e A-01 sobreviveram.

### 8.0 STATUS DA REMEDIAÇÃO — Fases 0, 1 e 2 (A-08) IMPLEMENTADAS

**Verificação (executada após as edições — estado atual):** `npx tsc -p tsconfig.json --noEmit` → **0 erros** · `npx vitest run --pool=threads` → **176 arquivos / 1064 testes, 100% verdes (EXIT 0, 0 erros de worker)** · `npm run build` → **exit 0**. Logs: `.audit/final6-{vitest,tsc,build}.log`.

> **Nota de verificação — flake PRÉ-EXISTENTE encontrado e corrigido (só no teste):** a suíte acusou `tests/walkForwardRolling.test.ts` (R-10) falhando em **2 asserções de *sanidade***. Não era regressão: o bloco semeia candles sintéticos a partir de `asOf = alignedNow()` (`tests/helpers/backtestSeed.ts`) e o gerador deriva o stream de `(symbol, startTime)`, logo a distribuição dos trades entre treino e OOS mudava a cada bucket de 15 min do relógio; com poucos trades (5–14 numa janela de 6 dias) eles podem cair todos dentro do treino e aí `full` e o subconjunto truncado coincidem. **Provado pré-existente por A/B no mesmo relógio:** revertendo `server/services/{BacktestEngine,HistoricalDataService,signalEngine}.ts` e `server/backtest_db/index.ts` ao HEAD (sem nenhuma mudança desta remediação) a falha é **idêntica** (`expected 10 not to be 10`); o teste também já falhava na linha de base da Fase 0 (`.audit/full-test-phase0.log`, `expected 14 not to be 14`) e passou numa rodada de 15:37 do mesmo código. **Correção:** âncora fixa (`asOf = END`, a mesma linha do tempo que os testes puros do próprio arquivo já usam) — o stream passa a ser determinístico por construção e o resultado deixa de depender do relógio. **Nenhuma asserção foi alterada ou enfraquecida:** as que medem o invariante anti-vazamento (`after.totalTrades === beforeIsOnly.totalTrades`, `autoTune.initialResult.totalTrades === isOnly.totalTrades`) sempre passaram, inclusive nas rodadas vermelhas.
>
> **Nota operacional:** no Windows, a suíte pelo pool padrão (`forks`) esgota a criação de processos (~176 forks) e derruba ~10 workers com `0xC0000142`, o que **encurta a rodada em silêncio** — foi o que aconteceu em `.audit/final3-vitest.log` (166 arquivos/1027 testes relatados como "verdes", em vez dos 176/1064 reais): uma rodada que pareceu verde mas não cobriu a suíte. Rodar com `--pool=threads` completa a suíte sem erro de worker.

**Code review (5 eixos):** APROVADO COM RESSALVAS → ALTA (taker volume fabricado no backtest) e MÉDIAS remediadas; as BAIXAS (ruído do diff `server.ts` — restaurados PORT/.catch/reindent, whitespace do `rsiDivergenceUtils`, plano sintético do fallback RSI) limpas. O gate `noFixturesInProduction` passou a distinguir referência de caminho (`tests/`, `'fixtures/…'`) de menção em prosa de comentário — o regex amplo dava falso positivo no comentário A-06 de `backtest_db/index.ts`.

| Item | Status | Teste-gate que passou a existir |
|---|---|---|
| 1 Guarda global de tela | ✅ | `tests/noFabricatedDisplay.test.ts` (15 módulos de apresentação) |
| 2 Win-rate / curva fabricados (C-02) | ✅ | `noFabricatedDisplay` (C-02) + `GoldenPocketStats.winRate: number \| null` |
| 3 OI aleatório (C-03) | ✅ | `noFabricatedDisplay` (varredura de `Math.random()`) |
| 4 Ping/latência fictícios (C-05) | ✅ | `noFabricatedDisplay` + RTT real em `Header.tsx` |
| 5 Trapped Traders inventados (C-06) | ✅ | `noFabricatedDisplay` (literais de fabricação) |
| 6 Screener sem ticker sintético (C-04) | ✅ | `noFabricatedDisplay` + `handleSelectAsset` resolve no feed vivo |
| 7 Proveniência do book (C-07) | ✅ | `OrderBookDepthData.source` obrigatório + badge LIVRO REAL/SINTÉTICO em `LiquidityDepth` |
| 8 Badge lista `unavailableFactors` | ✅ | `noFabricatedDisplay` (sem "DADOS REAIS"/"100% verificado") |
| 9 `estimateRSI` fora da UI (C-01) | ✅ | `noFabricatedDisplay` (C-01) + `rsiMeasuredCount` |
| 9b C-01 residual: RSI `50` e plano sintético do fallback | ✅ | `noFabricatedDisplay` (sem `rsiCurrent: 50`; `entryZone: null`) + guards "n/d" em `RSIDivergenceMonitor` (`handleCopySetup` e Execution Plan) |
| 10 VaR paramétrico ≠ medido (C-08) | ✅ | `noFabricatedDisplay` (5 testes comportamentais de `varBasis`) |
| 10b Taker ratio do Screener sem neutro fabricado (MÉDIA do review) | ✅ | `noFabricatedDisplay` (gate ampliado) + `TimeframeVolumeMetrics.takerRatio: number \| null` / `deltaPressure: … \| 'UNKNOWN'` com "n/d" em 3 componentes |
| C-09 portfólio-semente | ✅ | `getInitialSeedPositions` removida; portfólio inicia vazio |
| 11 Fibonacci por pivôs fractais (A-03) | ✅ | `tests/fibonacciStructure.test.ts` |
| 12 FVG com peso + staleness (A-02) | ✅ | `tests/fvgStaleness.test.ts` |
| 13 `takerBuyVolume` sem fallback (A-06) | ✅ | `tests/takerBuyVolumeProvenance.test.ts` |
| 14 `ma24h` em janela de 24h real (A-04) | ✅ | `tests/timeframeMeasured.test.ts` |
| 15 Timeframe declarado = medido (A-04) | ✅ | `tests/timeframeMeasured.test.ts` (intervalo inferido das velas) |
| 16 Testes de conformidade com lib independente | ⬜ parcial | Wilder RSI/ATR já cobertos; Value Area pendente |
| A-01 Score sem saturação + gates mortos | ✅ | `tests/confluenceScoreModel.test.ts` |
| A-05 Contexto único live↔backtest | ✅ | `tests/signalContextParity.test.ts` |
| A-08 Calibração gateia a emissão | ✅ | `tests/calibrationGate.test.ts` (6 de regra + 5 de fiação) |
| A-09 `audit:prod` (2 CVEs) | ⬜ pendente | `proxy-addr` (crítico), `source-map-js` (alto) |

**A-01 (detalhe):** o score agora é `scoreConfluence(netPoints)`: linear (`1.2·x + 25`) até o joelho 45 — preservando o significado de `minConfluenceScore` 58..74 — e logarítmico acima, sem colapsar em 100. A direção saiu do número (`scoreDirection`) e os dois gates mortos (`:535`, `:814`) foram removidos/substituídos por um limiar vivo. `SCORING_MODEL` é versionado.

**A-05 (detalhe):** `buildSignalContext()` é a fonte única; live e backtest passaram a entregar o **mesmo** objeto `weights` ao motor (antes `undefined` nos dois), o que ativou `maxStopLossAtrMultiple` e `minConfluenceScore`. Diferenças remanescentes (ex.: ausência de `filters` no backtest) são **declaradas** em `parityWarnings`, nunca silenciosas.

**A-08 (detalhe, Fase 2):** o gate vive na cadeia de gates do tick (`server.ts`), antes de `buildTradeSignal`: só emite com `expectancyR > 0` e `confidence ≠ UNCALIBRATED`, suprimindo com a métrica nova `signals_suppressed_calibration` + log (mesmo padrão kill-switch/risk/datagate). Ledger **totalmente** sem amostras ⇒ modo bootstrap (emite com aviso “sem base rate”) para o robô não nascer mudo — a partir da 1ª amostra fechada o gate vale literalmente. `loadCalibrationInput()` (`server/services/calibrationGate.ts`) é a fonte única do payload, compartilhada com `GET /api/evidence/calibration` (contrato da rota inalterado; `scoreCalibrationRoute` + `evidenceMfeMae` verdes). Escopo: emissão live — o backtest (instrumento de medição) não é gateado.

> **Mudança de comportamento esperada:** por desenho, os números do robô vão mudar — FVG antigo deixa de pontuar, o score deixa de saturar, o Fibonacci ancora em pivôs e o CVD ignora velas sem `takerVolume`. Isso é a prova de que o sistema passou a *medir* em vez de *fabricar* (§9.3).

### Fase 0 — Integridade da tela (bloqueia qualquer uso real) — ~3 dias

| # | Ação | Arquivo | Teste que deve existir antes |
|---|---|---|---|
| 1 | **Guarda de integridade global**: teste que varre `src/` e falha se houver `Math.random()`/literal de fallback num arquivo da lista de apresentação de mercado | novo `tests/noFabricatedDisplay.test.ts` | é o próprio teste |
| 2 | Remover win-rate/outcomes fabricados; exibir "Amostra insuficiente (n/N)" | `src/App.tsx:366-386` | `goldenPocketStats` com 0 sinais ⇒ `null`/`[]` |
| 3 | Remover `Math.random()` do OI; usar série real ou remover a curva | `src/components/ChartAndProfile.tsx:309` | série de OI monotônica/proveniente |
| 4 | Remover ping fictício; latência real ou `"—"` | `Header.tsx:78`, `SystemHealthWidget.tsx:80-87,239,247` | latência só do `feed-health` |
| 5 | Fallback do Radar: sem dado ⇒ sem número | `TrappedTradersRadar.tsx:61-95` | sem `trappedTraders` ⇒ sem valores |
| 6 | Screener busca o ticker real; senão marca `null`/"n/d" | `ScreenerDashboard.tsx:519-548,697-726` | seleção sem dado real ⇒ campos `null` |
| 7 | `source: 'EXCHANGE' \| 'SIMULATED'` no contrato do book + banner no cliente | `src/types.ts`, `binanceService.ts:1769-1820`, `LiquidityDepth.tsx:118-190,244` | `fetchOrderBookDepth` em falha ⇒ `SIMULATED` |
| 8 | Badge de qualidade passa a listar `unavailableFactors` e deixa de afirmar "100% verificado" | `DataQualityBadge.tsx:15-20,31,50` | badge com fator indisponível ⇒ aparece |
| 9 | **Remover o `estimateRSI` do caminho de UI**: monitor sem velas não mostra RSI | `rsiDivergenceUtils.ts:239-270,435-453` | sem velas ⇒ `NO_DIVERGENCE` |
| 10 | Separar VaR "paramétrico assumido" de VaR medido (rótulo + vol realizada) | `riskCalculations.ts:283-288` | reconciliação com `RiskManager` |

### Fase 1 — Correção dos indicadores — ~2 semanas

| # | Ação | Arquivo | Teste |
|---|---|---|---|
| 11 | Fibonacci por pivô/fractal; direção por estrutura, não por ordem de índice | `binanceService.ts:1487-1600` | série rali-fundo-rali ⇒ direção estável |
| 12 | FVG com `weights.fvgWeight` + `fvgMaxAgeCandles` | `signalEngine.ts:280,283`, `binanceService.ts:1621` | gap antigo não pontua |
| 13 | `takerBuyVolume` sem fallback silencioso | `binanceService.ts:1444` | `0` real permanece `0`; ausente ⇒ indisponível |
| 14 | `ma24h` com janela de 24 h real (ou renomear para `maWindow`) | `signalEngine.ts:110-118` | média de 24 h ± tolerância |
| 15 | Timeframe explícito por indicador; rótulo da divergência derivado do timeframe real das velas | `signalEngine.ts:352-361`, `server.ts:325` | rótulo === timeframe das velas |
| 16 | Testes de conformidade com valores de referência de biblioteca independente | `tests/` | Wilder RSI, ATR, Value Area |

### Fase 2 — Parametrização e calibração — ~2 semanas

| # | Ação |
|---|---|
| 17 | Extrair os ~45 literais de `signalEngine.ts` para um `SignalThresholds` versionado, persistido e exposto na UI |
| 18 | SL% por categoria e multiplicadores ATR para `IndicatorWeights` (com os valores atuais como default — zero mudança de comportamento) |
| 19 | **Ligar `scoreCalibration` ao gate**: emitir/recomendar só com `expectancyR > 0` e `confidence ≠ UNCALIBRATED` |
| 20 | Redesenhar `confluenceScore`: sem saturação, sem `abs()`, direção separada da magnitude; trocar o rótulo "%" |
| 21 | Remover os gates mortos (`:535`, `:814`) e o knob `maxStopLossAtrMultiple` morto (ou aplicá-lo) |
| 22 | Contexto único `SignalContext` (weights/ttl/filters/timeframe) compartilhado live↔backtest |

### Fase 3 — Consolidação — ~1 semana

| # | Ação |
|---|---|
| 23 | Fonte única de risco: `RiskManager` no servidor como verdade, frontend só apresenta |
| 24 | Testes de componente para as telas de decisão (CVD/OBI, matriz de sinais, prime opportunity, risco) |
| 25 | Zerar `any`/`catch` vazios para o baseline e habilitar `noUnusedLocals` |
| 26 | Extrair helpers de `signalEngine.ts` (887 linhas) e de `ChartAndProfile.tsx` (2.358 linhas) para módulos focados |

---

## 9. COMO AVALIAR SE O ROBÔ ESTÁ PRODUZINDO SINAIS VÁLIDOS

Esta é a pergunta central do briefing — e o projeto **já tem** a infraestrutura para respondê-la. Ela só não é usada como critério de decisão (A-08). O critério abaixo é objetivo e auditável.

### 9.1 Critério de aceitação do robô

> Um **tier de score** só pode ser recomendado quando **≥ 30 sinais fechados** (`MIN_SAMPLE_FOR_CALIBRATION`) sustentarem `expectancyR > 0` **líquida de taxas + slippage + funding**. Abaixo disso o sistema deve responder **"não sei"** — e a UI **não pode exibir percentual de acerto**.

Regras derivadas:
- `confidence === 'THIN_SAMPLE' | 'UNCALIBRATED'` ⇒ nenhuma recomendação, nenhum "% de acerto".
- Win-rate **só** de sinais fechados com `outcomeR` medido (não do score, nunca de literais).
- Todo número exibido deve ter proveniência rastreável (`origin`, `source`, `unavailableFactors`).

### 9.2 Checklist de validação (rodar antes de qualquer operação real)

```bash
npm run ci              # typecheck + 963 testes + build
npm run audit:prod      # ❌ HOJE FALHA (A-09) — corrigir antes de operar
npm run typecheck       # 0 erros
npx tsx scripts/quality-baseline.ts --report   # baseline de qualidade
```

Depois, no runtime:
1. `ALLOW_SYNTHETIC_DATA` **ausente ou `false`** (verificado: `false` no `.env` atual).
2. Zero sinais com `origin: 'DEMO'` na base.
3. `GET /api/evidence/calibration` → exportar a tabela por tier: `n`, `expectancyR`, `confidence`. Todo tier com `n < 30` aparece como `THIN_SAMPLE`/`UNCALIBRATED`.
4. `GET /api/system/feed-health` → nenhum feed em `DEGRADED`; e confirmar que a UI mostra **esse** número, não o aleatório.
5. `npm run smoke:binance` → feed real, sem fallback.
6. `npm run measure:db-save`, `npm run diagnose:edge` → comparar com a execução anterior.

### 9.3 Como saber que a remediação funcionou

Depois das Fases 0 e 1, **o número de sinais e o win rate real vão mudar** — e essa mudança é a prova de que o sistema passou a *medir* em vez de *fabricar*. O critério de sucesso não é "mais sinais" nem "win rate maior": é **cada número na tela ter uma fonte rastreável**.

---

## 10. CONCLUSÃO

O projeto tem **segurança e contabilidade de nível institucional** — `DataGate`, ledger transacional, decimal exato, identidade de R testada, calibração bayesiana, governança por veredito de evidência. Esse é o esqueleto de um robô que pode competir com os melhores, e ele deve ser preservado.

O que separa esse esqueleto de um produto institucional de verdade é uma coisa só: **a camada de decisão e de apresentação ainda inventa números que o operador lê como mercado.** São 9 pontos ativos, todos em código sem teste — e um deles (C-01) é o indicador de momentum exibido com o nome de um indicador canônico que ele não é.

**A ordem correta é Fase 0 (integridade) → Fase 1 (indicadores) → Fase 2 (calibração).** Inverter essa ordem — calibrar thresholds sobre indicadores aproximados e sobre uma tela que fabrica amostra — produziria um sistema com aparência de precisão e nenhuma vantagem real, que é o pior resultado possível para um robô de sinais.

---

## APÊNDICE — RASTREABILIDADE E COMANDOS

**Achado → arquivo:linha (verificado neste commit)**

| ID | Gravidade | Local principal |
|---|---|---|
| C-01 | Crítico | `src/utils/rsiDivergenceUtils.ts:239-270,435-453`; `src/components/RSIDivergenceMonitor.tsx:94,128,225,432` |
| C-02 | Crítico | `src/App.tsx:328-397` |
| C-03 | Crítico | `src/components/ChartAndProfile.tsx:303-311` |
| C-04 | Crítico | `src/components/ScreenerDashboard.tsx:519-548,697-726` |
| C-05 | Crítico | `src/components/Header.tsx:77-80`; `src/components/SystemHealthWidget.tsx:80-87,231,239,247,317-325` |
| C-06 | Crítico | `src/components/TrappedTradersRadar.tsx:61-95` |
| C-07 | Crítico | `server/binanceService.ts:1769-1820,1861`; `src/components/LiquidityDepth.tsx:118-190,244`; `src/types.ts:165-184` |
| C-08 | Crítico | `src/utils/riskCalculations.ts:15+,283-288,540` |
| C-09 | Crítico | `src/utils/riskCalculations.ts:468-560`; `src/components/RiskExposureDashboard.tsx:99,345` |
| A-01 | Alto | `server/signalEngine.ts:379,535,814` |
| A-02 | Alto | `server/signalEngine.ts:280,283`; `server/binanceService.ts:1621-1645` |
| A-03 | Alto | `server/binanceService.ts:1487-1600` |
| A-04 | Alto | `server.ts:325`; `server/signalEngine.ts:110-118,352-361` |
| A-05 | Alto | `server.ts:426-434`; `server/services/BacktestEngine.ts:868-878`; `server/signalEngine.ts:645` |
| A-06 | Alto | `server/binanceService.ts:1444` |
| A-07 | Alto | `server/signalEngine.ts:65-68,320,481`; `src/components/DataQualityBadge.tsx:15-20,31,50` |
| A-08 | Alto | `server/services/scoreCalibration.ts`; `server/routes/evidenceRoutes.ts:53-90` |
| A-09 | Alto | `npm run audit:prod` → EXIT 1 (`proxy-addr` crítico, `source-map-js` alto); `server/app.ts:29-30` (`trust proxy`) |
| M-01..M-09 | Médio | ver §4 |

**Comandos executados nesta auditoria**

```
npm run typecheck      → EXIT 0 (0 erros)
npm test               → 165 arquivos / 963 testes, 100% (397,43 s), EXIT 0
npm run build          → EXIT 0 (vite build 1m02s + esbuild dist/server.cjs 584,3 kb)
npm run audit:prod     → EXIT 1 — 2 vulnerabilidades em deps de produção (1 crítica, 1 alta)
npx tsx scripts/quality-baseline.ts --report → any: 160 | catch vazios: 8
grep -rn "Math.random" src/ server/          → 20+ ocorrências (7 em caminhos de apresentação/mercado)
```

**Observação de método:** os achados desta auditoria foram reconferidos um a um no código do commit `47b559b`. Os itens da seção 0.1 foram **reabertos e fechados** (verificados como corrigidos) para evitar que o time gaste esforço em problemas que já não existem. As demais afirmações têm arquivo e linha nesta página.

*Auditoria estática + verificação por execução. Typecheck e 963/963 testes aprovados no commit auditado. Os achados C-01..C-09 são invisíveis à suíte atual — e essa é a informação mais importante deste relatório.*
