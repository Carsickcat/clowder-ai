import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deliverablesRoot = path.join(repoRoot, 'project-evidence', 'nova-inspection-mvp');

const routes = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/product', ['nova-inspection-mock.html', 'text/html; charset=utf-8']],
  ['/nova-inspection-mock.html', ['nova-inspection-mock.html', 'text/html; charset=utf-8']],
  ['/deck', ['nova-product-introduction.html', 'text/html; charset=utf-8']],
  ['/nova-product-introduction.html', ['nova-product-introduction.html', 'text/html; charset=utf-8']],
  ['/mock-data', ['nova-payments-router-case.json', 'application/json; charset=utf-8']],
  ['/nova-payments-router-case.json', ['nova-payments-router-case.json', 'application/json; charset=utf-8']],
]);

function parseCliArgs(argv) {
  const options = { host: '127.0.0.1', port: 5272 };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--host' && argv[index + 1]) options.host = argv[++index];
    if (argv[index] === '--port' && argv[index + 1]) options.port = Number(argv[++index]);
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65_535) {
    throw new Error('Port must be an integer between 0 and 65535');
  }
  return options;
}

export function createNovaDeliverablesServer() {
  return http.createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname.replace(/\/$/u, '') || '/';
    const route = routes.get(pathname);
    if (!route || (request.method !== 'GET' && request.method !== 'HEAD')) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const [fileName, contentType] = route;
    const filePath = path.join(deliverablesRoot, fileName);
    try {
      const fileStat = await stat(filePath);
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Length': fileStat.size,
        'Content-Security-Policy':
          "default-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'self'",
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
      });
      if (request.method === 'HEAD') response.end();
      else createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseCliArgs(process.argv.slice(2));
  const server = createNovaDeliverablesServer();
  server.listen(options.port, options.host, () => {
    const address = server.address();
    const port = address && typeof address === 'object' ? address.port : options.port;
    console.log(`NOVA acceptance package: http://${options.host}:${port}`);
    console.log('  Product mock: /product');
    console.log('  Product deck: /deck');
    console.log('  Mock dataset: /mock-data');
  });
}
