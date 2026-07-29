const draftOnly = new Set([
  "INTENT_SUBMITTED",
  "COMPARABILITY_INVALIDATED",
  "COMPARABILITY_RESTORED",
  "PLAN_CONFIRMED",
]);

export const inspectionActionPolicy = {
  allows(state, type) {
    if (draftOnly.has(type)) return state.stage === "draft";
    if (type === "EVIDENCE_BECAME_STALE") return state.stage === "canary";
    if (type === "EVIDENCE_REFRESHED") {
      return state.stage === "canary" && state.evidenceFreshness === "stale";
    }
    if (type === "REPORT_EXPLANATION_REQUESTED") {
      return state.stage === "completed" && Boolean(state.reportSnapshot);
    }
    return true;
  },

  explain(state) {
    return {
      ...state,
      conversation: [
        ...state.conversation,
        { role: "user", text: "请解读本次巡检报告" },
        {
          role: "assistant",
          text: state.reportSnapshot.explanation,
        },
      ],
    };
  },
};

export function getPrimaryAction(state) {
  if (state.comparabilityContract.status !== "valid") {
    return {
      type: "COMPARABILITY_RESTORED",
      label: "补充可比基线并重新判定",
      reason: "基线不可比，不能执行准入判定",
    };
  }
  if (state.evidenceFreshness !== "fresh") {
    return {
      type: "EVIDENCE_REFRESHED",
      label: "刷新指标窗口",
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
  if (state.plan.status !== "ready") {
    return {
      type: "INTENT_SUBMITTED",
      label: "请先在 Claw 中补充服务名和版本",
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
    return { type: "REMEDIATION_RECORDED", label: "记录处置" };
  }
  if (state.stage === "canary" && state.decision.status === "working") {
    return { type: "VERIFICATION_RAN", label: "执行复验" };
  }
  if (state.stage === "canary") {
    return { type: "CANARY_ADVANCED", label: "继续到 100% 放量" };
  }
  if (state.stage === "post-change") {
    return { type: "POST_CHANGE_RAN", label: "执行变更后验收" };
  }
  return { type: "REPORT_OPENED", label: "查看最终报告" };
}
