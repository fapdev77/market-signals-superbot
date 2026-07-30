import { TickerData, TradeSignal, AIReviewResponse, AIAuditReport, IndicatorWeights, AIModelConfig } from '../src/types.js';
import { GoogleGenAI, Type } from '@google/genai';
import { addAILog } from './aiLogger.js';

const getAiClient = (apiKeyOverride?: string) => {
  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

function normalizeGeminiModelName(modelName?: string): string {
  if (!modelName || modelName === 'none') return 'gemini-2.5-flash';
  const name = modelName.trim();
  if (name === 'gemini-flash-latest' || name === 'gemini-1.5-flash-latest' || name === 'gemini-flash') return 'gemini-2.5-flash';
  if (name === 'gemini-pro-latest' || name === 'gemini-1.5-pro-latest' || name === 'gemini-pro') return 'gemini-2.5-pro';
  if (name.startsWith('gemini')) return name;
  return 'gemini-2.5-flash';
}

export function resolveTargetModel(
  requestedModelIdentifier?: string,
  availableModels: AIModelConfig[] = []
): AIModelConfig {
  if (requestedModelIdentifier) {
    const matched = availableModels.find(
      m => m.modelId === requestedModelIdentifier || m.id === requestedModelIdentifier || m.name === requestedModelIdentifier
    );
    if (matched) return matched;
  }

  // Find active model sorted by priority
  const activeModel = availableModels
    .filter(m => m.isActive)
    .sort((a, b) => a.priority - b.priority)[0];

  if (activeModel) return activeModel;

  // Default fallback config
  return {
    id: 'default-gemini',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    modelId: requestedModelIdentifier || 'gemini-2.5-flash',
    isActive: true,
    isFallback: false,
    priority: 1,
    rateLimit: { maxReqPerMinute: 60, maxReqPerDay: 10000 },
    parameters: { temperature: 0.2, maxTokens: 8192 }
  };
}

export interface GenerateOptions {
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: string;
  jsonSchema?: any;
  logType?: 'TEST_CONNECTION' | 'SIGNAL_REVIEW' | 'MARKET_AUDIT' | 'CHAT_AGENT' | 'MODEL_CONFIG';
}

export async function generateContentWithModel(
  modelConfig: AIModelConfig,
  options: GenerateOptions
): Promise<{ text: string; modelUsed: string }> {
  const provider = modelConfig.provider || 'gemini';
  const startTime = Date.now();
  const logType = options.logType || (options.responseMimeType === 'application/json' ? 'SIGNAL_REVIEW' : 'CHAT_AGENT');

  if (provider === 'gemini') {
    const ai = getAiClient(modelConfig.apiKey);
    if (!ai) {
      const errMsg = "Chave GEMINI_API_KEY não encontrada no servidor nem nas configurações do modelo.";
      addAILog({
        level: 'ERROR',
        type: logType,
        provider: 'gemini',
        modelId: modelConfig.modelId,
        message: errMsg,
        durationMs: Date.now() - startTime
      });
      throw new Error(errMsg);
    }
    const targetModel = normalizeGeminiModelName(modelConfig.modelId);
    
    const configObj: any = {
      systemInstruction: options.systemInstruction || modelConfig.parameters.systemInstruction,
      temperature: modelConfig.parameters.temperature ?? 0.2,
      topP: modelConfig.parameters.topP ?? 0.95
    };

    if (options.responseMimeType) {
      configObj.responseMimeType = options.responseMimeType;
    }
    if (options.jsonSchema) {
      configObj.responseSchema = options.jsonSchema;
    }

    try {
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: options.prompt,
        config: configObj
      });

      const durationMs = Date.now() - startTime;
      const textOutput = response.text?.trim() || '';

      const sysInstruction = options.systemInstruction || modelConfig.parameters.systemInstruction;
      const fullPromptText = sysInstruction 
        ? `[SYSTEM INSTRUCTION]\n${sysInstruction}\n\n[USER PROMPT]\n${options.prompt}` 
        : options.prompt;

      addAILog({
        level: 'SUCCESS',
        type: logType,
        provider: 'gemini',
        modelId: targetModel,
        message: `Conteúdo gerado via Gemini (${targetModel}) em ${durationMs}ms`,
        durationMs,
        details: {
          fullPrompt: fullPromptText,
          fullResponse: textOutput,
          promptSnippet: options.prompt.slice(0, 150) + '...',
          outputSnippet: textOutput.slice(0, 150) + '...'
        }
      });

      return {
        text: textOutput,
        modelUsed: `Gemini (${targetModel})`
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      addAILog({
        level: 'ERROR',
        type: logType,
        provider: 'gemini',
        modelId: targetModel,
        message: `Erro na execução Gemini (${targetModel}): ${err.message}`,
        durationMs,
        details: { errorStack: err.stack, promptSnippet: options.prompt.slice(0, 150) }
      });
      throw err;
    }
  }

  if (provider === 'local') {
    const baseUrl = (modelConfig.apiUrl || 'http://localhost:11434').replace(/\/+$/, '');
    const modelId = modelConfig.modelId || 'llama3.2';
    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
    const isPrivateIp = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(baseUrl.replace(/^https?:\/\//, ''));

    const sysPrompt = options.systemInstruction || modelConfig.parameters.systemInstruction;
    let fullPrompt = options.prompt;
    if (options.responseMimeType === 'application/json' && !fullPrompt.includes('JSON')) {
      fullPrompt += '\nResponda estritamente em formato JSON válido.';
    }

    const diagnosticSteps: string[] = [];
    diagnosticSteps.push(`Servidor Ollama/Local: ${baseUrl}`);
    diagnosticSteps.push(`Modelo Solicitado: ${modelId}`);

    // 1. Native Ollama /api/generate endpoint (Matches Python client.generate)
    try {
      const endpoint = `${baseUrl}/api/generate`;
      diagnosticSteps.push(`[Tentativa 1/3] POST ${endpoint} (Ollama Nativo /api/generate)...`);
      
      const bodyObj: any = {
        model: modelId,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: modelConfig.parameters.temperature ?? 0.2
        }
      };
      if (sysPrompt) bodyObj.system = sysPrompt;
      if (options.responseMimeType === 'application/json') bodyObj.format = 'json';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj)
      });

      if (res.ok) {
        const data = await res.json();
        const output = data.response || data.output || data.text || '';
        if (output && output.trim()) {
          const durationMs = Date.now() - startTime;
          diagnosticSteps.push(`[Sucesso /api/generate] Resposta obtida (${output.length} chars) em ${durationMs}ms`);

          let tokensPerSec = 0;
          if (data.eval_count && data.eval_duration) {
            const evalSec = data.eval_duration / 1e9;
            tokensPerSec = evalSec > 0 ? Number((data.eval_count / evalSec).toFixed(2)) : 0;
            diagnosticSteps.push(`Métricas Ollama: ${tokensPerSec} tokens/s (${data.eval_count} tokens em ${evalSec.toFixed(2)}s)`);
          }

          const fullPromptText = sysPrompt ? `[SYSTEM]\n${sysPrompt}\n\n[USER]\n${fullPrompt}` : fullPrompt;

          addAILog({
            level: 'SUCCESS',
            type: logType,
            provider: 'local',
            modelId,
            message: `Resposta obtida via Ollama Nativo /api/generate (${modelId}) em ${durationMs}ms${tokensPerSec ? ` [${tokensPerSec} tok/s]` : ''}`,
            durationMs,
            details: {
              baseUrl,
              fullPrompt: fullPromptText,
              fullResponse: output,
              promptSnippet: fullPrompt.slice(0, 200),
              outputSnippet: output.slice(0, 200),
              diagnosticSteps,
              evalCount: data.eval_count,
              evalDurationSec: data.eval_duration ? data.eval_duration / 1e9 : undefined,
              tokensPerSecond: tokensPerSec
            }
          });

          return { text: output.trim(), modelUsed: `Ollama (${modelId})` };
        } else {
          diagnosticSteps.push(`[Aviso /api/generate] Endpoint retornou HTTP 200, mas o campo 'response' veio vazio.`);
        }
      } else {
        const errText = await res.text().catch(() => '');
        diagnosticSteps.push(`[Aviso /api/generate] Retornou HTTP ${res.status}: ${errText.slice(0, 150)}`);
      }
    } catch (e: any) {
      diagnosticSteps.push(`[Falha /api/generate]: ${e.message}`);
    }

    // 2. Native Ollama /api/chat endpoint
    try {
      const endpoint = `${baseUrl}/api/chat`;
      diagnosticSteps.push(`[Tentativa 2/3] POST ${endpoint} (Ollama Nativo /api/chat)...`);
      const messages = [];
      if (sysPrompt) messages.push({ role: 'system', content: sysPrompt });
      messages.push({ role: 'user', content: fullPrompt });

      const bodyObj: any = {
        model: modelId,
        messages,
        stream: false,
        options: {
          temperature: modelConfig.parameters.temperature ?? 0.2
        }
      };
      if (options.responseMimeType === 'application/json') bodyObj.format = 'json';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj)
      });

      if (res.ok) {
        const data = await res.json();
        const output = data.message?.content || data.response || '';
        if (output && output.trim()) {
          const durationMs = Date.now() - startTime;
          diagnosticSteps.push(`[Sucesso /api/chat] Resposta obtida (${output.length} chars) em ${durationMs}ms`);

          addAILog({
            level: 'SUCCESS',
            type: logType,
            provider: 'local',
            modelId,
            message: `Resposta obtida via Ollama Nativo /api/chat (${modelId}) em ${durationMs}ms`,
            durationMs,
            details: {
              baseUrl,
              promptSnippet: fullPrompt.slice(0, 200),
              outputSnippet: output.slice(0, 200),
              diagnosticSteps
            }
          });

          return { text: output.trim(), modelUsed: `Ollama /api/chat (${modelId})` };
        } else {
          diagnosticSteps.push(`[Aviso /api/chat] Endpoint retornou HTTP 200, mas o conteúdo veio vazio.`);
        }
      } else {
        const errText = await res.text().catch(() => '');
        diagnosticSteps.push(`[Aviso /api/chat] Retornou HTTP ${res.status}: ${errText.slice(0, 150)}`);
      }
    } catch (e: any) {
      diagnosticSteps.push(`[Falha /api/chat]: ${e.message}`);
    }

    // 3. OpenAI-compatible endpoint
    try {
      const endpoint = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
      diagnosticSteps.push(`[Tentativa 3/3] POST ${endpoint} (OpenAI Compatible)...`);
      const messages = [];
      if (sysPrompt) messages.push({ role: 'system', content: sysPrompt });
      messages.push({ role: 'user', content: fullPrompt });

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages,
          temperature: modelConfig.parameters.temperature ?? 0.2,
          max_tokens: modelConfig.parameters.maxTokens || 4096,
          response_format: options.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        const output = data.choices?.[0]?.message?.content || '';
        if (output && output.trim()) {
          const durationMs = Date.now() - startTime;
          diagnosticSteps.push(`[Sucesso OpenAI-compatible] Resposta obtida (${output.length} chars) em ${durationMs}ms`);

          addAILog({
            level: 'SUCCESS',
            type: logType,
            provider: 'local',
            modelId,
            message: `Resposta obtida via Ollama OpenAI-compatible (${modelId}) em ${durationMs}ms`,
            durationMs,
            details: {
              baseUrl,
              promptSnippet: fullPrompt.slice(0, 200),
              outputSnippet: output.slice(0, 200),
              diagnosticSteps
            }
          });

          return { text: output.trim(), modelUsed: `Ollama /v1/chat (${modelId})` };
        } else {
          diagnosticSteps.push(`[Aviso OpenAI-compatible] Retornou HTTP 200, mas sem escolhas.`);
        }
      } else {
        const errText = await res.text().catch(() => '');
        diagnosticSteps.push(`[Aviso OpenAI-compatible] Retornou HTTP ${res.status}: ${errText.slice(0, 150)}`);
      }
    } catch (e: any) {
      diagnosticSteps.push(`[Falha OpenAI-compatible]: ${e.message}`);
    }

    // If all attempts failed:
    const durationMs = Date.now() - startTime;
    let mainErrorMsg = `Serviço Ollama em '${baseUrl}' com modelo '${modelId}' não respondeu.`;

    if (isLocalhost || isPrivateIp) {
      diagnosticSteps.push(`[DIAGNÓSTICO REDE] '${baseUrl}' é um IP da sua rede privada ou localhost.`);
      diagnosticSteps.push(`O servidor backend do SuperBot roda na Nuvem (Cloud Run). Da nuvem, não é possível alcançar o IP privado da sua rede Wi-Fi local (${baseUrl}).`);
      diagnosticSteps.push(`[COMO CONECTAR O OLLAMA LOCAL]: Execute 'ngrok http 11434' no seu PC e use a URL pública HTTPS gerada (ex: https://xxxx.ngrok-free.app).`);
      mainErrorMsg = `Ollama em '${baseUrl}' inacessível a partir da Nuvem. Use um túnel Ngrok ('ngrok http 11434') e informe a URL HTTPS gerada.`;
    }

    addAILog({
      level: 'ERROR',
      type: logType,
      provider: 'local',
      modelId,
      message: mainErrorMsg,
      durationMs,
      details: {
        baseUrl,
        promptSnippet: fullPrompt.slice(0, 200),
        diagnosticSteps
      }
    });

    throw new Error(mainErrorMsg);
  }

  if (provider === 'openai' || provider === 'openrouter') {
    const defaultUrl = provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1';
    const baseUrl = (modelConfig.apiUrl || defaultUrl).replace(/\/+$/, '');
    const apiKey = modelConfig.apiKey || (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY);

    if (!apiKey) {
      const errMsg = `Chave API para ${provider.toUpperCase()} não foi informada.`;
      addAILog({
        level: 'ERROR',
        type: logType,
        provider,
        modelId: modelConfig.modelId,
        message: errMsg,
        durationMs: Date.now() - startTime
      });
      throw new Error(errMsg);
    }

    const messages = [];
    const sysPrompt = options.systemInstruction || modelConfig.parameters.systemInstruction;
    if (sysPrompt) {
      messages.push({ role: 'system', content: sysPrompt });
    }
    messages.push({ role: 'user', content: options.prompt });

    const endpoint = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://superbot.ai';
      headers['X-Title'] = 'Market Signals SuperBot';
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelConfig.modelId,
          messages,
          temperature: modelConfig.parameters.temperature ?? 0.2,
          max_tokens: modelConfig.parameters.maxTokens || 4096,
          response_format: options.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
        })
      });

      const durationMs = Date.now() - startTime;

      if (!res.ok) {
        const errText = await res.text();
        const errorMsg = `Erro na API ${provider.toUpperCase()} (${res.status}): ${errText.slice(0, 150)}`;
        addAILog({
          level: 'ERROR',
          type: logType,
          provider,
          modelId: modelConfig.modelId,
          message: errorMsg,
          durationMs,
          details: { endpoint, httpStatus: res.status, errText }
        });
        throw new Error(errorMsg);
      }

      const data = await res.json();
      const output = data.choices?.[0]?.message?.content || '';

      const fullPromptText = sysPrompt ? `[SYSTEM]\n${sysPrompt}\n\n[USER]\n${options.prompt}` : options.prompt;

      addAILog({
        level: 'SUCCESS',
        type: logType,
        provider,
        modelId: modelConfig.modelId,
        message: `Sucesso ao comunicar com ${provider.toUpperCase()} (${modelConfig.modelId}) em ${durationMs}ms`,
        durationMs,
        details: { 
          fullPrompt: fullPromptText,
          fullResponse: output,
          promptSnippet: options.prompt.slice(0, 150),
          outputSnippet: output.slice(0, 150) 
        }
      });

      return { text: output, modelUsed: `${provider.toUpperCase()} (${modelConfig.modelId})` };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      addAILog({
        level: 'ERROR',
        type: logType,
        provider,
        modelId: modelConfig.modelId,
        message: `Exceção em ${provider.toUpperCase()}: ${err.message}`,
        durationMs
      });
      throw err;
    }
  }

  if (provider === 'anthropic') {
    const baseUrl = (modelConfig.apiUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    const apiKey = modelConfig.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      const errMsg = "Chave API da Anthropic não informada.";
      addAILog({
        level: 'ERROR',
        type: logType,
        provider: 'anthropic',
        modelId: modelConfig.modelId,
        message: errMsg,
        durationMs: Date.now() - startTime
      });
      throw new Error(errMsg);
    }

    const endpoint = `${baseUrl}/messages`;
    const sysPrompt = options.systemInstruction || modelConfig.parameters.systemInstruction;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelConfig.modelId || 'claude-3-5-sonnet-20241022',
          max_tokens: modelConfig.parameters.maxTokens || 4096,
          system: sysPrompt,
          messages: [{ role: 'user', content: options.prompt }]
        })
      });

      const durationMs = Date.now() - startTime;

      if (!res.ok) {
        const errText = await res.text();
        const errorMsg = `Erro na API Anthropic (${res.status}): ${errText.slice(0, 150)}`;
        addAILog({
          level: 'ERROR',
          type: logType,
          provider: 'anthropic',
          modelId: modelConfig.modelId,
          message: errorMsg,
          durationMs
        });
        throw new Error(errorMsg);
      }

      const data = await res.json();
      const output = data.content?.[0]?.text || '';

      addAILog({
        level: 'SUCCESS',
        type: logType,
        provider: 'anthropic',
        modelId: modelConfig.modelId,
        message: `Sucesso Anthropic (${modelConfig.modelId}) em ${durationMs}ms`,
        durationMs
      });

      return { text: output, modelUsed: `Anthropic (${modelConfig.modelId})` };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      addAILog({
        level: 'ERROR',
        type: logType,
        provider: 'anthropic',
        modelId: modelConfig.modelId,
        message: `Exceção Anthropic: ${err.message}`,
        durationMs
      });
      throw err;
    }
  }

  throw new Error(`Provedor de IA não suportado: ${provider}`);
}

