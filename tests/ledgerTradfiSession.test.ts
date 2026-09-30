/**
 * 6.2.2 / CA-2.2 — O ledger recebe `tradfiSession` (tipo de sessão calculado no
 * sinal — ex.: REGULAR/PRE_MARKET/AFTER_MARKET) e uma coluna nova
 * `tradfi_category` (migração). O resumo agrega por sessão e por categoria
 * separadamente.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  setDatabaseFilePathForTests,
  setDbForTesting,
  getDb,
  saveSignalAndLedger,
  signalLedgerDao
} from '../server/db.js';
import { generateEvidenceSummary } from '../server/services/EvidenceService.js';
import type { ClosedSignalEvidence } from '../server/services/EvidenceService.js';

let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'msb-ledger-session-'));
  setDatabaseFilePathForTests(path.join(dir, 'test.sqlite'));
  await getDb();
});

afterAll(() => {
  setDbForTesting(null);
  rmSync(dir, { recursive: true, force: true });
});

describe('6.2.2 / CA-2.2 — sessão e categoria no ledger', () => {
  it('migração adiciona tradfi_category (e contexto de reprodutibilidade) ao signal_ledger', async () => {
    const db = await getDb();
    const cols = db.exec(`PRAGMA table_info(signal_ledger)`)[0].values.map(r => String(r[1]));
    expect(cols).toContain('tradfi_category');
    expect(cols).toContain('engine_version');
    expect(cols).toContain('weights_hash');
    expect(cols).toContain('strategy_profile');
  });

  it('saveSignalAndLedger grava a SESSÃO calculada em tradfi_session e a CATEGORIA em tradfi_category', async () => {
    const db = await getDb();
    await saveSignalAndLedger(
      {
        id: 'sess-1',
        symbol: 'SPXUSDT',
        marketType: 'crypto_futures',
        signalType: 'LONG',
        direction: 'LONG',
        strategyCategory: 'INTRADAY',
        entryZone: [100, 102],
        currentPrice: 101,
        stopLoss: 95,
        target1: 106,
        target2: 112,
        riskRewardRatio: 2.0,
        confluenceScore: 75,
        confluenceFactors: [],
        timeframe: '15m',
        validationStatus: 'CONFIRMED',
        validationStage: 'VALIDADO',
        candle1mConfirmed: true,
        candle5mConfirmed: true,
        createdAt: 1000,
        status: 'ACTIVE',
        // A sessão vem do cálculo do sinal — NÃO é a categoria do ativo.
        tradfiSession: 'REGULAR'
      } as any,
      { tradfiCategory: 'EQUITY' }
    );

    const row = db.exec(
      `SELECT tradfi_session, tradfi_category FROM signal_ledger WHERE id = 'sess-1'`
    )[0].values[0];
    expect(String(row[0])).toBe('REGULAR');
    expect(String(row[1])).toBe('EQUITY');

    // Round-trip pela leitura de evidência.
    const closed = await signalLedgerDao.getClosedSignalsEvidence('ALL');
    const found = closed.find(s => s.id === 'sess-1');
    // O sinal está aberto (sem evento terminal), mas a leitura do ledger crua precisa das duas colunas.
    const raw = await signalLedgerDao.getRawLedgerRow('sess-1');
    expect(raw?.tradfiSession).toBe('REGULAR');
    expect(raw?.tradfiCategory).toBe('EQUITY');
    expect(found === undefined || found.tradfiSession === 'REGULAR').toBe(true);
  });

  it('resumo agrega por categoria e por sessão separadamente', () => {
    const mk = (id: string, category: string, tradfiSession: string, isWin: boolean): ClosedSignalEvidence => ({
      id,
      symbol: `${id}-SYM`,
      category,
      direction: 'LONG',
      score: 80,
      scoreTier: '80-89',
      tradfiSession,
      origin: 'LIVE',
      netR: isWin ? 1.5 : -1,
      mfeR: 2,
      maeR: -0.5,
      isWin,
      closedAt: 1000
    });

    const summary = generateEvidenceSummary(
      [
        mk('a', 'EQUITY', 'REGULAR', true),
        mk('b', 'EQUITY', 'OVERNIGHT', false),
        mk('c', 'COMMODITY', 'REGULAR', true)
      ],
      { origin: 'ALL' }
    );

    // Por categoria: EQUITY tem 2, COMMODITY tem 1.
    expect(summary.byCategory['EQUITY'].n).toBe(2);
    expect(summary.byCategory['COMMODITY'].n).toBe(1);

    // Por sessão: REGULAR tem 2, OVERNIGHT tem 1 — independente da categoria.
    expect(summary.byTradFiSession['REGULAR'].n).toBe(2);
    expect(summary.byTradFiSession['OVERNIGHT'].n).toBe(1);
  });
});
