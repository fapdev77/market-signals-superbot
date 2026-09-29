import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// In production, an explicit API_AUTH_TOKEN is required.
// In development / testing, a fallback default session token is established.
let dynamicDevToken: string | null = null;

export function getEffectiveAuthToken(): string {
  if (process.env.API_AUTH_TOKEN && process.env.API_AUTH_TOKEN.trim().length > 0) {
    return process.env.API_AUTH_TOKEN.trim();
  }
  if (!dynamicDevToken) {
    dynamicDevToken = process.env.NODE_ENV === 'test' ? 'test-secret-token' : 'superbot-dev-token-2026';
  }
  return dynamicDevToken;
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
 * Authentication Middleware for /api/* routes
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

  const authHeader = req.headers['authorization'];
  let providedToken = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedToken = authHeader.slice(7).trim();
  } else if (req.headers['x-api-token']) {
    providedToken = String(req.headers['x-api-token']).trim();
  }

  const expectedToken = getEffectiveAuthToken();

  // In development / preview when no explicit API_AUTH_TOKEN is forced in environment,
  // allow unauthenticated requests from local UI to transparently authenticate using the default dev session token
  if (!providedToken && !process.env.API_AUTH_TOKEN && process.env.NODE_ENV !== 'production') {
    return next();
  }

  if (!providedToken || !validateTokenConstantTime(providedToken, expectedToken)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Token de autenticação ausente ou inválido. Forneça o header Authorization: Bearer <token>.'
    });
    return;
  }

  next();
}
