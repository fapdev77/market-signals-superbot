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

---

## 8. Indicador Visual de Força de Tendência (*Trend Strength* 1-5 Barras / ADX) (`TickerGrid.tsx`)

### O que é?
Integrado em cada card do `TickerGrid`, este indicador sutil fornece um relance imediato da sustentabilidade direcional do movimento de cada ativo, evitando que o trader entre contra tendências exaustivas ou se envolva em mercados estagnados/consolidados.

### Metodologia de Cálculo
O score de 0 a 100 e a graduação de 1 a 5 barras é derivado de múltiplos vetores estatísticos em tempo real:
1. **Posicionamento Relativo no Range 24h:** Avaliação da proximidade da cotação atual em relação às máximas (`high24h`) ou mínimas (`low24h`).
2. **Velocidade & Momentum do Preço:** Variação percentual das 24h ponderada por velocidade.
3. **Alinhamento do Delta CVD:** Confirmação se o fluxo institucional de compras ou vendas a mercado corrobora a direção do movimento.
4. **Expansão de Open Interest (OI 1h):** Validação se novos contratos alavancados estão entrando para sustentar a tendência ou se há perda de liquidez.
5. **Confluência Algorítmica Global:** Bônus quantitativo do motor analítico.

### Escala de Barras & Equivalência ADX (Average Directional Index)
- **1 Barra (ADX ~12-19):** *Sem Tendência (Consolidação)* — Mercado lateral sem momentum direcional sustentado.
- **2 Barras (ADX ~20-27):** *Tendência Incipiente / Fraca* — Início tímido de direcional ou consolidação ampla.
- **3 Barras (ADX ~28-37):** *Tendência Moderada* — Direcional ativo em desenvolvimento, acompanhando rompimento de níveis chave.
- **4 Barras (ADX ~38-47):** *Tendência Forte (Sustentada)* — Tendência estrutural consistente com fluxo institucional favorável e sustentação de topos/fundos.
- **5 Barras (ADX ~48-60+):** *Tendência Muito Forte (Exaustão/Parabólica)* — Momentum extremo com volume alto e risco de clímax ou continuação agressiva.

### Recursos de Interface
- **Micro-gráfico de 5 barras ascendentes:** Cores contextuais (Verde Esmeralda para Alta Forte, Vermelho/Rubi para Baixa Forte, Cinza para Consolidação).
- **Tooltip detalhado:** Exibe o valor estimado de ADX, classificação textual e diagnóstico do momentum.
- **Ordenação Rápida:** Filtro no menu drop-down para listar os ativos do grid por *Maior Força de Tendência (ADX 1-5)*.

---

## 9. Dashboard Customizável com Drag-and-Drop (`DashboardGridLayout.tsx`)

### O que é?
Sistema de gerenciamento de layout drag-and-drop responsivo implementado com `react-grid-layout`, permitindo que os traders personalizem e reorganizem livremente os painéis do dashboard de acordo com seu estilo operacional (Scalping, Day Trading, Análise Macro).

### Funcionalidades
- **Reordenação Drag-and-Drop:** Alça tátil de arrasto (`.widget-drag-handle`) presente no topo de cada widget para reposicionamento fluido sem interferir nos controles internos dos gráficos.
- **Trava de Layout (*Drag Lock*):** Botão para alternar entre "Arrasto Ativo" e "Layout Travado" prevenindo movimentações indesejadas durante operações de mercado agitadas.
- **Gaveta de Visibilidade de Widgets:** Menu para ocultar ou exibir painéis individuais (Oportunidade Prime, Mapa de Calor D3, Matriz de Correlação Setorial, Grid de Tickers).
- **Persistência em Tempo Real:** Armazenamento automático da ordem e visibilidade no `localStorage` (`superbot_dashboard_grid_layouts_v2` e `superbot_dashboard_widgets_visibility_v2`).
- **Botão de Restauração:** Redefine o layout para as posições otimizadas de fábrica com um clique.

