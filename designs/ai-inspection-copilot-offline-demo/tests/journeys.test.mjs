import assert from "node:assert/strict";
import test from "node:test";

import { createDemoSession, demoReducer } from "../lib/reducer.mjs";
import { getScenario } from "../lib/scenarios.mjs";
import {
  selectCommittedChecks,
  selectPlanReadiness,
  selectReportView,
  selectResolvedScope,
} from "../lib/selectors.mjs";

function dispatch(state, type, payload = {}) {
  return demoReducer(state, { type, ...payload });
}

function advanceToPlan(scenarioId) {
  let state = createDemoSession(scenarioId);
  state = dispatch(state, "INPUT_CONFIRMED");
  state = dispatch(state, "SCOPE_ACCEPTED");
  return state;
}

function finishJourney(state) {
  state = dispatch(state, "PLAN_CONFIRMED");
  const scenario = getScenario(state.scenarioId);
  for (let index = 0; index < scenario.execution.length; index += 1) {
    state = dispatch(state, "EXECUTION_ADVANCED");
  }
  return state;
}

test("natural-language journey reaches a scoped Proceed report", () => {
  let state = advanceToPlan("natural-language-pass");
  assert.equal(selectPlanReadiness(state).status, "ready");
  state = finishJourney(state);

  assert.equal(state.phase, "report");
  assert.equal(selectReportView(state).action, "Proceed");
  assert.equal(selectReportView(state).evidenceVerdict, "Verified");
  assert.match(selectReportView(state).scopeStatement, /订单提交/);
});

test("electronic-flow journey requires disposition of a critical AI candidate", () => {
  let state = advanceToPlan("change-ticket-risk");
  assert.equal(selectPlanReadiness(state).status, "blocked");
  assert.equal(selectPlanReadiness(state).unresolvedCandidateIds.length, 1);

  const unchanged = dispatch(state, "PLAN_CONFIRMED");
  assert.deepEqual(unchanged, state);

  state = dispatch(state, "CANDIDATE_DISPOSED", {
    candidateId: "candidate-db-wait",
    disposition: "accepted",
  });
  assert.equal(selectPlanReadiness(state).status, "ready");
  assert.ok(
    selectCommittedChecks(state).some(
      (check) => check.id === "candidate-db-wait",
    ),
  );

  state = finishJourney(state);
  const report = selectReportView(state);
  assert.equal(report.action, "Pause");
  assert.equal(report.evidenceVerdict, "Violated");
  assert.match(report.rcAgent.rootCause, /连接池/);
});

test("rejecting a candidate requires a reason and never executes it", () => {
  let state = advanceToPlan("change-ticket-risk");
  const withoutReason = dispatch(state, "CANDIDATE_DISPOSED", {
    candidateId: "candidate-db-wait",
    disposition: "rejected",
  });
  assert.deepEqual(withoutReason, state);

  state = dispatch(state, "CANDIDATE_DISPOSED", {
    candidateId: "candidate-db-wait",
    disposition: "rejected",
    reason: "数据库团队确认该连接池不由本次配置包管理",
  });
  assert.equal(selectPlanReadiness(state).status, "ready");
  assert.ok(
    !selectCommittedChecks(state).some(
      (check) => check.id === "candidate-db-wait",
    ),
  );
});

test("switching scenarios resets phase, dispositions, execution, and RC state", () => {
  let state = advanceToPlan("change-ticket-risk");
  state = dispatch(state, "CANDIDATE_DISPOSED", {
    candidateId: "candidate-db-wait",
    disposition: "accepted",
  });
  state = finishJourney(state);
  state = dispatch(state, "RC_TOGGLED");
  assert.equal(state.rcExpanded, true);

  state = dispatch(state, "SCENARIO_SELECTED", {
    scenarioId: "natural-language-pass",
  });
  assert.deepEqual(state, createDemoSession("natural-language-pass"));
  assert.deepEqual(state.candidateDisposition, {});
  assert.equal(state.executionStep, -1);
  assert.equal(state.rcExpanded, false);
});

test("resolved scope is derived from reconciliation, not duplicated session state", () => {
  const state = createDemoSession("change-ticket-risk");
  assert.deepEqual(selectResolvedScope(state).entities, [
    "invoice-worker",
    "payment-api",
    "settlement-db",
  ]);
  assert.equal(Object.hasOwn(state, "resolvedScope"), false);
});
