/**
 * Audio Synthesizer & Desktop Notifications for Live Signals
 * Uses HTML5 Web Audio API (Zero external assets required)
 */

import { AlertSoundProfile, AlertAudioConfig } from '../types';

let audioCtx: AudioContext | null = null;

const AUDIO_STORAGE_KEY = 'superbot_alert_audio_config';

export function getAudioConfig(): AlertAudioConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { enabled: true, volume: 0.8, profile: 'SYNTH_CHIME' };
  }
  try {
    const raw = window.localStorage.getItem(AUDIO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: parsed.enabled ?? true,
        volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.8,
        profile: parsed.profile || 'SYNTH_CHIME'
      };
    }
  } catch {
    // fallback
  }
  return { enabled: true, volume: 0.8, profile: 'SYNTH_CHIME' };
}

export function saveAudioConfig(config: AlertAudioConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(config));
    // also keep legacy key for backward compatibility
    window.localStorage.setItem('superbot_sound_alerts', config.enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

export function isAudioEnabled(): boolean {
  return getAudioConfig().enabled;
}

export function setAudioEnabled(enabled: boolean): void {
  const current = getAudioConfig();
  saveAudioConfig({ ...current, enabled });
  if (enabled) {
    getAudioContext();
  }
}

export function playSignalTone(
  direction: 'LONG' | 'SHORT' | 'ALERT',
  customConfig?: Partial<AlertAudioConfig>
): void {
  const config = { ...getAudioConfig(), ...customConfig };
  if (!config.enabled || config.volume <= 0) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const baseVolume = config.volume; // 0.0 to 1.0

    switch (config.profile) {
      case 'RADAR_BEEP': {
        // High-tech pulsed radar blips
        const freq = direction === 'LONG' ? 1200 : direction === 'SHORT' ? 750 : 980;
        for (let i = 0; i < 2; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          gain.connect(ctx.destination);
          osc.connect(gain);

          const startTime = now + i * 0.12;
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.exponentialRampToValueAtTime(0.09 * baseVolume, startTime + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.08);

          osc.start(startTime);
          osc.stop(startTime + 0.09);
        }
        break;
      }

      case 'CRYSTAL_BELL': {
        // Pure harmonic bell chime with harmonics
        const baseFreq = direction === 'LONG' ? 1046.5 : direction === 'SHORT' ? 659.25 : 880; // C6, E5, A5
        [1, 2, 3].forEach((harmonic, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          gain.connect(ctx.destination);
          osc.connect(gain);

          osc.frequency.setValueAtTime(baseFreq * harmonic, now);
          const peakGain = (0.1 / (idx + 1)) * baseVolume;
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55 - idx * 0.1);

          osc.start(now);
          osc.stop(now + 0.6);
        });
        break;
      }

      case 'CYBER_PULSE': {
        // Sawtooth frequency sweep with resonance feel
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        gain.connect(ctx.destination);
        osc.connect(gain);

        if (direction === 'LONG') {
          osc.frequency.setValueAtTime(350, now);
          osc.frequency.exponentialRampToValueAtTime(950, now + 0.22);
        } else if (direction === 'SHORT') {
          osc.frequency.setValueAtTime(950, now);
          osc.frequency.exponentialRampToValueAtTime(350, now + 0.22);
        } else {
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(780, now + 0.15);
        }

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.08 * baseVolume, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }

      case 'ZEN_GONG': {
        // Deep relaxing acoustic bell resonance (low fundamental with slow decay)
        const osc = ctx.createOscillator();
        const subOsc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        subOsc.type = 'sine';

        gain.connect(ctx.destination);
        osc.connect(gain);
        subOsc.connect(gain);

        const freq = direction === 'LONG' ? 440 : direction === 'SHORT' ? 330 : 392;
        osc.frequency.setValueAtTime(freq, now);
        subOsc.frequency.setValueAtTime(freq / 2, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.14 * baseVolume, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

        osc.start(now);
        subOsc.start(now);
        osc.stop(now + 0.75);
        subOsc.stop(now + 0.75);
        break;
      }

      case 'SYNTH_CHIME':
      default: {
        // Classic ascending / descending synth chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        gain.connect(ctx.destination);
        osc.connect(gain);

        if (direction === 'LONG') {
          osc.frequency.setValueAtTime(587.33, now); // D5
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(0.12 * baseVolume, now + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
        } else if (direction === 'SHORT') {
          osc.frequency.setValueAtTime(880, now); // A5
          osc.frequency.exponentialRampToValueAtTime(698.46, now + 0.15); // F5
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(0.12 * baseVolume, now + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
        } else {
          osc.frequency.setValueAtTime(1046.5, now);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(0.09 * baseVolume, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
        }
        break;
      }
    }
  } catch (err) {
    // Audio contexts might be blocked until user clicks
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    }
  } catch (err) {
    console.warn('Desktop Notification permission request blocked or unsupported in this context:', err);
    return false;
  }
  return false;
}

export function isNotificationEnabled(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const stored = window.localStorage.getItem('superbot_desktop_notifications');
  if (stored !== null) {
    return stored === 'true';
  }
  // Default to true if browser already granted permission
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission === 'granted';
  }
  return false;
}

export function setNotificationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem('superbot_desktop_notifications', enabled ? 'true' : 'false');
}

export function sendDesktopNotification(title: string, body: string): void {
  if (!isNotificationEnabled()) return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'superbot-signal'
      });
    } catch (e) {
      // Suppress if iframe permissions block Notification constructor
    }
  }
}

