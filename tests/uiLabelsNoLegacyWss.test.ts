import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 7.6.1 / CA-6.1 — nenhum arquivo de `src/` contém a string `fstream.binance.com`
 * em rótulos de UI. O estado real separa o stream do servidor para o navegador do
 * estado do WebSocket a montante (feed-health).
 */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('7.6.1 / CA-6.1 — rótulos de UI sem host upstream legado', () => {
  it('nenhum arquivo de src/ cita fstream.binance.com', () => {
    const root = path.join(process.cwd(), 'src');
    const offenders = walk(root).filter(file =>
      fs.readFileSync(file, 'utf8').includes('fstream.binance.com')
    );
    expect(offenders).toEqual([]);
  });
});
