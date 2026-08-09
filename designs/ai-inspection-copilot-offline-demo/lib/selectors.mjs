import { assertCheckContract } from "./domain.mjs";
import { getScenario } from "./scenarios.mjs";

function requireScenario(state) {
  const scenario = getScenario(state.scenarioId);
  if (!scenario) throw new Error(`Unknown scenario ${state.scenarioId}`);
  return scenario;
}

export function selectResolvedScope(state) {
  const scenario = requireScenario(state);
  return {
    status: scenario.reconciliation.status,
    entities: scenario.reconciliation.resolvedEntities,
    addedEntities: scenario.reconciliation.addedEntities,
  };
}

export function selectPlanReadiness(state) {
  const scenario = requireScenario(state);
  const unresolvedCandidateIds = scenario.candidateChecks
    .filter(
      (candidate) =>
        candidate.criticality === "high" &&
        !["accepted", "rejected"].includes(
          state.candidateDisposition[candidate.id]?.status,
        ),
    )
    .map((candidate) => candidate.id);
  const reconciliationBlocked = ["Conflict", "Unverifiable"].includes(
    scenario.reconciliation.status,
  );
  return {
    status:
      reconciliationBlocked || unresolvedCandidateIds.length
        ? "blocked"
        : "ready",
    unresolvedCandidateIds,
    reconciliationBlocked,
  };
}

export function selectCommittedChecks(state) {
  const scenario = requireScenario(state);
  const acceptedCandidates = scenario.candidateChecks.filter(
    (candidate) =>
      state.candidateDisposition[candidate.id]?.status === "accepted",
  );
  const checks = [...scenario.committedChecks, ...acceptedCandidates];
  const sourceIds = new Set(scenario.contextSources.map((source) => source.id));
  for (const check of checks) assertCheckContract(check, sourceIds);
  return checks;
}

export function selectPlanSummary(state) {
  const scenario = requireScenario(state);
  const dispositions = state.candidateDisposition;
  return {
    required: scenario.committedChecks.filter(
      (check) => check.priority === "required",
    ).length,
    recommended: scenario.candidateChecks.filter(
      (candidate) => dispositions[candidate.id]?.status === "accepted",
    ).length,
    pending: scenario.candidateChecks.filter(
      (candidate) => !dispositions[candidate.id],
    ).length,
    rejected: scenario.candidateChecks.filter(
      (candidate) => dispositions[candidate.id]?.status === "rejected",
    ).length,
  };
}

export function selectExecutionView(state) {
  const scenario = requireScenario(state);
  return scenario.execution.map((step, index) => ({
    ...step,
    progress:
      state.phase === "report" || index <= state.executionStep
        ? "complete"
        : index === state.executionStep + 1 && state.phase === "execution"
          ? "active"
          : "queued",
  }));
}

export function selectReportView(state) {
  const scenario = requireScenario(state);
  return state.phase === "report" ? scenario.report : null;
}

export function selectViewModel(state) {
  const scenario = requireScenario(state);
  return {
    state,
    scenario,
    scope: selectResolvedScope(state),
    readiness: selectPlanReadiness(state),
    committedChecks: selectCommittedChecks(state),
    planSummary: selectPlanSummary(state),
    execution: selectExecutionView(state),
    report: selectReportView(state),
  };
}
