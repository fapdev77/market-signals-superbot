import { AIModelConfig } from '../types';

export const defaultModels: AIModelConfig[] = [
  {
    id: 'm1',
    name: 'Gemini Flash (Principal)',
    provider: 'gemini',
    modelId: 'gemini-1.5-flash-latest',
    isActive: true,
    isFallback: false,
    priority: 1,
    rateLimit: { maxReqPerMinute: 60, maxReqPerDay: 10000 },
    parameters: { temperature: 0.2, maxTokens: 8192, topP: 0.95 }
  },
  {
    id: 'm2',
    name: 'Gemini Pro (Contingência)',
    provider: 'gemini',
    modelId: 'gemini-1.5-pro-latest',
    isActive: true,
    isFallback: true,
    priority: 2,
    rateLimit: { maxReqPerMinute: 15, maxReqPerDay: 1000 },
    parameters: { temperature: 0.1, maxTokens: 8192, topP: 0.95 }
  },
  {
    id: 'm3',
    name: 'Llama 3 70b (Local / LM Studio)',
    provider: 'local',
    modelId: 'llama-3-70b-instruct',
    apiUrl: 'http://localhost:1234/v1',
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
    isActive: true,
    isFallback: false,
    priority: 4,
    rateLimit: { maxReqPerMinute: 100, maxReqPerDay: 5000 },
    parameters: { temperature: 0.2, maxTokens: 4096 }
  }
];
