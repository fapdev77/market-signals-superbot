import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// In production and dev, a secure token must be used.
// If API_AUTH_TOKEN is not supplied in environment, generate a cryptographically secure 32-char token at startup.
let dynamicSessionToken: string | null = null;
let hasLoggedTokenWarning = false;

export function getEffectiveAuthToken(): string {
  if (process.env.API_AUTH_TOKEN && process.env.API_AUTH_TOKEN.trim().length > 0) {
    return process.env.API_AUTH_TOKEN.trim();
  }
  if (!dynamicSessionToken) {
    if (process.env.NODE_ENV === 'test') {
      dynamicSessionToken = 'test-secret-token-32-chars-long-abc';
    } else {
      dynamicSessionToken = crypto.randomBytes(24).toString('base64url');
    }
  }

  if (!hasLoggedTokenWarning && process.env.NODE_ENV !== 'test') {
    hasLoggedTokenWarning = true;
    console.log('\n======================================================');
    console.log('🔒 [SECURITY] API_AUTH_TOKEN não definido no ambiente.');
    console.log(`🔑 Token de sessão gerado dinamicamente: ${dynamicSessionToken}`);
    console.log('Utilize este token no cabeçalho: Authorization: Bearer <token>');
    console.log('======================================================\n');
  }

  return dynamicSessionToken;
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

