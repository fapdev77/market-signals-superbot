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

// RFC 1918 LAN ranges. These addresses are only reachable from the operator's
// own network, so they are allowed for the `local` provider ONLY when explicitly
// opted-in via env — a cloud deployment cannot route them anyway, and enabling
// them by default would widen the SSRF surface.
const PRIVATE_LAN_IP_PATTERNS = [
  /^10\./,                            // Class A Private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,   // Class B Private
  /^192\.168\./                       // Class C Private
];

function isPrivateLanHost(hostname: string): boolean {
  return PRIVATE_LAN_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * Whether private/LAN endpoints are allowed for the `local` AI provider.
 * Opt-in via `ALLOW_PRIVATE_AI_ENDPOINTS=true` (default: blocked).
 */
export function isPrivateAiEndpointAllowed(): boolean {
  const value = process.env.ALLOW_PRIVATE_AI_ENDPOINTS;
  return value === 'true' || value === '1';
}

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
    const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    if (isLoopback) {
      if (protocol !== 'http:' && protocol !== 'https:') {
        return { isValid: false, error: 'Provedor local deve utilizar protocolo HTTP ou HTTPS.' };
      }
      return { isValid: true, normalizedUrl: parsed.toString() };
    }

    // LAN privada (RFC 1918): permite apontar o provedor `local` para um
    // Ollama/LM Studio em outro host da mesma rede (ex.: http://192.168.10.5:11434).
    // Exige opt-in explícito para não ampliar a superfície de SSRF por padrão.
    if (isPrivateLanHost(hostname)) {
      if (!isPrivateAiEndpointAllowed()) {
        return {
          isValid: false,
          error: `O host '${hostname}' é um endereço de rede privada. Defina ALLOW_PRIVATE_AI_ENDPOINTS=true no ambiente para permitir modelos locais na sua rede.`
        };
      }
      if (protocol !== 'http:' && protocol !== 'https:') {
        return { isValid: false, error: 'Provedor local deve utilizar protocolo HTTP ou HTTPS.' };
      }
      return { isValid: true, normalizedUrl: parsed.toString() };
    }

    // Endpoint remoto para um servidor local (Ollama/LM Studio exposto por um
    // túnel público — ex.: Ngrok, Cloudflare Tunnel). Antes, qualquer coisa que
    // não fosse loopback caía na allowlist genérica e era rejeitada, então o
    // usuário não conseguia salvar o endpoint que ele mesmo informou. Agora é
    // aceito desde que seja HTTPS e não aponte para IP literal de rede
    // privada/loopback/metadata (a checagem de DNS rebinding roda em
    // validateOutboundAIUrlWithDns antes de conectar).
    if (protocol !== 'https:') {
      return {
        isValid: false,
        error: "Endpoints locais remotos (ex.: túnel Ngrok) devem utilizar HTTPS obrigatório. Use 'http://' apenas para localhost/127.0.0.1."
      };
    }
    for (const pattern of FORBIDDEN_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { isValid: false, error: `Conexão rejeitada: o host '${hostname}' é um endereço de rede privada/restrita.` };
      }
    }
    return { isValid: true, normalizedUrl: parsed.toString() };
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

  // Loopback local (Ollama no mesmo host) não precisa de resolução DNS. Um
  // endpoint local remoto (túnel HTTPS) usa um host público e, por isso, passa
  // pela mesma checagem anti-DNS-rebinding dos provedores externos.
  const syncHostname = new URL(rawUrl.trim()).hostname.toLowerCase();
  const isLoopbackLocal = syncHostname === 'localhost' || syncHostname === '127.0.0.1' || syncHostname === '::1';
  if (provider === 'local' && isLoopbackLocal) {
    return syncCheck;
  }

  // LAN privada autorizada por opt-in: o host é um IP literal (já validado
  // acima), então não há resolução DNS a fazer nem risco de rebinding.
  if (provider === 'local' && isPrivateLanHost(syncHostname) && isPrivateAiEndpointAllowed()) {
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

