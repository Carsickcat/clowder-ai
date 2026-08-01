import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const deckPath = resolve(here, "..", "NOVA-Inspection-Product-Next.html");
const connectedPagePath = resolve(
  here,
  "..",
  "..",
  "..",
  "..",
  "..",
  "packages",
  "web",
  "src",
  "components",
  "observability",
  "InspectionOperationsPage.tsx",
);

async function readDeck() {
  return readFile(deckPath, "utf8");
}

async function readConnectedPage() {
  return readFile(connectedPagePath, "utf8");
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

test("deck is a concrete current-to-AI-enhanced product walkthrough", async () => {
  const html = await readDeck();
  for (const phrase of [
    "产品功能与操作说明",
    "payments-router",
    "production",
    "v3.18.0",
    "CHG-2481",
    "当前 connected",
    "巡检项生成",
    "巡检项编排",
    "执行只读巡检",
    "报告生成与解读",
    "CLAW 是同屏助手",
    "+ 添加巡检项",
    "用户怎么操作",
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

test("deck uses the shipped one-screen connected console as its UI contract", async () => {
  const [html, connectedPage] = await Promise.all([
    readDeck(),
    readConnectedPage(),
  ]);

  const shippedLabels = [
    "可复用巡检控制台",
    "保存为可复用作业",
    "新建独立 Case",
    "执行阶段",
    "执行只读巡检",
    "记录人工接受并固化报告",
    "不可变报告",
  ];

  for (const label of shippedLabels) {
    assert.ok(
      connectedPage.includes(label),
      `connected UI label drifted: ${label}`,
    );
    assert.ok(
      html.includes(label),
      `deck no longer mirrors connected UI: ${label}`,
    );
  }

  assert.match(html, /data-ui-contract="current-connected-console"/);
  assert.match(html, /当前已具备[\s\S]{0,160}单巡检项/);
  assert.match(html, /AI 增强目标[\s\S]{0,200}多巡检项/);
  assert.doesNotMatch(html, /class="side-nav"/);
  assert.doesNotMatch(html, /class="nav-item(?:\s|\")/);
});

test("deck explains why AI is useful without giving it evidence authority", async () => {
  const html = await readDeck();

  for (const phrase of [
    "没有 AI",
    "有 AI",
    "依赖上下文归并",
    "候选项生成理由",
    "检查覆盖缺口",
    "自然语言转检查草稿",
    "报告事实摘要",
    "异常关联",
    "风险解释",
    "治理建议",
    "不确定性",
    "证据引用",
    "AI 不生成观测值",
    "AI 不决定 PASS / FAIL",
    "规则负责判定",
    "人负责发布与接受",
  ]) {
    assert.ok(html.includes(phrase), `missing AI product contract: ${phrase}`);
  }

  assert.match(html, /data-ai-capability="inspection-design"/);
  assert.match(html, /data-ai-capability="report-interpretation"/);
});

test("deck keeps unknown evidence and immutable reports honest", async () => {
  const html = await readDeck();
  assert.match(html, /UNKNOWN[\s\S]{0,120}BLOCKED/);
  assert.match(html, /IMMUTABLE REPORT/);
  assert.match(html, /不可变报告/);
  assert.doesNotMatch(html, /UNKNOWN[\s\S]{0,80}class="badge current"/);
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
