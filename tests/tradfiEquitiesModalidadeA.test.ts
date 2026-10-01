import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  classifyTradfiContract,
  TRADFI_ASSETS,
  refreshTradfiRegistry,
  getTradfiAsset,
  canGenerateSignalsForAsset,
  evaluateTickTradfiGate,
  isScheduleGatedSymbol,
  isTradfiSessionAllowed,
  getTradfiExtendedScoreBonus,
  __applyTradingScheduleForTests,
  __resetTradingScheduleForTests
} from '../server/binanceService.js';
import { MarketScreenerService } from '../server/services/MarketScreenerService.js';
import { processTickerState } from '../server/signalEngine.js';
import { getAssetSectorAndBeta } from '../src/utils/riskCalculations.js';
import exchangeInfoFixture from './fixtures/binance/exchangeInfo.json';
import tradingScheduleFixture from './fixtures/binance/tradingSchedule.json';

describe('Modalidade A: TradFi Perpetuals / Equities (US Stocks) - SDD & TDD Suite', () => {
  beforeEach(() => {
    __applyTradingScheduleForTests(tradingScheduleFixture.marketSchedules as any);
  });

  afterEach(() => {
    __resetTradingScheduleForTests();
  });

  describe('1. Dynamic Discovery & Classification of US Stocks', () => {
    it('correctly classifies US Stock symbols with underlyingType EQUITY as EQUITY category', () => {
      const mockSymbolInfo = {
        symbol: 'AAPLUSDT',
        status: 'TRADING',
        baseAsset: 'AAPL',
        quoteAsset: 'USDT',
        contractType: 'TRADIFI_PERPETUAL',
        underlyingType: 'EQUITY',
        underlyingSubType: ['US_EQUITY']
      };

      const category = classifyTradfiContract(mockSymbolInfo);
      expect(category).toBe('EQUITY');
    });

    it('correctly classifies US Index ETFs (SPY, QQQ) as INDEX / EQUITY', () => {
      const mockIndex = {
        symbol: 'SPYUSDT',
        status: 'TRADING',
        baseAsset: 'SPY',
        quoteAsset: 'USDT',
        contractType: 'TRADIFI_PERPETUAL',
        underlyingType: 'INDEX',
        underlyingSubType: ['US_INDEX']
      };

      const category = classifyTradfiContract(mockIndex);
      expect(category).toBe('INDEX');
    });

    it('rejects unclassified or non-TradFi instruments gracefully', () => {
      const cryptoInfo = {
        symbol: 'BTCUSDT',
        status: 'TRADING',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        contractType: 'PERPETUAL',
        underlyingType: 'COIN'
      };

      expect(classifyTradfiContract(cryptoInfo)).toBeNull();
    });
  });

  describe('2. Gate Scope & Calendar Enforcement for US Stocks', () => {
    it('marks TRADIFI_PERPETUAL as schedule-gated and PERPETUAL as non-gated', () => {
      expect(isScheduleGatedSymbol({ symbol: 'AAPLUSDT', contractType: 'TRADIFI_PERPETUAL' })).toBe(true);
      expect(isScheduleGatedSymbol({ symbol: 'BTCUSDT', contractType: 'PERPETUAL' })).toBe(false);
      expect(isScheduleGatedSymbol({ symbol: 'ETHUSDT', contractType: 'PERPETUAL' })).toBe(false);
    });

    it('allows signal generation during REGULAR market session with zero bonus requirement', () => {
      const equitySessions = (tradingScheduleFixture as any).marketSchedules.EQUITY.sessions as Array<{
        startTime: number;
        endTime: number;
        type: string;
      }>;
      const regularSession = equitySessions.find(s => s.type === 'REGULAR');
      expect(regularSession).toBeTruthy();

      const instantInRegular = new Date(regularSession!.startTime + 60000);
      const decision = canGenerateSignalsForAsset(
        { symbol: 'TSLAUSDT', contractType: 'TRADIFI_PERPETUAL', tradfiCategory: 'EQUITY' },
        instantInRegular
      );

      expect(decision.allow).toBe(true);
      expect(decision.session).toBe('REGULAR');
      expect(decision.scoreBonus).toBe(0);
    });

    it('allows PRE_MARKET and AFTER_MARKET with +5 pts extended score bonus', () => {
      const equitySessions = (tradingScheduleFixture as any).marketSchedules.EQUITY.sessions as Array<{
        startTime: number;
        endTime: number;
        type: string;
      }>;
      const preSession = equitySessions.find(s => s.type === 'PRE_MARKET');
      const afterSession = equitySessions.find(s => s.type === 'AFTER_MARKET');

      if (preSession) {
        const instantPre = new Date(preSession.startTime + 60000);
        const decision = canGenerateSignalsForAsset(
          { symbol: 'NVDAUSDT', contractType: 'TRADIFI_PERPETUAL', tradfiCategory: 'EQUITY' },
          instantPre
        );
        expect(decision.allow).toBe(true);
        expect(decision.session).toBe('PRE_MARKET');
        expect(decision.scoreBonus).toBe(5);
      }

      if (afterSession) {
        const instantAfter = new Date(afterSession.startTime + 60000);
        const decision = canGenerateSignalsForAsset(
          { symbol: 'NVDAUSDT', contractType: 'TRADIFI_PERPETUAL', tradfiCategory: 'EQUITY' },
          instantAfter
        );
        expect(decision.allow).toBe(true);
        expect(decision.session).toBe('AFTER_MARKET');
        expect(decision.scoreBonus).toBe(5);
      }
    });

    it('blocks signals during OVERNIGHT or NO_TRADING sessions', () => {
      const equitySessions = (tradingScheduleFixture as any).marketSchedules.EQUITY.sessions as Array<{
        startTime: number;
        endTime: number;
        type: string;
      }>;
      const overnightSession = equitySessions.find(s => s.type === 'OVERNIGHT');

      if (overnightSession) {
        const instantOvernight = new Date(overnightSession.startTime + 60000);
        const decision = canGenerateSignalsForAsset(
          { symbol: 'AAPLUSDT', contractType: 'TRADIFI_PERPETUAL', tradfiCategory: 'EQUITY' },
          instantOvernight
        );
        expect(decision.allow).toBe(false);
        expect(decision.reason).toMatch(/fechad/i);
      }
    });
  });

  describe('3. Sector Classification and Risk Metadata for US Stocks', () => {
    it('classifies major US Stocks under TRADFI sector with informative tags in MarketScreenerService', () => {
      const screener = MarketScreenerService.getInstance();
      const apple = screener.getSectorInfo('AAPLUSDT');
      const tesla = screener.getSectorInfo('TSLAUSDT');
      const nvidia = screener.getSectorInfo('NVDAUSDT');

      expect(apple.sector).toBe('TRADFI');
      expect(apple.tag).toContain('US Stock');

      expect(tesla.sector).toBe('TRADFI');
      expect(tesla.tag).toContain('US Stock');

      expect(nvidia.sector).toBe('TRADFI');
      expect(nvidia.tag).toContain('US Stock');
    });

    it('provides realistic Betas and metadata in getAssetSectorAndBeta for US Equities', () => {
      const appleMeta = getAssetSectorAndBeta('AAPLUSDT');
      expect(appleMeta.sector).toBe('TRADFI');
      expect(appleMeta.beta).toBe(0.85);

      const tslaMeta = getAssetSectorAndBeta('TSLAUSDT');
      expect(tslaMeta.sector).toBe('TRADFI');
      expect(tslaMeta.beta).toBe(1.10);

      const spyMeta = getAssetSectorAndBeta('SPYUSDT');
      expect(spyMeta.sector).toBe('TRADFI');
      expect(spyMeta.beta).toBe(0.75);
    });
  });

  describe('4. Signal Engine Integration for US Equities', () => {
    it('builds TickerData with marketType tradfi when discovered as TradFi asset', () => {
      // Injects a mock TradFi equity into the registry for the test
      TRADFI_ASSETS.length = 0;
      TRADFI_ASSETS.push({
        symbol: 'AAPLUSDT',
        name: 'Apple Inc.',
        baseAsset: 'AAPL',
        quoteAsset: 'USDT',
        tradfiCategory: 'EQUITY',
        contractType: 'TRADIFI_PERPETUAL'
      });

      const rawTicker = {
        symbol: 'AAPLUSDT',
        lastPrice: '232.50',
        priceChangePercent: '1.85',
        highPrice: '235.00',
        lowPrice: '230.00',
        volume: '500000',
        quoteVolume: '116250000'
      };

      const weights = {
        volumeProfileRange: 50,
        volumeProfileTimeframe: '15m',
        fibonacciZoneWeight: 20,
        openInterestWeight: 20,
        cvdImbalanceWeight: 25,
        rangePocWeight: 15,
        fundingRateWeight: 15,
        trappedTradersWeight: 25,
        rsiDivergenceWeight: 20,
        activeStrategy: 'confluence'
      };

      const ticker = processTickerState(rawTicker, [], 1000000, 0.0001, weights as any);
      expect(ticker).toBeTruthy();
      expect(ticker?.marketType).toBe('tradfi');
      expect(ticker?.name).toContain('US Stock');
      expect(ticker?.baseAsset).toBe('AAPL');
    });
  });
});
