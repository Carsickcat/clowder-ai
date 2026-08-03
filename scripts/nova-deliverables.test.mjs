import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createNovaDeliverablesServer } from './serve-nova-deliverables.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deliverablesRoot = path.join(repoRoot, 'project-evidence', 'nova-inspection-mvp');

async function readDeliverable(name) {
  return readFile(path.join(deliverablesRoot, name), 'utf8');
}

test('ships a truthful, complete mock inspection dataset', async () => {
  const mock = JSON.parse(await readDeliverable('nova-payments-router-case.json'));

  assert.equal(mock.schemaVersion, 'nova.inspection.demo.v1');
  assert.equal(mock.disclaimer.mockOnly, true);
  assert.equal(mock.case.status, 'completed');
  assert.deepEqual(
    mock.runs.map((run) => run.purpose),
    ['admission', 'canary', 'post_change'],
  );
  assert.ok(mock.runs.every((run) => run.verdict === 'passed'));
  assert.deepEqual(
    mock.metrics.map((metric) => metric.label),
    ['服务可用性', '请求延迟', '服务错误率'],
  );
  assert.equal(mock.report.verdict, 'passed');
  assert.equal(mock.report.runIds.length, 3);
  assert.match(mock.report.id, /^report-/u);
});

test('keeps mock evidence chronology strictly causal', async () => {
  const mock = JSON.parse(await readDeliverable('nova-payments-router-case.json'));
  const timeline = [
    ['case.createdAt', mock.case.createdAt],
    ...mock.runs.map((run) => [`run.${run.purpose}.observedAt`, run.observedAt]),
    ['decision.createdAt', mock.decision.createdAt],
    ['report.generatedAt', mock.report.generatedAt],
    ['case.updatedAt', mock.case.updatedAt],
  ].map(([label, timestamp]) => [label, Date.parse(timestamp)]);

  for (const [label, timestamp] of timeline) {
    assert.ok(Number.isFinite(timestamp), `${label} must be an ISO timestamp`);
  }
  for (let index = 1; index < timeline.length; index += 1) {
    const [previousLabel, previousTimestamp] = timeline[index - 1];
    const [currentLabel, currentTimestamp] = timeline[index];
    assert.ok(previousTimestamp < currentTimestamp, `${currentLabel} must occur after ${previousLabel}`);
  }
});

test('ships self-contained Chinese product and presentation HTML', async () => {
  const [productHtml, deckHtml] = await Promise.all([
    readDeliverable('nova-inspection-mock.html'),
    readDeliverable('nova-product-introduction.html'),
  ]);

  for (const html of [productHtml, deckHtml]) {
    assert.match(html, /<html lang="zh-CN">/u);
    assert.doesNotMatch(html, /(?:src|href)="https?:\/\//u);
    assert.match(html, /仅用于演示/u);
  }

  assert.match(productHtml, /data-testid="nova-mock-demo"/u);
  assert.match(productHtml, /变更前准入/u);
  assert.match(productHtml, /灰度持续验证/u);
  assert.match(productHtml, /变更后验收/u);
  assert.match(productHtml, /不可变报告/u);
  assert.match(productHtml, /导出演示摘要/u);
  assert.match(productHtml, /nova-payments-router-demo-summary\.json/u);
  assert.match(productHtml, /summaryOnly: true/u);
  assert.doesNotMatch(productHtml, /导出 Mock JSON/u);

  const slideCount = (deckHtml.match(/class="slide(?:\s|")/gu) ?? []).length;
  assert.equal(slideCount, 8);
  assert.match(deckHtml, /addEventListener\('keydown'/u);
  assert.match(deckHtml, /NOVA 不是替人拍板/u);
});

test('serves the minimal acceptance package without external dependencies', async (t) => {
  const server = createNovaDeliverablesServer({ host: '127.0.0.1', port: 0 });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;

  for (const route of ['/', '/product', '/deck', '/mock-data']) {
    const response = await fetch(`${origin}${route}`);
    assert.equal(response.status, 200, route);
  }

  const traversal = await fetch(`${origin}/..%2f..%2fpackage.json`);
  assert.equal(traversal.status, 404);
});

test('connected degradation acceptance exempts only the expected API failure', async () => {
  const acceptance = await readFile(path.join(repoRoot, 'scripts', 'nova-connected-runtime-acceptance.mjs'), 'utf8');

  assert.doesNotMatch(acceptance, /if \(!intentionalApiFailure\) consoleErrors/u);
  assert.match(acceptance, /expectedApiFailures/u);
  assert.match(acceptance, /expectedApiConsoleErrors/u);
  assert.match(acceptance, /message\.location\(\)/u);
  assert.match(acceptance, /request\.url\(\)\.includes\('\/api\/observability\/'\)/u);
  assert.match(acceptance, /assert\.ok\(expectedApiFailures\.length > 0/u);
});