---

## 10. Mapa de Calor Global do Mercado com D3 (*Market Heatmap*) (`MarketHeatmap.tsx`)

### O que é?
Visualização em Treemap interativo construída com **D3.js** (`d3.treemap` e `d3.hierarchy`), mapeando a liquidez e a posição relativa de todos os ativos monitorados.

### Metodologia e Codificação Visual
1. **Dimensionamento dos Blocos por Volume 24h:** A área de cada retângulo é proporcional ao volume financeiro negociado nas últimas 24 horas (`quoteVolume24h` em USDT ou USD), destacando visualmente onde está concentrada a liquidez do mercado.
2. **Colorização por Desvio da Média Móvel de 24h (MA24h):**
   - **Cálculo do Desvio:** $\text{Desvio \%} = \frac{\text{Preço Atual} - \text{MA24h}}{\text{MA24h}} \times 100$.
   - **Escala de Cores D3 Divergente:**
     - **Abaixo da Média (-8% a -1%):** Tons de Vermelho Rubi / Carmesim (`#be123c` a `#9f1239`), sinalizando sobre-venda ou desconto acentuado.
     - **Em torno da Média (~0%):** Ardósia / Grafite neutro (`#1e222d`).
     - **Acima da Média (+1% a +8%+):** Tons de Verde Esmeralda (`#065f46` a `#10b981`), indicando expansão altista e impulso comprador.
3. **Alternância de Métrica de Cor:** Botão rápido para alternar entre *Desvio MA 24h* e *Variação 24h % clássica*.
4. **Filtro de Mercados:** Opções para visualizar *Todos*, apenas *Cripto Futuros* ou apenas *TradFi* (Ouro, Petróleo, S&P 500, DXY).
5. **Tooltip Dinâmico & Integração:** Hover com dados completos de cotação, MA 24h, desvio percentual, volume e direção de fluxo CVD. Clique em qualquer bloco para abrir a análise técnica do ativo.

---

## 11. Profundidade de Liquidez & Pressão de Livro com D3 (*Liquidity Depth*) (`LiquidityDepth.tsx`)

### O que é?
Componente de visualização quantitativa construído em **D3.js** que mapeia as curvas cumulativas de profundidade do livro de ordens (Bids vs. Asks) do ativo selecionado, mensurando com precisão matemática a assimetria (*imbalance*) e a pressão institucional exercida pelas ordens limite passivas.

### Metodologia e Codificação Visual
1. **Curvas Cumulativas de Profundidade em D3:**
   - **Lado Comprador (Bids - Verde Esmeralda `#10b981`):** Degraus/curvas cumulativas (`d3.curveStepBefore` ou `d3.curveMonotoneX`) com preenchimento em gradiente translúcido, acumulando o volume em USD desde os níveis mais profundos até o melhor preço de compra (*Best Bid*).
   - **Lado Vendedor (Asks - Vermelho Rubi `#f43f5e`):** Degraus/curvas cumulativas (`d3.curveStepAfter` ou `d3.curveMonotoneX`) com preenchimento em gradiente translúcido, acumulando o volume em USD a partir do melhor preço de venda (*Best Ask*).
   - **Preço Médio de Mercado (*Mid Market Price*):** Linha vertical pontilhada em amarelo âmbar com badge indicador centralizado no ponto médio exato entre a melhor compra e melhor venda.
2. **Identificação de Muralhas de Liquidez (*Whale Walls*):**
   - Níveis do livro de ordens individuais cujo volume excede $\ge 2.3\times$ a média das ordens são marcados com halos pulsantes e etiquetas contextuais (`MURALHA BID` / `MURALHA ASK`).
