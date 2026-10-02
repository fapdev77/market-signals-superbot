import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
  collectRegistryEntries,
  verifyLockEntries,
  packageNameFromPath,
  type FetchMeta,
  type LockEntry
} from '../scripts/verify-lock';

/**
 * 7.0.2 / CA-0.2 — `verify:lock` aponta divergências de integridade sem tocar a
 * rede: o registry é simulado por um fetcher injetado.
 */

function entry(name: string, version: string, integrity: string): LockEntry {
  return { name, version, resolved: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`, integrity };
}

const INT_A = 'sha512-' + Buffer.alloc(64, 1).toString('base64');
const INT_B = 'sha512-' + Buffer.alloc(64, 2).toString('base64');

describe('7.0.2 — verify:lock', () => {
  it('packageNameFromPath extrai nomes simples e com escopo (inclui aninhados)', () => {
    expect(packageNameFromPath('node_modules/cors')).toBe('cors');
    expect(packageNameFromPath('node_modules/@types/cors')).toBe('@types/cors');
    expect(packageNameFromPath('node_modules/a/node_modules/b')).toBe('b');
    expect(packageNameFromPath('')).toBeNull();
  });

  it('CA-0.2: registry concordante ⇒ nenhuma divergência', async () => {
    const fetchMeta: FetchMeta = async () => ({ dist: { integrity: INT_A } });
    const summary = await verifyLockEntries([entry('cors', '2.8.6', INT_A)], fetchMeta);
    expect(summary.mismatches).toEqual([]);
    expect(summary.matched).toBe(1);
  });

  it('CA-0.2: hash adulterado no lock ⇒ divergência reportada (exit != 0 no CLI)', async () => {
    // lock diz INT_B, registry diz INT_A
    const fetchMeta: FetchMeta = async () => ({ dist: { integrity: INT_A } });
    const summary = await verifyLockEntries([entry('cors', '2.8.6', INT_B)], fetchMeta);
    expect(summary.mismatches).toHaveLength(1);
    expect(summary.mismatches[0]).toMatchObject({ name: 'cors', version: '2.8.6', actual: INT_A });
  });

  it('registry sem dist.integrity é tratado como divergência, não como sucesso', async () => {
    const fetchMeta: FetchMeta = async () => ({});
    const summary = await verifyLockEntries([entry('cors', '2.8.6', INT_A)], fetchMeta);
    expect(summary.mismatches).toHaveLength(1);
    expect(summary.mismatches[0].reason).toContain('dist.integrity');
  });

  it('falha transitória de rede é retentada e depois resolve', async () => {
    let calls = 0;
    const fetchMeta: FetchMeta = async () => {
      calls++;
      if (calls < 2) throw new Error('ECONNRESET simulada');
      return { dist: { integrity: INT_A } };
    };
    const summary = await verifyLockEntries([entry('cors', '2.8.6', INT_A)], fetchMeta, {
      retries: 3,
      retryDelayMs: 1
    });
    expect(summary.mismatches).toEqual([]);
    expect(calls).toBe(2);
  });

  it('falha persistente vira divergência (não derruba a verificação inteira)', async () => {
    const fetchMeta: FetchMeta = async () => {
      throw new Error('indisponível');
    };
    const summary = await verifyLockEntries([entry('cors', '2.8.6', INT_A)], fetchMeta, {
      retries: 2,
      retryDelayMs: 1
    });
    expect(summary.mismatches).toHaveLength(1);
    expect(summary.mismatches[0].reason).toContain('registry');
  });

  it('collectRegistryEntries usa o lock real e ignora entradas sem resolved/integrity', () => {
    const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
    const entries = collectRegistryEntries(lock);
    // O lock atual tem entradas verificáveis; todas apontam para o registry oficial.
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(e => e.resolved.startsWith('https://registry.npmjs.org/'))).toBe(true);
    const cors = entries.find(e => e.name === 'cors');
    expect(cors?.version).toBe('2.8.6');
  });
});
