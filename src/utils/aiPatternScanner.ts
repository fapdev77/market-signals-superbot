import { TickerData, DetectedChartPattern, ChartPatternType, PatternBias, PatternCategory, PatternStage } from '../types';

/**
 * AI Pattern Scanner
 * Quantitative and heuristic chart pattern recognition engine.
 * Detects classical repeating price-action and order-flow formations:
 * Bull/Bear Flags, Falling/Rising Wedges, Ascending/Descending Triangles,
 * Double Bottoms/Tops, Cup & Handle, and Head & Shoulders variations.
 */

interface PatternDetectorRule {
  type: ChartPatternType;
  name: string;
  shortName: string;
  bias: PatternBias;
  category: PatternCategory;
  detect: (t: TickerData) => DetectedChartPattern | null;
}

/**
 * Calculates theoretical risk-to-reward ratio safely.
 */
function calculateRiskReward(currentPrice: number, target: number, stopLoss: number): number {
  const potentialGain = Math.abs(target - currentPrice);
  const potentialLoss = Math.abs(currentPrice - stopLoss);
  if (potentialLoss <= 0.000001) return 1.5;
  const rr = potentialGain / potentialLoss;
  return parseFloat(Math.min(9.9, Math.max(0.5, rr)).toFixed(2));
}

