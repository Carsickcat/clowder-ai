import { deepFreeze, reconcileChange } from './domain.mjs';
import { createMetricRule } from './metric-catalog.mjs';
import { getScenario } from './scenarios.mjs';
import { createTrendSeries } from './trend-evidence.mjs';

export const inspectionExamples = deepFreeze([
  {
    id: 'order-upgrade',
    label: '发布单示例',
    prompt: '发布后关注订单提交和支付链路',
    targetService: 'order-api',
    contextReference: 'REL-ORDER-480',
  },
  {
    id: 'payment-config',
    label: '变更单示例',
    prompt: '关注扣款成功和 Redis 客户端',
    targetService: 'payment-api',
    contextReference: 'CHG-84501',
  },
]);

function cloneFixture(id) {
  return structuredClone(getScenario(id));
}

function genericCheck(input) {
  return {
    priority: 'required',
    window: '变更前 15 分钟 vs 变更后 15 分钟',
    baseline: '过去 7 天同星期、同时段',
    severity: 'critical',
    ...input,
  };
}

function extractService(prompt) {
  return (
    prompt.match(/\b[a-z][a-z0-9-]*(?:-api|-service|-worker|-gateway)\b/i)?.[0] ??
    prompt.match(/\b[a-z][a-z0-9]+-[a-z0-9-]+\b/i)?.[0] ??
    'target-service'
  );
}

function extractServices(prompt) {
  const servicePattern = /\b[a-z][a-z0-9-]*(?:-api|-service|-worker|-gateway)\b/gi;
  return [...new Set([...prompt.matchAll(servicePattern)].map(([service]) => service.toLowerCase()))];
}

function extractVersion(prompt) {
  return prompt.match(/\bv\d+(?:\.\d+)+\b/i)?.[0] ?? '待确认版本';
}

function normalizeRequest(request) {
  const prompt = request?.prompt?.trim() ?? '';
  const contextReference = request?.contextReference?.trim() ?? '';
  if (!prompt && !contextReference) throw new Error('A release reference or inspection intent is required');
  const referenceTarget = /^CHG-84501$/i.test(contextReference) ? 'payment-api' : '';
  return {
    prompt: prompt || `验证变更 ${contextReference}`,
    targetService: request?.targetService?.trim() || referenceTarget || extractService(prompt),
    contextReference,
  };
}

