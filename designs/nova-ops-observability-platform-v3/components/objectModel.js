export const professionalWorkspaces = {
  metrics: {
    label: "Metrics",
    icon: "metric",
    query: "p95 / success / capacity · canary vs control",
    decision: "确认异常是否越过 SLO、容量或发布基线",
    evidence: "METRIC-P95-2018 · 149ms vs 105ms",
    freshness: "12s",
  },
  alerts: {
    label: "Alerts",
    icon: "alert",
    query: "17 raw → 2 correlated clusters → 1 primary event",
    decision: "确认主事件、影响面、路由与告警噪声",
    evidence: "ALERT-CLUSTER-204 · payments-router",
    freshness: "8s",
  },
  logs: {
    label: "Logs",
    icon: "logs",
    query: "service:payments-router @error.kind:acquire_timeout",
    decision: "比较异常模式、版本与字段分布，钉入精确样本",
    evidence: "LOG-ACQUIRE-991 · 127 new-pattern events",
    freshness: "12s",
  },
  traces: {
    label: "Traces",
    icon: "trace",
    query: "checkout → payments-router → DB acquire",
    decision: "确认关键路径与下游依赖是否解释业务退化",
    evidence: "TRACE-DBPOOL-514 · 41% critical path",
    freshness: "15s",
  },
  synthetics: {
    label: "Synthetics",
    icon: "synthetic",
    query: "checkout / cn-south / payment step",
    decision: "用地域与用户步骤反证恢复，缺失即 unknown",
    evidence: "SYNTH-CNSOUTH-388 · stale 6m",
    freshness: "stale",
  },
  inspection: {
    label: "Inspection",
    icon: "wand",
    query: "Plan v12 · Run cadence 2m · 38 services",
    decision: "确认检查覆盖、判定门禁、Finding 与复验状态",
    evidence: "RUN-2891 · 86% decidable coverage",
    freshness: "1m",
  },
  forecast: {
    label: "Forecast",
    icon: "pulse",
    query: "90% confidence band · capacity threshold 220k",
    decision: "确认风险窗口、预测适用性与容量动作",
    evidence: "RISK-SIGNAL-552 · 20:24–20:38",
    freshness: "1m",
  },
  plan: {
    label: "Plan",
    icon: "wand",
    query: "intent → checks → equivalent queries → gates",
    decision: "审阅自然语言意图编译出的结构化巡检计划",
    evidence: "PLAN-312 · Draft v2",
    freshness: "draft",
  },
  replay: {
    label: "Replay",
    icon: "pulse",
    query: "7d historical replay · triggers / matched / noise",
    decision: "用历史回放判断候选检查是否可发布",
    evidence: "REPLAY-PLAN-312 · pending",
    freshness: "pending",
  },
};

