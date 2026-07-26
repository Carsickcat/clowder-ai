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
  .getByRole("button", { name: "← 返回 SRE 工作台", exact: true })
  .click();
await page.waitForTimeout(1000);
await page.locator(".sre-queue-row", { hasText: "CHG-23841" }).click();
await page.waitForTimeout(2000);
await page.getByRole("button", { name: "升级为 Incident 调查" }).click();
await page.waitForTimeout(1800);
const h1 = page.locator(".hypothesis", { hasText: "H1" });
await h1.getByRole("button", { name: "运行测试" }).click();
await h1.getByRole("button", { name: "Confirm" }).click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /回写 CHG-23841 Finding/ }).click();
await page.waitForTimeout(1800);
await page.getByRole("button", { name: /返回 CHG-23841/ }).click();
await page.waitForTimeout(3100);

await context.close();
await video.saveAs(
  resolve(evidenceDir, "nova-ops-v5-sre-object-path-15s.webm"),
);
await browser.close();
process.stdout.write(
  "Saved V5 15s SRE object escalation/writeback recording.\n",
);
