/**
 * SDD Fase 9 / S2 (B3) — honestidade do rótulo de score na UI.
 *
 * RED tests para `describeScore`.
 *
 * O defeito que este arquivo existe para impedir: a UI mostrava `NN% CONFLUÊNCIA`, e o
 * operador lia "72%" como "72% de chance". Não era. `confluenceScore` mede FORÇA de
 * confluência entre fatores, e `netScore = 0` — nenhum fator a favor, nenhum contra —
 * produz 25%. Um número que começa em 25 sem nenhuma informação e nunca sai de 100 não é
 * uma probabilidade, e exibir como se fosse é o erro mais caro desta tela: ele muda a
 * decisão de entrar ou não na operação.
 *
 * Aqui a regra é dura:
 *  1. o texto primário NUNCA mostra o score como porcentagem de chance;
 *  2. sem calibração, a UI tem que dizer que não tem base rate — não pode simplesmente
 *     omitir o número e deixar o operador concluir que 72% é uma medida;
 *  3. com amostra suficiente, a expectativa em R aparece junto do score;
 *  4. a cor segue a expectativa calibrada (edge), não a força — força alta com edge
 *     negativa é o caso perigoso e tem de aparecer como risco.
 */
import { describe, it, expect } from 'vitest';
import { describeScore } from '../src/utils/scoreDisplay.js';
import fs from 'node:fs';
import path from 'node:path';

const calibrated = (over: Record<string, unknown> = {}) => ({
  expectancyR: 0.18,
  sampleSize: 96,
  confidence: 'CALIBRATED' as const,
  label: '+0.180 R/sinal — medido em 96 sinais fechados',
  ...over
});

describe('B3.1 — o score nunca aparece como probabilidade', () => {
  it('sem calibração, o rótulo primário é força e não porcentagem', () => {
    const d = describeScore(72, null);
    expect(d.primary).not.toMatch(/72\s*%/);
    expect(d.primary.toLowerCase()).toContain('for');
    expect(d.primary).toContain('72');
  });

  it('sem calibração, a UI declara que não há base rate', () => {
    const d = describeScore(72, null);
    expect(d.insufficientSample).toBe(true);
    expect(d.secondary.toLowerCase()).toMatch(/sem base rate|amostra/);
  });

  it('com calibração, a expectativa em R aparece no rótulo secundário', () => {
    const d = describeScore(72, calibrated());
    expect(d.secondary).toContain('R');
    expect(d.secondary).not.toMatch(/\d+\s*%/);
    expect(d.insufficientSample).toBe(false);
  });
});

describe('B3.2 — a cor segue o edge, não a força', () => {
  it('expectativa positiva e calibrada é positiva', () => {
    expect(describeScore(72, calibrated()).tone).toBe('positive');
  });

  it('força alta com expectativa negativa é risco, não oportunidade', () => {
    // O caso que a tela antiga escondia: 88 de força, -0.22 R por sinal.
    const d = describeScore(88, calibrated({ expectancyR: -0.22, label: '-0.220 R/sinal — medido em 140 sinais fechados' }));
    expect(d.tone).toBe('negative');
    expect(d.primary).toContain('88');
  });

  it('expectativa zero é neutra (não positivo, não negativo)', () => {
    expect(describeScore(72, calibrated({ expectancyR: 0 })).tone).toBe('neutral');
  });

  it('sem calibração o tom é neutro — não paints de verde um número sem lastro', () => {
    expect(describeScore(95, null).tone).toBe('neutral');
  });
});

describe('B3.3 — amostra insuficiente é dita, não escondida', () => {
  it('THIN_SAMPLE marca insuficiência mas ainda mostra o número medido', () => {
    const d = describeScore(72, calibrated({ confidence: 'THIN_SAMPLE', sampleSize: 8, label: '+0.050 R/sinal — amostra fraca (n=8, mínimo 30)' }));
    expect(d.insufficientSample).toBe(true);
    expect(d.secondary).toContain('n=8');
  });

  it('UNCALIBRATED mantém o tom neutro mesmo com R positivo herdado do prior', () => {
    const d = describeScore(72, calibrated({ confidence: 'UNCALIBRATED', sampleSize: 0, expectancyR: 0.05, label: '+0.050 R/sinal — sem amostra (base rate global)' }));
    expect(d.insufficientSample).toBe(true);
    expect(d.tone).toBe('neutral');
  });

  it('o title explica a diferença entre força e probabilidade', () => {
    const d = describeScore(72, calibrated());
    expect(d.title.toLowerCase()).toMatch(/for[çc]a|probabilidade/);
  });
});

/**
 * Guarda de regressão sobre o código-fonte, não apenas sobre a função.
 *
 * Um teste que só exercita `describeScore` continua verde mesmo se alguém
 * reintroduzir `Confluência ${x}%` direto num componente ou numa nota de posição:
 * a função está correta e a tela continua mentindo. Aqui a regra é sobre o texto
 * que chega ao operador.
 *
 * A única ocorrência de `${...confluenceScore}%` tolerada é a LARGURA de uma barra —
 * `style={{ width: ... }}` não afirma probabilidade, é geometria.
 */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('B3.4 — nenhum ponto da UI rotula o score como porcentagem', () => {
  const offenders: string[] = [];

  for (const file of sourceFiles(path.join(process.cwd(), 'src'))) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!/confluenceScore\}%/.test(line)) return;
      if (/width\s*:/.test(line)) return;
      offenders.push(`${path.relative(process.cwd(), file)}:${i + 1} — ${line.trim()}`);
    });
  }

  it("não existe `confluenceScore}%` fora da largura de uma barra", () => {
    expect(offenders).toEqual([]);
  });
});
