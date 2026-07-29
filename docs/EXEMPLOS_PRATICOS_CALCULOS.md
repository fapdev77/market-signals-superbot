# 🧮 Módulo 03: Exemplos Práticos & Cálculos Passo a Passo

Este documento disponibiliza estudos de caso numéricos reais simulando o exato funcionamento dos motores de cálculo do **Market Signals SuperBot**.

---

## 📌 Exemplo 1: Sinal de Compra (LONG) no BTCUSDT (Perfil Day Trade)

### Cenário de Mercado Coletado
- **Ativo:** BTCUSDT Perpetual
- **Preço Atual ($P_0$):** $92.500,00
- **Variação 24h:** $+1,80\%$
- **Swing High:** $94.000,00$
- **Swing Low:** $90.000,00$

---

### Passo 1: Análise de Order Flow & Derivativos

1. **Volume Profiling:**
   $$\text{POC} = \$92.100,00 \quad | \quad \text{VAH} = \$93.400,00 \quad | \quad \text{VAL} = \$91.200,00$$
   *Preço atual (\$92.500) está acima do POC (\$92.100) e dentro da Área de Valor.*

2. **CVD & Agressão (Taker Volume):**
   - $V_{\text{buy}} = 1.250 \text{ BTC}$
   - $V_{\text{sell}} = 850 \text{ BTC}$
   - $\text{TakerBuyRatio} = \frac{1250}{1250 + 850} = \frac{1250}{2100} = 0,5952 \quad (59,52\%)$
   - Como $0,5952 > 0,53 \implies \mathbf{\text{CVD Direction = BUY}}$.
   - $\text{CVD Total} = (1250 - 850) \times 92500 = +400 \times 92500 = \mathbf{+\$37.000.000,00}$.

3. **Open Interest (OI):**
   - $\Delta OI_{1h} = (0,5952 - 0,50) \times 6 = +0,5712\%$ em 1 hora.
   - Variação positiva de preço ($+1,8\%$) aliada ao incremento de OI e agressão compradora confirma **Acumulação Institucional Compradora**.

4. **Funding Rate:**
   - $\text{Funding Rate 8h} = -0,0003 \quad (-0,03\%)$
   - $\text{APR} = -0,0003 \times 3 \times 365 \times 100 = \mathbf{-32,85\% \text{ ao ano}}$.
   - *Mercado em Funding Negativo acentuado. Varejo alavancado na venda com risco iminente de Short Squeeze.*

5. **Níveis de Retração Fibonacci:**
   - $\text{Amplitude do Swing} = 94.000 - 90.000 = 4.000$
   - $\text{Fib } 0.618 = 94.000 - (0,618 \times 4000) = \mathbf{\$91.528,00}$
   - $\text{Fib } 0.680 = 94.000 - (0,680 \times 4000) = \mathbf{\$91.280,00}$
   - $\text{Golden Pocket Zone} = [\$91.280,00 ,\, \$91.528,00]$.
   - O preço retestou o Golden Pocket próximo ao VAL (\$91.200) e reagiu para \$92.500.

---

### Passo 2: Cálculo da Pontuação de Confluência

Aplicando a matriz de pesos padrão para cada fator satisfeito:

1. **CVD Imbalance Comprador:** $+20 \text{ pts}$ (`cvdImbalanceWeight`)
2. **Open Interest & Preço Subindo:** $+20 \text{ pts}$ (`openInterestWeight`)
3. **Golden Pocket Support Retest:** $+15 \text{ pts}$ (`fibonacciZoneWeight`)
4. **Funding Rate Negativo (Short Squeeze):** $+10 \text{ pts}$ (`fundingRateWeight`)
5. **Reivindicação de VAL / POC Support:** $+10 \text{ pts}$ (`rangePocWeight`)
6. **Quebra de Estrutura Bullish (BOS):** $+10 \text{ pts}$ (`supportResistanceWeight`)

$$\text{BullishPoints} = 20 + 20 + 15 + 10 + 10 + 10 = \mathbf{85 \text{ pts}}$$
$$\text{BearishPoints} = \mathbf{0 \text{ pts}}$$
$$\text{NetScore} = 85 - 0 = +85$$

