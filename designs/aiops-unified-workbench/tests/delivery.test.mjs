import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildHtmlWidgetBlock } from '../scripts/build-rich-widget.mjs';

test('remote delivery embeds the standalone app instead of exposing a local file path', async () => {
  const html = await readFile(new URL('../NOVA-Ops-AI-Workbench-Standalone.html', import.meta.url), 'utf8');
  const block = buildHtmlWidgetBlock(html, { id: 'aiops-delivery-test' });

  assert.equal(block.kind, 'html_widget');
  assert.equal(block.v, 1);
  assert.equal(block.height, 1200);
  assert.equal(block.html, html);
  assert.doesNotMatch(block.html, /(?:[A-Z]:\\|file:\/\/|https?:\/\/(?:localhost|127\.0\.0\.1))/i);
  assert.doesNotMatch(block.html, /<(?:script|link)[^>]+(?:src|href)=["']https?:/i);
});
