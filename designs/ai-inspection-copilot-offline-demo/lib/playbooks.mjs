import { deepFreeze } from './domain.mjs';

export const inspectionPlaybooks = deepFreeze([
  {
    id: 'order-release-verification',
    version: 4,
    title: '订单发布后验证',
    scenarioKey: 'order-release',
    matchRules: {
      targetServices: ['order-api'],
      promptSignals: ['升级', '发布', 'release', 'deploy'],
    },
    checkIds: ['order-success', 'service-golden-signals', 'payment-dependency', 'cache-health'],
    approvedAt: '2026-08-01T09:30:00Z',
    lastUsedAt: '2026-08-10T03:20:00Z',
  },
  {
    id: 'payment-config-verification',
    version: 3,
    title: '支付配置变更巡检',
    scenarioKey: 'payment-config',
    matchRules: {
      targetServices: ['payment-api'],
      promptSignals: ['Redis', '超时', '配置', 'config', 'risk-api', '拆分'],
    },
    checkIds: ['payment-success', 'payment-service'],
    approvedAt: '2026-07-28T08:00:00Z',
    lastUsedAt: '2026-08-10T07:45:00Z',
  },
]);

const VALIDATION_LABELS = deepFreeze({
  entity: '实体',
  metric: '指标',
  dependency: '依赖',
  permission: '权限',
  template: '模板',
});

const DEMO_SNAPSHOT_AT = Date.parse('2026-08-13T12:00:00Z');

function relativeDayLabel(timestamp) {
  const elapsedDays = Math.max(0, Math.floor((DEMO_SNAPSHOT_AT - Date.parse(timestamp)) / 86_400_000));
  return `${elapsedDays} 天前`;
}

function validation(dimension, status = 'passed', detail = '当前事实与方案版本一致') {
  return {
    dimension,
    label: VALIDATION_LABELS[dimension],
    status,
    detail,
  };
}

function resolveApprovedChecks(playbook, workspace) {
  const currentChecks = new Map(workspace.committedChecks.map((check) => [check.id, check]));
  const checkIds = [...playbook.checkIds];
  return {
    checkIds,
    checks: checkIds.flatMap((checkId) => {
      const check = currentChecks.get(checkId);
      return check ? [check] : [];
    }),
    unresolvedCheckIds: checkIds.filter((checkId) => !currentChecks.has(checkId)),
  };
}

function snapshot(playbook, workspace, input) {
  return deepFreeze({
    playbookRef: { id: playbook.id, version: playbook.version },
    title: playbook.title,
    scenarioKey: playbook.scenarioKey,
    approvedAt: playbook.approvedAt,
    lastUsedAt: playbook.lastUsedAt,
    lastUsedLabel: relativeDayLabel(playbook.lastUsedAt),
    ...resolveApprovedChecks(playbook, workspace),
    ...input,
  });
}

function exactOrderMatch(playbook, workspace) {
  return snapshot(playbook, workspace, {
    status: 'exact',
    score: 98,
    summary: '五项校验通过',
    validations: [
      validation('entity'),
      validation('metric'),
      validation('dependency'),
      validation('permission'),
      validation('template'),
    ],
    differences: [],
  });
}

function minorPaymentMatch(playbook, workspace) {
  return snapshot(playbook, workspace, {
    status: 'minor-drift',
    score: 92,
    summary: '方案结构仍可复用，2 项当前差异需要确认',
    validations: [
      validation('entity'),
      validation('metric', 'changed', '支付成功率指标口径已升级'),
      validation('dependency', 'changed', '运行时发现新的数据库只读实例'),
      validation('permission'),
      validation('template'),
    ],
    differences: [
      {
        id: 'payment-read-replica',
        dimension: 'dependency',
        label: '依赖',
        direction: 'added',
        severity: 'review',
        summary: 'settlement-db 新增只读实例，已扩大本次影响面',
      },
      {
        id: 'payment-success-vocabulary',
        dimension: 'metric',
        label: '指标',
        direction: 'changed',
        severity: 'review',
        summary: '支付成功率口径 v2 → v3，判定阈值保持不变',
      },
    ],
  });
}