/**
 * AI Real-time Signal Review ("Revisão em tempo real")
 */
export async function reviewSignalWithAI(
  ticker: TickerData,
  signal: TradeSignal,
  requestedModel?: string,
  aiAnalysisEnabled: boolean = true,
  availableModels: AIModelConfig[] = []
): Promise<AIReviewResponse> {
  if (!aiAnalysisEnabled) {
    return getFallbackSignalReview(ticker, signal, 'IA Desativada');
  }

  const targetModelConfig = resolveTargetModel(requestedModel, availableModels);

  const prompt = `Act as an elite quantitative crypto & TradFi hedge fund trader.
Review the following live signal generated by Market Signals SuperBot:
Asset: ${ticker.symbol} (${ticker.name})
Current Price: ${ticker.price}
Signal Direction: ${signal.direction} (${signal.signalType})
Confluence Score: ${signal.confluenceScore}%
Confluence Factors: ${ticker.confluenceFactors.join(', ')}

Live Market Metrics:
- 24h Change: ${ticker.priceChangePercent24h}%
- Open Interest: ${ticker.openInterest} (${ticker.openInterestChange1h > 0 ? '+' : ''}${ticker.openInterestChange1h.toFixed(2)}% in 1h)
- Funding Rate: ${(ticker.fundingRate * 100).toFixed(4)}% (${ticker.fundingRateAnnualized.toFixed(1)}% APR)
- CVD Net Delta: $${ticker.cvd.toLocaleString()} (${ticker.cvdDirection})
- Taker Buy Ratio: ${(ticker.takerBuyRatio * 100).toFixed(1)}%
- Golden Pocket 0.618-0.68 Fib: [${ticker.fibonacci.fib68.toFixed(2)} - ${ticker.fibonacci.fib618.toFixed(2)}]
- Volume Profile Range: VAL ${ticker.rangeProfile.val.toFixed(2)} | POC ${ticker.rangeProfile.poc.toFixed(2)} | VAH ${ticker.rangeProfile.vah.toFixed(2)}

Instructions:
1. Validate whether this setup is high probability or if there is hidden liquidity risk.
2. CRITICAL TRADING EXECUTION RULES FOR NUMERICAL VALUES:
   - For SHORT signals: Stop Loss MUST be HIGHER than the entry price (stopLoss > entryMax). Take Profits MUST be LOWER than the entry price (takeProfit2 < takeProfit1 < entryMin).
   - For LONG signals: Stop Loss MUST be LOWER than the entry price (stopLoss < entryMin). Take Profits MUST be HIGHER than the entry price (takeProfit2 > takeProfit1 > entryMax).
3. Provide your response as JSON.`;

  try {
    const result = await generateContentWithModel(targetModelConfig, {
      prompt,
      responseMimeType: "application/json",
      logType: 'SIGNAL_REVIEW',
      jsonSchema: {
        type: Type.OBJECT,
        properties: {
          decision: { type: Type.STRING, description: "CONFIRM, ADJUST, or REJECT" },
          reasoning: { type: Type.STRING, description: "Concise professional trader rationale in Portuguese" },
          recommendedDirection: { type: Type.STRING, description: "LONG, SHORT, or NEUTRAL" },
          entryMin: { type: Type.NUMBER },
          entryMax: { type: Type.NUMBER },
          stopLoss: { type: Type.NUMBER },
          takeProfit1: { type: Type.NUMBER },
          takeProfit2: { type: Type.NUMBER },
          confidenceScore: { type: Type.NUMBER }
        },
        required: ["decision", "reasoning", "recommendedDirection", "entryMin", "entryMax", "stopLoss", "takeProfit1", "takeProfit2", "confidenceScore"]
      }
    });

    const json = JSON.parse(result.text || '{}');

    let recommendedDirection = (json.recommendedDirection || signal.direction).toUpperCase();
    if (!['LONG', 'SHORT', 'NEUTRAL'].includes(recommendedDirection)) {
      recommendedDirection = signal.direction;
    }

    let entryMin = json.entryMin || signal.entryZone[0];
    let entryMax = json.entryMax || signal.entryZone[1];
    if (entryMin > entryMax) [entryMin, entryMax] = [entryMax, entryMin];

    let stopLoss = json.stopLoss || signal.stopLoss;
    let takeProfit1 = json.takeProfit1 || signal.target1;
    let takeProfit2 = json.takeProfit2 || signal.target2;

    if (recommendedDirection === 'SHORT') {
      const midEntry = (entryMin + entryMax) / 2;
      const risk = Math.abs(stopLoss - midEntry) || (midEntry * 0.015);
      if (stopLoss <= entryMax) stopLoss = parseFloat((entryMax + risk).toFixed(4));
      if (takeProfit1 >= entryMin) takeProfit1 = parseFloat((entryMin - risk * 1.5).toFixed(4));
      if (takeProfit2 >= takeProfit1) takeProfit2 = parseFloat((takeProfit1 - risk * 1.5).toFixed(4));
    } else if (recommendedDirection === 'LONG') {
      const midEntry = (entryMin + entryMax) / 2;
      const risk = Math.abs(midEntry - stopLoss) || (midEntry * 0.015);
      if (stopLoss >= entryMin) stopLoss = parseFloat((entryMin - risk).toFixed(4));
      if (takeProfit1 <= entryMax) takeProfit1 = parseFloat((entryMax + risk * 1.5).toFixed(4));
      if (takeProfit2 >= takeProfit1) takeProfit2 = parseFloat((takeProfit1 + risk * 1.5).toFixed(4));
    }

    return {
      symbol: ticker.symbol,
      decision: json.decision || 'CONFIRM',
      reasoning: json.reasoning || 'Sinal validado pelo fluxo de ordens e acúmulo de Open Interest.',
      recommendedDirection,
      entryZone: [parseFloat(entryMin.toFixed(4)), parseFloat(entryMax.toFixed(4))],
      stopLoss,
      takeProfit1,
      takeProfit2,
      confidenceScore: json.confidenceScore || signal.confluenceScore,
      modelUsed: result.modelUsed,
      timestamp: Date.now()
    };
  } catch (err: any) {
    console.error(`AI signal review error with model ${targetModelConfig.name}:`, err);
    return getFallbackSignalReview(ticker, signal, `${targetModelConfig.name} (${err.message.slice(0, 80)})`);
  }
}

