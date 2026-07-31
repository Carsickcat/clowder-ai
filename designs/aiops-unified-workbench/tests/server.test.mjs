import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

async function freePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function waitForHttp(url) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error(`Static server did not become ready: ${url}`);
}

test('static preview remains responsive after its output pipes are detached', async (t) => {
  const port = await freePort();
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const serverPath = path.resolve(testDir, '..', 'serve.mjs');
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, AIOPS_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  t.after(() => child.kill());

  child.stdout.destroy();
  child.stderr.destroy();

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHttp(`${baseUrl}/`);
  for (let request = 0; request < 12; request += 1) {
    const response = await fetch(request % 2 === 0 ? `${baseUrl}/` : `${baseUrl}/app.mjs`);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).length > 100);
  }
});
