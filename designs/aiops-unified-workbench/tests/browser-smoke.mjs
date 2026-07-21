import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import puppeteer from 'puppeteer';

const baseUrl = process.env.AIOPS_PROTOTYPE_URL ?? 'http://127.0.0.1:5278/';
const evidenceDir = path.join(os.tmpdir(), 'cat-cafe-evidence', 'aiops-unified-workbench');

async function text(page, selector) {
  return page.$eval(selector, (node) => node.textContent.replace(/\s+/g, ' ').trim());
}

async function main() {
  await mkdir(evidenceDir, { recursive: true });
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
    await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
    await page.goto(baseUrl, { waitUntil: 'networkidle0' });
    assert.match(await page.title(), /NOVA Ops/);
    assert.match(await text(page, '#context-chips'), /HE-1042/);
    assert.match(await text(page, '#context-chips'), /checkout-service/);

    await page.click("[data-module='logs']");
    assert.match(await text(page, '.lens-tab.is-active'), /日志模式/);
    assert.match(await text(page, '#context-chips'), /HE-1042/);
    assert.match(await text(page, '#context-chips'), /release-2026\.07\.22-rc3/);

    await page.click("[data-evidence-id='log-timeout-01']");
    await page.click("[data-evidence-id='log-config-01']");
    assert.equal(await text(page, '#pinned-count'), '2 条已钉入');
    assert.match(await text(page, '#timeline'), /PaymentClient timeout/);
    assert.match(await text(page, '#timeline'), /pool\.maxConnections changed/);
    assert.match(await text(page, '#finding-card'), /可核验证据2 条/);

    const expectedActions = [
      ['人工确认 Finding', '分派给 陈曦'],
      ['分派给 陈曦', '开始受控整改'],
      ['开始受控整改', '发起复验'],
      ['发起复验', '完成复验'],
      ['完成复验', '复验通过 · 已进入恢复观察'],
    ];
    for (const [before, after] of expectedActions) {
      assert.equal(await text(page, '[data-workflow-action]'), before);
      await page.click('[data-workflow-action]');
      assert.equal(await text(page, '[data-workflow-action]'), after);
    }
    assert.match(await text(page, '#incident-header'), /恢复观察/);
    assert.match(await text(page, '#timeline'), /复验通过/);
    await page.screenshot({ path: path.join(evidenceDir, '01-golden-path-desktop.png'), fullPage: true });

    await page.reload({ waitUntil: 'networkidle0' });
    await page.click("[data-event-id='HE-1047']");
    assert.match(await text(page, '#incident-header'), /未知/);
    assert.match(await text(page, '#guardrail'), /证据链中断/);
    assert.match(await text(page, '#guardrail'), /不能解释为健康/);
    await page.click("[data-module='logs']");
    assert.match(await text(page, '#context-chips'), /HE-1047/);
    assert.match(await text(page, '#context-chips'), /member-service/);
    assert.match(await text(page, '.lens-tab.is-active'), /日志模式/);
    assert.match(await text(page, '#lens-content'), /最后一条可用日志距今 23 分钟/);
    await page.screenshot({ path: path.join(evidenceDir, '02-unknown-guardrail.png'), fullPage: true });

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.reload({ waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('#ai-panel', (node) => node.classList.contains('is-open')), true);
    await page.click('#ai-panel .ai-toggle');
    assert.equal(await page.$eval('#ai-panel', (node) => node.classList.contains('is-open')), false);
    await page.evaluate(() => new Promise((resolve) => window.setTimeout(resolve, 300)));
    assert.equal(
      await page.$eval('#ai-panel', (node) => node.getBoundingClientRect().left >= window.innerWidth - 2),
      true,
    );
    assert.match(await text(page, '#context-chips'), /HE-1042/);
    await page.screenshot({ path: path.join(evidenceDir, '03-mobile-investigation.png'), fullPage: true });

    assert.deepEqual(browserErrors, []);
    console.log(`BROWSER_SMOKE_OK screenshots=${evidenceDir}`);
  } finally {
    await browser.close();
  }
}

await main();
