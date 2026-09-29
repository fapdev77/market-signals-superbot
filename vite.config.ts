import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// `vitest/config` re-exports Vite's defineConfig with the `test` block typed.
import {defineConfig} from 'vitest/config';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    test: {
      // Phase 2.5.7: the backtest engine and the application state use real SQLite files
      // (`data/backtest.db`, `data/superbot.sqlite`). Parallel test files raced on those files, which
      // produced intermittent SQLITE_BUSY errors and flaky results that looked like logic failures.
      // Serialising the files makes a green run mean the same thing every time.
      fileParallelism: false,
      testTimeout: 30000,
      // Every worker isolates its own SQLite file (see tests/setup.ts): tests must
      // never share data/superbot.sqlite with the app or with each other.
      setupFiles: ['./tests/setup.ts'],
    },
  };
});
