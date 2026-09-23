# 🚀 Módulo 05: Guia Operacional das Funcionalidades & Arquitetura de Interface

Este documento apresenta a arquitetura visual, os componentes de alta prioridade do dashboard e as funcionalidades interativas adicionadas ao **Market Signals SuperBot**.

---

## 1. Banner de Alerta "OPORTUNIDADE PRIME" (`PrimeOpportunityBanner.tsx`)

### O que é?
O banner **OPORTUNIDADE PRIME** é o componente de destaque no topo da interface que monitora continuamente todos os ativos rastreados pela Binance em busca do melhor setup em **Zona Áurea de Fibonacci (Golden Pocket 0.618 - 0.68)** com confluência de Order Flow e fluxo comprador/vendedor positivo.

### Principais Características
1. **Animação de Entrada e Atenção (`.animate-prime-banner-entrance`)**:
   - Transição fluida de slide-down com fade-in e brilho dourado (`@keyframes primeAlertEntrance`).
   - Remontagem com execução de animação a cada novo ticker detectado via `key={ticker.symbol}`.
   - Pulsação suave contínua da borda dourada (`primeGlowPulse`) para reter a atenção do operador sem poluição visual.

2. **Mini Sparkline D3 & Gráfico de Desfechos Recentes (`GoldenPocketSparkline.tsx` & `GoldenPocketOutcomesChart.tsx`)**:
   - Miniatura de sparkline com curva de taxa de acerto histórica no Golden Pocket.
   - Ao passar o mouse, abre popover com **Gráfico de Barras D3.js** com eixo zero centralizado, barras verdes (+PnL) e vermelhas (-PnL), e inspetor de hover para cada trade executado.

3. **Estado Expansível ("Métricas Avançadas")**:
   Ao clicar em **"Métricas Avançadas"**, o banner revela sem sair da tela:
   - **Order Book Imbalance Ratio:**
     $$\text{Imbalance Ratio} = \frac{\text{Taker Buy Ratio}}{1 - \text{Taker Buy Ratio}}$$
     Exibe proporção numérica (ex.: `1.45:1 Comprador`), barra colorida Bids vs Asks e classificação qualitativa (`FORTE DESEQUILÍBRIO`, `DESEQUILÍBRIO MODERADO`, `LIVRO EQUILIBRADO`).
   - **Tendência de Funding Rate & Risco de Alavancagem:**
     Taxa do ciclo de 8h, projeção diária, APR anualizado e alarme situacional (`SHORT SQUEEZE POTENTIAL`, `OVERLEVERAGED LONGS`, `TAXA ESTÁVEL`).
   - **Cumulative Volume Delta (CVD) & Open Interest:**
     Delta financeiro da vela em andamento e variação de contratos abertos em 1 hora.

4. **Controle Manual do Threshold de Confluência (Filtro de Ruído)**:
   - Permite que o trader aumente o corte mínimo de confluência (de `60%` para `70%`, `75%` ou `80%`) diretamente no banner.
   - **Persistência em `localStorage` (`prime_confluence_threshold`):** Suas preferências são salvas automaticamente no navegador para a sessão de trabalho.
   - **Estado Vazio Inteligente:** Se nenhum ativo atender ao critério elevado, o banner preserva a altura fixa de 88px (evitando *layout shift*) e fornece atalhos rápidos para reajustar o corte.

---

## 2. Matriz de Correlação de Mercado (`MarketCorrelationMatrix.tsx`)

### O que é?
Posicionada logo abaixo do banner de oportunidade, a **Matriz de Correlação** avalia se o movimento do ativo em destaque é um movimento isolado ou se faz parte de uma injeção de liquidez macro/setorial (*Market Breadth*).

### Algoritmo Multidimensional de Correlação
Para cada ativo monitorado, calcula-se a concordância vetorial com o ativo prime:
- **Direção de Preço 24h (35% peso):** Valida se o mercado geral está subindo ou caindo em conjunto.
- **Fluxo CVD Taker (25% peso):** Compara se as agressões a mercado estão no mesmo sentido.
- **Variação de Open Interest (20% peso):** Detecta se novos contratos futuros estão sendo abertos ou fechados.
- **Proximidade de Confluência (20% peso):** Grau de robustez técnica similar.

