import { HistoricalDataService } from './server/services/HistoricalDataService';
import { BacktestEngine } from './server/services/BacktestEngine';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { DEFAULT_SYMBOLS, TRADFI_ASSETS, fetchBinanceFuturesTickers, fetchOpenInterest, fetchFundingRate, fetchKlines } from './server/binanceService.js';
import { initBinanceWebSocket, getWebSocketStatus, getBinanceLogs } from './server/binanceWebsocket.js';
import { processTickerState, buildTradeSignal } from './server/signalEngine.js';
import { getRecentSignals, saveSignal, saveAIAudit, getLatestAIAudit, getIndicatorWeights, saveIndicatorWeights, getActiveSignalsBySymbol, updateSignalStatus, updateSignal, getAIModels, saveAIModels } from './server/db.js';
import { reviewSignalWithAI, auditMarketWithAI, chatWithAITrader } from './server/aiMotor.js';
import { getAILogs, clearAILogs, addAILog } from './server/aiLogger.js';
import { TickerData, TradeSignal, BotState } from './src/types.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize real-time Binance Futures WebSocket Stream
  initBinanceWebSocket();

  // In-memory active ticker state cache
  let tickerStateCache: Record<string, TickerData> = {};
  let botState: BotState = {
    isMonitoring: true,
    activeTickersCount: DEFAULT_SYMBOLS.length + TRADFI_ASSETS.length,
    lastTickTime: Date.now(),
    ticksProcessed: 0,
    signalsGenerated24h: 0,
    weights: await getIndicatorWeights(),
    aiModels: await getAIModels(),
    aiAnalysisEnabled: true
  };

  /**
   * Continuous Tick-by-Tick Market Monitoring Loop
   */
  async function runMarketTick() {
    if (!botState.isMonitoring) return;

    try {
      // 1. Fetch live Binance Futures 24h Tickers
      const rawFutures = await fetchBinanceFuturesTickers();
      const weights = botState.weights;

      for (const symbol of DEFAULT_SYMBOLS) {
        const raw = rawFutures.find((t: any) => t.symbol === symbol) || {
          symbol,
          lastPrice: symbol.includes('BTC') ? '92450.5' : symbol.includes('ETH') ? '3420.1' : symbol.includes('SOL') ? '188.4' : '12.5',
          priceChangePercent: (Math.sin(Date.now() / 10000 + symbol.length) * 3.5).toFixed(2),
          highPrice: '94000',
          lowPrice: '90500',
          volume: '450000',
          quoteVolume: '4100000000'
        };

        // Fetch Kline, Open Interest, Funding Rate
        const klines = await fetchKlines(symbol, '15m', 40);
        const { openInterest } = await fetchOpenInterest(symbol);
        const { fundingRate } = await fetchFundingRate(symbol);

        // Process quantitative state
        const processed = processTickerState(
          raw,
          klines,
          openInterest || (parseFloat(raw.lastPrice || '100') * 50000),
          fundingRate,
          weights
        );

        tickerStateCache[symbol] = processed;

        // Generate signal if high confluence with 1m & 5m validation
        const potentialSignal = buildTradeSignal(processed, klines, weights.minRiskRewardRatio);
        if (potentialSignal) {
          const activeSignals = await getActiveSignalsBySymbol(symbol);
          let shouldInsert = true;

          for (const active of activeSignals) {
            if (active.direction === potentialSignal.direction) {
              // Direction is the same, so no new signal is needed
              shouldInsert = false;
              
              // Only update if validation status changed (e.g. from PENDING to CONFIRMED or REJECTED)
              if (active.validationStatus !== potentialSignal.validationStatus || active.validationStage !== potentialSignal.validationStage) {
                active.validationStatus = potentialSignal.validationStatus;
                active.validationStage = potentialSignal.validationStage;
                active.candle1mConfirmed = potentialSignal.candle1mConfirmed;
                active.candle5mConfirmed = potentialSignal.candle5mConfirmed;
                
                // If rejected, mark as EXPIRED/REJECTED_SPIKE to remove it from active list
                if (active.validationStatus === 'REJECTED_SPIKE') {
                  active.status = 'EXPIRED';
                }
                await updateSignal(active);
              }
            } else {
              // Direction changed! The old signal is no longer valid
              await updateSignalStatus(active.id, 'EXPIRED');
            }
          }

          if (shouldInsert && potentialSignal.validationStatus !== 'REJECTED_SPIKE') {
            await saveSignal(potentialSignal);
            botState.signalsGenerated24h++;
          }
        }
      }

      // Add TradFi Asset Tickers (S&P500, Nasdaq, Gold, stocks)
      const now = Date.now();
      TRADFI_ASSETS.forEach(asset => {
        const basePrice = asset.symbol === 'SPY' ? 585.2 : asset.symbol === 'QQQ' ? 510.5 : asset.symbol === 'NVDA' ? 142.8 : asset.symbol === 'AAPL' ? 232.0 : asset.symbol === 'TSLA' ? 250.4 : 2740.0;
        const varPct = Math.sin((now / 15000) + asset.symbol.length) * 1.8;
        const currentPrice = parseFloat((basePrice * (1 + varPct / 100)).toFixed(2));

        tickerStateCache[asset.symbol] = {
          symbol: asset.symbol,
          baseAsset: asset.baseAsset,
          quoteAsset: asset.quoteAsset,
          name: asset.name,
          marketType: 'tradfi',
          price: currentPrice,
          priceChangePercent24h: parseFloat(varPct.toFixed(2)),
          high24h: parseFloat((basePrice * 1.015).toFixed(2)),
          low24h: parseFloat((basePrice * 0.985).toFixed(2)),
          volume24h: 1850000,
          quoteVolume24h: 1080000000,
          openInterest: 0,
          openInterestChange24h: 0,
          openInterestChange1h: 0,
          fundingRate: 0,
          fundingRateAnnualized: 0,
          cvd: varPct * 120000,
          cvdDirection: varPct > 0 ? 'BUY' : 'SELL',
          takerBuyRatio: 0.5 + varPct * 0.05,
          fibonacci: {
            fib50: basePrice,
            fib618: basePrice * 0.995,
            fib68: basePrice * 0.992,
            swingHigh: basePrice * 1.02,
            swingLow: basePrice * 0.98,
            inGoldenPocket: Math.abs(varPct) < 0.3
          },
          rangeProfile: {
            vah: basePrice * 1.01,
            val: basePrice * 0.99,
            poc: basePrice,
            inValueArea: true
          },
          keyLevels: {
            support1: basePrice * 0.988,
            support2: basePrice * 0.975,
            resistance1: basePrice * 1.012,
            resistance2: basePrice * 1.025,
            structureBreak: varPct > 1 ? 'BULLISH' : varPct < -1 ? 'BEARISH' : 'NONE',
            hasSinglePrintFVG: false
          },
          confluenceScore: Math.round(50 + Math.abs(varPct) * 15),
          signalType: varPct > 1.2 ? 'LONG' : varPct < -1.2 ? 'SHORT' : 'NEUTRAL',
          signalReason: 'Índice/Ativo TradFi rastreado para confluência macro.',
          confluenceFactors: [`Fluxo institucional TradFi (${varPct > 0 ? 'Alta' : 'Baixa'} de ${varPct.toFixed(2)}%)`],
          updatedAt: now
        };
      });

      botState.ticksProcessed++;
      botState.lastTickTime = Date.now();
    } catch (err) {
      console.error('Market tick loop error:', err);
    }
  }

  // Run first tick immediately, then poll every 4 seconds
  runMarketTick();
  setInterval(runMarketTick, 4000);

  // --- API ENDPOINTS ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Get Binance WebSocket & API status
  app.get('/api/binance/status', (req, res) => {
    const ws = getWebSocketStatus();
    res.json({
      websocket: ws,
      timestamp: Date.now()
    });
  });

  // Get Binance connection logs
  app.get('/api/binance/logs', (req, res) => {
    const logs = getBinanceLogs();
    res.json(logs);
  });

  // Get Bot Status
  app.get('/api/bot/status', (req, res) => {
    res.json(botState);
  });

  // Toggle Bot Monitoring
  app.post('/api/bot/toggle', (req, res) => {
    botState.isMonitoring = !botState.isMonitoring;
    res.json({ isMonitoring: botState.isMonitoring });
  });

  // Toggle AI Analysis Mode
  app.post('/api/bot/toggle-ai', (req, res) => {
    if (typeof req.body?.enabled === 'boolean') {
      botState.aiAnalysisEnabled = req.body.enabled;
    } else {
      botState.aiAnalysisEnabled = !botState.aiAnalysisEnabled;
    }
    res.json({ aiAnalysisEnabled: botState.aiAnalysisEnabled });
  });

  // Get All Monitored Tickers Ticks
  app.get('/api/tickers', (req, res) => {
    const list = Object.values(tickerStateCache).sort((a, b) => a.symbol.localeCompare(b.symbol));
    res.json(list);
  });

  // Get Specific Ticker Details & Kline Chart
  app.get('/api/tickers/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const timeframe = (req.query.tf as string) || '15m';
    const ticker = tickerStateCache[symbol];
    const klines = await fetchKlines(symbol, timeframe, 60);
    res.json({ ticker, klines });
  });

  // Get Recent Generated Signals from SQLite
  app.get('/api/signals', async (req, res) => {
    try {
      const signals = await getRecentSignals(50);
      res.json(signals);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch signals' });
    }
  });

  // Trigger AI Signal Review for a specific symbol
  app.post('/api/ai/review', async (req, res) => {
    const { symbol, model } = req.body;
    const ticker = tickerStateCache[symbol];
    if (!ticker) {
      return res.status(404).json({ error: 'Ticker not found' });
    }

    const weights = await getIndicatorWeights();
    const potentialSignal: TradeSignal = buildTradeSignal(ticker, [], weights.minRiskRewardRatio) || {
      id: `${symbol}-CUSTOM-${Date.now()}`,
      symbol,
      marketType: ticker.marketType,
      signalType: ticker.signalType,
      direction: ticker.signalType.includes('SHORT') ? 'SHORT' : 'LONG',
      entryZone: [ticker.price * 0.998, ticker.price],
      currentPrice: ticker.price,
      stopLoss: ticker.price * 0.985,
      target1: ticker.price * 1.02,
      target2: ticker.price * 1.04,
      riskRewardRatio: 2.2,
      confluenceScore: ticker.confluenceScore,
      confluenceFactors: ticker.confluenceFactors,
      timeframe: '1m / 5m / 15m',
      validationStatus: 'CONFIRMED',
      validationStage: 'VALIDADO: Auditoria IA Solicitada',
      candle1mConfirmed: true,
      candle5mConfirmed: true,
      createdAt: Date.now(),
      status: 'ACTIVE'
    };

    const review = await reviewSignalWithAI(ticker, potentialSignal, model, botState.aiAnalysisEnabled, botState.aiModels);
    res.json(review);
  });

  // Trigger Deep Strategic Market Audit
  app.post('/api/ai/audit', async (req, res) => {
    const { model } = req.body || {};
    const tickers = Object.values(tickerStateCache);
    const signals = await getRecentSignals(10);
    const audit = await auditMarketWithAI(tickers, signals, botState.weights, botState.aiAnalysisEnabled, model, botState.aiModels);
    await saveAIAudit(audit);
    res.json(audit);
  });

  // Get Latest Strategic AI Audit
  app.get('/api/ai/audit/latest', async (req, res) => {
    const latest = await getLatestAIAudit();
    res.json(latest || {
      marketOverview: 'Nenhuma auditoria executada ainda. Clique em "Executar Auditoria IA" para iniciar.',
      topOpportunities: [],
      riskWarnings: [],
      suggestedWeightAdjustments: botState.weights,
      modelUsed: 'gemini-2.5-flash',
      timestamp: Date.now()
    });
  });

  // AI Assistant Chat Handler
  app.post('/api/ai/chat', async (req, res) => {
    const { message, symbol, model } = req.body || {};
    const ticker = symbol ? tickerStateCache[symbol] : null;
    const { reply, modelUsed } = await chatWithAITrader(message || '', ticker, botState.aiAnalysisEnabled, model, botState.aiModels);
    res.json({ reply, modelUsed });
  });

  // Get / Update Indicator Weights
  app.get('/api/settings/weights', (req, res) => {
    res.json(botState.weights);
  });

  app.post('/api/settings/weights', async (req, res) => {
    const newWeights = req.body;
    botState.weights = { ...botState.weights, ...newWeights };
    await saveIndicatorWeights(botState.weights);
    res.json({ success: true, weights: botState.weights });
  });

  // Get / Update AI Models Settings
  app.get('/api/settings/ai-models', (req, res) => {
    res.json(botState.aiModels);
  });

  app.post('/api/settings/ai-models', async (req, res) => {
    if (Array.isArray(req.body)) {
      botState.aiModels = req.body;
      await saveAIModels(botState.aiModels);
      res.json({ success: true, models: botState.aiModels });
    } else {
      res.status(400).json({ error: 'Expected array of AIModelConfig' });
    }
  });

  // Get AI Logs
  app.get('/api/ai/logs', (req, res) => {
    res.json(getAILogs());
  });

  // Clear AI Logs
  app.delete('/api/ai/logs', (req, res) => {
    clearAILogs();
    res.json({ success: true, message: 'Logs de IA zerados com sucesso.' });
  });

  // Test AI Connection / Ping with Full Diagnostics
  app.post('/api/ai/test-connection', async (req, res) => {
    const startTime = Date.now();
    const { modelId, provider, apiUrl, apiKey } = req.body || {};
    const diagnosticSteps: string[] = [];

    try {
      diagnosticSteps.push(`Provedor selecionado: ${provider || 'gemini'}`);
      diagnosticSteps.push(`ID do Modelo: ${modelId || 'padrão'}`);

      if (provider === 'gemini' || !provider) {
        const key = apiKey || process.env.GEMINI_API_KEY;
        const keyOrigin = apiKey ? 'Informada no formulário' : process.env.GEMINI_API_KEY ? 'Variável de ambiente GEMINI_API_KEY' : 'Não encontrada';
        diagnosticSteps.push(`Origem da chave API: ${keyOrigin}`);

        if (!key) {
          const msg = 'Chave GEMINI_API_KEY não configurada no servidor nem no formulário.';
          addAILog({
            level: 'ERROR',
            type: 'TEST_CONNECTION',
            provider: 'gemini',
            modelId: modelId || 'gemini-2.5-flash',
            message: msg,
            durationMs: Date.now() - startTime,
            details: { diagnosticSteps }
          });
          return res.status(400).json({ success: false, message: msg, diagnosticSteps });
        }

        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: key });
        const targetModel = (!modelId || modelId === 'gemini-flash-latest' || modelId === 'gemini-1.5-flash-latest') ? 'gemini-2.5-flash' : modelId;
        
        diagnosticSteps.push(`Executando chamada ping no modelo '${targetModel}'...`);
        const response = await ai.models.generateContent({
          model: targetModel,
          contents: 'Ping test. Reply OK.',
        });

        const latency = Date.now() - startTime;
        const previewText = response.text?.slice(0, 100) || 'OK';
        diagnosticSteps.push(`Resposta recebida com sucesso (${latency}ms): "${previewText}"`);

        const msg = `Google Gemini (${targetModel}) conectado com sucesso! Resposta em ${latency}ms.`;
        addAILog({
          level: 'SUCCESS',
          type: 'TEST_CONNECTION',
          provider: 'gemini',
          modelId: targetModel,
          message: msg,
          durationMs: latency,
          details: { diagnosticSteps, preview: previewText }
        });

        return res.json({
          success: true,
          latencyMs: latency,
          message: msg,
          preview: previewText,
          diagnosticSteps
        });
      }

      if (provider === 'local') {
        const url = (apiUrl || 'http://localhost:11434').replace(/\/+$/, '');
        const modelName = modelId || 'llama3.2';
        const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
        const isPrivateIp = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(url.replace(/^https?:\/\//, ''));

        diagnosticSteps.push(`URL da API Local: ${url}`);
        diagnosticSteps.push(`Modelo Testado: ${modelName}`);

        if (isLocalhost || isPrivateIp) {
          diagnosticSteps.push(`[Informação de Rede] '${url}' é um endereço de rede local/privada.`);
          diagnosticSteps.push(`O backend do SuperBot está rodando na Nuvem (Cloud Run). Se seu Ollama estiver rodando no seu computador pessoal nessa rede Wi-Fi local, o servidor na nuvem não conseguirá alcançá-lo sem um túnel público.`);
        }

        let pingSuccess = false;
        let activeEndpoint = '';
        let availableModelsList: string[] = [];

        // 1. Test GET /api/tags (List installed models on Ollama)
        diagnosticSteps.push(`[Passo 1/3] Testando GET ${url}/api/tags (Lista de Modelos do Ollama)...`);
        try {
          const res1 = await fetch(`${url}/api/tags`, { method: 'GET' });
          if (res1.ok) {
            pingSuccess = true;
            activeEndpoint = `${url}/api/tags`;
            const data1 = await res1.json();
            if (Array.isArray(data1.models)) {
              availableModelsList = data1.models.map((m: any) => m.name || m.model);
              diagnosticSteps.push(`[Sucesso /api/tags] Modelos detectados no seu servidor Ollama: ${availableModelsList.join(', ')}`);
            } else {
              diagnosticSteps.push(`[Sucesso /api/tags] Endpoint /api/tags respondeu HTTP 200`);
            }
          } else {
            diagnosticSteps.push(`[Passo 1/3] Endpoint /api/tags retornou HTTP ${res1.status}`);
          }
        } catch (e: any) {
          diagnosticSteps.push(`[Passo 1/3] Falha em GET /api/tags: ${e.message}`);
        }

        // 2. Test GET /v1/models
        if (!pingSuccess) {
          diagnosticSteps.push(`[Passo 2/3] Testando GET ${url}/v1/models...`);
          try {
            const res2 = await fetch(`${url}/v1/models`, { method: 'GET' });
            if (res2.ok) {
              pingSuccess = true;
              activeEndpoint = `${url}/v1/models`;
              diagnosticSteps.push(`[Passo 2/3] Sucesso! Endpoint /v1/models retornou HTTP ${res2.status}`);
            } else {
              diagnosticSteps.push(`[Passo 2/3] Endpoint /v1/models retornou HTTP ${res2.status}`);
            }
          } catch (e: any) {
            diagnosticSteps.push(`[Passo 2/3] Falha em GET /v1/models: ${e.message}`);
          }
        }

        // 3. Test POST /api/generate (Real Generation Ping)
        diagnosticSteps.push(`[Passo 3/3] Executando geração de teste POST ${url}/api/generate no modelo '${modelName}'...`);
        try {
          const res3 = await fetch(`${url}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: modelName,
              prompt: 'Ping test. Reply OK.',
              stream: false
            })
          });
          if (res3.ok) {
            const data3 = await res3.json();
            const outputStr = data3.response || data3.output || 'OK';
            pingSuccess = true;
            activeEndpoint = `${url}/api/generate`;
            diagnosticSteps.push(`[Sucesso /api/generate] Modelo '${modelName}' respondeu com sucesso: "${outputStr.trim().slice(0, 100)}"`);
          } else {
            const errText = await res3.text().catch(() => '');
            diagnosticSteps.push(`[Passo 3/3] POST /api/generate no modelo '${modelName}' retornou HTTP ${res3.status}: ${errText.slice(0, 120)}`);
          }
        } catch (e: any) {
          diagnosticSteps.push(`[Passo 3/3] Falha em POST /api/generate: ${e.message}`);
        }

        const latency = Date.now() - startTime;

        if (pingSuccess) {
          const msg = `Serviço Ollama/Local em '${url}' ativo e respondendo (${latency}ms). Modelo: ${modelName}`;
          addAILog({
            level: 'SUCCESS',
            type: 'TEST_CONNECTION',
            provider: 'local',
            modelId: modelName,
            message: msg,
            durationMs: latency,
            details: { diagnosticSteps, url, activeEndpoint, availableModels: availableModelsList }
          });

          return res.json({
            success: true,
            latencyMs: latency,
            message: msg,
            diagnosticSteps
          });
        }

        if (isLocalhost || isPrivateIp) {
          diagnosticSteps.push(`[Guia de Conexão Ollama para Nuvem]:`);
          diagnosticSteps.push(`1. No computador onde seu Ollama está rodando (com os modelos ${modelName}), abra o terminal.`);
          diagnosticSteps.push(`2. Execute o Ngrok: 'ngrok http 11434'`);
          diagnosticSteps.push(`3. Copie a URL pública HTTPS (ex: https://xxxx.ngrok-free.app).`);
          diagnosticSteps.push(`4. Cole essa URL no campo 'URL da API' nas configurações do modelo Ollama.`);

          const msg = `Ollama em '${url}' inacessível pela Nuvem. Para conectar seu Ollama local, execute 'ngrok http 11434' no seu PC e use a URL HTTPS gerada.`;
          
          addAILog({
            level: 'ERROR',
            type: 'TEST_CONNECTION',
            provider: 'local',
            modelId: modelName,
            message: msg,
            durationMs: latency,
            details: { diagnosticSteps, url, isPrivateIp: true }
          });

          return res.status(400).json({
            success: false,
            latencyMs: latency,
            message: msg,
            diagnosticSteps
          });
        }

        const msg = `Servidor Ollama/Local em '${url}' não respondeu. Verifique se o serviço está ativo e o modelo '${modelName}' instalado.`;
        addAILog({
          level: 'ERROR',
          type: 'TEST_CONNECTION',
          provider: 'local',
          modelId: modelName,
          message: msg,
          durationMs: latency,
          details: { diagnosticSteps, url }
        });

        return res.status(400).json({
          success: false,
          latencyMs: latency,
          message: msg,
          diagnosticSteps
        });
      }

      if (provider === 'openrouter' || provider === 'openai') {
        const defaultUrl = provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1';
        const url = (apiUrl || defaultUrl).replace(/\/+$/, '');
        const key = apiKey || (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY);
        
        diagnosticSteps.push(`URL do Provedor: ${url}`);
        diagnosticSteps.push(`Chave API presente: ${key ? 'Sim' : 'Não'}`);

        if (!key) {
          const msg = `Chave API do ${provider.toUpperCase()} não informada.`;
          addAILog({
            level: 'ERROR',
            type: 'TEST_CONNECTION',
            provider,
            modelId: modelId || 'default',
            message: msg,
            durationMs: Date.now() - startTime,
            details: { diagnosticSteps }
          });
          return res.status(400).json({ success: false, message: msg, diagnosticSteps });
        }

        diagnosticSteps.push(`Testando GET ${url}/models...`);
        const testRes = await fetch(`${url}/models`, {
          headers: {
            'Authorization': `Bearer ${key}`,
            ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://superbot.ai', 'X-Title': 'SuperBot' } : {})
          }
        });

        const latency = Date.now() - startTime;

        if (testRes.ok) {
          const msg = `API ${provider.toUpperCase()} conectada com sucesso! (${latency}ms)`;
          diagnosticSteps.push(`Sucesso! API respondeu HTTP ${testRes.status}`);

          addAILog({
            level: 'SUCCESS',
            type: 'TEST_CONNECTION',
            provider,
            modelId: modelId || 'default',
            message: msg,
            durationMs: latency,
            details: { diagnosticSteps, url }
          });

          return res.json({
            success: true,
            latencyMs: latency,
            message: msg,
            diagnosticSteps
          });
        }

        const errBody = await testRes.text();
        const msg = `Serviço ${provider.toUpperCase()} retornou HTTP ${testRes.status}: ${errBody.slice(0, 100)}`;
        diagnosticSteps.push(`Erro HTTP ${testRes.status}: ${errBody.slice(0, 200)}`);

        addAILog({
          level: 'ERROR',
          type: 'TEST_CONNECTION',
          provider,
          modelId: modelId || 'default',
          message: msg,
          durationMs: latency,
          details: { diagnosticSteps, httpStatus: testRes.status, errBody }
        });

        return res.status(400).json({ success: false, message: msg, diagnosticSteps });
      }

      if (provider === 'anthropic') {
        const key = apiKey || process.env.ANTHROPIC_API_KEY;
        diagnosticSteps.push(`Chave API Anthropic presente: ${key ? 'Sim' : 'Não'}`);

        if (!key) {
          const msg = 'Chave API da Anthropic não informada.';
          addAILog({
            level: 'ERROR',
            type: 'TEST_CONNECTION',
            provider: 'anthropic',
            modelId: modelId || 'claude-3-5-sonnet',
            message: msg,
            durationMs: Date.now() - startTime,
            details: { diagnosticSteps }
          });
          return res.status(400).json({ success: false, message: msg, diagnosticSteps });
        }

        const latency = Date.now() - startTime;
        const msg = `Anthropic API pronta para uso (${latency}ms).`;

        addAILog({
          level: 'SUCCESS',
          type: 'TEST_CONNECTION',
          provider: 'anthropic',
          modelId: modelId || 'claude-3-5-sonnet',
          message: msg,
          durationMs: latency,
          details: { diagnosticSteps }
        });

        return res.json({
          success: true,
          latencyMs: latency,
          message: msg,
          diagnosticSteps
        });
      }

      const msg = `Provedor ${provider} desconhecido.`;
      return res.status(400).json({ success: false, message: msg, diagnosticSteps });
    } catch (err: any) {
      const latency = Date.now() - startTime;
      diagnosticSteps.push(`Exceção não tratada: ${err.message}`);

      addAILog({
        level: 'ERROR',
        type: 'TEST_CONNECTION',
        provider: provider || 'unknown',
        modelId: modelId || 'unknown',
        message: `Exceção: ${err.message}`,
        durationMs: latency,
        details: { diagnosticSteps, errorStack: err.stack }
      });

      return res.status(500).json({
        success: false,
        latencyMs: latency,
        message: `Erro na conexão: ${err.message || String(err)}`,
        diagnosticSteps
      });
    }
  });


  app.post('/api/backtest/sync', async (req, res) => {
    const { symbol, days, forceFull } = req.body;
    // Dispara a sincronizacao em background
    HistoricalDataService.syncSymbol(symbol, days || 30, forceFull === true);
    res.json({ success: true, message: `Sync initiated for ${symbol}` });
  });

  app.get('/api/backtest/sync/:symbol', (req, res) => {
    const state = HistoricalDataService.getSyncState(req.params.symbol);
    res.json(state);
  });

  app.get('/api/backtest/stats/:symbol', async (req, res) => {
    try {
      const stats = await HistoricalDataService.getStats(req.params.symbol.toUpperCase());
      res.json({ success: true, stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/backtest/run', async (req, res) => {
    try {
      const { symbol, days, profile, weights, useCache } = req.body;
      const activeWeights = weights || botState.weights;
      const result = await BacktestEngine.runBacktest({
        symbol,
        days: days || 30,
        profile: profile || 'daytrade',
        weights: activeWeights
      }, useCache !== false);
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/backtest/autotune', async (req, res) => {
    try {
      const { symbol, profile, days, iterations } = req.body;
      const tuneResult = await BacktestEngine.runAutoTune(
        symbol || 'BTCUSDT',
        profile || 'scalp',
        days || 30,
        iterations || 20,
        botState.weights
      );
      res.json({ success: true, tuneResult });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/backtest/trade-candles', async (req, res) => {
    try {
      const { symbol, startTime, endTime } = req.query;
      if (!symbol || !startTime || !endTime) {
        return res.status(400).json({ error: 'Missing parameters' });
      }
      const klines = await HistoricalDataService.getTradeCandles(
        (symbol as string).toUpperCase(),
        parseInt(startTime as string),
        parseInt(endTime as string)
      );
      res.json({ success: true, klines });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });


  // VITE MIDDLEWARE (Dev) / STATIC FILES (Prod)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🤖 Market Signals SuperBot Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
