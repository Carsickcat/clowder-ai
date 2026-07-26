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

test("entry point is organized by roles and operational scenarios", () => {
  const file = resolve(root, "components", "screens", "JourneyHome.js");
  assert.ok(existsSync(file), "JourneyHome must be a dedicated entry screen");
  const source = readFileSync(file, "utf8");

  for (const label of [
    "发布负责人",
    "值班 SRE",
    "服务 Owner",
    "变更验证",
    "故障诊断",
    "大促保障",
    "NL2 巡检",
  ]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /data-screen=["']JourneyHome["']/);
  assert.match(source, /JOURNEY_ENTER/);
});

test("journey workspaces use the three-rail decision layout", () => {
  const source = ["AppShell.js", "JourneyWorkspace.js", "journeyModel.js"]
    .map((file) => readFileSync(resolve(root, "components", file), "utf8"))
    .join("\n");

  for (const contractClass of [
    "journey-workspace",
    "journey-rail",
    "professional-workbench-tabs",
    "journey-center",
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
    /Agent workspaces|Evidence lenses/,
    "module and global Evidence Lens navigation must not remain primary IA",
  );
});

test("journey accents and Cat Cafe token tiers are explicit", () => {
  const source = readFileSync(resolve(root, "app", "globals.css"), "utf8");

  for (const token of [
    "--cafe-base-",
    "--cafe-surface-",
    "--cafe-text-",
    "--cafe-persona-",
    "--journey-accent",
    ".journey-release",
    ".journey-oncall",
    ".journey-service",
  ]) {
    assert.match(source, new RegExp(token));
  }
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

test("operator manual documents journeys, states, and agent boundaries", () => {
  const manualPath = resolve(root, "USER-GUIDE.md");
  assert.ok(existsSync(manualPath), "USER-GUIDE.md must exist");
  const manual = readFileSync(manualPath, "utf8");

  for (const heading of [
    "快速开始",
    "大促保障旅程",
    "变更诊断与复验旅程",
    "独立故障诊断旅程",
    "NL2巡检旅程",
    "状态语义",
    "双 Agent 职责边界",
    "Mock 数据说明",
  ]) {
    assert.match(manual, new RegExp(heading));
  }
});
