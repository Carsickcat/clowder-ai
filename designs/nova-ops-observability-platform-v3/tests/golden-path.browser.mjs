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

async function desktopJourneys() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await trackedPage(context);
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  await page.locator('[data-screen="SreHome"]').waitFor();
  await page.getByRole("heading", { name: "当前需要决策" }).waitFor();
  await page.getByRole("heading", { name: "现场脉冲" }).waitFor();
  await page.getByRole("heading", { name: "正在运行" }).waitFor();
  assert.equal(
    await page
      .locator(
        ".sre-home-hero, .sre-posture-grid, .object-entry-section, .role-entry-grid",
      )
      .count(),
    0,
    "home must not render an introduction, role chooser, or secondary object navigator",
  );
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
    path: resolve(evidenceDir, "01-v6-operational-cockpit-desktop.png"),
    fullPage: true,
  });

  await openQueueObject(page, "MIS-61801");
  await page.locator('[data-screen="MissionCommand"]').waitFor();
  await page.locator('[data-workspace-layout="command"]').waitFor();
  await page.locator(".object-rail").waitFor();
  await page.locator(".decision-inspector").waitFor();
  await page.locator(".professional-workbench-tabs").waitFor();
  await page.screenshot({
    path: resolve(evidenceDir, "05-v6-mission-command-desktop.png"),
    fullPage: true,
  });
  await page
    .locator('[data-domain-action="mission.frequency.changed"]')
    .first()
    .click();
  await page.getByText("¥126/day", { exact: true }).waitFor();
  await page.getByRole("button", { name: "升级为 Incident 调查" }).click();
  await page.locator('[data-screen="Investigation"]').waitFor();
  await page.locator('[data-workspace-layout="forensics"]').waitFor();
  await page.screenshot({
    path: resolve(evidenceDir, "06-v6-incident-forensics-desktop.png"),
    fullPage: true,
  });
  const missionH1 = page.locator(".hypothesis", { hasText: "H1" });
  await missionH1.getByRole("button", { name: "运行测试" }).click();
  await missionH1.getByRole("button", { name: "Confirm" }).click();
  await page
    .locator(".decision-inspector")
    .getByRole("button", { name: /回写 MIS-61801 Finding/ })
    .click();
  await page.getByText("FND-8832 已进入 pending action").waitFor();
  await page.getByRole("button", { name: /返回 MIS-61801/ }).click();
  await page.locator('[data-screen="MissionCommand"]').waitFor();
  await page
    .getByRole("button", {
      name: "记录整改回执 → 进入源对象复验",
      exact: true,
    })
    .click();
  await page.getByText(/整改回执 RR-\d+ 已绑定源 Finding/).waitFor();

  await page
    .getByRole("button", { name: "← 返回 SRE 工作台", exact: true })
    .click();
  await openQueueObject(page, "CHG-23841");
  await page.locator('[data-screen="ChangeGuard"]').waitFor();
  await page.locator('[data-workspace-layout="validation"]').waitFor();
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
    path: resolve(evidenceDir, "02-v6-change-verification-passed.png"),
    fullPage: true,
  });
  await page.locator(".sre-global-nav button", { hasText: "Reports" }).click();
  await page
    .locator(".report-index-item", { hasText: "RPT-CHG-23841" })
    .click();
  await page.getByRole("button", { name: "已在源对象解决" }).first().waitFor();
  await page
    .locator(".report-finding-table", { hasText: "已在源对象解决" })
    .waitFor();

  await page.reload({ waitUntil: "networkidle" });
  await openQueueObject(page, "PLAN-312");
  await page.locator('[data-screen="InspectionStudio"]').waitFor();
  await page.locator('[data-workspace-layout="compiler"]').waitFor();
  await page.screenshot({
    path: resolve(evidenceDir, "07-v6-inspection-compiler-desktop.png"),
    fullPage: true,
  });
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
  await page
    .locator(".decision-inspector")
    .getByRole("button", { name: "进入 Change Guard 记录整改与门禁" })
    .click();
  await page.locator('[data-screen="ChangeGuard"]').waitFor();
  await page.getByRole("button", { name: "确认回滚完成 · 等待复验" }).waitFor();

  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".sre-global-nav button", { hasText: "Reports" }).click();
  await page.locator('[data-screen="ReportsCenter"]').waitFor();
  await page
    .locator(".report-index-item", { hasText: "RPT-CHG-23841" })
    .click();
  await page.getByText(/Run VR-2898/).waitFor();
  await page.screenshot({
    path: resolve(evidenceDir, "04-report-versioned-projection.png"),
    fullPage: true,
  });
  await page
    .locator(".report-finding-table button", { hasText: "FND-8821" })
    .click();
  await page.locator('[data-screen="ChangeGuard"]').waitFor();
  await page.getByText("CHG-23841", { exact: true }).first().waitFor();
  await page.locator(".sre-global-nav button", { hasText: "Reports" }).click();
  await page
    .locator(".report-index-item", { hasText: "RPT-CHG-23841" })
    .click();
  await page.getByRole("button", { name: "请求复验" }).first().click();
  await page
    .getByRole("button", { name: "复验已进入 Change Guard 队列" })
    .first()
    .waitFor();

  await context.close();
}

