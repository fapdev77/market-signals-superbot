# ⏳ Gestão Institucional de TTL, Alpha Half-Life & Multi-Estratégias

> Modelo matemático de decaimento temporal de sinal, regimes de volatilidade, preservação de capital e execução multi-estratégia concorrente do **Market Signals SuperBot**.

---

## 📑 Sumário

1. [O Conceito de Alpha Half-Life em Trading Quantitativo](#1-o-conceito-de-alpha-half-life-em-trading-quantitativo)
2. [Tabela de TTLs Padrão por Estratégia](#2-tabela-de-ttls-padrão-por-estratégia)
3. [Regimes de Volatilidade & Multiplicador de Fine-Tuning](#3-regimes-de-volatilidade--multiplicador-de-fine-tuning)
4. [Invalidação Técnica Antecipada (Adverse Move Invalidation)](#4-invalidação-técnica-antecipada-adverse-move-invalidation)
5. [Mecanismo Automático de Breakeven no Alvo 1](#5-mecanismo-automático-de-breakeven-no-alvo-1)
6. [Motor Multi-Estratégia Concorrente](#6-motor-multi-estratégia-concorrente)
7. [Interface Visual & Gauges de Decaimento de Alpha](#7-interface-visual--gauges-de-decaimento-de-alpha)

---

## 1. O Conceito de Alpha Half-Life em Trading Quantitativo

No mercado financeiro institucional (grandes fundos quantitativos e mesas proprietárias), toda vantagem estatística (*Alpha*) possui uma **meia-vida temporal** (*Alpha Half-Life*). 

Um setup de trade de rompimento ou retração em Order Block possui valor preditivo elevado nos primeiros minutos após a sua identificação. Se o preço não atingir a zona de entrada ou não disparar o movimento esperado dentro da janela temporal ótima:
* A liquidez do book se reorganiza;
* Novos participantes institucionais inserem ou removem ordens passivas;
* O fluxo original de Cumulative Volume Delta (CVD) se dissipa;
* A probabilidade matemática de acerto cai exponencialmente, transformando uma ordem válida em uma armadilha de liquidez.

Para mitigar esse risco, o **Market Signals SuperBot** implementa o **Time-To-Live (TTL)** algorítmico ativo: sinais não preenchidos ou que excedem sua vida útil máxima são invalidados e descartados automaticamente.

---

## 2. Tabela de TTLs Padrão por Estratégia

Cada categoria operacional possui uma janela estatística de sobrevivência calculada em função do seu timeframe de análise:

| Categoria | Timeframe Base | TTL Padrão (Minutos) | Formato Legível | Justificativa Quantitativa |
| :--- | :---: | :---: | :---: | :--- |
| **⚡ Scalp** | `5m` | **25 min** | 25 min (5 candles de 5m) | Variações rápidas de micro-book; se o impulso não ocorrer em 5 velas, a micro-estrutura foi invalidada. |
| **🎯 Day Trade** | `15m` | **90 min** | 1h 30m (6 candles de 15m) | Janela intradiária de sessão para testar POC e níveis de desequilíbrio de CVD. |
| **⏱️ Intraday** | `30m` | **240 min** | 4h 00m (8 candles de 30m) | Reteste em Golden Pocket Fibonacci e absorção de liquidez institucional. |
| **📈 Swing Trade** | `1h / 4h` | **1.440 min** | 24h (1 dia) | Expansão de tendência e captura de desequilíbrios em áreas de valor macro. |
| **🌐 Position Trade** | `4h / 1d` | **4.320 min** | 72h (3 dias) | Ciclos amplos de liquidez e alinhamento de grandes players. |
| **🔄 Contra-Trade / TTI** | `15m` | **60 min** | 1h 00m | Operações contra a tendência primária em exaustão de funding; exigem reversão imediata. |

---

## 3. Regimes de Volatilidade & Multiplicador de Fine-Tuning

O mercado oscila entre períodos de consolidação monótona e períodos de alta volatilidade provocados por notícias macroeconômicas (CPI, FOMC, relatórios de emprego). Para calibrar o tempo de vida dos sinais a essas condições, o sistema oferece **4 Regimes de Mercado** acoplados a um **Multiplicador Contínuo de Fine-Tuning**:

$$\text{TTL Efetivo} = \text{TTL Base} \times \text{Multiplicador de Regime}$$

```typescript
export const REGIME_PRESETS = {
  CALM: {
    multiplier: 1.5,
    label: 'Mercado Calmo (Baixa Volatilidade)',
    description: 'Fluxo ordenado e consolidações lentas. Sinais recebem 50% a mais de tempo (1.5x) para testar POIs sem expirar prematuramente.'
  },
  NORMAL: {
    multiplier: 1.0,
    label: 'Mercado Padrão (Volatilidade Neutra)',
    description: 'Condições típicas de liquidez e spread nos derivativos. TTL base ideal (1.0x).'
  },
  VOLATILE: {
    multiplier: 0.6,
    label: 'Mercado Agitado (Alta Volatilidade)',
    description: 'Dias de notícias e rallies agressivos. Sinais expiram 40% mais rápido (0.6x) para evitar armadilhas de reversão.'
  },
  EXTREME: {
    multiplier: 0.4,
    label: 'Volatilidade Extrema (Eventos Macro / CPI)',
    description: 'FOMC, CPI ou cascatas de liquidação. Janela ultra-curta (0.4x) para máxima conservação de capital institucional.'
  }
};
```

### Slider de Fine-Tuning Manual
Na aba **Ajustes de Estratégia**, o operador pode ajustar o multiplicador de forma contínua entre `0.2x` e `3.0x`, adaptando a agressividade do bot em tempo real sem necessidade de reiniciar a aplicação.

---

## 4. Invalidação Técnica Antecipada (Adverse Move Invalidation)

Além do decaimento por tempo (TTL cronológico), o motor monitora a distância percentual do preço em relação à zona de entrada:

* **Para sinais de COMPRA (LONG):**
  Se o preço cair mais do que o percentual limite (padrão: `1.2%`) abaixo da mínima da zona de entrada antes de preencher a ordem, o setup é marcado como `EXPIRED` com o motivo:
  $$\text{Preço} < \text{EntryLow} \times \left(1 - \frac{\text{AdversePct}}{100}\right) \implies \text{Invalidação Técnica Antecipada}$$
* **Para sinais de VENDA (SHORT):**
  Se o preço subir mais do que o percentual limite (padrão: `1.2%`) acima da máxima da zona de entrada antes do preenchimento:
  $$\text{Preço} > \text{EntryHigh} \times \left(1 + \frac{\text{AdversePct}}{100}\right) \implies \text{Invalidação Técnica Antecipada}$$

Isso impede que o robô tente comprar uma faca caindo (*falling knife*) quando o suporte já foi rompido com agressão institucional vendedora antes mesmo da ordem limite ser executada.

---

## 5. Mecanismo Automático de Breakeven no Alvo 1

Uma das práticas fundamentais de gerenciamento de risco institucional é a **eliminação do risco da carteira** assim que a primeira meta de lucro é atingida:

```
[Entrada Executada] ───► [Preço Atinge Alvo 1] ───► [Ação Automática]:
                                                       1. Realização Parcial de 50%
                                                       2. Stop Loss movido para o Preço de Entrada
                                                       3. Status alterado para RISCO ZERO (0.00%)
```

1. **Garantia de Lucro:** Ao tocar no **Alvo 1**, 50% da posição é liquidada com lucro.
2. **Blindagem do Capital Residual:** O Stop Loss restante é movido imediatamente para o nível de entrada (`entryZone`).
3. **Se o mercado reverter:** A posição é encerrada no preço de entrada sem qualquer prejuízo financeiro (`0.00% RISCO`).
4. **Se o mercado continuar:** A posição captura a expansão máxima de lucros até o **Alvo 2**.

---

## 6. Motor Multi-Estratégia Concorrente

O **Market Signals SuperBot** não limita cada ativo a um único sinal genérico. O motor avalia simultaneamente em paralelo todas as estratégias habilitadas para o mesmo par:

```
                  ┌──► SCALP (5m) ─────────► Sinal Independente (TTL 25m)
                  ├──► DAY TRADE (15m) ────► Sinal Independente (TTL 90m)
Ativo (ex: SOL) ──┼──► INTRADAY (30m) ─────► Sinal Independente (TTL 240m)
                  ├──► SWING (1h) ─────────► Sinal Independente (TTL 24h)
                  └──► POSITION (4h) ──────► Sinal Independente (TTL 72h)
```

Cada sinal opera com seu próprio:
* Stop Loss e Alvos proporcionais à volatilidade do seu timeframe;
* Score de confluência independente;
* Contador de TTL e barra de decaimento de alpha específicos.

---

## 7. Interface Visual & Gauges de Decaimento de Alpha

Na **Matriz de Sinais**, cada oportunidade exibe:

* **Contagem Regressiva ao Vivo:** Atualização segundo a segundo do tempo restante (`⏳ 18m 42s restando`).
* **Barra de Progresso Gradiente:**
  * 🟢 **Verde (> 50% Alpha):** Janela ideal de entrada de alta probabilidade.
  * 🟠 **Âmbar (20% a 50% Alpha):** Meia-vida avançada; monitorar com cautela.
  * 🔴 **Vermelho Pulsante (< 20% Alpha):** Alerta de expiração iminente.
  * ⚫ **Cinza (Expirado):** Sinal encerrado e arquivado para auditoria.
* **Badge de Breakeven Protegido:** Identificação visual destacada em ciano `🛡️ BREAKEVEN ATIVO (0.00% RISCO)` em todas as posições blindadas.
