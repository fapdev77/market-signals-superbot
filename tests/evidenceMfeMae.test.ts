import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';

import {
  setDatabaseFilePathForTests,
  setDbForTesting,
  getDb,
  saveSignalAndLedger,
  signalLedgerDao
} from '../server/db.js';
import {
  calculateMfeMaeFromCandles,
  generateEvidenceSummary,
  type ClosedSignalEvidence
} from '../server/services/EvidenceService.js';

/**
 * M2 precisa ser testado no COLLABORATOR, não na resposta HTTP.
 *
 * `calibrateScore` (scoreCalibration.ts:109) NUNCA lê `cumulativeR` do input —
 * só `n`, `rExpectancy` e os tiers. Então afirmar sobre o JSON de
 * /api/evidence/calibration não distinguiria "rota passa o valor real" de
 * "rota passa 0": a saída é idêntica nos dois casos. Um teste verde aqui seria
 * decorativo.
 *
 * O que M2 realmente exige é que a rota entregue ao calibrador o cumulativeR
 * calculado por `aggregateMetrics` (EvidenceService.ts:390). Por isso o mock
 * abaixo delega no original e apenas REGISTRA o input recebido.
 */
const calibrateCalls: any[] = [];
vi.mock('../server/services/scoreCalibration.js', async importOriginal => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    calibrateScore: (rawScore: number, input?: any) => {
      calibrateCalls.push({ rawScore, input });
      return actual.calibrateScore(rawScore, input);
    }
  };
});

/**
 * M1 + M2 — métricas de evidência que reportam 0 como se fossem medição.
 *
 * ANTES:
 *  - `db.ts:1942-43` gravava `mfeR: 0, maeR: 0` LITERAL ao fechar o sinal.
 *    `calculateMfeMaeFromCandles` (EvidenceService.ts:276) existia, estava
 *    correta, e NUNCA era chamada (verificado por grep: zero consumidores).
 *  - `evidenceRoutes.ts:69` montava `cumulativeR: 0` forçado.
 *
 * Consequência: `/api/evidence/calibration` reportava `avgMfe`/`avgMae` sempre
 * 0.0000. Quem lê esse relatório concluía que a estratégia nunca teve
 * follow-through favorável e nunca teve drawdown — duas afirmações fortes que
 * o sistema não mediu. É a mesma mentira em dois lugares: o campo que o
 * consumidor lê como medição e que é constante.
 *
 * NOTA (verificada nesta execução): `aggregateMetrics` (EvidenceService.ts:390)
 * JÁ calcula `cumulativeR` corretamente a partir dos netR. O defeito de M2 é
 * apenas de PROPAGAÇÃO — a rota monta 0 em vez de ler o valor pronto. E
 * `avgMfe`/`avgMae` já agregam corretamente; a fome de dado vem do `db.ts`.
 */

let dir: string;

const SYMBOL = 'BTCUSDT';
const ENTRY = 100;
const STOP = 99.6; // risco = 0.4 (0.4% da entrada)
const T0 = 1_760_000_000_000;
const CANDLE_MS = 15 * 60 * 1000;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'msb-evidence-mfe-'));
  setDatabaseFilePathForTests(path.join(dir, 'test.sqlite'));
  await getDb();
});

afterAll(() => {
  setDbForTesting(null);
  rmSync(dir, { recursive: true, force: true });
});

/**
 * `signal_ledger` e `signal_events` são APPEND-ONLY por design (triggers
 * `no_update`/`no_delete`, R-18): apagar linhas entre testes seria burlar uma
 * invariante do ledger, não apenas simplificar o harness. Cada teste usa
 * portanto um banco novo, e o diretório antigo só é removido no fim.
 */
async function freshDb(label: string): Promise<void> {
  setDbForTesting(null);
  setDatabaseFilePathForTests(path.join(dir, `${label}.sqlite`));
  await getDb();
}

