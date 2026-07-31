import { createCaseEvidenceId } from "./change-inspection-identifiers.mjs";

export function nextRecordId(state, kind, records) {
  return createCaseEvidenceId(state.id, kind, records.length + 1);
}

export function createReportSnapshot(state, runs, decisions) {
  const conclusion = "通过";
  const riskCount = state.findings.length;
  return {
    kind: "ReportSnapshot",
    id: nextRecordId(state, "RPT", []),
    service: state.service,
    version: state.version,
    status: "published",
    conclusion,
    title: "本次变更验收通过",
    summary: `共执行 ${runs.length} 次巡检，发现 ${riskCount} 个风险并完成复验；变更前后关键指标无异常退化。`,
    explanation: `结论为${conclusion}。25% 灰度曾出现 ${riskCount} 个延迟风险，但风险已完成复验；全量与变更后指标均在阈值内。`,
    runIds: runs.map((item) => item.id),
    findingIds: state.findings.map((item) => item.id),
    decisionIds: decisions.map((item) => item.id),
  };
}
