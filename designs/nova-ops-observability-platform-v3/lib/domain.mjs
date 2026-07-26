const seedState = {
  scope: {
    environment: "Production",
    business: "全球购核心链路",
    service: "payments-router",
    regions: ["cn-east", "cn-south"],
    timeRange: "19:45–20:30",
    missionId: "MIS-61801",
    changeId: "CHG-23841",
  },
  currentScreen: "home",
  activeObject: null,
  mission: {
    id: "MIS-61801",
    name: "全球购 618 峰值保障",
    status: "running",
    stage: "峰值",
    stageIndex: 2,
    stages: ["预热", "爬坡", "峰值", "回落", "复盘"],
    commander: "陈工",
    frequency: "2m",
    estimatedDailyCost: 42,
    planVersion: 12,
    services: 38,
    nextDecisionAt: "20:24",
    expansion: "frozen",
    actualRps: 181000,
    capacityRps: 220000,
    forecastReadiness: "ready",
    forecastWindow: "20:24–20:38",
    forecastHistory: [
      96, 102, 111, 125, 139, 154, 166, 176, 181, 186, 191, 196,
    ],
    forecastMedian: [181, 187, 194, 201, 209, 216],
    forecastLow: [176, 180, 185, 190, 195, 199],
    forecastHigh: [188, 196, 205, 215, 226, 238],
    transactionFunnel: [
      { name: "曝光", realtime: 100, plan: 100, yesterday: 100 },
      { name: "搜索", realtime: 82, plan: 84, yesterday: 81 },
      { name: "加购", realtime: 61, plan: 64, yesterday: 60 },
      { name: "结算", realtime: 38, plan: 42, yesterday: 41 },
      { name: "支付", realtime: 32, plan: 37, yesterday: 36 },
    ],
    runHeatmap: [
      [
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
      ],
      [
        "pass",
        "pass",
        "pass",
        "warning",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "warning",
        "pass",
        "pass",
      ],
      [
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "warning",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
      ],
      [
        "pass",
        "pass",
        "pass",
        "pass",
        "fail",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "warning",
        "pass",
      ],
      [
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "unknown",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "unknown",
      ],
      [
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "warning",
        "pass",
        "pass",
        "pass",
      ],
    ],
  },
  change: {
    id: "CHG-23841",
    title: "payments-router v3.18.0",
    status: "blocked",
    decision: null,
    actionState: "not_started",
    canaryPercent: 10,
    controlPercent: 90,
    startedAt: "20:03",
    decisionRemaining: "08:12",
    recommendation: "暂停扩流",
    liveMetrics: {
      success: "99.72%",
      successDetail: "control 99.91%",
      p95: "142ms",
      p95Detail: "+38% vs control",
      poolWait: "78%",
      poolWaitDetail: "control 45%",
    },
    verification: {
      status: "not_started",
      gates: {
        coverage: "pass",
        freshness: "unknown",
        baseline: "pass",
        execution: "unknown",
        objectives: "fail",
      },
    },
    synthetic: {
      state: "unknown",
      freshness: "stale 6m",
    },
    canarySeries: [103, 105, 109, 116, 124, 136, 142, 148, 151, 149],
    controlSeries: [101, 102, 101, 103, 104, 103, 104, 105, 104, 105],
    objectiveRows: [
      {
        name: "支付成功率",
        status: "fail",
        current: "99.72%",
        control: "99.91%",
        threshold: "≥ 99.85%",
        freshness: "12s",
        owner: "payments-oncall",
        evidence: 4,
      },
      {
        name: "支付 p95",
        status: "fail",
        current: "142ms",
        control: "103ms",
        threshold: "≤ 120ms",
        freshness: "12s",
        owner: "payments-oncall",
        evidence: 5,
      },
      {
        name: "5xx 率",
        status: "pass",
        current: "0.02%",
        control: "0.02%",
        threshold: "≤ 0.05%",
        freshness: "12s",
        owner: "sre",
        evidence: 2,
      },
      {
        name: "DB pool 等待",
        status: "warning",
        current: "78%",
        control: "45%",
        threshold: "≤ 80%",
        freshness: "18s",
        owner: "db-oncall",
        evidence: 3,
      },
      {
        name: "华东拨测",
        status: "pass",
        current: "OK",
        control: "OK",
        threshold: "OK",
        freshness: "25s",
        owner: "synthetics",
        evidence: 2,
      },
      {
        name: "华南拨测",
        status: "unknown",
        current: "stale 6m",
        control: "OK",
        threshold: "OK",
        freshness: "6m stale",
        owner: "synthetics",
        evidence: 0,
      },
      {
        name: "日志新模式",
        status: "fail",
        current: "3 patterns",
        control: "0",
        threshold: "0",
        freshness: "1m",
        owner: "payments-oncall",
        evidence: 3,
      },
    ],
  },
  inspectionPlan: {
    id: "PLAN-312",
    title: "全球购结算链路峰值巡检",
    status: "draft",
    version: "Draft v2",
    prompt:
      "大促峰值期间每 2 分钟检查结算和支付链路，发现容量、成功率、延迟或区域拨测风险时生成报告并通知 Owner。",
    clarifications: [
      { question: "保障范围", answer: "全球购结算/支付；cn-east + cn-south" },
      { question: "对比基线", answer: "同星期同时间 + 变更前 30m" },
      { question: "输出", answer: "实时 Finding + 阶段快照 + 结束报告" },
    ],
    checks: [
      {
        id: "CK-1",
        name: "支付成功率",
        source: "metrics",
        query:
          "sum(rate(payment_success_total[5m])) / sum(rate(payment_attempt_total[5m]))",
        window: "5m",
        compare: "control + 30m baseline",
        rule: "< 99.85% for 2/3 runs",
        owner: "payments-oncall",
      },
      {
        id: "CK-2",
        name: "支付 p95",
        source: "traces",
        query: "p95(span.duration), by:{service,version}",
        window: "5m",
        compare: "canary vs control",
        rule: "> 120ms for 2/3 runs",
        owner: "payments-oncall",
      },
      {
        id: "CK-3",
        name: "区域结算拨测",
        source: "synthetics",
        query: "journey:checkout region:(cn-east OR cn-south)",
        window: "2m",
        compare: "step waterfall",
        rule: "any critical step fail",
        owner: "synthetics",
      },
      {
        id: "CK-4",
        name: "库存同步延迟",
        source: "logs",
        query: "service:inventory-sync @lag_ms:* | p95(@lag_ms)",
        window: "5m",
        compare: "14d seasonal",
        rule: "> 800ms",
        owner: "inventory-oncall",
      },
    ],
    gates: {
      schema: { status: "ready", detail: "4/4 source schemas resolved" },
      sample: { status: "ready", detail: "132 ms · 18.4 MB" },
      freshness: { status: "ready", detail: "latest 9s" },
      permission: {
        status: "blocked",
        detail: "cn-south synthetic detail denied",
      },
      baseline: { status: "learning", detail: "3/5 comparable runs" },
      cost: { status: "ready", detail: "¥42/day · budget ¥80" },
    },
    replay: {
      status: "pending",
      triggers: 0,
      matchedIncidents: 0,
      noise: 0,
    },
    approval: "pending",
  },
  investigation: {
    id: "INV-7719",
    objectId: "INC-7719",
    title: "支付 p95 回归",
    status: "testing_hypotheses",
    sourceAlertCluster: "ALERT-CLUSTER-204",
    sourceObject: null,
    sourceFindingId: null,
    writeback: null,
    revision: 3,
    impact: "成功率 -0.18pp · p95 +38% · 18.2k 用户",
    coverage: 82,
    observations: [
      {
        id: "OBS-1",
        source: "metrics",
        statement: "20:03 canary 启动后 p95 从 103ms 升至 142ms",
        evidenceId: "METRIC-238",
      },
      {
        id: "OBS-2",
        source: "logs",
        statement: "v3.18.0 出现 3 个新的 connection acquire timeout 模式",
        evidenceId: "LOG-882",
      },
      {
        id: "OBS-3",
        source: "traces",
        statement: "checkout → payments-router 的 DB acquire 占关键路径 41%",
        evidenceId: "TRACE-514",
      },
    ],
    evidence: ["METRIC-238", "LOG-882", "TRACE-514"],
    hypotheses: [
      {
        id: "H1",
        claim: "DB connection pool saturation",
        confidence: 0.81,
        supporting: 3,
        refuting: 1,
        nextTest: "compare pool wait canary vs control",
        status: "likely",
        tested: false,
      },
      {
        id: "H2",
        claim: "promo-pricing downstream latency",
        confidence: 0.42,
        supporting: 2,
        refuting: 2,
        nextTest: "check promo-pricing p95",
        status: "possible",
        tested: false,
      },
      {
        id: "H3",
        claim: "regional network degradation",
        confidence: 0.16,
        supporting: 0,
        refuting: 3,
        nextTest: "cross-region traceroute",
        status: "unlikely",
        tested: false,
      },
    ],
    actionProposal: null,
  },
  journeys: [
    {
      id: "login",
      name: "登录",
      health: "healthy",
      success: "99.98%",
      p95: "34ms",
      slo: "99.95%",
      region: "全球",
      freshness: "8s",
    },
    {
      id: "search",
      name: "搜索",
      health: "healthy",
      success: "99.91%",
      p95: "56ms",
      slo: "99.90%",
      region: "全球",
      freshness: "8s",
    },
    {
      id: "cart",
      name: "加购",
      health: "healthy",
      success: "99.87%",
      p95: "78ms",
      slo: "99.85%",
      region: "全球",
      freshness: "8s",
    },
    {
      id: "checkout",
      name: "结算",
      health: "degraded",
      success: "99.62%",
      p95: "128ms",
      slo: "99.85%",
      region: "cn-east",
      freshness: "12s",
    },
    {
      id: "payment",
      name: "支付",
      health: "degraded",
      success: "99.72%",
      p95: "142ms",
      slo: "99.85%",
      region: "cn-east",
      freshness: "12s",
    },
    {
      id: "order-query",
      name: "订单查询",
      health: "unknown",
      success: "—",
      p95: "—",
      slo: "99.85%",
      region: "cn-south",
      freshness: "stale 6m",
    },
  ],
  findings: [
    {
      id: "FND-8821",
      title: "支付 p95 相对 control +38%",
      severity: "P1",
      status: "investigating",
      owner: "payments-oncall",
      source: "CHG-23841",
      dueAt: "20:26",
      evidence: 5,
    },
    {
      id: "FND-8824",
      title: "checkout 新增连接池超时模式",
      severity: "P1",
      status: "open",
      owner: "payments-oncall",
      source: "CHG-23841",
      dueAt: "20:28",
      evidence: 3,
    },
    {
      id: "FND-8828",
      title: "华南拨测 freshness unknown",
      severity: "P2",
      status: "unknown",
      owner: "unassigned",
      source: "CHG-23841",
      dueAt: "20:40",
      evidence: 0,
    },
    {
      id: "FND-8832",
      title: "库存同步延迟预测将在 20:31 越线",
      severity: "P2",
      status: "open",
      owner: "inventory-oncall",
      source: "MIS-61801",
      dueAt: "20:24",
      evidence: 4,
    },
    {
      id: "FND-8840",
      title: "华南拨测权限与可比基线未就绪",
      severity: "P2",
      status: "unknown",
      owner: "payments-owner",
      source: "PLAN-312",
      dueAt: "21:30",
      evidence: 2,
    },
  ],
  agentRuns: [
    {
      id: "RUN-1842",
      kind: "inspection",
      title: "峰值高频巡检",
      status: "running",
      progress: 62,
      currentStep: "querying synthetics",
      elapsed: "2m 14s",
    },
    {
      id: "INV-7719",
      kind: "diagnosis",
      title: "支付 p95 回归",
      status: "running",
      progress: 78,
      currentStep: "testing DB pool H1",
      elapsed: "18m 06s",
    },
  ],
  reports: [
    {
      id: "RPT-618-07",
      title: "峰值阶段健康快照",
      status: "live",
      generatedAt: "20:18",
      missionId: "MIS-61801",
      coverage: 94,
      findings: 4,
      openActions: 3,
      verification: "blocked",
    },
    {
      id: "RPT-618-06",
      title: "爬坡阶段报告",
      status: "final",
      generatedAt: "19:58",
      missionId: "MIS-61801",
      coverage: 98,
      findings: 2,
      openActions: 0,
      verification: "passed",
    },
    {
      id: "RPT-CHG-23841",
      title: "payments-router 灰度验证",
      status: "live",
      generatedAt: "20:19",
      missionId: "MIS-61801",
      coverage: 91,
      findings: 3,
      openActions: 1,
      verification: "blocked",
    },
  ],
  governance: {
    coverage: 84,
    staleSources: 7,
    baselineDrift: 3,
    degradedTools: 2,
    forecast: { ready: 12, notReady: 4, degraded: 3 },
    coverageMatrix: [
      {
        service: "payments-router",
        tier: "P0",
        owner: "payments-owner",
        metrics: true,
        logs: true,
        traces: true,
        synthetics: false,
        alerts: true,
      },
      {
        service: "checkout",
        tier: "P0",
        owner: "checkout-owner",
        metrics: true,
        logs: true,
        traces: true,
        synthetics: true,
        alerts: true,
      },
      {
        service: "inventory",
        tier: "P1",
        owner: "inventory-owner",
        metrics: true,
        logs: false,
        traces: false,
        synthetics: true,
        alerts: true,
      },
      {
        service: "search",
        tier: "P1",
        owner: "search-owner",
        metrics: true,
        logs: true,
        traces: true,
        synthetics: false,
        alerts: false,
      },
      {
        service: "order-query",
        tier: "P1",
        owner: "order-owner",
        metrics: false,
        logs: true,
        traces: false,
        synthetics: false,
        alerts: true,
      },
    ],
  },
  followUpChecks: [],
  timeline: [
    {
      at: "19:45",
      kind: "mission",
      title: "峰值保障阶段开始",
      detail: "Plan v12 · 2m frequency",
    },
    {
      at: "20:03",
      kind: "change",
      title: "CHG-23841 启动 10% canary",
      detail: "payments-router v3.18.0",
    },
    {
      at: "20:06",
      kind: "finding",
      title: "支付 p95 越过 120ms",
      detail: "canary +38% vs control",
    },
    {
      at: "20:09",
      kind: "unknown",
      title: "华南拨测数据过期",
      detail: "freshness stale 6m",
    },
    {
      at: "20:12",
      kind: "investigation",
      title: "INV-7719 开始验证 H1",
      detail: "DB pool saturation",
    },
  ],
  audit: [
    {
      at: "20:03:12",
      actor: "Inspection Agent",
      action: "guard.started",
      detail: "CHG-23841 · 10% canary",
    },
    {
      at: "20:12:08",
      actor: "Diagnosis Agent",
      action: "investigation.started",
      detail: "INV-7719 from FND-8821",
    },
  ],
};

