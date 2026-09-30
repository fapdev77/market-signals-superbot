import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/binance');

function fixtureFiles(): string[] {
  return fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
}

describe('6.1.2 / CA-1.2 — integridade das fixtures commitadas', () => {
  it('toda fixture tem _meta.capturedAt válido', () => {
    const files = fixtureFiles();
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const json = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf8'));
      expect(json._meta).toBeTruthy();
      expect(typeof json._meta.capturedAt).toBe('string');
      expect(Number.isNaN(Date.parse(json._meta.capturedAt))).toBe(false);
      expect(typeof json._meta.serverTimeFromTimeEndpoint).toBe('number');
    }
  });

  it('exchangeInfo fixture: todos os símbolos têm filters', () => {
    const json = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'exchangeInfo.json'), 'utf8'));
    expect(Array.isArray(json.symbols)).toBe(true);
    expect(json.symbols.length).toBeGreaterThan(0);

    const semFilters = json.symbols.filter((s: any) => !Array.isArray(s.filters) || s.filters.length === 0);
    expect(semFilters.map((s: any) => s.symbol)).toEqual([]);
  });

  it('tradingSchedule fixture preserva marketSchedules', () => {
    const json = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'tradingSchedule.json'), 'utf8'));
    expect(json.marketSchedules).toBeTruthy();
  });
});
