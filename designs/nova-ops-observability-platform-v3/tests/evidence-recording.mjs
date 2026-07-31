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
await page.waitForTimeout(1200);
await page
  .getByLabel("描述巡检需求")
  .fill("请帮我巡检 payments-router v3.18.0 是否可以灰度发布");
await page.getByRole("button", { name: "生成巡检方案" }).click();
await page.getByTestId("inspection-plan").waitFor();
await page.waitForTimeout(1800);
await page.getByRole("button", { name: "确认方案并执行变更前巡检" }).click();
await page.getByText("可以进入 25% 灰度", { exact: true }).waitFor();
await page.waitForTimeout(1800);
await page.getByRole("button", { name: "批准进入 25% 灰度" }).click();
await page.getByText("暂停在 25% 灰度", { exact: true }).waitFor();
await page.waitForTimeout(2600);
await page.getByRole("button", { name: "记录处置" }).click();
await page
  .getByText("已记录处置：连接池上限 80 → 120", { exact: true })
  .waitFor();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "执行复验" }).click();
await page.getByText("可以继续到 100% 放量", { exact: true }).waitFor();
await page.waitForTimeout(1800);
await page.getByRole("button", { name: "继续到 100% 放量" }).click();
await page.getByRole("button", { name: "执行变更后验收" }).click();
await page.getByTestId("final-report").waitFor();
await page.waitForTimeout(2400);
await page.getByRole("button", { name: "请 Claw 解读最终报告" }).click();
await page.getByText(/风险已完成复验/).waitFor();
await page.waitForTimeout(2000);

await context.close();
await video.saveAs(
  resolve(evidenceDir, "nova-change-inspection-journey-15s.webm"),
);
await browser.close();
process.stdout.write(
  "Saved change inspection request, canary verification, and report recording.\n",
);
