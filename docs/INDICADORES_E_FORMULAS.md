# 📐 Módulo 01: Indicadores Quantitativos & Fórmulas Matemáticas

Este documento apresenta a especificação matemática detalhada e a interpretação institucional de cada indicador utilizado pelo **Market Signals SuperBot**.

---

## 1. Cumulative Volume Delta (CVD) & Taker Buy Ratio

### O que é?
O **CVD (Cumulative Volume Delta)** mede o saldo acumulado da pressão de compra versus venda executada via **Ordens a Mercado (Taker Orders)**. Diferente do volume financeiro tradicional (que apenas indica atividade), o CVD revela quem está agredindo o livro de ofertas.

### Fórmulas Matemáticas

#### Volume Taker Comprador e Vendedor por Candle $i$:
$$V_{\text{buy}, i} = \text{takerBuyVolume}_i$$
$$V_{\text{sell}, i} = \max\left(0, \text{volume}_i - \text{takerBuyVolume}_i\right)$$

#### Taker Buy Ratio (Razão de Agressão Compradora):
$$\text{TakerBuyRatio} = \frac{\sum_{i=1}^{N} V_{\text{buy}, i}}{\sum_{i=1}^{N} V_{\text{buy}, i} + \sum_{i=1}^{N} V_{\text{sell}, i}}$$

#### CVD Total Financeiro ($):
$$\text{CVD} = \left( \sum_{i=1}^{N} V_{\text{buy}, i} - \sum_{i=1}^{N} V_{\text{sell}, i} \right) \times \text{Preço Atual}$$

### Classificação Direcionável
- **BUY (Pressão Compradora Forte):** $\text{TakerBuyRatio} > 0.53$ ($> 53\%$ das agressões são de compra).
- **SELL (Pressão Vendedora Forte):** $\text{TakerBuyRatio} < 0.47$ ($> 53\%$ das agressões são de venda).
- **NEUTRAL (Equilíbrio):** $0.47 \le \text{TakerBuyRatio} \le 0.53$.

### Aplicação Prática no Trading
- **Divergência de Absorção (Bullish Absorption):** O preço faz um fundo menor, porém o CVD faz um fundo maior. Significa que vendedores a mercado estão vendendo pesado em cima de ordens limítrofes passivas de compra institucionais.
- **Sinal de Continuação:** CVD de alta alinhado com rompimento de alta confirma que o movimento é impulsivo e saudável.

---

## 2. Open Interest (OI) e Variação Percentual

### O que é?
O **Open Interest (Interesse Aberto)** representa o número total de contratos futuros derivativos em aberto (comprados e vendidos) que não foram liquidados ou fechados.

### Fórmulas Matemáticas de Estimativa e Variação

#### Estimativa de Variação de Open Interest em 1 hora ($\Delta OI_{1h}$):
$$\Delta OI_{1h} = (\text{TakerBuyRatio} - 0.50) \times 6$$

#### Estimativa de Variação de Open Interest em 24 horas ($\Delta OI_{24h}$):
$$\Delta OI_{24h} = (\Delta \%_{\text{Preço } 24h} \times 0.8) + \left( (\text{TakerBuyRatio} - 0.50) \times 10 \right)$$

### Matriz de Interpretação Institucional de OI

| Preço | Open Interest (OI) | Interpretação de Mercado | Ação do Bot |
| :---: | :---: | :--- | :--- |
| ⬆️ Sobe | ⬆️ Sobe ($> +1.5\%$) | **Acumulação Long Ativa:** Institucionais abrindo posições compradas no fluxo. | Favorável para **LONG** |
| ⬇️ Cai | ⬆️ Sobe ($> +1.5\%$) | **Construção de Short:** Posições vendidas alavancadas entrando no mercado. | Favorável para **SHORT** |
| ⬆️ Sobe | ⬇️ Cai | **Short Squeeze / Cobertura:** Compradores não estão entrando; vendidos estão sendo stopados/fechando. | Cuidado (Falsa Alta) |
| ⬇️ Cai | ⬇️ Cai | **Desalavancagem / De-risking:** Fechamento genérico de posições. | Padrão Neutro |

---

## 3. Taxa de Financiamento (Funding Rate) & Taxa Anualizada (APR)

### O que é?
O **Funding Rate** é o pagamento periódico entre traders comprados (longs) e vendidos (shorts) em contratos futuros perpétuos para alinhar o preço do contrato futuro ao preço à vista (*index spot price*).

### Fórmulas Matemáticas

#### Funding Rate Anualizado ($\text{APR}$):
Assumindo pagamentos a cada 8 horas (3 vezes ao dia):
$$\text{APR (\%)} = \text{FundingRate}_{\text{8h}} \times 3 \times 365 \times 100$$

