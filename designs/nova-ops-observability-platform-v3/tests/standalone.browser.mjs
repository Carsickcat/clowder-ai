import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

const executablePath =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const artifactPath = path.resolve(
  import.meta.dirname,
  "..",
  "NOVA-Ops-Intelligence-Standalone.html",
);
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const devtools = await context.newCDPSession(page);
const browserErrors = [];
const networkRequests = [];

await devtools.send("Runtime.enable");
devtools.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
  browserErrors.push(
    `cdp: ${exceptionDetails.text} at ${exceptionDetails.url}:${exceptionDetails.lineNumber + 1}:${exceptionDetails.columnNumber + 1}`,
  );
});

page.on("console", (message) => {
  if (message.type() === "error") {
    browserErrors.push(`console: ${message.text()}`);
  }
});
page.on("pageerror", (error) => {
  browserErrors.push(`pageerror: ${error.stack || error.message}`);
});
page.on("request", (request) => {
  if (/^https?:/i.test(request.url())) {
    networkRequests.push(request.url());
  }
});

try {
  await page.goto(pathToFileURL(artifactPath).href, { waitUntil: "load" });
  try {
    await page
      .locator('[data-screen="change-inspection"]')
      .waitFor({ timeout: 5_000 });
  } catch (error) {
    const body = await page.locator("body").innerText();
    throw new Error(
      `Standalone application did not render.\n${browserErrors.join("\n")}\nBody: ${body}\n${error.message}`,
    );
  }

  assert.equal(await page.title(), "NOVA Ops · AI 可观测平台");
  await page
    .getByText("所有数据均为演示，不会触发真实生产动作", { exact: true })
    .waitFor();
  assert.ok(
    (await page.getByText("NOVA · 变更巡检", { exact: true }).count()) > 0,
    "the reviewed change-inspection product must render",
  );

  await page
    .getByLabel("描述巡检需求")
    .fill("请检查 inventory-service v2.4 是否可以灰度");
  await page.getByRole("button", { name: "生成巡检方案" }).click();
  await page.getByRole("heading", { name: "inventory-service v2.4" }).waitFor();

  const layout = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  assert.ok(
    Math.max(layout.bodyWidth, layout.documentWidth) <= layout.viewportWidth,
    `desktop artifact must not overflow horizontally: ${JSON.stringify(layout)}`,
  );
  assert.deepEqual(networkRequests, [], "offline HTML cannot use the network");
  assert.deepEqual(
    browserErrors,
    [],
    "offline HTML must render without errors",
  );

  process.stdout.write(
    "Standalone browser acceptance passed: file:// launch, NOVA change-inspection render, mock journey interaction, desktop layout, network 0, console 0.\n",
  );
} finally {
  await browser.close();
}