3. **Mensuração Quantitativa de Pressão & Imbalance:**
   - **Fórmula de Desequilíbrio:** $\text{Imbalance \%} = \frac{\text{Profundidade Bids (USD)} - \text{Profundidade Asks (USD)}}{\text{Profundidade Total (USD)}} \times 100$.
   - **Barra de Balanço Bid/Ask:** Barra gráfica dividida exibindo a proporção exata entre volume comprador e vendedor (ex.: 58% Bids vs 42% Asks).
   - **Classificação Diagnóstica de Fluxo:**
     - $\ge +20\%$: *Forte Pressão Compradora (Suporte Carregado)*
     - $+7\%$ a $+20\%$: *Moderada Pressão Compradora (Bid Dominante)*
     - $-7\%$ a $+7\%$: *Livro Equilibrado (Fluxo Neutro)*
     - $-20\%$ a $-7\%$: *Moderada Pressão Vendedora (Ask Dominante)*
     - $\le -20\%$: *Forte Pressão Vendedora (Resistência Carregada)*
4. **Controles Operacionais:**
   - **Filtro de Range de Profundidade:** $\pm 0.5\%$, $\pm 1.0\%$, $\pm 2.0\%$, $\pm 5.0\%$ em relação ao preço médio.
   - **Estilo de Curva:** Alternância entre *Degraus (Step Ladder)* e *Suave (Monotone Curve)*.
   - **Modo Live:** Atualização automática periódica com indicador visual de pulso e botão de recarga manual.
   - **Crosshair Interativo:** Cursor flutuante com cálculo instantâneo de preço, desvio percentual, volume cumulativo em USD e quantidade de tokens.
5. **Disponibilidade:**
   - Integrado na tela de análise detalhada do ativo (`ChartAndProfile.tsx`) logo abaixo dos indicadores de order flow/delta.
   - Disponível como widget reorganizável com drag-and-drop no dashboard principal (`DashboardGridLayout.tsx`).

---

## 12. Gerenciador Geral de Alarmes em Massa (*Bulk Alert Manager*) (`BulkAlertManager.tsx`)

### O que é?
Painel centralizado e tabela unificada que expande o sistema de alarmes de preço do SuperBot, permitindo aos traders visualizar, monitorar, filtrar, ordenar, criar, alternar (ativar/pausar) e excluir em lote (*bulk actions*) múltiplos alarmes cadastrados em todos os ativos da carteira simultaneamente.

### Principais Recursos & Metodologia
1. **Tabela Central Unificada Multi-Ativos:**
   - **Ativo (Ticker):** Exibição do par com atalho direto (*Ver Gráfico*) para focar a análise técnica imediatamente no ativo desejado.
   - **Condição:** Indicadores visuais claros para rompimento de alta (`▲ >= Cruzar Acima`) em verde esmeralda e perda de suporte (`▼ <= Cruzar Abaixo`) em vermelho rubi.
   - **Preço Alvo & Preço Atual Live:** Comparação lado a lado do preço estipulado versus cotação em tempo real e variação percentual 24h.
   - **Distância para o Alvo & Barra de Proximidade:** Cálculo contínuo da distância percentual restante até o disparo. Alarmes a $\le 1.0\%$ de distância recebem badge pulsante de prioridade `IMINENTE`.
   - **Status Interativo:** Toggle switch direto para alternar entre *Ativo* (monitorando) e *Pausado*, além de badge com histórico de disparo e botão de *Rearmar/Resetar* para alarmes acionados.
   - **Notas Contextuais:** Visualização de observações personalizadas inseridas pelo trader.
2. **Ações em Massa (*Bulk Actions*):**
   - Seleção múltipla por caixas de marcação (com botão de marcar/desmarcar todos).
   - **Ativar Selecionados:** Reativa e rearma múltiplos alarmes em um único clique.
   - **Pausar Selecionados:** Suspende temporariamente o monitoramento dos itens marcados.
   - **Excluir Selecionados:** Remove em lote os alarmes obsoletos.
   - **Limpar Disparados:** Higienização com um clique de todos os alarmes que já cumpriram seu objetivo.
