import { describe, it, expect } from 'vitest';
import { scoreConfluence, SCORING_MODEL } from '../server/signalEngine';

/**
 * A-01 (FASE 1) — o `confluenceScore` deve medir FORÇA sem saturar.
 *
 * Contrato:
 *  - nunca retorna 100 (não colapsa bandas no topo);
 *  - é estritamente crescente na força (sinais de força diferente com score igual
 *    só podem coincidir por arredondamento de 1 ponto, nunca por saturação);
 *  - preserva o mapeamento linear histórico (`1.2·x + 25`) até o joelho, para
 *    não alterar o significado dos gates já configurados (`minConfluenceScore`);
 *  - a DIREÇÃO é reportada separadamente (`direction`), já que o score é magnitude.
 */

describe('A-01 — modelo de score de confluência', () => {
  it('preserva o mapeamento linear histórico até o joelho (compatibilidade de gates)', () => {
    const { slope, intercept, knee } = SCORING_MODEL;
    for (let points = 0; points <= knee; points += 1) {
      expect(scoreConfluence(points).score).toBe(Math.round(slope * points + intercept));
    }
    // Os gates operacionais vivem nessa faixa (minConfluence 58..74 ⇒ |netScore| 27.5..40.8).
    expect(scoreConfluence(27.5).score).toBe(58);
    expect(scoreConfluence(40.8).score).toBe(74);
  });

  it('não satura: forças distintas no topo produzem scores distintos', () => {
    const a = scoreConfluence(62.5).score;   // era 100 (saturava)
    const b = scoreConfluence(100).score;    // era 100
    const c = scoreConfluence(193).score;    // era 100

    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeLessThan(100);
  });

  it('nunca retorna 100 para nenhuma força realista', () => {
    for (const points of [0, 25, 45, 62.5, 100, 193.5, 500, 5000]) {
      expect(scoreConfluence(points).score).toBeLessThan(100);
    }
  });

  it('é monotônica não decrescente em toda a faixa de força', () => {
    let previous = -1;
    for (let points = 0; points <= 400; points += 1) {
      const { score } = scoreConfluence(points);
      expect(score).toBeGreaterThanOrEqual(previous);
      previous = score;
    }
  });

  it('separa direção de magnitude (o score é só força)', () => {
    expect(scoreConfluence(40).direction).toBe('BULLISH');
    expect(scoreConfluence(-40).direction).toBe('BEARISH');
    expect(scoreConfluence(0).direction).toBe('NEUTRAL');

    // mesmo score, direções opostas — a direção existe fora do número
    expect(scoreConfluence(40).score).toBe(scoreConfluence(-40).score);
    expect(scoreConfluence(40).direction).not.toBe(scoreConfluence(-40).direction);
  });

  it('reporta os pontos brutos para auditoria', () => {
    expect(scoreConfluence(37).netPoints).toBe(37);
    expect(scoreConfluence(-37).netPoints).toBe(-37);
  });

  it('o modelo é versionado', () => {
    expect(SCORING_MODEL.version).toBeGreaterThanOrEqual(1);
  });
});
