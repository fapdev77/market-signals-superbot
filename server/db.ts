import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { TradeSignal, IndicatorWeights, AIAuditReport, AIModelConfig, ScreenerSettings } from '../src/types.js';
import { getDefaultStrategyConfigs } from '../src/constants/strategyPresets.js';
import { getBenchmarkPrice } from '../src/utils/benchmarkPrices.js';
import { DEFAULT_SIGNAL_TTL_SETTINGS } from '../src/utils/signalTtlUtils.js';

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
      validated_at INTEGER,
      rejected_at INTEGER,
      status TEXT,
      strategy_category TEXT
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

    CREATE TABLE IF NOT EXISTS ai_models_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      models TEXT,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS watched_symbols (
      symbol TEXT PRIMARY KEY,
      is_favorite INTEGER DEFAULT 0,
      source TEXT DEFAULT 'DYNAMIC_SCREENER',
      sector TEXT DEFAULT 'ALL',
      added_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS screener_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      settings TEXT,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      route TEXT NOT NULL,
      actor TEXT DEFAULT 'SYSTEM',
      details TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // Safe table migrations for new columns
  try {
    db.run(`ALTER TABLE trade_signals ADD COLUMN validated_at INTEGER;`);
  } catch {
    // Column may already exist
  }
  try {
    db.run(`ALTER TABLE trade_signals ADD COLUMN rejected_at INTEGER;`);
  } catch {
    // Column may already exist
  }
  try {
    db.run(`ALTER TABLE trade_signals ADD COLUMN strategy_category TEXT;`);
  } catch {
    // Column may already exist
  }
  try {
    db.run(`ALTER TABLE trade_signals ADD COLUMN expires_at INTEGER;`);
  } catch {
    // Column may already exist
  }
  try {
    db.run(`ALTER TABLE trade_signals ADD COLUMN ttl_minutes INTEGER;`);
  } catch {
    // Column may already exist
  }
  try {
    db.run(`ALTER TABLE trade_signals ADD COLUMN expiration_reason TEXT;`);
  } catch {
    // Column may already exist
  }
  try {
    db.run(`ALTER TABLE trade_signals ADD COLUMN is_breakeven_active INTEGER;`);
  } catch {
    // Column may already exist
  }

  // Phase 1 Security & Data Integrity: Purge any fabricated historical signals (HIST-*)
  try {
    db.run(`DELETE FROM trade_signals WHERE id LIKE 'HIST-%';`);
  } catch {
    // ignore
  }

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
    const tempPath = `${dbFilePath}.tmp`;
    fs.writeFileSync(tempPath, buffer);
    fs.renameSync(tempPath, dbFilePath);
  } catch (err) {
    console.error('Failed to save SQLite DB to disk:', err);
  }
}

export function rowToTradeSignal(columns: string[], row: any[]): TradeSignal {
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
    strategyCategory: obj.strategy_category || 'INTRADAY',
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
    validatedAt: obj.validated_at || (obj.validation_status === 'CONFIRMED' ? obj.created_at : undefined),
    rejectedAt: obj.rejected_at || (obj.validation_status?.includes('REJECTED') ? obj.created_at : undefined),
    ttlMinutes: obj.ttl_minutes || undefined,
    expiresAt: obj.expires_at || undefined,
    expirationReason: obj.expiration_reason || undefined,
    isBreakevenActive: obj.is_breakeven_active === 1,
    status: obj.status
  };
}

