# ⚖️ Módulo 02: Pesos Quantitativos & Matriz de Confluência

Este documento especifica a distribuição de pesos padrão, os perfis operacionais e o algoritmo de pontuação de confluência do **Market Signals SuperBot**.

---

## 1. Pesos Padrão dos Indicadores Quantitativos

Cada indicador possui uma contribuição percentual ponderada na avaliação de confluência de um sinal de entrada:

| Indicador | Variável no Código | Peso Padrão (%) | Papel no Algoritmo |
| :--- | :--- | :---: | :--- |
| **Volume Surge** | `volumeSurgeWeight` | **15%** | Mede explosões repentinas de volume financeiro em relação à média móvel das últimas velas. |
| **Open Interest (OI)** | `openInterestWeight` | **20%** | Valida se há injeção de novo capital institucional abrindo posições na direção do movimento. |
| **Funding Rate** | `fundingRateWeight` | **10%** | Avalia o viés e a alavancagem do varejo (risco de short squeeze ou long flush). |
| **CVD Imbalance** | `cvdImbalanceWeight` | **20%** | Mede a dominância líquida das ordens a mercado de compra ou venda (Order Flow Delta). |
| **Fibonacci Golden Pocket** | `fibonacciZoneWeight` | **15%** | Determina o reteste da zona áurea de desconto/prêmio (0.618 - 0.68). |
| **Volume Profile POC/VAL/VAH** | `rangePocWeight` | **10%** | Identifica se o preço está em zonas de alta liquidez (POC) ou nos limites da área de valor (VAL/VAH). |
| **Estrutura & Suporte/Resistência** | `supportResistanceWeight` | **10%** | Confirma quebra de estrutura (BOS) e mitigação de Fair Value Gaps (FVG). |
| **SOMA TOTAL** | -- | **100%** | Matriz balanceada de calibração quantitativa. |

---

## 2. Perfis de Operação (Presets de Trading)

O bot disponibiliza 4 perfis operacionais pré-configurados ajustados para diferentes horizontes temporais e estilos de negociação:

```typescript
export const PROFILE_PRESETS = {
  scalp: {
    name: 'Scalp (Alta Frequência)',
    timeframeLabel: '1m - 5m',
    minConfluence: 58,        // Confluência Mínima Exigida (%)
    targetRiskRatio: 1.6,      // Relação Risco:Retorno Mínima (1:1.6)
    stopLossPct: 0.45,        // Stop Loss Base (%)
    candleStep: 1,             // Resolução de Análise
    description: 'Operações ultra rápidas buscando pequenos impulsos de volatilidade e desequilíbrios de CVD.'
  },
  daytrade: {
    name: 'Day Trade (Sessão Intraday)',
    timeframeLabel: '15m - 30m',
    minConfluence: 63,
    targetRiskRatio: 2.2,
    stopLossPct: 0.95,
    candleStep: 3,
    description: 'Operações intra-dia focadas em consolidações de Volume Profile, POC e rompimentos sustentados.'
  },
  intraday: {
    name: 'Intraday Estrutural',
    timeframeLabel: '30m - 1h',
    minConfluence: 68,
    targetRiskRatio: 3.0,
    stopLossPct: 1.60,
    candleStep: 6,
    description: 'Buscando reversão em Golden Pocket Fibonacci e absorção pesada em níveis de suporte e resistência.'
  },
  swing: {
    name: 'Swing Trade (Macro Tendência)',
    timeframeLabel: '4h - 1D',
    minConfluence: 74,
    targetRiskRatio: 4.2,
    stopLossPct: 3.20,
    candleStep: 15,
    description: 'Tendência primária de mercado com amplos alvos de retorno e filtros rígidos de Open Interest.'
  }
};
```

---

## 3. Algoritmo de Pontuação de Confluência (`ConfluenceScore`)

O algoritmo de confluência calcula separadamente a pontuação de alta ($\text{BullishPoints}$) e a pontuação de baixa ($\text{BearishPoints}$).

