import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { calculatePortfolioRisk, enrichPosition } from '../src/utils/riskCalculations';
import { computeCvdDeltaMetrics, ASSUMED_TAKER_SHARE_OF_QUOTE_VOLUME } from '../src/utils/cvdDeltaUtils';
import type { TickerData } from '../src/types';

/**
 * FASE 0 — Guarda de integridade da tela (C-01..C-09).
 *
 * O operador decide em cima do que a tela mostra. Este teste é o contrato que
 * impede que um número SINTETIZADO (aleatório ou literal de fallback) chegue ao
 * operador disfarçado de dado de mercado.
 *
 * Escopo: a "superfície de apresentação de mercado" — módulos que exibem preço,
 * telemetria, order flow, posicionamento ou risco. `Math.random()` para gerar
 * ID de objeto (toast, alerta, trade de paper trading) NÃO entra nesta lista e
 * continua permitido.
 *
 * Se um arquivo desta lista voltar a conter `Math.random()` ou os literais de
 * fabricação conhecidos, este teste falha — é o gate que faltava.
 */

const PRESENTATION_MODULES = [
  'src/App.tsx',
  'src/components/Header.tsx',
  'src/components/SystemHealthWidget.tsx',
  'src/components/ChartAndProfile.tsx',
  'src/components/LiquidityDepth.tsx',
  'src/components/TrappedTradersRadar.tsx',
  'src/components/DataQualityBadge.tsx',
  'src/components/ScreenerDashboard.tsx',
  'src/components/GoldenPocketSparkline.tsx',
  'src/components/RiskExposureDashboard.tsx',
  'src/utils/rsiDivergenceUtils.ts',
  'src/utils/riskCalculations.ts',
  'src/components/PrimeOpportunityBanner.tsx',
  'src/utils/cvdDeltaUtils.ts',
  'src/utils/volumeScreenerUtils.ts'
];

