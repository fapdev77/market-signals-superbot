import { describe, it, expect } from 'vitest';
import { resolveAssetSelection } from '../src/components/ScreenerDashboard';
import type { TickerData } from '../src/types';

/**
 * C-04 (FASE 0) — comportamento de `resolveAssetSelection`.
 *
 * O contrato: ou a seleção devolve o objeto EXATO do feed ao vivo (identidade),
 * ou devolve ausência. Nenhuma reconstrução parcial de `TickerData` (CVD=0,
 * OI=0, taker 0.5, Fibonacci aproximado) é fabricada para preencher a tela.
 */

function ticker(symbol: string): TickerData {
  const price = 100;
  return {
    symbol,
    baseAsset: symbol.replace(/USDT$/, ''),
    quoteAsset: 'USDT',
    name: symbol,
    marketType: 'crypto_futures',
    price,
    priceChangePercent24h: 2.5,
    high24h: price * 1.05,
    low24h: price * 0.95,
    volume24h: 1000000,
    quoteVolume24h: 100000000,
    openInterest: 20000000,
    openInterestChange24h: 5.0,
    openInterestChange1h: 1.5,
    fundingRate: 0.0001,
    fundingRateDaily: 0.0003,
    fundingRateAnnualized: 10.95,
    cvd: 5000000,
    cvdDelta: 200000,
    cvdDeltaPercent: 5.0,
    cvdDirection: 'BUY',
    takerBuyRatio: 0.55,
    fibonacci: { swingHigh: price * 1.05, swingLow: price * 0.95, fib50: price, fib618: price * 0.98, fib68: price * 0.975, inGoldenPocket: false },
    rangeProfile: { vah: price * 1.02, val: price * 0.98, poc: price, inValueArea: true },
    keyLevels: { support1: price * 0.97, support2: price * 0.95, resistance1: price * 1.03, resistance2: price * 1.05, structureBreak: 'BULLISH', hasSinglePrintFVG: false },
    confluenceScore: 78,
    signalType: 'LONG',
    signalReason: 'Volume Surge',
    confluenceFactors: [],
    updatedAt: Date.now()
  };
}

describe('C-04 — seleção do Screener sem ticker sintético', () => {
  it('devolve a IDENTIDADE do ticker ao vivo (mesmo objeto, não uma cópia)', () => {
    const live = ticker('BTCUSDT');
    const selection = resolveAssetSelection([live, ticker('ETHUSDT')], 'BTCUSDT');

    expect(selection.status).toBe('RESOLVED');
    if (selection.status === 'RESOLVED') {
      // identidade: é o objeto do feed, não uma reconstrução com os mesmos campos
      expect(selection.ticker).toBe(live);
    }
  });

  it('símbolo fora do feed ⇒ UNAVAILABLE com o símbolo, sem anexar ticker fabricado', () => {
    const selection = resolveAssetSelection([ticker('ETHUSDT')], 'SOLUSDT');

    expect(selection.status).toBe('UNAVAILABLE');
    if (selection.status === 'UNAVAILABLE') {
      expect(selection.symbol).toBe('SOLUSDT');
      // nada de campos de ticker "quase certos" colados no objeto de ausência
      expect(Object.keys(selection).sort()).toEqual(['status', 'symbol']);
    }
  });

  it('feed vazio ⇒ UNAVAILABLE (nunca um ticker gerado a partir do símbolo)', () => {
    const selection = resolveAssetSelection([], 'BTCUSDT');
    expect(selection.status).toBe('UNAVAILABLE');
  });

  it('o match é por igualdade exata do símbolo (quem normaliza é o chamador)', () => {
    // o universo do Screener é normalizado para maiúsculas antes de chegar aqui;
    // a função não "adivinha" variações de caixa/Formato
    const selection = resolveAssetSelection([ticker('BTCUSDT')], 'btcusdt');
    expect(selection.status).toBe('UNAVAILABLE');
  });

  it('preserva todos os campos do ticker vivo (nada é zerado no caminho RESOLVED)', () => {
    const live = ticker('BTCUSDT');
    const selection = resolveAssetSelection([live], 'BTCUSDT');
    if (selection.status === 'RESOLVED') {
      expect(selection.ticker.takerBuyRatio).toBe(0.55);
      expect(selection.ticker.cvdDeltaPercent).toBe(5.0);
      expect(selection.ticker.openInterest).toBe(20000000);
    } else {
      throw new Error('esperava RESOLVED');
    }
  });
});
