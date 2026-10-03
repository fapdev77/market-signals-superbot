import { URL } from 'url';
import { getErrorMessage } from './errors.js';
import dns from 'dns';

const DEFAULT_ALLOWED_HOSTS = new Set([
  'generativelanguage.googleapis.com',
  'openrouter.ai',
  'api.anthropic.com',
  'api.openai.com'
]);

// Comprehensive RFC 1918, RFC 3927, RFC 4193, RFC 4291, loopback and cloud metadata patterns
const FORBIDDEN_IP_PATTERNS = [
  /^127\./,                           // Loopback IPv4
  /^10\./,                            // Class A Private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,   // Class B Private
  /^192\.168\./,                      // Class C Private
  /^169\.254\./,                      // Link-Local / Cloud Metadata IP (AWS, GCP, Azure)
  /^0\./,                             // Current network (RFC 1122)
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // CGNAT (RFC 6598)
  /^198\.1[89]\./,                    // Benchmarking (RFC 2544)
  /^::1$/,                            // Loopback IPv6
  /^fc00:/i,                          // Unique Local IPv6 (RFC 4193)
  /^fd00:/i,
  /^fe80:/i,                          // Link-Local IPv6 (RFC 4291)
  /^::ffff:(127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.)/i, // IPv4-mapped IPv6
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

/**
 * Async DNS resolution check to prevent DNS rebinding attacks on outbound connections
 */
export async function validateOutboundAIUrlWithDns(
  rawUrl: string,
  provider: string = 'gemini'
): Promise<OutboundValidationResult> {
  const syncCheck = validateOutboundAIUrl(rawUrl, provider);
  if (!syncCheck.isValid) {
    return syncCheck;
  }

  if (provider === 'local') {
    return syncCheck;
  }

  try {
    const parsed = new URL(rawUrl.trim());
    const lookup = await dns.promises.lookup(parsed.hostname, { all: true });
    for (const record of lookup) {
      const ip = record.address;
      for (const pattern of FORBIDDEN_IP_PATTERNS) {
        if (pattern.test(ip)) {
          return {
            isValid: false,
            error: `Conexão rejeitada: o host resolveu para IP restrito/privado '${ip}' (proteção contra DNS Rebinding).`
          };
        }
      }
    }
  } catch (err) {
    return {
      isValid: false,
      error: `Falha na resolução de DNS para o host: ${getErrorMessage(err) || 'Host inacessível'}`
    };
  }

  return syncCheck;
}

