/**
 * Captures real API responses from Binance Futures public endpoints into tests/fixtures/binance/
 * Endpoints are rate-limited and publicly accessible without API keys.
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://fapi.binance.com';
const FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/binance');

async function fetchPublicJson(endpoint: string) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`Fetching ${url}...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'MarketSignalsSuperBot/1.0'
    }
  });
  if (!res.ok) {
    throw new Error(`Failed ${url}: HTTP ${res.status}`);
  }
  return res.json();
}

async function main() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  console.log('Capturing Binance Futures fixtures...');

  try {
    // 1. exchangeInfo
    const exchangeInfo = await fetchPublicJson('/fapi/v1/exchangeInfo');
    const symbols = exchangeInfo.symbols || [];
    const tradfiSymbols = symbols.filter((s: any) => s.contractType === 'TRADIFI_PERPETUAL');
    const cryptoSample = symbols.filter((s: any) => ['BTCUSDT', 'ETHUSDT', 'PAXGUSDT'].includes(s.symbol));
    const filteredExchangeInfo = {
      timezone: exchangeInfo.timezone,
      serverTime: exchangeInfo.serverTime,
      symbols: [...cryptoSample, ...tradfiSymbols]
    };
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'exchangeInfo.json'),
      JSON.stringify(filteredExchangeInfo, null, 2)
    );
    console.log(`Saved exchangeInfo.json (${filteredExchangeInfo.symbols.length} symbols)`);
  } catch (err: any) {
    console.warn(`exchangeInfo capture warning: ${err.message}`);
  }

  try {
    // 2. tradingSchedule
    const tradingSchedule = await fetchPublicJson('/fapi/v1/tradingSchedule');
    const schedulePayload = {
      capturedAt: new Date().toISOString(),
      ...tradingSchedule
    };
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'tradingSchedule.json'),
      JSON.stringify(schedulePayload, null, 2)
    );
    console.log('Saved tradingSchedule.json');
  } catch (err: any) {
    console.warn(`tradingSchedule capture warning: ${err.message}`);
  }

  console.log('Done capturing fixtures.');
}

main().catch(err => {
  console.error('Fixture capture script error:', err);
});
