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

test("Incident preserves source provenance and routes Change remediation back to Guard", () => {
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

  assert.equal(state.investigation.writeback, null);
  assert.equal(state.audit.at(-1).action, "action-proposal.writeback.rejected");
  assert.equal(
    state.findings.find((finding) => finding.id === "FND-8821").status,
    "investigating",
  );
  assert.equal(state.change.status, "blocked");
  assert.notEqual(state.change.verification.status, "passed");

  state = reduceOpsState(state, {
    type: "CHANGE_DECISION_SET",
    decision: "rollback",
  });
  assert.equal(state.change.actionState, "in_progress");
  assert.equal(state.investigation.actionProposal.status, "approved");
});

test("a new Incident cannot reuse an ActionProposal from another source object", () => {
  let state = createInitialState();
  state = reduceOpsState(state, {
    type: "INCIDENT_ESCALATED",
    sourceObject: { type: "change", id: "CHG-23841" },
    findingId: "FND-8821",
  });
  state = reduceOpsState(state, {
    type: "HYPOTHESIS_TEST_RUN",
    hypothesisId: "H1",
  });
  state = reduceOpsState(state, {
    type: "HYPOTHESIS_CONFIRMED",
    hypothesisId: "H1",
  });
  assert.ok(state.investigation.actionProposal);

  state = reduceOpsState(state, {
    type: "INCIDENT_ESCALATED",
    sourceObject: { type: "mission", id: "MIS-61801" },
    findingId: "FND-8832",
  });

  assert.equal(state.investigation.actionProposal, null);
  assert.equal(
    state.findings.find((finding) => finding.id === "FND-8832").status,
    "open",
  );

  state = reduceOpsState(state, {
    type: "HYPOTHESIS_TEST_RUN",
    hypothesisId: "H1",
  });
  state = reduceOpsState(state, {
    type: "HYPOTHESIS_CONFIRMED",
    hypothesisId: "H1",
  });

  assert.deepEqual(state.investigation.actionProposal.sourceObject, {
    type: "mission",
    id: "MIS-61801",
  });
  assert.equal(
    state.investigation.actionProposal.investigationId,
    state.investigation.id,
  );
  assert.equal(state.investigation.actionProposal.sourceFindingId, "FND-8832");

  state = reduceOpsState(state, { type: "ACTION_PROPOSAL_WRITTEN_BACK" });
  assert.equal(
    state.findings.find((finding) => finding.id === "FND-8832").status,
    "pending_action",
  );
  assert.equal(
    state.findings.find((finding) => finding.id === "FND-8821").status,
    "investigating",
  );
});

test("object boundaries reject unknown object ids and mismatched findings", () => {
  let state = createInitialState();

  state = reduceOpsState(state, {
    type: "OBJECT_OPEN",
    objectType: "mission",
    objectId: "MIS-UNKNOWN",
  });
  assert.equal(state.activeObject, null);
  assert.equal(state.audit.at(-1).action, "object.open.rejected");

  state = reduceOpsState(state, {
    type: "INCIDENT_ESCALATED",
    sourceObject: { type: "mission", id: "MIS-61801" },
    findingId: "FND-8821",
  });
  assert.equal(state.investigation.sourceObject, null);
  assert.equal(state.audit.at(-1).action, "incident.escalation.rejected");
});

test("writeback rejects a target Finding owned by a different source object", () => {
  let state = createInitialState();
  state = reduceOpsState(state, {
    type: "INCIDENT_ESCALATED",
    sourceObject: { type: "change", id: "CHG-23841" },
    findingId: "FND-8821",
  });
  state = reduceOpsState(state, {
    type: "HYPOTHESIS_TEST_RUN",
    hypothesisId: "H1",
  });
  state = reduceOpsState(state, {
    type: "HYPOTHESIS_CONFIRMED",
    hypothesisId: "H1",
  });

  state.investigation.sourceFindingId = "FND-8832";
  state.investigation.actionProposal.sourceFindingId = "FND-8832";
  state = reduceOpsState(state, { type: "ACTION_PROPOSAL_WRITTEN_BACK" });

  assert.equal(
    state.findings.find((finding) => finding.id === "FND-8832").status,
    "open",
  );
  assert.equal(state.investigation.writeback, null);
  assert.equal(state.audit.at(-1).action, "action-proposal.writeback.rejected");
});

