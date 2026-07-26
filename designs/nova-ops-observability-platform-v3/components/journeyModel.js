export const professionalWorkspaces = {
  metrics: {
    label: "监控",
    icon: "metric",
    query: "p95 / success / capacity · canary vs control",
    decision: "确认异常是否越过 SLO、容量或发布基线",
    evidence: "METRIC-P95-2018 · 149ms vs 105ms",
    freshness: "12s",
  },
  alerts: {
    label: "告警",
    icon: "alert",
    query: "17 raw → 2 correlated clusters → 1 primary event",
    decision: "确认主事件、影响面、路由与告警噪声",
    evidence: "ALERT-CLUSTER-204 · payments-router",
    freshness: "8s",
  },
  logs: {
    label: "日志",
    icon: "logs",
    query: "service:payments-router @error.kind:acquire_timeout",
    decision: "比较异常模式、版本与字段分布，钉入精确样本",
    evidence: "LOG-ACQUIRE-991 · 127 new-pattern events",
    freshness: "12s",
  },
  traces: {
    label: "Trace",
    icon: "trace",
    query: "checkout → payments-router → DB acquire",
    decision: "确认关键路径与下游依赖是否解释业务退化",
    evidence: "TRACE-DBPOOL-514 · 41% critical path",
    freshness: "15s",
  },
  synthetics: {
    label: "拨测",
    icon: "synthetic",
    query: "checkout / cn-south / payment step",
    decision: "用地域与用户步骤反证恢复，缺失即 unknown",
    evidence: "SYNTH-CNSOUTH-388 · stale 6m",
    freshness: "stale",
  },
  inspection: {
    label: "巡检",
    icon: "wand",
    query: "Plan v12 · Run cadence 2m · 38 services",
    decision: "确认检查覆盖、判定门禁、Finding 与复验状态",
    evidence: "RUN-2891 · 86% decidable coverage",
    freshness: "1m",
  },
};

export const journeyCatalog = {
  release: {
    tone: "release",
    role: "发布负责人",
    scene: "变更验证与放量决策",
    question: "CHG-23841 应继续、观察还是回滚？",
    source: "由 CHG-23841 自动继承",
    output: "Decision Record + ActionRun + Verification",
    workspaces: ["metrics", "alerts", "logs", "traces", "synthetics"],
    steps: [
      { label: "锁定变更范围", screen: "change", hint: "Scope / baseline" },
      { label: "比较 Canary / Control", screen: "change", hint: "监控 / 告警" },
      { label: "升级证据调查", screen: "investigation", hint: "日志 / Trace" },
      { label: "记录人工决策", screen: "change", hint: "继续 / 观察 / 回滚" },
      {
        label: "复验并回写报告",
        screen: "reports",
        hint: "Verification gates",
      },
    ],
  },
  diagnosis: {
    tone: "oncall",
    role: "值班 SRE",
    scene: "独立故障诊断",
    question: "告警风暴中哪个事件真正影响支付？",
    source: "由 ALERT-CLUSTER-204 创建",
    output: "Investigation + ActionProposal + 原 Finding 回写",
    workspaces: ["alerts", "metrics", "logs", "traces", "synthetics"],
    steps: [
      { label: "接入告警 / 人工建案", screen: "live", hint: "事件归并" },
      {
        label: "确认影响与责任人",
        screen: "investigation",
        hint: "Scope / topology",
      },
      {
        label: "组织 Observation",
        screen: "investigation",
        hint: "多源 Evidence",
      },
      {
        label: "验证假设与反证",
        screen: "investigation",
        hint: "Next test",
      },
      {
        label: "提议动作并回到复验",
        screen: "reports",
        hint: "ActionProposal",
      },
    ],
  },
  protection: {
    tone: "oncall",
    role: "值班 SRE · 保障负责人",
    scene: "大促高频保障",
    question: "峰值阶段能否继续承载流量增长？",
    source: "由 MIS-61801 保障任务继承",
    output: "阶段决策 + Finding + 保障快照",
    workspaces: ["metrics", "inspection", "synthetics", "logs"],
    steps: [
      { label: "确认保障阶段", screen: "mission", hint: "Scope / owner" },
      { label: "观察业务与容量", screen: "mission", hint: "监控 / 预测" },
      { label: "归并 Risk Signal", screen: "mission", hint: "巡检 / Finding" },
      { label: "人工调频或冻结", screen: "mission", hint: "HIL 决策" },
      { label: "复验与阶段快照", screen: "reports", hint: "Report projection" },
    ],
  },
  service: {
    tone: "service",
    role: "服务 Owner",
    scene: "关键服务巡检与 NL2",
    question: "当前健康覆盖是否足以发布新的巡检 Plan？",
    source: "由 Service Catalog / payments-router 继承",
    output: "Published Plan + First Run + 治理报告",
    workspaces: ["inspection", "metrics", "logs", "alerts", "synthetics"],
    steps: [
      { label: "识别覆盖缺口", screen: "governance", hint: "Coverage / drift" },
      { label: "描述运维意图", screen: "studio", hint: "NL2 clarification" },
      {
        label: "检查结构化 Plan",
        screen: "studio",
        hint: "Query / permission",
      },
      { label: "回放并人工审批", screen: "studio", hint: "Replay / diff" },
      {
        label: "首个 Run 与报告",
        screen: "reports",
        hint: "Finding / verification",
      },
    ],
  },
};

