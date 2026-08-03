import type {
  InspectionABComparability,
  InspectionABReport,
  InspectionCandidateSet,
  InspectionDecisionRecord,
  InspectionReportDimension,
  InspectionReportIntelligence,
  InspectionRun,
} from '@cat-cafe/shared';

export interface CreateInspectionReportIntelligenceInput {
  readonly runs: readonly InspectionRun[];
  readonly decisions: readonly InspectionDecisionRecord[];
  readonly candidateSet: InspectionCandidateSet | null;
  readonly abReport: InspectionABReport | null;
  readonly generatedAt: string;
}

const MAX_FRESH_AGE_MS = 15 * 60 * 1_000;

function evidenceIds(input: CreateInspectionReportIntelligenceInput): string[] {
  return [...input.runs.map((run) => run.id), ...input.decisions.map((decision) => decision.id)];
}

function lastEvidenceRefs(input: CreateInspectionReportIntelligenceInput): string[] {
  return input.runs.length > 0
    ? [input.runs[input.runs.length - 1].id]
    : input.decisions.length > 0
      ? [input.decisions[input.decisions.length - 1].id]
      : [];
}

function isFresh(run: InspectionRun): boolean {
  if (!run.sourceSnapshot) return false;
  const observedAtMs = Date.parse(run.sourceSnapshot.observedAt);
  const evaluatedAtMs = Date.parse(run.finishedAt ?? run.startedAt);
  return (
    Number.isFinite(observedAtMs) &&
    Number.isFinite(evaluatedAtMs) &&
    observedAtMs <= evaluatedAtMs &&
    evaluatedAtMs - observedAtMs <= MAX_FRESH_AGE_MS
  );
}

function riskClosure(input: CreateInspectionReportIntelligenceInput): {
  readonly score: number;
  readonly refs: readonly string[];
  readonly resolved: boolean;
} {
  let riskIndex = -1;
  for (let index = input.runs.length - 1; index >= 0; index -= 1) {
    if (input.runs[index].verdict === 'risk') {
      riskIndex = index;
      break;
    }
  }
  if (riskIndex < 0) {
    return { score: 100, refs: lastEvidenceRefs(input), resolved: true };
  }
  const laterVerification = input.runs
    .slice(riskIndex + 1)
    .find(
      (run) =>
        run.status === 'completed' &&
        run.verdict === 'passed' &&
        (run.purpose === 'verification' || run.purpose === 'post_change'),
    );
  return {
    score: laterVerification ? 92 : 40,
    refs: [input.runs[riskIndex].id, ...(laterVerification ? [laterVerification.id] : [])],
    resolved: Boolean(laterVerification),
  };
}

function coverageDimension(
  input: CreateInspectionReportIntelligenceInput,
  evidenceRefs: readonly string[],
): InspectionReportDimension {
  const hasCompleteCoverage = Boolean(input.candidateSet) && input.candidateSet?.coverageOmissions.length === 0;
  return {
    id: 'coverage',
    label: '方案覆盖诚实度',
    score: hasCompleteCoverage ? 100 : 45,
    weight: 25,
    explanation: hasCompleteCoverage
      ? '候选方案、拓扑来源和已知遗漏已冻结，当前没有未披露的覆盖缺口。'
      : '候选方案缺失或仍有覆盖遗漏，不能把局部通过解释为完整覆盖。',
    evidenceRefs,
  };
}

function integrityDimension(
  input: CreateInspectionReportIntelligenceInput,
  evidenceRefs: readonly string[],
): InspectionReportDimension {
  const completeEvidence =
    input.runs.length > 0 &&
    input.runs.every(
      (run) =>
        run.status === 'completed' &&
        run.sourceSnapshot !== null &&
        Boolean(run.sourceSnapshot.snapshotHash?.length) &&
        run.checkResults.length > 0,
    );
  return {
    id: 'integrity',
    label: '证据可信度',
    score: completeEvidence ? 98 : 55,
    weight: 25,
    explanation: completeEvidence
      ? '每次运行都有服务端来源快照、查询摘要和检查结果；本地 replay 未提供外部签名，保留审慎折减。'
      : '至少一次运行缺少可重建的服务端来源快照或检查结果。',
    evidenceRefs,
  };
}

function comparabilityDimension(
  input: CreateInspectionReportIntelligenceInput,
  evidenceRefs: readonly string[],
): InspectionReportDimension {
  const comparability: InspectionABComparability = input.abReport?.comparability ?? 'unavailable';
  const comparisonRequired = input.runs.at(-1)?.purpose === 'post_change';
  const comparisonScore = comparisonRequired ? (comparability === 'valid' ? 96 : 45) : 100;
  let explanation = '当前报告阶段不要求 A/B 比较；该维度不作扣分。';
  if (comparisonRequired) {
    explanation =
      comparability === 'valid'
        ? '准入基线与变更后证据的来源、查询和时间顺序可比；本地 replay 保留审慎折减。'
        : '变更后报告缺少有效的同源、同查询准入基线。';
  }
  return {
    id: 'comparability',
    label: '基线可比性',
    score: comparisonScore,
    weight: 20,
    explanation,
    evidenceRefs,
  };
}

