import assert from 'node:assert/strict';
import { access, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildStandalone } from '../scripts/build.mjs';

const artifactPath = path.resolve(import.meta.dirname, '../index.html');
const attributesPath = path.resolve(import.meta.dirname, '../.gitattributes');
const legacyArtifactPath = path.resolve(import.meta.dirname, '../AI-Inspection-Copilot-Offline-Demo.html');

test('generated artifact checkout is pinned to LF on every platform', async () => {
  const attributes = await readFile(attributesPath, 'utf8');
  assert.match(attributes, /^index\.html text eol=lf$/m);
});

test('standalone build produces one deterministic offline artifact', async (t) => {
  const outputPath = path.join(os.tmpdir(), `ai-inspection-copilot-${process.pid}.html`);
  t.after(() => rm(outputPath, { force: true }));

  await buildStandalone({ outputPath });
  const [generated, checked] = await Promise.all([readFile(outputPath, 'utf8'), readFile(artifactPath, 'utf8')]);

  assert.equal(generated, checked);
  assert.match(generated, /<title>AI 巡检 Copilot · 离线产品 Demo<\/title>/);
  assert.match(generated, /<style>[\s\S]+<\/style>/);
  assert.match(generated, /<script>[\s\S]+<\/script>/);
  assert.match(generated, /创建任意巡检工作区/);
  assert.match(generated, /data-example-id/);
  assert.match(generated, /order-upgrade/);
  assert.match(generated, /payment-config/);
  assert.doesNotMatch(generated, /data-scenario-id=/);
  assert.doesNotMatch(generated, /aria-label="验收场景"/);
  assert.match(generated, /所有数据均为 mock/);

  const shell = generated.replace(/<style>[\s\S]*?<\/style>/gi, '').replace(/<script>[\s\S]*?<\/script>/gi, '');
  assert.doesNotMatch(shell, /<link[^>]+stylesheet/i);
  assert.doesNotMatch(shell, /<script[^>]+src=/i);
  assert.doesNotMatch(shell, /https?:\/\//i);
  assert.doesNotMatch(shell, /type=["']module["']/i);
  await assert.rejects(access(legacyArtifactPath), /ENOENT/);
});
