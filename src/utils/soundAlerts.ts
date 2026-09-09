/**
 * Audio Synthesizer & Desktop Notifications for Live Signals
 * Uses HTML5 Web Audio API (Zero external assets required)
 */

let audioCtx: AudioContext | null = null;

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
  if (typeof window === 'undefined' || !window.localStorage) return false;
  return window.localStorage.getItem('superbot_sound_alerts') !== 'false';
}

export function setAudioEnabled(enabled: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem('superbot_sound_alerts', enabled ? 'true' : 'false');
  if (enabled) {
    getAudioContext();
  }
}

export function playSignalTone(direction: 'LONG' | 'SHORT' | 'ALERT'): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    gain.connect(ctx.destination);
    osc.connect(gain);

    if (direction === 'LONG') {
      // Ascending pleasant chord chime: D5 (587.33Hz) -> A5 (880Hz)
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (direction === 'SHORT') {
      // Descending crisp chime: A5 (880Hz) -> F5 (698.46Hz)
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(698.46, now + 0.15);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else {
      // Notification single ding C6 (1046.5Hz)
      osc.frequency.setValueAtTime(1046.5, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
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

