const http = require('http');

const PORTS = [9101, 9102, 9103, 9104, 9105];

function requestJson(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body ? JSON.stringify(body) : null;

    const req = http.request(
      parsed,
      {
        method,
        headers: payload
          ? {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(payload).toString()
            }
          : undefined,
        timeout: 15000
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          try {
            resolve({
              statusCode: res.statusCode || 0,
              body: text ? JSON.parse(text) : null
            });
          } catch (error) {
            reject(new Error(`Invalid JSON from ${url}: ${text}`));
          }
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error(`Timeout calling ${url}`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  for (const port of PORTS) {
    const result = await requestJson(`http://127.0.0.1:${port}/health`);
    console.log(JSON.stringify({ port, health: result }, null, 2));
  }
}

main().catch((error) => {
  console.error('[codex-bridge-probe] fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
