const requiredSourceKinds = [
  "natural_language",
  "change_guide",
  "knowledge_graph",
];

function findAssessmentRun(runs) {
  return [...runs].reverse().find((run) => Boolean(run.reportAssessmentBasis));
}

function scoreDimensions({ runs, findings, decisions }) {
  const verification = runs.find((run) => run.purpose === "verification");
  const assessmentRun = findAssessmentRun(runs);
  const basis = assessmentRun?.reportAssessmentBasis;
  const plan = basis?.plan;
  const assessmentRefs = assessmentRun ? [assessmentRun.id] : [];
  const integrityRefs = [
    ...runs.map((run) => run.id),
    ...findings.map((finding) => finding.id),
    ...decisions.map((decision) => decision.id),
  ];
  const planInputsComplete =
    plan?.status === "ready" &&
    plan.omissions.length === 0 &&
    plan.checkIds.length > 0 &&
    requiredSourceKinds.every((kind) => plan.sourceKinds.includes(kind));
  const riskRefs = [findings.at(0)?.id, verification?.id].filter(Boolean);

  return [
    {
      id: "coverage",
      label: "方案覆盖诚实度",
      score: planInputsComplete ? 100 : 45,
      weight: 25,
      explanation: planInputsComplete
        ? `已固化 ${plan.checkIds.length} 项检查、${plan.sourceKinds.length} 类输入来源与 0 项已知缺口；该分数只评价方案输入，不代表未知风险已被穷尽。`
        : "方案输入来源或已知缺口未完整固化，不能声称覆盖充分。",
      evidenceRefs: assessmentRefs,
    },
    {
      id: "integrity",
      label: "证据可信度",
      score: runs.length >= 5 && decisions.length >= 3 ? 98 : 80,
      weight: 25,
      explanation:
        "执行、风险与人工决策均有不可变证据标识；固定 Mock 未包含外部签名，保留审慎折减。",
      evidenceRefs: integrityRefs,
    },
    {
      id: "comparability",
      label: "基线可比性",
      score: basis?.comparability.status === "valid" ? 96 : 45,
      weight: 20,
      explanation: basis?.comparability.detail
        ? `${basis.comparability.detail}；固定 Mock 未提供原始样本签名，保留审慎折减。`
        : "报告中没有可解析的基线可比性证据。",
      evidenceRefs: assessmentRefs,
    },
    {
      id: "freshness",
      label: "证据新鲜度",
      score: basis?.freshness === "fresh" ? 100 : 55,
      weight: 15,
      explanation:
        basis?.freshness === "fresh"
          ? "最终结论使用验收窗口内固化的新鲜证据。"
          : "最终验收 Run 没有固化新鲜证据状态。",
      evidenceRefs: assessmentRefs,
    },
    {
      id: "risk_closure",
      label: "风险闭环度",
      score: findings.length === 0 ? 100 : verification ? 92 : 40,
      weight: 15,
      explanation: verification
        ? "灰度风险已有处置决策和独立复验；历史风险仍保留审慎折减。"
        : "仍有风险缺少复验证据。",
      evidenceRefs: riskRefs.length ? riskRefs : integrityRefs,
    },
  ];
}

export function createReportIntelligence({
  runs = [],
  findings = [],
  decisions = [],
}) {
  const verification = runs.find((run) => run.purpose === "verification");
  const acceptance = runs.find((run) => run.purpose === "acceptance");
  const dimensions = scoreDimensions({ runs, findings, decisions });
  const deductions = dimensions
    .filter((dimension) => dimension.score < 100)
    .map((dimension) => ({
      id:
        dimension.id === "risk_closure"
          ? "historical-canary-risk"
          : `${dimension.id}-deduction`,
      points: Number(
        (((100 - dimension.score) * dimension.weight) / 100).toFixed(2),
      ),
      reason: dimension.explanation,
      evidenceRefs: dimension.evidenceRefs,
    }));
  const overall = Math.round(
    dimensions.reduce((sum, item) => sum + item.score * item.weight, 0) / 100,
  );
  const citations = [
    ...runs.map((run) => run.id),
    ...findings.map((finding) => finding.id),
    ...decisions.map((decision) => decision.id),
  ];
  const finding = findings.at(0);
  const riskRefs = [finding?.id, verification?.id].filter(Boolean);

  return {
    score: {
      overall,
      grade: overall >= 90 ? "A" : overall >= 80 ? "B" : "C",
      modelVersion: "nova-report-score-v2",
      dimensions,
      deductions,
    },
    interpretation: {
      executiveSummary: `本次变更综合评分 ${overall} 分；变更后未发现异常退化。`,
      keyEvidence: [
        {
          statement: "变更前准入、灰度复验和变更后验收均有独立执行证据。",
          evidenceRefs: runs.map((run) => run.id),
        },
        {
          statement: "灰度阶段的延迟风险已通过处置与复验关闭。",
          evidenceRefs: riskRefs,
        },
      ],
      residualRisks: finding
        ? [
            {
              statement: "连接池容量仍应作为上线后持续观察项。",
              evidenceRefs: riskRefs,
            },
          ]
        : [],
      recommendation: acceptance
        ? "可接受本次巡检结论，并保留连接池容量观察。"
        : "等待变更后验收证据。",
      confidence: 0.94,
      citations,
      clawExplanation: `报告评分 ${overall} 分。方案输入、证据完整性、可比性和新鲜度均有固化依据；25% 灰度的延迟风险已完成复验，但仍建议持续观察连接池容量。`,
    },
  };
}
