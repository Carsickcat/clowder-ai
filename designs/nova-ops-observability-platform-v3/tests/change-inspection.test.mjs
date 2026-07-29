import assert from "node:assert/strict";
import test from "node:test";

import {
  changeInspectionReducer,
  createChangeInspectionState,
  getPrimaryAction,
} from "../lib/change-inspection.mjs";

const reduce = (state, type, payload = {}) =>
  changeInspectionReducer(state, { type, ...payload });

function completeCase() {
  let state = createChangeInspectionState();
  for (const type of [
    "INTENT_SUBMITTED",
    "PLAN_CONFIRMED",
    "CANARY_APPROVED",
    "REMEDIATION_RECORDED",
    "VERIFICATION_RAN",
    "CANARY_ADVANCED",
    "POST_CHANGE_RAN",
  ]) {
    state = reduce(
      state,
      type,
      type === "INTENT_SUBMITTED" ? { text: "巡检" } : {},
    );
  }
  return state;
}

test("one case completes pre-change, canary verification, and post-change acceptance", () => {
  let state = createChangeInspectionState();

  assert.equal(state.stage, "draft");
  assert.equal(state.plan.status, "empty");

  state = reduce(state, "INTENT_SUBMITTED", {
    text: "请帮我巡检 payments-router v3.18.0 是否可以灰度发布",
  });
  assert.equal(state.plan.status, "ready");
  assert.equal(state.plan.checks.length, 5);
  assert.equal(getPrimaryAction(state).label, "确认方案并执行变更前巡检");

  state = reduce(state, "PLAN_CONFIRMED");
  assert.equal(state.stage, "pre-change");
  assert.equal(state.runs.at(-1).purpose, "admission");
  assert.equal(state.runs.at(-1).result, "passed");
  assert.equal(state.baselineSnapshot.runId, state.runs.at(-1).id);
  assert.equal(getPrimaryAction(state).label, "批准进入 25% 灰度");

  state = reduce(state, "CANARY_APPROVED");
  assert.equal(state.stage, "canary");
  assert.equal(state.canary.percent, 25);
  assert.equal(state.decision.status, "risk");
  assert.equal(getPrimaryAction(state).label, "记录处置");

  state = reduce(state, "REMEDIATION_RECORDED");
  assert.equal(state.decision.status, "working");
  assert.equal(state.runs.length, 2);
  assert.equal(getPrimaryAction(state).label, "执行 Verification Run");

  state = reduce(state, "VERIFICATION_RAN");
  assert.equal(state.runs.at(-1).purpose, "verification");
  assert.equal(state.runs.at(-1).result, "passed");
  assert.equal(state.decision.status, "passed");
  assert.equal(getPrimaryAction(state).label, "继续到 100% 放量");

  state = reduce(state, "CANARY_ADVANCED");
  assert.equal(state.stage, "post-change");
  assert.equal(state.canary.percent, 100);
  assert.equal(getPrimaryAction(state).label, "执行变更后验收");

  state = reduce(state, "POST_CHANGE_RAN");
  assert.equal(state.stage, "completed");
  assert.equal(state.runs.at(-1).purpose, "acceptance");
  assert.equal(state.reportSnapshot.status, "published");
  assert.equal(state.reportSnapshot.runIds.length, state.runs.length);
  assert.equal(state.reportSnapshot.findingIds.length, state.findings.length);
  assert.equal(state.reportSnapshot.decisionIds.length, state.decisions.length);
  assert.equal(state.reportSnapshot.title, "本次变更验收通过");
  assert.match(state.reportSnapshot.summary, /发现 1 个风险并完成复验/);
  assert.equal(getPrimaryAction(state).label, "查看最终报告");
});

