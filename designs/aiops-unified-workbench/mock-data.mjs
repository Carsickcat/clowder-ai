function evidence(id, lens, timestamp, title, detail, source, status) {
  return { id, lens, timestamp, title, detail, source, status };
}

const releaseEvidence = {
  metrics: [
    evidence(
      'metric-error-rate-01',
      'metrics',
      '10:24:18',
      '5xx 错误率升至 8.7%',
      '发布后 4 分钟偏离 7 日同星期基线，影响 checkout-api。',
      'APM · checkout-api / prod',
      'critical',
    ),
    evidence(
      'metric-latency-01',
      'metrics',
      '10:24:31',
      'P95 延迟达到 1.84 s',
      '主要贡献来自 payment-adapter，下游等待占比 71%。',
      'Metrics · http.server.duration',
      'warning',
    ),
  ],
  alerts: [
    evidence(
      'alert-slo-01',
      'alerts',
      '10:25:02',
      '结算成功率 SLO 快速燃烧',
      '30 分钟窗口 burn rate 12.4，已关联 4 条同源告警。',
      'Alert · checkout-slo-fast-burn',
      'critical',
    ),
    evidence(
      'alert-pool-01',
      'alerts',
      '10:25:20',
      '支付连接池等待升高',
      '同一部署批次中仅 payment-adapter-v42 出现。',
      'Alert · db-pool-wait',
      'warning',
    ),
  ],
  logs: [
    evidence(
      'log-timeout-01',
      'logs',
      '10:24:26',
      'PaymentClient timeout after 1500ms',
      '842 条同类日志；首现时间与 rc3 完成时间相差 3m12s。',
      'Logs · checkout-api / pod-7d94',
      'critical',
    ),
    evidence(
      'log-config-01',
      'logs',
      '10:24:09',
      'pool.maxConnections changed 120 → 40',
      '配置由新版本启动参数覆盖，旧实例保持 120。',
      'Logs · config-audit / payment-adapter',
      'warning',
    ),
    evidence(
      'log-noise-01',
      'logs',
      '10:23:57',
      'Cache warmup completed',
      '与错误率变化无时间相关，暂不支持当前假设。',
      'Logs · checkout-cache',
      'neutral',
    ),
  ],
  checks: [
    evidence(
      'check-contract-01',
      'checks',
      '10:26:10',
      '支付依赖契约检查失败',
      '3/5 区域失败；探测请求在连接池获取阶段超时。',
      'Inspection · release-guard / payment',
      'critical',
    ),
    evidence(
      'check-coverage-01',
      'checks',
      '10:26:18',
      '数据覆盖率 96%',
      '移动端渠道缺少订单回调校验，已标记为 evidence gap。',
      'Inspection · coverage-audit',
      'warning',
    ),
  ],
  synthetics: [
    evidence(
      'synthetic-checkout-01',
      'synthetics',
      '10:24:42',
      '上海节点结算旅程失败',
      '登录与加购成功，支付确认步骤超过 2.5 秒阈值。',
      'Synthetic · checkout-e2e / cn-east',
      'critical',
    ),
    evidence(
      'synthetic-control-01',
      'synthetics',
      '10:24:50',
      '新加坡对照节点正常',
      '该节点仍由旧版本实例承载，为发布相关性提供对照。',
      'Synthetic · checkout-e2e / ap-southeast',
      'positive',
    ),
  ],
};

const driftEvidence = {
  metrics: [
    evidence(
      'drift-metric-01',
      'metrics',
      '09:02:12',
      '基线序列在拓扑变更处断开',
      '检查维度从 region 扩展到 region + warehouse，数值不可直接拼接。',
      'Metrics · inventory-consistency',
      'warning',
    ),
  ],
  alerts: [
    evidence(
      'drift-alert-01',
      'alerts',
      '09:03:00',
      '趋势比较门禁触发',
      '系统阻止按旧基线生成健康结论。',
      'Alert · baseline-compatibility',
      'warning',
    ),
  ],
  logs: [
    evidence(
      'drift-log-01',
      'logs',
      '09:02:08',
      'check-set upgraded v2.3 → v2.4',
      '新增跨区库存一致性检查，实体基数发生变化。',
      'Logs · inspection-controller',
      'neutral',
    ),
  ],
  checks: [
    evidence(
      'drift-check-01',
      'checks',
      '09:05:11',
      '7/9 检查可运行，2 项等待新基线',
      '可运行不等于可比较；当前总体状态仍为 unknown。',
      'Inspection · baseline-audit',
      'warning',
    ),
  ],
  synthetics: [
    evidence(
      'drift-syn-01',
      'synthetics',
      '09:06:40',
      '库存查询旅程可用',
      '仅证明当前旅程可达，不能替代巡检基线重建。',
      'Synthetic · inventory-query',
      'positive',
    ),
  ],
};

