import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildStandalone } from '../scripts/build-standalone.mjs';

test('standalone build inlines every style and interaction dependency', async (t) => {
  const outputPath = path.join(os.tmpdir(), `nova-ops-standalone-${process.pid}.html`);
  t.after(() => rm(outputPath, { force: true }));

  await buildStandalone({ outputPath });
  const html = await readFile(outputPath, 'utf8');

  assert.match(html, /<style>[\s\S]*--accent:/);
  assert.match(html, /<script>[\s\S]*createInitialState/);
  assert.doesNotMatch(html, /<link[^>]+rel=["']stylesheet/);
  assert.doesNotMatch(html, /<script[^>]+type=["']module/);
  assert.doesNotMatch(html, /\bimport\s.+from\s+["']\.\//);
});