function clone(value) {
  return structuredClone(value);
}

function audit(state, actor, action, detail) {
  state.audit.push({
    at: `20:${String(18 + state.audit.length).padStart(2, "0")}:00`,
    actor,
    action,
    detail,
  });
}

function nextRunId(state, prefix) {
  const count = state.agentRuns.filter((run) =>
    run.id.startsWith(prefix),
  ).length;
  return `${prefix}-${2900 + count + 1}`;
}

function evaluateVerificationGates(state) {
  const objectiveStates = state.change.objectiveRows.map((row) => row.status);
  const objectives = objectiveStates.every((status) => status === "pass")
    ? "pass"
    : objectiveStates.some((status) => status === "unknown")
      ? "unknown"
      : "fail";

  return {
    coverage: "pass",
    freshness: state.change.synthetic.state === "pass" ? "pass" : "unknown",
    baseline: "pass",
    execution: state.change.actionState === "completed" ? "pass" : "fail",
    objectives,
  };
}

const operationalObjectScreens = {
  incident: "investigation",
  change: "change",
  mission: "mission",
  inspection: "studio",
};

export function createInitialState() {
  return clone(seedState);
}

export function getPlanPublishBlockers(state) {
  const blockers = [];
  if (state.inspectionPlan.gates.permission.status !== "ready")
    blockers.push("permission");
  if (state.inspectionPlan.gates.baseline.status !== "ready")
    blockers.push("baseline");
  if (state.inspectionPlan.replay.status !== "completed")
    blockers.push("replay");
  if (state.inspectionPlan.approval !== "approved") blockers.push("approval");
  return blockers;
}

