import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { BotState, TickerData } from '../src/types.js';

/**
 * T6.8.2 / CA-8.2 — Content-Security-Policy-Report-Only presente no build de
 * produção. O modo report-only NÃO bloqueia nada: apenas reporta violações,
 * permitindo endurecer depois de 1 semana sem violações inesperadas
 * (specs/phase-6.md §6.8.2).
 */
describe('T6.8.2 — CSP report-only (CA-8.2)', () => {
  const TEST_TOKEN = 'test-token-for-csp-suite-00000001';
  const originalEnv = { ...process.env };

  const buildApp = () =>
    createApp({
      botState: {
        isMonitoring: false,
        activeTickersCount: 0,
        lastTickTime: Date.now(),
        ticksProcessed: 0,
        signalsGenerated24h: 0,
        weights: {} as any,
        aiModels: [],
        aiAnalysisEnabled: false
      } as BotState,
      tickerStateCache: {} as Record<string, TickerData>,
      triggerMarketScan: async () => {}
    });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('emite Content-Security-Policy-Report-Only em produção', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_AUTH_TOKEN = TEST_TOKEN;
    const app = buildApp();

    // /health é público — o cabeçalho vem do middleware global do app.
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);

    const csp = res.headers['content-security-policy-report-only'];
    expect(csp, 'cabeçalho report-only ausente na resposta de produção').toBeTruthy();

    // Diretivas essenciais: o app é uma SPA Vite; o padrão NÃO bloqueia nada
    // (report-only), mas precisa cobrir scripts/estilos/conexões reais.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('img-src');
    expect(csp).toContain('connect-src');
  });

  it('não emite o cabeçalho fora de produção (dev/preview local)', async () => {
    process.env.NODE_ENV = 'development';
    process.env.API_AUTH_TOKEN = TEST_TOKEN;
    const app = buildApp();

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy-report-only']).toBeUndefined();
  });

  it('aceita report-uri via CSP_REPORT_URI (endpoint do coletor de violações)', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_AUTH_TOKEN = TEST_TOKEN;
    process.env.CSP_REPORT_URI = 'https://csp.example.com/collector';
    const app = buildApp();

    const res = await request(app).get('/health');
    expect(res.headers['content-security-policy-report-only']).toContain(
      'report-uri https://csp.example.com/collector'
    );
  });

  it('o corpo e o status da resposta não são afetados pelo middleware (report-only)', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_AUTH_TOKEN = TEST_TOKEN;
    const app = buildApp();

    const res = await request(app).get('/health');
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeGreaterThan(0);
  });
});
