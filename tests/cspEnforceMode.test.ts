import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { BotState, TickerData } from '../src/types.js';

/**
 * 7.6.2 / CA-6.2 — com `CSP_ENFORCE=true` em produção a resposta traz o cabeçalho
 * `Content-Security-Policy` (bloqueante) e NÃO a versão report-only. Sem a flag,
 * mantém-se apenas o report-only (janela de observação). Fora de produção não há
 * cabeçalho (o dev server do Vite injeta o próprio CSP).
 */
describe('7.6.2 — CSP enforce (CA-6.2)', () => {
  const TEST_TOKEN = 'test-token-for-csp-enforce-0000001';
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

  it('CSP_ENFORCE=true em produção emite Content-Security-Policy e nenhum report-only', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_AUTH_TOKEN = TEST_TOKEN;
    process.env.CSP_ENFORCE = 'true';

    const res = await request(buildApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toBeTruthy();
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy-report-only']).toBeUndefined();
  });

  it('sem CSP_ENFORCE em produção mantém apenas o report-only', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_AUTH_TOKEN = TEST_TOKEN;
    delete process.env.CSP_ENFORCE;

    const res = await request(buildApp()).get('/health');
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.headers['content-security-policy-report-only']).toBeTruthy();
  });

  it('fora de produção não emite nenhum dos dois cabeçalhos', async () => {
    process.env.NODE_ENV = 'development';
    process.env.API_AUTH_TOKEN = TEST_TOKEN;
    process.env.CSP_ENFORCE = 'true';

    const res = await request(buildApp()).get('/health');
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.headers['content-security-policy-report-only']).toBeUndefined();
  });
});