export function reduceOpsState(current, action) {
  const state = clone(current);

  switch (action.type) {
    case "OBJECT_OPEN": {
      const screen = operationalObjectScreens[action.objectType];
      if (!screen || !action.objectId) {
        audit(
          state,
          "SRE",
          "object.open.rejected",
          `${action.objectType ?? "unknown"}:${action.objectId ?? "missing"}`,
        );
        return state;
      }
      state.activeObject = {
        type: action.objectType,
        id: action.objectId,
      };
      state.currentScreen = screen;
      audit(
        state,
        "SRE",
        "object.opened",
        `${action.objectType}:${action.objectId}`,
      );
      return state;
    }

    case "OBJECT_CLOSE":
      state.activeObject = null;
      state.currentScreen = "home";
      return state;

    case "INCIDENT_ESCALATED": {
      const sourceScreen = operationalObjectScreens[action.sourceObject?.type];
      if (
        !sourceScreen ||
        action.sourceObject.type === "incident" ||
        !action.sourceObject.id ||
        !action.findingId
      ) {
        audit(
          state,
          "SRE",
          "incident.escalation.rejected",
          "source object or finding missing",
        );
        return state;
      }
      state.investigation.sourceObject = clone(action.sourceObject);
      state.investigation.sourceFindingId = action.findingId;
      state.investigation.writeback = null;
      state.investigation.status = "testing_hypotheses";
      state.activeObject = {
        type: "incident",
        id: state.investigation.objectId,
      };
      state.currentScreen = "investigation";
      audit(
        state,
        "SRE",
        "incident.escalated",
        `${action.sourceObject.type}:${action.sourceObject.id} → ${state.investigation.objectId}`,
      );
      return state;
    }

    case "ACTION_PROPOSAL_WRITTEN_BACK": {
      const targetFinding = state.findings.find(
        (finding) => finding.id === state.investigation.sourceFindingId,
      );
      if (
        !state.investigation.actionProposal ||
        !state.investigation.sourceObject ||
        !targetFinding
      ) {
        audit(
          state,
          "SRE",
          "action-proposal.writeback.rejected",
          "conclusion, source object, or target finding missing",
        );
        return state;
      }
      targetFinding.status = "pending_action";
      state.investigation.actionProposal.status = "written_back";
      state.investigation.writeback = {
        status: "written_back",
        targetFindingId: targetFinding.id,
        targetObject: clone(state.investigation.sourceObject),
      };
      audit(
        state,
        "SRE",
        "action-proposal.written_back",
        `${state.investigation.objectId} → ${state.investigation.sourceObject.id}/${targetFinding.id}`,
      );
      return state;
    }

    case "NAVIGATE":
      state.currentScreen = action.screen;
      if (["home", "live", "reports", "governance"].includes(action.screen)) {
        state.activeObject = null;
      }
      return state;

    case "MISSION_FREQUENCY_CHANGED": {
      const previous = state.mission.frequency;
      state.mission.frequency = action.frequency;
      state.mission.estimatedDailyCost =
        action.frequency === "1m" ? 126 : action.frequency === "2m" ? 42 : 24;
      audit(
        state,
        "陈工",
        "mission.frequency.changed",
        `${previous} → ${action.frequency}; ¥${state.mission.estimatedDailyCost}/day`,
      );
      return state;
    }

    case "MISSION_EXPANSION_FROZEN":
      state.mission.expansion = "frozen";
      audit(state, "陈工", "mission.expansion.frozen", "峰值阶段停止继续扩流");
      return state;

    case "FINDING_CLAIMED": {
      const finding = state.findings.find(
        (item) => item.id === action.findingId,
      );
      if (finding) {
        finding.owner = action.owner;
        finding.status = "in_progress";
        audit(state, action.owner, "finding.claimed", finding.id);
      }
      return state;
    }

    case "CHANGE_DECISION_SET":
      if (state.change.status === "passed") {
        audit(
          state,
          "payments-release",
          "change.decision.rejected",
          "event already verified",
        );
        return state;
      }
      state.change.status =
        action.decision === "rollback" ? "rolling_back" : "observing";
      state.change.decision = action.decision;
      state.change.actionState = "in_progress";
      state.change.recommendation =
        action.decision === "rollback"
          ? "执行回滚并复验"
          : "保持 10% 并延长观察";
      state.investigation.actionProposal = {
        action: action.decision,
        runbook: "payments-router-rollback-v3",
        approval: "L2 + oncall",
        status: "approved",
      };
      audit(state, "payments-release", "change.decision.set", action.decision);
      return state;

    case "CHANGE_ACTION_COMPLETED": {
      if (state.change.actionState !== "in_progress") {
        audit(
          state,
          "payments-release",
          "change.action.complete.rejected",
          "no action in progress",
        );
        return state;
      }

      state.change.actionState = "completed";
      state.change.status = "awaiting_verification";

      if (state.change.decision === "rollback") {
        state.change.canaryPercent = 0;
        state.change.controlPercent = 100;
        state.change.liveMetrics = {
          success: "99.91%",
          successDetail: "post-rollback · control 99.91%",
          p95: "105ms",
          p95Detail: "post-rollback · threshold 120ms",
          poolWait: "45%",
          poolWaitDetail: "post-rollback · threshold 80%",
        };
        const postRollback = {
          支付成功率: {
            status: "pass",
            current: "99.91%",
            freshness: "12s",
            evidence: 7,
          },
          "支付 p95": {
            status: "pass",
            current: "105ms",
            freshness: "12s",
            evidence: 8,
          },
          "5xx 率": {
            status: "pass",
            current: "0.02%",
            freshness: "12s",
            evidence: 3,
          },
          "DB pool 等待": {
            status: "pass",
            current: "45%",
            freshness: "12s",
            evidence: 6,
          },
          华东拨测: {
            status: "pass",
            current: "OK",
            freshness: "12s",
            evidence: 3,
          },
          日志新模式: {
            status: "pass",
            current: "0 patterns",
            freshness: "1m",
            evidence: 5,
          },
        };
        state.change.objectiveRows = state.change.objectiveRows.map((row) =>
          postRollback[row.name] ? { ...row, ...postRollback[row.name] } : row,
        );
      }

      state.change.verification.gates = evaluateVerificationGates(state);
      audit(
        state,
        "payments-release",
        "change.action.completed",
        state.change.decision,
      );
      return state;
    }

    case "VERIFICATION_START": {
      if (state.change.actionState !== "completed") {
        audit(
          state,
          "Inspection Agent",
          "verification.start.rejected",
          "remediation action not completed",
        );
        return state;
      }
      const previousBlocked = [...state.agentRuns]
        .reverse()
        .find((run) => run.kind === "verification" && run.status === "blocked");
      const id = nextRunId(state, "VR");
      state.change.verification.status = "running";
      state.agentRuns.push({
        id,
        kind: "verification",
        title: "变更后健康复验",
        status: "running",
        progress: 28,
        currentStep: "collecting post-action evidence",
        elapsed: "0m 18s",
        retryOf: previousBlocked?.id ?? null,
      });
      audit(state, "Inspection Agent", "verification.started", id);
      return state;
    }

    case "VERIFICATION_EVALUATE": {
      if (state.change.verification.status !== "running") {
        audit(
          state,
          "Inspection Agent",
          "verification.evaluate.rejected",
          `status=${state.change.verification.status}`,
        );
        return state;
      }
      const gates = evaluateVerificationGates(state);
      state.change.verification.gates = gates;
      const blockers = Object.entries(gates)
        .filter(([, value]) => value !== "pass")
        .map(([key]) => key);
      const activeRun = [...state.agentRuns]
        .reverse()
        .find((run) => run.kind === "verification" && run.status === "running");

      if (blockers.length > 0) {
        state.change.verification.status = "blocked";
        state.change.verification.blockedBy = blockers;
        if (activeRun) {
          activeRun.status = "blocked";
          activeRun.progress = 66;
          activeRun.currentStep = `blocked by ${blockers.join(", ")}`;
        }
        audit(
          state,
          "Inspection Agent",
          "verification.blocked",
          blockers.join(", "),
        );
        return state;
      }

      state.change.verification.status = "passed";
      state.change.verification.blockedBy = [];
      state.change.status = "passed";
      state.change.recommendation = "回滚后复验通过 · 可以结束事件";
      if (activeRun) {
        activeRun.status = "succeeded";
        activeRun.progress = 100;
        activeRun.currentStep = "all gates passed";
      }
      const journey = state.journeys.find((item) => item.id === "order-query");
      journey.health = "healthy";
      journey.success = "99.80%";
      journey.p95 = "52ms";
      journey.freshness = "12s";
      const finding = state.findings.find((item) => item.id === "FND-8828");
      finding.status = "closed";
      state.journeys = state.journeys.map((item) =>
        ["checkout", "payment"].includes(item.id)
          ? {
              ...item,
              health: "healthy",
              success: item.id === "payment" ? "99.91%" : "99.88%",
              p95: item.id === "payment" ? "105ms" : "82ms",
              freshness: "12s",
            }
          : item,
      );
      state.findings = state.findings.map((item) =>
        item.source === state.change.id ? { ...item, status: "closed" } : item,
      );
      state.reports = state.reports.map((report) =>
        report.id === "RPT-CHG-23841"
          ? { ...report, verification: "passed", openActions: 0 }
          : report,
      );
      audit(
        state,
        "Inspection Agent",
        "verification.passed",
        "all gates passed; FND-8828 closed",
      );
      return state;
    }

    case "SYNTHETIC_RECOVERY_STARTED":
      state.change.synthetic = { state: "recovering", freshness: "recovering" };
      audit(
        state,
        "synthetics-oncall",
        "evidence.recovery.started",
        "cn-south synthetic source",
      );
      return state;

    case "SYNTHETIC_RECOVERED":
      state.change.synthetic = { state: "pass", freshness: "12s" };
      state.change.objectiveRows = state.change.objectiveRows.map(
        (objective) =>
          objective.name === "华南拨测"
            ? {
                ...objective,
                status: "pass",
                current: "OK",
                freshness: "12s",
                evidence: 2,
              }
            : objective,
      );
      {
        const previousBlocked = [...state.agentRuns]
          .reverse()
          .find(
            (run) => run.kind === "verification" && run.status === "blocked",
          );
        const id = nextRunId(state, "VR");
        state.change.verification.status = "running";
        state.agentRuns.push({
          id,
          kind: "verification",
          title: "变更后健康复验 · retry",
          status: "running",
          progress: 24,
          currentStep: "collecting recovered synthetic evidence",
          elapsed: "0m 11s",
          retryOf: previousBlocked?.id ?? null,
        });
      }
      audit(
        state,
        "synthetics-oncall",
        "evidence.recovered",
        "awaiting verification gate evaluation",
      );
      return state;

    case "PLAN_GATE_RESOLVED":
      state.inspectionPlan.gates[action.gate] = {
        status: "ready",
        detail:
          action.gate === "permission"
            ? "cn-south synthetic read granted"
            : "5/5 comparable runs",
      };
      audit(
        state,
        "平台工程师",
        `plan.gate.${action.gate}.resolved`,
        state.inspectionPlan.id,
      );
      return state;

    case "PLAN_REPLAY_COMPLETED":
      state.inspectionPlan.replay = {
        status: "completed",
        triggers: 6,
        matchedIncidents: 2,
        noise: 4,
      };
      audit(
        state,
        "Inspection Agent",
        "plan.replay.completed",
        "7d · 6 triggers",
      );
      return state;

    case "PLAN_APPROVED":
      state.inspectionPlan.approval = "approved";
      audit(state, "SRE 负责人", "plan.approved", "Draft v2");
      return state;

    case "PLAN_PUBLISH": {
      const blockers = getPlanPublishBlockers(state);
      if (blockers.length > 0) {
        audit(
          state,
          "Inspection Agent",
          "plan.publish.rejected",
          blockers.join(", "),
        );
        return state;
      }
      state.inspectionPlan.status = "published";
      state.inspectionPlan.version = "Published v2";
      state.agentRuns.push({
        id: nextRunId(state, "RUN"),
        kind: "inspection",
        title: "PLAN-312 首次运行",
        status: "running",
        progress: 8,
        currentStep: "resolving scope and data sources",
        elapsed: "0m 05s",
      });
      audit(state, "平台工程师", "plan.published", "Published v2");
      return state;
    }

    case "INVESTIGATION_EVIDENCE_PINNED": {
      if (state.investigation.evidence.includes(action.evidenceId))
        return state;
      state.investigation.evidence.push(action.evidenceId);
      state.investigation.observations.push({
        id: `OBS-${state.investigation.observations.length + 1}`,
        source: action.lens,
        statement:
          action.lens === "logs"
            ? "20:04–20:12 canary 的 acquire timeout 仅出现在 v3.18.0"
            : `${action.lens} 证据已钉入当前调查`,
        evidenceId: action.evidenceId,
      });
      state.timeline.push({
        at: "20:20",
        kind: "evidence",
        title: `${action.lens} 证据钉入 ${state.investigation.id}`,
        detail: action.evidenceId,
      });
      state.investigation.revision += 1;
      audit(
        state,
        "payments-oncall",
        "investigation.evidence.pinned",
        action.evidenceId,
      );
      return state;
    }

    case "HYPOTHESIS_TEST_RUN": {
      const hypothesis = state.investigation.hypotheses.find(
        (item) => item.id === action.hypothesisId,
      );
      if (!hypothesis) return state;
      hypothesis.tested = true;
      hypothesis.confidence =
        action.hypothesisId === "H1"
          ? 0.94
          : Math.min(0.95, hypothesis.confidence + 0.08);
      state.investigation.observations.push({
        id: `OBS-${state.investigation.observations.length + 1}`,
        source: "metrics",
        statement: "canary DB pool wait 78% vs control 14%，与版本相关",
        evidenceId: "METRIC-POOL-614",
      });
      audit(
        state,
        "Diagnosis Agent",
        "hypothesis.test.completed",
        hypothesis.nextTest,
      );
      return state;
    }

    case "HYPOTHESIS_CONFIRMED": {
      const hypothesis = state.investigation.hypotheses.find(
        (item) => item.id === action.hypothesisId,
      );
      if (!hypothesis?.tested) {
        audit(
          state,
          "Diagnosis Agent",
          "hypothesis.confirm.rejected",
          "next test not completed",
        );
        return state;
      }
      state.investigation.status = "concluded";
      hypothesis.status = "confirmed";
      hypothesis.confidence = 0.97;
      state.investigation.actionProposal = {
        action: "rollback v3.18.0",
        runbook: "payments-router-rollback-v3",
        approval: "L2 + oncall",
        status: "proposed",
      };
      audit(state, "payments-oncall", "hypothesis.confirmed", hypothesis.id);
      return state;
    }

    case "INVESTIGATION_CONCLUDE_INCONCLUSIVE":
      state.investigation.status = "inconclusive";
      state.followUpChecks.push({
        id: `CK-DRAFT-${state.followUpChecks.length + 1}`,
        name: "观察 DB pool wait 与 acquire timeout 的版本差异",
        status: "draft",
        sourceInvestigation: state.investigation.id,
      });
      audit(
        state,
        "payments-oncall",
        "investigation.inconclusive",
        "follow-up inspection draft created",
      );
      return state;

    case "REPORT_VERIFICATION_REQUESTED":
      state.reports = state.reports.map((report) =>
        report.id === action.reportId
          ? { ...report, verification: "requested" }
          : report,
      );
      audit(
        state,
        "payments-owner",
        "report.verification.requested",
        action.reportId,
      );
      return state;

    case "GOVERNANCE_GAP_ASSIGNED":
      state.governance.coverageMatrix = state.governance.coverageMatrix.map(
        (row) =>
          row.service === action.service
            ? { ...row, owner: action.owner, assignment: "in_progress" }
            : row,
      );
      audit(
        state,
        "平台负责人",
        "coverage.gap.assigned",
        `${action.service} → ${action.owner}`,
      );
      return state;

    default:
      return state;
  }
}
