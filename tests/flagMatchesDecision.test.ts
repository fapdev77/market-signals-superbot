import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 8.2.5 / CA-2.5 — o CI falha se `ENTRY_CONFIRMATION_ENABLED` do `.env.example`
 * divergir do veredito registrado em `docs/evidence/entry-confirmation-verdict.json`.
 *
 * O veredito é regenerado por `npm run compare:entry -- --register` a partir do
 * relatório pareado (regra v2, 8.2.2). Enquanto for PROVISÓRIO, o dono responde pelo
 * aceite registrado.
 */

const root = process.cwd();

function envFlag(): boolean {
  const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  const match = envExample.match(/^\s*ENTRY_CONFIRMATION_ENABLED\s*=\s*"?([^"\r\n]+)"?/m);
  expect(match, 'ENTRY_CONFIRMATION_ENABLED ausente em .env.example').not.toBeNull();
  return String(match![1]).trim() === 'true';
}

function registeredVerdict(): { entryConfirmationEnabled: boolean; rule: string; provisional?: boolean } {
  const raw = fs.readFileSync(
    path.join(root, 'docs', 'evidence', 'entry-confirmation-verdict.json'),
    'utf8'
  );
  return JSON.parse(raw);
}

describe('8.2.5 / CA-2.5 — a flag documentada casa com o veredito registrado', () => {
  it('ENTRY_CONFIRMATION_ENABLED == veredito registrado', () => {
    const verdict = registeredVerdict();
    expect(typeof verdict.entryConfirmationEnabled).toBe('boolean');
    expect(envFlag()).toBe(verdict.entryConfirmationEnabled);
  });

  it('o veredito registrado usa a regra v2', () => {
    expect(registeredVerdict().rule).toBe('v2');
  });
});
