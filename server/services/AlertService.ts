/**
 * AlertService (M4.7 / R-28)
 *
 * Implements:
 * - AlertSink interface for multi-channel dispatch
 * - Generic Webhook sink (ALERT_WEBHOOK_URL)
 * - Telegram Bot sink (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
 * - Strict environment variable configuration (never configured via mutable API)
 * - Deduplication window by alert key (default: 10 minutes)
 */

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AlertPayload {
  key: string;
  severity: AlertSeverity;
  message: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface AlertSink {
  name: string;
  send(payload: AlertPayload): Promise<boolean>;
}

export class WebhookAlertSink implements AlertSink {
  name = 'webhook';
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async send(payload: AlertPayload): Promise<boolean> {
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000)
      });
      return res.ok;
    } catch (err: any) {
      console.error(`[AlertService] Erro ao enviar webhook para ${this.url}:`, err?.message || err);
      return false;
    }
  }
}

export class TelegramAlertSink implements AlertSink {
  name = 'telegram';
  private botToken: string;
  private chatId: string;

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  async send(payload: AlertPayload): Promise<boolean> {
    try {
      const text = `🚨 *SUPERBOT ALERT [${payload.severity}]*\n*Key:* \`${payload.key}\`\n*Mensagem:* ${payload.message}\n*Timestamp:* ${new Date(payload.timestamp).toISOString()}`;
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: 'Markdown'
        }),
        signal: AbortSignal.timeout(5000)
      });
      return res.ok;
    } catch (err: any) {
      console.error('[AlertService] Erro ao enviar alerta Telegram:', err?.message || err);
      return false;
    }
  }
}

export interface AlertServiceOptions {
  dedupWindowMs?: number;
  sinks?: AlertSink[];
}

export const DEFAULT_DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export class AlertService {
  private dedupWindowMs: number;
  private sinks: AlertSink[];
  private lastAlertTimestamps = new Map<string, number>();

  constructor(options?: AlertServiceOptions) {
    this.dedupWindowMs = options?.dedupWindowMs ?? DEFAULT_DEDUP_WINDOW_MS;
    this.sinks = options?.sinks ?? [];
  }

  registerSink(sink: AlertSink): void {
    this.sinks.push(sink);
  }

  async emitAlert(
    key: string,
    severity: AlertSeverity,
    message: string,
    metadata?: Record<string, any>,
    now: number = Date.now()
  ): Promise<boolean> {
    const lastTime = this.lastAlertTimestamps.get(key) || 0;
    if (now - lastTime < this.dedupWindowMs) {
      // Suppressed within deduplication window
      return false;
    }

    this.lastAlertTimestamps.set(key, now);

    const payload: AlertPayload = {
      key,
      severity,
      message,
      metadata,
      timestamp: now
    };

    console.warn(`🔔 [ALERT ${severity}] [${key}] ${message}`);

    if (this.sinks.length === 0) {
      return true;
    }

    await Promise.allSettled(this.sinks.map(sink => sink.send(payload)));
    return true;
  }

  getLastAlertTime(key: string): number | null {
    return this.lastAlertTimestamps.get(key) || null;
  }

  resetForTests(): void {
    this.lastAlertTimestamps.clear();
  }
}

export function createDefaultAlertService(): AlertService {
  const sinks: AlertSink[] = [];

  const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    sinks.push(new WebhookAlertSink(webhookUrl));
  }

  const tgToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const tgChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (tgToken && tgChatId) {
    sinks.push(new TelegramAlertSink(tgToken, tgChatId));
  }

  return new AlertService({ sinks });
}

export const defaultAlertService = createDefaultAlertService();
