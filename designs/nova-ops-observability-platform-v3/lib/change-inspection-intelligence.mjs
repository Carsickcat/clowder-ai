const serviceKnowledge = Object.freeze({
  "payments-router": {
    guide: {
      id: "GUIDE-PAYMENTS-ROUTER-0318",
      title: "支付路由灰度变更指导书",
      summary: "覆盖准入、25% 灰度、连接池处置、全量观察与回退门槛。",
      matchedSections: ["§2 变更前置条件", "§4 灰度门禁", "§6 回退与复验"],
    },
    graph: {
      id: "KG-PAYMENTS-SNAPSHOT-23841",
      title: "支付核心链路知识图谱快照",
      summary: "识别路由、账本、风控和回调链路，标记连接池与支付成功率风险。",
      nodes: [
        "payments-router",
        "payment-ledger",
        "risk-engine",
        "callback-gateway",
      ],
      edges: [
        "payments-router → payment-ledger",
        "payments-router → risk-engine",
        "payment-ledger → callback-gateway",
      ],
    },
    businessName: "支付成功率",
    businessMetric: "payment.success.rate",
  },
  "inventory-service": {
    guide: {
      id: "GUIDE-INVENTORY-024",
      title: "库存一致性发布指导书",
      summary: "覆盖库存写入、缓存一致性、消息堆积与发布回退门槛。",
      matchedSections: ["§3 一致性校验", "§5 灰度观察", "§7 回退检查"],
    },
    graph: {
      id: "KG-INVENTORY-SNAPSHOT-23856",
      title: "库存业务知识图谱快照",
      summary: "识别库存服务、缓存、订单与事件总线之间的关键依赖。",
      nodes: [
        "inventory-service",
        "inventory-cache",
        "order-service",
        "inventory-events",
      ],
      edges: [
        "order-service → inventory-service",
        "inventory-service → inventory-cache",
        "inventory-service → inventory-events",
      ],
    },
    businessName: "库存扣减成功率",
    businessMetric: "inventory-service.business.success.rate",
  },
  "checkout-api": {
    guide: {
      id: "GUIDE-CHECKOUT-0512",
      title: "结算链路发布指导书",
      summary: "覆盖结算入口、订单确认、支付编排与降级门槛。",
      matchedSections: ["§2 发布前检查", "§4 业务门禁", "§8 降级策略"],
    },
    graph: {
      id: "KG-CHECKOUT-SNAPSHOT-23872",
      title: "结算链路知识图谱快照",
      summary: "识别结算入口与订单、定价、支付路由的业务依赖。",
      nodes: [
        "checkout-api",
        "order-service",
        "pricing-service",
        "payments-router",
      ],
      edges: [
        "checkout-api → order-service",
        "checkout-api → pricing-service",
        "checkout-api → payments-router",
      ],
    },
    businessName: "结算成功率",
    businessMetric: "checkout.success.rate",
  },
});

const orchestration = Object.freeze(
  [
    [
      "admission",
      "变更前准入巡检",
      "变更前",
      [],
      "BaselineSnapshot + InspectionRun",
    ],
    [
      "canary",
      "25% 灰度持续巡检",
      "灰度",
      ["admission"],
      "InspectionRun + Finding",
    ],
    ["remediation", "风险处置记录", "灰度", ["canary"], "DecisionRecord"],
    ["verification", "处置后复验", "灰度", ["remediation"], "InspectionRun"],
    [
      "full-traffic",
      "100% 放量观察",
      "全量",
      ["verification"],
      "InspectionRun",
    ],
    [
      "acceptance",
      "变更后验收",
      "验收",
      ["full-traffic"],
      "InspectionRun + DecisionRecord",
    ],
    ["report", "报告评分与解读", "报告", ["acceptance"], "ReportSnapshot"],
  ].map(([id, label, phase, dependencyIds, evidenceKind]) => ({
    id,
    label,
    phase,
    dependencyIds,
    evidenceKind,
  })),
);

function naturalLanguageSource(service, version, intent) {
  return {
    id: `INTENT-${service.toUpperCase()}-${version.toUpperCase()}`,
    kind: "natural_language",
    title: "自然语义变更意图",
    summary: intent,
    freshness: "本次会话",
  };
}