export const objectCatalog = {
  incident: {
    type: "incident",
    layout: "forensics",
    tone: "incident",
    label: "Incident",
    plural: "Incidents",
    icon: "alert",
    id: "INC-7719",
    title: "支付 p95 回归",
    status: "investigating",
    source: "由 ALERT-CLUSTER-204 创建",
    impact: "18.2k 用户 · 成功率 -0.18pp · p95 +38%",
    output: "Investigation + ActionProposal + 原 Finding 回写",
    screen: "investigation",
    workspaces: ["alerts", "metrics", "logs", "traces", "synthetics"],
    steps: [
      {
        label: "接入告警 / 人工建案",
        screen: "investigation",
        hint: "事件归并",
      },
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
      { label: "验证假设与反证", screen: "investigation", hint: "Next test" },
      {
        label: "提议动作并回写",
        screen: "investigation",
        hint: "ActionProposal",
      },
    ],
  },
  change: {
    type: "change",
    layout: "validation",
    tone: "change",
    label: "Change",
    plural: "Changes",
    icon: "branch",
    id: "CHG-23841",
    title: "payments-router v3.18.0",
    status: "blocked",
    source: "由 CHG-23841 自动继承",
    impact: "10% canary · 2 fail · 1 unknown",
    output: "Decision Record + ActionRun + Verification",
    screen: "change",
    workspaces: ["metrics", "alerts", "logs", "traces", "synthetics"],
    steps: [
      { label: "锁定变更范围", screen: "change", hint: "Scope / baseline" },
      {
        label: "比较 Canary / Control",
        screen: "change",
        hint: "Metrics / alerts",
      },
      { label: "升级证据调查", screen: "change", hint: "Incident link" },
      { label: "记录人工决策", screen: "change", hint: "观察 / 回滚" },
      { label: "复验并回写报告", screen: "change", hint: "Verification gates" },
    ],
  },
  mission: {
    type: "mission",
    layout: "command",
    tone: "mission",
    label: "Mission",
    plural: "Missions",
    icon: "shield",
    id: "MIS-61801",
    title: "全球购 618 峰值保障",
    status: "running",
    source: "由 MIS-61801 保障任务继承",
    impact: "181k RPS · 17.7% capacity headroom",
    output: "阶段决策 + Finding + 保障快照",
    screen: "mission",
    workspaces: ["metrics", "forecast", "inspection", "logs"],
    steps: [
      { label: "确认保障阶段", screen: "mission", hint: "Scope / owner" },
      {
        label: "观察业务与容量",
        screen: "mission",
        hint: "Metrics / forecast",
      },
      {
        label: "归并 Risk Signal",
        screen: "mission",
        hint: "Inspection / Finding",
      },
      { label: "人工调频或冻结", screen: "mission", hint: "HIL decision" },
      { label: "复验与阶段快照", screen: "mission", hint: "Report projection" },
    ],
  },
  inspection: {
    type: "inspection",
    layout: "compiler",
    tone: "inspection",
    label: "Inspection",
    plural: "Inspections",
    icon: "wand",
    id: "PLAN-312",
    title: "全球购结算链路峰值巡检",
    status: "draft",
    source: "由 Service Catalog / payments-router 继承",
    impact: "84% decidable · 7 stale · 3 baseline drift",
    output: "Published Plan + First Run + 治理报告",
    screen: "studio",
    workspaces: ["plan", "metrics", "inspection", "replay", "logs"],
    steps: [
      { label: "识别覆盖缺口", screen: "studio", hint: "Coverage / drift" },
      { label: "描述运维意图", screen: "studio", hint: "NL2 clarification" },
      {
        label: "检查结构化 Plan",
        screen: "studio",
        hint: "Query / permission",
      },
      { label: "回放并人工审批", screen: "studio", hint: "Replay / diff" },
      {
        label: "首个 Run 与报告",
        screen: "studio",
        hint: "Finding / verification",
      },
    ],
  },
};

export const sreQueue = [
  {
    type: "incident",
    id: "INC-7719",
    signal: "ALERT-CLUSTER-204",
    title: "支付 p95 回归",
    stage: "影响确认",
    due: "12m",
    nextAction: "确认影响拓扑",
    urgency: "P1",
    status: "investigating",
  },
  {
    type: "change",
    id: "CHG-23841",
    title: "payments-router v3.18.0",
    stage: "决策阻塞",
    due: "08:12",
    nextAction: "决定回滚 / 观察",
    urgency: "P1",
    status: "blocked",
  },
  {
    type: "mission",
    id: "MIS-61801",
    title: "全球购 618 峰值保障",
    stage: "峰值保障",
    due: "20:24",
    nextAction: "冻结扩流",
    urgency: "P2",
    status: "running",
  },
  {
    type: "inspection",
    id: "PLAN-312",
    title: "全球购结算链路峰值巡检",
    stage: "等待审批",
    due: "21:30",
    nextAction: "审批 Draft v2",
    urgency: "P2",
    status: "unknown",
  },
];

