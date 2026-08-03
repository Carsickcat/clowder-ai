import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer';

const baseUrl = process.env.NOVA_ACCEPTANCE_URL ?? 'http://127.0.0.1:5184';
const evidenceDir = resolve(process.env.NOVA_ACCEPTANCE_EVIDENCE_DIR ?? 'data/nova-acceptance-evidence');
const userId = process.env.NOVA_ACCEPTANCE_USER_ID ?? `nova-acceptance-${process.pid}-${Date.now()}`;
const pageUrl = `${baseUrl}/observability/inspections?userId=${encodeURIComponent(userId)}`;
const recoveryOnly = process.argv.includes('--recovery-only');

await mkdir(evidenceDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
const consoleErrors = [];
const failedRequests = [];
const expectedApiFailures = [];
const expectedApiConsoleErrors = [];
let intentionalApiFailure = false;

page.on('console', (message) => {
  if (message.type() !== 'error') return;
  const location = message.location();
  const detail = `${message.text()} ${location.url ?? ''}`.trim();
  if (
    intentionalApiFailure &&
    location.url?.includes('/api/observability/') &&
    message.text() === 'Failed to load resource: net::ERR_FAILED'
  ) {
    expectedApiConsoleErrors.push(detail);
  } else {
    consoleErrors.push(detail);
  }
});
page.on('requestfailed', (request) => {
  const detail = `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`;
  if (intentionalApiFailure && request.url().includes('/api/observability/')) {
    expectedApiFailures.push(detail);
  } else {
    failedRequests.push(detail);
  }
});

async function screenshot(name) {
  await page.screenshot({ path: resolve(evidenceDir, `${name}.png`), fullPage: true });
}

async function waitUntilIdle() {
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('aria-busy') === 'false');
}

async function clickAndWaitForRun(expectedCount) {
  await page.click('[data-testid="start-run"]');
  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid="inspection-timeline"] li').length >= count,
    {},
    expectedCount,
  );
  await waitUntilIdle();
}

try {
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(pageUrl, { waitUntil: 'networkidle0' });
  await waitUntilIdle();
  assert.match(
    await page.$eval('[data-testid="runtime-environment-banner"]', (node) => node.textContent ?? ''),
    /DEV LOCAL/,
  );
  if (recoveryOnly) {
    await page.waitForSelector('[data-testid="report-intelligence"]');
    const recoveredReport = await page.$eval('[data-testid="immutable-report"]', (node) => node.textContent ?? '');
    assert.match(recoveredReport, /不可变报告/);
    assert.match(recoveredReport, /nova-report-score-v2/);
    await screenshot('06-recovered-after-process-restart-1440');
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(failedRequests, []);
    process.stdout.write(`${JSON.stringify({ baseUrl, evidenceDir, userId, recoveredAfterProcessRestart: true })}\n`);
  } else {
    assert.equal(await page.$('[data-testid="immutable-report"]'), null);
    await screenshot('01-empty-1440');

    await page.click('[data-testid="generate-candidates"]');
    await page.waitForSelector('[data-testid="materialize-candidates"]');
    await waitUntilIdle();
    assert.match(await page.$eval('main', (node) => node.textContent ?? ''), /未覆盖依赖/);
    assert.equal(await page.$eval('main', (node) => node.getAttribute('data-runtime-state')), 'partial');
    await screenshot('02-partial-plan-1440');

    await page.click('[data-testid="materialize-candidates"]');
    await page.waitForFunction(() => (document.querySelector('main')?.textContent ?? '').includes('巡检编号'));
    await waitUntilIdle();

    await clickAndWaitForRun(1);
    await clickAndWaitForRun(2);
    await clickAndWaitForRun(3);
    await page.waitForSelector('[data-testid="accept-report"]:not([disabled])');
    await page.click('[data-testid="accept-report"]');
    await page.waitForSelector('[data-testid="report-intelligence"]');
    await waitUntilIdle();

    const reportText = await page.$eval('[data-testid="report-intelligence"]', (node) => node.textContent ?? '');
    assert.match(reportText, /nova-report-score-v2/);
    assert.match(reportText, /方案覆盖诚实度/);
    assert.match(reportText, /风险闭环度/);
    const completedText = await page.$eval('main', (node) => node.textContent ?? '');
    assert.match(completedText, /sha256:/);
    assert.match(completedText, /Fixture 固化时间/);
    assert.match(completedText, /固定 fixture/);
    await screenshot('03-completed-report-1440');

    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="report-intelligence"]');
    await waitUntilIdle();
    assert.match(await page.$eval('[data-testid="immutable-report"]', (node) => node.textContent ?? ''), /不可变报告/);

    for (const width of [720, 390]) {
      await page.setViewport({ width, height: width === 390 ? 844 : 1000, deviceScaleFactor: 1 });
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-testid="report-intelligence"]');
      await waitUntilIdle();
      const layout = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        taskOrder: getComputedStyle(document.querySelector('[data-testid="inspection-job-platform"]')).order,
        detailOrder: getComputedStyle(document.querySelector('[data-testid="inspection-decision-surface"]')).order,
        clawOrder: getComputedStyle(document.querySelector('[data-testid="inspection-claw-panel"]')).order,
      }));
      assert.ok(layout.scrollWidth <= layout.innerWidth, `${width}px viewport has horizontal overflow`);
      if (width === 390) {
        assert.deepEqual([layout.taskOrder, layout.detailOrder, layout.clawOrder], ['1', '2', '3']);
      }
      await screenshot(`04-completed-report-${width}`);
    }

    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('/api/observability/')) void request.abort('failed');
      else void request.continue();
    });
    intentionalApiFailure = true;
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() =>
      (document.querySelector('main')?.textContent ?? '').includes('不会回退到演示数据'),
    );
    assert.equal(await page.$eval('main', (node) => node.getAttribute('data-runtime-state')), 'error');
    await screenshot('05-connected-error-390');

    assert.ok(expectedApiFailures.length > 0, 'the degraded journey must exercise an actual API failure');
    assert.equal(
      expectedApiConsoleErrors.length,
      expectedApiFailures.length,
      'only the resource errors caused by the expected aborted API requests may be exempted',
    );
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(failedRequests, []);
    process.stdout.write(
      `${JSON.stringify({
        baseUrl,
        evidenceDir,
        userId,
        consoleErrors: consoleErrors.length,
        failedRequests: failedRequests.length,
        expectedApiFailures: expectedApiFailures.length,
        expectedApiConsoleErrors: expectedApiConsoleErrors.length,
        states: ['empty', 'partial', 'completed', 'error'],
        viewports: [1440, 720, 390],
      })}\n`,
    );
  }
} catch (error) {
  const diagnostic = {
    url: page.url(),
    runtimeState: await page.$eval('main', (node) => node.getAttribute('data-runtime-state')).catch(() => null),
    text: await page.$eval('main', (node) => (node.textContent ?? '').slice(0, 2_000)).catch(() => ''),
    consoleErrors,
    failedRequests,
    expectedApiFailures,
    expectedApiConsoleErrors,
  };
  await screenshot('99-failure');
  process.stderr.write(`${JSON.stringify(diagnostic)}\n`);
  throw error;
} finally {
  await browser.close();
}
