import { deepFreeze, reconcileChange } from "./domain.mjs";
import { getScenario } from "./scenarios.mjs";

export const inspectionExamples = deepFreeze([
  {
    id: "order-upgrade",
    label: "服务升级示例",
    prompt:
      "今晚升级 order-api v4.8.0，帮我确认订单提交和支付链路有没有问题。",
    targetService: "order-api",
    contextReference: "",
  },
  {
    id: "payment-config",
    label: "配置变更示例",
    prompt: "调整 payment-api Redis 超时，帮我生成巡检计划。",
    targetService: "payment-api",
    contextReference: "CHG-84217",
  },
]);

function cloneFixture(id) {
  return structuredClone(getScenario(id));
}

function replaceStrings(value, replacements) {
  if (typeof value === "string") {
    return replacements.reduce(
      (result, [from, to]) => result.replaceAll(from, to),
      value,
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceStrings(item, replacements));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceStrings(item, replacements),
      ]),
    );
  }
  return value;
}

function extractService(prompt) {
  return (
    prompt.match(/\b[a-z][a-z0-9-]*(?:-api|-service|-worker|-gateway)\b/i)?.[0] ??
    prompt.match(/\b[a-z][a-z0-9]+-[a-z0-9-]+\b/i)?.[0] ??
    "target-service"
  );
}

function extractVersion(prompt) {
  return prompt.match(/\bv\d+(?:\.\d+)+\b/i)?.[0] ?? "待确认版本";
}

function normalizeRequest(request) {
  const prompt = request?.prompt?.trim() ?? "";
  if (!prompt) throw new Error("Inspection intent is required");
  return {
    prompt,
    targetService:
      request?.targetService?.trim() || extractService(prompt),
    contextReference: request?.contextReference?.trim() ?? "",
  };
}

function compileGenericWorkspace(request) {
  const service = request.targetService;
  const version = extractVersion(request.prompt);
  const metricPrefix = service.replaceAll("-", ".");
  const replacements = [
    ["payment.confirm.success_rate", `${metricPrefix}.downstream_success_rate`],
    ["order.submit.success_rate", `${metricPrefix}.success_rate`],
    ["payment-gateway", `${service}-downstream`],
    ["order-cache", `${service}-cache`],
    ["order-api", service],
    ["支付依赖", "关键下游依赖"],
    ["支付确认", "关键下游"],
    ["订单提交", "核心业务目标"],
    ["订单", "业务"],
  ];
  const workspace = replaceStrings(
    cloneFixture("natural-language-pass"),
    replacements,
  );

  workspace.id = `workspace-${service}`;
  workspace.entryKind = request.contextReference
    ? "combined-context"
    : "user-intent";
  workspace.eyebrow = "User-defined inspection workspace";
  workspace.title = `${service} 巡检工作区`;
  workspace.subtitle = "由用户目标与可选运行上下文动态编译，不受示例场景限制";
  workspace.prompt = request.prompt;
  workspace.declaredChange = {
    id: request.contextReference || `USER-${service.toUpperCase()}`,
    summary: `${service} ${version} 用户声明变更`,
    version,
    entities: [service, `${service}-downstream`, `${service}-cache`],
    fingerprint: `mock:${service}@${version}`,
  };
  workspace.observedChange = {
    summary: "Mock 运行时事实与当前声明范围一致",
    entities: [...workspace.declaredChange.entities],
    fingerprint: workspace.declaredChange.fingerprint,
  };
  workspace.impactDimensions = {
    businessJourney: [`${service} 核心业务目标`],
    goldenMetrics: [
      `${metricPrefix}.success_rate`,
      `${metricPrefix}.downstream_success_rate`,
    ],
    traceDependencies: [`${service} → ${service}-downstream`],
    middleware: [`${service}-cache · Mock runtime catalog`],
  };
  workspace.contextSources[0] = {
    id: "nl-intent",
    kind: "用户意图",
    label: "当前巡检目标",
    detail: request.prompt,
    freshness: "刚刚",
  };
  if (request.contextReference) {
    workspace.contextSources.splice(1, 0, {
      id: "attached-context",
      kind: "可选上下文",
      label: request.contextReference,
      detail: "用户选择附加电子流 / 发布单作为事实补全来源",
      freshness: "刚刚",
    });
  }
  workspace.reconciliation = reconcileChange(
    workspace.declaredChange,
    workspace.observedChange,
  );
  return workspace;
}

function compileKnownWorkspace(request) {
  const isPaymentRisk =
    request.contextReference === "CHG-84217" ||
    (/payment-api/i.test(request.prompt) && /redis|超时/i.test(request.prompt));
  if (isPaymentRisk) {
    const workspace = cloneFixture("change-ticket-risk");
    workspace.prompt = request.prompt;
    workspace.eyebrow = "User-defined inspection workspace";
    workspace.title = `${request.targetService} 巡检工作区`;
    workspace.subtitle = "用户目标与运行时对账共同编译的高风险验证工作区";
    workspace.entryKind = request.contextReference
      ? "combined-context"
      : "user-intent";
    if (request.contextReference) {
      workspace.declaredChange.id = request.contextReference;
      workspace.contextSources[0].label = request.contextReference;
    }
    return workspace;
  }
  if (/order-api/i.test(request.prompt)) {
    const workspace = cloneFixture("natural-language-pass");
    workspace.prompt = request.prompt;
    workspace.eyebrow = "User-defined inspection workspace";
    workspace.title = `${request.targetService} 巡检工作区`;
    workspace.subtitle = "用户目标动态编译的服务升级验证工作区";
    workspace.entryKind = request.contextReference
      ? "combined-context"
      : "user-intent";
    return workspace;
  }
  return null;
}

export function compileInspectionRequest(input) {
  const request = normalizeRequest(input);
  const workspace = compileKnownWorkspace(request) ?? compileGenericWorkspace(request);
  workspace.request = request;
  workspace.reconciliation = reconcileChange(
    workspace.declaredChange,
    workspace.observedChange,
  );
  return deepFreeze(workspace);
}
