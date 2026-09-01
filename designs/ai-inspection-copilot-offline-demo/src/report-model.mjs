import { formatCheckRules } from '../lib/metric-catalog.mjs';

const STATUS_RANK = Object.freeze({ Violated: 0, Inconclusive: 1, NotEvaluated: 1, Verified: 2 });

export const REPORT_STATUS_COPY = Object.freeze({
  Verified: { symbol: '✓', label: '通过', tone: 'verified' },
  Violated: { symbol: '✕', label: '违例', tone: 'violated' },
  Inconclusive: { symbol: '?', label: '未决', tone: 'unresolved' },
  NotEvaluated: { symbol: '?', label: '未执行', tone: 'unresolved' },
});

export function formatReportTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '时间未知';
  return `${new Date(value).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function durationLabel(startedAt, completedAt) {
  const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  return Number.isFinite(duration) && duration >= 0 ? `${Math.round(duration / 1000)}s` : '耗时未知';
}

export function formatReportMetadata(run, taskName) {
  const name = String(taskName ?? '').trim() || '未命名巡检';
  const window = run?.inspectionPlan?.checks?.[0]?.window ?? '窗口未知';
  const instanceId = run?.taskInstanceId ?? run?.id ?? '实例未知';
  const completedAt = formatReportTime(run?.completedAt);
  const duration = durationLabel(run?.startedAt, run?.completedAt);
  return {
    taskName: name,
    completedAt,
    window,
    instanceId,
    duration,
    line: `${name} · ${completedAt} · 窗口 ${window} · 实例 ${instanceId} · 耗时 ${duration}`,
  };
}

function numericRatio(measurement) {
  const gateValue = measurement.gate?.value;
  if (measurement.kind !== 'numeric' || !Number.isFinite(measurement.value) || !Number.isFinite(gateValue)) return null;
  if (gateValue === 0) return measurement.value === 0 ? 0 : 100;
  const ratio = Math.abs(measurement.value / gateValue);
  return Math.min(100, Math.max(0, Math.round(ratio * 1000) / 10));
}

function measurementStatus(measurement, resultStatus) {
  if (['Inconclusive', 'NotEvaluated'].includes(resultStatus)) return resultStatus;
  if (
    measurement.kind !== 'numeric' ||
    !Number.isFinite(measurement.value) ||
    !Number.isFinite(measurement.gate?.value)
  ) {
    return resultStatus;
  }
  const { operator, value: threshold } = measurement.gate;
  const passed =
    (operator === '<=' && measurement.value <= threshold) ||
    (operator === '>=' && measurement.value >= threshold) ||
    (operator === '<' && measurement.value < threshold) ||
    (operator === '>' && measurement.value > threshold);
  return passed ? 'Verified' : 'Violated';
}

export function projectReportEvidence(report) {
  if (!Array.isArray(report?.checkResults)) {
    return (report?.keyEvidence ?? []).map((text, index) => ({
      id: `legacy-evidence-${index + 1}`,
      checkId: null,
      label: '历史证据',
      entity: '历史快照',
      kind: 'qualitative',
      displayValue: text,
      gateDisplayValue: '原报告未保存结构化门禁',
      status: index === 0 ? (report?.evidenceVerdict ?? 'NotEvaluated') : 'Verified',
      ratioPercent: null,
      order: index,
    }));
  }
  return report.checkResults
    .flatMap((result, resultIndex) =>
      result.measurements.map((measurement, measurementIndex) => ({
        ...measurement,
        checkId: result.checkId,
        status: measurementStatus(measurement, result.status),
        gateDisplayValue: measurement.gate.displayValue,
        ratioPercent: numericRatio(measurement),
        order: resultIndex * 100 + measurementIndex,
      })),
    )
    .sort(
      (left, right) => (STATUS_RANK[left.status] ?? 3) - (STATUS_RANK[right.status] ?? 3) || left.order - right.order,
    );
}

export function projectReportChecks(run) {
  const results = new Map((run?.report?.checkResults ?? []).map((result) => [result.checkId, result]));
  return (run?.inspectionPlan?.checks ?? []).map((check) => {
    const result = results.get(check.id);
    const measurements = result?.measurements ?? [];
    return {
      check,
      status: result?.status ?? 'NotEvaluated',
      summary: result?.summary ?? '证据不足',
      actualDisplay: measurements.map((measurement) => measurement.displayValue).join(' / ') || '证据不足',
      gateDisplay:
        measurements.map((measurement) => measurement.gate.displayValue).join(' / ') || formatCheckRules(check),
    };
  });
}

export function projectInterpretation(report) {
  const interpretation = report?.interpretation;
  return [
    ['whatHappened', '发生了什么'],
    ['likelyCause', '可能原因'],
    ['recommendedAction', '建议动作'],
  ].map(([key, label]) => ({
    key,
    label,
    text: interpretation?.[key]?.text ?? '证据不足',
    evidenceIds: interpretation?.[key]?.evidenceIds ?? [],
  }));
}
