import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import puppeteer from 'puppeteer';

const baseUrl = process.env.AIOPS_PROTOTYPE_URL ?? 'http://127.0.0.1:5278/';
const evidenceDir = path.join(os.tmpdir(), 'cat-cafe-evidence', 'aiops-unified-workbench-v2');

async function text(page, selector) {
  return page.$eval(selector, (node) => node.textContent.replace(/\s+/g, ' ').trim());
}

async function completeJourney(page, scenarioId, decisionId) {
  await page.click(`[data-scenario-id='${scenarioId}']`);
  const actions = await page.$$eval('[data-step-index]', (nodes) => nodes.length);
  for (let index = 0; index < actions; index += 1) {
    assert.equal(await page.$eval('.journey-step.is-active', (node) => Number(node.dataset.stepIndex)), index);
    await page.click('[data-complete-step]');
  }
  await page.click(`[data-decision-id='${decisionId}']`);
  await page.click('[data-finish-journey]');
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
    assert.match(await page.title(), /场景驱动 AI 运维工作台/);
    assert.equal(await page.$$eval('[data-scenario-id]', (nodes) => nodes.length), 3);
    assert.match(await text(page, '.home-hero'), /更快做出可信决策/);
    assert.match(await text(page, '.scenario-grid'), /发布后健康验证/);
    assert.match(await text(page, '.scenario-grid'), /告警风暴故障处置/);
    assert.match(await text(page, '.scenario-grid'), /关键服务日巡治理/);
    await page.click('[data-toggle-capabilities]');
    assert.equal(await page.$eval('.capability-map', (node) => node.classList.contains('is-open')), true);
    assert.match(await text(page, '.capability-chain'), /Observe/);
    assert.match(await text(page, '.capability-chain'), /Verify/);
    await page.screenshot({ path: path.join(evidenceDir, '01-capability-and-scenarios.png'), fullPage: true });

    await page.click("[data-scenario-id='release']");
    assert.match(await text(page, '.journey-rail'), /发布负责人/);
    assert.match(await text(page, '.context-strip'), /checkout-service/);
    assert.match(await text(page, '.context-strip'), /release-2026\.07\.22-rc3/);
    assert.equal(await page.$eval('.module-canvas', (node) => node.dataset.module), 'checks');

    const moduleProof = {
      metrics: '发布前后、灰度组与对照组',
      alerts: 'AI 归并建议，人确认事件边界',
      logs: '从成千上万条日志收敛到可比较模式',
      checks: 'AI 生成候选，人审核后才能运行',
      synthetics: '用户究竟在哪一步失败',
    };
    for (const [module, expected] of Object.entries(moduleProof)) {
      await page.click(`button[data-module='${module}']`);
      assert.equal(await page.$eval('.module-canvas', (node) => node.dataset.module), module);
      assert.match(await text(page, '.module-canvas'), new RegExp(expected));
      assert.match(await text(page, '.context-strip'), /checkout-service/);
      await page.screenshot({ path: path.join(evidenceDir, `module-${module}.png`), fullPage: true });
    }
    await page.click("button[data-module='logs']");
    await page.click("[data-focus-id='LOG-CONFIG-120-40']");
    assert.match(await text(page, '.pattern-row.is-selected'), /pool\.maxConnections/);
    await page.click('[data-return-to-journey]');
    await page.click('[data-ai-verdict="accepted"]');
    assert.equal(
      await page.$eval('[data-ai-verdict="accepted"]', (node) => node.classList.contains('is-active')),
      true,
    );

    await page.click('[data-complete-step]');
    assert.equal(await page.$eval('.module-canvas', (node) => node.dataset.module), 'metrics');
    await page.click('[data-complete-step]');
    assert.equal(await page.$eval('.module-canvas', (node) => node.dataset.module), 'synthetics');
    await page.click('[data-complete-step]');
    assert.equal(await page.$eval('.module-canvas', (node) => node.dataset.module), 'logs');
    await page.click('[data-complete-step]');
    assert.equal(await page.$eval('.module-canvas', (node) => node.dataset.module), 'decision');
    await page.click('[data-complete-step]');
    await page.click("[data-decision-id='pause_release']");
    await page.click('[data-finish-journey]');
    assert.match(await text(page, '.journey-outcome'), /暂停扩量并修复/);
    assert.match(await text(page, '.journey-outcome'), /6 次/);
    assert.match(await text(page, '.journey-outcome'), /7 min/);
    await page.screenshot({ path: path.join(evidenceDir, '02-release-outcome.png'), fullPage: true });

    await page.click('[data-go-home]');
    await completeJourney(page, 'incident', 'run_controlled_playbook');
    assert.match(await text(page, '.journey-outcome'), /执行受控 Runbook/);
    assert.match(await text(page, '.journey-outcome'), /31 alerts → 1 incident/);
    await page.screenshot({ path: path.join(evidenceDir, '03-incident-outcome.png'), fullPage: true });

    await page.click('[data-go-home]');
    await page.click("[data-scenario-id='inspection']");
    for (let index = 0; index < 5; index += 1) await page.click('[data-complete-step]');
    await page.click("[data-decision-id='mark_healthy']");
    await page.click('[data-finish-journey]');
    assert.match(await text(page, '.decision-guardrail'), /unknown 覆盖尚未恢复/);
    assert.equal(await page.$('.journey-outcome'), null);
    await page.click("[data-decision-id='publish_with_unknown']");
    await page.click('[data-finish-journey]');
    assert.match(await text(page, '.journey-outcome'), /带 unknown 发布治理报告/);
    assert.match(await text(page, '.journey-outcome'), /14 \/ 18 conclusive/);
    await page.screenshot({ path: path.join(evidenceDir, '04-inspection-unknown-honest-report.png'), fullPage: true });

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.goto(baseUrl, { waitUntil: 'networkidle0' });
    assert.equal(await page.$$eval('[data-scenario-id]', (nodes) => nodes.length), 3);
    await page.click("[data-scenario-id='incident']");
    await page.click('[data-toggle-mobile-journey]');
    assert.equal(await page.$eval('.journey-rail', (node) => node.classList.contains('is-mobile-open')), true);
    await page.click('.journey-rail [data-toggle-mobile-journey]');
    assert.equal(await page.$eval('#ai-inspector', (node) => node.classList.contains('is-open')), false);
    await page.click('.mobile-ai-trigger');
    assert.equal(await page.$eval('#ai-inspector', (node) => node.classList.contains('is-open')), true);
    await page.click('#ai-inspector [data-toggle-ai]');
    assert.equal(await page.$eval('#ai-inspector', (node) => node.classList.contains('is-open')), false);
    await page.click('.mobile-ai-trigger');
    await page.screenshot({ path: path.join(evidenceDir, '05-mobile-incident.png'), fullPage: true });

    assert.deepEqual(browserErrors, []);
    console.log(`BROWSER_SMOKE_OK screenshots=${evidenceDir}`);
  } finally {
    await browser.close();
  }
}

await main();
