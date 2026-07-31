import assert from "node:assert/strict";
import test from "node:test";

import {
  changeInspectionReducer,
  createChangeInspectionState,
  getPrimaryAction,
} from "../lib/change-inspection.mjs";
import { inspectionJobTemplates } from "../lib/change-inspection-jobs.mjs";

let testExecutionSequence = 0;
const reduce = (state, type, payload = {}) =>
  changeInspectionReducer(state, {
    type,
    ...(["INTENT_SUBMITTED", "JOB_SELECTED"].includes(type) &&
    !payload.executionId
      ? { executionId: `TEST-${++testExecutionSequence}` }
      : {}),
    ...payload,
  });

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
      type === "INTENT_SUBMITTED"
        ? { text: "请巡检 payments-router v3.18.0 是否可以灰度发布" }
        : {},
    );
  }
  return state;
}

function completeSavedJob(executionId) {
  let state = createChangeInspectionState();
  state = reduce(state, "JOB_SELECTED", {
    executionId,
    jobId: "JOB-INVENTORY-RELEASE",
  });
  for (const type of [
    "PLAN_CONFIRMED",
    "CANARY_APPROVED",
    "REMEDIATION_RECORDED",
    "VERIFICATION_RAN",
    "CANARY_ADVANCED",
    "POST_CHANGE_RAN",
  ]) {
    state = reduce(state, type);
  }
  return state;
}

function persistedIds(state) {
  return new Set([
    state.id,
    ...state.runs.map((item) => item.id),
    ...state.findings.map((item) => item.id),
    ...state.decisions.map((item) => item.id),
    state.reportSnapshot.id,
  ]);
}

test("publishes a deeply immutable library of reusable inspection jobs", () => {
  const jobs = inspectionJobTemplates;

  assert.ok(Array.isArray(jobs), "the domain must export saved jobs");
  assert.ok(jobs.length >= 3, "the leader demo needs a credible job library");
  assert.ok(jobs.every((job) => job.kind === "InspectionJobTemplate"));
  assert.ok(jobs.every((job) => Object.isFrozen(job)));
  assert.ok(jobs.every((job) => Object.isFrozen(job.lastRun)));
  assert.throws(() => {
    jobs.at(0).lastRun.result = "tampered";
  }, TypeError);
});

test("selecting a saved job creates a fresh reviewable case without evidence", () => {
  const empty = createChangeInspectionState();
  const state = reduce(empty, "JOB_SELECTED", {
    jobId: "JOB-PAYMENTS-CANARY",
  });

  assert.notEqual(state, empty);
  assert.deepEqual(state.sourceJob, {
    id: "JOB-PAYMENTS-CANARY",
    name: "支付路由灰度巡检",
  });
  assert.equal(state.service, "payments-router");
  assert.equal(state.version, "v3.18.0");
  assert.equal(state.plan.status, "ready");
  assert.equal(state.plan.checks.length, 5);
  assert.equal(state.runs.length, 0);
  assert.equal(state.findings.length, 0);
  assert.equal(state.decisions.length, 0);
  assert.equal(state.baselineSnapshot, null);
  assert.equal(state.reportSnapshot, null);
  assert.equal(getPrimaryAction(state).type, "PLAN_CONFIRMED");
});

test("saved jobs cannot replace an active case but can start after completion", () => {
  let active = createChangeInspectionState();
  active = reduce(active, "JOB_SELECTED", {
    jobId: "JOB-PAYMENTS-CANARY",
  });
  active = reduce(active, "PLAN_CONFIRMED");
  const rejectedSwitch = reduce(active, "JOB_SELECTED", {
    jobId: "JOB-INVENTORY-RELEASE",
  });

  assert.equal(rejectedSwitch, active);

  const completed = completeCase();
  const next = reduce(completed, "JOB_SELECTED", {
    jobId: "JOB-INVENTORY-RELEASE",
  });
  assert.notEqual(next, completed);
  assert.equal(next.stage, "draft");
  assert.equal(next.service, "inventory-service");
  assert.equal(next.version, "v2.4");
  assert.equal(next.sourceJob.id, "JOB-INVENTORY-RELEASE");
  assert.equal(next.runs.length, 0);
  assert.equal(next.reportSnapshot, null);

  const reset = reduce(next, "CASE_RESET");
  assert.equal(reset.sourceJob, null);
  assert.equal(reset.plan.status, "empty");
});

