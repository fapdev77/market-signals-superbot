/**
 * 6.8.5/CA-8.4 — Baseline de qualidade.
 *
 * Mede `any` explícitos e `catch` vazios em `src/` e `server/`, compara com a
 * linha de base commitada (`scripts/quality-baseline.json`) e FALHA se a
 * contagem aumentar (a CI roda este script sem flags; a migração para
 * `strict: true` fica planejada para a Fase 7).
 *
 * Uso:
 *   npx tsx scripts/quality-baseline.ts            # gate: falha se piorou
 *   npx tsx scripts/quality-baseline.ts --update   # regenera a baseline (deliberado)
 *   npx tsx scripts/quality-baseline.ts --report   # só imprime os números
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, 'scripts', 'quality-baseline.json');
const SCAN_DIRS = ['src', 'server'];
const SCAN_FILES = ['server.ts'];
const EXTENSIONS = /\.(ts|tsx)$/;

interface Counts {
  explicitAny: number;
  emptyCatch: number;
}

function countInContent(content: string): Counts {
  let explicitAny = 0;
  let emptyCatch = 0;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Heurística de linha (o spec pede contagem como baseline, não precisão de AST):
    // `: any`, `<any>`, `as any`, `any[]`, `| any` — ignora comentários e strings `any`.
    const code = line.replace(/\/\/.*$/, '');
    if (/[:(<|\s=]any\b|any\[\]|as any\b/.test(code) && !/\bany\b\s*[=:]\s*\d/.test(code)) {
      explicitAny += (code.match(/[:(<|\s=]any\b|any\[\]|as any\b/g) || []).length;
    }
    // `catch { }` ou `catch (e) { }` na mesma linha, ou `catch ... {` seguido de `}` imediato.
    const catchMatch = code.match(/catch\s*(\([^)]*\))?\s*\{\s*\}/);
    if (catchMatch) {
      emptyCatch++;
    } else if (/catch\s*(\([^)]*\))?\s*\{\s*$/.test(code)) {
      const next = (lines[i + 1] || '').trim();
      if (next === '}' || next === '};') emptyCatch++;
    }
  }
  return { explicitAny, emptyCatch };
}

function scan(): { total: Counts; perFile: Record<string, Counts> } {
  const perFile: Record<string, Counts> = {};
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(full);
      } else if (EXTENSIONS.test(entry.name)) {
        const rel = path.relative(ROOT, full).replace(/\\/g, '/');
        perFile[rel] = countInContent(fs.readFileSync(full, 'utf8'));
      }
    }
  };
  for (const dir of SCAN_DIRS) walk(path.join(ROOT, dir));
  for (const file of SCAN_FILES) {
    const full = path.join(ROOT, file);
    if (fs.existsSync(full)) perFile[file] = countInContent(fs.readFileSync(full, 'utf8'));
  }

  const total = Object.values(perFile).reduce(
    (acc, c) => ({ explicitAny: acc.explicitAny + c.explicitAny, emptyCatch: acc.emptyCatch + c.emptyCatch }),
    { explicitAny: 0, emptyCatch: 0 }
  );
  return { total, perFile };
}

const args = process.argv.slice(2);
const doUpdate = args.includes('--update');
const reportOnly = args.includes('--report');

const { total, perFile } = scan();

if (reportOnly) {
  console.log('any explícitos:', total.explicitAny);
  console.log('catch vazios:  ', total.emptyCatch);
  process.exit(0);
}

if (doUpdate || !fs.existsSync(BASELINE_PATH)) {
  fs.writeFileSync(BASELINE_PATH, JSON.stringify({ updatedAt: new Date().toISOString().slice(0, 10), ...total }, null, 2) + '\n');
  console.log(`Baseline ${doUpdate ? 'atualizada' : 'criada'}: ${JSON.stringify(total)}`);
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Counts;
console.log(`Baseline:  any=${baseline.explicitAny} catchVazios=${baseline.emptyCatch}`);
console.log(`Atual:     any=${total.explicitAny} catchVazios=${total.emptyCatch}`);

const regressions: string[] = [];
if (total.explicitAny > baseline.explicitAny) {
  regressions.push(`any explícitos aumentaram (${baseline.explicitAny} → ${total.explicitAny})`);
}
if (total.emptyCatch > baseline.emptyCatch) {
  regressions.push(`catch vazios aumentaram (${baseline.emptyCatch} → ${total.emptyCatch})`);
}

if (regressions.length > 0) {
  console.error(`\n❌ CA-8.4: ${regressions.join('; ')}.`);
  console.error('   Corrija os novos casos ou, se deliberado, rode `npx tsx scripts/quality-baseline.ts --update` e justifique no PR.');
  // Top 5 arquivos com mais `any` para orientar a correção:
  const worst = Object.entries(perFile).sort((a, b) => b[1].explicitAny - a[1].explicitAny).slice(0, 5);
  for (const [file, c] of worst) console.error(`   ${file}: any=${c.explicitAny} catchVazios=${c.emptyCatch}`);
  process.exit(1);
}

console.log('✅ Sem aumento de `any`/`catch` vazios em relação à baseline (CA-8.4).');
void perFile;
