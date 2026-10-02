import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// In production and dev, a secure token must be used.
// If API_AUTH_TOKEN is not supplied in environment, generate a cryptographically secure 32-char token at startup.
let dynamicSessionToken: string | null = null;
let hasLoggedTokenWarning = false;

export function resetTokenForTests(): void {
  dynamicSessionToken = null;
  hasLoggedTokenWarning = false;
}

export interface SessionTokenOptions {
  nodeEnv?: string;
  isVitest?: boolean;
  tokenFilePath?: string;
}

export function initOrLoadSessionToken(opts?: SessionTokenOptions): string {
  const nodeEnv = opts?.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const isVitest = opts?.isVitest ?? Boolean(process.env.VITEST);
  const tokenFilePath =
    opts?.tokenFilePath ?? path.join(process.cwd(), 'data', 'session-token');

  if (process.env.API_AUTH_TOKEN && process.env.API_AUTH_TOKEN.trim().length > 0) {
    dynamicSessionToken = process.env.API_AUTH_TOKEN.trim();
    return dynamicSessionToken;
  }

  if (!dynamicSessionToken) {
    // M4.8: Token fixo de teste só é aceito com NODE_ENV=test E VITEST definido
    if (nodeEnv === 'test' && isVitest) {
      dynamicSessionToken = 'test-secret-token-32-chars-long-abc';
    } else {
      dynamicSessionToken = crypto.randomBytes(24).toString('base64url');
    }
  }

  if (!hasLoggedTokenWarning && nodeEnv !== 'test') {
    hasLoggedTokenWarning = true;
    if (nodeEnv === 'production') {
      try {
        const dir = path.dirname(tokenFilePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(tokenFilePath, dynamicSessionToken, { mode: 0o600 });
        if (process.platform !== 'win32') {
          try {
            fs.chmodSync(tokenFilePath, 0o600);
          } catch {
            /* ignore chmod error on platforms without posix perms */
          }
        }
      } catch (err) {
        console.error('Falha ao gravar session-token em modo 0600:', err?.message || err);
      }
      // CA-4.6: Nenhum log de produção contém o token; o log mostra apenas o caminho
      console.log('\n======================================================');
      console.log('🔒 [SECURITY] API_AUTH_TOKEN não definido no ambiente.');
      console.log(`📁 Token gravado com segurança em: ${tokenFilePath} (modo 0600)`);
      console.log('Utilize este token no cabeçalho: Authorization: Bearer <token>');
      console.log('======================================================\n');
    } else {
      console.log('\n======================================================');
      console.log('🔒 [SECURITY] API_AUTH_TOKEN não definido no ambiente.');
      console.log(`🔑 Token de sessão gerado dinamicamente: ${dynamicSessionToken}`);
      console.log('Utilize este token no cabeçalho: Authorization: Bearer <token>');
      console.log('======================================================\n');
    }
  }

  return dynamicSessionToken;
}

export function getEffectiveAuthToken(): string {
  if (process.env.API_AUTH_TOKEN && process.env.API_AUTH_TOKEN.trim().length > 0) {
    return process.env.API_AUTH_TOKEN.trim();
  }
  return initOrLoadSessionToken();
}

export function validateTokenConstantTime(providedToken: string, expectedToken: string): boolean {
  if (!providedToken || !expectedToken) return false;
  const providedBuffer = Buffer.from(providedToken, 'utf8');
  const expectedBuffer = Buffer.from(expectedToken, 'utf8');
  
  if (providedBuffer.length !== expectedBuffer.length) {
    // Prevent timing differences due to buffer length
    crypto.timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Extracts the presented token from either supported header. Shared by the auth middleware and the
 * audit-actor helper so both read the credential the same way.
 */
export function extractProvidedToken(req: Request): string {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.headers['x-api-token']) {
    return String(req.headers['x-api-token']).trim();
  }
  return '';
}

/**
 * Actor recorded in the audit log for a mutating request (Phase 2.5.8).
 *
 * The static bearer token carries no user identity, so recording a hardcoded 'ADMIN' told an auditor
 * nothing. We now record a short fingerprint of the presented token plus the client address: enough to
 * tell two actors apart and correlate a request with a source, without ever writing the secret itself.
 */
export function getAuditActor(req: Request): string {
  const provided = extractProvidedToken(req);
  const fingerprint = provided
    ? crypto.createHash('sha256').update(provided).digest('hex').slice(0, 8)
    : 'anonymous';
  return `token:${fingerprint}@${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

/**
 * Authentication Middleware for /api/* routes
 * Fail-Closed: All requests to protected endpoints require a valid Bearer or x-api-token.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const path = req.path;
  const originalUrl = req.originalUrl ? req.originalUrl.split('?')[0] : '';

  // Public endpoints bypass authentication
  if (
    path === '/health' ||
    path === '/api/health' ||
    path === '/auth/status' ||
    path === '/api/auth/status' ||
    path === '/auth/verify' ||
    path === '/api/auth/verify' ||
    originalUrl === '/health' ||
    originalUrl === '/api/health' ||
    originalUrl === '/api/auth/status' ||
    originalUrl === '/api/auth/verify'
  ) {
    return next();
  }

  const providedToken = extractProvidedToken(req);

  const expectedToken = getEffectiveAuthToken();

  if (!providedToken || !validateTokenConstantTime(providedToken, expectedToken)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Token de autenticação ausente ou inválido. Forneça o header Authorization: Bearer <token>.'
    });
    return;
  }

  next();
}