3. **Filtros, Busca e Ordenação:**
   - Filtro por ativo específico ou visualização consolidada de todos os pares monitorados.
   - Filtro por estado: *Todos*, *Ativos*, *Pausados* ou *Disparados*.
   - Busca em tempo real por ticker ou texto da nota explicativa.
   - Ordenação inteligente por: *Mais Próximo do Disparo (% Distância)*, *Data de Criação*, *Preço Alvo* ou *Ticker (A-Z)*.
4. **Criador Rápido de Alarmes (*Quick Drawer*):**
   - Permite cadastrar novos alertas para qualquer par disponível no screener sem precisar trocar de gráfico.
   - Atalhos de cálculo rápido percentual ($\pm 0.5\%$, $\pm 1.0\%$, $\pm 2.0\%$).
5. **Backup & Portabilidade:**
   - **Exportar JSON:** Download instantâneo de todos os alarmes configurados.
   - **Importar JSON:** Restauração ou mesclagem rápida de listas de alarmes prévias.
6. **Monitoramento Global em Segundo Plano:**
   - Avalia continuamente as cotações em tempo real de todos os ativos da carteira (`allTickers`).
   - Dispara tons sonoros sintetizados via Web Audio API (`playSignalTone`) e notificações na Área de Trabalho (`Notification API`) mesmo quando o usuário estiver analisando outro gráfico.

---

## 13. Matriz de Sinais Institucional & HUD de Métricas em Tempo Real (`SignalsMatrix.tsx`)

### O que é?
A **Matriz de Sinais** é o centro nervoso da aplicação, onde todas as oportunidades geradas pelas estratégias concorrentes (*Scalp, Day Trade, Intraday, Swing Trade, Position Trade e Contra-Trade*) são organizadas em formato de cartões de alta densidade informativa com padrão visual de terminais institucionais.

### Principais Recursos
1. **HUD Superior Institucional:**
   * **Sinais no Book:** Contagem em tempo real de sinais ativos vs. total histórico.
   * **Confluência Média:** Score ponderado médio de todas as oportunidades.
   * **Breakeven Ativo:** Total de trades protegidos com risco zero.
   * **Expiração Próxima:** Alarme visual de sinais com menos de 20% de TTL restante.
   * **Alvos Concluídos:** Histórico de metas de Take Profit alcançadas com sucesso.
   * **Regime TTL Ativo:** Indicador visual do regime de volatilidade atual (*Calmo, Padrão, Agitado, Extremo*) com botão direto para a aba de Ajustes.
2. **Barra de Filtros por Ciclo de Vida:**
   * `Todas as Fases` | `🟢 Ativos` | `⏳ Expirando em Breve` | `🛡️ Breakeven Protegido` | `🎯 Alvo Atingido` | `🛑 Stop Loss` | `⌛ TTL Expirado`
3. **Gauges de Decaimento de Alpha (TTL) nos Cards:**
   * Relógio ao vivo com contagem regressiva segundo a segundo (`⏳ 14m 20s restando`).
   * Barra de progresso visual gradiente com transição de cores (Verde $\rightarrow$ Âmbar $\rightarrow$ Vermelho pulsante).
   * Exibição do multiplicador ativo e regime de mercado aplicado.
4. **Banners de Status & Invalidação:**
   * Banners destacados em verde para **Alvo 2 Atingido (+100% de Lucro)**, vermelho para **Stop Loss Acionado**, cinza para **TTL Expirado** e ciano para **Stop no Breakeven Protegido (0.00% de Risco)**.

---

## 14. Radar de Traders Presos (*Trapped Traders Radar*) (`TrappedTradersRadar.tsx`)

### O que é?
Módulo quantitativo que analisa o cruzamento de **CVD de agressão** com **quebra de máximas/mínimas** e **Open Interest** para identificar zonas onde traders de varejo foram induzidos a entrar e ficaram presos (*trapped longs / trapped shorts*).

