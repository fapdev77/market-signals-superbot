import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../server/db.js';
import { AIRateLimitError, consumeAiRateLimit } from '../server/services/aiRateLimiter.js';
import { AIModelConfig } from '../src/types.js';

/**
 * HIGH-4 — rate limit de IA declarado e nunca aplicado.
 *
 * Antes: `rateLimit: { maxReqPerMinute, maxReqPerDay }` era gravado em
 * `db.ts` (4 defaults), no fallback de `aiMotor.ts:118` e validado por
 * `validation.ts:98-99` (`z.number().min(1)`) — mas NENHUM consumidor no
 * runtime lia esse campo. O único controle real era o limiter de rota em
 * `app.ts:127` (45/min agregado em `/api/ai`).
 *
 * Isso é pior do que "não implementado": o controle efetivo (45/min agregado)
 * é MAIS PERMISSIVO que os limites declarados por modelo (`m2` = 15/min,
 * `m4` = 100/min). O sistema anunciava uma contenção de custo inexistente, e a
 * que existia era mais frouxa que a anunciada.
 *
 * A enforcement fica no DISPATCH (`generateContentWithModel`), não na camada
 * HTTP: um limiter de rota não sabe qual modelo a cadeia de fallback resolveu.
 *
 * Contador persistido, não em memória: para um controle cujo propósito é
 * conter gasto, reiniciabilidade é bypass trivial (um restart de processo
 * zera a contagem).
 */

// Provider `local` apontando para uma porta inalcançável: se a enforcement de
// rate limit NÃO existir, o caminho falha rápido e local em vez de sair para a
// rede (o que tornaria este teste dependente de conectividade e hangaria).
const MODEL: AIModelConfig = {
  id: 'm-rate-test',
  name: 'Rate Test Model',
  provider: 'local',
  modelId: 'llama3.2',
  apiUrl: 'http://127.0.0.1:1/unreachable',
  isActive: true,
  isFallback: false,
  priority: 1,
  rateLimit: { maxReqPerMinute: 2, maxReqPerDay: 100 },
  parameters: { temperature: 0.1, maxTokens: 128 }
};

function modelWith(overrides: Partial<AIModelConfig['rateLimit']> = {}): AIModelConfig {
  return { ...MODEL, rateLimit: { maxReqPerMinute: 2, maxReqPerDay: 100, ...overrides } };
}

const T0 = 1_700_000_000_000;

async function clearUsageTable(): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM ai_rate_usage;');
}

