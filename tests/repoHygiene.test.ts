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
});
