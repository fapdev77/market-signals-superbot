import { safeFetch } from './safeFetch.js';

/**
 * Bootstrap Initialization:
 * Runs before any other server module or network call to:
 * 1. Replace globalThis.fetch with native node:https safeFetch to bypass Undici's socket assertion bug in Node 20/22/24.
 * 2. Install unhandled error & rejection guards.
 */

// 1. Monkey-patch globalThis.fetch
if (typeof globalThis !== 'undefined') {
  (globalThis as any).fetch = safeFetch;
  console.log('🛡️ [Bootstrap] Native HTTPS SafeFetch engine initialized (Undici bypassed).');
}

// 2. Global process uncaught exception guard
process.on('uncaughtException', (err: any) => {
  const isAssertion = err?.code === 'ERR_ASSERTION' || err?.name === 'AssertionError';
  const isUndici = err?.stack?.includes('undici') || String(err?.message || '').includes('false == true');
  
  if (isAssertion && isUndici) {
    console.warn('⚠️ [Node.js Guard] Intercepted internal socket parser assertion (false == true); process preserved.');
    return;
  }
  
  // Also guard against socket reset errors (ECONNRESET, EPIPE, etc.)
  if (err?.code === 'ECONNRESET' || err?.code === 'EPIPE' || err?.code === 'ETIMEDOUT') {
    console.warn(`⚠️ [Network Guard] Conexão resetada ou abortada (${err.code}). Conexão ignorada com segurança.`);
    return;
  }

  console.error('❌ [Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason: any) => {
  const isAssertion = reason?.code === 'ERR_ASSERTION' || reason?.name === 'AssertionError';
  const isUndici = reason?.stack?.includes('undici') || String(reason?.message || '').includes('false == true');
  
  if (isAssertion && isUndici) {
    console.warn('⚠️ [Node.js Guard] Intercepted unhandled Undici rejection (false == true); process preserved.');
    return;
  }
  console.warn('⚠️ [Unhandled Rejection]:', reason?.message || reason);
});
