import { AIModelConfig } from '../../src/types.js';

export interface RedactedAIModelConfig extends Omit<AIModelConfig, 'apiKey'> {
  apiKey?: string;
  hasApiKey: boolean;
  apiKeyMasked?: string;
}

/**
 * Masks a raw secret string, showing only the last 4 characters if available.
 */
export function maskSecret(secret?: string): string {
  if (!secret || secret.trim().length === 0) return '';
  const trimmed = secret.trim();
  if (trimmed.length <= 4) return '••••';
  return `••••••••${trimmed.slice(-4)}`;
}

/**
 * Redacts an AIModelConfig for safe client consumption.
 */
export function redactAIModelConfig(model: AIModelConfig): RedactedAIModelConfig {
  const hasKey = Boolean(model.apiKey && model.apiKey.trim().length > 0);
  const masked = hasKey ? maskSecret(model.apiKey) : undefined;
  
  const { apiKey, ...rest } = model;
  return {
    ...rest,
    hasApiKey: hasKey,
    apiKeyMasked: masked
  };
}

/**
 * Redacts an array of AIModelConfigs.
 */
export function redactAIModelConfigs(models: AIModelConfig[]): RedactedAIModelConfig[] {
  return models.map(redactAIModelConfig);
}

/**
 * Merges incoming model configurations with existing DB models to preserve existing
 * secrets when the client sends back a masked key or leaves the key field untouched.
 */
export function mergePreservedSecrets(
  incomingModels: (AIModelConfig | RedactedAIModelConfig)[],
  existingModels: AIModelConfig[]
): AIModelConfig[] {
  const existingMap = new Map<string, AIModelConfig>();
  for (const m of existingModels) {
    existingMap.set(m.id, m);
  }

  return incomingModels.map((incoming) => {
    const existing = existingMap.get(incoming.id);
    let resolvedApiKey = incoming.apiKey;

    // If incoming apiKey is masked or omitted but hasApiKey was true and existing has key
    if (
      (!resolvedApiKey || resolvedApiKey.startsWith('••••') || resolvedApiKey.includes('••••••••')) &&
      existing?.apiKey
    ) {
      resolvedApiKey = existing.apiKey;
    }

    const { hasApiKey, apiKeyMasked, ...cleanModel } = incoming as any;
    return {
      ...cleanModel,
      apiKey: resolvedApiKey && resolvedApiKey.trim() ? resolvedApiKey.trim() : undefined
    };
  });
}
