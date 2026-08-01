import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const deckPath = resolve(here, "..", "NOVA-Inspection-Product-Next.html");
const highFidelityAppPath = resolve(
  here,
  "..",
  "..",
  "..",
  "components",
  "change-inspection",
  "ChangeInspectionApp.js",
);
const highFidelityHeaderPath = resolve(
  here,
  "..",
  "..",
  "..",
  "components",
  "change-inspection",
  "JourneyHeader.js",
);
const highFidelityClawPath = resolve(
  here,
  "..",
  "..",
  "..",
  "components",
  "change-inspection",
  "ClawPanel.js",
);
const highFidelityDecisionPath = resolve(
  here,
  "..",
  "..",
  "..",
  "components",
  "change-inspection",
  "DecisionSurface.js",
);
const highFidelityJobPath = resolve(
  here,
  "..",
  "..",
  "..",
  "components",
  "change-inspection",
  "InspectionJobPlatform.js",
);
const highFidelityTimelinePath = resolve(
  here,
  "..",
  "..",
  "..",
  "components",
  "change-inspection",
  "RunTimeline.js",
);
const highFidelityStatePath = resolve(
  here,
  "..",
  "..",
  "..",
  "lib",
  "change-inspection.mjs",
);

async function readDeck() {
  return readFile(deckPath, "utf8");
}

async function readHighFidelitySources() {
  return Promise.all([
    readFile(highFidelityAppPath, "utf8"),
    readFile(highFidelityHeaderPath, "utf8"),
    readFile(highFidelityClawPath, "utf8"),
    readFile(highFidelityDecisionPath, "utf8"),
    readFile(highFidelityJobPath, "utf8"),
    readFile(highFidelityTimelinePath, "utf8"),
    readFile(highFidelityStatePath, "utf8"),
  ]).then((parts) => parts.join("\n"));
}

test("deck contains exactly ten numbered slides", async () => {
  const html = await readDeck();
  const slides =
    html.match(
      /<section\b(?=[^>]*\bclass="[^"]*\bslide\b[^"]*")(?=[^>]*\bdata-slide="\d+")[^>]*>/gs,
    ) ?? [];
  assert.equal(slides.length, 10);
  for (let index = 1; index <= 10; index += 1) {
    assert.match(html, new RegExp(`data-slide="${index}"`));
  }
});

test("deck is a concrete high-fidelity product walkthrough", async () => {
  const html = await readDeck();
  for (const phrase of [
    "产品功能与用户旅程",
    "payments-router",
    "v3.18.0",
    "CHG-23841",
    "作业平台",
    "当前任务",
    "当前结论",
    "Claw 对话",
    "变更前准入",
    "灰度持续验证",
    "变更后验收",
    "执行与决策记录",
    "巡检项生成",
    "巡检项编排",
    "添加巡检项",
    "删除",
    "确认方案并执行变更前巡检",
    "A/B 对比",
    "记录处置",
    "执行复验",
    "最终报告",
    "请 Claw 解读最终报告",
    "UNKNOWN",
    "只读",
    "不会触发真实生产动作",
  ]) {
    assert.ok(
      html.includes(phrase),
      `missing required product phrase: ${phrase}`,
    );
  }

  for (let index = 1; index <= 8; index += 1) {
    assert.match(html, new RegExp(`data-walkthrough-step="${index}"`));
  }

  assert.doesNotMatch(
    html,
    /Phase One|第一期|首期|路线图|roadmap|当前 connected|AI 增强目标|没有 AI|有 AI|不做多级左树/i,
  );
});

test("deck uses the shipped 75d991e one-screen high fidelity as its UI contract", async () => {
  const [html, highFidelitySources] = await Promise.all([
    readDeck(),
    readHighFidelitySources(),
  ]);

  const shippedLabels = [
    "作业平台",
    "当前任务",
    "当前结论",
    "Claw 对话",
    "变更前准入",
    "灰度持续验证",
    "变更后验收",
  ];

  for (const label of shippedLabels) {
    assert.ok(
      highFidelitySources.includes(label),
      `75d991e high-fidelity label drifted: ${label}`,
    );
    assert.ok(
      html.includes(label),
      `deck no longer mirrors the 75d991e high fidelity: ${label}`,
    );
  }

  assert.match(html, /data-ui-contract="nova-75d991e-workbench"/);
  assert.ok(
    (html.match(/data-source-screen="75d991e"/g) ?? []).length >= 3,
    "at least three slides must be visibly bound to the real 75d991e screen",
  );
  assert.doesNotMatch(html, /class="side-nav"/);
  assert.doesNotMatch(html, /class="nav-item(?:\s|\")/);
});

test("AI value is embodied inside inspection design and report interpretation", async () => {
  const html = await readDeck();

  for (const phrase of [
    "为什么检查",
    "生成理由",
    "证据来源",
    "覆盖缺口",
    "合并重复项",
    "跨阶段归纳",
    "治理建议",
    "复验建议",
    "证据引用",
    "规则产生判定",
    "人确认方案、阶段和治理决定",
  ]) {
    assert.ok(html.includes(phrase), `missing AI product contract: ${phrase}`);
  }

  assert.match(html, /data-ai-capability="inspection-design"/);
  assert.match(html, /data-ai-capability="report-interpretation"/);
});

test("deck keeps unknown evidence and immutable reports honest", async () => {
  const html = await readDeck();
  assert.match(html, /范围内必检项 UNKNOWN[\s\S]{0,180}阻断/);
  assert.match(html, /范围外拓扑遗漏[\s\S]{0,180}COVERAGE_OMISSION/);
  assert.match(html, /COVERAGE_OMISSION[\s\S]{0,240}不参与机器判定/);
  assert.match(html, /经人工确认[\s\S]{0,180}未关闭风险[\s\S]{0,120}归档/);
  assert.doesNotMatch(html, /风险面已覆盖/);
  assert.match(html, /不可变报告快照/);
  assert.doesNotMatch(html, /UNKNOWN[\s\S]{0,80}badge-pass/);
});

test("deck is a standalone offline file", async () => {
  const html = await readDeck();
  assert.doesNotMatch(
    html,
    /<(?:script|link|img)[^>]+(?:src|href)=["']https?:\/\//i,
  );
  assert.doesNotMatch(html, /@import\s+url\(/i);
  const imageSources = [
    ...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi),
  ].map((match) => match[1]);
  assert.ok(
    imageSources.length >= 3,
    "deck must include high-fidelity visuals",
  );
  assert.ok(
    imageSources.every((source) => source.startsWith("data:image/png;base64,")),
    "all high-fidelity visuals must be embedded in the single HTML file",
  );
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