export function getJourneyStep(journeyId, state) {
  if (state.currentScreen === "reports") return 4;

  if (journeyId === "release") {
    if (state.currentScreen === "investigation") return 2;
    if (state.change.actionState !== "not_started") return 3;
    return 1;
  }

  if (journeyId === "diagnosis") {
    if (state.currentScreen === "live") return 0;
    if (state.investigation.actionProposal) return 4;
    if (state.investigation.hypotheses.some((item) => item.tested)) return 3;
    if (state.investigation.evidence.length > 0) return 2;
    return 1;
  }

  if (journeyId === "protection") {
    if (state.mission.expansion === "frozen") return 3;
    if (state.findings.some((item) => item.source === state.mission.id))
      return 2;
    return 1;
  }

  if (state.currentScreen === "governance") return 0;
  if (state.inspectionPlan.status === "published") return 4;
  if (state.inspectionPlan.approval === "approved") return 3;
  if (
    state.inspectionPlan.gates.permission.status === "ready" &&
    state.inspectionPlan.gates.baseline.status === "ready"
  )
    return 2;
  return 1;
}

export function getDecisionSummary(journeyId, state) {
  const summaries = {
    release: {
      fact: `${state.change.liveMetrics.p95}，相对 control ${state.change.liveMetrics.p95Detail}`,
      hypothesis: "连接池等待上升解释 Canary 的支付延迟回归",
      gap: `${state.change.synthetic.freshness}；华南恢复仍不可判定`,
      suggestion: state.change.recommendation,
      verdict: state.change.decision
        ? `已记录：${state.change.decision}`
        : "等待发布负责人选择观察或回滚",
      verdictState: state.change.decision ? "warning" : "unknown",
      owner: "发布负责人",
      due: state.change.decisionRemaining,
    },
    diagnosis: {
      fact: "17 条告警已归并为 2 个事件簇；支付旅程受影响",
      hypothesis: "H1 · DB pool saturation（当前支持证据最多）",
      gap: "华南拨测 stale，地域影响范围仍不完整",
      suggestion:
        "运行 canary/control pool-wait 下一测试，再形成 ActionProposal",
      verdict: state.investigation.actionProposal
        ? "动作建议已生成，待回写原 Finding"
        : "调查中；不得宣布恢复",
      verdictState: state.investigation.actionProposal ? "warning" : "running",
      owner: "payments-oncall",
      due: "12m",
    },
    protection: {
      fact: `${state.mission.actualRps / 1000}k RPS，容量 ${state.mission.capacityRps / 1000}k`,
      hypothesis: "预测上界将在风险窗口越过当前容量阈值",
      gap: "inventory-sync 风险 Owner 尚未完成扩容确认",
      suggestion: `维持 ${state.mission.frequency} 高频巡检并冻结扩流`,
      verdict:
        state.mission.expansion === "frozen"
          ? "扩流已冻结，等待容量动作复验"
          : "等待保障负责人确认阶段动作",
      verdictState: "warning",
      owner: state.mission.commander,
      due: state.mission.nextDecisionAt,
    },
    service: {
      fact: `${state.governance.coverage}% 服务具备可判定健康覆盖`,
      hypothesis: "补齐拨测权限与可比基线后，候选 Plan 可进入回放",
      gap: `${state.governance.staleSources} stale sources · ${state.governance.baselineDrift} drifted baselines`,
      suggestion: "先修复门禁，再审阅 Draft v2 diff 与 7 天 Replay",
      verdict:
        state.inspectionPlan.status === "published"
          ? "Plan v2 已发布，首个 Run 已排队"
          : "等待服务 Owner / SRE 负责人审批",
      verdictState:
        state.inspectionPlan.status === "published" ? "passed" : "unknown",
      owner: "payments-owner",
      due: "Today 21:30",
    },
  };

  return summaries[journeyId] ?? summaries.diagnosis;
}
