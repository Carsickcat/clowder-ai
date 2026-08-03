function scoreDimensions(state, runs, decisions, verification) {
  return [
    [
      "coverage",
      "覆盖完整度",
      state.plan.generation.omissions.length ? 62 : 100,
      25,
      "检查项覆盖指导书风险面与知识图谱关键依赖。",
    ],
    [
      "integrity",
      "证据可信度",
      runs.length >= 5 && decisions.length >= 3 ? 98 : 80,
      25,
      "执行、风险与人工决策均有不可变证据标识。",
    ],
    [
      "comparability",
      "基线可比性",
      state.comparabilityContract.status === "valid" ? 96 : 45,
      20,
      state.comparabilityContract.detail,
    ],
    [
      "freshness",
      "证据新鲜度",
      state.evidenceFreshness === "fresh" ? 100 : 55,
      15,
      "最终结论使用验收窗口内的最新证据。",
    ],
    [
      "risk_closure",
      "风险闭环度",
      state.findings.length === 0 ? 100 : verification ? 92 : 40,
      15,
      verification
        ? "灰度风险已有处置决策和独立复验。"
        : "仍有风险缺少复验证据。",
    ],
  ].map(([id, label, score, weight, explanation]) => ({
    id,
    label,
    score,
    weight,
    explanation,
  }));
}

export function createReportIntelligence(state, runs, decisions) {
  const verification = runs.find((run) => run.purpose === "verification");
  const acceptance = runs.find((run) => run.purpose === "acceptance");
  const dimensions = scoreDimensions(state, runs, decisions, verification);
  const overall = Math.round(
    dimensions.reduce((sum, item) => sum + item.score * item.weight, 0) / 100,
  );
  const citations = [
    ...runs.map((run) => run.id),
    ...state.findings.map((finding) => finding.id),
    ...decisions.map((decision) => decision.id),
  ];
  const finding = state.findings.at(0);
  const riskRefs = [finding?.id, verification?.id].filter(Boolean);

  return {
    score: {
      overall,
      grade: overall >= 90 ? "A" : overall >= 80 ? "B" : "C",
      modelVersion: "nova-report-score-v1",
      dimensions,
      deductions: finding
        ? [
            {
              id: "historical-canary-risk",
              points: 8,
              reason: "25% 灰度曾出现延迟风险；虽已复验，仍保留历史扣分。",
              evidenceRefs: riskRefs,
            },
          ]
        : [],
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
      clawExplanation: `报告评分 ${overall} 分。覆盖、证据完整性、可比性和新鲜度均达标；25% 灰度的延迟风险已完成复验，但仍建议持续观察连接池容量。`,
    },
  };
}