### Gatilhos Operacionais
- **Negative Funding Squeeze Zone ($\text{FundingRate} < -0.02\%$ ou $\text{APR} < -21.9\%$):**
  A maioria do varejo está alavancada na venda (*short heavy*). Alta probabilidade de um **Short Squeeze** impulsionar o preço para cima para liquidar posições vendidas.
- **Overheated Long Zone ($\text{FundingRate} > +0.04\%$ ou $\text{APR} > +43.8\%$):**
  Mercado excessivamente otimista e tomado em alavancagem compradora. Elevado risco de **Long Flush / Cascade Liquidation**.

---

## 4. Volume Profile (VAL, VAH e POC)

### O que é?
O **Volume Profile** mapeia a distribuição de volume negociado por **nível de preço** em um determinado período de tempo (janela de análise de $N$ velas).

### Fórmulas Matemáticas

Dado um conjunto de $M$ faixas (*price bins*) de preço no intervalo $[\text{Preço}_{\text{mín}}, \text{Preço}_{\text{máx}}]$:

1. **POC (Point of Control):** O nível de preço exato onde ocorreu a maior concentração de volume financeiro negociado:
   $$\text{POC} = \arg\max_{p} \left( V_p \right)$$

2. **Value Area (Área de Valor - 70%):** A faixa de preços ao redor do POC que contém 70% de todo o volume acumulado da janela:
   $$\sum_{p \in \text{ValueArea}} V_p \approx 0.70 \times V_{\text{total}}$$

3. **VAH (Value Area High):** O limite superior do preço dentro da Área de Valor.
4. **VAL (Value Area Low):** O limite inferior do preço dentro da Área de Valor.

### Comportamento Tático
- **Reivindicação de VAL (Liquidity Sweep):** Quando o preço cai abaixo de VAL, liquida stops de varejo e fecha a vela acima de VAL, configurando compra institucional.
- **Rejeição em VAH:** Rejeição do preço no topo da área de valor com queda de volume comprador indica resistência pesada de oferta.

---

## 5. Golden Pocket Fibonacci (0.618 - 0.68)

### O que é?
O **Golden Pocket** é a zona de retração Fibonacci compreendida entre os níveis **0.618 (61.8%)** e **0.68 (68%)** da perna de tendência anterior (Swing High a Swing Low).

### Fórmulas Matemáticas

Dado o topo do movimento ($\text{SwingHigh}$) e o fundo do movimento ($\text{SwingLow}$):

$$\text{Amplitude do Swing} = \text{SwingHigh} - \text{SwingLow}$$

$$\text{Fib } 0.50 = \text{SwingHigh} - (0.50 \times \text{Amplitude do Swing})$$
$$\text{Fib } 0.618 = \text{SwingHigh} - (0.618 \times \text{Amplitude do Swing})$$
$$\text{Fib } 0.680 = \text{SwingHigh} - (0.680 \times \text{Amplitude do Swing})$$

$$\text{Golden Pocket Zone} = \left[ \text{Fib } 0.680 ,\, \text{Fib } 0.618 \right]$$

### Critério de Confluência
O bot identifica se o preço atual está dentro da faixa do Golden Pocket:
$$\text{inGoldenPocket} = (\text{Preço} \ge \text{Fib } 0.680) \land (\text{Preço} \le \text{Fib } 0.618)$$

Se o preço está na metade inferior do Swing, é computado como **Suporte Bullish**; se está na metade superior, como **Resistência Bearish**.

---

## 6. Quebra de Estrutura (BOS) e Fair Value Gap (FVG)

### Quebra de Estrutura de Mercado (Break of Structure - BOS)
- **BOS Bullish:** Ocorre quando o preço de fechamento da vela $t$ supera a máxima da vela $t-1$ ($\text{Close}_t > \text{High}_{t-1}$) com confirmação de agressão compradora ($\text{TakerBuyRatio} > 0.54$).
- **BOS Bearish:** Ocorre quando o fechamento da vela $t$ quebra a mínima da vela $t-1$ ($\text{Close}_t < \text{Low}_{t-1}$) com agressão vendedora ($\text{TakerBuyRatio} < 0.46$).

### Fair Value Gap (FVG) / Desequilíbrio de Ineficiência
Inspeciona uma sequência de 3 velas consecutivas ($t-2$, $t-1$, $t$):

- **Bullish FVG (Ineficiência de Compra):**
  $$\text{Low}_t > \text{High}_{t-2}$$
  Faixa do Gap: $[\text{High}_{t-2}, \, \text{Low}_t]$.
  Indica que os compradores moveram o preço tão rápido que não houve tempo para vendedores atuarem. Funciona como um **ímã de liquidez/suporte futuro**.

- **Bearish FVG (Ineficiência de Venda):**
  $$\text{High}_t < \text{Low}_{t-2}$$
  Faixa do Gap: $[\text{Low}_t, \, \text{High}_{t-2}]$.
  Funciona como **ímã/resistência futura**.
