import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const deckUrl = pathToFileURL(
  resolve(here, "..", "NOVA-Inspection-Product-Next.html"),
).href;
const evidenceDir = join(tmpdir(), "nova-inspection-product-deck-evidence");
const executablePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

test("deck renders and navigates on desktop and mobile", async () => {
  await mkdir(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true });
  const errors = [];

  try {
    const desktop = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    desktop.on("pageerror", (error) => errors.push(error.message));
    await desktop.goto(deckUrl);
    await desktop.waitForSelector(".slide.active");
    await desktop.waitForTimeout(450);

    assert.equal(await desktop.locator(".slide").count(), 12);
    assert.equal(await desktop.locator("#counter").textContent(), "01 / 12");

    await desktop.locator("#next").click();
    assert.equal(await desktop.locator("#counter").textContent(), "02 / 12");
    await desktop.keyboard.press("End");
    assert.equal(await desktop.locator("#counter").textContent(), "12 / 12");

    for (let index = 1; index <= 12; index += 1) {
      await desktop.evaluate((slideNumber) => {
        location.hash = String(slideNumber);
      }, index);
      await desktop.waitForFunction(
        (expected) =>
          document.querySelector(".slide.active")?.dataset.slide ===
          String(expected),
        index,
      );
      const overflowingChildren = await desktop
        .locator(".slide.active")
        .evaluate((slide) => {
          const slideBox = slide.getBoundingClientRect();
          return Array.from(slide.children)
            .filter((child) => !child.classList.contains("sr-only"))
            .filter((child) => {
              const box = child.getBoundingClientRect();
              return (
                box.top < slideBox.top - 1 ||
                box.left < slideBox.left - 1 ||
                box.right > slideBox.right + 1 ||
                box.bottom > slideBox.bottom + 1
              );
            })
            .map((child) => child.className || child.tagName);
        });
      assert.deepEqual(
        overflowingChildren,
        [],
        "desktop slide " + index + " contains overflowing content",
      );
    }

    await desktop.keyboard.press("Home");
    await desktop.waitForTimeout(450);

    const desktopOverflow = await desktop.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth > window.innerWidth,
      vertical: document.documentElement.scrollHeight > window.innerHeight,
    }));
    assert.deepEqual(desktopOverflow, { horizontal: false, vertical: false });
    await desktop.screenshot({
      path: join(evidenceDir, "desktop-cover.png"),
      fullPage: true,
    });

    for (const [slideNumber, fileName] of [
      [4, "desktop-why-ai.png"],
      [6, "desktop-ai-candidates.png"],
      [7, "desktop-orchestration.png"],
      [9, "desktop-report-pipeline.png"],
      [10, "desktop-report-interpretation.png"],
    ]) {
      await desktop.evaluate((target) => {
        location.hash = String(target);
      }, slideNumber);
      await desktop.waitForFunction(
        (expected) =>
          document.querySelector(".slide.active")?.dataset.slide ===
          String(expected),
        slideNumber,
      );
      await desktop.waitForTimeout(350);
      await desktop.screenshot({
        path: join(evidenceDir, fileName),
        fullPage: true,
      });
    }

    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    mobile.on("pageerror", (error) => errors.push(error.message));
    await mobile.goto(deckUrl + "#11");
    await mobile.waitForSelector(".slide.active");
    await mobile.waitForTimeout(450);

    assert.equal(await mobile.locator("#counter").textContent(), "11 / 12");
    const visibleSlides = await mobile
      .locator(".slide")
      .evaluateAll(
        (nodes) =>
          nodes.filter((node) => getComputedStyle(node).display !== "none")
            .length,
      );
    assert.equal(
      visibleSlides,
      1,
      "mobile viewport must render exactly one slide",
    );
    for (let index = 1; index <= 12; index += 1) {
      await mobile.evaluate((target) => {
        location.hash = String(target);
      }, index);
      await mobile.waitForFunction(
        (expected) =>
          document.querySelector(".slide.active")?.dataset.slide ===
          String(expected),
        index,
      );
      const mobileOverflow = await mobile.evaluate(() => ({
        horizontal: document.documentElement.scrollWidth > window.innerWidth,
        activeSlideScrollable:
          document.querySelector(".slide.active").scrollHeight >=
          document.querySelector(".slide.active").clientHeight,
      }));
      assert.equal(
        mobileOverflow.horizontal,
        false,
        "mobile slide " + index + " must not overflow horizontally",
      );
      assert.equal(mobileOverflow.activeSlideScrollable, true);
    }

    await mobile.evaluate(() => {
      location.hash = "11";
    });
    await mobile.waitForFunction(
      () => document.querySelector(".slide.active")?.dataset.slide === "11",
    );
    await mobile.waitForTimeout(350);
    await mobile.screenshot({
      path: join(evidenceDir, "mobile-workspace.png"),
      fullPage: true,
    });

    await desktop.close();
    await mobile.close();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
