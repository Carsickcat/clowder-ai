import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { launchOfflineChrome } from "./cdp-client.mjs";

const rootDirectory = path.resolve(import.meta.dirname, "..");
const artifactPath = path.join(
  rootDirectory,
  "index.html",
);
const evidenceDirectory = path.join(rootDirectory, "evidence");
const recordEvidence = process.argv.includes("--evidence");

async function click(session, selector) {
  const clicked = await session.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element || element.disabled) return false;
    element.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Expected clickable element ${selector}`);
}

async function bodyText(session) {
  return session.evaluate("document.body.innerText");
}

async function screenshot(session, fileName) {
  if (!recordEvidence) return;
  await mkdir(evidenceDirectory, { recursive: true });
  const image = await session.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  await writeFile(
    path.join(evidenceDirectory, fileName),
    Buffer.from(image.data, "base64"),
  );
}

async function advanceExecution(session) {
  for (let index = 0; index < 4; index += 1) {
    await click(session, '[data-action="EXECUTION_ADVANCED"]');
  }
}

async function main() {
  await readFile(artifactPath);
  const browser = await launchOfflineChrome();
  const { session } = browser;
  const networkRequests = [];
  const browserErrors = [];

  try {
    session.on("Network.requestWillBeSent", ({ request }) => {
      if (/^https?:/i.test(request.url)) networkRequests.push(request.url);
    });
    session.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
      browserErrors.push(exceptionDetails.text);
    });
    session.on("Log.entryAdded", ({ entry }) => {
      if (entry.level === "error") browserErrors.push(entry.text);
    });
    await Promise.all([
      session.send("Page.enable"),
      session.send("Runtime.enable"),
      session.send("Network.enable"),
      session.send("Log.enable"),
      session.send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      }),
    ]);

    const loaded = session.once("Page.loadEventFired");
    await session.send("Page.navigate", {
      url: pathToFileURL(artifactPath).href,
    });
    await loaded;

    let text = await bodyText(session);
    assert.match(text, /自然语言巡检/);
    assert.match(text, /今晚升级 order-api v4\.8\.0/);

    await click(session, '[data-action="INPUT_CONFIRMED"]');
    await click(session, '[data-action="SCOPE_ACCEPTED"]');
    text = await bodyText(session);
    assert.match(text, /order\.submit\.success_rate/);
    await click(session, '[data-action="PLAN_CONFIRMED"]');
    await advanceExecution(session);
    text = await bodyText(session);
    assert.match(text, /Proceed/);
    assert.match(text, /Verified/);
    assert.match(text, /声明范围内未发现异常退化/);
    await screenshot(session, "01-natural-language-proceed.png");

    await click(session, '[data-scenario-id="change-ticket-risk"]');
    await click(session, '[data-action="INPUT_CONFIRMED"]');
    text = await bodyText(session);
    assert.match(text, /支付确认 → 账单异步/);
    assert.match(text, /payment\.confirm\.success_rate/);
    assert.match(text, /payment-api → settlement-db/);
    assert.match(text, /settlement-db · Redis · invoice queue/);
    await screenshot(session, "04-impact-dimensions.png");
    await click(session, '[data-action="SCOPE_ACCEPTED"]');
    text = await bodyText(session);
    assert.match(text, /Observed-Superset/);
    assert.match(text, /invoice-worker/);
    assert.match(text, /settlement-db/);
    assert.equal(
      await session.evaluate(
        'document.querySelector(\'[data-testid="plan-stat-required"] strong\').textContent',
      ),
      "3",
    );
    assert.equal(
      await session.evaluate(
        'document.querySelector(\'[data-testid="plan-stat-pending"] strong\').textContent',
      ),
      "1",
    );
    assert.equal(
      await session.evaluate(
        'document.querySelector(\'[data-action="PLAN_CONFIRMED"]\').disabled',
      ),
      true,
    );

    await click(
      session,
      '[data-action="CANDIDATE_DISPOSED"][data-disposition="accepted"]',
    );
    assert.equal(
      await session.evaluate(
        'document.querySelector(\'[data-action="PLAN_CONFIRMED"]\').disabled',
      ),
      false,
    );
    assert.equal(
      await session.evaluate(
        'document.querySelector(\'[data-testid="plan-stat-recommended"] strong\').textContent',
      ),
      "1",
    );
    assert.equal(
      await session.evaluate(
        'document.querySelector(\'[data-testid="plan-stat-pending"] strong\').textContent',
      ),
      "0",
    );
    await click(session, ".check-card summary");
    const sourceDetail = await session.evaluate(
      "document.querySelector('.check-card[open] .check-sources').innerText",
    );
    assert.match(sourceDetail, /电子流/);
    assert.match(sourceDetail, /CHG-84217/);
    await screenshot(session, "05-plan-contract-expanded.png");
    await click(session, '[data-action="PLAN_CONFIRMED"]');
    await advanceExecution(session);
    text = await bodyText(session);
    assert.match(text, /建议暂停在 25% 灰度/);
    assert.match(text, /Violated/);
    assert.match(text, /Pause/);
    await click(session, '[data-action="RC_TOGGLED"]');
    text = await bodyText(session);
    assert.match(text, /共享配置包将 DB 连接池上限从 120 降为 60/);
    await screenshot(session, "02-electronic-flow-pause.png");

    await session.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    assert.equal(
      await session.evaluate(
        "document.documentElement.scrollWidth <= window.innerWidth + 1",
      ),
      true,
      "mobile layout must not overflow horizontally",
    );
    await screenshot(session, "03-mobile-report.png");

    assert.deepEqual(networkRequests, []);
    assert.deepEqual(browserErrors, []);
    process.stdout.write(
      "Offline browser acceptance passed: 2 journeys, 0 network requests, 0 browser errors.\n",
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
