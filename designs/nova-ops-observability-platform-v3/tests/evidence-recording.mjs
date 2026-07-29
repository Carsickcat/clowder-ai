import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.BASE_URL || "http://localhost:5290/";
const executablePath =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const evidenceDir = resolve(import.meta.dirname, "..", "evidence");
const videoTemp = resolve(evidenceDir, ".video-temp");
mkdirSync(videoTemp, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoTemp, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const video = page.video();

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.locator(".sre-queue-row", { hasText: "MIS-61801" }).click();
await page.waitForTimeout(2000);
await page
  .locator('[data-domain-action="mission.frequency.changed"]')
  .first()
  .click();
await page.waitForTimeout(1200);
await page.locator(".journey-home-link").click();
await page.waitForTimeout(1000);
await page.locator(".sre-queue-row", { hasText: "CHG-23841" }).click();
await page.waitForTimeout(2000);
await page.locator('[data-domain-action="incident.escalated"]').click();
await page.waitForTimeout(1800);
const h1 = page.locator(".hypothesis", { hasText: "H1" });
await h1.locator('[data-domain-action="hypothesis.test.completed"]').click();
await h1.locator('[data-domain-action="hypothesis.confirmed"]').click();
await page.waitForTimeout(1500);
await page
  .locator(".decision-inspector")
  .locator('[data-domain-action="change.decision.set"]')
  .click();
await page.waitForTimeout(4900);

await context.close();
await video.saveAs(
  resolve(evidenceDir, "nova-ops-v6-sre-cockpit-to-change-decision-15s.webm"),
);
await browser.close();
process.stdout.write(
  "Saved V6 15s SRE cockpit escalation/change decision recording.\n",
);