const gapEvidence = {
  metrics: [
    evidence(
      'gap-metric-01',
      'metrics',
      '09:41:20',
      '遥测摄入量降至正常值 39%',
      '指标仍有返回，但缺少三组实例维度。',
      'Metrics · ingest-rate / member',
      'warning',
    ),
  ],
  alerts: [
    evidence(
      'gap-alert-01',
      'alerts',
      '09:42:03',
      '采集器心跳缺失',
      'collector rollout-88 后 6 个实例未恢复心跳。',
      'Alert · telemetry-heartbeat',
      'critical',
    ),
  ],
  logs: [
    evidence(
      'gap-log-01',
      'logs',
      '09:41:02',
      '最后一条可用日志距今 23 分钟',
      '证据过期，禁止从“无错误日志”推导服务健康。',
      'Logs · member-service',
      'warning',
    ),
  ],
  checks: [
    evidence(
      'gap-check-01',
      'checks',
      '09:44:18',
      '3 个关键检查无返回',
      '覆盖率仅 61%，结果进入待处置队列。',
      'Inspection · member-daily',
      'critical',
    ),
  ],
  synthetics: [
    evidence(
      'gap-syn-01',
      'synthetics',
      '09:45:31',
      '登录拨测成功但会员查询未采样',
      '只覆盖入口链路，无法证明会员数据链路健康。',
      'Synthetic · login-e2e',
      'warning',
    ),
  ],
};

function makeEvent(overrides) {
  return {
    id: '',
    title: '',
    subtitle: '',
    severity: 'warning',
    healthState: 'unhealthy',
    coverage: 100,
    coverageState: 'complete',
    freshness: '18s',
    baselineState: 'comparable',
    businessImpact: '',
    context: { service: '', env: 'prod', timeRange: 'Last 30 min', change: 'No linked change' },
    evidence: releaseEvidence,
    pinnedEvidenceIds: [],
    timeline: [],
    finding: { status: 'candidate', title: '', confidence: '待取证', evidenceIds: [], owner: null },
    action: { status: 'not_started', owner: null },
    verification: { status: 'not_started', startedAt: null, completedAt: null },
    ...overrides,
  };
}

export function createMockEvents() {
  return {
    'HE-1042': makeEvent({
      id: 'HE-1042',
      title: '结算发布后错误率升高',
      subtitle: '发布验证 · checkout-service',
      severity: 'blocker',
      businessImpact: '订单支付成功率下降 6.2 个百分点，预计影响 18% 活跃结算会话',
      context: {
        service: 'checkout-service',
        env: 'prod / cn-east',
        timeRange: '10:18–10:48 UTC+8',
        change: 'release-2026.07.22-rc3',
      },
      timeline: [
        { id: 'tl-1', time: '10:18', kind: 'change', title: 'rc3 完成 25% 灰度', detail: 'checkout-api v4.18.0' },
        {
          id: 'tl-2',
          time: '10:24',
          kind: 'symptom',
          title: '错误率与延迟同时偏离基线',
          detail: '5xx 8.7% · P95 1.84 s',
        },
        {
          id: 'tl-3',
          time: '10:25',
          kind: 'alert',
          title: '4 条告警合并为一个 HealthEvent',
          detail: 'SLO、连接池与业务成功率',
        },
      ],
      finding: {
        status: 'candidate',
        title: 'rc3 连接池上限回退导致支付请求排队',
        confidence: '中 · 需补强证据',
        evidenceIds: [],
        owner: null,
      },
    }),
    'HE-1045': makeEvent({
      id: 'HE-1045',
      title: '库存巡检基线不可比',
      subtitle: '日巡 · inventory-service',
      severity: 'unknown',
      healthState: 'unknown',
      baselineState: 'drifted',
      freshness: '41s',
      evidence: driftEvidence,
      businessImpact: '拓扑和检查定义已变更，今日趋势不可与昨日直接比较',
      context: {
        service: 'inventory-service',
        env: 'prod / global',
        timeRange: '09:00–10:00 UTC+8',
        change: 'check-set v2.4 + topology rev.91',
      },
      timeline: [
        { id: 'tl-1', time: '09:02', kind: 'change', title: '检查定义升级至 v2.4', detail: '新增跨区库存一致性检查' },
        { id: 'tl-2', time: '09:05', kind: 'gap', title: '历史基线失效', detail: '需重建至少一个完整观察窗口' },
      ],
      finding: {
        status: 'candidate',
        title: '重新建立检查基线后再判定健康状态',
        confidence: '不可判定',
        evidenceIds: [],
        owner: null,
      },
    }),
    'HE-1047': makeEvent({
      id: 'HE-1047',
      title: '会员服务证据链中断',
      subtitle: '数据质量 · member-service',
      severity: 'unknown',
      healthState: 'unknown',
      coverage: 61,
      coverageState: 'unknown',
      freshness: '23m',
      evidence: gapEvidence,
      businessImpact: '日志采集器中断，当前无法证明服务健康或异常',
      context: {
        service: 'member-service',
        env: 'prod / cn-north',
        timeRange: '09:40–10:40 UTC+8',
        change: 'collector rollout-88',
      },
      timeline: [
        { id: 'tl-1', time: '09:41', kind: 'gap', title: '日志新鲜度超过门限', detail: '最近证据距今 23 分钟' },
        { id: 'tl-2', time: '09:44', kind: 'gap', title: '巡检覆盖降至 61%', detail: '3 个关键检查无返回' },
      ],
      finding: {
        status: 'candidate',
        title: '先恢复采集链路，再重新运行健康检查',
        confidence: '不可判定',
        evidenceIds: [],
        owner: null,
      },
    }),
  };
}