function compileGenericWorkspace(request) {
  const service = request.targetService;
  const version = extractVersion(request.prompt);
  const metricPrefix = service.replaceAll('-', '.');
  const downstream =
    extractServices(request.prompt).find((candidate) => candidate !== service.toLowerCase()) ?? `${service}-downstream`;
  const cache = `${service}-cache`;
  const declaredEntities = [service, downstream, cache];
  const changeSourceRef = request.contextReference ? 'attached-context' : 'user-intent';
  const contextSources = [
    {
      id: 'user-intent',
      kind: '用户意图',
      label: `${service} 当前巡检目标`,
      detail: request.prompt,
      freshness: '刚刚',
    },
  ];
  if (request.contextReference) {
    contextSources.push({
      id: 'attached-context',
      kind: '可选上下文',
      label: request.contextReference,
      detail: `${service} 关联电子流 / 发布单，作为变更事实补全来源`,
      freshness: '刚刚',
    });
  }
  contextSources.push(
    {
      id: 'service-catalog',
      kind: '服务目录',
      label: `${service} 可靠性目标`,
      detail: `${service} 核心业务目标及负责人映射`,
      freshness: '当前',
    },
    {
      id: 'runtime-trace',
      kind: 'Trace',
      label: `${service} 近 24h 真实调用`,
      detail: `${service} → ${downstream}；${service} → ${cache}`,
      freshness: '3 分钟前',
    },
    {
      id: 'metric-catalog',
      kind: '指标目录',
      label: `${service} 已注册执行能力`,
      detail: `${service} 业务、服务、依赖与缓存指标均可直接执行`,
      freshness: '当前',
    },
  );

  const declaredChange = {
    id: request.contextReference || `USER-${service.toUpperCase()}`,
    summary: `${service} ${version} 用户声明变更`,
    version,
    entities: declaredEntities,
    fingerprint: `mock:${service}@${version}`,
  };
  const observedChange = {
    summary: `${service} Mock 运行时事实与声明范围一致`,
    entities: [...declaredEntities],
    fingerprint: declaredChange.fingerprint,
  };

  return {
    id: `workspace-${service}`,
    entryKind: request.contextReference ? 'combined-context' : 'user-intent',
    eyebrow: 'User-defined inspection workspace',
    title: `${service} 巡检工作区`,
    subtitle: '由用户目标与可选运行上下文动态编译，不受示例场景限制',
    prompt: request.prompt,
    declaredChange,
    observedChange,
    impactDimensions: {
      businessJourney: [`${service} 核心业务目标`],
      goldenMetrics: [`${metricPrefix}.success_rate`, `${metricPrefix}.downstream_success_rate`],
      traceDependencies: [`${service} → ${downstream}`],
      middleware: [`${cache} · Mock runtime catalog`],
    },
    contextSources,
    hypotheses: [
      `${service} 变更不能降低核心业务成功率`,
      `${service} 延迟与错误率不能显著退化`,
      `${downstream} 与 ${cache} 不能成为新增瓶颈`,
    ],
    candidateChecks: [
      genericCheck({
        id: 'candidate-memory-trend',
        priority: 'recommended',
        criticality: 'medium',
        ruleSourceAuthority: 'approved',
        purpose: `识别 ${service} 升级后的缓慢内存爬升`,
        entity: service,
        capability: '容器资源趋势',
        metricRules: [createMetricRule('container.memory.working_set', '<=', 1, { editable: false })],
        failureAction: `延长 ${service} 观察窗口`,
        rationale: `${service} 的资源趋势属于补充证据，不直接制造发布门禁。`,
        sourceRefs: [changeSourceRef, 'metric-catalog'],
      }),
    ],
    committedChecks: [
      genericCheck({
        id: 'business-outcome',
        purpose: `保护 ${service} 核心业务结果`,
        entity: `${service} 核心业务目标`,
        capability: '业务黄金指标',
        metricRules: [
          createMetricRule(`${metricPrefix}.success_rate`, '>=', 99.59, {
            label: `${service} 核心业务成功率`,
            category: '业务结果',
            unit: '%',
          }),
        ],
        failureAction: `暂停 ${service} 发布并转 RC Agent`,
        rationale: `服务目录将 ${service} 绑定为当前可靠性目标的责任实体。`,
        sourceRefs: [changeSourceRef, 'service-catalog', 'metric-catalog'],
      }),
      genericCheck({
        id: 'service-golden-signals',
        purpose: `验证 ${service} 自身没有退化`,
        entity: service,
        capability: '服务黄金信号',
        metricRules: [
          createMetricRule('http.error_rate', '<=', 0.5),
          createMetricRule('http.duration.p95.change_rate', '<=', 10),
        ],
        failureAction: `暂停并检查 ${service} 新版本实例`,
        rationale: `本次变更直接改变 ${service} 的运行时行为。`,
        sourceRefs: [changeSourceRef, 'metric-catalog'],
      }),
      genericCheck({
        id: 'downstream-dependency',
        purpose: `验证 ${service} 的关键下游依赖`,
        entity: downstream,
        capability: 'Trace 依赖门禁',
        metricRules: [
          createMetricRule('span.client.error_rate', '<=', 0),
          createMetricRule('span.client.duration.p95.change_rate', '<=', 8),
        ],
        failureAction: `暂停并下钻 ${service} 依赖 Trace`,
        rationale: `运行时 Trace 证明 ${service} 实际调用 ${downstream}。`,
        sourceRefs: ['service-catalog', 'runtime-trace', 'metric-catalog'],
      }),
      genericCheck({
        id: 'middleware-health',
        purpose: `验证 ${service} 缓存无新增饱和`,
        entity: cache,
        capability: 'Redis 开箱指标',
        metricRules: [
          createMetricRule('redis.hit_rate', '>=', 94.4),
          createMetricRule('redis.command_latency', '<=', 6),
        ],
        failureAction: `延长 ${service} 观察窗口并人工确认`,
        rationale: `运行时 Trace 证明 ${service} 实际访问 ${cache}。`,
        sourceRefs: ['runtime-trace', 'metric-catalog'],
      }),
    ],
    execution: [
      {
        id: 'baseline',
        label: `锁定 ${service} 变更前基线`,
        status: 'Verified',
        fact: `${service} 四类关键证据均新鲜可比`,
      },
      {
        id: 'business',
        label: `验证 ${service} 业务黄金指标`,
        status: 'Verified',
        fact: `${service} 成功率较基线 +0.03pp`,
      },
      {
        id: 'service',
        label: `验证 ${service} 服务与 Trace`,
        status: 'Verified',
        fact: `${service} p95 +3.2%，依赖无新增错误`,
      },
      {
        id: 'middleware',
        label: `验证 ${service} 缓存与拨测`,
        status: 'Verified',
        fact: `${cache} 命中率 96.4%，多地拨测通过`,
      },
    ],
    report: {
      evidenceVerdict: 'Verified',
      action: 'Proceed',
      actionLabel: `建议继续 ${service} 发布`,
      title: `${service} 声明范围内未发现异常退化`,
      summary: `${service} 核心业务结果、服务黄金信号、下游依赖与缓存均通过确定性验证。`,
      scopeStatement: `结论仅覆盖 ${service} 及运行时 Trace 证明的 ${downstream}、${cache}。`,
      evidenceCounts: { verified: 4, violated: 0, unresolved: 0 },
      keyEvidence: [
        `${service} 成功率较基线 +0.03pp`,
        `${service} p95 较稳定版本 +3.2%`,
        `${downstream} 无新增错误 Trace`,
      ],
      checkResults: [
        {
          checkId: 'business-outcome',
          status: 'Verified',
          summary: `${service} 成功率 99.82%，较基线 +0.03pp`,
          measurements: [
            {
              id: `${service}-success-rate`,
              metricId: `${metricPrefix}.success_rate`,
              label: '核心业务成功率',
              entity: `${service} 核心业务目标`,
              kind: 'numeric',
              value: 99.82,
              unit: '%',
              displayValue: '99.82%',
              series: createTrendSeries(99.78, 99.8, 99.81, 99.83, 99.82, 99.82),
              gate: { operator: '>=', value: 99.59, unit: '%', displayValue: '下降不超过 0.20pp' },
            },
          ],
        },
        {
          checkId: 'service-golden-signals',
          status: 'Verified',
          summary: `${service} p95 较稳定版本 +3.2%`,
          measurements: [
            {
              id: `${service}-error-rate`,
              metricId: 'http.error_rate',
              label: '服务错误率',
              entity: service,
              kind: 'numeric',
              value: 0.18,
              unit: '%',
              displayValue: '0.18%',
              series: createTrendSeries(0.12, 0.14, 0.16, 0.2, 0.17, 0.18),
              gate: { operator: '<=', value: 0.5, unit: '%', displayValue: '≤ 0.5%' },
            },
            {
              id: `${service}-p95-change`,
              metricId: 'http.duration.p95.change_rate',
              label: '服务延迟增幅',
              entity: service,
              kind: 'numeric',
              value: 3.2,
              unit: '%',
              displayValue: '+3.2%',
              series: createTrendSeries(1.8, 2.1, 2.7, 3.5, 3.1, 3.2),
              gate: { operator: '<=', value: 10, unit: '%', displayValue: '≤ 10%' },
            },
          ],
        },
        {
          checkId: 'downstream-dependency',
          status: 'Verified',
          summary: `${downstream} 无新增错误 Trace`,
          measurements: [
            {
              id: `${service}-downstream-trace`,
              metricId: 'span.client.error_rate',
              label: '下游依赖错误',
              entity: downstream,
              kind: 'numeric',
              value: 0,
              unit: '%',
              displayValue: '0%',
              series: createTrendSeries(0, 0, 0, 0, 0, 0),
              gate: { operator: '<=', value: 0, unit: '%', displayValue: '≤ 0%' },
            },
            {
              id: `${service}-downstream-duration-change`,
              metricId: 'span.client.duration.p95.change_rate',
              label: '下游依赖延迟增幅',
              entity: downstream,
              kind: 'numeric',
              value: 3.2,
              unit: '%',
              displayValue: '+3.2%',
              series: createTrendSeries(1.6, 2, 2.4, 3.5, 3.1, 3.2),
              gate: { operator: '<=', value: 8, unit: '%', displayValue: '≤ 8%' },
            },
          ],
        },
        {
          checkId: 'middleware-health',
          status: 'Verified',
          summary: `${cache} 命中率 96.4%，高于 94.4% 门禁`,
          measurements: [
            {
              id: `${service}-cache-hit-rate`,
              metricId: 'redis.hit_rate',
              label: '缓存命中率',
              entity: cache,
              kind: 'numeric',
              value: 96.4,
              unit: '%',
              displayValue: '96.4%',
              series: createTrendSeries(96.1, 96.2, 96.5, 96.3, 96.4, 96.4),
              gate: { operator: '>=', value: 94.4, unit: '%', displayValue: '下降 ≤ 2%' },
            },
            {
              id: `${service}-cache-command-latency`,
              metricId: 'redis.command_latency',
              label: '缓存命令延迟',
              entity: cache,
              kind: 'numeric',
              value: 3.8,
              unit: 'ms',
              displayValue: '3.8ms',
              series: createTrendSeries(3.1, 3.3, 3.6, 4, 3.7, 3.8),
              gate: { operator: '<=', value: 6, unit: 'ms', displayValue: '≤ 6ms' },
            },
          ],
        },
        {
          checkId: 'candidate-memory-trend',
          status: 'Inconclusive',
          summary: `${service} 短窗口不足以判断缓慢内存爬升`,
          measurements: [
            {
              id: `${service}-memory-trend`,
              metricId: 'container.memory.working_set',
              label: '内存变化趋势',
              entity: service,
              kind: 'qualitative',
              displayValue: '短窗口证据不足',
              gate: { displayValue: '斜率低于历史同版本 P95' },
            },
          ],
        },
      ],
      interpretation: {
        whatHappened: {
          text: `${service} 核心业务成功率稳定，服务延迟未触及门禁。`,
          evidenceIds: [`${service}-success-rate`, `${service}-p95-change`],
        },
        likelyCause: { text: '证据不足', evidenceIds: [] },
        recommendedAction: {
          text: `按当前节奏继续 ${service} 发布，并保持原观察窗口。`,
          evidenceIds: [`${service}-success-rate`, `${service}-p95-change`],
        },
      },
      residualRisks: [`${service} 内存趋势为建议项，未纳入本次硬门禁。`],
      rcAgent: null,
    },
  };
}