test("repeating one saved job creates disjoint case-owned evidence ids", () => {
  const first = completeSavedJob("EXECUTION-A");
  const second = completeSavedJob("EXECUTION-B");
  const firstIds = persistedIds(first);
  const secondIds = persistedIds(second);

  assert.notEqual(first.id, second.id);
  assert.deepEqual(
    [...firstIds].filter((id) => secondIds.has(id)),
    [],
    "two executions must not share Case, Run, Finding, Decision, or Report IDs",
  );
  for (const state of [first, second]) {
    for (const id of [...persistedIds(state)].slice(1)) {
      assert.match(id, new RegExp(`^${state.id}:`));
    }
  }
});

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
  assert.equal(getPrimaryAction(state).label, "执行复验");

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

test("natural language intent creates the plan for the requested service and version", () => {
  let state = createChangeInspectionState();
  state = reduce(state, "INTENT_SUBMITTED", {
    text: "请检查 inventory-service v2.4 是否可以灰度",
  });

  assert.equal(state.service, "inventory-service");
  assert.equal(state.version, "v2.4");
  assert.equal(state.plan.status, "ready");
  assert.equal(
    state.plan.checks.at(-1).metric,
    "inventory-service.business.success.rate",
  );
  assert.match(state.conversation.at(-1).text, /inventory-service v2\.4/);
});

test("a custom service keeps one service truth through runs, findings, and report", () => {
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
      type === "INTENT_SUBMITTED"
        ? { text: "请检查 inventory-service v2.4 是否可以灰度" }
        : {},
    );
  }

  assert.equal(state.stage, "completed");
  assert.ok(state.runs.every((run) => run.service === "inventory-service"));
  assert.ok(state.runs.every((run) => run.version === "v2.4"));
  assert.match(state.findings.at(0).title, /inventory-service/);
  assert.equal(state.reportSnapshot.service, "inventory-service");
  assert.equal(state.reportSnapshot.version, "v2.4");
  assert.doesNotMatch(JSON.stringify(state), /支付成功率|支付回调/);
});

test("missing service or version asks for clarification instead of fabricating a plan", () => {
  let state = createChangeInspectionState();
  state = reduce(state, "INTENT_SUBMITTED", {
    text: "请帮我检查支付服务",
  });

  assert.equal(state.plan.status, "clarification");
  assert.equal(state.runs.length, 0);
  assert.equal(state.decision.label, "需要补充信息");
  assert.match(state.conversation.at(-1).text, /服务名和版本号/);
  assert.equal(getPrimaryAction(state).disabled, true);
});

test("an incomparable baseline blocks admission and can be restored in the same case", () => {
  let state = createChangeInspectionState();
  state = reduce(state, "INTENT_SUBMITTED", {
    text: "检查 payments-router v3.18.0",
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
  state = reduce(state, "INTENT_SUBMITTED", {
    text: "检查 payments-router v3.18.0",
  });
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

test("all persisted evidence is deeply immutable after reducer transitions", () => {
  const completed = completeCase();
  const persistedObjects = [
    completed,
    completed.baselineSnapshot,
    completed.runs,
    completed.runs.at(0),
    completed.runs.at(0).metrics,
    completed.runs.at(0).metrics.at(0),
    completed.findings,
    completed.findings.at(0),
    completed.decisions,
    completed.decisions.at(0),
    completed.reportSnapshot,
    completed.reportSnapshot.runIds,
  ];

  for (const value of persistedObjects) {
    assert.equal(Object.isFrozen(value), true);
  }
  assert.throws(() => {
    completed.runs.at(0).metrics.at(0).value = "tampered";
  }, TypeError);
  assert.throws(() => {
    completed.reportSnapshot.conclusion = "tampered";
  }, TypeError);
});
