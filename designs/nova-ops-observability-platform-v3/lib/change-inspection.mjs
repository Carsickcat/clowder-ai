import {
  inspectionChecks,
  runFixtures,
} from "./change-inspection-fixtures.mjs";
import { inspectionActionPolicy } from "./change-inspection-actions.mjs";

export const journeyStages = [
  { id: "pre-change", label: "变更前准入", hint: "确认是否具备灰度条件" },
  { id: "canary", label: "灰度持续验证", hint: "逐阶段比较 canary 与 stable" },
  { id: "post-change", label: "变更后验收", hint: "对比基线并形成最终结论" },
];

export function createChangeInspectionState() {
  return {
    kind: "ChangeInspectionCase",
    id: "CIC-2026-0718",
    service: "payments-router",
    version: "v3.18.0",
    environment: "生产环境",
    changeId: "CHG-23841",
    stage: "draft",
    canary: { percent: 0, strategy: "25% → 100%" },
    plan: {
      status: "empty",
      version: 0,
      intent: "",
      checks: [],
      frequency: "每 2 分钟",
      window: "连续 10 分钟",
      baseline: "过去 7 天同星期、同时段",
    },
    comparabilityContract: {
      status: "valid",
      label: "基线可比",
      detail: "流量结构、地区和依赖版本一致",
    },
    evidenceFreshness: "fresh",
    baselineSnapshot: null,
    runs: [],
    findings: [],
    decisions: [],
    reportSnapshot: null,
    decision: {
      status: "waiting",
      label: "等待请求",
      title: "请先描述这次变更要检查什么",
      summary: "Claw 会生成方案草案；执行前仍需你确认。",
    },
    conversation: [
      {
        role: "assistant",
        text: "告诉我服务、版本和你担心的风险，我会先生成一份可审阅的巡检方案。",
      },
    ],
  };
}

function nextRun(state, run) {
  return {
    kind: "InspectionRun",
    id: `RUN-${String(state.runs.length + 1).padStart(3, "0")}`,
    ...run,
  };
}

function appendConversation(state, ...messages) {
  return [...state.conversation, ...messages];
}

function blockForComparability(state) {
  return {
    ...state,
    decision: {
      status: "unknown",
      label: "不可判定",
      title: "基线不可比，不能执行准入判定",
      summary: "请补充对照组或确认预期变化，再重新执行。",
    },
  };
}

function blockForFreshness(state) {
  return {
    ...state,
    decision: {
      status: "unknown",
      label: "不可判定",
      title: "证据已过期，不能继续放量",
      summary: "请刷新指标窗口，产生新的验证 Run。",
    },
  };
}