function compileKnownWorkspace(request) {
  const isPaymentRisk =
    ['CHG-84217', 'CHG-84501'].includes(request.contextReference) ||
    (/payment-api/i.test(request.prompt) && /redis|超时/i.test(request.prompt));
  if (isPaymentRisk) {
    const workspace = cloneFixture('change-ticket-risk');
    workspace.prompt = request.prompt;
    workspace.eyebrow = 'User-defined inspection workspace';
    workspace.title = `${request.targetService} 巡检工作区`;
    workspace.subtitle = '用户目标与运行时对账共同编译的高风险验证工作区';
    workspace.entryKind = request.contextReference ? 'combined-context' : 'user-intent';
    if (request.contextReference) {
      workspace.declaredChange.id = request.contextReference;
      workspace.contextSources[0].label = request.contextReference;
    }
    return workspace;
  }
  if (/order-api/i.test(request.prompt) || request.targetService === 'order-api') {
    const workspace = cloneFixture('natural-language-pass');
    workspace.prompt = request.prompt;
    workspace.eyebrow = 'User-defined inspection workspace';
    workspace.title = `${request.targetService} 巡检工作区`;
    workspace.subtitle = '用户目标动态编译的服务升级验证工作区';
    workspace.entryKind = request.contextReference ? 'combined-context' : 'user-intent';
    if (request.contextReference) workspace.declaredChange.id = request.contextReference;
    return workspace;
  }
  return null;
}

export function compileInspectionRequest(input) {
  const request = normalizeRequest(input);
  const workspace = compileKnownWorkspace(request) ?? compileGenericWorkspace(request);
  workspace.request = request;
  workspace.reconciliation = reconcileChange(workspace.declaredChange, workspace.observedChange);
  workspace.candidateSetId = `candidate-set:${workspace.declaredChange.id}`;
  workspace.blockingScope = [...workspace.reconciliation.blockingEntities];
  workspace.coverageGaps = workspace.reconciliation.coverageGapEntities.map((entity) => {
    const candidate = workspace.candidateChecks.find(
      (check) => check.entity === entity && check.ruleSourceAuthority === 'approved',
    );
    return {
      id: `coverage-gap:${entity}`,
      entity,
      status: 'uncovered',
      reason:
        entity === 'invoice-worker'
          ? '共享配置包触达该服务，但当前没有已批准的直接规则绑定'
          : '运行时配置指纹显示该实体位于声明外影响面',
      sourceRefs: ['runtime-diff'].filter((sourceId) =>
        workspace.contextSources.some((source) => source.id === sourceId),
      ),
      eligibleCandidateId: candidate?.id ?? null,
    };
  });
  return deepFreeze(workspace);
}
