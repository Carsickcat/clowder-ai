import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { buildAcceptanceEnv, runStartupAcceptance } from './public-startup-acceptance.mjs';

const ROOT = resolve(import.meta.dirname, '..');

function writeFixture(testContext, source) {
  const dir = mkdtempSync(join(tmpdir(), 'public-startup-fixture-'));
  const path = join(dir, 'fixture.mjs');
  writeFileSync(path, source, 'utf8');
  testContext.after(() => rmSync(dir, { recursive: true, force: true }));
  return path;
}

describe('public startup acceptance', () => {
  it('replaces inherited runtime and persistent-storage configuration', () => {
    const tempRoot = resolve(tmpdir(), 'public-startup-env-test');
    const env = buildAcceptanceEnv({
      baseEnv: {
        PATH: process.env.PATH,
        REDIS_URL: 'redis://production.invalid:6399',
        CAT_TEMPLATE_PATH: 'C:/runtime/cat-template.json',
        CAT_CAFE_CONFIG_ROOT: 'C:/runtime/config',
        CAT_CAFE_GLOBAL_CONFIG_ROOT: 'C:/operator/home',
        CAT_CAFE_CALLBACK_TOKEN: 'must-not-reach-child',
        LOG_DIR: 'C:/runtime/logs',
      },
      repoRoot: ROOT,
      tempRoot,
      port: 43123,
    });

    assert.equal(env.REDIS_URL, undefined);
    assert.equal(env.CAT_CAFE_CALLBACK_TOKEN, undefined);
    assert.equal(env.MEMORY_STORE, '1');
    assert.equal(env.API_SERVER_HOST, '127.0.0.1');
    assert.equal(env.API_SERVER_PORT, '43123');
    assert.equal(env.CAT_TEMPLATE_PATH, join(tempRoot, 'config', 'cat-template.json'));
    assert.equal(env.CAT_CAFE_CONFIG_ROOT, join(tempRoot, 'config'));
    assert.equal(env.CAT_CAFE_GLOBAL_CONFIG_ROOT, join(tempRoot, 'global'));
    assert.equal(env.LOG_DIR, join(tempRoot, 'logs'));
    assert.equal(env.EVIDENCE_DB, join(tempRoot, 'data', 'evidence.sqlite'));
  });

  it('probes a real child health endpoint and stops that exact child', async (testContext) => {
    const fixture = writeFixture(
      testContext,
      `
      import { createServer } from 'node:http';
      const server = createServer((request, response) => {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ status: request.url === '/health' ? 'ok' : 'unknown' }));
      });
      server.listen(Number(process.env.API_SERVER_PORT), process.env.API_SERVER_HOST);
      process.on('SIGTERM', () => server.close(() => process.exit(0)));
      process.on('SIGINT', () => server.close(() => process.exit(0)));
    `,
    );

    const result = await runStartupAcceptance({
      repoRoot: ROOT,
      apiEntry: fixture,
      timeoutMs: 5_000,
    });

    assert.equal(result.status, 'passed');
    assert.equal(result.health.status, 'ok');
    assert.ok(Number.isInteger(result.childPid));
  });

  it('fails with child diagnostics when the API exits before health', async (testContext) => {
    const fixture = writeFixture(
      testContext,
      `
      process.stderr.write('fixture-startup-failed\\n');
      process.exit(7);
    `,
    );

    await assert.rejects(
      () => runStartupAcceptance({ repoRoot: ROOT, apiEntry: fixture, timeoutMs: 5_000 }),
      /exited before health.*fixture-startup-failed/s,
    );
  });
});
