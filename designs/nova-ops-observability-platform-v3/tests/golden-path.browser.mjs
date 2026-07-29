import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.BASE_URL || "http://localhost:5290/";
const executablePath =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const recordEvidence = process.argv.includes("--record-evidence");
const evidenceDir = process.env.EVIDENCE_DIR
  ? resolve(process.env.EVIDENCE_DIR)
  : recordEvidence
    ? resolve(import.meta.dirname, "..", "evidence")
    : resolve(tmpdir(), "nova-ops-browser-evidence");
mkdirSync(evidenceDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const failures = [];
const prompt = "请帮我巡检 payments-router v3.18.0 是否可以灰度发布";

async function trackedPage(context) {
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  return page;
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  const renderedWidth = Math.max(metrics.documentWidth, metrics.bodyWidth);
  assert.ok(
    renderedWidth <= metrics.viewportWidth,
    `${label} must not overflow horizontally: ${renderedWidth}px rendered in ${metrics.viewportWidth}px viewport`,
  );
}

async function capture(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(evidenceDir, name),
    fullPage: true,
  });
}

async function submitIntent(page) {
  const input = page.getByLabel("描述巡检需求");
  await input.fill(prompt);
  await page.getByRole("button", { name: "生成巡检方案" }).click();
  await page.getByTestId("inspection-plan").waitFor();
  await page.getByText("5/5 风险面已覆盖", { exact: true }).waitFor();
}

async function finishJourney(page) {
  await page.getByRole("button", { name: "确认方案并执行变更前巡检" }).click();
  await page.getByText("可以进入 25% 灰度", { exact: true }).waitFor();
  assert.equal(await page.locator(".ci-run-item").count(), 1);

  await page.getByRole("button", { name: "批准进入 25% 灰度" }).click();
  await page.getByText("暂停在 25% 灰度", { exact: true }).waitFor();
  await page.getByText("连接池在灰度实例出现排队", { exact: true }).waitFor();

  await page.getByRole("button", { name: "记录处置" }).click();
  await page
    .getByText("已记录处置：连接池上限 80 → 120", { exact: true })
    .waitFor();
  assert.equal(
    await page.locator(".ci-run-item").count(),
    2,
    "recording remediation must not silently execute verification",
  );
  await page.getByRole("button", { name: "执行复验" }).click();
  await page.getByText("可以继续到 100% 放量", { exact: true }).waitFor();
  assert.equal(
    await page.locator(".ci-run-item").count(),
    3,
    "remediation must create a new verification run without rewriting the risk run",
  );

  await page.getByRole("button", { name: "继续到 100% 放量" }).click();
  await page.getByText("进入变更后验收", { exact: true }).waitFor();
  await page.getByRole("button", { name: "执行变更后验收" }).click();
  await page.getByTestId("final-report").waitFor();
  await page.getByText("本次变更验收通过", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "请 Claw 解读最终报告" }).click();
  await page.getByText(/风险已完成复验/).waitFor();
  assert.equal(await page.locator(".ci-run-item").count(), 5);
  assert.equal(
    await page.locator(".ci-run-item-risk").count(),
    1,
    "the final report must retain the historical risk run",
  );
}

