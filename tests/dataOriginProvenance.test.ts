import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { BotState, TickerData, TradeSignal } from '../src/types.js';
import {
  getDb,
  saveSignal,
  getRecentSignals,
  getActiveSignals,
  getActiveSignalsBySymbol,
  getSignalsByDateRange,
  resolveSignalOrigin
} from '../server/db.js';
import { historicalKlinesDao } from '../server/backtest_db/index.js';
import { HistoricalDataService } from '../server/services/HistoricalDataService.js';
import { buildTradeSignal } from '../server/signalEngine.js';
import { canGenerateSignals } from '../server/services/DataGate.js';
import { parseOriginFilter } from '../server/utils/dataOrigin.js';
import { requestJsonLimited } from '../server/utils/httpClient.js';

// O fallback sintético do sync depende de falha de rede; o mock é determinístico e evita
// tocar a exchange neste teste. Os demais testes do arquivo não usam httpClient.
vi.mock('../server/utils/httpClient.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/utils/httpClient.js')>();
  return {
    ...actual,
    requestJsonLimited: vi.fn(async () => {
      throw new Error('rede indisponível (teste)');
    })
  };
});

/**
 * R-2 — proveniência persistida (`LIVE`/`DEMO`) e separação física dos geradores sintéticos.
 *
 * Critérios de aceitação da spec:
 *  (1) sem a flag, nenhuma linha nasce `DEMO`;
 *  (2) com a flag, linhas demo ficam invisíveis nas leituras default;
 *  (3) o hit-rate considera só `LIVE` por default.
 */

const LIVE_SYM = 'ORIGLIVEU1';
const DEMO_SYM = 'ORIGDEMOU1';
const KLINES_SYM = 'ORIGKLINESU1';
const TEST_TOKEN = 'test-token-for-origin-suite-0001';
const originalEnv = { ...process.env };

function makeSignal(symbol: string, origin?: 'LIVE' | 'DEMO', createdAt = Date.now()): TradeSignal {
  return {
    id: `ORIG-${symbol}-${createdAt.toString(36)}`,
    symbol,
    marketType: 'crypto_futures',
    signalType: 'LONG',
    direction: 'LONG',
    strategyCategory: 'INTRADAY',
    entryZone: [100, 100.5],
    currentPrice: 100,
    stopLoss: 98,
    target1: 104,
    target2: 108,
    riskRewardRatio: 4,
    confluenceScore: 80,
    confluenceFactors: ['origin-test'],
    timeframe: '15m',
    validationStatus: 'CONFIRMED',
    validationStage: 'VALIDADO',
    candle1mConfirmed: true,
    candle5mConfirmed: true,
    createdAt,
    status: 'ACTIVE',
    origin
  };
}

function makeTicker(symbol: string, source?: 'SYNTHETIC' | 'REST'): TickerData {
  return {
    symbol,
    baseAsset: symbol.replace('USDT', ''),
    quoteAsset: 'USDT',
    name: symbol,
    marketType: 'crypto_futures',
    price: 100,
    priceChangePercent24h: 3,
    high24h: 102,
    low24h: 96,
    volume24h: 10000,
    quoteVolume24h: 1000000,
    openInterest: 50000,
    openInterestChange24h: 5,
    openInterestChange1h: 2,
    fundingRate: 0.0001,
    fundingRateDaily: 0.0003,
    fundingRateAnnualized: 0.1,
    fundingRateAnalysis: { status: 'NEUTRAL', pressure: 'NEUTRO / EQUILIBRADO', bias: 'NEUTRAL', description: '' },
    cvd: 2000000,
    cvdDelta: 500000,
    cvdDeltaPercent: 15,
    cvdDirection: 'BUY',
    takerBuyRatio: 0.62,
    fibonacci: { fib50: 99, fib618: 98, fib68: 97.5, swingHigh: 102, swingLow: 96, inGoldenPocket: true },
    rangeProfile: { vah: 101, val: 98, poc: 99.5, inValueArea: true },
    keyLevels: { support1: 98, support2: 96, resistance1: 104, resistance2: 112, structureBreak: 'BULLISH', hasSinglePrintFVG: false },
    confluenceScore: 85,
    signalType: 'LONG',
    signalReason: 'origin test',
    confluenceFactors: ['Golden Pocket', 'CVD'],
    dataQuality: source
      ? {
          isLive: source !== 'SYNTHETIC',
          isDegraded: false,
          lastPriceAgeMs: 500,
          source
        }
      : undefined,
    updatedAt: Date.now()
  };
}