/**
 * Remove comentários de linha e de bloco antes de auditar o texto.
 * A documentação PODE mencionar `Math.random()` / "DADOS REAIS" ao explicar o
 * que foi removido — o que não pode é o CÓDIGO reintroduzir o comportamento.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function read(relPath: string): string {
  const abs = path.join(process.cwd(), relPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`módulo de apresentação configurado não encontrado: ${relPath}`);
  }
  return stripComments(fs.readFileSync(abs, 'utf8'));
}

describe('FASE 0 — nenhuma métrica sintetizada na tela do operador', () => {
  it('a superfície de apresentação é explícita e não vazia', () => {
    expect(PRESENTATION_MODULES.length).toBeGreaterThan(5);
    expect(PRESENTATION_MODULES).toContain('src/components/Header.tsx');
    expect(PRESENTATION_MODULES).toContain('src/components/ChartAndProfile.tsx');
  });

  it('nenhum módulo de apresentação deriva valor de mercado de Math.random()', () => {
    const offenders: string[] = [];
    for (const relPath of PRESENTATION_MODULES) {
      const content = read(relPath);
      content.split(/\r?\n/).forEach((line, idx) => {
        if (/Math\.random\s*\(/.test(line)) {
          offenders.push(`${relPath}:${idx + 1} → ${line.trim().slice(0, 120)}`);
        }
      });
    }
    expect(
      offenders,
      `Math.random() voltou à camada de apresentação de mercado:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it('o selo de qualidade não afirma "dados reais" de forma estática', () => {
    const content = read('src/components/DataQualityBadge.tsx');
    expect(content).not.toMatch(/DADOS REAIS/);
    expect(content).not.toMatch(/100%\s*verificado/i);
    expect(content).not.toMatch(/Zero fabricação/i);
  });

  it('o Radar de Trapped Traders não traz posicionamento/liquidação inventados', () => {
    const content = read('src/components/TrappedTradersRadar.tsx');
    // literais de fabricação removidos na Fase 0
    expect(content).not.toContain('15000000');
    expect(content).not.toContain('12000000');
    expect(content).not.toContain('11400000');
  });
});

describe('FASE 0 (C-01) — RSI de Wilder nunca é estimado', () => {
  it('a utilidade não possui mais heurística de RSI sintético', () => {
    const content = read('src/utils/rsiDivergenceUtils.ts');
    expect(content).not.toMatch(/estimateRSI/);
  });

  it('o RSI médio do universo não injeta valor neutro para ativos sem histórico', () => {
    const content = read('src/utils/rsiDivergenceUtils.ts');
    // antes: items.reduce((acc, i) => acc + (i.rsiCurrent ?? 50), 0) / items.length
    expect(content).not.toMatch(/rsiCurrent\s*\?\?\s*50/);
    expect(content).toMatch(/rsiMeasuredCount/);
  });

  it('sem velas: nenhum RSI neutro nem plano direcional fabricado', () => {
    const content = read('src/utils/rsiDivergenceUtils.ts');
    // antes: rsiCurrent: 50 / rsiPrevSwing: 50 era apresentado como RSI medido
    expect(content).not.toMatch(/rsiCurrent:\s*50/);
    // o item sem dados declara o plano como nulo — nenhum nível derivado do preço
    expect(content).toMatch(/entryZone:\s*null/);
    expect(content).toMatch(/riskRewardRatio:\s*null/);
    expect(content).not.toMatch(/stopLoss: price \* 1\.015/);
  });

  it('a UI do monitor guarda o plano quando não há níveis (n/d, nunca $0.00)', () => {
    const monitor = read('src/components/RSIDivergenceMonitor.tsx');
    // formatPrice(null) devolveria "$0.00" — fabricaria um stop zero
    expect(monitor).toMatch(/entryZone \?/);
    expect(monitor).toMatch(/stopLoss == null/);
    expect(monitor).toMatch(/riskRewardRatio == null/);
  });
});

describe('FASE 0 (C-02) — win-rate e série de resultados são reais', () => {
  const app = read('src/App.tsx');

  it('não inventa tamanho mínimo de amostra nem contagem de acertos', () => {
    expect(app).not.toMatch(/baselineAlerts/);
    expect(app).not.toMatch(/Math\.max\(\s*symbolSignals\.length\s*,\s*\d+\s*\)/);
  });

  it('não traz win-rate de fallback nem curva de resultados sintética', () => {
    // antes: winRate = ... : 74  e uma série com pnlPct literais (2.4, -1.1, ...)
    expect(app).not.toMatch(/winRate\s*=\s*[^;]*\?\s*[^;]*:\s*\d+\s*;/);
    expect(app).not.toMatch(/pnlPct:\s*2\.4/);
    expect(app).not.toMatch(/pnlPct:\s*3\.1/);
    expect(app).not.toMatch(/pnlPct:\s*-1\.1/);
  });

  it('o tipo do card declara winRate anulável (sem amostra ⇒ null)', () => {
    // C-02 moveu o contrato para a utilidade pura; o card re-exporta o mesmo tipo.
    const stats = read('src/utils/goldenPocketStats.ts');
    expect(stats).toMatch(/winRate:\s*number\s*\|\s*null/);
    const spark = read('src/components/GoldenPocketSparkline.tsx');
    expect(spark).toMatch(/export type \{ GoldenPocketStats \} from '\.\.\/utils\/goldenPocketStats'/);
  });
});

describe('FASE 0 (C-04) — o Screener não injeta TickerData sintético', () => {
  const screener = read('src/components/ScreenerDashboard.tsx');

  it('não constrói tickers com campos fabricados', () => {
    expect(screener).not.toMatch(/openInterest:\s*asset\.openInterest\s*\?\?\s*0/);
    expect(screener).not.toMatch(/takerBuyRatio:\s*0\.5/);
    expect(screener).not.toMatch(/fibonacci:\s*\{\s*fib50:\s*asset\.price/);
  });

  it('resolve o símbolo no feed ao vivo em vez de sintetizar', () => {
    expect(screener).toContain('handleSelectAsset');
    expect(screener).toContain('liveTickers');
  });
});

describe('FASE 0 (C-08) — VaR declara a base da volatilidade', () => {
  const position = enrichPosition({
    id: 'p1',
    symbol: 'BTCUSDT',
    direction: 'LONG',
    entryPrice: 60000,
    currentPrice: 61000,
    quantity: 0.1,
    leverage: 5
  });

  it('portfólio vazio não alega VaR', () => {
    const summary = calculatePortfolioRisk([], 10000);
    expect(summary.var95DailyUsd).toBe(0);
    expect(summary.var99DailyUsd).toBe(0);
    expect(summary.varBasis).toBe('PARAMETRIC_ASSUMED');
    expect(summary.varDailyVolUsed).toBe(0);
  });

  it('sem volatilidade medida, marca o VaR como premissa paramétrica', () => {
    const summary = calculatePortfolioRisk([position], 10000);
    expect(summary.varBasis).toBe('PARAMETRIC_ASSUMED');
    expect(summary.varDailyVolUsed).toBeGreaterThan(0);
    expect(summary.var95DailyUsd).toBeGreaterThan(0);
  });

  it('com volatilidade realizada, marca o VaR como medido e usa o valor fornecido', () => {
    const assumed = calculatePortfolioRisk([position], 10000);
    const measured = calculatePortfolioRisk([position], 10000, 0.02);

    expect(measured.varBasis).toBe('MEASURED');
    // beta do BTCUSDT é 1.0 ⇒ vol diária usada é exatamente a informada
    expect(measured.varDailyVolUsed).toBeCloseTo(0.02, 6);
    expect(measured.var95DailyUsd).toBeLessThan(assumed.var95DailyUsd);
  });

  it('volatilidade inválida é ignorada (não vira dado medido)', () => {
    for (const bad of [-0.01, 0, Number.NaN]) {
      const summary = calculatePortfolioRisk([position], 10000, bad);
      expect(summary.varBasis).toBe('PARAMETRIC_ASSUMED');
    }
  });

  it('a UI exibe a procedência da volatilidade do VaR', () => {
    const ui = read('src/components/RiskExposureDashboard.tsx');
    expect(ui).toMatch(/varBasis/);
    expect(ui).toMatch(/não medida/);
  });
});

/** Ticker parcial para asserções comportamentais — os utilitários validam campo a campo. */
function bareTicker(overrides: Record<string, unknown>): TickerData {
  return overrides as unknown as TickerData;
}