### Métricas e Interpretação
- **Amplitude Setorial (% Co-alinhados):**
  - **$\ge 65\%$ Co-alinhados:** Classificado como **"MOVIMENTO SETORIAL CONFIRMADO"** (menor risco de armadilhas/fakeouts).
  - **$< 65\%$ Co-alinhados:** Classificado como **"FLUXO ISOLADO / DIVERGENTE"** (trade idiossincrático, risco de absorção).
- **Categorização Setorial Automática:**
  - *Layer 1 / Large Cap* (BTC, ETH, SOL, BNB, AVAX)
  - *L1/L2 High-Beta* (NEAR, SUI, APT, ARB, OP)
  - *DeFi & Oracles* (LINK, UNI, AAVE, MKR)
  - *Memecoins / High Volatility* (DOGE, PEPE, SHIB, WIF)
  - *AI & Compute* (RENDER, FET, TAO)
- **Ações Rápidas:** Filtros para isolar ativos co-alinhados ou divergentes, e clique em qualquer tile para carregar instantaneamente o gráfico técnico e livro de ofertas do par selecionado.

---

## 3. Mapa de Liquidez & Heatmap de Ordens (`LiquidityHeatmapOverlay.tsx`)

Mapeia agrupamentos de liquidez institucional e zonas de liquidação de futuros com base em desvios do preço médio ponderado (VWAP) e faixas do livro de ofertas, auxiliando na definição de alvos de Take Profit e pontos de proteção de Stop Loss.

---

## 4. Auditoria de IA Multimodelo (`AIModelsConfigDashboard.tsx`)

Permite alternar e comparar dinamicamente múltiplos modelos de inteligência artificial do Google Gemini:
- **Gemini 3.6 Flash:** Otimizado para baixa latência, auditoria de scalping e geração de pareceres táticos em sub-segundo.
- **Gemini 3.5 Flash:** Modelo de alta estabilidade e balanceamento analítico.
- Configuração de temperatura, top-p, cotas de requisição e persistência das calibrações no servidor Node.js/Express.

---

## 5. Sistema de Alarmes de Preço do Usuário (`PriceAlertManager.tsx`)

### O que é?
Integrado diretamente à barra de ferramentas do gráfico (`ChartAndProfile.tsx`), o **Sistema de Alarmes de Preço** permite que o trader defina níveis-alvo customizados para qualquer criptoativo monitorado, com verificação contínua contra o fluxo de cotações em tempo real da Binance.

### Principais Recursos
1. **Disparo Imediato via Web Audio & Desktop Notifications:**
   - Quando a cotação cruza a meta (`CROSS_ABOVE` ou `CROSS_BELOW`), a plataforma toca um sinal sonoro sintetizado em HTML5 Web Audio (`playSignalTone`) e dispara uma **notificação na Área de Trabalho do sistema operacional** com o preço exato, variação percentual e notas do operador.
2. **Atalhos Rápidos Inteligentes:**
   - Preenchimento em um clique com os níveis técnicos calculados do ativo: **Golden Pocket 0.618**, **Golden Pocket 0.68**, **POC do Volume Profile**, **+1.5%** ou **-1.5%**.
3. **Traçado Direto no Gráfico (ReferenceLines Recharts):**
   - Alarmes ativos são renderizados como linhas pontilhadas douradas dinâmicas (`🔔 Alarme: $XX,XXX.XX`) tanto no gráfico de área linear quanto no gráfico de velas japonesas (*Candlesticks*).
4. **Persistência Completa via `localStorage`:**
   - Todos os alarmes, status de disparo (`DISPARADO`), histórico de notas e permissões persistem na máquina do usuário sob a chave `superbot_user_price_alerts`.

---

## 6. Menu de Configuração de Perfis de Áudio & Volume (`AlertSoundSettingsMenu.tsx`)

### O que é?
Integrado ao lado do gestor de alarmes no `ChartAndProfile.tsx`, este menu permite customizar a experiência sonora das notificações de preço geradas pelo Web Audio API, eliminando sons irritantes e adaptando os tons à preferência do trader.

### Perfis Sonoros Disponíveis
1. **Synth Chime (Padrão):** Acorde clássico senoidal ascendente (LONG) e descendente (SHORT).
2. **Radar Beep (Tático / Bloomberg):** Pulsos duplos de onda quadrada estilo radar militar em alta frequência.
3. **Crystal Bell (Harmônico):** Sino cristalino de 3 harmônicos (C6, E5, A5) com decaimento suave.
4. **Cyber Pulse (Sci-Fi / Synthwave):** Varredura de frequência em onda dente-de-serra (*sawtooth*) com filtro ressonante.
5. **Zen Gong (Acústico / Calmo):** Ressonância profunda de triângulo acústico e sub-graves sem estresse sensorial.