function getFallbackSignalReview(ticker: TickerData, signal: TradeSignal, reason: string): AIReviewResponse {
  return {
    symbol: ticker.symbol,
    decision: 'CONFIRM',
    reasoning: `Sinal verificado via motor quantitativo (${reason}). CVD (${ticker.cvdDirection}).`,
    recommendedDirection: signal.direction,
    entryZone: signal.entryZone,
    stopLoss: signal.stopLoss,
    takeProfit1: signal.target1,
    takeProfit2: signal.target2,
    confidenceScore: Math.round(signal.confluenceScore * 0.95),
    modelUsed: `${reason}`,
    timestamp: Date.now()
  };
}

/**
 * Deep Strategic Market Audit ("Auditoria estratégica")
 */
export async function auditMarketWithAI(
  tickers: TickerData[],
  signals: TradeSignal[],
  currentWeights: IndicatorWeights,
  aiAnalysisEnabled: boolean = true,
  requestedModel?: string,
  availableModels: AIModelConfig[] = []
): Promise<AIAuditReport> {
  if (!aiAnalysisEnabled) {
    return getFallbackMarketAudit(signals, currentWeights, 'IA Desativada');
  }

  const targetModelConfig = resolveTargetModel(requestedModel, availableModels);

  const summaryData = tickers.map(t => ({
    symbol: t.symbol,
    price: t.price,
    change24h: `${t.priceChangePercent24h}%`,
    oiChange1h: `${t.openInterestChange1h.toFixed(2)}%`,
    fundingRate: `${(t.fundingRate * 100).toFixed(4)}%`,
    cvdDirection: t.cvdDirection,
    confluence: `${t.confluenceScore}% (${t.signalType})`
  }));

  const prompt = `Perform a macro & quantitative market audit for Market Signals SuperBot.

Monitored Tickers State:
${JSON.stringify(summaryData, null, 2)}

Active High Confluence Signals:
${JSON.stringify(signals.map(s => ({ symbol: s.symbol, dir: s.direction, score: s.confluenceScore, factors: s.confluenceFactors })), null, 2)}

Current Indicator Weights:
${JSON.stringify(currentWeights, null, 2)}

Instructions:
1. Deliver a structured strategic audit report in Portuguese.
2. Output your response as a valid JSON object.`;

  try {
    const result = await generateContentWithModel(targetModelConfig, {
      prompt,
      systemInstruction: 'You are Market Signals SuperBot Lead AI Strategist. Provide concise, professional institutional market analysis.',
      responseMimeType: "application/json",
      logType: 'MARKET_AUDIT'
    });

    const json = JSON.parse(result.text || '{}');

    return {
      timestamp: Date.now(),
      marketOverview: json.marketOverview || 'Mercado em consolidação estratégica.',
      topOpportunities: json.topOpportunities || [],
      riskWarnings: json.riskWarnings || [],
      suggestedWeightAdjustments: json.suggestedWeights || currentWeights,
      modelUsed: result.modelUsed
    };
  } catch (err: any) {
    console.error(`AI Market Audit error with model ${targetModelConfig.name}:`, err);
    return getFallbackMarketAudit(signals, currentWeights, `${targetModelConfig.name} (${err.message.slice(0, 80)})`);
  }
}

