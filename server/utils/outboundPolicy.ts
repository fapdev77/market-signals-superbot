import { URL } from 'url';

const DEFAULT_ALLOWED_HOSTS = new Set([
  'generativelanguage.googleapis.com',
  'openrouter.ai',
  'api.anthropic.com',
  'api.openai.com'
]);

const FORBIDDEN_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./, // Cloud Metadata IP (AWS, GCP, Azure)
  /^0\./,
  /^::1$/,
  /^localhost$/i
];

export interface OutboundValidationResult {
  isValid: boolean;
  error?: string;
  normalizedUrl?: string;
}

/**
 * Validates whether an outbound AI connection URL is secure against SSRF attacks.
 */
export function validateOutboundAIUrl(
  rawUrl: string,
  provider: string = 'gemini'
): OutboundValidationResult {
  if (!rawUrl || rawUrl.trim().length === 0) {
    return { isValid: false, error: 'URL de destino não pode ser vazia.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (err) {
    return { isValid: false, error: 'Formato de URL inválido.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  const protocol = parsed.protocol.toLowerCase();

  // Handle Local Ollama provider
  if (provider === 'local') {
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    if (isLocalHost) {
      if (protocol !== 'http:' && protocol !== 'https:') {
        return { isValid: false, error: 'Provedor local deve utilizar protocolo HTTP ou HTTPS.' };
      }
      return { isValid: true, normalizedUrl: parsed.toString() };
    }
  }

  // All external providers must use HTTPS
  if (protocol !== 'https:') {
    return { isValid: false, error: 'Chamadas para provedores externos de IA devem utilizar HTTPS obrigatório.' };
  }

  // Check custom allowed hosts from environment
  const customAllowed = process.env.ALLOWED_AI_HOSTS
    ? process.env.ALLOWED_AI_HOSTS.split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
    : [];

  const isOfficialHost = DEFAULT_ALLOWED_HOSTS.has(hostname);
  const isCustomHost = customAllowed.includes(hostname);

  if (!isOfficialHost && !isCustomHost) {
    return {
      isValid: false,
      error: `Host '${hostname}' não está na lista de hosts autorizados para inteligência artificial.`
    };
  }

  // Check forbidden IP patterns (prevent SSRF against metadata services or internal networks)
  for (const pattern of FORBIDDEN_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { isValid: false, error: `Conexão rejeitada: o host '${hostname}' é um endereço de rede privada/restrita.` };
    }
  }

  return { isValid: true, normalizedUrl: parsed.toString() };
}
