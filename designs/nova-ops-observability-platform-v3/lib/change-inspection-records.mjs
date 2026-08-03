import { createCaseEvidenceId } from "./change-inspection-identifiers.mjs";
import { createReportIntelligence } from "./change-inspection-intelligence.mjs";

export function nextRecordId(state, kind, records) {
  return createCaseEvidenceId(state.id, kind, records.length + 1);
}

export function createReportAssessmentBasis(state) {
  const sources = state.plan.generation?.sources ?? [];
  return {
    plan: {
      status: state.plan.status,
      version: state.plan.version,
      sourceIds: sources.map((source) => source.id),
      sourceKinds: sources.map((source) => source.kind),
      checkIds: state.plan.checks.map((check) => check.id),
      omissions: (state.plan.generation?.omissions ?? []).map((omission) => ({
        id: omission.id,
        severity: omission.severity,
        title: omission.title,
        action: omission.action,
      })),
    },
    comparability: { ...state.comparabilityContract },
    freshness: state.evidenceFreshness,
  };
}

export function createReportSnapshot(state, runs, decisions) {
  const conclusion = "通过";
  const riskCount = state.findings.length;
  const intelligence = createReportIntelligence({
    runs,
    findings: state.findings,
    decisions,
  });
  return {
    kind: "ReportSnapshot",
    id: nextRecordId(state, "RPT", []),
    service: state.service,
    version: state.version,
    status: "published",
    conclusion,
    title: "本次变更验收通过",
    summary: `共执行 ${runs.length} 次巡检，发现 ${riskCount} 个风险并完成复验；变更前后关键指标无异常退化。`,
    explanation: intelligence.interpretation.clawExplanation,
    intelligence,
    runIds: runs.map((item) => item.id),
    findingIds: state.findings.map((item) => item.id),
    decisionIds: decisions.map((item) => item.id),
  };
}
