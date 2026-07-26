import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5290/";
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
await page.waitForTimeout(2200);
await page.locator(".role-scene").nth(2).click();
await page.waitForTimeout(2200);
await page.locator(".journey-home-link").click();
await page.locator(".role-scene").first().click();
await page.waitForTimeout(1800);
await page.getByRole("button", { name: "提议回滚", exact: true }).click();
await page.getByRole("button", { name: "确认回滚完成 · 等待复验" }).click();
await page.locator('[data-domain-action="verification.started"]').click();
await page.locator('[data-domain-action="verification.evaluate"]').click();
await page.waitForTimeout(1700);
await page.locator('[data-domain-action="synthetic.recovery.started"]').click();
await page.locator('[data-domain-action="synthetic.recovered"]').click();
await page.getByRole("button", { name: "重跑 Gate 并生成结论" }).click();
await page.waitForTimeout(2300);
await page.locator(".journey-home-link").click();
await page.locator(".role-scene").nth(4).click();
await page.waitForTimeout(2800);

await context.close();
await video.saveAs(resolve(evidenceDir, "nova-ops-v3-golden-path-15s.webm"));
await browser.close();
process.stdout.write("Saved 15s high-fidelity journey recording.\n");
