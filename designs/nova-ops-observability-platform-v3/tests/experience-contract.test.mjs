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

test("entry point is a live SRE operational cockpit rather than an introduction or secondary navigator", () => {
  const file = resolve(root, "components", "screens", "SreHome.js");
  assert.ok(existsSync(file), "SreHome must be a dedicated entry screen");
  const source = readFileSync(file, "utf8");

  for (const label of [
    "当前需要决策",
    "待处置对象",
    "正在运行",
    "现场脉冲",
    "sre-cockpit",
  ]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /data-screen=["']SreHome["']/);
  assert.match(source, /OBJECT_OPEN/);
  assert.doesNotMatch(
    source,
    /sre-home-hero|sre-posture-grid|object-entry-section|object-entry-grid|对象类型入口|发布负责人|服务 Owner|role-entry-card/,
    "the application must open inside the SRE shift, not on an entry or role-selection page",
  );
});

test("four operational objects declare distinct workspace compositions", () => {
  const model = readFileSync(
    resolve(root, "components", "objectModel.js"),
    "utf8",
  );
  const workspace = readFileSync(
    resolve(root, "components", "ObjectWorkspace.js"),
    "utf8",
  );

  for (const layout of ["forensics", "validation", "command", "compiler"]) {
    assert.match(model, new RegExp(`layout:\\s*["']${layout}["']`));
  }
  assert.match(workspace, /data-workspace-layout=\{object\.layout\}/);

  const screenContracts = {
    Investigation: "incident-causal-workbench",
    ChangeGuard: "change-verification-workbench",
    MissionCommand: "mission-phase-workbench",
    InspectionStudio: "inspection-compiler-workbench",
  };
  for (const [screen, contractClass] of Object.entries(screenContracts)) {
    const source = readFileSync(
      resolve(root, "components", "screens", `${screen}.js`),
      "utf8",
    );
    assert.match(
      source,
      new RegExp(contractClass),
      `${screen} must expose its own primary workspace composition`,
    );
  }
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

test("mobile global navigation exposes stable accessible compact labels", () => {
  const source = readFileSync(
    resolve(root, "components", "AppShell.js"),
    "utf8",
  );

  for (const shortLabel of ["SRE", "INC", "CHG", "MIS", "INSP", "RPT", "GOV"]) {
    assert.match(source, new RegExp(`shortLabel:\\s*["']${shortLabel}["']`));
  }
  assert.match(source, /aria-label=\{item\.label\}/);
  assert.match(source, /nav-label-full/);
  assert.match(source, /nav-label-compact/);
});

test("object workspace exposes a secondary-navigation return affordance", () => {
  const workspace = readFileSync(
    resolve(root, "components", "ObjectWorkspace.js"),
    "utf8",
  );
  const styles = readFileSync(resolve(root, "app", "globals.css"), "utf8");

  assert.match(workspace, /data-ui-role=["']secondary-navigation["']/);
  assert.match(
    styles,
    /\.journey-home-link\s*\{[^}]*border:\s*1px solid[^}]*background:/s,
  );
});

test("professional workspace tabs declare a single-line scroll contract", () => {
  const styles = readFileSync(resolve(root, "app", "globals.css"), "utf8");

  assert.match(
    styles,
    /\.professional-workbench-tabs\s*\{[^}]*scroll-snap-type:\s*x mandatory/s,
  );
  assert.match(
    styles,
    /\.professional-workbench-tabs button\s*\{[^}]*white-space:\s*nowrap/s,
  );
});

test("running agents panel has an explicit empty state", () => {
  const source = readFileSync(
    resolve(root, "components", "screens", "SreHome.js"),
    "utf8",
  );

  assert.match(source, /const runningAgentRuns/);
  assert.match(source, /run-empty-state/);
  assert.match(source, /没有运行中的 Agent/);
});

test("routine browser tests isolate evidence from versioned artifacts", () => {
  const browserSource = readFileSync(
    resolve(root, "tests", "golden-path.browser.mjs"),
    "utf8",
  );
  const packageJson = JSON.parse(
    readFileSync(resolve(root, "package.json"), "utf8"),
  );

  assert.match(
    browserSource,
    /import\s+\{\s*tmpdir\s*\}\s+from\s+["']node:os["']/,
  );
  assert.match(
    browserSource,
    /process\.argv\.includes\(["']--record-evidence["']\)/,
  );
  assert.match(
    browserSource,
    /resolve\(tmpdir\(\),\s*["']nova-ops-browser-evidence["']\)/,
  );
  assert.equal(
    packageJson.scripts["test:browser"],
    "node tests/golden-path.browser.mjs",
  );
  assert.equal(
    packageJson.scripts["test:browser:evidence"],
    "node tests/golden-path.browser.mjs --record-evidence",
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
