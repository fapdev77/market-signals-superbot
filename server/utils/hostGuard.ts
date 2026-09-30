/**
 * Host Binding Security Guard (M4.1 & CA-4.7)
 *
 * Enforces local-only binding by default (127.0.0.1).
 * In production, binding to 0.0.0.0 exposes the service to all network interfaces
 * and is strictly forbidden unless explicitly authorized by ALLOW_PUBLIC_BIND=true.
 */

export interface HostBindingResult {
  allowed: boolean;
  reason?: string;
}

export function resolveServerHost(envHost?: string): string {
  if (envHost && envHost.trim().length > 0) {
    return envHost.trim();
  }
  return '127.0.0.1';
}

export function validateHostBinding(
  host: string,
  nodeEnv: string = process.env.NODE_ENV || 'development',
  allowPublicBind: boolean = process.env.ALLOW_PUBLIC_BIND === 'true'
): HostBindingResult {
  const normalizedHost = host.trim().toLowerCase();

  // In production, binding to 0.0.0.0 without explicit authorization is forbidden
  if (nodeEnv === 'production') {
    if (normalizedHost === '0.0.0.0' || normalizedHost === '::' || normalizedHost === '*') {
      if (!allowPublicBind) {
        return {
          allowed: false,
          reason:
            '❌ [SECURITY VIOLATION] HOST=0.0.0.0 é proibido em produção sem ALLOW_PUBLIC_BIND=true. ' +
            'Utilize HOST=127.0.0.1 e acesse via proxy reverso seguro (TLS/VPN).'
        };
      }
    }
  }

  return { allowed: true };
}

export function enforceHostBinding(
  host: string,
  nodeEnv?: string,
  allowPublicBind?: boolean
): void {
  const check = validateHostBinding(host, nodeEnv, allowPublicBind);
  if (!check.allowed) {
    console.error(check.reason);
    throw new Error(check.reason);
  }
}
