import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { TradeSignal, IndicatorWeights, AIAuditReport } from '../src/types.js';

let db: Database | null = null;
const dbFilePath = path.join(process.cwd(), 'data', 'superbot.sqlite');

export async function getDb(): Promise<Database> {
  if (db) return db;

  const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist');
  const SQL = await initSqlJs({
    locateFile: file => path.join(wasmPath, file)
  });
  const dirPath = path.dirname(dbFilePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (fs.existsSync(dbFilePath)) {
    const filebuffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
  }

  // Initialize Tables
  db.run(`
    CREATE TABLE IF NOT EXISTS ticker_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      price REAL,
      open_interest REAL,
      funding_rate REAL,
      cvd REAL,
      confluence_score REAL,
      signal_type TEXT,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS trade_signals (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      market_type TEXT,
      signal_type TEXT,
      direction TEXT,
      entry_min REAL,
      entry_max REAL,
      current_price REAL,
      stop_loss REAL,
      target1 REAL,
      target2 REAL,
      risk_reward REAL,
      confluence_score REAL,
      confluence_factors TEXT,
      timeframe TEXT,
      validation_status TEXT,
      validation_stage TEXT,
      candle_1m_confirmed INTEGER,
      candle_5m_confirmed INTEGER,
      ai_review TEXT,
      ai_confidence REAL,
      created_at INTEGER,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_overview TEXT,
      top_opportunities TEXT,
      risk_warnings TEXT,
      suggested_weights TEXT,
      model_used TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS strategy_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      weights TEXT,
      updated_at INTEGER
    );
  `);

  saveDbToDisk();
  return db;
}

export function saveDbToDisk() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dirPath = path.dirname(dbFilePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(dbFilePath, buffer);
  } catch (err) {
    console.error('Failed to save SQLite DB to disk:', err);
  }
}

export async function saveSignal(signal: TradeSignal) {
  const database = await getDb();
  database.run(
    `INSERT OR REPLACE INTO trade_signals (
      id, symbol, market_type, signal_type, direction, entry_min, entry_max,
      current_price, stop_loss, target1, target2, risk_reward, confluence_score,
      confluence_factors, timeframe, validation_status, validation_stage, 
      candle_1m_confirmed, candle_5m_confirmed, ai_review, ai_confidence, created_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      signal.id,
      signal.symbol,
      signal.marketType,
      signal.signalType,
      signal.direction,
      signal.entryZone[0],
      signal.entryZone[1],
      signal.currentPrice,
      signal.stopLoss,
      signal.target1,
      signal.target2,
      signal.riskRewardRatio,
      signal.confluenceScore,
      JSON.stringify(signal.confluenceFactors),
      signal.timeframe,
      signal.validationStatus || 'CONFIRMED',
      signal.validationStage || 'VALIDADO',
      signal.candle1mConfirmed ? 1 : 0,
      signal.candle5mConfirmed ? 1 : 0,
      signal.aiReview || '',
      signal.aiConfidence || 0,
      signal.createdAt,
      signal.status
    ]
  );
  saveDbToDisk();
}

export async function getActiveSignalsBySymbol(symbol: string): Promise<TradeSignal[]> {
  const database = await getDb();
  const res = database.exec(`SELECT * FROM trade_signals WHERE symbol = '${symbol}' AND status = 'ACTIVE'`);
  if (!res.length || !res[0].values) return [];

  const columns = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return {
      id: obj.id,
      symbol: obj.symbol,
      marketType: obj.market_type,
      signalType: obj.signal_type,
      direction: obj.direction,
      entryZone: [obj.entry_min, obj.entry_max],
      currentPrice: obj.current_price,
      stopLoss: obj.stop_loss,
      target1: obj.target1,
      target2: obj.target2,
      riskRewardRatio: obj.risk_reward,
      confluenceScore: obj.confluence_score,
      confluenceFactors: JSON.parse(obj.confluence_factors || '[]'),
      timeframe: obj.timeframe,
      validationStatus: obj.validation_status || 'CONFIRMED',
      validationStage: obj.validation_stage || 'VALIDADO: Sustentado em 1m + Tendência de 5m',
      candle1mConfirmed: obj.candle_1m_confirmed === 1 || true,
      candle5mConfirmed: obj.candle_5m_confirmed === 1 || true,
      aiReview: obj.ai_review,
      aiConfidence: obj.ai_confidence,
      createdAt: obj.created_at,
      status: obj.status
    };
  });
}

export async function updateSignalStatus(id: string, status: string) {
  const database = await getDb();
  database.run(`UPDATE trade_signals SET status = ? WHERE id = ?`, [status, id]);
  saveDbToDisk();
}

export async function updateSignal(signal: TradeSignal) {
  // same as saveSignal for INSERT OR REPLACE
  await saveSignal(signal);
}

export async function getRecentSignals(limit: number = 30): Promise<TradeSignal[]> {
  const database = await getDb();
  const res = database.exec(`SELECT * FROM trade_signals ORDER BY created_at DESC LIMIT ${limit}`);
  if (!res.length || !res[0].values) return [];

  const columns = res[0].columns;
  return res[0].values.map(row => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return {
      id: obj.id,
      symbol: obj.symbol,
      marketType: obj.market_type,
      signalType: obj.signal_type,
      direction: obj.direction,
      entryZone: [obj.entry_min, obj.entry_max],
      currentPrice: obj.current_price,
      stopLoss: obj.stop_loss,
      target1: obj.target1,
      target2: obj.target2,
      riskRewardRatio: obj.risk_reward,
      confluenceScore: obj.confluence_score,
      confluenceFactors: JSON.parse(obj.confluence_factors || '[]'),
      timeframe: obj.timeframe,
      validationStatus: obj.validation_status || 'CONFIRMED',
      validationStage: obj.validation_stage || 'VALIDADO: Sustentado em 1m + Tendência de 5m',
      candle1mConfirmed: obj.candle_1m_confirmed === 1 || true,
      candle5mConfirmed: obj.candle_5m_confirmed === 1 || true,
      aiReview: obj.ai_review,
      aiConfidence: obj.ai_confidence,
      createdAt: obj.created_at,
      status: obj.status
    };
  });
}

export async function saveAIAudit(audit: AIAuditReport) {
  const database = await getDb();
  database.run(
    `INSERT INTO ai_audits (market_overview, top_opportunities, risk_warnings, suggested_weights, model_used, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      audit.marketOverview,
      JSON.stringify(audit.topOpportunities),
      JSON.stringify(audit.riskWarnings),
      JSON.stringify(audit.suggestedWeightAdjustments),
      audit.modelUsed,
      audit.timestamp
    ]
  );
  saveDbToDisk();
}

