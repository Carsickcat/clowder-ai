import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const demoUrl = new URL('../../project-evidence/f010-mobile-pwa/f010-mobile-pwa-offline-demo.html', import.meta.url);

test('F010 offline demo is a self-contained mock that opens without a runtime', async () => {
  const html = await readFile(demoUrl, 'utf8');

  assert.match(html, /<meta\s+name="viewport"/i);
  assert.match(html, /<style>[\s\S]+<\/style>/i);
  assert.match(html, /<script>[\s\S]+<\/script>/i);
  assert.match(html, /const MOCK_THREADS\s*=/);
  assert.match(html, /data-testid="conversation"/);
  assert.doesNotMatch(html, /\b(?:src|href)=["'](?:https?:)?\/\//i);
  assert.doesNotMatch(html, /\bfetch\s*\(|\bWebSocket\b|\bEventSource\b/);
});
