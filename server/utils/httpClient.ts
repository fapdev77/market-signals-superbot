import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  method?: string;
}

export interface HttpResponse<T = any> {
  status: number;
  data: T;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Native Node.js HTTP/HTTPS client that bypasses Node's experimental/undici fetch parser.
 * This completely prevents undici's internal "AssertionError [ERR_ASSERTION]: false == true" (assert(!this.paused))
 * on socket end/FIN events under high concurrency, especially in Node.js v20, v22, and v24.
 */
export function requestJson<T = any>(urlStr: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(urlStr);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;
      const timeoutMs = options.timeoutMs ?? 4500;

      let settled = false;
      const resolveOnce = (val: any) => {
        if (settled) return;
        settled = true;
        resolve(val);
      };
      const rejectOnce = (err: any) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      const req = lib.request(
        parsedUrl,
        {
          method: options.method || 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MarketSignalsSuperBot/2.0',
            'Accept': 'application/json',
            'Connection': 'close',
            ...(options.headers || {})
          },
          timeout: timeoutMs
        },
        (res) => {
          const status = res.statusCode || 0;
          let body = '';
          res.setEncoding('utf8');

          res.on('data', (chunk) => {
            body += chunk;
          });

          res.on('error', (resErr) => {
            try { req.destroy(); } catch (_) {}
            rejectOnce(resErr);
          });

          res.on('end', () => {
            if (status >= 200 && status < 300) {
              try {
                const data = JSON.parse(body);
                resolveOnce({ status, data, headers: res.headers });
              } catch (parseErr) {
                rejectOnce(new Error(`Falha no parse JSON de ${urlStr}: ${parseErr}`));
              }
            } else {
              // Body is drained to avoid memory leaks or hung sockets
              rejectOnce(new Error(`HTTP status ${status} de ${parsedUrl.hostname}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        const timeoutErr = new Error(`Timeout de requisição (${timeoutMs}ms)`);
        try { req.destroy(timeoutErr); } catch (_) {}
        rejectOnce(timeoutErr);
      });

      req.on('error', (err) => {
        rejectOnce(err);
      });

      req.end();
    } catch (err) {
      reject(err);
    }
  });
}
