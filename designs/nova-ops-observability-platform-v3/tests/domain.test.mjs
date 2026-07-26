import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialState,
  getPlanPublishBlockers,
  reduceOpsState,
} from "../lib/domain.mjs";

test("SRE navigation opens only governed operational objects", () => {
  let state = createInitialState();

  assert.equal(state.activeObject, null);
  state = reduceOpsState(state, {
    type: "OBJECT_OPEN",
    objectType: "change",
    objectId: "CHG-23841",
  });
  assert.deepEqual(state.activeObject, {
    type: "change",
    id: "CHG-23841",
  });
  assert.equal(state.currentScreen, "change");

  state = reduceOpsState(state, {
    type: "OBJECT_OPEN",
    objectType: "report",
    objectId: "RPT-CHG-23841",
  });
  assert.equal(state.currentScreen, "change");
  assert.equal(state.audit.at(-1).action, "object.open.rejected");

  state = reduceOpsState(state, { type: "OBJECT_CLOSE" });
  assert.equal(state.currentScreen, "home");
  assert.equal(state.activeObject, null);
});

test("Incident preserves source provenance and cannot close the source object", () => {
  let state = createInitialState();
  state = reduceOpsState(state, {
    type: "INCIDENT_ESCALATED",
    sourceObject: { type: "change", id: "CHG-23841" },
    findingId: "FND-8821",
  });

  assert.equal(state.currentScreen, "investigation");
  assert.deepEqual(state.activeObject, {
    type: "incident",
    id: "INC-7719",
  });
  assert.deepEqual(state.investigation.sourceObject, {
    type: "change",
    id: "CHG-23841",
  });
  assert.equal(state.change.status, "blocked");

  state = reduceOpsState(state, { type: "ACTION_PROPOSAL_WRITTEN_BACK" });
  assert.equal(state.investigation.writeback, null);
  assert.equal(state.audit.at(-1).action, "action-proposal.writeback.rejected");

  state = reduceOpsState(state, {
    type: "HYPOTHESIS_TEST_RUN",
    hypothesisId: "H1",
  });
  state = reduceOpsState(state, {
    type: "HYPOTHESIS_CONFIRMED",
    hypothesisId: "H1",
  });
  state = reduceOpsState(state, { type: "ACTION_PROPOSAL_WRITTEN_BACK" });

  assert.equal(state.investigation.writeback.status, "written_back");
  assert.equal(state.investigation.writeback.targetFindingId, "FND-8821");
  assert.equal(
    state.findings.find((finding) => finding.id === "FND-8821").status,
    "pending_action",
  );
  assert.equal(state.change.status, "blocked");
  assert.notEqual(state.change.verification.status, "passed");
});

test("NL2 plan cannot publish until every gate, replay, and approval are ready", () => {
  let state = createInitialState();

  state = reduceOpsState(state, { type: "PLAN_PUBLISH" });
  assert.equal(state.inspectionPlan.status, "draft");
  assert.deepEqual(getPlanPublishBlockers(state), [
    "permission",
    "baseline",
    "replay",
    "approval",
  ]);
  assert.equal(state.audit.at(-1).action, "plan.publish.rejected");

  state = reduceOpsState(state, {
    type: "PLAN_GATE_RESOLVED",
    gate: "permission",
  });
  state = reduceOpsState(state, {
    type: "PLAN_GATE_RESOLVED",
    gate: "baseline",
  });
  state = reduceOpsState(state, { type: "PLAN_REPLAY_COMPLETED" });
  state = reduceOpsState(state, { type: "PLAN_APPROVED" });
  state = reduceOpsState(state, { type: "PLAN_PUBLISH" });

  assert.equal(state.inspectionPlan.status, "published");
  assert.equal(state.agentRuns.at(-1).kind, "inspection");
  assert.equal(state.agentRuns.at(-1).status, "running");
});