function getFallbackMarketAudit(signals: TradeSignal[], currentWeights: IndicatorWeights, reason: string): AIAuditReport {
  return {
    timestamp: Date.now(),
    marketOverview: `Análise de mercado executada pelo motor estático (${reason}).`,
    topOpportunities: signals.slice(0, 3).map(s => `${s.symbol} (${s.direction})`),
    riskWarnings: ['Monitore o Open Interest e CVD antes das execuções.'],
    suggestedWeightAdjustments: currentWeights,
    modelUsed: `Algorithmic Audit (${reason})`
  };
}

export async function chatWithAITrader(
  userQuery: string,
  ticker?: TickerData | null,
  aiAnalysisEnabled: boolean = true,
  requestedModel?: string,
  availableModels: AIModelConfig[] = []
): Promise<{ reply: string; modelUsed: string }> {
  if (!aiAnalysisEnabled) {
    return {
      reply: 'SuperBot AI (Modo de Contingência): A análise de IA está desativada no momento nas configurações.',
      modelUsed: 'Desativado'
    };
  }

  const targetModelConfig = resolveTargetModel(requestedModel, availableModels);

  const context = ticker 
    ? `Current Ticker Context: ${ticker.symbol} Price: ${ticker.price}, 24h: ${ticker.priceChangePercent24h}%, OI: ${ticker.openInterest}, CVD: ${ticker.cvdDirection}, Fibo Golden Pocket: [${ticker.fibonacci.fib68} - ${ticker.fibonacci.fib618}]` 
    : 'General Market Context';

  const prompt = `${context}\nUser Question: ${userQuery}`;

  try {
    const result = await generateContentWithModel(targetModelConfig, {
      prompt,
      systemInstruction: 'Você é o SuperBot AI Trader, um mentor e especialista sênior em negociação de criptomoedas e mercado financeiro. Responda de forma direta, técnica e prática em português.',
      logType: 'CHAT_AGENT'
    });

    return {
      reply: result.text?.trim() || 'Análise indisponível no momento.',
      modelUsed: result.modelUsed
    };
  } catch (err: any) {
    console.error(`AI chat error with model ${targetModelConfig.name}:`, err);
    return {
      reply: `SuperBot AI (${targetModelConfig.name}):\n${err.message}\n\n${ticker ? `Para ${ticker.symbol}, observe o perfil de volume (POC: ${ticker.rangeProfile.poc}) e a convergência com o Golden Pocket.` : 'Mantenha a cautela e observe a tendência macro.'}`,
      modelUsed: `${targetModelConfig.name} (Erro)`
    };
  }
}
