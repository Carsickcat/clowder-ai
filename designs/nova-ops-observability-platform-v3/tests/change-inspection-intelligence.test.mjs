import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import test from "node:test";

import {
  changeInspectionReducer,
  createChangeInspectionState,
} from "../lib/change-inspection.mjs";

const intelligencePath = resolve(
  import.meta.dirname,
  "../lib/change-inspection-intelligence.mjs",
);

async function loadIntelligence() {
  assert.ok(
    existsSync(intelligencePath),
    "change-inspection-intelligence.mjs must define the terminal intelligence schema",
  );
  return import(pathToFileURL(intelligencePath));
}

function reduce(state, type, extra = {}) {
  return changeInspectionReducer(state, {
    type,
    executionId: "TEST-INTEL",
    ...extra,
  });
}

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

test("a mapped change compiles all three sources into explainable checks", async () => {
  const { compileInspectionPlan } = await loadIntelligence();
  const plan = compileInspectionPlan({
    intent: "请巡检 payments-router v3.18.0 是否可以灰度发布",
    service: "payments-router",
    version: "v3.18.0",
  });

  assert.equal(plan.status, "ready");
  assert.deepEqual(
    plan.generation.sources.map((source) => source.kind),
    ["natural_language", "change_guide", "knowledge_graph"],
  );
  assert.equal(plan.generation.omissions.length, 0);
  assert.ok(plan.generation.confidence >= 0.8);
  assert.ok(plan.checks.length >= 5);

  const sourceIds = new Set(plan.generation.sources.map((source) => source.id));
  for (const check of plan.checks) {
    assert.ok(check.rationale.length > 20);
    assert.ok(check.confidence > 0 && check.confidence <= 1);
    assert.ok(check.sourceRefs.length > 0);
    assert.ok(check.sourceRefs.every((sourceRef) => sourceIds.has(sourceRef)));
  }
  assert.ok(plan.orchestration.length >= 6);
  assert.ok(plan.orchestration.some((step) => step.dependencyIds.length > 0));
});

test("an unmapped service exposes blocker omissions instead of fabricating knowledge", async () => {
  const { compileInspectionPlan } = await loadIntelligence();
  const plan = compileInspectionPlan({
    intent: "请巡检 mystery-service v1.2.0 是否可以发布",
    service: "mystery-service",
    version: "v1.2.0",
  });

  assert.equal(plan.status, "blocked");
  assert.ok(plan.generation.omissions.length >= 2);
  assert.ok(
    plan.generation.omissions.every((item) => item.severity === "blocker"),
  );
  assert.equal(plan.checks.length, 0);
  assert.deepEqual(
    plan.generation.sources.map((source) => source.kind),
    ["natural_language"],
  );
});

test("execution status is a pure projection of plan and case evidence", async () => {
  const { projectExecutionSteps } = await loadIntelligence();
  let state = createChangeInspectionState();
  state = reduce(state, "INTENT_SUBMITTED", {
    text: "请巡检 payments-router v3.18.0 是否可以灰度发布",
  });

  let steps = projectExecutionSteps(state);
  assert.equal(steps.at(0).status, "ready");
  assert.ok(steps.slice(1).every((step) => step.status === "queued"));

  state = reduce(state, "PLAN_CONFIRMED");
  steps = projectExecutionSteps(state);
  assert.equal(steps.at(0).status, "passed");

  state = reduce(state, "CANARY_APPROVED");
  steps = projectExecutionSteps(state);
  assert.equal(steps.find((step) => step.id === "canary").status, "risk");

  state = reduce(state, "REMEDIATION_RECORDED");
  state = reduce(state, "VERIFICATION_RAN");
  steps = projectExecutionSteps(state);
  assert.equal(steps.find((step) => step.id === "canary").status, "resolved");
  assert.equal(
    steps.find((step) => step.id === "verification").status,
    "passed",
  );
});

test("the immutable report contains deterministic scoring and resolvable citations", async () => {
  await loadIntelligence();
  const state = completeCase();
  const report = state.reportSnapshot;

  assert.ok(report.intelligence.score.overall >= 0);
  assert.ok(report.intelligence.score.overall <= 100);
  assert.equal(report.intelligence.score.modelVersion, "nova-report-score-v1");
  assert.deepEqual(
    report.intelligence.score.dimensions.map((dimension) => dimension.id),
    ["coverage", "integrity", "comparability", "freshness", "risk_closure"],
  );

  const evidenceIds = new Set([
    ...report.runIds,
    ...report.findingIds,
    ...report.decisionIds,
  ]);
  for (const citation of report.intelligence.interpretation.citations) {
    assert.ok(evidenceIds.has(citation));
  }

  const immutableReport = JSON.stringify(report);
  const explained = reduce(state, "REPORT_EXPLANATION_REQUESTED");
  assert.equal(JSON.stringify(explained.reportSnapshot), immutableReport);
  assert.equal(
    explained.conversation.at(-1).text,
    report.intelligence.interpretation.clawExplanation,
  );
});