export function changeInspectionReducer(state, action) {
  if (!inspectionActionPolicy.allows(state, action.type)) return state;
  switch (action.type) {
    case "CASE_RESET":
      return createChangeInspectionState();
    case "REPORT_EXPLANATION_REQUESTED":
      return inspectionActionPolicy.explain(state);
    case "INTENT_SUBMITTED": {
      const text = action.text?.trim();
      if (!text) return state;
      return {
        ...state,
        plan: {
          ...state.plan,
          status: "ready",
          version: 1,
          intent: text,
          checks: inspectionChecks,
        },
        decision: {
          status: "ready",
          label: "方案待确认",
          title: "已生成覆盖 5 个风险面的巡检方案",
          summary: "范围、阈值、基线和频率已就绪，确认后执行变更前巡检。",
        },
        conversation: appendConversation(
          state,
          { role: "user", text },
          {
            role: "assistant",
            text: "已识别 payments-router v3.18.0，并生成 5 个检查项。请在左侧确认方案。",
          },
        ),
      };
    }

    case "COMPARABILITY_INVALIDATED":
      return blockForComparability({
        ...state,
        comparabilityContract: {
          status: "invalid",
          label: "基线不可比",
          detail: "本次版本预期改变流量结构，旧基线不能直接比较",
        },
      });

    case "PLAN_CONFIRMED": {
      if (state.comparabilityContract.status !== "valid") {
        return blockForComparability(state);
      }
      if (state.evidenceFreshness !== "fresh") {
        return blockForFreshness(state);
      }
      if (state.plan.status !== "ready") return state;
      const run = nextRun(state, runFixtures.admission);
      return {
        ...state,
        stage: "pre-change",
        runs: [...state.runs, run],
        baselineSnapshot: {
          kind: "BaselineSnapshot",
          runId: run.id,
          capturedAt: run.time,
          contract: state.comparabilityContract.detail,
        },
        decision: {
          status: "passed",
          label: "准入通过",
          title: "可以进入 25% 灰度",
          summary: "关键指标稳定，当前没有阻断风险。",
        },
        decisions: [
          ...state.decisions,
          {
            kind: "DecisionRecord",
            id: "DEC-001",
            result: "准入通过",
            evidenceRunId: run.id,
          },
        ],
      };
    }

    case "CANARY_APPROVED": {
      if (state.stage !== "pre-change" || state.decision.status !== "passed") {
        return state;
      }
      const run = nextRun(state, runFixtures.canaryRisk);
      return {
        ...state,
        stage: "canary",
        canary: { ...state.canary, percent: 25 },
        runs: [...state.runs, run],
        findings: [
          ...state.findings,
          {
            kind: "Finding",
            id: "FND-017",
            severity: "risk",
            title: "支付回调 p95 延迟上升 17.8%",
            runId: run.id,
          },
        ],
        decision: {
          status: "risk",
          label: "发现风险",
          title: "暂停在 25% 灰度",
          summary: "canary 延迟显著高于 stable，建议扩容连接池后重新验证。",
        },
      };
    }

    case "REMEDIATION_RECORDED":
      if (state.stage !== "canary" || state.decision.status !== "risk") {
        return state;
      }
      return {
        ...state,
        decision: {
          status: "working",
          label: "等待验证",
          title: "已记录处置：连接池上限 80 → 120",
          summary: "需要产生新的 Verification Run，历史风险 Run 保持不变。",
        },
        decisions: [
          ...state.decisions,
          {
            kind: "DecisionRecord",
            id: `DEC-${String(state.decisions.length + 1).padStart(3, "0")}`,
            result: "暂停并处置",
            evidenceRunId: state.runs.at(-1)?.id,
          },
        ],
      };

    case "VERIFICATION_RAN": {
      if (state.decision.status !== "working") return state;
      const run = nextRun(state, runFixtures.verification);
      return {
        ...state,
        runs: [...state.runs, run],
        evidenceFreshness: "fresh",
        decision: {
          status: "passed",
          label: "复验通过",
          title: "可以继续到 100% 放量",
          summary: "处置有效，三个关键指标均回到门禁范围内。",
        },
      };
    }

    case "EVIDENCE_BECAME_STALE":
      return blockForFreshness({ ...state, evidenceFreshness: "stale" });

    case "CANARY_ADVANCED": {
      if (state.evidenceFreshness !== "fresh") return blockForFreshness(state);
      if (state.stage !== "canary" || state.decision.status !== "passed") {
        return state;
      }
      const run = nextRun(state, runFixtures.fullTraffic);
      return {
        ...state,
        stage: "post-change",
        canary: { ...state.canary, percent: 100 },
        runs: [...state.runs, run],
        decision: {
          status: "passed",
          label: "全量稳定",
          title: "进入变更后验收",
          summary: "放量已完成，需与变更前基线做最终比较。",
        },
      };
    }

    case "POST_CHANGE_RAN": {
      if (state.stage !== "post-change") return state;
      const run = nextRun(state, runFixtures.acceptance);
      const runs = [...state.runs, run];
      return {
        ...state,
        stage: "completed",
        runs,
        decision: {
          status: "passed",
          label: "验收通过",
          title: "本次变更未发现异常退化",
          summary: "最终报告已生成，包含全部 Run、Finding 和 DecisionRecord。",
        },
        decisions: [
          ...state.decisions,
          {
            kind: "DecisionRecord",
            id: `DEC-${String(state.decisions.length + 1).padStart(3, "0")}`,
            result: "变更验收通过",
            evidenceRunId: run.id,
          },
        ],
        reportSnapshot: {
          kind: "ReportSnapshot",
          id: "RPT-CHG-23841-V1",
          status: "published",
          conclusion: "通过",
          runIds: runs.map((item) => item.id),
        },
      };
    }

    default:
      return state;
  }
}

export function getPrimaryAction(state) {
  if (state.comparabilityContract.status !== "valid") {
    return {
      type: "PLAN_CONFIRMED",
      label: "补充可比基线后重试",
      disabled: true,
      reason: "基线不可比，不能执行准入判定",
    };
  }
  if (state.evidenceFreshness !== "fresh") {
    return {
      type: "CANARY_ADVANCED",
      label: "刷新证据后继续",
      disabled: true,
      reason: "证据已过期，不能继续放量",
    };
  }
  if (state.plan.status === "empty") {
    return {
      type: "INTENT_SUBMITTED",
      label: "先在 Claw 中描述巡检需求",
      disabled: true,
    };
  }
  if (state.stage === "draft") {
    return { type: "PLAN_CONFIRMED", label: "确认方案并执行变更前巡检" };
  }
  if (state.stage === "pre-change") {
    return { type: "CANARY_APPROVED", label: "批准进入 25% 灰度" };
  }
  if (state.stage === "canary" && state.decision.status === "risk") {
    return { type: "REMEDIATION_RECORDED", label: "记录处置并重新验证" };
  }
  if (state.stage === "canary" && state.decision.status === "working") {
    return { type: "VERIFICATION_RAN", label: "执行 Verification Run" };
  }
  if (state.stage === "canary") {
    return { type: "CANARY_ADVANCED", label: "继续到 100% 放量" };
  }
  if (state.stage === "post-change") {
    return { type: "POST_CHANGE_RAN", label: "执行变更后验收" };
  }
  return { type: "REPORT_OPENED", label: "查看最终报告" };
}