// O limiter é STATELESS: todo o estado vive na tabela `ai_rate_usage`, por isso
// não existe reset de memória a fazer entre testes — limpar a tabela basta.
describe('HIGH-4 — rate limit por modelo de IA', () => {
  beforeEach(async () => {
    await clearUsageTable();
  });

  it('rejeita a 3a chamada dentro do mesmo minuto quando maxReqPerMinute=2', async () => {
    const cfg = modelWith();

    await consumeAiRateLimit(cfg, T0);
    await consumeAiRateLimit(cfg, T0);
    // A 3a estoura o limite por minuto.
    await expect(consumeAiRateLimit(cfg, T0)).rejects.toBeInstanceOf(AIRateLimitError);

    // Falha hoje: não existe enforcement, as 3 chamadas passam.
  });

  it('rejeita quando o limite por DIA é excedido, mesmo com minuto livre', async () => {
    const cfg = modelWith({ maxReqPerMinute: 100, maxReqPerDay: 3 });

    await consumeAiRateLimit(cfg, T0);
    await consumeAiRateLimit(cfg, T0);
    await consumeAiRateLimit(cfg, T0);

    // Minuto ainda tem folga; o dia não.
    await expect(consumeAiRateLimit(cfg, T0)).rejects.toBeInstanceOf(AIRateLimitError);
    // Falha hoje: maxReqPerDay nunca é lido.
  });

  it('rejeita com retryAfterSeconds positivo e reason identificável', async () => {
    const cfg = modelWith();

    await consumeAiRateLimit(cfg, T0);
    await consumeAiRateLimit(cfg, T0);

    await expect(consumeAiRateLimit(cfg, T0)).rejects.toMatchObject({
      reason: 'minute',
      retryAfterSeconds: expect.any(Number)
    });

    try {
      await consumeAiRateLimit(cfg, T0);
      throw new Error('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(AIRateLimitError);
      const rl = err as AIRateLimitError;
      expect(rl.retryAfterSeconds).toBeGreaterThan(0);
      expect(rl.reason).toBe('minute');
      expect(rl.modelId).toBe(cfg.id);
    }
  });

  it('isola o limite POR MODELO: 2 req no m1 não esgota o m2', async () => {
    const m1 = modelWith();
    const m2 = { ...modelWith(), id: 'm-rate-other', name: 'Other Model' };

    await consumeAiRateLimit(m1, T0);
    await consumeAiRateLimit(m1, T0);

    // m1 está no limite...
    await expect(consumeAiRateLimit(m1, T0)).rejects.toBeInstanceOf(AIRateLimitError);

    // ...mas m2 tem orçamento próprio e deve passar.
    await expect(consumeAiRateLimit(m2, T0)).resolves.toBeUndefined();

    // Falha hoje: sem contador por modelo, ou tudo passa, ou tudo é barrado junto.
  });

  it('reseta a janela de minuto quando o relógio avança 60s', async () => {
    const cfg = modelWith();

    await consumeAiRateLimit(cfg, T0);
    await consumeAiRateLimit(cfg, T0);
    await expect(consumeAiRateLimit(cfg, T0)).rejects.toBeInstanceOf(AIRateLimitError);

    // 61 segundos depois a janela nova deve liberar.
    await expect(consumeAiRateLimit(cfg, T0 + 61_000)).resolves.toBeUndefined();
  });

  it('mantém o limite por DIA atravessando a virada de minuto', async () => {
    const cfg = modelWith({ maxReqPerMinute: 100, maxReqPerDay: 3 });

    await consumeAiRateLimit(cfg, T0);
    await consumeAiRateLimit(cfg, T0 + 61_000);
    await consumeAiRateLimit(cfg, T0 + 122_000);

    // Minutos distintos (3 janelas), mas o mesmo dia e o mesmo dia já foi gasto.
    await expect(consumeAiRateLimit(cfg, T0 + 183_000)).rejects.toMatchObject({ reason: 'day' });
  });

  it('permite quando a config não declara rateLimit (contrato opcional, sem regressão)', async () => {
    const cfg = { ...MODEL, rateLimit: undefined as any };

    await expect(consumeAiRateLimit(cfg, T0)).resolves.toBeUndefined();
    await expect(consumeAiRateLimit(cfg, T0)).resolves.toBeUndefined();
  });

  it('persiste o contador no banco: apagar a linha zera a contagem', async () => {
    const cfg = modelWith();

    await consumeAiRateLimit(cfg, T0);
    await consumeAiRateLimit(cfg, T0);

    // A contagem vive em tabela, não em Map de módulo: sem a linha, o contador volta a zero.
    // Se fosse memória de módulo, apagar a linha não mudaria nada.
    await clearUsageTable();

    await expect(consumeAiRateLimit(cfg, T0)).resolves.toBeUndefined();
  });

  it('escreve a janela e o modelo usados, para auditoria', async () => {
    const cfg = modelWith();
    await consumeAiRateLimit(cfg, T0);

    const db = await getDb();
    const res = db.exec(
      `SELECT model_id, window_kind, window_start, request_count FROM ai_rate_usage`
    );
    const rows = res[0]?.values ?? [];

    expect(rows.length).toBeGreaterThan(0);
    // Um registro por janela (minute + day) para este modelo.
    expect(rows.map((r: any[]) => r[1]).sort()).toEqual(['day', 'minute']);
    expect(rows.every((r: any[]) => r[0] === cfg.id)).toBe(true);
    expect(rows.every((r: any[]) => r[3] === 1)).toBe(true);
  });
});

describe('HIGH-4 — enforcement no dispatch, não na camada HTTP', () => {
  beforeEach(async () => {
    await clearUsageTable();
  });

  it('generateContentWithModel barra ANTES de qualquer chamada de rede', async () => {
    const cfg = modelWith();

    // Esgota o orçamento do modelo.
    await consumeAiRateLimit(cfg, Date.now());
    await consumeAiRateLimit(cfg, Date.now());

    const { generateContentWithModel } = await import('../server/aiMotor.js');

    // Nenhuma rede é necessária para provar o ponto: o erro tem de ser o
    // rate limit, não uma falha de DNS/API.
    await expect(
      generateContentWithModel(cfg, { prompt: 'ping', logType: 'SIGNAL_REVIEW' })
    ).rejects.toBeInstanceOf(AIRateLimitError);
  });

  it('a cadeia de fallback NÃO escada quando o limite estourou', async () => {
    const { getOrderedModelChain } = await import('../server/aiMotor.js');

    const primary = modelWith(); // esgotado
    const fallback = { ...modelWith(), id: 'm-fallback', name: 'Fallback Model' };

    await consumeAiRateLimit(primary, Date.now());
    await consumeAiRateLimit(primary, Date.now());

    const chain = getOrderedModelChain(primary.id, [primary, fallback]);
    expect(chain.length).toBeGreaterThan(1);

    // Consumir o primeiro da cadeia deve barrar, e não esgotar o fallback:
    // um limite estourado não é "modelo indisponível", é orçamento.
    await expect(consumeAiRateLimit(chain[0], Date.now())).rejects.toBeInstanceOf(
      AIRateLimitError
    );

    // O fallback tem orçamento próprio e permanece utilizável — o rate limit
    // limita o MODELO, não a capacidade de failover.
    await expect(consumeAiRateLimit(chain[1], Date.now())).resolves.toBeUndefined();
  });

  it('repropaga AIRateLimitError quando TODA a cadeia esbarrou em limite de taxa', async () => {
    const { chatWithAITrader } = await import('../server/aiMotor.js');

    // Dois modelos, ambos já com o orçamento ESGOTADO (maxReqPerMinute: 2, 2 consumes).
    const a = { ...modelWith(), id: 'm-chain-a', name: 'Chain A' };
    const b = { ...modelWith(), id: 'm-chain-b', name: 'Chain B' };

    await consumeAiRateLimit(a, Date.now());
    await consumeAiRateLimit(a, Date.now());
    await consumeAiRateLimit(b, Date.now());
    await consumeAiRateLimit(b, Date.now());

    // Sem este comportamento, o chamador receberia "Análise indisponível" e
    // não teria como distinguir provider fora do ar de orçamento estourado.
    await expect(chatWithAITrader('ping', null, true, a.id, [a, b])).rejects.toBeInstanceOf(
      AIRateLimitError
    );
  });

  it('NÃO repropaga quando a falha é mista (limite + provider realmente fora do ar)', async () => {
    const { chatWithAITrader } = await import('../server/aiMotor.js');

    const limited = { ...modelWith(), id: 'm-mix-limited', name: 'Mix Limited' };
    const broken = {
      ...modelWith(),
      id: 'm-mix-broken',
      name: 'Mix Broken',
      provider: 'local' as const,
      apiUrl: 'http://127.0.0.1:1/unreachable'
    };

    await consumeAiRateLimit(limited, Date.now());
    await consumeAiRateLimit(limited, Date.now());

    // Existe uma falha real de provider na cadeia, então o mascaramento
    // histórico ("Falha nos modelos de IA") é a resposta correta — e o
    // chamador NÃO recebe AIRateLimitError, porque o rate limit não foi a
    // causa única da falha.
    const res = await chatWithAITrader('ping', null, true, limited.id, [limited, broken]);
    expect(res.reply).toContain('Falha nos modelos de IA');
    expect(res.modelUsed).not.toMatch(/^Limite de uso/);
  });
});