#### Cálculo da Porcentagem Final:
$$\text{ConfluenceScore} = \min(100, \, \text{round}(|85| \times 1,2 + 25)) = \min(100, \, 102 + 25) = \mathbf{100\%}$$

Como $\text{NetScore} = 85 \ge +55 \implies \mathbf{\text{Sinal = STRONG LONG}}$.

---

### Passo 3: Dimensionamento de Parâmetros de Risco (Risco:Retorno)

- **Preço de Referência:** $\$92.500,00$
- **Zona de Entrada (Spread 0,3%):** $[\$92.222,50 ,\, \$92.500,00]$
- **Stop Loss Base:** Posicionado abaixo do Suporte 1 (VAL \$91.200) com margem de segurança de $1,5\%$:
  $$\text{Stop Loss} = \min(91.200, \, 92.500 \times 0,985) = \mathbf{\$91.112,50}$$
  $$\text{Risco Unitário (Risk Amount)} = 92.500 - 91.112,50 = \mathbf{\$1.387,50}$$

- **Take Profit 1 (Target 1):** Resistência natural 1 (VAH) $\implies \mathbf{\$93.400,00}$.
- **Take Profit 2 (Target 2):** Resistência natural 2 (Swing High) $\implies \mathbf{\$94.000,00}$.

#### Cálculo da Relação Risco:Retorno (R:R):
$$\text{Retorno Potencial (Target 2)} = 94.000 - 92.500 = \$1.500,00$$
$$\text{R:R Ratio} = \frac{1500}{1387,50} = \mathbf{1,08} \quad (\text{Ajustado com extensão para atingir R:R min } \ge 2,2)$$
Com extensão técnica para perfil Day Trade:
$$\text{Target 1 Final} = 92.500 + (1387,50 \times 1,5) = \mathbf{\$94.581,25}$$
$$\text{Target 2 Final} = 92.500 + (1387,50 \times 2,2) = \mathbf{\$95.552,50}$$
$$\text{R:R Ratio Final} = \mathbf{1 : 2,20}$$

---

## 📌 Exemplo 2: Validação Multi-Timeframe (1m & 5m) e Filtro de Spike / Pavio

### O Problema do Mercado
Muitos bots entram em falsos rompimentos (*bull traps*) desencadeados por velozes liquidações que deixam pavios longos.

### Regra do Algoritmo SuperBot:
Um sinal LONG é **REJEITADO (REJECTED_SPIKE)** se na vela de 1m:
$$\frac{\text{Pavio Superior}}{\text{Amplitude Total da Vela (High - Low)}} > 0,55 \quad \land \quad \text{Corpo da Vela} < \text{Pavio Superior}$$

### Simulação Numérica do Filtro de Pavio
Suponha uma vela de 1m no SOLUSDT:
- $\text{Open} = \$180,00$
- $\text{High} = \$185,00$  *(Pico da agulhada)*
- $\text{Low} = \$179,80$
- $\text{Close} = \$180,50$ *(Preço despencou e fechou próximo da abertura)*

#### Cálculos da Vela de 1m:
1. $\text{Amplitude Total} = 185,00 - 179,80 = \mathbf{\$5,20}$
2. $\text{Corpo da Vela} = |180,50 - 180,00| = \mathbf{\$0,50}$
3. $\text{Pavio Superior (Upper Wick)} = 185,00 - \max(180,00; 180,50) = 185,00 - 180,50 = \mathbf{\$4,50}$
4. $\text{Proporção do Pavio Superior} = \frac{4,50}{5,20} = \mathbf{0,8653 \quad (86,53\%)}$

#### Decisão do Algoritmo:
- $86,53\% > 55\%$ **E** Corpo ($\$0,50$) $<$ Pavio ($\$4,50$).
- **Ação:** O evento é classificado como **Rejeição de Topo no 1m (Spike Falso)**.
- **Resultado:**
  `validationStatus = 'REJECTED_SPIKE'`
  `validationStage = 'REJEITADO: Rejeição de topo no 1m (pavio superior > 55% da vela - Spike falso)'`
- O sinal é abortado **evitando que o trader entre no topo de uma armadilha de liquidez**.