### Controles & Recursos
- **Controle de Volume Linear (0% a 100%):** Ajuste fino de ganho analógico com rampa exponencial suave contra *clicks* e ruídos transitórios de áudio.
- **Botão Liga/Desliga Rápido (Mudo):** Silenciamento instantâneo com preservação do volume configurado.
- **Prévia de Áudio Integrada:** Botões para testar qualquer perfil antes de salvar e simular cenários de alta (`LONG`), baixa (`SHORT`) ou alerta geral (`ALERT`).
- **Persistência via `localStorage` (`superbot_alert_audio_config`):** Mantém o perfil, o volume e o status ativo salvos no navegador do usuário.

---

## 7. Simulador de Posição & Calculadora de PnL / ROI (`PositionSizerCalculator.tsx`)

### O que é?
Incorporado dentro da visualização técnica (`ChartAndProfile.tsx`), o **Position Sizer & PnL Calculator** simula cenários de risco financeiro, tamanho nocional de contratos e projeções hipotéticas de ROI (Retorno sobre o Investimento) e PnL (Lucro e Prejuízo em USD) utilizando diretamente as zonas de entrada, Stop Loss e Take Profits do sinal selecionado (ou da auditoria do agente de IA).

### Fórmulas Matemáticas de Dimensionamento

1. **Modo Margem Fixa ($):**
   $$\text{Nocional} = \text{Margem} \times \text{Alavancagem}$$
   $$\text{Contratos} = \frac{\text{Nocional}}{\text{Preço de Entrada}}$$
   $$\text{Risco Máximo (\$) } = \text{Nocional} \times \frac{|\text{Entrada} - \text{Stop Loss}|}{\text{Entrada}}$$

2. **Modo Risco Baseado em % da Conta (Risk-Based Sizing):**
   $$\text{Risco Máximo (\$) } = \text{Patrimônio} \times \frac{\% \text{ Risco}}{100}$$
   $$\text{Nocional Necessário} = \frac{\text{Risco Máximo (\$) }}{\frac{|\text{Entrada} - \text{Stop Loss}|}{\text{Entrada}}}$$
   $$\text{Margem Necessária} = \frac{\text{Nocional Necessário}}{\text{Alavancagem}}$$

3. **ROI Projetado nos Alvos (Alvo 1 Scalp & Alvo 2 Swing):**
   $$\Delta \%_{\text{Preço}} = \begin{cases} \frac{\text{Alvo} - \text{Entrada}}{\text{Entrada}} \times 100, & \text{se LONG} \\ \frac{\text{Entrada} - \text{Alvo}}{\text{Entrada}} \times 100, & \text{se SHORT} \end{cases}$$
   $$\text{PnL (\$) } = \text{Nocional} \times \frac{\Delta \%_{\text{Preço}}}{100}$$
   $$\text{ROI (\% Margem)} = \Delta \%_{\text{Preço}} \times \text{Alavancagem}$$

4. **Preço Estimado de Liquidação:**
   $$\text{Preço de Liquidação} = \begin{cases} \text{Entrada} \times \left(1 - \frac{0.95}{\text{Alavancagem}}\right), & \text{se LONG} \\ \text{Entrada} \times \left(1 + \frac{0.95}{\text{Alavancagem}}\right), & \text{se SHORT} \end{cases}$$
   *O sistema alerta ativamente caso a alavancagem escolhida posicione o preço de liquidação mais próximo do que a ordem de Stop Loss.*

### Recursos Interativos
- **Alternância de Origem de Zonas:** Escolha entre os níveis técnicos do **Bot Quant** (com resolução do timeframe ativo) ou da **Auditoria do Agente de IA**.
- **Controle de Alavancagem Futuros (1x a 50x):** Slider contínuo com presets táteis (2x, 5x, 10x, 20x, 25x, 50x) e diagnóstico visual de risco.
- **Persistência Local (`superbot_position_sizer_prefs`):** Guarda a banca, a alavancagem e a tolerância de risco entre sessões.