async function desktopJourney() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await trackedPage(context);
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  await page.locator('[data-screen="change-inspection"]').waitFor();
  await page.getByRole("heading", { name: "待识别服务 待识别版本" }).waitFor();
  await page.getByText("变更前准入", { exact: true }).waitFor();
  await page.getByText("灰度持续验证", { exact: true }).waitFor();
  await page.getByText("变更后验收", { exact: true }).waitFor();
  assert.equal(
    await page.locator(".sre-global-nav, .side-nav, .primary-nav").count(),
    0,
    "the change journey must not render the old product menu",
  );
  assert.equal(
    await page.getByRole("button", { name: "生成巡检方案" }).isDisabled(),
    true,
    "the example prompt cannot be submitted without explicit user input",
  );
  await assertNoHorizontalOverflow(page, "desktop initial state");
  await capture(page, "01-change-inspection-request-desktop.png");

  await submitIntent(page);
  await page.locator(".ci-demo-controls summary").click();
  await page.getByRole("button", { name: "模拟基线不可比" }).click();
  await page
    .getByRole("heading", { name: "基线不可比，不能执行准入判定" })
    .waitFor();
  assert.equal(
    await page.locator('[data-domain-action="PLAN_CONFIRMED"]').count(),
    0,
    "an incomparable baseline must remove the admission action",
  );
  await page.getByText("Claw 需要补充", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("Claw 已完成", { exact: true }).count(),
    0,
    "Claw cannot claim completion while the baseline is incomparable",
  );
  await capture(page, "02-change-inspection-unknown-desktop.png");

  await page.getByRole("button", { name: "补充可比基线并重新判定" }).click();
  await page.getByText("基线可比性已恢复", { exact: true }).waitFor();
  await capture(page, "03-change-inspection-plan-desktop.png");

  await page.getByRole("button", { name: "确认方案并执行变更前巡检" }).click();
  await page.getByText("可以进入 25% 灰度", { exact: true }).waitFor();
  await page.getByRole("button", { name: "批准进入 25% 灰度" }).click();
  await page.getByText("暂停在 25% 灰度", { exact: true }).waitFor();
  await capture(page, "04-change-inspection-canary-risk-desktop.png");

  await page.getByRole("button", { name: "记录处置" }).click();
  await page
    .getByText("已记录处置：连接池上限 80 → 120", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "执行复验" }).click();
  await page.getByText("可以继续到 100% 放量", { exact: true }).waitFor();
  await page.getByRole("button", { name: "继续到 100% 放量" }).click();
  await page.getByRole("button", { name: "执行变更后验收" }).click();
  await page.getByTestId("final-report").waitFor();
  assert.equal(await page.locator(".ci-run-item").count(), 5);
  await capture(page, "05-change-inspection-report-desktop.png");

  await assertNoHorizontalOverflow(page, "desktop completed state");
  await context.close();
}

async function mobileJourney() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
  });
  const page = await trackedPage(context);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator('[data-screen="change-inspection"]').waitFor();

  const decisionBox = await page
    .locator(".inspection-decision-column")
    .boundingBox();
  const clawBox = await page.locator(".inspection-claw-column").boundingBox();
  assert.ok(
    decisionBox && clawBox && decisionBox.y < clawBox.y,
    "mobile must show the current decision before the Claw conversation",
  );
  await assertNoHorizontalOverflow(page, "390px initial state");

  await submitIntent(page);
  await finishJourney(page);
  await assertNoHorizontalOverflow(page, "390px completed state");
  await capture(page, "06-change-inspection-report-mobile.png");
  await context.close();
}

async function customServiceJourney() {
  const context = await browser.newContext({
    viewport: { width: 720, height: 900 },
  });
  const page = await trackedPage(context);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator('[data-screen="change-inspection"]').waitFor();
  await page
    .getByLabel("描述巡检需求")
    .fill("请检查 inventory-service v2.4 是否可以灰度");
  await page.getByRole("button", { name: "生成巡检方案" }).click();
  await page.getByRole("heading", { name: "inventory-service v2.4" }).waitFor();
  await page
    .getByText("inventory-service.business.success.rate", { exact: true })
    .waitFor();
  await assertNoHorizontalOverflow(page, "720px plan state");
  await finishJourney(page);
  await page.getByRole("heading", { name: "inventory-service v2.4" }).waitFor();
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /支付成功率|支付回调/,
    "custom-service execution cannot leak payments-router evidence",
  );
  await assertNoHorizontalOverflow(page, "720px completed custom service");
  await context.close();
}

async function clarificationCheck() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await trackedPage(context);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByLabel("描述巡检需求").fill("请帮我检查支付服务");
  await page.getByRole("button", { name: "生成巡检方案" }).click();
  await page.getByRole("heading", { name: "还缺少服务名或版本号" }).waitFor();
  await page.getByText("方案尚未生成", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("5/5 风险面已覆盖", { exact: true }).count(),
    0,
    "clarification state cannot claim complete risk coverage",
  );
  assert.equal(
    await page.getByText("基线可比", { exact: true }).count(),
    0,
    "clarification state cannot claim a comparable baseline",
  );
  await assertNoHorizontalOverflow(page, "clarification state");
  await context.close();
}

try {
  await desktopJourney();
  await customServiceJourney();
  await clarificationCheck();
  await mobileJourney();
  assert.deepEqual(
    failures,
    [],
    `browser console failures:\n${failures.join("\n")}`,
  );
  process.stdout.write(
    "Browser golden paths passed: Chinese single journey, custom-service evidence truth, clarification and unknown blockers, pre-change admission, canary verification, post-change report, desktop/720/mobile, console 0.\n",
  );
} finally {
  await browser.close();
}
