import { compileInspectionPlan } from "./change-inspection-intelligence.mjs";
import { createInspectionCaseId } from "./change-inspection-identifiers.mjs";

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

export function applyInspectionIntent(state, text, executionId) {
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
        generation: { sources: [], confidence: 0, omissions: [] },
        orchestration: [],
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
  const compiledPlan = compileInspectionPlan(intent);
  const blocked = compiledPlan.status === "blocked";
  return {
    ...state,
    id: caseId,
    service: intent.service,
    version: intent.version,
    plan: {
      ...state.plan,
      ...compiledPlan,
      version: state.plan.version + 1,
      intent: intent.text,
    },
    decision: {
      status: blocked ? "unknown" : "ready",
      label: blocked ? "生成受阻" : "方案待确认",
      title: blocked
        ? "知识来源不完整，尚不能生成可信巡检方案"
        : "已融合自然语义、变更指导书与业务知识图谱",
      summary: blocked
        ? "请先关联变更指导书并补齐业务知识图谱节点；NOVA 不会用通用检查项冒充业务方案。"
        : "每个检查项都保留生成理由、置信度和来源引用，确认后执行变更前巡检。",
    },
    conversation: [
      ...state.conversation,
      { role: "user", text: intent.text },
      {
        role: "assistant",
        text: blocked
          ? `已识别 ${intent.service} ${intent.version}，但缺少指导书与知识图谱映射，已阻止生成。`
          : `已识别 ${intent.service} ${intent.version}，并融合 3 类来源生成 ${compiledPlan.checks.length} 个可解释检查项。请在中间核对方案。`,
      },
    ],
  };
}
