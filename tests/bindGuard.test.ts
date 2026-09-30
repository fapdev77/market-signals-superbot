import { describe, it, expect } from 'vitest';
import { validateHostBinding, resolveServerHost } from '../server/utils/hostGuard.js';

describe('M4.1 & CA-4.7: Host Binding Security Guard', () => {
  it('defaults HOST to 127.0.0.1 when not specified', () => {
    const host = resolveServerHost(undefined);
    expect(host).toBe('127.0.0.1');
  });

  it('allows 127.0.0.1 in production', () => {
    const result = validateHostBinding('127.0.0.1', 'production', false);
    expect(result.allowed).toBe(true);
  });

  it('allows localhost in production', () => {
    const result = validateHostBinding('localhost', 'production', false);
    expect(result.allowed).toBe(true);
  });

  it('CA-4.7: refuses to bind to 0.0.0.0 in production without ALLOW_PUBLIC_BIND=true', () => {
    const result = validateHostBinding('0.0.0.0', 'production', false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('ALLOW_PUBLIC_BIND');
  });

  it('allows 0.0.0.0 in production if ALLOW_PUBLIC_BIND=true', () => {
    const result = validateHostBinding('0.0.0.0', 'production', true);
    expect(result.allowed).toBe(true);
  });

  it('allows 0.0.0.0 in development environment', () => {
    const result = validateHostBinding('0.0.0.0', 'development', false);
    expect(result.allowed).toBe(true);
  });
});
