import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';

/**
 * Robust, drop-in replacement for globalThis.fetch powered by Node's native https/http modules.
 * Completely eliminates Undici (Node 20/22/24) ERR_ASSERTION: false == true crashes on socket FIN.
 */
export function safeFetch(input: string | URL | any, init: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      // Abort early if signal is already aborted
      if (init?.signal?.aborted) {
        return reject(init.signal.reason || new Error('This operation was aborted'));
      }

      const urlStr = typeof input === 'string' ? input : (input?.url || input?.toString() || '');
      const parsedUrl = new URL(urlStr);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const method = (init.method || input?.method || 'GET').toUpperCase();
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MarketSignalsSuperBot/2.0',
        'Accept': 'application/json, text/plain, */*',
        'Connection': 'close',
      };

      if (init.headers) {
        if (typeof init.headers.forEach === 'function') {
          init.headers.forEach((val: string, key: string) => {
            headers[key] = val;
          });
        } else if (typeof init.headers === 'object') {
          Object.assign(headers, init.headers);
        }
      }

      let reqBody: any = init.body;
      if (reqBody && typeof reqBody === 'object' && !(reqBody instanceof Buffer) && !(typeof reqBody === 'string')) {
        reqBody = JSON.stringify(reqBody);
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }

      if (reqBody && !headers['Content-Length']) {
        headers['Content-Length'] = String(Buffer.byteLength(reqBody));
      }

      const timeoutMs = init.timeoutMs || 10000;

      const req = lib.request(
        parsedUrl,
        {
          method,
          headers,
          timeout: timeoutMs,
        },
        (res) => {
          const status = res.statusCode || 0;
          const statusText = res.statusMessage || '';
          const chunks: Buffer[] = [];

          res.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });

          res.on('end', () => {
            const rawBuffer = Buffer.concat(chunks);
            const textContent = rawBuffer.toString('utf8');

            const responseObj = {
              ok: status >= 200 && status < 300,
              status,
              statusText,
              headers: {
                get: (name: string) => {
                  const val = res.headers[name.toLowerCase()];
                  return Array.isArray(val) ? val.join(', ') : val || null;
                },
                has: (name: string) => name.toLowerCase() in res.headers,
              },
              json: async () => {
                try {
                  return JSON.parse(textContent);
                } catch (e: any) {
                  throw new Error(`JSON parse failed for ${urlStr}: ${e.message}. Body: ${textContent.slice(0, 100)}`);
                }
              },
              text: async () => textContent,
              arrayBuffer: async () => rawBuffer.buffer.slice(rawBuffer.byteOffset, rawBuffer.byteOffset + rawBuffer.byteLength),
              blob: async () => new Blob([rawBuffer]),
            };

            resolve(responseObj);
          });
        }
      );

      // Handle AbortSignal
      if (init.signal) {
        const onAbort = () => {
          req.destroy(init.signal.reason || new Error('This operation was aborted'));
        };
        init.signal.addEventListener('abort', onAbort, { once: true });
        req.on('close', () => {
          init.signal.removeEventListener('abort', onAbort);
        });
      }

      req.on('timeout', () => {
        req.destroy(new Error(`Timeout de conexão (${timeoutMs}ms) em ${parsedUrl.hostname}`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (reqBody) {
        req.write(reqBody);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}
