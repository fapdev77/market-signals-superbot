import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import dns from 'node:dns';

/**
 * R-1 — Validação de DNS (anti DNS-rebinding) nas chamadas de IA.
 *
 * Antes: `validateOutboundAIUrlWithDns` existia em outboundPolicy.ts, mas os 5
 * call sites usavam a versão síncrona — um hostname permitido que resolvesse
 * para um IP privado (rebinding) passaria direto. Agora TODOS os caminhos de
 * saída de IA validam a resolução de DNS antes de conectar:
 *
 *   aiMotor.ts ....... 3 call sites (local / openai+openrouter / anthropic)
 *   aiRoutes.ts ...... 2 call sites (test-connection local / openai+openrouter)
 *   validation.ts .... 1 call site (POST /settings/ai-models)
 *
 * Estratégia de teste: mockamos dns.promises.lookup para resolver
 * generativelanguage.googleapis.com para 127.0.0.1 e verificamos que o caminho
 * do motor (exercitado via o logger de IA) registra o bloqueio anti-rebinding.
 */

const originalLookup = dns.promises.lookup.bind(dns.promises);
const lookupSpy = vi.spyOn(dns.promises, 'lookup');

const mockLookup = (addresses: Array<{ address: string; family: number }>) =>
  lookupSpy.mockImplementation((async () => addresses as any) as any);

// The AI motor records blocked attempts as ERROR logs; we read them back via aiLogger.
import { getAILogs, clearAILogs } from '../server/aiLogger.js';

// Minimal model config pointing to the official Gemini host (passes the sync check).
const REBINDING_MODEL = {
  id: 'm-rebind',
  name: 'Rebinding Test',
  provider: 'gemini' as const,
  modelId: 'gemini-2.5-flash',
  isActive: true,
  isFallback: false,
  priority: 1,
  parameters: { temperature: 0.1, maxTokens: 128 }
};

const PROMPT = { prompt: 'ping', systemInstruction: 'reply OK', logType: 'SIGNAL_REVIEW' } as any;

async function runGeminiPath(): Promise<void> {
  const { generateContentWithModel } = await import('../server/aiMotor.js');
  await generateContentWithModel(REBINDING_MODEL as any, PROMPT);
}

describe('R-1 DNS rebinding enforcement on AI outbound paths', () => {
  beforeEach(() => {
    clearAILogs();
  });

  afterEach(() => {
    lookupSpy.mockReset();
  });

  afterAll(() => {
    lookupSpy.mockImplementation(originalLookup as any);
  });

  it('policy validates a DNS resolution and rejects a host resolving to a private IP', async () => {
    const { validateOutboundAIUrlWithDns } = await import('../server/utils/outboundPolicy.js');
    mockLookup([{ address: '127.0.0.1', family: 4 }]);

    const result = await validateOutboundAIUrlWithDns(
      'https://generativelanguage.googleapis.com/v1beta',
      'gemini'
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/rebinding/i);
  });

  it('policy accepts a host that resolves to a public IP', async () => {    const { validateOutboundAIUrlWithDns } = await import('../server/utils/outboundPolicy.js');
    mockLookup([{ address: '142.250.79.74', family: 4 }]);

    const result = await validateOutboundAIUrlWithDns(
      'https://generativelanguage.googleapis.com/v1beta',
      'gemini'
    );
    expect(result.isValid).toBe(true);
  });

  it('gemini motor path blocks an allowlisted host that resolves to a private IP', async () => {
    mockLookup([{ address: '10.1.2.3', family: 4 }]);

    await expect(runGeminiPath()).rejects.toThrow(/rebinding/i);

    const logs = getAILogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].level).toBe('ERROR');
    expect(logs[0].message).toMatch(/rebinding/i);
  });

  it('gemini motor path proceeds to fetch when DNS resolves to a public IP', async () => {
    mockLookup([{ address: '142.250.79.74', family: 4 }]);

    // generateContentWithModel will attempt the real HTTPS call and fail on
    // network, but the failure must NOT be the rebinding block.
    await expect(runGeminiPath()).rejects.toThrow(/(rebinding|gemini|execução|erro|network|enotfound|timeout|api|google|chave)/i);

    const logs = getAILogs();
    const blocked = logs.filter(l => l.level === 'ERROR' && /rebinding/i.test(l.message));
    expect(blocked.length).toBe(0);
  });
});