/** Insere velas OHLC sintéticas para cobrir [from, to]. */
async function seedCandles(
  rows: Array<{ openTime: number; high: number; low: number }>
): Promise<void> {
  const db = await getDb();
  for (const r of rows) {
    db.run(
      `INSERT OR IGNORE INTO historical_klines
        (symbol, interval, open_time, close_time, open, high, low, close,
         volume, quote_asset_volume, trades, taker_buy_base_volume, taker_buy_quote_volume)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        SYMBOL,
        '15m',
        r.openTime,
        r.openTime + CANDLE_MS - 1,
        ENTRY,
        r.high,
        r.low,
        ENTRY,
        1,
        1,
        1,
        0.5,
        0.5
      ]
    );
  }
}

/**
 * Sinal LONG com entrada em 100 e stop em 99.6 (risco 0.4). O fill marca
 * `fillSource: 'LIMIT'` para que `entryPriceForEvidence` use o preço de
 * preenchimento (100), que é o que o R já considera.
 */
async function seedLongSignal(id: string, events: Array<{ type: string; price: number; at: number }>): Promise<void> {
  await saveSignalAndLedger(
    {
      id,
      symbol: SYMBOL,
      marketType: 'crypto_futures',
      signalType: 'LONG',
      direction: 'LONG',
      strategyCategory: 'INTRADAY',
      entryZone: [99.9, 100.1],
      currentPrice: ENTRY,
      stopLoss: STOP,
      target1: 101.2,
      target2: 102.4,
      riskRewardRatio: 3.0,
      confluenceScore: 80,
      confluenceFactors: [],
      timeframe: '15m',
      validationStatus: 'CONFIRMED',
      candle1mConfirmed: true,
      candle5mConfirmed: true,
      createdAt: T0,
      status: 'ACTIVE'
    } as any,
    { withEntryEvent: false }
  );

  await signalLedgerDao.recordEvent({
    signalId: id,
    eventType: 'ENTRY',
    price: ENTRY,
    timestamp: T0
  } as any);

  for (const e of events) {
    await signalLedgerDao.recordEvent({
      signalId: id,
      eventType: e.type as any,
      price: e.price,
      timestamp: e.at
    } as any);
  }
}

describe('M1 — MFE/MAE medidos a partir das velas do intervalo aberto', () => {
  beforeEach(async () => {
    await freshDb('m1');
  });

  it('converte a excursão favorável em R relativo ao stop', () => {
    // high 100.8 (+0.8) / low 99.8 (-0.2), risco 0.4  =>  mfe 2.0R, mae -0.5R
    const res = calculateMfeMaeFromCandles(
      { direction: 'LONG', entryPrice: ENTRY, stopLoss: STOP } as any,
      [{ high: 100.8, low: 99.8 }]
    );

    expect(res.mfeR).toBeCloseTo(2.0, 3);
    expect(res.maeR).toBeCloseTo(-0.5, 3);
  });

  it('SHORT inverte os sinais: queda é favorável', () => {
    const res = calculateMfeMaeFromCandles(
      { direction: 'SHORT', entryPrice: ENTRY, stopLoss: 100.4 } as any,
      [{ high: 100.2, low: 99.2 }]
    );

    // SHORT: queda de 0.8 com risco 0.4 => mfe +2.0R; alta de 0.2 => mae -0.5R
    expect(res.mfeR).toBeCloseTo(2.0, 3);
    expect(res.maeR).toBeCloseTo(-0.5, 3);
  });

  it('getClosedSignalsEvidence devolve mfeR/maeR CALCULADOS, não 0 literal', async () => {
    await seedCandles([
      { openTime: T0 + CANDLE_MS, high: 100.8, low: 99.8 },
      { openTime: T0 + 2 * CANDLE_MS, high: 100.4, low: 99.9 }
    ]);

    await seedLongSignal('mfe-live-1', [{ type: 'TARGET2', price: 102.4, at: T0 + 3 * CANDLE_MS }]);

    const evidence = await signalLedgerDao.getClosedSignalsEvidence('ALL');
    expect(evidence).toHaveLength(1);

    const sig = evidence[0];
    // Antes: mfeR 0, maeR 0. Agora: high 100.8 => 2.0R, low 99.8 => -0.5R
    expect(sig.mfeR).toBeCloseTo(2.0, 3);
    expect(sig.maeR).toBeCloseTo(-0.5, 3);
  });

  it('summary agrega o MFE/MAE real, então avgMfe/avgMae deixam de ser 0.0000', async () => {
    await seedCandles([{ openTime: T0 + CANDLE_MS, high: 100.8, low: 99.8 }]);
    await seedLongSignal('mfe-sum-1', [{ type: 'TARGET2', price: 102.4, at: T0 + 3 * CANDLE_MS }]);

    const evidence = await signalLedgerDao.getClosedSignalsEvidence('ALL');
    const summary = generateEvidenceSummary(evidence, { origin: 'ALL' });

    expect(summary.avgMfe).toBeCloseTo(2.0, 3);
    expect(summary.avgMae).toBeCloseTo(-0.5, 3);
  });

  it('sem velas no intervalo devolve 0 sem inventar (fail-closed, não exceção)', async () => {
    // Nenhuma vela semeada: o campo ausente continua 0, mas o sinal fecha.
    await seedLongSignal('mfe-novelas', [{ type: 'TARGET2', price: 102.4, at: T0 + 3 * CANDLE_MS }]);

    const evidence = await signalLedgerDao.getClosedSignalsEvidence('ALL');
    expect(evidence).toHaveLength(1);
    expect(evidence[0].mfeR).toBe(0);
    expect(evidence[0].maeR).toBe(0);
  });

  it('risco inválido (stop acima da entrada no LONG) não produz NaN', () => {
    const res = calculateMfeMaeFromCandles(
      { direction: 'LONG', entryPrice: 100, stopLoss: 101 } as any,
      [{ high: 105, low: 95 }]
    );

    expect(Number.isFinite(res.mfeR)).toBe(true);
    expect(Number.isFinite(res.maeR)).toBe(true);
    expect(res.mfeR).toBe(0);
    expect(res.maeR).toBe(0);
  });
});

describe('M2 — cumulativeR é a soma real dos netR, não 0 forçado', () => {
  beforeEach(async () => {
    await freshDb('m2');
  });

  it('summary expõe cumulativeR igual à soma dos netR', () => {
    const mk = (id: string, netR: number): ClosedSignalEvidence => ({
      id,
      symbol: SYMBOL,
      category: 'INTRADAY',
      direction: 'LONG',
      score: 80,
      scoreTier: '80-89',
      tradfiSession: 'REGULAR',
      origin: 'LIVE',
      netR,
      mfeR: 1,
      maeR: -0.5,
      isWin: netR > 0,
      closedAt: T0,
      outcomeType: netR > 0 ? 'TP2' : 'STOP'
    });

    // O somatório já é feito por aggregateMetrics; o defeito era a rota
    // descartar o resultado e escrever 0.
    const viaGroup = generateEvidenceSummary([mk('a', 1.2), mk('b', -0.4)], { origin: 'ALL' });
    const tier = viaGroup.byScoreTier['80-89'];

    expect(tier.cumulativeR).toBeCloseTo(0.8, 4);

    // O endpoint de calibração deve receber esse valor em vez de 0.
    const input = {
      overall: {
        n: viaGroup.totalSignals,
        wins: viaGroup.wins,
        losses: viaGroup.losses,
        winRate: viaGroup.winRate,
        wilsonInterval: viaGroup.wilsonInterval,
        rExpectancy: viaGroup.rExpectancy,
        avgMfe: viaGroup.avgMfe,
        avgMae: viaGroup.avgMae,
        cumulativeR: tier.cumulativeR,
        maxDrawdownR: viaGroup.maxDrawdownR
      },
      byScoreTier: viaGroup.byScoreTier
    };

    expect(input.overall.cumulativeR).not.toBe(0);
    expect(input.overall.cumulativeR).toBeCloseTo(0.8, 4);
  });

  it('evidenceRoutes entrega a calibrateScore o cumulativeR REAL, não 0', async () => {
    const { default: express } = await import('express');

    await seedCandles([{ openTime: T0 + CANDLE_MS, high: 100.8, low: 99.8 }]);
    await seedLongSignal('cum-live-1', [{ type: 'TARGET2', price: 102.4, at: T0 + 3 * CANDLE_MS }]);
    await seedLongSignal('cum-live-2', [{ type: 'STOP', price: STOP, at: T0 + 4 * CANDLE_MS }]);

    const evidence = await signalLedgerDao.getClosedSignalsEvidence('ALL');
    const summary = generateEvidenceSummary(evidence, { origin: 'ALL' });
    const expected = summary.byScoreTier['80-89'].cumulativeR;

    calibrateCalls.length = 0;

    const app = express();
    app.use(express.json());
    const { createEvidenceRouter } = await import('../server/routes/evidenceRoutes.js');
    app.use('/api/evidence', createEvidenceRouter());

    const server = app.listen(0);
    const port = (server.address() as any).port;
    const res = await new Promise<any>((resolve, reject) => {
      const req = http.request(
        `http://127.0.0.1:${port}/api/evidence/calibration?origin=ALL`,
        r => {
          let body = '';
          r.on('data', (c: Buffer) => (body += c.toString()));
          r.on('end', () => resolve({ status: r.statusCode, body: JSON.parse(body) }));
        }
      );
      req.on('error', reject);
      req.end();
    });
    server.close();

    expect(res.status).toBe(200);
    expect(calibrateCalls.length).toBeGreaterThan(0);

    // Este é o ponto que prova M2: o input recebido pelo calibrador.
    // Antes a rota montava `cumulativeR: 0` aqui.
    const received = calibrateCalls[0].input.overall.cumulativeR;
    expect(received).toBeCloseTo(expected, 4);
    expect(received).not.toBe(0);
  });
});