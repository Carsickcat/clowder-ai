import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const deckPath = resolve(here, "..", "NOVA-Inspection-Product-Next.html");

async function readDeck() {
  return readFile(deckPath, "utf8");
}

test("deck contains exactly twelve numbered slides", async () => {
  const html = await readDeck();
  const slides =
    html.match(
      /<section\b(?=[^>]*\bclass="[^"]*\bslide\b[^"]*")(?=[^>]*\bdata-slide="\d+")[^>]*>/gs,
    ) ?? [];
  assert.equal(slides.length, 12);
  for (let index = 1; index <= 12; index += 1) {
    assert.match(html, new RegExp(`data-slide="${index}"`));
  }
});

test("deck is a concrete seven-step product walkthrough", async () => {
  const html = await readDeck();
  for (const phrase of [
    "产品功能与操作说明",
    "目标体验演示",
    "payments-router",
    "production",
    "v3.18.0",
    "CHG-2481",
    "选择服务与变更",
    "生成候选巡检项",
    "编辑巡检任务",
    "执行阶段工作流",
    "阶段报告与 A/B 对比",
    "风险项、治理建议与复验",
    "固化最终巡检报告",
    "CLAW 怎么用",
    "添加巡检项",
    "页面确认",
    "omissions",
    "UNKNOWN",
    "只读",
    "不执行发布、放量或回滚",
  ]) {
    assert.ok(
      html.includes(phrase),
      `missing required product phrase: ${phrase}`,
    );
  }

  for (let index = 1; index <= 7; index += 1) {
    assert.match(html, new RegExp(`data-walkthrough-step="${index}"`));
  }

  assert.doesNotMatch(html, /Phase One|第一期|首期|路线图|roadmap/i);
});

test("abandoned-before-execution is not presented as a successful state", async () => {
  const html = await readDeck();
  assert.doesNotMatch(
    html,
    /class="status-box good"[\s\S]{0,160}ABANDONED_BEFORE_EXECUTION/,
  );
  assert.match(
    html,
    /class="status-box"[\s\S]{0,160}ABANDONED_BEFORE_EXECUTION/,
  );
});

test("deck is a standalone offline file", async () => {
  const html = await readDeck();
  assert.doesNotMatch(
    html,
    /<(?:script|link|img)[^>]+(?:src|href)=["']https?:\/\//i,
  );
  assert.doesNotMatch(html, /@import\s+url\(/i);
  assert.match(html, /<style>/);
  assert.match(html, /<script>/);
});

test("deck supports keyboard, touch, print, and narrow-screen reading", async () => {
  const html = await readDeck();
  assert.match(html, /keydown/);
  assert.match(html, /touchstart/);
  assert.match(html, /touchend/);
  assert.match(html, /requestFullscreen/);
  assert.match(html, /@media\s+print/);
  assert.match(html, /@media\s*\(max-width:\s*720px\)/);
  assert.match(html, /aria-live="polite"/);
});
