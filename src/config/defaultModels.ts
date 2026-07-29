import { AIModelConfig } from '../types';

export const defaultModels: AIModelConfig[] = [
  {
    id: 'm1',
    name: 'Gemini 2.5 Flash (Principal)',
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
    isActive: true,
    isFallback: false,
    priority: 1,
    rateLimit: { maxReqPerMinute: 60, maxReqPerDay: 10000 },
    parameters: { temperature: 0.2, maxTokens: 8192, topP: 0.95 }
  },
  {
    id: 'm2',
    name: 'Gemini 2.5 Pro (Contingência)',
    provider: 'gemini',
    modelId: 'gemini-2.5-pro',
    isActive: true,
    isFallback: true,
    priority: 2,
    rateLimit: { maxReqPerMinute: 15, maxReqPerDay: 1000 },
    parameters: { temperature: 0.1, maxTokens: 8192, topP: 0.95 }
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
