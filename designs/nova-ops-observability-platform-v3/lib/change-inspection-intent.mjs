const serviceVersionPattern =
  /(?:^|\s)([a-z][a-z0-9._-]{2,})\s+(v?\d+(?:\.\d+){1,3})(?=\s|$|[，。？?])/i;

export function parseInspectionIntent(text) {
  const normalized = text?.trim() ?? "";
  const match = normalized.match(serviceVersionPattern);
  if (!match) {
    return { complete: false, service: null, text: normalized, version: null };
  }
  return {
    complete: true,
    service: match[1],
    text: normalized,
    version: match[2].toLowerCase().startsWith("v") ? match[2] : `v${match[2]}`,
  };
}

export function applyInspectionIntent(state, text, executionId, createChecks) {
  const intent = parseInspectionIntent(text);
  if (!intent.text) return state;

  if (!intent.complete) {
    return {
      ...state,
      service: "待识别服务",
      version: "待识别版本",
      plan: {
        ...state.plan,
        status: "clarification",
        intent: intent.text,
        checks: [],
      },
      decision: {
        status: "waiting",
        label: "需要补充信息",
        title: "还缺少服务名或版本号",
        summary: "请按“服务名 + 版本号”补充，例如 inventory-service v2.4。",
      },
      conversation: [
        ...state.conversation,
        { role: "user", text: intent.text },
        {
          role: "assistant",
          text: "我还不能生成方案，请补充明确的服务名和版本号。",
        },
      ],
    };
  }

  const caseId = createInspectionCaseId("MANUAL", executionId);
  if (!caseId) return state;
  return {
    ...state,
    id: caseId,
    service: intent.service,
    version: intent.version,
    plan: {
      ...state.plan,
      status: "ready",
      version: state.plan.version + 1,
      intent: intent.text,
      checks: createChecks(intent.service),
    },
    decision: {
      status: "ready",
      label: "方案待确认",
      title: "已生成覆盖 5 个风险面的巡检方案",
      summary: "范围、阈值、基线和频率已就绪，确认后执行变更前巡检。",
    },
    conversation: [
      ...state.conversation,
      { role: "user", text: intent.text },
      {
        role: "assistant",
        text: `已识别 ${intent.service} ${intent.version}，并生成 5 个检查项。请在左侧确认方案。`,
      },
    ],
  };
}
import { createInspectionCaseId } from "./change-inspection-identifiers.mjs";