test("recovering evidence cannot close a finding or turn a journey healthy", () => {
  let state = createInitialState();
  state = reduceOpsState(state, {
    type: "CHANGE_DECISION_SET",
    decision: "rollback",
  });
  state = reduceOpsState(state, { type: "CHANGE_ACTION_COMPLETED" });
  state = reduceOpsState(state, { type: "VERIFICATION_START" });
  state = reduceOpsState(state, { type: "VERIFICATION_EVALUATE" });

  assert.equal(state.change.verification.status, "blocked");

  state = reduceOpsState(state, { type: "SYNTHETIC_RECOVERY_STARTED" });
  assert.equal(state.change.verification.status, "blocked");
  assert.equal(
    state.journeys.find((item) => item.id === "order-query").health,
    "unknown",
  );
  assert.notEqual(
    state.findings.find((item) => item.id === "FND-8828").status,
    "closed",
  );

  state = reduceOpsState(state, { type: "SYNTHETIC_RECOVERED" });
  assert.equal(
    state.journeys.find((item) => item.id === "order-query").health,
    "unknown",
  );
  assert.notEqual(
    state.findings.find((item) => item.id === "FND-8828").status,
    "closed",
  );

  state = reduceOpsState(state, { type: "VERIFICATION_EVALUATE" });
  assert.equal(state.change.verification.status, "passed");
  assert.equal(state.change.status, "passed");
  assert.equal(
    state.change.objectiveRows.every((row) => row.status === "pass"),
    true,
  );
  assert.equal(
    state.journeys.find((item) => item.id === "order-query").health,
    "healthy",
  );
  assert.equal(
    state.findings.find((item) => item.id === "FND-8828").status,
    "closed",
  );

  state = reduceOpsState(state, {
    type: "CHANGE_DECISION_SET",
    decision: "observe",
  });
  assert.equal(state.change.status, "passed");
  assert.equal(state.audit.at(-1).action, "change.decision.rejected");
});

test("verification cannot start before the selected remediation finishes", () => {
  let state = createInitialState();
  state = reduceOpsState(state, { type: "VERIFICATION_START" });
  assert.equal(state.change.verification.status, "not_started");
  assert.equal(state.audit.at(-1).action, "verification.start.rejected");

  state = reduceOpsState(state, {
    type: "CHANGE_DECISION_SET",
    decision: "rollback",
  });
  assert.equal(state.change.actionState, "in_progress");
  state = reduceOpsState(state, { type: "CHANGE_ACTION_COMPLETED" });

  assert.equal(state.change.status, "awaiting_verification");
  assert.equal(state.change.actionState, "completed");
  assert.equal(
    state.change.objectiveRows
      .filter((row) => row.name !== "华南拨测")
      .every((row) => row.status === "pass"),
    true,
  );
  assert.equal(
    state.change.objectiveRows.find((row) => row.name === "华南拨测").status,
    "unknown",
  );
});

test("pinning evidence changes the investigation and public timeline", () => {
  const initial = createInitialState();
  const state = reduceOpsState(initial, {
    type: "INVESTIGATION_EVIDENCE_PINNED",
    lens: "logs",
    evidenceId: "LOG-991",
  });

  assert.equal(
    state.investigation.evidence.length,
    initial.investigation.evidence.length + 1,
  );
  assert.equal(state.investigation.observations.at(-1).source, "logs");
  assert.equal(state.timeline.at(-1).kind, "evidence");
});

test("inconclusive creates a governed follow-up inspection draft", () => {
  let state = createInitialState();
  state = reduceOpsState(state, {
    type: "INVESTIGATION_CONCLUDE_INCONCLUSIVE",
  });

  assert.equal(state.investigation.status, "inconclusive");
  assert.equal(state.followUpChecks.at(-1).status, "draft");
  assert.equal(
    state.followUpChecks.at(-1).sourceInvestigation,
    state.investigation.id,
  );
});

test("raising mission frequency changes run policy, cost, and audit", () => {
  const initial = createInitialState();
  const state = reduceOpsState(initial, {
    type: "MISSION_FREQUENCY_CHANGED",
    frequency: "1m",
  });

  assert.equal(state.mission.frequency, "1m");
  assert.ok(
    state.mission.estimatedDailyCost > initial.mission.estimatedDailyCost,
  );
  assert.equal(state.audit.at(-1).action, "mission.frequency.changed");
});