function createChecks(service, profile, sourceRefs) {
  const checks = [
    [
      "latency",
      "请求延迟",
      "http.server.duration.p95",
      "相对稳定版本增幅 ≤ 10%",
      "准入 + 灰度 + 验收",
      "指导书要求控制关键接口延迟，知识图谱显示该服务位于业务主链路并影响多个下游节点。",
      0.96,
    ],
    [
      "errors",
      "错误率",
      "http.server.errors.rate",
      "≤ 0.50%",
      "准入 + 灰度 + 验收",
      "自然语义目标是判断能否发布，指导书将错误率定义为放量阻断门槛，必须跨阶段持续比较。",
      0.95,
    ],
    [
      "availability",
      "服务可用性",
      "service.availability",
      "≥ 99.95%",
      "准入 + 灰度 + 验收",
      "指导书的发布前置条件要求可用性达标，知识图谱中的入口节点使该指标成为核心业务门禁。",
      0.94,
    ],
    [
      "dependency",
      "下游依赖健康",
      "dependency.failure.rate",
      "无新增失败依赖",
      "灰度 + 验收",
      `知识图谱识别 ${profile.graph.nodes.length} 个关键节点与 ${profile.graph.edges.length} 条依赖边，需要避免局部健康掩盖链路退化。`,
      0.92,
    ],
    [
      "business",
      profile.businessName,
      profile.businessMetric,
      "相对基线下降 < 0.30%",
      "准入 + 灰度 + 验收",
      "业务知识图谱把技术服务映射到核心业务结果，避免只看基础指标而遗漏用户可感知的失败。",
      0.93,
    ],
  ];
  return checks.map(
    ([id, name, metric, rule, phase, rationale, confidence]) => ({
      id,
      name,
      metric,
      rule,
      phase,
      priority: "required",
      rationale,
      confidence,
      sourceRefs,
      service,
    }),
  );
}

export function compileInspectionPlan({ intent, service, version }) {
  const intentSource = naturalLanguageSource(service, version, intent);
  const profile = serviceKnowledge[service];
  if (!profile) {
    return {
      status: "blocked",
      generation: {
        sources: [intentSource],
        confidence: 0.38,
        omissions: [
          {
            id: "missing-guide",
            severity: "blocker",
            title: "未匹配到变更指导书",
            action: "关联服务对应的变更指导书后重新生成。",
          },
          {
            id: "missing-graph",
            severity: "blocker",
            title: "业务知识图谱没有该服务节点",
            action: "补充服务与上下游依赖后重新生成。",
          },
        ],
      },
      checks: [],
      orchestration: [],
    };
  }
  const guideSource = {
    kind: "change_guide",
    freshness: "发布前已审批",
    ...profile.guide,
  };
  const graphSource = {
    kind: "knowledge_graph",
    freshness: "2 分钟前",
    ...profile.graph,
  };
  const sources = [intentSource, guideSource, graphSource];
  const sourceRefs = sources.map((source) => source.id);
  return {
    status: "ready",
    generation: { sources, confidence: 0.93, omissions: [] },
    checks: createChecks(service, profile, sourceRefs),
    orchestration: orchestration.map((step) => ({ ...step })),
  };
}

function evidenceForStep(state, stepId) {
  if (stepId === "admission") {
    return state.runs
      .filter((run) => run.purpose === "admission")
      .map((run) => run.id);
  }
  if (stepId === "canary") {
    return [
      ...state.runs
        .filter((run) => run.label.includes("25% 灰度"))
        .map((run) => run.id),
      ...state.findings.map((finding) => finding.id),
    ];
  }
  if (stepId === "remediation") {
    return state.decisions
      .filter((decision) => decision.result === "暂停并处置")
      .map((decision) => decision.id);
  }
  if (stepId === "verification") {
    return state.runs
      .filter((run) => run.purpose === "verification")
      .map((run) => run.id);
  }
  if (stepId === "full-traffic") {
    return state.runs
      .filter((run) => run.label.includes("全量"))
      .map((run) => run.id);
  }
  if (stepId === "acceptance") {
    return state.runs
      .filter((run) => run.purpose === "acceptance")
      .map((run) => run.id);
  }
  if (stepId === "report")
    return state.reportSnapshot ? [state.reportSnapshot.id] : [];
  return [];
}

export function projectExecutionSteps(state) {
  const steps = state.plan.orchestration ?? [];
  const hasVerification = state.runs.some(
    (run) => run.purpose === "verification",
  );
  const nextStepBlocked =
    state.comparabilityContract.status !== "valid" ||
    state.evidenceFreshness !== "fresh";
  function statusFor(step, index) {
    const evidenceRefs = evidenceForStep(state, step.id);
    if (step.id === "canary" && state.findings.length > 0) {
      return hasVerification ? "resolved" : "risk";
    }
    if (evidenceRefs.length > 0) return "passed";
    let status;
    if (index === 0 && state.plan.status === "ready") status = "ready";
    const previous =
      index > 0 ? evidenceForStep(state, steps[index - 1].id) : [];
    status ??= previous.length > 0 ? "ready" : "queued";
    return status === "ready" && nextStepBlocked ? "blocked" : status;
  }
  return steps.map((step, index) => ({
    ...step,
    status: statusFor(step, index),
    evidenceRefs: evidenceForStep(state, step.id),
  }));
}

export { createReportIntelligence } from "./change-inspection-report-intelligence.mjs";
