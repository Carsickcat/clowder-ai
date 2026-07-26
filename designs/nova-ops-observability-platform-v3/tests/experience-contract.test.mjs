import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

const screens = [
  "LiveOps",
  "MissionCommand",
  "ChangeGuard",
  "InspectionStudio",
  "Investigation",
  "ReportsCenter",
  "Governance",
];

test("entry point is an SRE object queue rather than a role chooser", () => {
  const file = resolve(root, "components", "screens", "SreHome.js");
  assert.ok(existsSync(file), "SreHome must be a dedicated entry screen");
  const source = readFileSync(file, "utf8");

  for (const label of [
    "SRE 运行工作台",
    "待处置对象",
    "Incident",
    "Change",
    "Mission",
    "Inspection",
  ]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /data-screen=["']SreHome["']/);
  assert.match(source, /OBJECT_OPEN/);
  assert.doesNotMatch(source, /发布负责人|服务 Owner|role-entry-card/);
});

test("object workspaces use context, evidence, and decision rails", () => {
  const source = ["AppShell.js", "ObjectWorkspace.js", "objectModel.js"]
    .map((file) => readFileSync(resolve(root, "components", file), "utf8"))
    .join("\n");

  for (const contractClass of [
    "object-workspace",
    "object-rail",
    "professional-workbench-tabs",
    "object-center",
    "decision-inspector",
  ]) {
    assert.match(source, new RegExp(contractClass));
  }
  for (const decisionLayer of [
    "事实",
    "假设",
    "证据缺口",
    "建议",
    "人工结论",
  ]) {
    assert.match(source, new RegExp(decisionLayer));
  }
  assert.doesNotMatch(
    source,
    /当前角色|返回角色入口|role-entry-card/,
    "role-based information architecture must not remain",
  );
});

test("object accents are isolated from health and severity state colors", () => {
  const source = readFileSync(resolve(root, "app", "globals.css"), "utf8");

  for (const token of [
    "--cafe-base-",
    "--cafe-surface-",
    "--cafe-text-",
    "--cafe-persona-",
    "--object-incident-accent",
    "--object-change-accent",
    "--object-mission-accent",
    "--object-inspection-accent",
    ".object-incident",
    ".object-change",
    ".object-mission",
    ".object-inspection",
  ]) {
    assert.match(source, new RegExp(token));
  }
  assert.doesNotMatch(
    source,
    /--object-(?:incident|change|mission|inspection)-accent:\s*var\(--(?:danger|warning|unknown)\)/,
    "object identity cannot reuse status semantic tokens",
  );
});

test("every product screen has a dedicated implementation", () => {
  for (const screen of screens) {
    const file = resolve(root, "components", "screens", `${screen}.js`);
    assert.ok(existsSync(file), `${screen} must have a dedicated component`);
    const source = readFileSync(file, "utf8");
    assert.match(source, new RegExp(`data-screen=["']${screen}["']`));
  }
});

test("high fidelity source contains no chart placeholders", () => {
  const files = [
    resolve(root, "components", "Charts.js"),
    ...screens.map((screen) =>
      resolve(root, "components", "screens", `${screen}.js`),
    ),
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /chart-placeholder|placeholder chart|示意曲线/i,
    );
  }
});

test("decision charts expose evidence-bearing semantics", () => {
  const source = readFileSync(resolve(root, "components", "Charts.js"), "utf8");
  for (const token of [
    "forecast-band",
    "capacity-threshold",
    "change-marker",
    "canary-series",
    "control-series",
    "missing-data-segment",
    "evidence-point",
  ]) {
    assert.match(source, new RegExp(`data-chart-part=["']${token}["']`));
  }
});

test("primary interactions are domain actions rather than toast-only buttons", () => {
  for (const screen of screens) {
    const source = readFileSync(
      resolve(root, "components", "screens", `${screen}.js`),
      "utf8",
    );
    assert.match(
      source,
      /data-domain-action=/,
      `${screen} needs a state-changing action`,
    );
  }
});

test("reports render versioned snapshots and deep-link findings to source objects", () => {
  const source = readFileSync(
    resolve(root, "components", "screens", "ReportsCenter.js"),
    "utf8",
  );

  assert.match(source, /report\.snapshot/);
  assert.match(source, /type:\s*["']OBJECT_OPEN["']/);
  assert.match(source, /objectType:\s*finding\.sourceObject\.type/);
  assert.match(source, /objectId:\s*finding\.sourceObject\.id/);
  assert.match(source, /已在源对象解决/);
  assert.match(source, /currentFindings/);
});

test("cross-object verification exposes source remediation receipts", () => {
  const source = readFileSync(
    resolve(root, "components", "ObjectWorkspace.js"),
    "utf8",
  );

  assert.match(source, /SOURCE_REMEDIATION_RECORDED/);
  assert.match(source, /整改回执/);
  assert.match(source, /进入 Change Guard/);
});

test("operator manual documents SRE objects, states, and agent boundaries", () => {
  const manualPath = resolve(root, "USER-GUIDE.md");
  assert.ok(existsSync(manualPath), "USER-GUIDE.md must exist");
  const manual = readFileSync(manualPath, "utf8");

  for (const heading of [
    "快速开始",
    "SRE 运行工作台",
    "Incident 工作台",
    "Change 工作台",
    "Mission 工作台",
    "Inspection 工作台",
    "跨对象升级与回写",
    "状态语义",
    "双 Agent 职责边界",
    "Mock 数据说明",
  ]) {
    assert.match(manual, new RegExp(heading));
  }
});
