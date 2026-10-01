import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  initOrLoadSessionToken,
  resetTokenForTests,
  validateTokenConstantTime
} from '../server/middleware/auth.js';

describe('M4.8 & CA-4.6: Session Token Security & File Handling', () => {
  const testDir = path.join(process.cwd(), 'data', 'test-token');
  const tokenFilePath = path.join(testDir, 'session-token');
  let originalToken: string | undefined;

  beforeEach(() => {
    originalToken = process.env.API_AUTH_TOKEN;
    delete process.env.API_AUTH_TOKEN;
    resetTokenForTests();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.API_AUTH_TOKEN = originalToken;
    } else {
      delete process.env.API_AUTH_TOKEN;
    }
    resetTokenForTests();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('accepts fixed test token when NODE_ENV=test AND VITEST is defined', () => {
    const token = initOrLoadSessionToken({
      nodeEnv: 'test',
      isVitest: true,
      tokenFilePath
    });
    expect(token).toBe('test-secret-token-32-chars-long-abc');
  });

  it('rejects fixed test token if NODE_ENV=test but VITEST is NOT defined', () => {
    const token = initOrLoadSessionToken({
      nodeEnv: 'test',
      isVitest: false,
      tokenFilePath
    });
    expect(token).not.toBe('test-secret-token-32-chars-long-abc');
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it('CA-4.6: in production, writes token to session-token file with 0600 permissions and never logs secret', () => {
    const consoleLogs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      consoleLogs.push(args.join(' '));
    });

    const token = initOrLoadSessionToken({
      nodeEnv: 'production',
      isVitest: false,
      tokenFilePath
    });

    expect(fs.existsSync(tokenFilePath)).toBe(true);
    const content = fs.readFileSync(tokenFilePath, 'utf8').trim();
    expect(content).toBe(token);

    // Verify 0600 mode on platforms supporting POSIX chmod
    if (process.platform !== 'win32') {
      const stats = fs.statSync(tokenFilePath);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    }

    // Verify CA-4.6: No production log contains the actual token
    const combinedLog = consoleLogs.join(' ');
    expect(combinedLog).not.toContain(token);
    expect(combinedLog).toContain(tokenFilePath);

    spy.mockRestore();
  });

  it('validates tokens in constant time', () => {
    expect(validateTokenConstantTime('valid-token-1234567890', 'valid-token-1234567890')).toBe(true);
    expect(validateTokenConstantTime('invalid-token', 'valid-token-1234567890')).toBe(false);
    expect(validateTokenConstantTime('', 'valid-token-1234567890')).toBe(false);
  });
});
