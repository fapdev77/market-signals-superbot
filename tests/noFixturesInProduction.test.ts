import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 7.1.1 / CA-1.3 — Nenhum arquivo de produção (server/ ou server.ts) pode
 * referenciar `tests/` ou fixtures. Antes, o registro TradFi caía para uma
 * fixture velha do diretório de testes, tratando dado de teste como dado vivo.
 */

const ROOT = process.cwd();

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('7.1.1 / CA-1.3 — sem fixtures em produção', () => {
  it('nenhum arquivo de server/ ou server.ts referencia tests/ ou fixtures', () => {
    const files = [...collectSourceFiles(path.join(ROOT, 'server'))];
    const serverTs = path.join(ROOT, 'server.ts');
    if (fs.existsSync(serverTs)) files.push(serverTs);

    const offenders: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      // Referência real = caminho/assinatura (`tests/`, 'fixtures/…', '…fixtures').
      // Menção em prosa de comentário ("fixtures antigas") não é dependência de
      // dados de teste — o regex amplo `/fixtures/i` dava falso positivo nisso.
      const referencesTestAssets =
        /\btests\//.test(content) ||
        /fixtures[\\/'"]/i.test(content) ||
        /[\\/'"]fixtures/i.test(content);
      if (referencesTestAssets) {
        offenders.push(path.relative(ROOT, file).replace(/\\/g, '/'));
      }
    }

    expect(offenders).toEqual([]);
  });
});