export function getObjectStep(objectType, state) {
  if (objectType === "incident") {
    if (state.investigation.writeback?.status === "written_back") return 4;
    if (state.investigation.actionProposal) return 4;
    if (state.investigation.hypotheses.some((item) => item.tested)) return 3;
    if (state.investigation.observations.length >= 3) return 2;
    return 1;
  }

  if (objectType === "change") {
    if (state.change.verification.status !== "not_started") return 4;
    if (state.change.decision) return 3;
    if (state.investigation.sourceObject?.type === "change") return 2;
    return 1;
  }

  if (objectType === "mission") {
    if (state.mission.expansion === "frozen") return 3;
    if (state.findings.some((item) => item.source === state.mission.id))
      return 2;
    return 1;
  }

  if (state.inspectionPlan.status === "published") return 4;
  if (state.inspectionPlan.approval === "approved") return 3;
  if (
    state.inspectionPlan.gates.permission.status === "ready" &&
    state.inspectionPlan.gates.baseline.status === "ready"
  )
    return 2;
  return 1;
}

export function getObjectDecisionSummary(objectType, state) {
  const summaries = {
    incident: {
      fact: "17 条告警已归并为 2 个事件簇；支付旅程受影响",
      hypothesis: "H1 · DB pool saturation（当前支持证据最多）",
      gap: "华南拨测 stale，地域影响范围仍不完整",
      suggestion:
        "运行 canary/control pool-wait 下一测试，再形成 ActionProposal",
      verdict: state.investigation.writeback
        ? `动作建议已回写 ${state.investigation.sourceObject.id}，等待源对象复验`
        : state.investigation.actionProposal
          ? "动作建议已生成，待回写源 Finding"
          : "调查中；不得宣布恢复",
      verdictState: state.investigation.actionProposal ? "warning" : "running",
      owner: "payments-oncall",
      due: "12m",
    },
    change: {
      fact: `${state.change.liveMetrics.p95}，相对 control ${state.change.liveMetrics.p95Detail}`,
      hypothesis:
        state.change.status === "passed"
          ? "已验证：版本回滚消除 Canary 回归，原假设获得复验支持"
          : "连接池等待上升解释 Canary 的支付延迟回归",
      gap:
        state.change.status === "passed"
          ? "0 freshness unknown · 0 open verification gate"
          : `${state.change.synthetic.freshness}；华南恢复仍不可判定`,
      suggestion:
        state.change.status === "passed"
          ? "归档 Decision Record 与版本化报告"
          : state.change.recommendation,
      verdict:
        state.change.status === "passed"
          ? "Verification passed · Change 可关闭"
          : state.change.decision
            ? `已记录：${state.change.decision}`
            : "等待选择观察或回滚",
      verdictState:
        state.change.status === "passed"
          ? "passed"
          : state.change.decision
            ? "warning"
            : "unknown",
      owner: "payments-release",
      due: state.change.decisionRemaining,
    },
    mission: {
      fact: `${state.mission.actualRps / 1000}k RPS，容量 ${state.mission.capacityRps / 1000}k`,
      hypothesis: "预测上界将在风险窗口越过当前容量阈值",
      gap: "inventory-sync 风险 Owner 尚未完成扩容确认",
      suggestion: `维持 ${state.mission.frequency} 高频巡检并冻结扩流`,
      verdict:
        state.mission.expansion === "frozen"
          ? "扩流已冻结，等待容量动作复验"
          : "等待保障阶段动作",
      verdictState: "warning",
      owner: state.mission.commander,
      due: state.mission.nextDecisionAt,
    },
    inspection: {
      fact: `${state.governance.coverage}% 服务具备可判定健康覆盖`,
      hypothesis: "补齐拨测权限与可比基线后，候选 Plan 可进入回放",
      gap: `${state.governance.staleSources} stale sources · ${state.governance.baselineDrift} drifted baselines`,
      suggestion: "先修复门禁，再审阅 Draft v2 diff 与 7 天 Replay",
      verdict:
        state.inspectionPlan.status === "published"
          ? "Plan v2 已发布，首个 Run 已排队"
          : "等待 SRE 审批",
      verdictState:
        state.inspectionPlan.status === "published" ? "passed" : "unknown",
      owner: "payments-owner",
      due: "Today 21:30",
    },
  };

  return summaries[objectType] ?? summaries.incident;
}
