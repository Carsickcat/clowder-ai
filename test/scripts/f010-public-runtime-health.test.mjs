import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { probeF010PublicRuntime } from '../../scripts/lib/f010-public-runtime-health.mjs';

const BASE_URL = 'https://desktop.example.ts.net:8443';
const HTML = `<!doctype html>
<html>
  <head>
    <script src="/_next/static/chunks/runtime-a.js"></script>
    <script src="/_next/static/chunks/app-b.js"></script>
  </head>
</html>`;

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('probeF010PublicRuntime', () => {
  it('accepts a hydrated public artifact whose scripts and member API are healthy', async () => {
    const fetchImpl = async (url) => {
      if (url === `${BASE_URL}/`) return new Response(HTML, { status: 200 });
      if (url === `${BASE_URL}/api/cats`) {
        return jsonResponse({ cats: [{ id: 'opus' }, { id: 'sonnet' }] });
      }
      return new Response('chunk', {
        status: 200,
        headers: { 'content-type': 'application/javascript; charset=UTF-8' },
      });
    };

    const result = await probeF010PublicRuntime({ baseUrl: BASE_URL, fetchImpl });

    assert.deepEqual(result, { scriptCount: 2, catCount: 2 });
  });

  it('rejects the live-build split when HTML references a missing chunk', async () => {
    const fetchImpl = async (url) => {
      if (url === `${BASE_URL}/`) return new Response(HTML, { status: 200 });
      if (url === `${BASE_URL}/api/cats`) return jsonResponse({ cats: [{ id: 'opus' }] });
      if (url.endsWith('/app-b.js')) return new Response('missing', { status: 400 });
      return new Response('chunk', {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
      });
    };

    await assert.rejects(probeF010PublicRuntime({ baseUrl: BASE_URL, fetchImpl }), /app-b\.js returned HTTP 400/);
  });

  it('rejects a script URL that resolves to an HTML fallback', async () => {
    const fetchImpl = async (url) => {
      if (url === `${BASE_URL}/`) return new Response(HTML, { status: 200 });
      if (url === `${BASE_URL}/api/cats`) return jsonResponse({ cats: [{ id: 'opus' }] });
      if (url.endsWith('/app-b.js')) {
        return new Response('<html>fallback</html>', {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'x-content-type-options': 'nosniff',
          },
        });
      }
      return new Response('chunk', {
        status: 200,
        headers: { 'content-type': 'application/javascript; charset=UTF-8' },
      });
    };

    await assert.rejects(
      probeF010PublicRuntime({ baseUrl: BASE_URL, fetchImpl }),
      /app-b\.js did not return a JavaScript media type/,
    );
  });

  it('rejects a script redirect instead of following it off origin', async () => {
    const fetchImpl = async (url, options) => {
      if (url === `${BASE_URL}/`) return new Response(HTML, { status: 200 });
      if (url === `${BASE_URL}/api/cats`) return jsonResponse({ cats: [{ id: 'opus' }] });
      if (options?.redirect === 'manual') {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://external.example/chunk.js' },
        });
      }
      return new Response('external chunk', {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
      });
    };

    await assert.rejects(probeF010PublicRuntime({ baseUrl: BASE_URL, fetchImpl }), /returned HTTP 302/);
  });

  it('rejects a shell that has no loadable Next.js scripts', async () => {
    const fetchImpl = async (url) => {
      if (url === `${BASE_URL}/`) return new Response('<html><body>shell</body></html>', { status: 200 });
      return jsonResponse({ cats: [{ id: 'opus' }] });
    };

    await assert.rejects(
      probeF010PublicRuntime({ baseUrl: BASE_URL, fetchImpl }),
      /HTML contained no same-origin JavaScript assets/,
    );
  });
});