function freshnessDimension(
  input: CreateInspectionReportIntelligenceInput,
  evidenceRefs: readonly string[],
): InspectionReportDimension {
  const fresh = input.runs.length > 0 && input.runs.every(isFresh);
  const replayRuns = input.runs.filter((run) => run.sourceSnapshot?.sourceKind === 'replay');
  const replayFixtureProvenanceComplete = replayRuns.every((run) => {
    const capturedAt = Date.parse(run.sourceSnapshot?.fixtureCapturedAt ?? '');
    const executedAt = Date.parse(run.sourceSnapshot?.observedAt ?? '');
    return Number.isFinite(capturedAt) && Number.isFinite(executedAt) && capturedAt <= executedAt;
  });
  const score = !fresh || !replayFixtureProvenanceComplete ? 55 : replayRuns.length > 0 ? 90 : 100;
  let explanation = '至少一个来源快照缺失、晚于对应运行完成时间或超出新鲜度窗口。';
  if (fresh && replayRuns.length === 0) {
    explanation = '报告只使用各次运行采集窗口内冻结的来源快照。';
  } else if (fresh && replayFixtureProvenanceComplete) {
    explanation =
      '本地 replay 在当前运行窗口内执行，但底层值来自固定 fixture；报告保留 fixture 固化时间并对新鲜度封顶折减。';
  }
  return {
    id: 'freshness',
    label: '证据新鲜度',
    score,
    weight: 15,
    explanation,
    evidenceRefs,
  };
}

function riskClosureDimension(input: CreateInspectionReportIntelligenceInput): InspectionReportDimension {
  const closure = riskClosure(input);
  let explanation = '最近一次风险之后没有通过的验证或变更后验收证据。';
  if (closure.resolved) {
    explanation =
      closure.score === 100 ? '证据链中没有发现风险运行。' : '历史风险已有后续独立复验；风险事实仍保留在报告中。';
  }
  return {
    id: 'risk_closure',
    label: '风险闭环度',
    score: closure.score,
    weight: 15,
    explanation,
    evidenceRefs: closure.refs,
  };
}

function scoreDimensions(input: CreateInspectionReportIntelligenceInput): InspectionReportDimension[] {
  const allRefs = evidenceIds(input);
  const finalRefs = lastEvidenceRefs(input);
  return [
    coverageDimension(input, finalRefs),
    integrityDimension(input, allRefs.length > 0 ? allRefs : finalRefs),
    comparabilityDimension(input, finalRefs),
    freshnessDimension(input, finalRefs),
    riskClosureDimension(input),
  ];
}

export function createInspectionReportIntelligence(
  input: CreateInspectionReportIntelligenceInput,
): InspectionReportIntelligence {
  const dimensions = scoreDimensions(input);
  const deductions = dimensions
    .filter((dimension) => dimension.score < 100)
    .map((dimension) => ({
      id: `${dimension.id}-deduction`,
      points: Number((((100 - dimension.score) * dimension.weight) / 100).toFixed(2)),
      reason: dimension.explanation,
      evidenceRefs: dimension.evidenceRefs,
    }));
  const deductionTotal = deductions.reduce((sum, deduction) => sum + deduction.points, 0);
  const overall = Math.round(100 - deductionTotal);
  const citations = evidenceIds(input);
  const closure = riskClosure(input);
  const snapshotHashes = [
    ...new Set(
      input.runs.map((run) => run.sourceSnapshot?.snapshotHash).filter((hash): hash is string => Boolean(hash)),
    ),
  ];

  return {
    assessmentBasis: {
      candidateSetId: input.candidateSet?.id ?? null,
      coverageOmissionIds: input.candidateSet?.coverageOmissions.map((omission) => omission.id) ?? [],
      comparability: input.abReport?.comparability ?? 'unavailable',
      runIds: input.runs.map((run) => run.id),
      decisionIds: input.decisions.map((decision) => decision.id),
      sourceSnapshotHashes: snapshotHashes,
    },
    score: {
      overall,
      grade: overall >= 90 ? 'A' : overall >= 80 ? 'B' : 'C',
      modelVersion: 'nova-report-score-v2',
      dimensions,
      deductions,
    },
    interpretation: {
      executiveSummary: `本次变更综合评分 ${overall} 分；结论仅适用于报告中冻结的来源范围。`,
      keyEvidence: [
        {
          statement: '运行、来源快照、检查结果和人工决策均保留可追溯标识。',
          evidenceRefs: citations,
        },
      ],
      residualRisks:
        closure.score < 100
          ? [
              {
                statement: closure.resolved
                  ? '历史风险虽已复验，仍应在上线后继续观察相同信号。'
                  : '风险尚未被独立复验关闭。',
                evidenceRefs: closure.refs,
              },
            ]
          : [],
      recommendation: closure.resolved ? '可接受本地巡检结论；生产动作仍不可用。' : '保持阻断，补充风险复验证据。',
      confidence: Number((overall / 100).toFixed(2)),
      citations,
      clawExplanation: `报告评分 ${overall} 分，来自覆盖、证据完整性、可比性、新鲜度和风险闭环五个维度；所有扣分都指向冻结的运行或决策证据。`,
    },
  };
}
