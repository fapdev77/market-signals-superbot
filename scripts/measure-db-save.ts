/**
 * Mede o custo e a frequência de gravação do banco unificado (sql.js reescreve a imagem
 * inteira a cada save). Serve para verificar o efeito do coalescing de `scheduleDbSave()`
 * sem depender de rede: simula o loop de mercado (5 mutações a cada 4 s) e uma rajada.
 *
 * Trabalha sempre sobre uma CÓPIA do banco real (nunca o original) e apaga a cópia e o
 * `.tmp` ao final. Uso: `npm run measure:db-save`
 */
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import {
  getDb,
  setDatabaseFilePathForTests,
  flushDbSave,
  scheduleDbSave,
  saveIndicatorWeights,
  getIndicatorWeights
} from '../server/db.js';

const REAL_DB = path.join(process.cwd(), 'data', 'superbot.sqlite');
const COPY_DB = path.join(process.cwd(), 'data', '.measure-copy.sqlite');
const TICK_MS = 4000;
const MUTATIONS_PER_TICK = 5;
const TICKS = 5;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

async function main() {
  if (!fs.existsSync(REAL_DB)) throw new Error(`Banco real não encontrado: ${REAL_DB}`);
  for (const p of [COPY_DB, `${COPY_DB}.tmp`]) if (fs.existsSync(p)) fs.unlinkSync(p);

  const sizeBytes = fs.statSync(REAL_DB).size;
  const copyStart = performance.now();
  fs.copyFileSync(REAL_DB, COPY_DB);
  const copyMs = performance.now() - copyStart;

  setDatabaseFilePathForTests(COPY_DB);
  const bootStart = performance.now();
  await getDb();
  const bootMs = performance.now() - bootStart;

  console.log('\n================ MEDIÇÃO: gravação do banco unificado ================');
  console.log(`Imagem do banco ............: ${mb(sizeBytes)} MB (cópia em ${copyMs.toFixed(0)} ms)`);
  console.log(`Boot (sql.js + migrações) ..: ${bootMs.toFixed(0)} ms`);

  // Custo de UMA gravação de imagem inteira — exatamente o trabalho que o coalescing evita repetir.
  const writeMs: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    flushDbSave();
    writeMs.push(performance.now() - t);
  }
  const avgWrite = writeMs.reduce((a, b) => a + b, 0) / writeMs.length;
  const maxWrite = Math.max(...writeMs);
  console.log(`Gravação síncrona (n=3) ....: média ${avgWrite.toFixed(0)} ms · pior ${maxWrite.toFixed(0)} ms (bloqueia o event loop)`);

  // Conta gravações reais observando o mtime do arquivo de destino.
  let writes = 0;
  let lastMtime = fs.statSync(COPY_DB).mtimeMs;
  const poller = setInterval(() => {
    try {
      const m = fs.statSync(COPY_DB).mtimeMs;
      if (m !== lastMtime) {
        lastMtime = m;
        writes++;
      }
    } catch {
      /* arquivo em transição de rename: o próximo poll pega o mtime novo */
    }
  }, 20);
  await sleep(150);

  // (1) Rajada correlacionada: 50 mutações no mesmo tick.
  for (let i = 0; i < 50; i++) scheduleDbSave();
  await sleep(Math.max(2000, avgWrite + 500));
  const burstMut = 50;
  const burstWrites = writes;
  writes = 0;

  // (2) Padrão do loop de mercado: 5 mutações a cada 4 s.
  const weights = await getIndicatorWeights();
  const tickStart = performance.now();
  for (let tick = 0; tick < TICKS; tick++) {
    const started = performance.now();
    for (let m = 0; m < MUTATIONS_PER_TICK; m++) {
      await saveIndicatorWeights({ ...weights });
    }
    const used = performance.now() - started;
    await sleep(Math.max(0, TICK_MS - used));
  }
  const tickElapsedMs = performance.now() - tickStart;
  const tickMutations = TICKS * MUTATIONS_PER_TICK;
  const tickWrites = writes;
  writes = 0;

  clearInterval(poller);

  const perMinute = (tickWrites / tickElapsedMs) * 60_000;
  const blockPerMinuteMs = perMinute * avgWrite;
  const mutationsPerMinute = (tickMutations / tickElapsedMs) * 60_000;
  const blockPerMinuteBeforeMs = mutationsPerMinute * avgWrite;

  console.log('\n---------------- Coalescing (medido) ----------------');
  console.log(`Rajada   : ${burstMut} mutações → ${burstWrites} gravação(ões)`);
  console.log(
    `Loop     : ${TICKS} ticks × ${MUTATIONS_PER_TICK} mutações = ${tickMutations} mutações em ${(tickElapsedMs / 1000).toFixed(1)} s → ${tickWrites} gravação(ões)`
  );
  console.log(
    `Taxa     : ${perMinute.toFixed(1)} gravações/min (${mutationsPerMinute.toFixed(0)} mutações/min)`
  );
  console.log(
    `Bloqueio : ${(blockPerMinuteMs / 1000).toFixed(0)} s/min de event loop agora vs ${(blockPerMinuteBeforeMs / 1000).toFixed(0)} s/min com 1 gravação por mutação`
  );
  console.log(
    `Teto     : janela de 1,5 s + ${(avgWrite / 1000).toFixed(1)} s de gravação ⇒ no máximo ~1 gravação a cada ${(1.5 + avgWrite / 1000).toFixed(1)} s`
  );
  console.log('===============================================================\n');

  console.log('Limpeza:');
  clearInterval(poller);
}

main()
  .catch(err => {
    console.error('Falha na medição:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const p of [COPY_DB, `${COPY_DB}.tmp`]) {
      try {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
          console.log(`   removido ${path.relative(process.cwd(), p)}`);
        }
      } catch (err) {
        console.warn(`   não foi possível remover ${p}:`, err);
      }
    }
    process.exit(process.exitCode ?? 0);
  });
