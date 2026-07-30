export interface AILogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  type: 'TEST_CONNECTION' | 'SIGNAL_REVIEW' | 'MARKET_AUDIT' | 'CHAT_AGENT' | 'MODEL_CONFIG';
  provider: 'gemini' | 'local' | 'openai' | 'openrouter' | 'anthropic' | 'system';
  modelId: string;
  modelName?: string;
  message: string;
  durationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costEstimate?: number;
  details?: {
    fullPrompt?: string;
    fullResponse?: string;
    promptSnippet?: string;
    outputSnippet?: string;
    apiUrl?: string;
    apiKeyPresent?: boolean;
    errorStack?: string;
    diagnosticSteps?: string[];
    [key: string]: any;
  };
}

const aiLogsStore: AILogEntry[] = [];
const MAX_LOGS = 200;

export function addAILog(entry: Omit<AILogEntry, 'id' | 'timestamp'>): AILogEntry {
  const newLog: AILogEntry = {
    id: `ailog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry
  };

  aiLogsStore.unshift(newLog);
  if (aiLogsStore.length > MAX_LOGS) {
    aiLogsStore.splice(MAX_LOGS);
  }

  return newLog;
}

export function getAILogs(): AILogEntry[] {
  return aiLogsStore;
}

export function clearAILogs(): void {
  aiLogsStore.length = 0;
}

// Initial system boot log
addAILog({
  level: 'INFO',
  type: 'MODEL_CONFIG',
  provider: 'system',
  modelId: 'system-boot',
  message: 'Sistema de Logging e Diagnóstico do Motor de IA Inicializado',
  details: { diagnosticSteps: ['Serviço de auditoria de agentes de IA ativo no backend.'] }
});