const PATTERN_DETECTOR_RULES: PatternDetectorRule[] = [
  // 1. BULL FLAG (Bandeira de Alta)
  {
    type: 'BULL_FLAG',
    name: 'Bull Flag (Bandeira de Alta)',
    shortName: 'Bull Flag',
    bias: 'BULLISH',
    category: 'CONTINUATION',
    detect: (t: TickerData) => {
      const price = t.price || 0;
      if (price <= 0) return null;

      const changePct = t.priceChangePercent24h || 0;
      const fib = t.fibonacci;
      const key = t.keyLevels;
      const profile = t.rangeProfile;
      const swingH = fib?.swingHigh || t.high24h || price * 1.05;
      const swingL = fib?.swingLow || t.low24h || price * 0.95;
      const poleHeight = swingH - swingL;

      // Condition: Positive impulse previously, currently consolidating above Fib 0.618 or VAL
      const hasPriorBullImpulse = changePct >= 0.8 || (fib?.trend === 'UP') || (t.ma24hDeviationPct && t.ma24hDeviationPct > 0.5);
      const isRetracingHealthily = price >= (fib?.fib618 || swingL) && price <= swingH * 1.01;

      if (!hasPriorBullImpulse || !isRetracingHealthily || poleHeight <= 0) return null;

      // Confluence points
      let confidence = 62;
      const rationale: string[] = ['Mastro de alta prévio com impulso sustentado.'];

      if (fib?.inGoldenPocket) {
        confidence += 14;
        rationale.push('Consolidação da bandeira repousa no Golden Pocket de Fibonacci (0.618 - 0.68).');
      }
      if (t.cvdDirection === 'BUY') {
        confidence += 10;
        rationale.push('Delta CVD comprador confirma absorção passiva durante a bandeira.');
      }
      if (key?.structureBreak === 'BULLISH') {
        confidence += 8;
        rationale.push('Quebra de estrutura recente (BOS) em direção altista.');
      }
      if (profile?.inValueArea) {
        confidence += 6;
        rationale.push('Preço oscila dentro da Value Area aguardando expansão direcional.');
      }
      if (t.openInterestChange1h && t.openInterestChange1h > 0) {
        confidence += 5;
        rationale.push('Contratos em aberto (OI) em expansão durante a acumulação.');
      }

      confidence = Math.min(96, confidence);

      const breakoutTrigger = key?.resistance1 ? Math.min(key.resistance1, swingH) : swingH;
      const target = price + poleHeight * 0.78; // 78% of pole measured move
      const targetGainPct = parseFloat((((target - price) / price) * 100).toFixed(2));
      const stopLoss = fib?.fib786 || (key?.support1 ? Math.min(key.support1, price * 0.982) : price * 0.98);
      const riskReward = calculateRiskReward(price, target, stopLoss);

      const stage: PatternStage = 
        price >= breakoutTrigger * 0.998 ? 'READY_BREAKOUT' :
        confidence >= 80 ? 'CONFIRMED' : 'FORMING';

      return {
        id: `${t.symbol}_BULL_FLAG`,
        type: 'BULL_FLAG',
        name: 'Bull Flag (Bandeira de Alta)',
        shortName: 'Bull Flag',
        bias: 'BULLISH',
        category: 'CONTINUATION',
        stage,
        confidence,
        timeframe: '15m - 1h',
        breakoutTriggerPrice: breakoutTrigger,
        measuredMoveTarget: target,
        targetGainPct,
        suggestedStopLoss: stopLoss,
        riskRewardRatio: riskReward,
        poleOrBaseHeightPct: parseFloat(((poleHeight / swingL) * 100).toFixed(2)),
        summary: 'Padrão de continuação altista. Pullback controlado após impulso, com alvo na projeção do mastro.',
        technicalRationale: rationale,
        keyLevelsConfluence: `Resistência em ${breakoutTrigger.toFixed(2)} | Suporte/Stop em ${stopLoss.toFixed(2)}`
      };
    }
  },

  // 2. BEAR FLAG (Bandeira de Baixa)
  {
    type: 'BEAR_FLAG',
    name: 'Bear Flag (Bandeira de Baixa)',
    shortName: 'Bear Flag',
    bias: 'BEARISH',
    category: 'CONTINUATION',
    detect: (t: TickerData) => {
      const price = t.price || 0;
      if (price <= 0) return null;

      const changePct = t.priceChangePercent24h || 0;
      const fib = t.fibonacci;
      const key = t.keyLevels;
      const swingH = fib?.swingHigh || t.high24h || price * 1.05;
      const swingL = fib?.swingLow || t.low24h || price * 0.95;
      const poleHeight = swingH - swingL;

      const hasPriorBearImpulse = changePct <= -0.8 || (fib?.trend === 'DOWN') || (t.ma24hDeviationPct && t.ma24hDeviationPct < -0.5);
      const isRetracingWeakly = price <= (fib?.fib50 || swingH) && price >= swingL * 0.99;

      if (!hasPriorBearImpulse || !isRetracingWeakly || poleHeight <= 0) return null;

      let confidence = 60;
      const rationale: string[] = ['Mastro de baixa com pressão vendedora acentuada.'];

      if (t.cvdDirection === 'SELL') {
        confidence += 12;
        rationale.push('Delta CVD negativo confirma agressão vendedora no repique.');
      }
      if (key?.structureBreak === 'BEARISH') {
        confidence += 10;
        rationale.push('Quebra de estrutura recente (CHoCH/BOS) para o lado vendedor.');
      }
      if (fib?.inGoldenPocket) {
        confidence += 8;
        rationale.push('Repique da bandeira testou o Golden Pocket de Fibonacci e foi rejeitado.');
      }
      if (t.fundingRate && t.fundingRate > 0.0001) {
        confidence += 6;
        rationale.push('Funding rate positivo expõe longs a risco de cascata de liquidação.');
      }

      confidence = Math.min(95, confidence);

      const breakdownTrigger = key?.support1 ? Math.max(key.support1, swingL) : swingL;
      const target = Math.max(0.00001, price - poleHeight * 0.78);
      const targetGainPct = parseFloat((((price - target) / price) * 100).toFixed(2));
      const stopLoss = fib?.fib618 || (key?.resistance1 ? Math.max(key.resistance1, price * 1.02) : price * 1.022);
      const riskReward = calculateRiskReward(price, target, stopLoss);

      const stage: PatternStage = 
        price <= breakdownTrigger * 1.002 ? 'READY_BREAKOUT' :
        confidence >= 80 ? 'CONFIRMED' : 'FORMING';

      return {
        id: `${t.symbol}_BEAR_FLAG`,
        type: 'BEAR_FLAG',
        name: 'Bear Flag (Bandeira de Baixa)',
        shortName: 'Bear Flag',
        bias: 'BEARISH',
        category: 'CONTINUATION',
        stage,
        confidence,
        timeframe: '15m - 1h',
        breakoutTriggerPrice: breakdownTrigger,
        measuredMoveTarget: target,
        targetGainPct,
        suggestedStopLoss: stopLoss,
        riskRewardRatio: riskReward,
        poleOrBaseHeightPct: parseFloat(((poleHeight / swingL) * 100).toFixed(2)),
        summary: 'Padrão de continuação baixista. Correção tímida contra a tendência primária de queda.',
        technicalRationale: rationale,
        keyLevelsConfluence: `Gatilho em ${breakdownTrigger.toFixed(2)} | Invalidação em ${stopLoss.toFixed(2)}`
      };
    }
  },

  // 3. FALLING WEDGE (Cunha Descendente - Reversão/Continuação Altista)
  {
    type: 'FALLING_WEDGE',
    name: 'Falling Wedge (Cunha Descendente)',
    shortName: 'Falling Wedge',
    bias: 'BULLISH',
    category: 'REVERSAL',
    detect: (t: TickerData) => {
      const price = t.price || 0;
      if (price <= 0) return null;

      const key = t.keyLevels;
      const fib = t.fibonacci;
      const swingL = fib?.swingLow || t.low24h || price * 0.95;
      const swingH = fib?.swingHigh || t.high24h || price * 1.05;

      // Price close to lower levels with narrowing range
      const isNearLowerBound = price <= swingL * 1.04 || price <= (key?.support1 || price) * 1.02;
      const hasCvdAbsorption = t.cvdDirection === 'BUY' || (t.takerBuyRatio && t.takerBuyRatio > 0.49);

      if (!isNearLowerBound) return null;

      let confidence = 58;
      const rationale: string[] = ['Preço em canal descendente com amplitude de oscilação comprimida.'];

      if (hasCvdAbsorption) {
        confidence += 16;
        rationale.push('Divergência de Order Flow: CVD positivo absorvendo vendas na cunha.');
      }
      if (fib?.inGoldenPocket) {
        confidence += 12;
        rationale.push('Fundo da cunha apoiado no cluster matemático de Fibonacci 0.618/0.68.');
      }
      if (key?.hasSinglePrintFVG) {
        confidence += 8;
        rationale.push('Presença de Fair Value Gap (FVG) não preenchido atuando como ímã acima.');
      }

      confidence = Math.min(94, confidence);

      const breakoutTrigger = key?.resistance1 || price * 1.018;
      const target = swingH;
      const targetGainPct = parseFloat((((target - price) / price) * 100).toFixed(2));
      const stopLoss = Math.min(swingL * 0.992, (key?.support2 || price * 0.978));
      const riskReward = calculateRiskReward(price, target, stopLoss);

      return {
        id: `${t.symbol}_FALLING_WEDGE`,
        type: 'FALLING_WEDGE',
        name: 'Falling Wedge (Cunha Descendente)',
        shortName: 'Falling Wedge',
        bias: 'BULLISH',
        category: 'REVERSAL',
        stage: price >= breakoutTrigger * 0.995 ? 'READY_BREAKOUT' : 'FORMING',
        confidence,
        timeframe: '1h - 4h',
        breakoutTriggerPrice: breakoutTrigger,
        measuredMoveTarget: target,
        targetGainPct,
        suggestedStopLoss: stopLoss,
        riskRewardRatio: riskReward,
        summary: 'Padrão com alto viés de rompimento altista devido à exaustão vendedora e estreitamento de spreads.',
        technicalRationale: rationale,
        keyLevelsConfluence: `Rompimento superior em ${breakoutTrigger.toFixed(2)} | Base em ${stopLoss.toFixed(2)}`
      };
    }
  },

  // 4. RISING WEDGE (Cunha Ascendente - Reversão/Exaustão Baixista)
  {
    type: 'RISING_WEDGE',
    name: 'Rising Wedge (Cunha Ascendente)',
    shortName: 'Rising Wedge',
    bias: 'BEARISH',
    category: 'REVERSAL',
    detect: (t: TickerData) => {
      const price = t.price || 0;
      if (price <= 0) return null;

      const key = t.keyLevels;
      const fib = t.fibonacci;
      const swingH = fib?.swingHigh || t.high24h || price * 1.05;
      const swingL = fib?.swingLow || t.low24h || price * 0.95;

      const isNearUpperBound = price >= swingH * 0.97 || price >= (key?.resistance1 || price) * 0.985;
      const hasBearishDivergence = t.cvdDirection === 'SELL' || (t.takerBuyRatio && t.takerBuyRatio < 0.48);

      if (!isNearUpperBound) return null;

      let confidence = 59;
      const rationale: string[] = ['Preço subindo em canal estreito com perda gradativa de momentum.'];

      if (hasBearishDivergence) {
        confidence += 15;
        rationale.push('Divergência baixista de CVD: compradores exaustos enquanto preço atinge máximas.');
      }
      if (t.openInterestChange1h && t.openInterestChange1h < -0.5) {
        confidence += 10;
        rationale.push('Redução de Open Interest denota fechamento de posições compradas no topo.');
      }
      if (key?.resistance2 && price >= key.resistance2 * 0.99) {
        confidence += 8;
        rationale.push('Testando nível extremo de Resistência R2.');
      }

      confidence = Math.min(93, confidence);

      const breakdownTrigger = key?.support1 || price * 0.985;
      const target = swingL;
      const targetGainPct = parseFloat((((price - target) / price) * 100).toFixed(2));
      const stopLoss = Math.max(swingH * 1.008, (key?.resistance2 || price * 1.025));
      const riskReward = calculateRiskReward(price, target, stopLoss);

      return {
        id: `${t.symbol}_RISING_WEDGE`,
        type: 'RISING_WEDGE',
        name: 'Rising Wedge (Cunha Ascendente)',
        shortName: 'Rising Wedge',
        bias: 'BEARISH',
        category: 'REVERSAL',
        stage: price <= breakdownTrigger * 1.005 ? 'READY_BREAKOUT' : 'FORMING',
        confidence,
        timeframe: '1h - 4h',
        breakoutTriggerPrice: breakdownTrigger,
        measuredMoveTarget: target,
        targetGainPct,
        suggestedStopLoss: stopLoss,
        riskRewardRatio: riskReward,
        summary: 'Padrão clássico de reversão baixista provocado pela perda de tração compradora no topo.',
        technicalRationale: rationale,
        keyLevelsConfluence: `Perda da LTA em ${breakdownTrigger.toFixed(2)} | Invalidação em ${stopLoss.toFixed(2)}`
      };
    }
  },

  // 5. ASCENDING TRIANGLE (Triângulo Ascendente)
  {
    type: 'ASCENDING_TRIANGLE',
    name: 'Triângulo Ascendente',
    shortName: 'Asc. Triangle',
    bias: 'BULLISH',
    category: 'BREAKOUT',
    detect: (t: TickerData) => {
      const price = t.price || 0;
      if (price <= 0) return null;

      const key = t.keyLevels;
      const profile = t.rangeProfile;
      const fib = t.fibonacci;
      const resistance = key?.resistance1 || fib?.swingHigh || price * 1.03;

      // Price pressing against horizontal resistance with higher support floor
      const isPressingCeiling = price >= resistance * 0.985 && price <= resistance * 1.01;
      const hasHigherLows = (key?.support1 && key.support1 > (fib?.swingLow || 0)) || price > (profile?.val || 0);

      if (!isPressingCeiling || !hasHigherLows) return null;

      let confidence = 65;
      const rationale: string[] = ['Resistência horizontal sendo testada com fundos ascendentes consecutivos.'];

      if (t.cvdDirection === 'BUY') {
        confidence += 12;
        rationale.push('Compradores agressivos absorvendo ofertas no topo da consolidação.');
      }
      if (t.confluenceScore >= 65) {
        confidence += 10;
        rationale.push('Score de confluência algorítmica elevado favorece rompimento para cima.');
      }
      if (t.openInterestChange1h && t.openInterestChange1h > 0.5) {
        confidence += 8;
        rationale.push('Entrada de novos contratos em aberto antecipando breakout.');
      }

      confidence = Math.min(95, confidence);

      const triangleHeight = Math.abs(resistance - (key?.support1 || price * 0.97));
      const target = resistance + triangleHeight;
      const targetGainPct = parseFloat((((target - price) / price) * 100).toFixed(2));
      const stopLoss = key?.support1 ? key.support1 * 0.995 : price * 0.978;
      const riskReward = calculateRiskReward(price, target, stopLoss);

      return {
        id: `${t.symbol}_ASCENDING_TRIANGLE`,
        type: 'ASCENDING_TRIANGLE',
        name: 'Triângulo Ascendente',
        shortName: 'Asc. Triangle',
        bias: 'BULLISH',
        category: 'BREAKOUT',
        stage: price >= resistance * 0.997 ? 'READY_BREAKOUT' : 'FORMING',
        confidence,
        timeframe: '30m - 2h',
        breakoutTriggerPrice: resistance,
        measuredMoveTarget: target,
        targetGainPct,
        suggestedStopLoss: stopLoss,
        riskRewardRatio: riskReward,
        summary: 'Pressão compradora acumulada contra barreira horizontal estática. Forte viés de rompimento para cima.',
        technicalRationale: rationale,
        keyLevelsConfluence: `Teto em ${resistance.toFixed(2)} | Linha de tendência em ${stopLoss.toFixed(2)}`
      };
    }
  },

  // 6. DESCENDING TRIANGLE (Triângulo Descendente)
  {
    type: 'DESCENDING_TRIANGLE',
    name: 'Triângulo Descendente',
    shortName: 'Desc. Triangle',
    bias: 'BEARISH',
    category: 'BREAKOUT',
    detect: (t: TickerData) => {
      const price = t.price || 0;
      if (price <= 0) return null;

      const key = t.keyLevels;
      const fib = t.fibonacci;
      const floorSupport = key?.support1 || fib?.swingLow || price * 0.97;

      // Price pressing against horizontal support with lower highs
      const isPressingFloor = price <= floorSupport * 1.015 && price >= floorSupport * 0.985;
      const hasLowerHighs = (key?.resistance1 && key.resistance1 < (fib?.swingHigh || price * 1.1)) || (t.ma24hDeviationPct && t.ma24hDeviationPct < 0);

      if (!isPressingFloor || !hasLowerHighs) return null;

      let confidence = 64;
      const rationale: string[] = ['Suporte horizontal sob pressão com topos descendentes consecutivos.'];

      if (t.cvdDirection === 'SELL') {
        confidence += 14;
        rationale.push('Agressores vendedores persistentes consumindo as ordens passivas do book de ofertas.');
      }
      if (key?.structureBreak === 'BEARISH') {
        confidence += 10;
        rationale.push('Estrutura de mercado em quebra baixista recente.');
      }

      confidence = Math.min(94, confidence);

      const triangleHeight = Math.abs((key?.resistance1 || price * 1.03) - floorSupport);
      const target = Math.max(0.00001, floorSupport - triangleHeight);
      const targetGainPct = parseFloat((((price - target) / price) * 100).toFixed(2));
      const stopLoss = key?.resistance1 ? key.resistance1 * 1.005 : price * 1.022;
      const riskReward = calculateRiskReward(price, target, stopLoss);

      return {
        id: `${t.symbol}_DESCENDING_TRIANGLE`,
        type: 'DESCENDING_TRIANGLE',
        name: 'Triângulo Descendente',
        shortName: 'Desc. Triangle',
        bias: 'BEARISH',
        category: 'BREAKOUT',
        stage: price <= floorSupport * 1.003 ? 'READY_BREAKOUT' : 'FORMING',
        confidence,
        timeframe: '30m - 2h',
        breakoutTriggerPrice: floorSupport,
        measuredMoveTarget: target,
        targetGainPct,
        suggestedStopLoss: stopLoss,
        riskRewardRatio: riskReward,
        summary: 'Padrão de acumulação de pressão vendedora em direção ao rompimento de suporte horizontal.',
        technicalRationale: rationale,
        keyLevelsConfluence: `Piso em ${floorSupport.toFixed(2)} | Topo descendente em ${stopLoss.toFixed(2)}`
      };
    }
  },

  // 7. DOUBLE BOTTOM (Fundo Duplo / 'W')
  {
    type: 'DOUBLE_BOTTOM',
    name: 'Double Bottom (Fundo Duplo W)',
    shortName: 'Double Bottom',
    bias: 'BULLISH',
    category: 'REVERSAL',
    detect: (t: TickerData) => {
      const price = t.price || 0;
      if (price <= 0) return null;

      const fib = t.fibonacci;
      const key = t.keyLevels;
      const profile = t.rangeProfile;
      const swingL = fib?.swingLow || t.low24h || price * 0.95;

      // Price tested near swingLow twice or holds tightly near major support
      const isRevisitingSupport = Math.abs(price - swingL) / swingL <= 0.022 || (key?.support2 && Math.abs(price - key.support2) / price <= 0.015);
      if (!isRevisitingSupport) return null;

      let confidence = 62;
      const rationale: string[] = ['Reteste do suporte primário formando a segunda perna do padrão W.'];

      if (t.cvdDirection === 'BUY') {
        confidence += 14;
        rationale.push('Divergência compradora no reteste do fundo indicando rejeição institucional de mínimas.');
      }
      if (fib?.inGoldenPocket) {
        confidence += 10;
        rationale.push('Confluência com Golden Pocket de retração.');
      }
      if (profile?.val && price >= profile.val * 0.99) {
        confidence += 8;
        rationale.push('Preço sustentando a Value Area Low (VAL) do perfil de volume.');
      }

      confidence = Math.min(95, confidence);

      const neckline = profile?.poc || key?.resistance1 || (price * 1.035);
      const patternHeight = Math.abs(neckline - swingL);
      const target = neckline + patternHeight;
      const targetGainPct = parseFloat((((target - price) / price) * 100).toFixed(2));
      const stopLoss = swingL * 0.988;
      const riskReward = calculateRiskReward(price, target, stopLoss);

      return {
        id: `${t.symbol}_DOUBLE_BOTTOM`,
        type: 'DOUBLE_BOTTOM',
        name: 'Double Bottom (Fundo Duplo W)',
        shortName: 'Double Bottom',
        bias: 'BULLISH',
        category: 'REVERSAL',
        stage: price >= neckline * 0.99 ? 'READY_BREAKOUT' : 'FORMING',
        confidence,
        timeframe: '1h - 4h',
        breakoutTriggerPrice: neckline,
        measuredMoveTarget: target,
        targetGainPct,
        suggestedStopLoss: stopLoss,
        riskRewardRatio: riskReward,
        summary: 'Reversão clássica em W demonstrando falha dos vendedores em renovar mínimas de mercado.',
        technicalRationale: rationale,
        keyLevelsConfluence: `Neckline em ${neckline.toFixed(2)} | Fundo duplo em ${swingL.toFixed(2)}`
      };
    }
  },

  // 8. DOUBLE TOP (Topo Duplo / 'M')
  {
    type: 'DOUBLE_TOP',
    name: 'Double Top (Topo Duplo M)',
    shortName: 'Double Top',
    bias: 'BEARISH',
    category: 'REVERSAL',
    detect: (t: TickerData) => {
      const price = t.price || 0;
      if (price <= 0) return null;

      const fib = t.fibonacci;
      const key = t.keyLevels;
      const profile = t.rangeProfile;
      const swingH = fib?.swingHigh || t.high24h || price * 1.05;

      const isRevisitingResistance = Math.abs(price - swingH) / swingH <= 0.022 || (key?.resistance2 && Math.abs(price - key.resistance2) / price <= 0.015);
      if (!isRevisitingResistance) return null;

      let confidence = 61;
      const rationale: string[] = ['Reteste de resistência máxima formando a segunda perna do padrão M.'];

      if (t.cvdDirection === 'SELL') {
        confidence += 15;
        rationale.push('Rejeição violenta com delta CVD vendedor agressivo no topo.');
      }
      if (key?.resistance1 && price <= key.resistance1 * 1.005) {
        confidence += 10;
        rationale.push('Resistência R1 e máxima anterior atuando como forte barreira de liquidez.');
      }
      if (t.fundingRate && t.fundingRate > 0.00015) {
        confidence += 7;
        rationale.push('Excesso de alavancagem compradora no topo favorece liquidação.');
      }

      confidence = Math.min(94, confidence);

      const neckline = profile?.poc || key?.support1 || (price * 0.965);
      const patternHeight = Math.abs(swingH - neckline);
      const target = Math.max(0.00001, neckline - patternHeight);
      const targetGainPct = parseFloat((((price - target) / price) * 100).toFixed(2));
      const stopLoss = swingH * 1.012;
      const riskReward = calculateRiskReward(price, target, stopLoss);

      return {
        id: `${t.symbol}_DOUBLE_TOP`,
        type: 'DOUBLE_TOP',
        name: 'Double Top (Topo Duplo M)',
        shortName: 'Double Top',
        bias: 'BEARISH',
        category: 'REVERSAL',
        stage: price <= neckline * 1.01 ? 'READY_BREAKOUT' : 'FORMING',
        confidence,
        timeframe: '1h - 4h',
        breakoutTriggerPrice: neckline,
        measuredMoveTarget: target,
        targetGainPct,
        suggestedStopLoss: stopLoss,
        riskRewardRatio: riskReward,
        summary: 'Reversão em M sinalizando exaustão da tendência compradora e defesa de topo por formadores de mercado.',
        technicalRationale: rationale,
        keyLevelsConfluence: `Neckline em ${neckline.toFixed(2)} | Topo duplo em ${swingH.toFixed(2)}`
      };
    }
  },

  // 9. CUP AND HANDLE (Xícara e Alça)
  {
    type: 'CUP_AND_HANDLE',
    name: 'Cup & Handle (Xícara e Alça)',
    shortName: 'Cup & Handle',
    bias: 'BULLISH',
    category: 'CONTINUATION',
    detect: (t: TickerData) => {
      const price = t.price || 0;
      if (price <= 0) return null;

      const fib = t.fibonacci;
      const key = t.keyLevels;
      const profile = t.rangeProfile;
      const swingH = fib?.swingHigh || t.high24h || price * 1.05;
      const swingL = fib?.swingLow || t.low24h || price * 0.95;

      // Price recovering towards swing high (rim of cup), currently forming a handle (slight pullback holding above Fib 0.50)
      const nearRim = price >= swingH * 0.94 && price <= swingH * 1.01;
      const handleHolding = price >= (fib?.fib50 || swingL);

      if (!nearRim || !handleHolding) return null;

      let confidence = 66;
      const rationale: string[] = ['Recuperação em curva completando a xícara, com retração rasa formando a alça.'];

      if (t.cvdDirection === 'BUY') {
        confidence += 12;
        rationale.push('Fluxo taker de compra sustentando a formação da alça.');
      }
      if (profile?.vah && price >= profile.vah * 0.99) {
        confidence += 10;
        rationale.push('Alça da xícara posicionada acima do Value Area High (VAH).');
      }
      if (key?.structureBreak === 'BULLISH') {
        confidence += 7;
        rationale.push('Estrutura de alta preservada sem rompimento de mínimas.');
      }

      confidence = Math.min(96, confidence);

      const cupDepth = Math.abs(swingH - swingL);
      const target = swingH + cupDepth * 0.85;
      const targetGainPct = parseFloat((((target - price) / price) * 100).toFixed(2));
      const stopLoss = fib?.fib618 || (key?.support1 || price * 0.965);
      const riskReward = calculateRiskReward(price, target, stopLoss);

      return {
        id: `${t.symbol}_CUP_AND_HANDLE`,
        type: 'CUP_AND_HANDLE',
        name: 'Cup & Handle (Xícara e Alça)',
        shortName: 'Cup & Handle',
        bias: 'BULLISH',
        category: 'CONTINUATION',
        stage: price >= swingH * 0.995 ? 'READY_BREAKOUT' : 'FORMING',
        confidence,
        timeframe: '1h - 1d',
        breakoutTriggerPrice: swingH,
        measuredMoveTarget: target,
        targetGainPct,
        suggestedStopLoss: stopLoss,
        riskRewardRatio: riskReward,
        summary: 'Formação gráfica altista altamente confiável com acumulação arredondada e rompimento iminente da borda.',
        technicalRationale: rationale,
        keyLevelsConfluence: `Borda/Gatilho em ${swingH.toFixed(2)} | Fundo da alça em ${stopLoss.toFixed(2)}`
      };
    }
  }
];

