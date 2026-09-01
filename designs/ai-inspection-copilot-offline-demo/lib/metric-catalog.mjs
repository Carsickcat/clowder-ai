const DEFAULT_ALLOWED_OPERATORS = Object.freeze(['<=', '>=', '<', '>']);

const catalogEntries = {
  'order.submit.success_rate': ['订单提交成功率', '业务结果', '%'],
  'payment.confirm.success_rate': ['支付确认成功率', '业务结果', '%'],
  'http.error_rate': ['HTTP 错误率', '服务黄金信号', '%'],
  'http.duration.p95': ['服务延迟 p95', '服务黄金信号', 'ms'],
  'http.duration.p95.change_rate': ['服务延迟 p95 增幅', '服务黄金信号', '%'],
  'span.client.error_rate': ['下游调用错误率', '依赖黄金信号', '%'],
  'span.client.duration.p95': ['下游调用延迟 p95', '依赖黄金信号', 'ms'],
  'span.client.duration.p95.change_rate': ['下游延迟 p95 增幅', '依赖黄金信号', '%'],
  'redis.hit_rate': ['缓存命中率', '中间件黄金信号', '%'],
  'redis.command_latency': ['缓存命令 p99', '中间件黄金信号', 'ms'],
  'container.memory.working_set': ['容器内存工作集趋势', '资源黄金信号', '基线比'],
  'invoice.queue.lag': ['发票队列积压增长率', '异步业务信号', '%'],
  'db.pool.wait_p95': ['连接等待 p95', '数据库黄金信号', 'ms'],
  'db.pool.utilization': ['连接池占用', '数据库黄金信号', '%'],
};

export const metricCatalog = Object.freeze(
  Object.fromEntries(
    Object.entries(catalogEntries).map(([metricId, [label, category, unit]]) => [
      metricId,
      Object.freeze({
        metricId,
        label,
        category,
        unit,
        allowedOperators: DEFAULT_ALLOWED_OPERATORS,
        sourceRef: 'metric-catalog',
      }),
    ]),
  ),
);

export function createMetricRule(metricId, operator, threshold, options = {}) {
  const entry = metricCatalog[metricId];
  const label = options.label ?? entry?.label;
  const category = options.category ?? entry?.category;
  const unit = options.unit ?? entry?.unit;
  const allowedOperators = options.allowedOperators ?? entry?.allowedOperators ?? DEFAULT_ALLOWED_OPERATORS;
  if (
    !metricId ||
    !label ||
    !category ||
    !unit ||
    !allowedOperators.includes(operator) ||
    !Number.isFinite(threshold)
  ) {
    throw new TypeError(`Invalid metric rule for ${metricId || 'unknown metric'}`);
  }
  return {
    id: metricId,
    metricId,
    label,
    category,
    operator,
    threshold,
    unit,
    editable: options.editable !== false,
    allowedOperators: [...allowedOperators],
    sourceRef: options.sourceRef ?? entry?.sourceRef ?? 'metric-catalog',
  };
}

export function formatMetricRule(rule) {
  return `${rule.operator} ${rule.threshold}${rule.unit}`;
}

export function formatCheckRules(check) {
  return check.metricRules.map((rule) => `${rule.label} ${formatMetricRule(rule)}`).join('；');
}
