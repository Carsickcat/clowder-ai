import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (...parts) => readFileSync(resolve(root, ...parts), "utf8");

test("the product opens directly into one Chinese change inspection journey", () => {
  const entry = read("components", "OpsApp.js");
  const app = read("components", "change-inspection", "ChangeInspectionApp.js");
  const header = read("components", "change-inspection", "JourneyHeader.js");
  const domain = read("lib", "change-inspection.mjs");

  assert.match(entry, /ChangeInspectionApp/);
  assert.doesNotMatch(entry, /AppShell|OpsProvider/);
  assert.match(app, /data-screen=["']change-inspection["']/);

  for (const label of [
    "变更巡检",
    "变更前准入",
    "灰度持续验证",
    "变更后验收",
    "演示数据",
  ]) {
    assert.match(`${app}\n${header}\n${domain}`, new RegExp(label));
  }

  assert.doesNotMatch(
    app,
    /shortLabel|>INC<|>CHG<|>MIS<|>INSP<|>RPT<|>GOV</,
    "the primary journey cannot fall back to the old seven-menu navigation",
  );
});

test("the operator-approved 75d991e layout remains the product anchor", () => {
  const app = read("components", "change-inspection", "ChangeInspectionApp.js");
  const styles = read("app", "change-inspection.css");

  assert.match(
    styles,
    /grid-template-areas:\s*["']jobs decision claw["']/,
    "desktop must keep task history, selected task, and CLAW in three columns",
  );
  assert.match(
    styles,
    /grid-template-columns:\s*230px\s+minmax\(0,\s*1fr\)\s+340px/,
    "the accepted desktop proportions are a product contract",
  );
  for (const region of [
    "InspectionTaskHistory",
    "inspection-decision-column",
    "inspection-claw-column",
    "ExecutionPlanBoard",
  ]) {
    assert.match(app, new RegExp(region));
  }
  assert.match(app, /inspection-execution-region/);
});

test("inspection intelligence is visible as provenance, orchestration, and report scoring", () => {
  const claw = read("components", "change-inspection", "ClawPanel.js");
  const surface = read("components", "change-inspection", "DecisionSurface.js");
  const requiredComponents = [
    "InspectionTaskHistory.js",
    "ExecutionPlanBoard.js",
    "ReportIntelligence.js",
  ];
  for (const component of requiredComponents) {
    assert.ok(
      existsSync(resolve(root, "components", "change-inspection", component)),
      `${component} must exist in the accepted workbench shell`,
    );
  }
  const taskHistory = read(
    "components",
    "change-inspection",
    requiredComponents[0],
  );
  const execution = read(
    "components",
    "change-inspection",
    requiredComponents[1],
  );
  const report = read("components", "change-inspection", requiredComponents[2]);

  for (const label of ["巡检任务", "历史任务", "报告评分"]) {
    assert.match(taskHistory, new RegExp(label));
  }
  for (const label of [
    "自然语义",
    "变更指导书",
    "业务知识图谱",
    "生成工作流",
  ]) {
    assert.match(`${claw}\n${surface}`, new RegExp(label));
  }
  for (const label of ["执行计划", "依赖", "证据", "已解决"]) {
    assert.match(execution, new RegExp(label));
  }
  for (const label of [
    "报告评分",
    "方案覆盖诚实度",
    "证据可信度",
    "基线可比性",
    "证据新鲜度",
    "风险闭环度",
    "剩余风险",
    "扣分依据",
    "引用证据",
  ]) {
    assert.match(report, new RegExp(label));
  }
  assert.match(report, /score\.deductions/);
});

test("plan generation copy reports produced scope without inventing risk coverage", () => {
  const surface = read("components", "change-inspection", "DecisionSurface.js");

  assert.match(surface, /项检查已生成/);
  assert.match(surface, /类来源已就绪/);
  assert.doesNotMatch(
    surface,
    /风险面已覆盖/,
    "generated check count is not a measured risk-coverage denominator",
  );
});

test("the journey includes historical inspection tasks without creating a second product shell", () => {
  const app = read("components", "change-inspection", "ChangeInspectionApp.js");
  const jobs = read("lib", "change-inspection-jobs.mjs");
  const domain = read("lib", "change-inspection.mjs");

  assert.match(app, /InspectionTaskHistory/);
  assert.match(app, /JOB_SELECTED/);
  assert.match(jobs, /InspectionJobTemplate/);
  assert.match(jobs, /支付路由灰度巡检/);
  assert.match(jobs, /库存服务发布巡检/);
  assert.match(jobs, /结算链路日常巡检/);
  assert.match(domain, /sourceJob/);
  assert.doesNotMatch(
    app,
    /AppShell|primary-nav|side-nav/,
    "saved jobs belong to the same journey rather than another product menu",
  );
});

test("the workspace answers task, conclusion, and next action in every state", () => {
  const surface = read("components", "change-inspection", "DecisionSurface.js");
  const domain = read("lib", "change-inspection.mjs");
  const actions = read("lib", "change-inspection-actions.mjs");

  for (const label of [
    "当前任务",
    "当前结论",
    "下一步",
    "确认方案并执行变更前巡检",
    "批准进入 25% 灰度",
    "记录处置",
    "继续到 100% 放量",
    "执行变更后验收",
    "查看最终报告",
  ]) {
    assert.match(`${surface}\n${domain}\n${actions}`, new RegExp(label));
  }
  assert.match(surface, /data-ui-role=["']primary-action["']/);
});

test("Claw shares domain actions but cannot execute production changes", () => {
  const app = read("components", "change-inspection", "ChangeInspectionApp.js");
  const claw = read("components", "change-inspection", "ClawPanel.js");

  assert.match(claw, /Claw 对话/);
  assert.match(claw, /不会代替你执行生产动作/);
  assert.match(claw, /INTENT_SUBMITTED/);
  assert.match(claw, /REPORT_EXPLANATION_REQUESTED/);
  assert.match(app, /changeInspectionReducer/);
  assert.doesNotMatch(
    app,
    /type === ["']REMEDIATION_RECORDED["'][\s\S]{0,240}VERIFICATION_RAN/,
    "one page click cannot collapse remediation recording and verification into one transition",
  );
  assert.doesNotMatch(claw, /ROLLBACK|DEPLOY|CANARY_ADVANCED|POST_CHANGE_RAN/);
});

test("Claw requires explicit user intent and the domain never fabricates service context", () => {
  const claw = read("components", "change-inspection", "ClawPanel.js");
  const domain = read("lib", "change-inspection.mjs");
  const intent = read("lib", "change-inspection-intent.mjs");

  assert.match(claw, /useState\(["']["']\)/);
  assert.match(claw, /placeholder=\{EXAMPLE\}/);
  assert.doesNotMatch(claw, /useState\(EXAMPLE\)/);
  assert.match(intent, /parseInspectionIntent/);
  assert.match(intent, /status:\s*["']clarification["']/);
});

test("unknown and stale states block progression and expose corrective actions", () => {
  const domain = read("lib", "change-inspection.mjs");
  const surface = read("components", "change-inspection", "DecisionSurface.js");
  const styles = read("app", "change-inspection.css");

  for (const label of [
    "不可判定",
    "基线不可比",
    "证据已过期",
    "COMPARABILITY_RESTORED",
    "EVIDENCE_REFRESHED",
  ]) {
    assert.match(`${domain}\n${surface}`, new RegExp(label));
  }
  assert.match(`${surface}\n${styles}`, /status-unknown/);
});

test("runs and final report remain visible as one auditable timeline", () => {
  const surface = read("components", "change-inspection", "DecisionSurface.js");
  const timeline = read("components", "change-inspection", "RunTimeline.js");
  const domain = read("lib", "change-inspection.mjs");

  for (const token of [
    "InspectionRun",
    "DecisionRecord",
    "ReportSnapshot",
    "admission",
    "verification",
    "acceptance",
  ]) {
    assert.match(`${timeline}\n${domain}`, new RegExp(token));
  }
  for (const field of ["title", "summary", "conclusion"]) {
    assert.match(
      `${surface}\n${timeline}`,
      new RegExp(`reportSnapshot\\.${field}`),
    );
  }
  assert.doesNotMatch(
    `${surface}\n${timeline}`,
    /<h3>本次变更验收通过<\/h3>|结论：通过/,
    "report copy must be projected from ReportSnapshot rather than duplicated in the view",
  );
});

test("primary user copy is Chinese while technical ids remain available", () => {
  const timeline = read("components", "change-inspection", "RunTimeline.js");
  const actions = read("lib", "change-inspection-actions.mjs");
  const fixtures = read("lib", "change-inspection-fixtures.mjs");
  const domain = read("lib", "change-inspection.mjs");

  for (const exposedTerm of [
    "InspectionRun",
    "DecisionRecord",
    "ReportSnapshot",
  ]) {
    assert.doesNotMatch(
      timeline,
      new RegExp(`>${exposedTerm}<|${exposedTerm} ·`),
    );
  }
  assert.doesNotMatch(actions, /label:\s*["'][^"']*Verification Run/);
  assert.doesNotMatch(fixtures, /canary 25%|vs stable|BaselineSnapshot/);
  assert.doesNotMatch(domain, /canary 与 stable|Verification Run|历史风险 Run/);
  assert.match(timeline, /次巡检/);
  assert.match(timeline, /条决策/);
  assert.match(actions, /执行复验/);
});

test("mobile keeps semantic labels and stacks the decision before Claw", () => {
  const styles = read("app", "change-inspection.css");
  const app = read("components", "change-inspection", "ChangeInspectionApp.js");

  assert.match(styles, /@media\s*\(max-width:\s*720px\)/);
  assert.match(
    styles,
    /\.inspection-layout\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  assert.match(app, /inspection-decision-column/);
  assert.match(app, /inspection-claw-column/);
});

test("routine browser tests isolate evidence from versioned artifacts", () => {
  const browserSource = read("tests", "golden-path.browser.mjs");
  const packageJson = JSON.parse(read("package.json"));

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

test("clean Windows checkouts have explicit build and EOL contracts", () => {
  const packageJson = JSON.parse(read("package.json"));
  const prettierConfig = JSON.parse(read(".prettierrc.json"));
  const attributes = read(".gitattributes");
  const buildSites = read("scripts", "build-sites.mjs");

  assert.equal(packageJson.scripts.pretest, "npm run build:sites");
  assert.equal(
    packageJson.scripts["build:sites"],
    "node scripts/build-sites.mjs",
  );
  assert.match(buildSites, /process\.env\.NODE_ENV\s*=\s*["']production["']/);
  assert.equal(prettierConfig.endOfLine, "auto");
  assert.match(
    attributes,
    /^NOVA-Ops-Intelligence-Standalone\.html text eol=lf$/m,
  );
  assert.match(attributes, /^static\/index\.html text eol=lf$/m);
});

test("all new implementation files stay within the frontend size boundary", () => {
  const files = [
    ["lib", "change-inspection.mjs"],
    ["lib", "change-inspection-intent.mjs"],
    ["lib", "change-inspection-identifiers.mjs"],
    ["lib", "change-inspection-immutability.mjs"],
    ["lib", "change-inspection-jobs.mjs"],
    ["lib", "change-inspection-records.mjs"],
    ["components", "change-inspection", "ChangeInspectionApp.js"],
    ["components", "change-inspection", "InspectionTaskHistory.js"],
    ["components", "change-inspection", "ExecutionPlanBoard.js"],
    ["components", "change-inspection", "ReportIntelligence.js"],
    ["lib", "change-inspection-intelligence.mjs"],
    ["lib", "change-inspection-report-intelligence.mjs"],
    ["components", "change-inspection", "JourneyHeader.js"],
    ["components", "change-inspection", "DecisionSurface.js"],
    ["components", "change-inspection", "ClawPanel.js"],
    ["components", "change-inspection", "RunTimeline.js"],
  ];

  for (const parts of files) {
    const file = resolve(root, ...parts);
    assert.ok(existsSync(file), `${parts.join("/")} must exist`);
    assert.ok(
      readFileSync(file, "utf8").split("\n").length <= 350,
      `${parts.join("/")} must stay at or below 350 lines`,
    );
  }
});
