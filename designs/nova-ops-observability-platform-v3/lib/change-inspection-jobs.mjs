import { deepFreeze } from "./change-inspection-immutability.mjs";

export const inspectionJobTemplates = deepFreeze([
  {
    kind: "InspectionJobTemplate",
    id: "JOB-PAYMENTS-CANARY",
    name: "支付路由灰度巡检",
    summary: "核心支付链路 · 标准灰度门禁",
    service: "payments-router",
    version: "v3.18.0",
    environment: "生产环境",
    changeId: "CHG-23841",
    intent: "巡检 payments-router v3.18.0 是否可以灰度发布",
    frequency: "每 2 分钟",
    window: "连续 10 分钟",
    baseline: "过去 7 天同星期、同时段",
    lastRun: {
      finishedAt: "今天 14:20",
      result: "passed",
      reportId: "RPT-CHG-23798-V1",
    },
  },
  {
    kind: "InspectionJobTemplate",
    id: "JOB-INVENTORY-RELEASE",
    name: "库存服务发布巡检",
    summary: "库存一致性 · 发布前后对比",
    service: "inventory-service",
    version: "v2.4",
    environment: "生产环境",
    changeId: "CHG-23856",
    intent: "巡检 inventory-service v2.4 是否可以灰度发布",
    frequency: "每 3 分钟",
    window: "连续 15 分钟",
    baseline: "过去 14 天同星期、同时段",
    lastRun: {
      finishedAt: "昨天 19:45",
      result: "passed",
      reportId: "RPT-CHG-23763-V2",
    },
  },
  {
    kind: "InspectionJobTemplate",
    id: "JOB-CHECKOUT-DAILY",
    name: "结算链路日常巡检",
    summary: "结算 API · 高频变更复用作业",
    service: "checkout-api",
    version: "v5.12.1",
    environment: "生产环境",
    changeId: "CHG-23872",
    intent: "巡检 checkout-api v5.12.1 是否可以灰度发布",
    frequency: "每 1 分钟",
    window: "连续 10 分钟",
    baseline: "过去 7 天相同流量窗口",
    lastRun: {
      finishedAt: "7 月 28 日 16:08",
      result: "risk",
      reportId: "RPT-CHG-23691-V1",
    },
  },
]);

export function findInspectionJob(jobId) {
  return inspectionJobTemplates.find((job) => job.id === jobId) ?? null;
}

export function createCaseFromJob(baseState, jobId, createChecks) {
  const job = findInspectionJob(jobId);
  if (!job) return null;
  return {
    ...baseState,
    id: `CIC-DEMO-${job.id}`,
    sourceJob: {
      id: job.id,
      name: job.name,
    },
    service: job.service,
    version: job.version,
    environment: job.environment,
    changeId: job.changeId,
    plan: {
      ...baseState.plan,
      status: "ready",
      version: 1,
      intent: job.intent,
      checks: createChecks(job.service),
      frequency: job.frequency,
      window: job.window,
      baseline: job.baseline,
    },
    decision: {
      status: "ready",
      label: "方案待确认",
      title: "已载入可复用巡检作业",
      summary: "历史方案已固化为模板，本次执行仍会生成全新的巡检证据。",
    },
    conversation: [
      ...baseState.conversation,
      {
        role: "assistant",
        text: `已载入“${job.name}”。请核对服务、版本和门禁后再执行。`,
      },
    ],
  };
}
