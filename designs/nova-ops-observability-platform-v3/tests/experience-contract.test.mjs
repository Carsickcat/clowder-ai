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
    "NL2巡检旅程",
    "状态语义",
    "双 Agent 职责边界",
    "Mock 数据说明",
  ]) {
    assert.match(manual, new RegExp(heading));
  }
});
