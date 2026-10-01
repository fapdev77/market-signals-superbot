import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * T6.8.5 / CA-8.5 — Teste estático de variáveis de ambiente documentadas.
 *
 * Toda `process.env.X` usada em `server/` e `server.ts` precisa aparecer no
 * `.env.example`. Usar uma variável não documentada faz este teste falhar —
 * o operador nunca descobre variável "secreta" só lendo o código.
 *
 * Variáveis dinâmicas (prefixo + sufixo, ex.: `MAX_STOP_PCT_<CATEGORIA>`) são
 * cobertas por declarações de PREFIXO_ no .env.example (comentadas com o
 * sufixo entre colchetes).
 */
describe('T6.8.5 — Toda env usada no servidor está documentada (CA-8.5)', () => {
  const root = process.cwd();
  const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

  /** Coleta todos os `process.env.X` (estáticos) dos arquivos do servidor. */
  const collectUsedEnvVars = (): { vars: Set<string>; dynamicBases: Set<string>; files: string[] } => {
    const vars = new Set<string>();
    const dynamicBases = new Set<string>();
    const files: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(ts|js)$/.test(entry.name)) continue;
        files.push(path.relative(root, full));
        const content = fs.readFileSync(full, 'utf8');
        // Estáticos: process.env.NOME
        for (const m of content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
          vars.add(m[1]);
        }
        // Dinâmicos: process.env[`PREFIXO_${x}`] ou process.env[var]
        for (const m of content.matchAll(/process\.env\[`([A-Z0-9_]+)_\$\{/g)) {
          dynamicBases.add(m[1]);
        }
      }
    };
    walk(path.join(root, 'server'));
    const serverTs = path.join(root, 'server.ts');
    if (fs.existsSync(serverTs)) {
      files.push('server.ts');
      const content = fs.readFileSync(serverTs, 'utf8');
      for (const m of content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) vars.add(m[1]);
      for (const m of content.matchAll(/process\.env\[`([A-Z0-9_]+)_\$\{/g)) dynamicBases.add(m[1]);
    }
    return { vars, dynamicBases, files };
  };

  it('toda process.env.X usada em server/ e server.ts aparece no .env.example', () => {
    const { vars, files } = collectUsedEnvVars();
    expect(files.length, 'nenhum arquivo do servidor varrido — o teste quebrou').toBeGreaterThan(0);

    // VITEST é do runner de testes, não configura o app; sem valor operacional pro operador.
    const TEST_ONLY_VARS = new Set(['VITEST']);

    const undocumented = [...vars]
      .filter(v => !TEST_ONLY_VARS.has(v))
      .filter(v => !envExample.includes(v));

    expect(
      undocumented,
      `variáveis de ambiente usadas no servidor mas ausentes do .env.example: ${undocumented.join(', ')}`
    ).toEqual([]);
  });

  it('prefixos dinâmicos (ex.: MAX_STOP_PCT_*) têm os sufixos documentados', () => {
    const { dynamicBases } = collectUsedEnvVars();
    // MAX_STOP_PCT_<CAT>: caps calibrados D7 (ver specs/phase-6-plan.md §6.7).
    if (dynamicBases.has('MAX_STOP_PCT')) {
      for (const suffix of ['SCALP', 'DAY_TRADE', 'INTRADAY', 'COUNTER_TRADE', 'SWING', 'POSITION', 'CUSTOM']) {
        expect(envExample).toContain(`MAX_STOP_PCT_${suffix}`);
      }
    }
  });

  it('falha ao usar uma variável não documentada (sanidade do mecanismo — CA-8.5)', () => {
    // Simula o mecanismo: uma variável inventada não pode passar no filtro.
    const invented = 'CERTAMENTE_NAO_DOCUMENTADA_9Z';
    const passes = envExample.includes(invented);
    expect(passes).toBe(false);
  });

  it('.env.example existe e não está vazio', () => {
    expect(envExample.trim().length).toBeGreaterThan(50);
  });
});