const klines = Array.from({ length: 30 }, (_, i) => ({
  timestamp: 1715000000000 + i * 900000,
  open: 100 + i * 0.5,
  high: 100 + i * 0.5 + 0.8,
  low: 100 + i * 0.5 - 0.2,
  close: 100 + i * 0.5 + 0.6,
  volume: 1000 + i * 10,
  takerBuyVolume: 650 + i * 10
}));

describe('R-2 — proveniência LIVE/DEMO', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    process.env.API_AUTH_TOKEN = TEST_TOKEN;
    app = createApp({
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

    await saveSignal(makeSignal(LIVE_SYM, 'LIVE'));
    await saveSignal(makeSignal(DEMO_SYM, 'DEMO'));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('migração 006 e schema', () => {
    it('adiciona a coluna origin em trade_signals e historical_klines', async () => {
      const db = await getDb();
      for (const table of ['trade_signals', 'historical_klines']) {
        const info = db.exec(`PRAGMA table_info(${table})`);
        const columns = info[0].values.map(row => String(row[1]));
        expect(columns).toContain('origin');
      }
      const version = db.exec('PRAGMA user_version;');
      expect(Number(version[0].values[0][0])).toBeGreaterThanOrEqual(6);
    });

    it('registros sem proveniência explícita são lidos como LIVE', async () => {
      const db = await getDb();
      const id = `ORIG-LEGACY-${Date.now().toString(36)}`;
      db.run(
        `INSERT INTO trade_signals (id, symbol, market_type, signal_type, direction, entry_min, entry_max,
          current_price, stop_loss, target1, target2, risk_reward, confluence_score, confluence_factors,
          timeframe, validation_status, validation_stage, candle_1m_confirmed, candle_5m_confirmed,
          ai_review, ai_confidence, created_at, status, strategy_category)
         VALUES (?, ?, 'crypto_futures', 'LONG', 'LONG', 1, 1.1, 1, 0.9, 1.2, 1.4, 2, 70, '[]',
          '15m', 'CONFIRMED', 'VALIDADO', 1, 1, '', 0, ?, 'ACTIVE', 'INTRADAY')`,
        [id, 'ORIGLEGACYU1', Date.now()]
      );
      const recent = await getRecentSignals(500, 'ALL');
      const legacy = recent.find(s => s.id === id);
      expect(legacy?.origin).toBe('LIVE');
    });
  });

  describe('gravação (critério 1)', () => {
    it('persiste a origem marcada e usa LIVE como default', async () => {
      const all = await getRecentSignals(500, 'ALL');
      expect(all.find(s => s.symbol === LIVE_SYM)?.origin).toBe('LIVE');
      expect(all.find(s => s.symbol === DEMO_SYM)?.origin).toBe('DEMO');
      expect(resolveSignalOrigin({})).toBe('LIVE');
      expect(resolveSignalOrigin({ origin: 'DEMO' })).toBe('DEMO');
    });

    it('marca DEMO só quando o dado é sintético, e LIVE para dado de mercado', () => {
      const synthetic = buildTradeSignal(makeTicker('ORIGSYNTHU1', 'SYNTHETIC'), klines, 2, 'INTRADAY');
      const live = buildTradeSignal(makeTicker('ORIGRESTU1', 'REST'), klines, 2, 'INTRADAY');
      const unknown = buildTradeSignal(makeTicker('ORIGNODQU1'), klines, 2, 'INTRADAY');

      expect(synthetic?.origin).toBe('DEMO');
      expect(live?.origin).toBe('LIVE');
      expect(unknown?.origin).toBe('LIVE');
    });

    it('sem ALLOW_SYNTHETIC_DATA o DataGate barra o ticker sintético antes de nascer um sinal', () => {
      const previous = process.env.ALLOW_SYNTHETIC_DATA;
      delete process.env.ALLOW_SYNTHETIC_DATA;
      try {
        const decision = canGenerateSignals(makeTicker('ORIGBLOCKU1', 'SYNTHETIC'));
        expect(decision.allow).toBe(false);
        expect(decision.reason).toMatch(/sintétic/i);
      } finally {
        process.env.ALLOW_SYNTHETIC_DATA = previous;
      }
    });
  });

  describe('leituras default (critério 2)', () => {
    it('esconde DEMO em getRecentSignals e getActiveSignals', async () => {
      const recent = await getRecentSignals(500);
      expect(recent.some(s => s.symbol === LIVE_SYM)).toBe(true);
      expect(recent.some(s => s.symbol === DEMO_SYM)).toBe(false);

      const active = await getActiveSignals();
      expect(active.some(s => s.symbol === LIVE_SYM)).toBe(true);
      expect(active.some(s => s.symbol === DEMO_SYM)).toBe(false);
    });

    it('explicita DEMO e ALL quando pedido', async () => {
      const demo = await getRecentSignals(500, 'DEMO');
      expect(demo.every(s => s.origin === 'DEMO')).toBe(true);
      expect(demo.some(s => s.symbol === DEMO_SYM)).toBe(true);

      const all = await getRecentSignals(500, 'ALL');
      expect(all.some(s => s.symbol === LIVE_SYM)).toBe(true);
      expect(all.some(s => s.symbol === DEMO_SYM)).toBe(true);
    });

    it('getActiveSignalsBySymbol filtra por origem (motor usa ALL)', async () => {
      const liveOnly = await getActiveSignalsBySymbol(DEMO_SYM);
      expect(liveOnly).toHaveLength(0);

      // Revisão R-2: símbolo com aspas nunca deve chegar cru à SQL (se chegasse, a consulta
      // quebraria ou retornaria errado — aqui só garante que a leitura parametrizada não explode).
      const quoted = await getActiveSignalsBySymbol(`x' OR '1'='1`);
      expect(quoted).toHaveLength(0);

      const all = await getActiveSignalsBySymbol(DEMO_SYM, undefined, 'ALL');
      expect(all).toHaveLength(1);
      expect(all[0].origin).toBe('DEMO');
    });

    it('getSignalsByDateRange (entrada do hit-rate) exclui DEMO por default', async () => {
      const start = Date.now() - 60 * 60 * 1000;
      const end = Date.now() + 60 * 1000;

      const live = await getSignalsByDateRange(start, end);
      expect(live.every(s => s.origin === 'LIVE')).toBe(true);
      expect(live.some(s => s.symbol === DEMO_SYM)).toBe(false);

      const all = await getSignalsByDateRange(start, end, 'ALL');
      expect(all.some(s => s.symbol === DEMO_SYM)).toBe(true);
    });

    it('normaliza o parâmetro origin da query', () => {
      expect(parseOriginFilter('demo')).toBe('DEMO');
      expect(parseOriginFilter('ALL')).toBe('ALL');
      expect(parseOriginFilter('lixo')).toBe('LIVE');
      expect(parseOriginFilter(undefined, 'ALL')).toBe('ALL');
    });
  });

  describe('rotas HTTP', () => {
    it('GET /api/signals mostra só LIVE e aceita ?origin=DEMO', async () => {
      const defaultRes = await request(app)
        .get('/api/signals')
        .set('Authorization', `Bearer ${TEST_TOKEN}`);
      expect(defaultRes.status).toBe(200);
      expect(defaultRes.body.some((s: TradeSignal) => s.symbol === DEMO_SYM)).toBe(false);

      const demoRes = await request(app)
        .get('/api/signals?origin=DEMO')
        .set('Authorization', `Bearer ${TEST_TOKEN}`);
      expect(demoRes.status).toBe(200);
      expect(demoRes.body.some((s: TradeSignal) => s.symbol === DEMO_SYM)).toBe(true);
      expect(demoRes.body.every((s: TradeSignal) => s.origin === 'DEMO')).toBe(true);
    });

    it('GET /api/ai/performance calcula o hit-rate só com LIVE (critério 3)', async () => {
      const liveRes = await request(app)
        .get('/api/ai/performance?days=1')
        .set('Authorization', `Bearer ${TEST_TOKEN}`);
      expect(liveRes.status).toBe(200);
      expect(liveRes.body.origin).toBe('LIVE');
      expect(liveRes.body.demoSignalsExcluded).toBeGreaterThanOrEqual(1);

      const includesDemo = liveRes.body.dailyMetrics.some((d: any) =>
        d.signals.some((s: any) => s.symbol === DEMO_SYM)
      );
      expect(includesDemo).toBe(false);

      const allRes = await request(app)
        .get('/api/ai/performance?days=1&origin=ALL')
        .set('Authorization', `Bearer ${TEST_TOKEN}`);
      expect(allRes.status).toBe(200);
      expect(allRes.body.origin).toBe('ALL');
      expect(allRes.body.demoSignalsExcluded).toBe(0);
      const includesDemoInAll = allRes.body.dailyMetrics.some((d: any) =>
        d.signals.some((s: any) => s.symbol === DEMO_SYM)
      );
      expect(includesDemoInAll).toBe(true);
    });
  });

  describe('historical_klines', () => {
    const start = Date.now() - 40 * 60 * 1000;

    it('seed sintético grava DEMO e o sync real grava LIVE', async () => {
      await HistoricalDataService.seedSyntheticKlines(KLINES_SYM, start, start + 29 * 60 * 1000);

      const demoSide = await historicalKlinesDao.stats(KLINES_SYM, 'DEMO');
      expect(demoSide.count).toBeGreaterThan(0);
      expect(await historicalKlinesDao.stats(KLINES_SYM, 'LIVE')).toMatchObject({ count: 0 });

      const realOpenTime = start + 60 * 60 * 1000; // depois da cauda sintética, sem colisão de PK
      await historicalKlinesDao.insertMany([
        {
          symbol: KLINES_SYM,
          interval: '1m',
          openTime: realOpenTime,
          closeTime: realOpenTime + 59999,
          open: 100,
          high: 101,
          low: 99,
          close: 100.5,
          volume: 10,
          quoteAssetVolume: 1005,
          trades: 5,
          takerBuyBaseVolume: 5,
          takerBuyQuoteVolume: 502
        }
      ]);

      expect(await historicalKlinesDao.stats(KLINES_SYM, 'LIVE')).toMatchObject({ count: 1 });
    });

    it('o fallback sintético do sync honra ALLOW_SYNTHETIC_DATA (gate do chamador)', async () => {
      const sym = 'ORIGSYNCGATEU1';
      const previous = process.env.ALLOW_SYNTHETIC_DATA;
      delete process.env.ALLOW_SYNTHETIC_DATA;
      try {
        await HistoricalDataService.syncSymbol(sym, 1);
        const state = HistoricalDataService.getSyncState(sym);
        expect(state.status).toBe('DONE');

        // Sem a flag: nenhum candle fabricado, e o caminho de rede foi exercitado.
        expect(await historicalKlinesDao.stats(sym, 'DEMO')).toMatchObject({ count: 0 });
        expect(await historicalKlinesDao.stats(sym, 'ALL')).toMatchObject({ count: 0 });
        expect(vi.mocked(requestJsonLimited)).toHaveBeenCalled();
      } finally {
        if (previous !== undefined) process.env.ALLOW_SYNTHETIC_DATA = previous;
        else process.env.ALLOW_SYNTHETIC_DATA = 'true';
      }
    });

    it('a sincronização incremental não retoma da cauda sintética', async () => {
      // Default LIVE: como o único candle real é o último, o resync não pula a lacuna.
      const latestLive = await historicalKlinesDao.getLatestOpenTime(KLINES_SYM, '1m');
      expect(latestLive).not.toBeNull();

      const latestAll = await historicalKlinesDao.getLatestOpenTime(KLINES_SYM, '1m', 'ALL');
      expect(latestAll).toBe(latestLive);

      // Em um símbolo só com dado sintético, a leitura LIVE não enxerga nada.
      const onlyDemoSym = 'ORIGDEMOKLINESU1';
      await HistoricalDataService.seedSyntheticKlines(onlyDemoSym, start, start + 4 * 60 * 1000);
      expect(await historicalKlinesDao.getLatestOpenTime(onlyDemoSym, '1m')).toBeNull();
      expect(await historicalKlinesDao.getLatestOpenTime(onlyDemoSym, '1m', 'DEMO')).not.toBeNull();
    });

    it('o backtest continua lendo as duas origens (default ALL)', async () => {
      const all = await historicalKlinesDao.getBySymbolAndRange(
        KLINES_SYM,
        '1m',
        start,
        start + 2 * 60 * 60 * 1000
      );
      expect(all.length).toBeGreaterThan(1);
      const liveOnly = await historicalKlinesDao.getBySymbolAndRange(
        KLINES_SYM,
        '1m',
        start,
        start + 2 * 60 * 60 * 1000,
        0,
        'LIVE'
      );
      expect(liveOnly).toHaveLength(1);
    });
  });

  describe('separação física dos geradores sintéticos (server/demo/)', () => {
    it('nenhum gerador fabricado continua fora de server/demo/', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const root = process.cwd();
      const offenders: string[] = [];

      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name === 'demo' || entry.name === 'node_modules') continue;
            walk(full);
            continue;
          }
          if (!entry.name.endsWith('.ts')) continue;
          const source = fs.readFileSync(full, 'utf8');
          // Geradores mudados para server/demo: não devem reaparecer no resto do server/.
          for (const marker of ['generateFallbackRawTickers', 'simulateLiquidationSummary', 'generateSynthetic1mKlineRows']) {
            if (source.includes(marker) && !full.includes('server\\demo') && !full.includes('server/demo')) {
              // imports dos módulos de demo são permitidos; definições não.
              const definesIt = new RegExp(`(function|const)\\s+${marker}\\b`).test(source);
              if (definesIt) offenders.push(`${path.relative(root, full)} define ${marker}`);
            }
          }
        }
      };

      walk(path.join(root, 'server'));
      expect(offenders).toEqual([]);
    });
  });
});
