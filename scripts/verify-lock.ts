/**
 * 7.0.2 — Verificação de integridade do `package-lock.json` contra o registry.
 *
 * Motivação (H-01): um lock com hashes inválidos já foi entregue e o `npm ci` só
 * falhou depois. O teste de higiene existente valida o *formato* offline; este
 * script fecha a lacuna consultando o registry oficial e comparando o
 * `dist.integrity` de cada tarball com o `integrity` gravado no lock.
 *
 * Uso:
 *   npm run verify:lock                 # confere contra https://registry.npmjs.org
 *   NPM_REGISTRY_URL=<url> npm run verify:lock
 *
 * Sai com código != 0 se houver qualquer divergência (CA-0.2). A função
 * `verifyLockEntries` é pura sobre um fetcher injetado, de modo que os testes
 * podem simular o registry sem rede.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface LockEntry {
  name: string;
  version: string;
  resolved: string;
  integrity: string;
}

export interface RegistryMeta {
  dist?: { integrity?: string };
}

export type FetchMeta = (name: string, version: string) => Promise<RegistryMeta | null>;

export interface Mismatch {
  name: string;
  version: string;
  /** Hash gravado no lock (esperado). */
  integrity: string;
  /** Hash devolvido pelo registry, quando houve resposta. */
  actual?: string;
  reason: string;
}

export interface VerifySummary {
  checked: number;
  matched: number;
  mismatches: Mismatch[];
}

/** Extrai o nome do pacote de uma chave de `packages` do lock (`node_modules/@scope/pkg`). */
export function packageNameFromPath(lockPath: string): string | null {
  const marker = 'node_modules/';
  const idx = lockPath.lastIndexOf(marker);
  if (idx === -1) return null;
  const name = lockPath.slice(idx + marker.length);
  return name.length > 0 ? name : null;
}

/** Coleta as entradas verificáveis: tarball do registry oficial COM `integrity`. */
export function collectRegistryEntries(lock: unknown): LockEntry[] {
  const packages = (lock as { packages?: Record<string, Record<string, unknown>> })?.packages || {};
  const out: LockEntry[] = [];
  for (const [key, entry] of Object.entries(packages)) {
    if (!entry || typeof entry !== 'object') continue;
    const resolved = typeof entry.resolved === 'string' ? entry.resolved : '';
    const integrity = typeof entry.integrity === 'string' ? entry.integrity : '';
    const name = packageNameFromPath(key);
    if (!name) continue;
    // Só tarballs do registry oficial e só quando há hash para comparar.
    if (!resolved.startsWith('https://registry.npmjs.org/')) continue;
    if (!integrity) continue;
    out.push({ name, version: String(entry.version || ''), resolved, integrity });
  }
  return out;
}

async function withRetry<T>(fn: () => Promise<T>, attempts: number, delayMs: number): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

/**
 * Confere cada entrada contra o registry (fetcher injetado), com concorrência
 * limitada e retry. Não lança: divergências e falhas de rede viram `mismatches`,
 * de modo que o CLI decide o código de saída.
 */
export async function verifyLockEntries(
  entries: LockEntry[],
  fetchMeta: FetchMeta,
  opts: { concurrency?: number; retries?: number; retryDelayMs?: number } = {}
): Promise<VerifySummary> {
  const concurrency = Math.max(1, opts.concurrency ?? 8);
  const retries = Math.max(1, opts.retries ?? 3);
  const retryDelayMs = opts.retryDelayMs ?? 250;

  const mismatches: Mismatch[] = [];
  let matched = 0;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < entries.length) {
      const entry = entries[cursor++];
      try {
        const meta = await withRetry(() => fetchMeta(entry.name, entry.version), retries, retryDelayMs);
        const actual = meta?.dist?.integrity;
        if (!actual) {
          mismatches.push({ ...entry, reason: 'registry não devolveu dist.integrity' });
        } else if (actual !== entry.integrity) {
          mismatches.push({ ...entry, actual, reason: 'integridade divergente do registry' });
        } else {
          matched++;
        }
      } catch (err) {
        mismatches.push({ ...entry, reason: `falha ao consultar o registry: ${err instanceof Error ? err.message : String(err)}` });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { checked: entries.length, matched, mismatches };
}

/** Fetcher padrão: `GET <registry>/<name>/<version>` e lê `dist.integrity`. */
export function defaultFetchMeta(registryUrl: string = 'https://registry.npmjs.org'): FetchMeta {
  return async (name, version) => {
    const encoded = name.replace('/', '%2f');
    const url = `${registryUrl.replace(/\/$/, '')}/${encoded}/${encodeURIComponent(version)}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} para ${name}@${version}`);
    return (await res.json()) as RegistryMeta;
  };
}

async function main(): Promise<void> {
  const lockPath = path.join(process.cwd(), 'package-lock.json');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const entries = collectRegistryEntries(lock);
  const registryUrl = process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org';

  if (entries.length === 0) {
    console.error('❌ verify:lock — nenhuma entrada verificável encontrada no package-lock.json.');
    process.exit(1);
  }

  const summary = await verifyLockEntries(entries, defaultFetchMeta(registryUrl), { concurrency: 8, retries: 3 });

  if (summary.mismatches.length > 0) {
    console.error(`\n❌ verify:lock — ${summary.mismatches.length} divergência(s) em ${summary.checked} entradas:`);
    for (const m of summary.mismatches) {
      console.error(`   ${m.name}@${m.version}: ${m.reason}${m.actual ? ` (lock: ${m.integrity.slice(0, 24)}… registry: ${m.actual.slice(0, 24)}…)` : ''}`);
    }
    process.exit(1);
  }

  console.log(`✅ verify:lock — ${summary.matched}/${summary.checked} integridades conferidas contra ${registryUrl}.`);
}

const invokedDirectly =
  !!process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('scripts/verify-lock.ts');

if (invokedDirectly) {
  main().catch(err => {
    console.error('verify:lock falhou:', err);
    process.exit(1);
  });
}
