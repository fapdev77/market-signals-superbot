import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isAudioEnabled, setAudioEnabled, playSignalTone } from '../src/utils/soundAlerts';

describe('Sound Alerts & Audio Synthesizer', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    // Mock global window and localStorage
    const mockLocalStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; }
    };

    vi.stubGlobal('window', {
      localStorage: mockLocalStorage,
      AudioContext: vi.fn().mockImplementation(() => ({
        currentTime: 0,
        state: 'running',
        createOscillator: () => ({
          type: 'sine',
          frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn()
        }),
        createGain: () => ({
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn()
        }),
        destination: {}
      }))
    });
  });

  it('should default to audio enabled when window exists', () => {
    expect(isAudioEnabled()).toBe(true);
  });

  it('should toggle audio correctly', () => {
    setAudioEnabled(false);
    expect(isAudioEnabled()).toBe(false);

    setAudioEnabled(true);
    expect(isAudioEnabled()).toBe(true);
  });

  it('should safely execute playSignalTone without throwing', () => {
    expect(() => playSignalTone('LONG')).not.toThrow();
    expect(() => playSignalTone('SHORT')).not.toThrow();
    expect(() => playSignalTone('ALERT')).not.toThrow();
  });
});