async function intermediateResponsiveJourneys() {
  const operationalObjects = [
    ["INC-7719", "Investigation"],
    ["CHG-23841", "ChangeGuard"],
    ["MIS-61801", "MissionCommand"],
    ["PLAN-312", "InspectionStudio"],
  ];

  for (const width of [600, 720]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await trackedPage(context);

    for (const [objectId, screen] of operationalObjects) {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await openQueueObject(page, objectId);
      await page.locator(`[data-screen="${screen}"]`).waitFor();
      await assertNoHorizontalOverflow(page, `${objectId} at ${width}px`);
      if (width === 720 && objectId === "INC-7719") {
        await page.screenshot({
          path: resolve(evidenceDir, "08-v6-incident-forensics-720px.png"),
          fullPage: true,
        });
      }
    }

    await context.close();
  }
}

async function mobileJourney() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
  });
  const page = await trackedPage(context);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "当前需要决策" }).waitFor();
  const mobileNav = page.locator(".sre-global-nav");
  const navMetrics = await mobileNav.evaluate((nav) => {
    const navRect = nav.getBoundingClientRect();
    const buttons = [...nav.querySelectorAll("button")].map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        label: button.getAttribute("aria-label"),
        left: rect.left,
        right: rect.right,
        width: rect.width,
      };
    });
    return {
      clientWidth: nav.clientWidth,
      scrollWidth: nav.scrollWidth,
      left: navRect.left,
      right: navRect.right,
      buttons,
    };
  });
  assert.ok(
    navMetrics.scrollWidth <= navMetrics.clientWidth,
    `390px global nav must expose every entry without clipping: ${navMetrics.scrollWidth}px content in ${navMetrics.clientWidth}px rail`,
  );
  assert.deepEqual(
    navMetrics.buttons.filter(
      (button) =>
        button.width < 44 ||
        button.left < navMetrics.left ||
        button.right > navMetrics.right,
    ),
    [],
    "every mobile global-nav target must remain visible and at least 44px wide",
  );
  assert.equal(
    await page
      .locator('.sre-global-nav button[aria-label="Inspections"]')
      .count(),
    1,
    "the compact Inspections entry must retain its full accessible name",
  );
  await page.screenshot({
    path: resolve(evidenceDir, "04-v6-operational-cockpit-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "使用说明" }).click();
  await page
    .getByRole("heading", { name: "如何使用这套 AI 运维平台" })
    .waitFor();
  await page.getByText("四类 SRE 运行对象").waitFor();
  await page.getByRole("button", { name: "关闭" }).click();
  await openQueueObject(page, "PLAN-312");
  await page.locator('[data-screen="InspectionStudio"]').waitFor();
  await page.locator('[data-workspace-layout="compiler"]').waitFor();
  await page.locator(".object-steps").waitFor();
  await page.locator(".professional-workbench-tabs").waitFor();
  await page.locator(".decision-inspector").waitFor();
  await page.locator(".sre-global-nav").waitFor();
  const returnAffordance = page.locator(".journey-home-link");
  assert.equal(
    await returnAffordance.getAttribute("data-ui-role"),
    "secondary-navigation",
  );
  const returnStyles = await returnAffordance.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      borderStyle: styles.borderStyle,
    };
  });
  assert.notEqual(returnStyles.borderStyle, "none");
  assert.notEqual(returnStyles.backgroundColor, "rgba(0, 0, 0, 0)");

  const tabStyles = await page
    .locator(".professional-workbench-tabs")
    .evaluate((tabs) => ({
      scrollSnapType: getComputedStyle(tabs).scrollSnapType,
      buttonWhiteSpace: [...tabs.querySelectorAll("button")].map(
        (button) => getComputedStyle(button).whiteSpace,
      ),
    }));
  assert.match(tabStyles.scrollSnapType, /x/);
  assert.ok(
    tabStyles.buttonWhiteSpace.every((value) => value === "nowrap"),
    "professional workspace tabs must remain on one readable line",
  );
  await page.screenshot({
    path: resolve(evidenceDir, "03-v6-inspection-mobile.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: resolve(evidenceDir, "09-v6-mobile-navigation-polish.png"),
    fullPage: true,
  });
  await context.close();
}

try {
  await desktopJourneys();
  await intermediateResponsiveJourneys();
  await mobileJourney();
  assert.deepEqual(
    failures,
    [],
    `browser console failures:\n${failures.join("\n")}`,
  );
  process.stdout.write(
    "Browser golden paths passed: SRE queue, source-specific Mission/Change remediation, Change verification, Inspection, current-state Report deep-link/reverification, and mobile, console 0.\n",
  );
} finally {
  await browser.close();
}
