import { describe, it, expect } from 'vitest';
import { validateTokenConstantTime, getEffectiveAuthToken } from '../server/middleware/auth.js';
import { redactAIModelConfig, redactAIModelConfigs, mergePreservedSecrets, maskSecret } from '../server/utils/secretsRedaction.js';
import { validateOutboundAIUrl } from '../server/utils/outboundPolicy.js';
import { symbolParamSchema, resetConfirmationSchema, weightsUpdateSchema } from '../server/middleware/validation.js';
import { AIModelConfig } from '../src/types.js';

describe('Security Suite - Contract & Protection Tests', () => {

  describe('S1: Authentication & Constant-Time Token Validation', () => {
    it('should validate matching tokens in constant time', () => {
      const secret = 'superbot-secret-key-12345';
      expect(validateTokenConstantTime(secret, secret)).toBe(true);
    });

    it('should reject non-matching tokens or empty inputs', () => {
      const secret = 'superbot-secret-key-12345';
      expect(validateTokenConstantTime('wrong-token', secret)).toBe(false);
      expect(validateTokenConstantTime('', secret)).toBe(false);
      expect(validateTokenConstantTime(secret, '')).toBe(false);
      expect(validateTokenConstantTime('short', secret)).toBe(false);
    });

    it('should provide effective auth token', () => {
      const orig = process.env.API_AUTH_TOKEN;
      try {
        delete process.env.API_AUTH_TOKEN;
        const token = getEffectiveAuthToken();
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(5);
      } finally {
        if (orig !== undefined) {
          process.env.API_AUTH_TOKEN = orig;
        } else {
          delete process.env.API_AUTH_TOKEN;
        }
      }
    });
  });

  describe('S3: Secrets Redaction & Safe Configuration Merging', () => {
    const rawModel: AIModelConfig = {
      id: 'm1',
      name: 'Gemini 2.5 Flash',
      provider: 'gemini',
      modelId: 'gemini-2.5-flash',
      apiKey: 'AIzaSySecretRawKeyABC1234',
      isActive: true,
      isFallback: false,
      priority: 1,
      rateLimit: { maxReqPerMinute: 60, maxReqPerDay: 10000 },
      parameters: { temperature: 0.2, maxTokens: 8192 }
    };

    it('should mask sensitive API keys showing only the last 4 characters', () => {
      const masked = maskSecret(rawModel.apiKey);
      expect(masked).toBe('••••••••1234');
      expect(masked).not.toContain('AIzaSy');
    });

    it('should redact AIModelConfig for client responses without exposing raw apiKey', () => {
      const redacted = redactAIModelConfig(rawModel);
      expect(redacted.apiKey).toBeUndefined();
      expect(redacted.hasApiKey).toBe(true);
      expect(redacted.apiKeyMasked).toBe('••••••••1234');
    });

    it('should preserve existing secret when client sends back masked key or empty string with hasApiKey', () => {
      const incoming: AIModelConfig[] = [
        {
          id: 'm1',
          name: 'Gemini 2.5 Flash Modified',
          provider: 'gemini',
          modelId: 'gemini-2.5-flash',
          apiKey: '••••••••1234',
          isActive: true,
          isFallback: false,
          priority: 1,
          rateLimit: { maxReqPerMinute: 60, maxReqPerDay: 10000 },
          parameters: { temperature: 0.2, maxTokens: 8192 }
        }
      ];

      const merged = mergePreservedSecrets(incoming, [rawModel]);
      expect(merged[0].apiKey).toBe('AIzaSySecretRawKeyABC1234');
      expect(merged[0].name).toBe('Gemini 2.5 Flash Modified');
    });

    it('should overwrite secret when client provides a newly typed unmasked key', () => {
      const incoming: AIModelConfig[] = [
        {
          id: 'm1',
          name: 'Gemini 2.5 Flash',
          provider: 'gemini',
          modelId: 'gemini-2.5-flash',
          apiKey: 'NEW_KEY_ZYX9876',
          isActive: true,
          isFallback: false,
          priority: 1,
          rateLimit: { maxReqPerMinute: 60, maxReqPerDay: 10000 },
          parameters: { temperature: 0.2, maxTokens: 8192 }
        }
      ];

      const merged = mergePreservedSecrets(incoming, [rawModel]);
      expect(merged[0].apiKey).toBe('NEW_KEY_ZYX9876');
    });
  });

  describe('S4: Outbound Anti-SSRF Protection', () => {
    it('should allow official Google Generative Language endpoints', () => {
      const result = validateOutboundAIUrl('https://generativelanguage.googleapis.com/v1beta/models', 'gemini');
      expect(result.isValid).toBe(true);
    });

    it('should allow OpenRouter and Anthropic endpoints over HTTPS', () => {
      const orResult = validateOutboundAIUrl('https://openrouter.ai/api/v1', 'openrouter');
      expect(orResult.isValid).toBe(true);
      const antResult = validateOutboundAIUrl('https://api.anthropic.com/v1/messages', 'anthropic');
      expect(antResult.isValid).toBe(true);
    });

    it('should allow local Ollama connections only for provider local', () => {
      const localValid = validateOutboundAIUrl('http://localhost:11434', 'local');
      expect(localValid.isValid).toBe(true);
      const ipValid = validateOutboundAIUrl('http://127.0.0.1:11434', 'local');
      expect(ipValid.isValid).toBe(true);

      const localBlockedForGemini = validateOutboundAIUrl('http://localhost:11434', 'gemini');
      expect(localBlockedForGemini.isValid).toBe(false);
    });

    it('should block SSRF attempts targeting cloud metadata endpoints (169.254.169.254)', () => {
      const gcpMeta = validateOutboundAIUrl('http://169.254.169.254/computeMetadata/v1/', 'gemini');
      expect(gcpMeta.isValid).toBe(false);
      expect(gcpMeta.error).toBeDefined();
    });

    it('should block plain HTTP for remote providers', () => {
      const insecure = validateOutboundAIUrl('http://openrouter.ai/api/v1', 'openrouter');
      expect(insecure.isValid).toBe(false);
    });

    it('should block arbitrary unlisted external hosts', () => {
      const evil = validateOutboundAIUrl('https://evil-attacker-server.com/ai', 'gemini');
      expect(evil.isValid).toBe(false);
    });
  });

  describe('S5: Input Validation via Zod Schemas', () => {
    it('should validate correct uppercase ticker symbols', () => {
      expect(symbolParamSchema.safeParse({ symbol: 'BTCUSDT' }).success).toBe(true);
      expect(symbolParamSchema.safeParse({ symbol: 'SOL_USDT' }).success).toBe(true);
    });

    it('should reject invalid or malicious symbol strings', () => {
      expect(symbolParamSchema.safeParse({ symbol: 'btc/../usdt' }).success).toBe(false);
      expect(symbolParamSchema.safeParse({ symbol: '<script>' }).success).toBe(false);
      expect(symbolParamSchema.safeParse({ symbol: 'A' }).success).toBe(false);
    });

    it('should enforce strict confirm string on destructive reset', () => {
      expect(resetConfirmationSchema.safeParse({ confirm: 'RESET' }).success).toBe(true);
      expect(resetConfirmationSchema.safeParse({ confirm: 'YES' }).success).toBe(false);
      expect(resetConfirmationSchema.safeParse({}).success).toBe(false);
    });

    it('should validate indicator weights within bounds (0-100)', () => {
      expect(weightsUpdateSchema.safeParse({ volumeSurgeWeight: 25 }).success).toBe(true);
      expect(weightsUpdateSchema.safeParse({ volumeSurgeWeight: 150 }).success).toBe(false);
      expect(weightsUpdateSchema.safeParse({ volumeSurgeWeight: -5 }).success).toBe(false);
    });
  });

});