test("an incomparable baseline blocks admission and can be restored in the same case", () => {
  let state = createChangeInspectionState();
  state = reduce(state, "INTENT_SUBMITTED", {
    text: "检查 payments-router",
  });
  state = reduce(state, "COMPARABILITY_INVALIDATED");
  state = reduce(state, "PLAN_CONFIRMED");

  assert.equal(state.stage, "draft");
  assert.equal(state.decision.status, "unknown");
  assert.equal(state.runs.length, 0);
  assert.equal(getPrimaryAction(state).type, "COMPARABILITY_RESTORED");
  assert.match(getPrimaryAction(state).reason, /基线不可比/);

  state = reduce(state, "COMPARABILITY_RESTORED");
  assert.equal(state.comparabilityContract.status, "valid");
  assert.equal(state.decision.status, "ready");
  assert.equal(getPrimaryAction(state).type, "PLAN_CONFIRMED");
});

test("stale evidence blocks progression and requires refresh plus a new verification run", () => {
  let state = createChangeInspectionState();
  state = reduce(state, "INTENT_SUBMITTED", { text: "检查支付服务" });
  state = reduce(state, "PLAN_CONFIRMED");
  state = reduce(state, "CANARY_APPROVED");
  state = reduce(state, "REMEDIATION_RECORDED");
  state = reduce(state, "VERIFICATION_RAN");

  const immutableRunSnapshot = JSON.stringify(state.runs);
  state = reduce(state, "EVIDENCE_BECAME_STALE");
  state = reduce(state, "CANARY_ADVANCED");

  assert.equal(state.stage, "canary");
  assert.equal(state.decision.status, "unknown");
  assert.equal(JSON.stringify(state.runs), immutableRunSnapshot);
  assert.equal(getPrimaryAction(state).type, "EVIDENCE_REFRESHED");
  assert.match(getPrimaryAction(state).reason, /证据已过期/);

  state = reduce(state, "EVIDENCE_REFRESHED");
  assert.equal(state.evidenceFreshness, "fresh");
  assert.equal(state.decision.status, "working");
  assert.equal(JSON.stringify(state.runs), immutableRunSnapshot);
  assert.equal(getPrimaryAction(state).type, "VERIFICATION_RAN");

  state = reduce(state, "VERIFICATION_RAN");
  assert.equal(state.runs.length, 4);
  assert.equal(state.runs.at(-1).purpose, "verification");
  assert.equal(state.decision.status, "passed");
});

test("reset creates a clean case after a non-happy-path demonstration", () => {
  let state = createChangeInspectionState();
  state = reduce(state, "COMPARABILITY_INVALIDATED");
  state = reduce(state, "CASE_RESET");

  assert.equal(state.stage, "draft");
  assert.equal(state.plan.status, "empty");
  assert.equal(state.comparabilityContract.status, "valid");
  assert.equal(state.decision.status, "waiting");
});

test("Claw explains the final report without changing the completed case", () => {
  let state = completeCase();
  const runCount = state.runs.length;
  state = reduce(state, "REPORT_EXPLANATION_REQUESTED");

  assert.equal(state.stage, "completed");
  assert.equal(state.runs.length, runCount);
  assert.match(state.conversation.at(-1).text, /风险已完成复验/);
});

test("completed cases reject draft mutations and preserve their report truth", () => {
  const completed = completeCase();
  let state = reduce(completed, "INTENT_SUBMITTED", { text: "覆盖旧方案" });
  state = reduce(state, "COMPARABILITY_INVALIDATED");
  state = reduce(state, "PLAN_CONFIRMED");

  assert.equal(state, completed);
  assert.equal(state.decision.label, "验收通过");
  assert.equal(state.reportSnapshot.status, "published");
  assert.equal(state.runs.length, 5);
});

test("report explanation is projected from the immutable report snapshot", () => {
  const completed = completeCase();
  const alteredReport = {
    ...completed,
    reportSnapshot: {
      ...completed.reportSnapshot,
      explanation: "来自快照的独立解释",
    },
  };
  const explained = reduce(alteredReport, "REPORT_EXPLANATION_REQUESTED");

  assert.equal(explained.conversation.at(-1).text, "来自快照的独立解释");
});
