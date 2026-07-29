const draftOnly = new Set([
  "INTENT_SUBMITTED",
  "COMPARABILITY_INVALIDATED",
  "PLAN_CONFIRMED",
]);

export const inspectionActionPolicy = {
  allows(state, type) {
    if (draftOnly.has(type)) return state.stage === "draft";
    if (type === "EVIDENCE_BECAME_STALE") return state.stage === "canary";
    if (type === "REPORT_EXPLANATION_REQUESTED") {
      return state.stage === "completed";
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
          text: "结论为通过。25% 灰度曾出现延迟风险，但风险已完成复验；全量与变更后指标均在阈值内。",
        },
      ],
    };
  },
};
