export const inspectionChecks = [
  {
    id: "latency",
    name: "请求延迟",
    metric: "http.server.duration.p95",
    rule: "相对稳定版本增幅 ≤ 10%",
  },
  {
    id: "errors",
    name: "错误率",
    metric: "http.server.errors.rate",
    rule: "≤ 0.50%",
  },
  {
    id: "availability",
    name: "服务可用性",
    metric: "service.availability",
    rule: "≥ 99.95%",
  },
  {
    id: "dependency",
    name: "下游依赖",
    metric: "dependency.failure.rate",
    rule: "无新增失败依赖",
  },
  {
    id: "business",
    name: "支付成功率",
    metric: "payment.success.rate",
    rule: "相对基线下降 < 0.30%",
  },
];

export function createInspectionChecks(service) {
  if (service.includes("payment")) return inspectionChecks;
  return inspectionChecks.map((check) =>
    check.id === "business"
      ? {
          ...check,
          name: "核心业务成功率",
          metric: `${service}.business.success.rate`,
        }
      : check,
  );
}

export const runFixtures = {
  admission: {
    purpose: "admission",
    phase: "变更前",
    result: "passed",
    label: "变更前准入巡检",
    time: "09:42",
    summary: "5/5 检查通过，具备 25% 灰度条件",
    comparison: "当前稳定版本 vs 过去 7 天同时段",
    metrics: [
      { name: "p95 延迟", value: "184 ms", delta: "-2.1%", status: "passed" },
      { name: "错误率", value: "0.18%", delta: "-0.04pp", status: "passed" },
      {
        name: "支付成功率",
        value: "99.72%",
        delta: "+0.06pp",
        status: "passed",
      },
    ],
  },
  canaryRisk: {
    purpose: "progressive",
    phase: "25% 灰度",
    result: "risk",
    label: "25% 灰度持续巡检",
    time: "10:18",
    summary: "发现支付回调 p95 延迟异常，已暂停自动放量",
    comparison: "灰度版本 25% 对比稳定版本 75%，同一 10 分钟窗口",
    metrics: [
      { name: "p95 延迟", value: "263 ms", delta: "+17.8%", status: "risk" },
      { name: "错误率", value: "0.22%", delta: "+0.03pp", status: "passed" },
      {
        name: "支付成功率",
        value: "99.68%",
        delta: "-0.05pp",
        status: "passed",
      },
    ],
  },
  verification: {
    purpose: "verification",
    phase: "25% 灰度复验",
    result: "passed",
    label: "处置后重新验证",
    time: "10:31",
    summary: "延迟恢复，灰度版本与稳定版本的差异回到阈值内",
    comparison: "处置后灰度版本 25% 对比稳定版本 75%",
    metrics: [
      { name: "p95 延迟", value: "218 ms", delta: "+6.2%", status: "passed" },
      { name: "错误率", value: "0.19%", delta: "+0.01pp", status: "passed" },
      {
        name: "支付成功率",
        value: "99.71%",
        delta: "-0.02pp",
        status: "passed",
      },
    ],
  },
  fullTraffic: {
    purpose: "progressive",
    phase: "100% 放量",
    result: "passed",
    label: "全量稳定性观察",
    time: "11:06",
    summary: "100% 流量连续 10 分钟稳定",
    comparison: "全量新版本 vs 变更前基线",
    metrics: [
      { name: "p95 延迟", value: "201 ms", delta: "+4.4%", status: "passed" },
      { name: "错误率", value: "0.20%", delta: "+0.02pp", status: "passed" },
      {
        name: "支付成功率",
        value: "99.70%",
        delta: "-0.02pp",
        status: "passed",
      },
    ],
  },
  acceptance: {
    purpose: "acceptance",
    phase: "变更后",
    result: "passed",
    label: "变更后验收巡检",
    time: "11:22",
    summary: "变更前后无异常退化，本次变更验收通过",
    comparison: "变更后 15 分钟对比变更前基线快照",
    metrics: [
      { name: "p95 延迟", value: "198 ms", delta: "+3.1%", status: "passed" },
      { name: "错误率", value: "0.19%", delta: "+0.01pp", status: "passed" },
      {
        name: "支付成功率",
        value: "99.73%",
        delta: "+0.01pp",
        status: "passed",
      },
    ],
  },
};
