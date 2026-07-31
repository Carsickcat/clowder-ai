import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import puppeteer from 'puppeteer';

import { buildHtmlWidgetBlock } from '../scripts/build-rich-widget.mjs';

const html = await readFile(new URL('../NOVA-Ops-AI-Workbench-Standalone.html', import.meta.url), 'utf8');
const block = buildHtmlWidgetBlock(html, { id: 'aiops-widget-smoke' });
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
const browserErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`));

try {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.setContent(
    '<!doctype html><iframe id="widget" sandbox="allow-scripts" style="border:0;width:100%;height:1200px"></iframe>',
  );
  await page.$eval(
    '#widget',
    (node, srcdoc) => {
      node.srcdoc = srcdoc;
    },
    block.html,
  );

  const iframe = await page.waitForSelector('#widget');
  const frame = await iframe.contentFrame();
  await frame.waitForSelector("[data-scenario-id='incident']");
  assert.equal(await frame.$$eval('[data-scenario-id]', (nodes) => nodes.length), 3);

  await frame.click("[data-scenario-id='incident']");
  assert.match(await frame.$eval('.context-strip', (node) => node.textContent), /search-platform/);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await frame.click('.mobile-ai-trigger');
  assert.equal(await frame.$eval('#ai-inspector', (node) => node.classList.contains('is-open')), true);
  assert.deepEqual(browserErrors, []);
  console.log('WIDGET_SMOKE_OK sandbox=allow-scripts');
} finally {
  await browser.close();
}