function majorPaymentMatch(playbook, workspace) {
  return snapshot(playbook, workspace, {
    status: 'major-drift',
    score: 61,
    summary: '2 项重大差异',
    validations: [
      validation('entity', 'blocking', '核心服务已发生拆分'),
      validation('metric', 'blocking', '旧检查无法覆盖新实体'),
      validation('dependency', 'changed', '调用路径新增 risk-api'),
      validation('permission'),
      validation('template', 'blocking', '3 项检查缺少当前实体绑定'),
    ],
    differences: [
      {
        id: 'payment-service-split',
        dimension: 'entity',
        label: '实体',
        direction: 'changed',
        severity: 'blocking',
        summary: 'payment-api 已拆分为 payment-api + risk-api',
      },
      {
        id: 'payment-unbound-checks',
        dimension: 'template',
        label: '模板',
        direction: 'removed',
        severity: 'blocking',
        summary: '3 项关键检查在当前服务目录中没有对应实体',
      },
    ],
  });
}

function incompatibleStructureMatch(playbook, workspace) {
  const unresolvedCheckIds = resolveApprovedChecks(playbook, workspace).unresolvedCheckIds;
  return snapshot(playbook, workspace, {
    status: 'major-drift',
    score: 58,
    summary: '检查结构不可用',
    validations: [
      validation('entity'),
      validation('metric'),
      validation('dependency'),
      validation('permission'),
      validation('template', 'blocking', `${unresolvedCheckIds.length} 项审批检查缺少当前实体绑定`),
    ],
    differences: [
      {
        id: 'unresolved-approved-checks',
        dimension: 'template',
        label: '模板',
        direction: 'removed',
        severity: 'blocking',
        summary: `无法绑定：${unresolvedCheckIds.join('、')}`,
      },
    ],
  });
}

function matchesPlaybookDefinition(playbook, workspace) {
  const service = workspace?.request?.targetService?.toLowerCase() ?? '';
  const prompt = workspace?.request?.prompt?.toLowerCase() ?? '';
  const targetServices = playbook.matchRules?.targetServices ?? [];
  const promptSignals = playbook.matchRules?.promptSignals ?? [];
  return (
    targetServices.some((candidate) => candidate.toLowerCase() === service) &&
    (promptSignals.length === 0 || promptSignals.some((signal) => prompt.includes(signal.toLowerCase())))
  );
}

export function selectInspectionPlaybookDefinition(workspace, catalog = inspectionPlaybooks) {
  let selected = null;
  for (const playbook of catalog) {
    if (!matchesPlaybookDefinition(playbook, workspace)) continue;
    if (!selected || playbook.version > selected.version) selected = playbook;
  }
  return selected;
}

export function matchInspectionPlaybook(workspace, catalog = inspectionPlaybooks) {
  const playbook = selectInspectionPlaybookDefinition(workspace, catalog);
  if (!playbook) return null;

  const hasUnresolvedChecks = resolveApprovedChecks(playbook, workspace).unresolvedCheckIds.length > 0;
  if (hasUnresolvedChecks) {
    return playbook.scenarioKey === 'payment-config'
      ? majorPaymentMatch(playbook, workspace)
      : incompatibleStructureMatch(playbook, workspace);
  }

  if (playbook.scenarioKey === 'order-release') return exactOrderMatch(playbook, workspace);
  if (playbook.scenarioKey === 'payment-config') {
    const prompt = workspace?.request?.prompt?.toLowerCase() ?? '';
    const majorDrift = prompt.includes('risk-api') || prompt.includes('拆分');
    return majorDrift ? majorPaymentMatch(playbook, workspace) : minorPaymentMatch(playbook, workspace);
  }
  return null;
}
