import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 6.5.1 / CA-5.2 — teste estático: `toFixed` é proibido nos arquivos de CÁLCULO.
 *
 * `toFixed` formata para APRESENTAÇÃO com erros de arredondamento binário; em caminhos de
 * cálculo (PnL, taxas, slippage, R, agregações) isso contamina o resultado. A lista abaixo
 * é a configuração EXPLÍCITA do spec: qualquer `toFixed` que reapareça nestes arquivos
 * falha este teste. Formatação puramente de apresentação deve viver em outros módulos.
 */
const CALCULATION_FILES = [
  'server/services/positionResolution.ts',
  'server/services/BacktestEngine.ts',
  'server/services/EvidenceService.ts',
  'server/services/TickProcessor.ts',
  'server/services/FundingService.ts',
  'server/services/RiskManager.ts',
  'server/db.ts',
  'server/utils/decimal.ts'
];

/** Comentários que citam `toFixed` não são código; só linhas de código violam. */
function findToFixedViolations(content: string): string[] {
  const violations: string[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const code = line.replace(/\/\/.*$/, ''); // remove comentário de linha
    if (/\.toFixed\s*\(/.test(code)) {
      violations.push(`linha ${i + 1}: ${line.trim().slice(0, 120)}`);
    }
  }
  return violations;
}

describe('6.5.1 — CA-5.2: sem toFixed nos arquivos de cálculo', () => {
  it('nenhum arquivo da lista de cálculo contém .toFixed( em código', () => {
    const problems: string[] = [];
    for (const relPath of CALCULATION_FILES) {
      const absPath = path.join(process.cwd(), relPath);
      if (!fs.existsSync(absPath)) {
        problems.push(`arquivo de cálculo configurado não encontrado: ${relPath}`);
        continue;
      }
      const content = fs.readFileSync(absPath, 'utf8');
      for (const v of findToFixedViolations(content)) {
        problems.push(`${relPath} → ${v}`);
      }
    }
    expect(problems, `toFixed encontrado em caminho de cálculo:\n${problems.join('\n')}`).toEqual([]);
  });

  it('a lista de arquivos de cálculo é explícita e não vazia', () => {
    expect(CALCULATION_FILES.length).toBeGreaterThan(0);
    expect(CALCULATION_FILES).toContain('server/services/positionResolution.ts');
    expect(CALCULATION_FILES).toContain('server/services/BacktestEngine.ts');
  });
});