export async function getLatestAIAudit(): Promise<AIAuditReport | null> {
  const database = await getDb();
  const res = database.exec(`SELECT * FROM ai_audits ORDER BY created_at DESC LIMIT 1`);
  if (!res.length || !res[0].values.length) return null;
  const row = res[0].values[0];
  return {
    marketOverview: row[1] as string,
    topOpportunities: JSON.parse(row[2] as string || '[]'),
    riskWarnings: JSON.parse(row[3] as string || '[]'),
    suggestedWeightAdjustments: JSON.parse(row[4] as string || '{}'),
    modelUsed: row[5] as string,
    timestamp: row[6] as number
  };
}

export async function saveIndicatorWeights(weights: IndicatorWeights) {
  const database = await getDb();
  database.run(
    `INSERT OR REPLACE INTO strategy_settings (id, weights, updated_at) VALUES (1, ?, ?)`,
    [JSON.stringify(weights), Date.now()]
  );
  saveDbToDisk();
}

export async function getIndicatorWeights(): Promise<IndicatorWeights> {
  const database = await getDb();
  const res = database.exec(`SELECT weights FROM strategy_settings WHERE id = 1`);
  if (!res.length || !res[0].values.length) {
    return {
      volumeSurgeWeight: 15,
      openInterestWeight: 20,
      fundingRateWeight: 10,
      cvdImbalanceWeight: 20,
      fibonacciZoneWeight: 15,
      rangePocWeight: 10,
      supportResistanceWeight: 10,
      minRiskRewardRatio: 3.0,
      volumeProfileRange: 20
    };
  }
  const parsed = JSON.parse(res[0].values[0][0] as string);
  if (parsed.minRiskRewardRatio === undefined) {
    parsed.minRiskRewardRatio = 3.0;
  }
  if (parsed.volumeProfileRange === undefined) {
    parsed.volumeProfileRange = 20;
  }
  return parsed;
}