describe('MÉDIA — gate ampliado: premissas declaradas, nunca fabricadas', () => {
  it('cvdDeltaUtils: sem magnitude fabricada; a premissa taker é constante declarada', () => {
    const content = read('src/utils/cvdDeltaUtils.ts');
    // antes: `|| 1000000` apresentava US$ 1M fabricado como volume taker
    expect(content).not.toMatch(/\|\|\s*1000000/);
    // a premissa de escala EXISTE como constante única e declarada
    expect(content).toMatch(/export const ASSUMED_TAKER_SHARE_OF_QUOTE_VOLUME/);
    expect(content).toMatch(/volumeBasis/);
  });

  it('cvdDeltaUtils (comportamental): sem volume da exchange ⇒ USD 0 e base ABSENT', () => {
    const metrics = computeCvdDeltaMetrics(
      bareTicker({ symbol: 'X', quoteVolume24h: 0, volume24h: 0, price: 0, takerBuyRatio: 0.6 })
    );
    expect(metrics.volumeBasis).toBe('ABSENT');
    expect(metrics.totalTakerVolumeUsd).toBe(0);
    expect(metrics.takerBuyVolumeUsd).toBe(0);
    expect(metrics.takerSellVolumeUsd).toBe(0);
  });

  it('cvdDeltaUtils (comportamental): volume medido escala pela premissa declarada', () => {
    const metrics = computeCvdDeltaMetrics(
      bareTicker({ symbol: 'X', quoteVolume24h: 100_000_000, price: 1, takerBuyRatio: 0.6 })
    );
    expect(metrics.volumeBasis).toBe('MEASURED_24H');
    expect(metrics.assumedTakerShareOfQuoteVolume).toBe(ASSUMED_TAKER_SHARE_OF_QUOTE_VOLUME);
    expect(metrics.totalTakerVolumeUsd).toBeCloseTo(100_000_000 * ASSUMED_TAKER_SHARE_OF_QUOTE_VOLUME, 6);
    // a razão compra/venda é medida (0.6), não a premissa de escala
    expect(metrics.takerBuyRatioPct).toBeCloseTo(60, 2);
  });

  it('PrimeOpportunityBanner: sem `?? 0.52`; ratio não medido ⇒ n/d na tela', () => {
    const content = read('src/components/PrimeOpportunityBanner.tsx');
    expect(content).not.toMatch(/\?\?\s*0\.52/);
    expect(content).toMatch(/ratioMeasured/);
    expect(content).toMatch(/n\/d/);
  });

  it('volumeScreenerUtils: sem Math.random e sem neutro fabricado de taker ratio', () => {
    const content = read('src/utils/volumeScreenerUtils.ts');
    // antes: `ticker.takerBuyRatio || 0.50` apresentava 50% como se fosse medido
    expect(content).not.toMatch(/takerBuyRatio\s*\|\|\s*0\.5/);
    // ausência declarada: o campo é anulável e a pressão vira UNKNOWN ("n/d")
    expect(content).toMatch(/'UNKNOWN'/);
  });
});