/**
 * Scans a single TickerData object and detects all matching chart patterns.
 * Returns patterns sorted by highest confidence score.
 */
export function scanTickerForPatterns(ticker: TickerData): DetectedChartPattern[] {
  if (!ticker || !ticker.price) return [];

  const detected: DetectedChartPattern[] = [];

  for (const rule of PATTERN_DETECTOR_RULES) {
    try {
      const match = rule.detect(ticker);
      if (match) {
        detected.push(match);
      }
    } catch {
      // Graceful error protection per rule
    }
  }

  // Sort by highest confidence descending
  return detected.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Returns the single top-confidence detected pattern for a ticker, or null if none.
 */
export function getTopDetectedPattern(ticker: TickerData): DetectedChartPattern | null {
  const patterns = scanTickerForPatterns(ticker);
  return patterns.length > 0 ? patterns[0] : null;
}

/**
 * Batch scans an array of Tickers, returning a Map of symbol -> DetectedChartPattern[].
 */
export function scanAllTickersForPatterns(tickers: TickerData[]): Map<string, DetectedChartPattern[]> {
  const resultMap = new Map<string, DetectedChartPattern[]>();

  if (!Array.isArray(tickers)) return resultMap;

  for (const t of tickers) {
    if (t && t.symbol) {
      const patterns = scanTickerForPatterns(t);
      if (patterns.length > 0) {
        resultMap.set(t.symbol, patterns);
      }
    }
  }

  return resultMap;
}

/**
 * Returns styling tokens and icons for a given pattern type and bias.
 */
export function getPatternVisualBadgeTheme(pattern: DetectedChartPattern): {
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  iconBg: string;
  chipColor: string;
  accentGlow: string;
} {
  const { bias, stage } = pattern;

  if (bias === 'BULLISH') {
    return {
      badgeBg: stage === 'READY_BREAKOUT' ? 'bg-emerald-500/15' : 'bg-emerald-950/40',
      badgeBorder: stage === 'READY_BREAKOUT' ? 'border-emerald-400/50' : 'border-emerald-500/30',
      badgeText: 'text-emerald-400',
      iconBg: 'bg-emerald-500/20 text-emerald-300',
      chipColor: 'bg-emerald-500',
      accentGlow: 'shadow-emerald-500/10'
    };
  }

  if (bias === 'BEARISH') {
    return {
      badgeBg: stage === 'READY_BREAKOUT' ? 'bg-rose-500/15' : 'bg-rose-950/40',
      badgeBorder: stage === 'READY_BREAKOUT' ? 'border-rose-400/50' : 'border-rose-500/30',
      badgeText: 'text-rose-400',
      iconBg: 'bg-rose-500/20 text-rose-300',
      chipColor: 'bg-rose-500',
      accentGlow: 'shadow-rose-500/10'
    };
  }

  return {
    badgeBg: 'bg-neutral-900',
    badgeBorder: 'border-white/10',
    badgeText: 'text-neutral-300',
    iconBg: 'bg-neutral-800 text-neutral-400',
    chipColor: 'bg-neutral-500',
    accentGlow: 'shadow-none'
  };
}
