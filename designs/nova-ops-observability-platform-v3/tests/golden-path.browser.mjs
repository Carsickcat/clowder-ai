import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5290/";
const executablePath =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const evidenceDir = resolve(import.meta.dirname, "..", "evidence");
mkdirSync(evidenceDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const failures = [];

async function trackedPage(context) {
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  return page;
}

async function openQueueObject(page, objectId) {
  await page.locator(".sre-queue-row", { hasText: objectId }).click();
}

async function desktopJourneys() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await trackedPage(context);
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  await page.locator('[data-screen="SreHome"]').waitFor();
  await page.getByRole("heading", { name: "SRE 运行工作台" }).waitFor();
  assert.equal(
    await page.locator(".sre-queue-row").count(),
    4,
    "home must expose four governed object types",
  );
  assert.equal(
    await page.locator(".sre-global-nav button").count(),
    7,
    "global navigation must expose objects plus projection views",
  );
  await page.screenshot({
    path: resolve(evidenceDir, "01-sre-object-queue-desktop.png"),
    fullPage: true,
  });

  await openQueueObject(page, "MIS-61801");
  await page.locator('[data-screen="MissionCommand"]').waitFor();
  await page.locator(".object-rail").waitFor();
  await page.locator(".decision-inspector").waitFor();
  await page.locator(".professional-workbench-tabs").waitFor();
  await page
    .locator('[data-domain-action="mission.frequency.changed"]')
    .first()
    .click();
  await page.getByText("¥126/day", { exact: true }).waitFor();

  await page
    .getByRole("button", { name: "← 返回 SRE 工作台", exact: true })
    .click();
  await openQueueObject(page, "CHG-23841");
  await page.locator('[data-screen="ChangeGuard"]').waitFor();
  await page.getByRole("button", { name: "提议回滚", exact: true }).click();
  await page.getByRole("button", { name: "确认回滚完成 · 等待复验" }).click();
  await page.locator('[data-domain-action="verification.started"]').click();
  await page.locator('[data-domain-action="verification.evaluate"]').click();
  await page.getByText("blocked", { exact: true }).first().waitFor();
  await page
    .locator('[data-domain-action="synthetic.recovery.started"]')
    .click();
  await page.locator('[data-domain-action="synthetic.recovered"]').click();

  await page.getByRole("button", { name: /运行队列/ }).click();
  const unknownJourney = page.locator("tr", { hasText: "订单查询" });
  await unknownJourney.getByText("unknown", { exact: true }).waitFor();

  await page.locator(".sre-global-nav button", { hasText: "Changes" }).click();
  await page.getByRole("button", { name: /比较 Canary/ }).click();
  await page.getByRole("button", { name: "重跑 Gate 并生成结论" }).click();
  await page.getByText("passed", { exact: true }).first().waitFor();
  await page.locator(".object-rail [data-status='passed']").waitFor();
  await page.getByText("Verification passed · Change 可关闭").waitFor();
  assert.equal(
    await page
      .locator(
        ".objective-table [data-status='fail'], .objective-table [data-status='unknown']",
      )
      .count(),
    0,
    "a passed verification cannot retain failed or unknown objectives",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: resolve(evidenceDir, "02-change-object-verification-passed.png"),
    fullPage: true,
  });

  await page.reload({ waitUntil: "networkidle" });
  await openQueueObject(page, "PLAN-312");
  await page.locator('[data-screen="InspectionStudio"]').waitFor();
  const publish = page.locator('[data-domain-action="plan.published"]').first();
  assert.equal(await publish.isDisabled(), true, "NL2 publish starts blocked");
  await page
    .locator('[data-domain-action="plan.gate.permission.resolved"]')
    .click();
  await page
    .locator('[data-domain-action="plan.gate.baseline.resolved"]')
    .click();
  await page.locator('[data-domain-action="plan.replay.completed"]').click();
  await page.locator('[data-domain-action="plan.approved"]').click();
  assert.equal(await publish.isDisabled(), false, "all gates unlock publish");
  await publish.click();
  await page.getByText("Published v2", { exact: true }).first().waitFor();

  await page.reload({ waitUntil: "networkidle" });
  await openQueueObject(page, "CHG-23841");
  await page.getByRole("button", { name: "升级为 Incident 调查" }).click();
  await page.locator('[data-screen="Investigation"]').waitFor();
  await page.getByText("Change · CHG-23841", { exact: true }).waitFor();
  await page.getByRole("button", { name: "logs", exact: true }).click();
  await page
    .getByRole("button", { name: "钉入 Evidence 并生成 Observation" })
    .click();
  const h1 = page.locator(".hypothesis", { hasText: "H1" });
  await h1.getByRole("button", { name: "运行测试" }).click();
  await h1.getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("button", { name: /回写 CHG-23841 Finding/ }).click();
  await page.getByText("FND-8821 已进入 pending action").waitFor();
  await page.getByText(/恢复结论仍由源对象 Verification Run/).waitFor();

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
  await page.getByRole("button", { name: "使用说明" }).click();
  await page
    .getByRole("heading", { name: "如何使用这套 AI 运维平台" })
    .waitFor();
  await page.getByText("四类 SRE 运行对象").waitFor();
  await page.getByRole("button", { name: "关闭" }).click();
  await openQueueObject(page, "PLAN-312");
  await page.locator('[data-screen="InspectionStudio"]').waitFor();
  await page.locator(".object-steps").waitFor();
  await page.locator(".professional-workbench-tabs").waitFor();
  await page.locator(".decision-inspector").waitFor();
  await page.locator(".sre-global-nav").waitFor();
  await page.screenshot({
    path: resolve(evidenceDir, "03-inspection-object-mobile.png"),
    fullPage: true,
  });
  await context.close();
}

try {
  await desktopJourneys();
  await mobileJourney();
  assert.deepEqual(
    failures,
    [],
    `browser console failures:\n${failures.join("\n")}`,
  );
  process.stdout.write(
    "Browser golden paths passed: SRE queue, Mission, Change verification, Inspection, Incident writeback, and mobile, console 0.\n",
  );
} finally {
  await browser.close();
}