export async function saveSignal(signal: TradeSignal) {
  const database = await getDb();
  database.run(
    `INSERT OR REPLACE INTO trade_signals (
      id, symbol, market_type, signal_type, direction, entry_min, entry_max,
      current_price, stop_loss, target1, target2, risk_reward, confluence_score,
      confluence_factors, timeframe, validation_status, validation_stage, 
      candle_1m_confirmed, candle_5m_confirmed, ai_review, ai_confidence, created_at, validated_at, rejected_at, status, strategy_category,
      expires_at, ttl_minutes, expiration_reason, is_breakeven_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      signal.validatedAt || (signal.validationStatus === 'CONFIRMED' ? signal.createdAt : null),
      signal.rejectedAt || (signal.validationStatus?.includes('REJECTED') ? signal.createdAt : null),
      signal.status,
      signal.strategyCategory || 'INTRADAY',
      signal.expiresAt || null,
      signal.ttlMinutes || null,
      signal.expirationReason || null,
      signal.isBreakevenActive ? 1 : 0
    ]
  );
  saveDbToDisk();
}

export async function getActiveSignals(): Promise<TradeSignal[]> {
  const database = await getDb();
  const res = database.exec(`SELECT * FROM trade_signals WHERE status = 'ACTIVE'`);
  if (!res.length || !res[0].values) return [];

  const columns = res[0].columns;
  return res[0].values.map(row => rowToTradeSignal(columns, row));
}

export async function getActiveSignalsBySymbol(symbol: string, category?: string): Promise<TradeSignal[]> {
  const database = await getDb();
  let query = `SELECT * FROM trade_signals WHERE symbol = '${symbol}' AND status = 'ACTIVE'`;
  if (category) {
    query += ` AND (strategy_category = '${category}' OR (strategy_category IS NULL AND '${category}' = 'INTRADAY'))`;
  }
  const res = database.exec(query);
  if (!res.length || !res[0].values) return [];

  const columns = res[0].columns;
  return res[0].values.map(row => rowToTradeSignal(columns, row));
}

export async function getSignalById(id: string): Promise<TradeSignal | null> {
  const database = await getDb();
  const query = `SELECT * FROM trade_signals WHERE id = ?`;
  const res = database.exec(query, [id]);
  if (!res.length || !res[0].values || !res[0].values.length) return null;

  return rowToTradeSignal(res[0].columns, res[0].values[0]);
}

export async function expireActiveSignalsByCategory(category: string) {
  const database = await getDb();
  database.run(
    `UPDATE trade_signals SET status = 'EXPIRED', expiration_reason = 'Estratégia Redefinida' WHERE (strategy_category = ? OR (strategy_category IS NULL AND ? = 'INTRADAY')) AND status = 'ACTIVE'`,
    [category, category]
  );
  saveDbToDisk();
}

export async function expireAllActiveSignals() {
  const database = await getDb();
  database.run(`UPDATE trade_signals SET status = 'EXPIRED', expiration_reason = 'Reset Manual de Sinais' WHERE status = 'ACTIVE'`);
  saveDbToDisk();
}

/**
 * Sweeps the database and automatically marks signals whose TTL expired as EXPIRED
 */
export async function expireStaleSignals(now: number = Date.now()): Promise<number> {
  const database = await getDb();
  const checkRes = database.exec(`SELECT count(*) FROM trade_signals WHERE status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at <= ${now}`);
  const count = checkRes.length && checkRes[0].values.length ? Number(checkRes[0].values[0][0]) : 0;
  if (count > 0) {
    database.run(
      `UPDATE trade_signals SET status = 'EXPIRED', expiration_reason = 'TTL Expirado (Tempo Limite Atingido)' WHERE status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at <= ?`,
      [now]
    );
    saveDbToDisk();
  }
  return count;
}

export async function updateSignalStatus(id: string, status: string, reason?: string) {
  const database = await getDb();
  if (reason) {
    database.run(`UPDATE trade_signals SET status = ?, expiration_reason = ? WHERE id = ?`, [status, reason, id]);
  } else {
    database.run(`UPDATE trade_signals SET status = ? WHERE id = ?`, [status, id]);
  }
  saveDbToDisk();
}

export async function updateSignal(signal: TradeSignal) {
  // same as saveSignal for INSERT OR REPLACE
  await saveSignal(signal);
}

export async function getRecentSignals(limit: number = 50): Promise<TradeSignal[]> {
  const database = await getDb();
  const res = database.exec(`SELECT * FROM trade_signals ORDER BY created_at DESC LIMIT ${limit}`);
  if (!res.length || !res[0].values) return [];

  const columns = res[0].columns;
  return res[0].values.map(row => rowToTradeSignal(columns, row));
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
  const defaultWeights: IndicatorWeights = {
    activeStrategy: 'intraday' as const,
    strategyLabel: 'Intraday Equilibrado (30m)',
    multiStrategyMode: true,
    enabledStrategies: ['scalp', 'daytrade', 'intraday', 'swing', 'position'] as any[],
    strategyConfigs: getDefaultStrategyConfigs(),
    volumeSurgeWeight: 15,
    openInterestWeight: 20,
    fundingRateWeight: 10,
    cvdImbalanceWeight: 20,
    fibonacciZoneWeight: 15,
    rangePocWeight: 10,
    supportResistanceWeight: 10,
    rsiDivergenceWeight: 20,
    minRiskRewardRatio: 2.5,
    volumeProfileRange: 50,
    volumeProfileTimeframe: '30m',
    volumeProfileCandles: 48,
    signalTtlSettings: DEFAULT_SIGNAL_TTL_SETTINGS
  };

  if (!res.length || !res[0].values.length) {
    return defaultWeights;
  }
  const parsed = JSON.parse(res[0].values[0][0] as string);
  return {
    ...defaultWeights,
    ...parsed,
    multiStrategyMode: parsed.multiStrategyMode !== undefined ? parsed.multiStrategyMode : true,
    enabledStrategies: parsed.enabledStrategies || defaultWeights.enabledStrategies,
    strategyConfigs: parsed.strategyConfigs || defaultWeights.strategyConfigs,
    signalTtlSettings: {
      ...DEFAULT_SIGNAL_TTL_SETTINGS,
      ...(parsed.signalTtlSettings || {})
    }
  };
}

export const defaultAIModels: AIModelConfig[] = [
  {
    id: 'm1',
    name: 'Gemini 2.5 Flash (Principal)',
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
    isActive: true,
    isFallback: false,
    priority: 1,
    rateLimit: { maxReqPerMinute: 60, maxReqPerDay: 10000 },
    parameters: {
      temperature: 0.2,
      maxTokens: 8192,
      topP: 0.95
    }
  },
  {
    id: 'm2',
    name: 'Gemini 2.5 Pro (Contingência / Análise Profunda)',
    provider: 'gemini',
    modelId: 'gemini-2.5-pro',
    isActive: true,
    isFallback: true,
    priority: 2,
    rateLimit: { maxReqPerMinute: 15, maxReqPerDay: 1000 },
    parameters: {
      temperature: 0.1,
      maxTokens: 8192,
      topP: 0.95
    }
  },
  {
    id: 'm3',
    name: 'Ollama Local (Llama 3.2)',
    provider: 'local',
    modelId: 'llama3.2',
    apiUrl: 'http://localhost:11434',
    isActive: false,
    isFallback: true,
    priority: 3,
    rateLimit: { maxReqPerMinute: 300, maxReqPerDay: 50000 },
    parameters: { temperature: 0.1, maxTokens: 4096 }
  },
  {
    id: 'm4',
    name: 'Claude 3.5 Sonnet (OpenRouter)',
    provider: 'openrouter',
    modelId: 'anthropic/claude-3.5-sonnet',
    isActive: false,
    isFallback: false,
    priority: 4,
    rateLimit: { maxReqPerMinute: 100, maxReqPerDay: 5000 },
    parameters: { temperature: 0.2, maxTokens: 4096 }
  }
];

export async function saveAIModels(models: AIModelConfig[]) {
  const database = await getDb();
  database.run(
    `INSERT OR REPLACE INTO ai_models_settings (id, models, updated_at) VALUES (1, ?, ?)`,
    [JSON.stringify(models), Date.now()]
  );
  saveDbToDisk();
}

export async function getAIModels(): Promise<AIModelConfig[]> {
  const database = await getDb();
  const res = database.exec(`SELECT models FROM ai_models_settings WHERE id = 1`);
  if (!res.length || !res[0].values.length) {
    return defaultAIModels;
  }
  try {
    const parsed = JSON.parse(res[0].values[0][0] as string);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Clean any stale conflicting hardcoded system instructions
      return parsed.map((m: AIModelConfig) => {
        if (m.parameters?.systemInstruction && (
          m.parameters.systemInstruction.includes('Exija forte confluência em CVD') ||
          m.parameters.systemInstruction.includes('Require strong confluence in CVD') ||
          m.parameters.systemInstruction.includes('Atue como um analista trader quantitativo')
        )) {
          const { systemInstruction, ...restParams } = m.parameters;
          return { ...m, parameters: restParams };
        }
        return m;
      });
    }
    return defaultAIModels;
  } catch (err) {
    return defaultAIModels;
  }
}

// ============================================
// WATCHED SYMBOLS & SCREENER PERSISTENCE
// ============================================

export interface WatchedSymbolRecord {
  symbol: string;
  isFavorite: boolean;
  source: string;
  sector: string;
  addedAt: number;
  updatedAt: number;
}

export async function getWatchedSymbols(): Promise<WatchedSymbolRecord[]> {
  const database = await getDb();
  const res = database.exec(`SELECT symbol, is_favorite, source, sector, added_at, updated_at FROM watched_symbols`);
  if (!res.length || !res[0].values.length) {
    return [];
  }
  return res[0].values.map(row => ({
    symbol: row[0] as string,
    isFavorite: Number(row[1]) === 1,
    source: (row[2] as string) || 'DYNAMIC_SCREENER',
    sector: (row[3] as string) || 'ALL',
    addedAt: Number(row[4]) || Date.now(),
    updatedAt: Number(row[5]) || Date.now()
  }));
}

export async function getFavoriteSymbols(): Promise<string[]> {
  const database = await getDb();
  const res = database.exec(`SELECT symbol FROM watched_symbols WHERE is_favorite = 1`);
  if (!res.length || !res[0].values.length) {
    return [];
  }
  return res[0].values.map(row => row[0] as string);
}

export async function toggleFavoriteSymbol(symbol: string, forceStatus?: boolean): Promise<boolean> {
  const database = await getDb();
  const res = database.exec(`SELECT is_favorite FROM watched_symbols WHERE symbol = ?`, [symbol]);
  
  let newStatus: boolean;
  if (typeof forceStatus === 'boolean') {
    newStatus = forceStatus;
  } else if (res.length && res[0].values.length) {
    newStatus = Number(res[0].values[0][0]) !== 1;
  } else {
    newStatus = true;
  }

  const now = Date.now();
  database.run(
    `INSERT INTO watched_symbols (symbol, is_favorite, source, sector, added_at, updated_at)
     VALUES (?, ?, 'FAVORITE_MANUAL', 'ALL', ?, ?)
     ON CONFLICT(symbol) DO UPDATE SET 
       is_favorite = excluded.is_favorite,
       updated_at = excluded.updated_at`,
    [symbol, newStatus ? 1 : 0, now, now]
  );
  saveDbToDisk();
  return newStatus;
}

export async function setWatchedSymbol(symbol: string, isFavorite: boolean, source = 'DYNAMIC_SCREENER', sector = 'ALL') {
  const database = await getDb();
  const now = Date.now();
  database.run(
    `INSERT INTO watched_symbols (symbol, is_favorite, source, sector, added_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(symbol) DO UPDATE SET 
       source = excluded.source,
       sector = excluded.sector,
       updated_at = excluded.updated_at`,
    [symbol, isFavorite ? 1 : 0, source, sector, now, now]
  );
  saveDbToDisk();
}

export async function removeNonFavoriteWatchedSymbol(symbol: string) {
  const database = await getDb();
  database.run(`DELETE FROM watched_symbols WHERE symbol = ? AND is_favorite = 0`, [symbol]);
  saveDbToDisk();
}

export const DEFAULT_EXCLUDED_SYMBOLS: string[] = [
  'USDCUSDT',
  'USDTUSDC',
  'USDGUSDT',
  'USDTUSDG',
  'PYUSDUSDT',
  'FDUSDUSDT',
  'USDTFDUSD',
  'TUSDUSDT',
  'BUSDUSDT',
  'USDPUSDT',
  'EURUSDT',
  'AEURUSDT',
  'DAIUSDT',
  'USDEUSDT',
  'USTCUSDT',
  'WBTCUSDT',
  'USDCTUSD',
  'EURSUSDT'
];

export const defaultScreenerSettings: ScreenerSettings = {
  mode: 'HYBRID',
  maxMonitoredDynamicAssets: 8,
  minVolume24hUsd: 25_000_000,
  rescanIntervalMinutes: 15,
  includeMemes: true,
  minPriceChangeFilter: 0,
  excludedSymbols: [...DEFAULT_EXCLUDED_SYMBOLS],
  weights: {
    rvolWeight: 35,
    oiChangeWeight: 30,
    priceMomentumWeight: 20,
    fundingAnomalyWeight: 15
  },
  lastRescanTimestamp: 0
};

export async function getScreenerSettings(): Promise<ScreenerSettings> {
  const database = await getDb();
  const res = database.exec(`SELECT settings FROM screener_settings WHERE id = 1`);
  if (!res.length || !res[0].values.length) {
    return { ...defaultScreenerSettings, excludedSymbols: [...DEFAULT_EXCLUDED_SYMBOLS] };
  }
  try {
    const parsed = JSON.parse(res[0].values[0][0] as string);
    const excluded = Array.isArray(parsed.excludedSymbols) && parsed.excludedSymbols.length > 0
      ? Array.from(new Set(parsed.excludedSymbols.map((s: string) => s.trim().toUpperCase().replace(/[\/\-_]/g, ''))))
      : [...DEFAULT_EXCLUDED_SYMBOLS];
    return { ...defaultScreenerSettings, ...parsed, excludedSymbols: excluded };
  } catch {
    return { ...defaultScreenerSettings, excludedSymbols: [...DEFAULT_EXCLUDED_SYMBOLS] };
  }
}

export async function saveScreenerSettings(settings: ScreenerSettings) {
  const database = await getDb();
  const cleanExcluded = Array.isArray(settings.excludedSymbols)
    ? Array.from(new Set(settings.excludedSymbols.map(s => s.trim().toUpperCase().replace(/[\/\-_]/g, ''))))
    : [...DEFAULT_EXCLUDED_SYMBOLS];
  const settingsToSave: ScreenerSettings = {
    ...settings,
    excludedSymbols: cleanExcluded
  };
  database.run(
    `INSERT OR REPLACE INTO screener_settings (id, settings, updated_at) VALUES (1, ?, ?)`,
    [JSON.stringify(settingsToSave), Date.now()]
  );
  saveDbToDisk();
}

export async function toggleExcludedSymbol(symbol: string, shouldExclude?: boolean): Promise<string[]> {
  const current = await getScreenerSettings();
  const normalized = symbol.trim().toUpperCase().replace(/[\/\-_]/g, '');
  const set = new Set(current.excludedSymbols || []);
  
  const targetState = typeof shouldExclude === 'boolean' ? shouldExclude : !set.has(normalized);
  if (targetState) {
    set.add(normalized);
  } else {
    set.delete(normalized);
  }

  current.excludedSymbols = Array.from(set);
  await saveScreenerSettings(current);
  return current.excludedSymbols;
}

export async function resetExcludedSymbols(): Promise<string[]> {
  const current = await getScreenerSettings();
  current.excludedSymbols = [...DEFAULT_EXCLUDED_SYMBOLS];
  await saveScreenerSettings(current);
  return current.excludedSymbols;
}

/**
 * Returns trade signals generated within the last N days (or between start & end timestamps)
 */
export async function getSignalsByDateRange(startTime: number, endTime: number): Promise<TradeSignal[]> {
  const database = await getDb();
  const query = `SELECT * FROM trade_signals WHERE created_at >= ${startTime} AND created_at <= ${endTime} ORDER BY created_at ASC`;
  const res = database.exec(query);
  if (!res.length || !res[0].values) return [];

  const columns = res[0].columns;
  return res[0].values.map(row => rowToTradeSignal(columns, row));
}

export interface AuditLogEntry {
  id?: number;
  action: string;
  route: string;
  actor: string;
  details?: string;
  createdAt: number;
}

export async function recordAuditLog(action: string, route: string, actor: string = 'SYSTEM', details?: any) {
  try {
    const database = await getDb();
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : (details ? String(details) : '');
    database.run(
      `INSERT INTO audit_logs (action, route, actor, details, created_at) VALUES (?, ?, ?, ?, ?)`,
      [action, route, actor, detailsStr, Date.now()]
    );
    saveDbToDisk();
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
}

export async function getAuditLogs(limit: number = 100): Promise<AuditLogEntry[]> {
  const database = await getDb();
  const res = database.exec(`SELECT id, action, route, actor, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT ${limit}`);
  if (!res.length || !res[0].values) return [];
  return res[0].values.map(row => ({
    id: Number(row[0]),
    action: String(row[1]),
    route: String(row[2]),
    actor: String(row[3]),
    details: row[4] ? String(row[4]) : undefined,
    createdAt: Number(row[5])
  }));
}

// ============================================
// DATABASE INSPECTION, TELEMETRY & MAINTENANCE
// ============================================

export interface TableInfo {
  name: string;
  rowCount: number;
  description: string;
  columns: string[];
  estimatedSizeBytes: number;
  isClearable: boolean;
}

export interface DatabaseStats {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  sqliteVersion: string;
  pageCount: number;
  pageSize: number;
  integrity: string;
  tables: TableInfo[];
  totalRows: number;
  system: {
    heapUsedBytes: number;
    heapTotalBytes: number;
    rssBytes: number;
    uptimeSeconds: number;
    nodeVersion: string;
  };
  timestamp: number;
}

const TABLE_DESCRIPTIONS: Record<string, { desc: string; clearable: boolean }> = {
  trade_signals: { desc: 'Sinais de confluência algorítmica, alvos, stop loss e histórico de auditoria', clearable: true },
  ticker_snapshots: { desc: 'Snapshots periódicos de preços, Open Interest, Funding Rate e CVD', clearable: true },
  ai_audits: { desc: 'Relatórios de auditoria quantitativa gerados pelos modelos LLM', clearable: true },
  strategy_settings: { desc: 'Pesos calibrados de confluência e configuração das estratégias', clearable: false },
  ai_models_settings: { desc: 'Configurações de modelos LLM ativos, chaves de API e contingência', clearable: false },
  watched_symbols: { desc: 'Lista de ativos favoritados ou selecionados para rastreamento ativo', clearable: true },
  screener_settings: { desc: 'Filtros customizados e limites do Market Screener Pro', clearable: false }
};

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const database = await getDb();
  let fileSizeBytes = 0;
  try {
    if (fs.existsSync(dbFilePath)) {
      fileSizeBytes = fs.statSync(dbFilePath).size;
    }
  } catch (err) {
    console.warn('Error reading SQLite file stat:', err);
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Integrity Check
  let integrity = 'OK';
  try {
    const intRes = database.exec('PRAGMA integrity_check;');
    if (intRes.length && intRes[0].values.length) {
      integrity = String(intRes[0].values[0][0]);
    }
  } catch (err: any) {
    integrity = `Erro: ${err?.message || 'Falha ao verificar'}`;
  }

  // Page info
  let pageCount = 0;
  let pageSize = 4096;
  try {
    const pcRes = database.exec('PRAGMA page_count;');
    if (pcRes.length && pcRes[0].values.length) pageCount = Number(pcRes[0].values[0][0]);
    const psRes = database.exec('PRAGMA page_size;');
    if (psRes.length && psRes[0].values.length) pageSize = Number(psRes[0].values[0][0]);
  } catch (err) {
    console.warn('Error reading pragma page info:', err);
  }

  // Tables breakdown
  const tableNames = [
    'trade_signals',
    'ticker_snapshots',
    'ai_audits',
    'strategy_settings',
    'ai_models_settings',
    'watched_symbols',
    'screener_settings'
  ];

  let totalRows = 0;
  const tables: TableInfo[] = [];

  for (const name of tableNames) {
    let rowCount = 0;
    const columns: string[] = [];

    try {
      const cRes = database.exec(`SELECT count(*) FROM ${name};`);
      if (cRes.length && cRes[0].values.length) {
        rowCount = Number(cRes[0].values[0][0]);
      }
    } catch {
      rowCount = 0;
    }

    try {
      const infoRes = database.exec(`PRAGMA table_info(${name});`);
      if (infoRes.length && infoRes[0].values) {
        infoRes[0].values.forEach(row => {
          const colName = String(row[1]);
          const colType = String(row[2] || '');
          columns.push(`${colName} (${colType})`);
        });
      }
    } catch {
      // ignore
    }

    totalRows += rowCount;
    const meta = TABLE_DESCRIPTIONS[name] || { desc: 'Tabela de dados do sistema', clearable: true };
    // Estimated proportional size
    const estimatedSizeBytes = totalRows > 0 ? Math.round((rowCount / Math.max(totalRows, 1)) * fileSizeBytes) : 0;

    tables.push({
      name,
      rowCount,
      description: meta.desc,
      columns,
      estimatedSizeBytes,
      isClearable: meta.clearable
    });
  }

  const mem = process.memoryUsage();

  return {
    filePath: dbFilePath,
    fileName: path.basename(dbFilePath),
    fileSizeBytes,
    fileSizeFormatted: formatBytes(fileSizeBytes),
    sqliteVersion: 'SQLite 3.x (WebAssembly via sql.js)',
    pageCount,
    pageSize,
    integrity,
    tables,
    totalRows,
    system: {
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      rssBytes: mem.rss,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version
    },
    timestamp: Date.now()
  };
}

export async function vacuumDatabase(): Promise<{
  success: boolean;
  oldSizeBytes: number;
  newSizeBytes: number;
  freedBytes: number;
  oldSizeFormatted: string;
  newSizeFormatted: string;
  message: string;
}> {
  const database = await getDb();
  let oldSizeBytes = 0;
  try {
    if (fs.existsSync(dbFilePath)) oldSizeBytes = fs.statSync(dbFilePath).size;
  } catch (err) {
    console.warn('Error reading old size:', err);
  }

  database.run('VACUUM;');
  saveDbToDisk();

  let newSizeBytes = 0;
  try {
    if (fs.existsSync(dbFilePath)) newSizeBytes = fs.statSync(dbFilePath).size;
  } catch (err) {
    console.warn('Error reading new size:', err);
  }

  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const freed = Math.max(0, oldSizeBytes - newSizeBytes);
  return {
    success: true,
    oldSizeBytes,
    newSizeBytes,
    freedBytes: freed,
    oldSizeFormatted: formatBytes(oldSizeBytes),
    newSizeFormatted: formatBytes(newSizeBytes),
    message: freed > 0 
      ? `Banco otimizado com sucesso! ${formatBytes(freed)} de espaço em disco liberados.`
      : `Banco já otimizado. Nenhuma fragmentação residual detectada.`
  };
}

export async function clearTable(tableName: string): Promise<{
  success: boolean;
  tableName: string;
  rowsRemoved: number;
  message: string;
}> {
  const database = await getDb();
  const allowedTables = ['trade_signals', 'ticker_snapshots', 'ai_audits', 'watched_symbols'];
  if (!allowedTables.includes(tableName)) {
    throw new Error(`Tabela "${tableName}" não pode ser limpa diretamente ou é protegida do sistema.`);
  }

  let rowCount = 0;
  try {
    const cRes = database.exec(`SELECT count(*) FROM ${tableName};`);
    if (cRes.length && cRes[0].values.length) rowCount = Number(cRes[0].values[0][0]);
  } catch {
    rowCount = 0;
  }

  database.run(`DELETE FROM ${tableName};`);
  database.run('VACUUM;');
  saveDbToDisk();

  return {
    success: true,
    tableName,
    rowsRemoved: rowCount,
    message: `Tabela ${tableName} limpa com sucesso. ${rowCount} registros removidos.`
  };
}

export async function exportDatabaseJson(): Promise<Record<string, any>> {
  const database = await getDb();
  const exportData: Record<string, any> = {
    exportedAt: new Date().toISOString(),
    timestamp: Date.now(),
    app: 'Market Signals SuperBot',
    version: '1.0.0',
    tables: {}
  };

  const tableNames = [
    'trade_signals',
    'ticker_snapshots',
    'ai_audits',
    'strategy_settings',
    'ai_models_settings',
    'watched_symbols',
    'screener_settings'
  ];

  for (const table of tableNames) {
    try {
      const res = database.exec(`SELECT * FROM ${table};`);
      if (res.length && res[0].values) {
        const cols = res[0].columns;
        const rows = res[0].values.map(val => {
          const item: Record<string, any> = {};
          cols.forEach((col, idx) => {
            if (table === 'ai_models_settings' && col === 'models' && val[idx]) {
              try {
                const parsed = JSON.parse(val[idx] as string);
                const sanitized = Array.isArray(parsed) ? parsed.map(({ apiKey, ...rest }) => rest) : parsed;
                item[col] = JSON.stringify(sanitized);
              } catch {
                item[col] = val[idx];
              }
            } else {
              item[col] = val[idx];
            }
          });
          return item;
        });
        exportData.tables[table] = rows;
      } else {
        exportData.tables[table] = [];
      }
    } catch {
      exportData.tables[table] = [];
    }
  }

  return exportData;
}

export async function factoryResetDatabase(
  defaultWeights: IndicatorWeights,
  defaultModels: AIModelConfig[]
): Promise<{
  success: boolean;
  message: string;
  clearedTables: string[];
  signalsReseededCount: number;
}> {
  const database = await getDb();
  console.log('🔄 [FACTORY RESET] Performing global database reset to factory defaults...');

  // 1. Clear dynamic tables
  database.run(`DELETE FROM trade_signals;`);
  database.run(`DELETE FROM ticker_snapshots;`);
  database.run(`DELETE FROM ai_audits;`);
  database.run(`DELETE FROM watched_symbols;`);

  // 2. Reset strategy weights to factory defaults
  const now = Date.now();
  database.run(`INSERT OR REPLACE INTO strategy_settings (id, weights, updated_at) VALUES (1, ?, ?)`, [
    JSON.stringify(defaultWeights),
    now
  ]);

  // 3. Reset AI models to factory defaults
  database.run(`INSERT OR REPLACE INTO ai_models_settings (id, models, updated_at) VALUES (1, ?, ?)`, [
    JSON.stringify(defaultModels),
    now
  ]);

  // 4. Reset Screener settings to factory defaults
  database.run(`DELETE FROM screener_settings;`);

  // 5. Compact database file
  database.run('VACUUM;');
  saveDbToDisk();

  console.log(`✅ [FACTORY RESET] Global reset completed successfully.`);

  return {
    success: true,
    message: 'Banco de dados restaurado para configurações de fábrica.',
    clearedTables: ['trade_signals', 'ticker_snapshots', 'ai_audits', 'watched_symbols', 'screener_settings'],
    signalsReseededCount: 0
  };
}