test("Change report requests remain source-linked but cannot start outside Change Guard", () => {
  let state = createInitialState();
  const initialRunCount = state.agentRuns.length;

  state = reduceOpsState(state, {
    type: "REPORT_VERIFICATION_REQUESTED",
    reportId: "RPT-CHG-23841",
  });

  const requests = state.verificationRequests.filter(
    (request) => request.reportId === "RPT-CHG-23841",
  );
  assert.equal(requests.length, 3);
  assert.equal(state.agentRuns.length, initialRunCount);
  assert.equal(
    requests.every(
      (request) =>
        request.status === "requested" &&
        request.sourceObject.type === "change" &&
        request.sourceObject.id === "CHG-23841" &&
        request.sourceFindingId,
    ),
    true,
  );

  state = reduceOpsState(state, {
    type: "INSPECTION_VERIFICATION_STARTED",
    requestId: requests[0].id,
  });
  assert.equal(state.agentRuns.length, initialRunCount);
  assert.equal(
    state.verificationRequests.find((request) => request.id === requests[0].id)
      .status,
    "requested",
  );
  assert.equal(
    state.audit.at(-1).action,
    "verification.request.start.rejected",
  );
});

test("Mission verification requires a bound remediation receipt and structured source evidence", () => {
  let state = createInitialState();
  state = reduceOpsState(state, {
    type: "INCIDENT_ESCALATED",
    sourceObject: { type: "mission", id: "MIS-61801" },
    findingId: "FND-8832",
  });
  state = reduceOpsState(state, {
    type: "HYPOTHESIS_TEST_RUN",
    hypothesisId: "H1",
  });
  state = reduceOpsState(state, {
    type: "HYPOTHESIS_CONFIRMED",
    hypothesisId: "H1",
  });
  state = reduceOpsState(state, { type: "ACTION_PROPOSAL_WRITTEN_BACK" });

  const request = state.verificationRequests.at(-1);
  assert.equal(request.status, "awaiting_remediation");

  state = reduceOpsState(state, {
    type: "INSPECTION_VERIFICATION_STARTED",
    requestId: request.id,
  });
  assert.equal(
    state.audit.at(-1).action,
    "verification.request.start.rejected",
  );

  state = reduceOpsState(state, {
    type: "SOURCE_REMEDIATION_RECORDED",
    sourceObject: { type: "mission", id: "MIS-61801" },
    findingId: "FND-8832",
    evidenceIds: ["ACTION-RUN-MIS-61801-01"],
  });
  const receipt = state.remediationReceipts.at(-1);
  assert.equal(receipt.status, "completed");
  assert.equal(
    state.verificationRequests.find((item) => item.id === request.id).status,
    "requested",
  );
  assert.equal(
    state.findings.find((finding) => finding.id === "FND-8832").status,
    "awaiting_verification",
  );

  state = reduceOpsState(state, {
    type: "INSPECTION_VERIFICATION_STARTED",
    requestId: request.id,
  });
  const run = state.agentRuns.at(-1);
  assert.equal(run.requestId, request.id);
  assert.equal(run.remediationReceiptId, receipt.id);
  assert.deepEqual(run.sourceEvidenceIds, receipt.evidenceIds);

  state = reduceOpsState(state, {
    type: "INSPECTION_VERIFICATION_EVALUATED",
    requestId: request.id,
    result: "passed",
  });
  assert.equal(
    state.verificationRequests.find((item) => item.id === request.id).status,
    "running",
  );
  assert.equal(
    state.findings.find((finding) => finding.id === "FND-8832").status,
    "awaiting_verification",
  );
  assert.equal(
    state.audit.at(-1).action,
    "verification.request.evaluate.rejected",
  );

  state = reduceOpsState(state, {
    type: "INSPECTION_VERIFICATION_EVALUATED",
    requestId: request.id,
    assessment: {
      gates: {
        coverage: "pass",
        freshness: "pass",
        execution: "pass",
        objectives: "pass",
      },
      evidenceIds: ["VERIFY-MIS-61801-POST-ACTION"],
    },
  });
  assert.equal(
    state.verificationRequests.find((item) => item.id === request.id).status,
    "passed",
  );
  assert.equal(
    state.findings.find((finding) => finding.id === "FND-8832").status,
    "closed",
  );
});