### Mecânica Operacional
* **Trapped Longs (Compradores Presos no Topo):** Ocorre quando há forte agressão compradora no topo, mas o preço rejeita e cai, forçando esses compradores a stoparem ou serem liquidados na descida.
* **Trapped Shorts (Vendedores Presos no Fundo):** Ocorre quando há forte agressão vendedora no rompimento de suporte, mas o preço absorve e sobe, gerando combustível para um *short squeeze*.

---

## 15. Monitor de Divergências RSI Automatizado (`RSIDivergenceMonitor.tsx`)

### O que é?
Scanner em tempo real que monitora simultaneamente todos os ativos em busca de:
1. **Divergência de Alta Regular (Bullish Regular):** Preço faz fundos mais baixos enquanto o RSI faz fundos mais altos (sinal de esgotamento vendedor).
2. **Divergência de Baixa Regular (Bearish Regular):** Preço faz topos mais altos enquanto o RSI faz topos mais baixos (sinal de esgotamento comprador).
3. **Divergências Ocultas (Hidden Divergences):** Sinais de continuação da tendência estrutural primária.

---

## 16. Painel de Gestão e Exposição de Risco (`RiskExposureDashboard.tsx`)

### O que é?
Ferramenta de nível institucional para mensurar o risco global da carteira consolidada de trades:
* **Value at Risk (VaR 95% e VaR 99% Paramétrico / Histórico):** Perda máxima estimada dentro de um horizonte temporal de 24h.
* **Concentração Setorial de Risco:** Gráfico de pizza/rosca mapeando a alocação entre Layer 1, DeFi, IA, Memecoins e TradFi.
* **Stress Test Macro:** Simulações de choque de mercado (-10% no BTC, alta de juros, flash crash).

---

## 17. Dimensionamento de Posição & Critério de Kelly (`PositionSizerCalculator.tsx`)

### O que é?
Calculadora institucional para determinação do lote exato a ser aberto em cada operação com base na fórmula de gerenciamento de banca:
$$\text{Tamanho do Lote} = \frac{\text{Capital da Conta} \times \text{Risco Desejado (\%)}}{|\text{Preço de Entrada} - \text{Preço de Stop Loss}|}$$

Fornece ainda o cálculo pelo **Critério de Kelly Fracionário (Half Kelly / Quarter Kelly)** para otimizar a curva de crescimento de capital.

---

## 18. Auto-Tuner Quantitativo de Estratégias (`StrategyAutoTuner.tsx`)

### O que é?
Otimizador baseado em **Algoritmos Genéticos** e **Backtest Walk-Forward** que simula milhares de combinações de pesos de indicadores para encontrar a calibração com maior *Sharpe Ratio*, menor *Drawdown* e maior *Taxa de Acerto (Win Rate)* para o histórico recente de mercado.

---

## 19. Simulador de Paper Trading & Sandbox (`PaperTradingSandbox.tsx`)

### O que é?
Ambiente de simulação em tempo real onde o operador pode testar as estratégias do robô com saldo virtual fictício ($100.000 USD), executando ordens a mercado ou limites e monitorando o PnL não-realizado, taxa de acerto e curva de equidade ao vivo.

---

## 20. Diagnóstico do Sistema, Banco de Dados & Factory Reset (`SystemDatabaseSettings.tsx`)

### O que é?
Painel integrado na aba **Ajustes** que fornece métricas transparentes sobre a persistência no SQLite:
* Contagem de linhas das tabelas `trade_signals`, `market_snapshots`, `ai_audit_reports` e `indicator_weights`.
* Exibição do tamanho do arquivo `.sqlite` em KB e MB.
* Botão de desfragmentação **VACUUM** para liberação de espaço em disco.
* Botão de **Reset Global / Padrão de Fábrica** com 3 níveis de confirmação de segurança.

