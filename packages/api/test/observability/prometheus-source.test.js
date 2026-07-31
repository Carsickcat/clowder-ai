import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PrometheusObservabilitySource } from '../../dist/domains/observability/adapters/PrometheusObservabilitySource.js';
import { ObservabilitySourceError } from '../../dist/domains/observability/ports/ObservabilitySource.js';

const NOW = new Date('2026-07-31T08:00:00.000Z');
const SECRET = 'acceptance-secret-must-not-leak';

function prometheusVector(value = '184', timestamp = NOW.getTime() / 1_000 - 30) {
  return JSON.stringify({
    data: {
      result: [{ metric: {}, value: [timestamp, value] }],
      resultType: 'vector',
    },
    status: 'success',
  });
}

function createSource(fetchImpl, overrides = {}) {
  return new PrometheusObservabilitySource({
    authorization: `Bearer ${SECRET}`,
    baseUrl: 'https://prometheus.acceptance.invalid/root',
    clock: () => NOW,
    fetchImpl,
    maxResponseBytes: 4_096,
    sourceId: 'prometheus-acceptance',
    timeoutMs: 50,
    ...overrides,
  });
}

const request = {
  checks: [{ id: 'latency', query: 'histogram_quantile(0.95, safe_metric)' }],
  window: '5m',
};

async function captureError(operation) {
  try {
    await operation();
    assert.fail('expected ObservabilitySourceError');
  } catch (error) {
    assert.ok(error instanceof ObservabilitySourceError);
    return error;
  }
}

describe('PrometheusObservabilitySource', () => {
  test('posts queries only to the fixed server endpoint with redirects disabled', async () => {
    const calls = [];
    const source = createSource(async (url, init) => {
      calls.push({ init, url });
      return new Response(prometheusVector(), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      });
    });

    const result = await source.collect({
      ...request,
      baseUrl: 'http://attacker.invalid/',
      headers: { authorization: 'Bearer attacker' },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://prometheus.acceptance.invalid/root/api/v1/query');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.redirect, 'error');
    assert.equal(calls[0].init.headers.authorization, `Bearer ${SECRET}`);
    const body = new URLSearchParams(calls[0].init.body);
    assert.equal(body.get('query'), request.checks[0].query);
    assert.equal(body.get('time'), String(NOW.getTime() / 1_000));
    assert.equal(result.observations[0].value, 184);
    assert.equal(result.observations[0].observedAt, '2026-07-31T07:59:30.000Z');
    assert.doesNotMatch(JSON.stringify(result), /attacker|acceptance-secret/);
  });

  test('fails safely on non-2xx responses without exposing response or authorization secrets', async () => {
    const source = createSource(async () => {
      return new Response(`upstream says token=${SECRET}`, { status: 503 });
    });

    const error = await captureError(() => source.collect(request));

    assert.equal(error.code, 'http_error');
    assert.doesNotMatch(error.message, new RegExp(SECRET));
    assert.doesNotMatch(JSON.stringify(error), new RegExp(SECRET));
  });

  test('rejects redirects even when an injected transport returns a followed response', async () => {
    const source = createSource(async () => ({
      headers: new Headers(),
      ok: true,
      redirected: true,
      status: 200,
      url: 'https://redirected.invalid/api/v1/query',
    }));

    const error = await captureError(() => source.collect(request));

    assert.equal(error.code, 'redirect_error');
    assert.doesNotMatch(error.message, /redirected\.invalid/);
  });

  test('times out a hung transport and reports only a safe error', async () => {
    const source = createSource(
      async (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            'abort',
            () =>
              reject(
                Object.assign(new Error(`hung with ${SECRET}`), {
                  name: 'AbortError',
                }),
              ),
            { once: true },
          );
        }),
      { timeoutMs: 5 },
    );

    const error = await captureError(() => source.collect(request));

    assert.equal(error.code, 'timeout');
    assert.doesNotMatch(error.message, new RegExp(SECRET));
  });

  test('enforces its deadline even when an injected transport ignores abort', async () => {
    const source = createSource(async () => new Promise(() => {}), {
      timeoutMs: 5,
    });

    const outcome = await Promise.race([
      captureError(() => source.collect(request)),
      new Promise((resolve) => setTimeout(() => resolve('still-hung'), 50)),
    ]);

    assert.notEqual(outcome, 'still-hung');
    assert.equal(outcome.code, 'timeout');
  });

  test('rejects malformed Prometheus payloads without echoing their body', async () => {
    const source = createSource(async () => {
      return new Response(`{ "secret": "${SECRET}"`, { status: 200 });
    });

    const error = await captureError(() => source.collect(request));

    assert.equal(error.code, 'malformed_response');
    assert.doesNotMatch(error.message, new RegExp(SECRET));
  });

  test('enforces declared and streamed response byte budgets', async () => {
    const declared = createSource(
      async () =>
        new Response('ignored', {
          headers: { 'content-length': '5000' },
          status: 200,
        }),
      { maxResponseBytes: 64 },
    );
    const streamed = createSource(async () => new Response('x'.repeat(65), { status: 200 }), { maxResponseBytes: 64 });

    const declaredError = await captureError(() => declared.collect(request));
    const streamedError = await captureError(() => streamed.collect(request));

    assert.equal(declaredError.code, 'response_too_large');
    assert.equal(streamedError.code, 'response_too_large');
  });

  test('represents an empty successful vector as missing data, never a numeric result', async () => {
    const source = createSource(async () => {
      return new Response(
        JSON.stringify({
          data: { result: [], resultType: 'vector' },
          status: 'success',
        }),
        { status: 200 },
      );
    });

    const result = await source.collect(request);

    assert.deepEqual(result.observations[0], {
      baselineValue: null,
      checkId: 'latency',
      observedAt: null,
      partial: false,
      queryDigest: result.observations[0].queryDigest,
      status: 'missing',
      value: null,
    });
  });
});
