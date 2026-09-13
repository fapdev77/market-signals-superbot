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

          res.on('end', () => {
            if (status >= 200 && status < 300) {
              try {
                const data = JSON.parse(body);
                resolve({ status, data, headers: res.headers });
              } catch (parseErr) {
                reject(new Error(`Falha no parse JSON de ${urlStr}: ${parseErr}`));
              }
            } else {
              // Body is drained to avoid memory leaks or hung sockets
              reject(new Error(`HTTP status ${status} de ${parsedUrl.hostname}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy(new Error(`Timeout de requisição (${timeoutMs}ms)`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    } catch (err) {
      reject(err);
    }
  });
}
