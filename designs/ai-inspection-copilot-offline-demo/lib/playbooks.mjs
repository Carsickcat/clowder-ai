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
    checkIds: ['business-outcome', 'service-golden-signals', 'downstream-dependency'],
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
    checkIds: ['payment-business', 'redis-latency', 'invoice-async'],
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

function validation(dimension, status = 'passed', detail = '当前事实与方案版本一致') {
  return {
    dimension,
    label: VALIDATION_LABELS[dimension],
    status,
    detail,
  };
}

function snapshot(playbook, input) {
  return deepFreeze({
    playbookRef: { id: playbook.id, version: playbook.version },
    title: playbook.title,
    lastUsedLabel: '3 天前',
    ...input,
  });
}

function exactOrderMatch(playbook) {
  return snapshot(playbook, {
    status: 'exact',
    score: 98,
    summary: '证据框架仍有效，五项现场校验全部通过',
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

function minorPaymentMatch(playbook) {
  return snapshot(playbook, {
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

function majorPaymentMatch(playbook) {
  return snapshot(playbook, {
    status: 'major-drift',
    score: 61,
    summary: '场景边界已改变，旧方案只能作为重新生成的参考',
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

  if (playbook.scenarioKey === 'order-release') return exactOrderMatch(playbook);
  if (playbook.scenarioKey === 'payment-config') {
    const prompt = workspace?.request?.prompt?.toLowerCase() ?? '';
    const majorDrift = prompt.includes('risk-api') || prompt.includes('拆分');
    return majorDrift ? majorPaymentMatch(playbook) : minorPaymentMatch(playbook);
  }
  return null;
}