### Passo 1: Acúmulo de Pontos Direcionais

1. **Fibonacci Zone:**
   - Se `inGoldenPocket` e Preço na metade inferior $\implies \text{BullishPoints} += \text{fibonacciZoneWeight}$ (15 pts).
   - Se `inGoldenPocket` e Preço na metade superior $\implies \text{BearishPoints} += \text{fibonacciZoneWeight}$ (15 pts).

2. **Open Interest + Preço:**
   - Se $\Delta OI_{1h} > +1.5\%$ e Varição Preço 24h $> 0 \implies \text{BullishPoints} += \text{openInterestWeight}$ (20 pts).
   - Se $\Delta OI_{1h} > +1.5\%$ e Varição Preço 24h $< 0 \implies \text{BearishPoints} += \text{openInterestWeight}$ (20 pts).

3. **CVD Imbalance:**
   - Se `cvdDirection === 'BUY'` $\implies \text{BullishPoints} += \text{cvdImbalanceWeight}$ (20 pts).
   - Se `cvdDirection === 'SELL'` $\implies \text{BearishPoints} += \text{cvdImbalanceWeight}$ (20 pts).

4. **Volume Profile (POC, VAL, VAH):**
   - Se Preço próximo ao POC ($\le 0.5\%$ de distância):
     - Se `cvdDirection === 'BUY'` $\implies \text{BullishPoints} += \text{rangePocWeight}$ (10 pts).
     - Se `cvdDirection === 'SELL'` $\implies \text{BearishPoints} += \text{rangePocWeight}$ (10 pts).
   - Se Preço retestando VAL com variação entre $-0.5\%$ e $+0.3\% \implies \text{BullishPoints} += \text{rangePocWeight} \times 1.2$ (12 pts).
   - Se Preço rejeitando VAH com variação entre $-0.3\%$ e $+0.5\% \implies \text{BearishPoints} += \text{rangePocWeight} \times 1.2$ (12 pts).

5. **Funding Rate:**
   - Se $\text{FundingRate} < -0.02\% \implies \text{BullishPoints} += \text{fundingRateWeight}$ (10 pts) [Potencial Short Squeeze].
   - Se $\text{FundingRate} > +0.04\% \implies \text{BearishPoints} += \text{fundingRateWeight}$ (10 pts) [Risco Long Flush].

6. **Estrutura (BOS) e Fair Value Gap (FVG):**
   - Se `BOS === 'BULLISH'` $\implies \text{BullishPoints} += \text{supportResistanceWeight}$ (10 pts).
   - Se `BOS === 'BEARISH'` $\implies \text{BearishPoints} += \text{supportResistanceWeight}$ (10 pts).
   - Se houver Bullish FVG ativo na zona $\implies \text{BullishPoints} += 10$ pts extra.
   - Se houver Bearish FVG ativo na zona $\implies \text{BearishPoints} += 10$ pts extra.

---

### Passo 2: Cálculo da Pontuação Líquida e Normalização

$$\text{NetScore} = \text{BullishPoints} - \text{BearishPoints}$$

$$\text{ConfluenceScore (\%)} = \min\left(100, \, \text{round}\left( |\text{NetScore}| \times 1.2 + 25 \right)\right)$$

### Passo 3: Classificação do Sinal

- **STRONG LONG:** $\text{NetScore} \ge +55$ (Confluência Mínima de $\sim 91\%$).
- **LONG:** $+35 \le \text{NetScore} < +55$ (Confluência Mínima de $\sim 67\%$).
- **NEUTRAL:** $-35 < \text{NetScore} < +35$ (Sem viés direcional claro).
- **SHORT:** $-55 < \text{NetScore} \le -35$ (Confluência Mínima de $\sim 67\%$).
- **STRONG SHORT:** $\text{NetScore} \le -55$ (Confluência Mínima de $\sim 91\%$).
