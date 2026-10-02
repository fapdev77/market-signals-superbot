import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();

/**
 * 6.0.4 — Higiene do repositório.
 *
 * Falha se:
 *  - existir `bun.lock`/`bun.lockb` (o projeto usa somente npm);
 *  - alguma dependência declarada no `package.json` estiver ausente do `package-lock.json`.
 *
 * A função é pura sobre um diretório raiz para poder ser verificada com um
 * diretório temporário (CA-0.2).
 */
export function repoHygieneViolations(root: string): string[] {
  const violations: string[] = [];

  for (const lock of ['bun.lock', 'bun.lockb']) {
    if (fs.existsSync(path.join(root, lock))) {
      violations.push(`arquivo proibido presente: ${lock}`);
    }
  }

  const pkgPath = path.join(root, 'package.json');
  const lockPath = path.join(root, 'package-lock.json');
  if (!fs.existsSync(pkgPath)) {
    violations.push('package.json ausente');
    return violations;
  }
  if (!fs.existsSync(lockPath)) {
    violations.push('package-lock.json ausente');
    return violations;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

  const declared = new Set<string>([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.optionalDependencies || {}),
  ]);

  const packages = lock.packages || {};
  for (const name of declared) {
    if (!packages[`node_modules/${name}`]) {
      violations.push(`dependência fora do lock: ${name}`);
    }
  }

  return violations;
}

/**
 * 7.0.3 / CA-0.3 — Verificação OFFLINE da integridade do lock.
 *
 * Não consulta a rede (isso é papel do `verify:lock`): garante que todo
 * `integrity` presente é `sha512-` com base64 de 64 bytes e que `resolved`
 * (quando do registry oficial) e `version` são coerentes entre si.
 */
export function lockIntegrityViolations(lock: unknown): string[] {
  const violations: string[] = [];
  const packages = (lock as { packages?: Record<string, Record<string, unknown>> })?.packages || {};

  for (const [key, entry] of Object.entries(packages)) {
    if (!entry || typeof entry !== 'object') continue;

    const integrity = entry.integrity;
    if (integrity !== undefined) {
      const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(String(integrity));
      if (!match) {
        violations.push(`integrity malformada em ${key}`);
      } else if (Buffer.from(match[1], 'base64').length !== 64) {
        violations.push(`integrity não tem 64 bytes em ${key}`);
      }
    }

    const resolved = entry.resolved;
    if (
      typeof resolved === 'string' &&
      resolved.startsWith('https://registry.npmjs.org/') &&
      entry.version &&
      key.startsWith('node_modules/')
    ) {
      const name = key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
      const file = resolved.split('/').pop() || '';
      const expected = `${name.replace(/^@[^/]+\//, '')}-${String(entry.version)}.tgz`;
      if (file !== expected) {
        violations.push(`resolved/version incoerentes em ${key}: ${file} != ${expected}`);
      }
    }
  }

  return violations;
}

describe('G-01 / 6.0.4 — Higiene do repositório', () => {
  it('o repositório real está limpo (sem bun.lock e com lock completo)', () => {
    expect(repoHygieneViolations(repoRoot)).toEqual([]);
  });

  it('CA-0.2: detecta a reintrodução de bun.lock num diretório temporário', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-hygiene-'));
    try {
      fs.writeFileSync(
        path.join(tmp, 'package.json'),
        JSON.stringify({ dependencies: { cors: '^2.8.6' } })
      );
      fs.writeFileSync(
        path.join(tmp, 'package-lock.json'),
        JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/cors': { version: '2.8.6' } } })
      );

      expect(repoHygieneViolations(tmp)).toEqual([]);

      fs.writeFileSync(path.join(tmp, 'bun.lock'), '# not allowed');
      expect(repoHygieneViolations(tmp)).toContain('arquivo proibido presente: bun.lock');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('detecta dependência declarada ausente do package-lock.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-hygiene-'));
    try {
      fs.writeFileSync(
        path.join(tmp, 'package.json'),
        JSON.stringify({ dependencies: { cors: '^2.8.6', '@types/cors': '^2.8.19' } })
      );
      fs.writeFileSync(
        path.join(tmp, 'package-lock.json'),
        JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/cors': { version: '2.8.6' } } })
      );

      const violations = repoHygieneViolations(tmp);
      expect(violations).toContain('dependência fora do lock: @types/cors');
      expect(violations).not.toContain('dependência fora do lock: cors');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('package-lock.json usa lockfileVersion >= 2 (npm 7+)', () => {
    const lock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));
    expect(lock.lockfileVersion).toBeGreaterThanOrEqual(2);
  });

  it('7.0.3: o lock real tem integridade bem formada e resolved/version coerentes', () => {
    const lock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8'));
    expect(lockIntegrityViolations(lock)).toEqual([]);
  });

  it('CA-0.3: falha para um `integrity` malformado', () => {
    const bad = {
      lockfileVersion: 3,
      packages: {
        'node_modules/cors': { version: '2.8.6', resolved: 'https://registry.npmjs.org/cors/-/cors-2.8.6.tgz', integrity: 'sha512-not-base64!!' }
      }
    };
    expect(lockIntegrityViolations(bad)).toContain('integrity malformada em node_modules/cors');
  });

  it('CA-0.3: falha quando resolved e version divergem', () => {
    const bad = {
      lockfileVersion: 3,
      packages: {
        'node_modules/cors': {
          version: '2.8.6',
          resolved: 'https://registry.npmjs.org/cors/-/cors-2.8.0.tgz',
          integrity: 'sha512-' + Buffer.alloc(64, 1).toString('base64')
        }
      }
    };
    expect(lockIntegrityViolations(bad).some(v => v.includes('resolved/version incoerentes'))).toBe(true);
  });
});