test("report and Incident writeback converge on one source-bound verification request", () => {
  let state = createInitialState();
  state = reduceOpsState(state, {
    type: "REPORT_VERIFICATION_REQUESTED",
    reportId: "RPT-618-07",
  });
  state = reduceOpsState(state, {
    type: "INCIDENT_ESCALATED",
    sourceObject: { type: "mission", id: "MIS-61801" },
    findingId: "FND-8832",
  });
  state = reduceOpsState(state, {
    type: "HYPOTHESIS_TEST_RUN",
    hypothesisId: "H1",
  });
  state = reduceOpsState(state, {
    type: "HYPOTHESIS_CONFIRMED",
    hypothesisId: "H1",
  });
  state = reduceOpsState(state, { type: "ACTION_PROPOSAL_WRITTEN_BACK" });

  const sourceRequests = state.verificationRequests.filter(
    (request) =>
      request.sourceObject.type === "mission" &&
      request.sourceObject.id === "MIS-61801" &&
      request.sourceFindingId === "FND-8832" &&
      ["awaiting_remediation", "requested", "running"].includes(request.status),
  );
  assert.equal(sourceRequests.length, 1);
  assert.equal(sourceRequests[0].reportId, "RPT-618-07");
  assert.deepEqual(sourceRequests[0].reportIds, ["RPT-618-07"]);
  assert.deepEqual(sourceRequests[0].reasons, [
    "report_reverification",
    "action_proposal_writeback",
  ]);
  assert.equal(
    state.investigation.writeback.verificationRequestId,
    sourceRequests[0].id,
  );
});

test("a historical report cannot requeue Findings already closed at the source", () => {
  let state = createInitialState();
  state.findings = state.findings.map((finding) =>
    finding.source === "CHG-23841" ? { ...finding, status: "closed" } : finding,
  );

  state = reduceOpsState(state, {
    type: "REPORT_VERIFICATION_REQUESTED",
    reportId: "RPT-CHG-23841",
  });

  assert.equal(
    state.verificationRequests.filter(
      (request) => request.reportId === "RPT-CHG-23841",
    ).length,
    0,
  );
  assert.equal(
    state.audit.at(-1).action,
    "report.verification.request.rejected",
  );
});

test("Change Guard owns report-linked verification request completion", () => {
  let state = createInitialState();
  state = reduceOpsState(state, {
    type: "REPORT_VERIFICATION_REQUESTED",
    reportId: "RPT-CHG-23841",
  });
  const requestIds = state.verificationRequests.map((request) => request.id);

  state = reduceOpsState(state, {
    type: "CHANGE_DECISION_SET",
    decision: "rollback",
  });
  state = reduceOpsState(state, { type: "CHANGE_ACTION_COMPLETED" });
  state = reduceOpsState(state, { type: "VERIFICATION_START" });

  assert.equal(
    state.verificationRequests
      .filter((request) => requestIds.includes(request.id))
      .every((request) => request.status === "running" && request.runId),
    true,
  );

  state = reduceOpsState(state, { type: "VERIFICATION_EVALUATE" });
  assert.equal(
    state.verificationRequests.find((request) => request.id === requestIds[0])
      .status,
    "blocked",
  );
});

test("report projections retain immutable Run, Assessment, and PlanVersion snapshots", () => {
  let state = createInitialState();
  const report = state.reports.find((item) => item.id === "RPT-CHG-23841");
  assert.equal(report.snapshot.runId, "VR-2898");
  assert.equal(report.snapshot.planVersion, 12);
  assert.deepEqual(report.snapshot.sourceObject, {
    type: "change",
    id: "CHG-23841",
  });
  assert.equal(report.snapshot.findings.length, 3);
  const snapshot = structuredClone(report.snapshot);

  state = reduceOpsState(state, {
    type: "INVESTIGATION_EVIDENCE_PINNED",
    lens: "logs",
    evidenceId: "LOG-NEW-1001",
  });
  state = reduceOpsState(state, {
    type: "FINDING_CLAIMED",
    findingId: "FND-8828",
    owner: "synthetics-oncall",
  });

  assert.deepEqual(
    state.reports.find((item) => item.id === "RPT-CHG-23841").snapshot,
    snapshot,
  );
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
