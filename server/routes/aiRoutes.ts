import { Router, Request, Response } from 'express';
import { reviewSignalWithAI, auditMarketWithAI, chatWithAITrader } from '../aiMotor.js';
import { getAILogs, clearAILogs, addAILog } from '../aiLogger.js';
import { getRecentSignals, saveAIAudit, getLatestAIAudit, getIndicatorWeights } from '../db.js';
import { buildTradeSignal } from '../signalEngine.js';
import { TickerData, TradeSignal, BotState } from '../../src/types.js';

export function createAIRouter(
  getBotState: () => BotState,
  getTickerCache: () => Record<string, TickerData>
): Router {
  const router = Router();

  // Get AI Logs
  router.get('/logs', (req: Request, res: Response) => {
    res.json(getAILogs());
  });

  // Clear AI Logs
  router.delete('/logs', (req: Request, res: Response) => {
    clearAILogs();
    res.json({ success: true, message: 'Logs de IA zerados com sucesso.' });
  });

  // Trigger AI Signal Review for a specific symbol
  router.post('/review', async (req: Request, res: Response) => {
    const { symbol, model, personaId } = req.body;
    const tickerCache = getTickerCache();
    const botState = getBotState();
    const ticker = tickerCache[symbol];
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

    const review = await reviewSignalWithAI(ticker, potentialSignal, model, botState.aiAnalysisEnabled, botState.aiModels, personaId);
    res.json(review);
  });

  // Trigger Deep Strategic Market Audit
  router.post('/audit', async (req: Request, res: Response) => {
    const { model } = req.body || {};
    const tickerCache = getTickerCache();
    const botState = getBotState();
    const tickers = Object.values(tickerCache);
    const signals = await getRecentSignals(10);
    const audit = await auditMarketWithAI(tickers, signals, botState.weights, botState.aiAnalysisEnabled, model, botState.aiModels);
    await saveAIAudit(audit);
    res.json(audit);
  });

  // Get Latest Strategic AI Audit
  router.get('/audit/latest', async (req: Request, res: Response) => {
    const botState = getBotState();
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
  router.post('/chat', async (req: Request, res: Response) => {
    const { message, symbol, model, personaId } = req.body || {};
    const tickerCache = getTickerCache();
    const botState = getBotState();
    const ticker = symbol ? tickerCache[symbol] : null;
    const { reply, modelUsed } = await chatWithAITrader(message || '', ticker, botState.aiAnalysisEnabled, model, botState.aiModels, personaId);
    res.json({ reply, modelUsed });
  });

  // Test AI Connection / Ping with Full Diagnostics
  router.post('/test-connection', async (req: Request, res: Response) => {
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
          diagnosticSteps.push(`[Informação de Rede] '${url}' é um endereço de IP privado/local.`);
          diagnosticSteps.push(`O backend do SuperBot está rodando na Nuvem (Cloud Run). Se seu Ollama estiver rodando no seu computador pessoal nessa rede Wi-Fi local, o servidor na nuvem não conseguirá alcançá-lo sem um túnel público HTTPS.`);
        }

        let serverResponded = false;
        let generationSuccess = false;
        let activeEndpoint = '';
        let availableModelsList: string[] = [];

        // 1. Test GET /api/tags (List installed models on Ollama)
        diagnosticSteps.push(`[Passo 1/3] Testando GET ${url}/api/tags (Lista de Modelos do Ollama)...`);
        try {
          const res1 = await fetch(`${url}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(6000)
          });
          const contentType = res1.headers.get('content-type') || '';
          if (res1.ok && contentType.includes('application/json')) {
            const data1 = (await res1.json().catch(() => null)) as { models?: Array<{ name?: string; model?: string }> } | null;
            if (data1) {
              serverResponded = true;
              activeEndpoint = `${url}/api/tags`;
              if (Array.isArray(data1.models)) {
                availableModelsList = data1.models.map((m) => m.name || m.model || '');
                diagnosticSteps.push(`[Sucesso /api/tags] Server respondendo. Modelos instalados no Ollama: ${availableModelsList.length > 0 ? availableModelsList.join(', ') : 'Nenhum modelo listado'}`);
              } else {
                diagnosticSteps.push(`[Sucesso /api/tags] Endpoint /api/tags respondeu HTTP 200 OK`);
              }
            }
          } else {
            diagnosticSteps.push(`[Passo 1/3] Endpoint /api/tags retornou HTTP ${res1.status} (${contentType})`);
          }
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          diagnosticSteps.push(`[Passo 1/3] GET /api/tags não respondeu (${errMsg})`);
        }

        // 2. Test GET /v1/models (OpenAI compatibility)
        if (!serverResponded) {
          diagnosticSteps.push(`[Passo 2/3] Testando GET ${url}/v1/models...`);
          try {
            const res2 = await fetch(`${url}/v1/models`, {
              method: 'GET',
              signal: AbortSignal.timeout(6000)
            });
            const contentType = res2.headers.get('content-type') || '';
            if (res2.ok && contentType.includes('application/json')) {
              const data2 = await res2.json().catch(() => null);
              if (data2) {
                serverResponded = true;
                activeEndpoint = `${url}/v1/models`;
                diagnosticSteps.push(`[Passo 2/3] Sucesso! Endpoint /v1/models respondeu HTTP ${res2.status} JSON`);
              }
            } else {
              diagnosticSteps.push(`[Passo 2/3] Endpoint /v1/models retornou HTTP ${res2.status}`);
            }
          } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : String(e);
            diagnosticSteps.push(`[Passo 2/3] GET /v1/models não respondeu (${errMsg})`);
          }
        }

        // 3. Test POST /api/generate
        diagnosticSteps.push(`[Passo 3/3] Testando inferência real com modelo '${modelName}' via POST ${url}/api/generate...`);
        try {
          const res3 = await fetch(`${url}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
              model: modelName,
              prompt: 'Ping test. Reply OK.',
              stream: false
            })
          });
          if (res3.ok) {
            const data3 = (await res3.json().catch(() => ({}))) as { response?: string; output?: string; text?: string };
            const outputStr = data3.response || data3.output || data3.text || '';
            if (outputStr && outputStr.trim()) {
              generationSuccess = true;
              serverResponded = true;
              activeEndpoint = `${url}/api/generate`;
              diagnosticSteps.push(`[Sucesso /api/generate] Modelo '${modelName}' respondeu: "${outputStr.trim().slice(0, 80)}"`);
            } else {
              diagnosticSteps.push(`[Aviso /api/generate] HTTP 200 recebido, mas texto de resposta veio vazio.`);
            }
          } else {
            const errText = await res3.text().catch(() => '');
            diagnosticSteps.push(`[Passo 3/3] POST /api/generate no modelo '${modelName}' retornou HTTP ${res3.status}: ${errText.slice(0, 120)}`);
          }
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          diagnosticSteps.push(`[Passo 3/3] Falha na geração com modelo '${modelName}': ${errMsg}`);
        }

        // 4. Try POST /api/chat if generate failed
        if (!generationSuccess) {
          diagnosticSteps.push(`[Passo 3.1/3] Tentando inferência via POST ${url}/api/chat...`);
          try {
            const res4 = await fetch(`${url}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(15000),
              body: JSON.stringify({
                model: modelName,
                messages: [{ role: 'user', content: 'Ping test' }],
                stream: false
              })
            });
            if (res4.ok) {
              const data4 = (await res4.json().catch(() => ({}))) as { message?: { content?: string }; response?: string };
              const outputStr = data4.message?.content || data4.response || '';
              if (outputStr && outputStr.trim()) {
                generationSuccess = true;
                serverResponded = true;
                activeEndpoint = `${url}/api/chat`;
                diagnosticSteps.push(`[Sucesso /api/chat] Modelo '${modelName}' respondeu: "${outputStr.trim().slice(0, 80)}"`);
              }
            }
          } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : String(e);
            diagnosticSteps.push(`[Passo 3.1/3] Falha em /api/chat: ${errMsg}`);
          }
        }

        const latency = Date.now() - startTime;

        if (generationSuccess) {
          const msg = `Serviço Ollama/Local em '${url}' ativo e gerando respostas com sucesso (${latency}ms). Modelo: ${modelName}`;
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
          diagnosticSteps.push(`\n[Instruções de Conexão Ollama -> Nuvem]:`);
          diagnosticSteps.push(`1. Seu servidor SuperBot roda na Nuvem (Cloud Run). De lá, o IP '${url}' é inacessível.`);
          diagnosticSteps.push(`2. No PC onde o Ollama está rodando, instale o Ngrok (https://ngrok.com).`);
          diagnosticSteps.push(`3. Execute no terminal do PC: ngrok http 11434`);
          diagnosticSteps.push(`4. Copie a URL pública gerada (ex: https://xxxx.ngrok-free.app) e cole no campo 'URL da API'.`);

          const msg = `Ollama em IP local '${url}' é inacessível a partir do servidor em Nuvem. Execute 'ngrok http 11434' no seu PC e use a URL HTTPS gerada.`;
          
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

        const msg = serverResponded
          ? `Servidor em '${url}' respondeu, mas o modelo '${modelName}' não gerou respostas. Verifique se o modelo está baixado ('ollama pull ${modelName}').`
          : `Servidor Ollama/Local em '${url}' não respondeu. Verifique se o serviço está rodando e a URL está correta.`;

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
    } catch (err: unknown) {
      const latency = Date.now() - startTime;
      const errMsg = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? err.stack : undefined;
      diagnosticSteps.push(`Exceção não tratada: ${errMsg}`);

      addAILog({
        level: 'ERROR',
        type: 'TEST_CONNECTION',
        provider: provider || 'unknown',
        modelId: modelId || 'unknown',
        message: `Exceção: ${errMsg}`,
        durationMs: latency,
        details: { diagnosticSteps, errorStack: errStack }
      });

      return res.status(500).json({
        success: false,
        latencyMs: latency,
        message: `Erro na conexão: ${errMsg}`,
        diagnosticSteps
      });
    }
  });

  return router;
}
