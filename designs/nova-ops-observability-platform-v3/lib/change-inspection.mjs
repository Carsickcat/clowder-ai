import {
  createInspectionChecks,
  createRunFixture,
} from "./change-inspection-fixtures.mjs";
import { deepFreeze } from "./change-inspection-immutability.mjs";
import { createCaseFromJob } from "./change-inspection-jobs.mjs";
import {
  createReportSnapshot,
  nextRecordId,
} from "./change-inspection-records.mjs";
import { inspectionActionPolicy } from "./change-inspection-actions.mjs";
import { applyInspectionIntent } from "./change-inspection-intent.mjs";

export { getPrimaryAction } from "./change-inspection-actions.mjs";

export const journeyStages = [
  { id: "pre-change", label: "变更前准入", hint: "确认是否具备灰度条件" },
  {
    id: "canary",
    label: "灰度持续验证",
    hint: "逐阶段比较灰度版本与稳定版本",
  },
  { id: "post-change", label: "变更后验收", hint: "对比基线并形成最终结论" },
];

export function createChangeInspectionState() {
  return deepFreeze({
    kind: "ChangeInspectionCase",
    id: "CIC-DRAFT",
    sourceJob: null,
    service: "待识别服务",
    version: "待识别版本",
    environment: "生产环境",
    changeId: "CHG-23841",
    stage: "draft",
    canary: { percent: 0, strategy: "25% → 100%" },
    plan: {
      status: "empty",
      version: 0,
      intent: "",
      checks: [],
      generation: { sources: [], confidence: 0, omissions: [] },
      orchestration: [],
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
  });
}

function nextRun(state, run) {
  return {
    kind: "InspectionRun",
    id: nextRecordId(state, "RUN", state.runs),
    service: state.service,
    version: state.version,
    ...run,
  };
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
      summary: "请刷新指标窗口，产生新的复验记录。",
    },
  };
}

function reduceInspectionState(state, action) {
  if (!inspectionActionPolicy.allows(state, action.type)) return state;
  switch (action.type) {
    case "CASE_RESET":
      return createChangeInspectionState();
    case "JOB_SELECTED":
      return (
        createCaseFromJob(
          createChangeInspectionState(),
          action.jobId,
          action.executionId,
          createInspectionChecks,
        ) ?? state
      );
    case "REPORT_EXPLANATION_REQUESTED":
      return inspectionActionPolicy.explain(state);
    case "INTENT_SUBMITTED":
      return applyInspectionIntent(
        state,
        action.text,
        action.executionId,
        createInspectionChecks,
      );

    case "COMPARABILITY_INVALIDATED":
      return blockForComparability({
        ...state,
        comparabilityContract: {
          status: "invalid",
          label: "基线不可比",
          detail: "本次版本预期改变流量结构，旧基线不能直接比较",
        },
      });

    case "COMPARABILITY_RESTORED":
      return {
        ...state,
        comparabilityContract: {
          status: "valid",
          label: "基线可比",
          detail: "已补充相同流量结构、地区和依赖版本的对照组",
        },
        decision: {
          status: state.plan.status === "ready" ? "ready" : "waiting",
          label: "阻断已解除",
          title: "基线可比性已恢复",
          summary:
            state.plan.status === "ready"
              ? "现在可以重新确认方案并执行变更前巡检。"
              : "现在可以描述巡检需求并生成方案。",
        },
      };

    case "PLAN_CONFIRMED": {
      if (state.comparabilityContract.status !== "valid") {
        return blockForComparability(state);
      }
      if (state.evidenceFreshness !== "fresh") {
        return blockForFreshness(state);
      }
      if (state.plan.status !== "ready") return state;
      const run = nextRun(state, createRunFixture(state.service, "admission"));
      return {
        ...state,
        stage: "pre-change",
        runs: [...state.runs, run],
        baselineSnapshot: {
          kind: "BaselineSnapshot",
          service: state.service,
          version: state.version,
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
            id: nextRecordId(state, "DEC", state.decisions),
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
      const run = nextRun(state, createRunFixture(state.service, "canaryRisk"));
      return {
        ...state,
        stage: "canary",
        canary: { ...state.canary, percent: 25 },
        runs: [...state.runs, run],
        findings: [
          ...state.findings,
          {
            kind: "Finding",
            id: nextRecordId(state, "FND", state.findings),
            service: state.service,
            version: state.version,
            severity: "risk",
            title: `${state.service} p95 延迟上升 17.8%`,
            runId: run.id,
          },
        ],
        decision: {
          status: "risk",
          label: "发现风险",
          title: "暂停在 25% 灰度",
          summary: "灰度版本延迟显著高于稳定版本，建议扩容连接池后重新验证。",
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
          summary: "需要产生新的复验记录，历史风险记录保持不变。",
        },
        decisions: [
          ...state.decisions,
          {
            kind: "DecisionRecord",
            id: nextRecordId(state, "DEC", state.decisions),
            result: "暂停并处置",
            evidenceRunId: state.runs.at(-1)?.id,
          },
        ],
      };

    case "VERIFICATION_RAN": {
      if (state.decision.status !== "working") return state;
      const run = nextRun(
        state,
        createRunFixture(state.service, "verification"),
      );
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

    case "EVIDENCE_REFRESHED":
      return {
        ...state,
        evidenceFreshness: "fresh",
        decision: {
          status: "working",
          label: "等待验证",
          title: "指标窗口已刷新",
          summary: "需要产生新的复验记录，旧执行证据保持不变。",
        },
      };

    case "CANARY_ADVANCED": {
      if (state.evidenceFreshness !== "fresh") return blockForFreshness(state);
      if (state.stage !== "canary" || state.decision.status !== "passed") {
        return state;
      }
      const run = nextRun(
        state,
        createRunFixture(state.service, "fullTraffic"),
      );
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
      const run = nextRun(state, createRunFixture(state.service, "acceptance"));
      const runs = [...state.runs, run];
      const decisions = [
        ...state.decisions,
        {
          kind: "DecisionRecord",
          id: nextRecordId(state, "DEC", state.decisions),
          result: "变更验收通过",
          evidenceRunId: run.id,
        },
      ];
      return {
        ...state,
        stage: "completed",
        runs,
        decision: {
          status: "passed",
          label: "验收通过",
          title: "本次变更未发现异常退化",
          summary: "最终报告已生成，包含全部巡检、风险和决策记录。",
        },
        decisions,
        reportSnapshot: createReportSnapshot(state, runs, decisions),
      };
    }

    default:
      return state;
  }
}

export function changeInspectionReducer(state, action) {
  return deepFreeze(reduceInspectionState(state, action));
}
