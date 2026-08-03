import { useState } from "react";

import { createInspectionExecutionId } from "../../lib/change-inspection-identifiers.mjs";

const EXAMPLE = "请帮我巡检 payments-router v3.18.0 是否可以灰度发布";

const workflowSteps = [
  ["natural_language", "自然语义", "解析服务、版本与发布目标"],
  ["change_guide", "变更指导书", "定位门禁、处置与回退章节"],
  ["knowledge_graph", "业务知识图谱", "展开上下游依赖与业务指标"],
];

function GenerationWorkflow({ state }) {
  const sourceKinds = new Set(
    state.plan.generation?.sources.map((source) => source.kind) ?? [],
  );
  const started = state.plan.status !== "empty";

  return (
    <section className="ci-generation-workflow">
      <div>
        <span className="ci-eyebrow">生成工作流</span>
        <strong>{started ? "CLAW 正在编排巡检任务" : "等待巡检意图"}</strong>
      </div>
      <ol>
        {workflowSteps.map(([kind, label, description]) => {
          const completed = sourceKinds.has(kind);
          const blocked =
            started && !completed && state.plan.status === "blocked";
          return (
            <li
              className={blocked ? "is-blocked" : completed ? "is-done" : ""}
              key={kind}
            >
              <span>{blocked ? "!" : completed ? "✓" : "·"}</span>
              <div>
                <strong>{label}</strong>
                <small>{blocked ? "未找到可信映射" : description}</small>
              </div>
            </li>
          );
        })}
        <li className={state.plan.status === "ready" ? "is-done" : ""}>
          <span>{state.plan.status === "ready" ? "✓" : "·"}</span>
          <div>
            <strong>可解释方案</strong>
            <small>生成检查项、依赖顺序、理由与置信度</small>
          </div>
        </li>
        <li className={state.reportSnapshot ? "is-done" : ""}>
          <span>{state.reportSnapshot ? "✓" : "·"}</span>
          <div>
            <strong>报告评分解读</strong>
            <small>执行完成后形成五维评分与剩余风险</small>
          </div>
        </li>
      </ol>
    </section>
  );
}

export function ClawPanel({ state, dispatch }) {
  const [text, setText] = useState("");

  function submit(event) {
    event.preventDefault();
    if (!text.trim()) return;
    dispatch({
      type: "INTENT_SUBMITTED",
      executionId: createInspectionExecutionId(),
      text,
    });
    setText("");
  }

  return (
    <aside className="ci-claw-panel" aria-label="Claw 对话">
      <header>
        <span className="ci-claw-avatar" aria-hidden="true">
          ✦
        </span>
        <div>
          <strong>Claw 对话</strong>
          <span>巡检搭档 · 在线</span>
        </div>
      </header>

      <div className="ci-claw-safety">
        <span>i</span>
        我会生成方案和解释证据，但不会代替你执行生产动作。
      </div>

      <GenerationWorkflow state={state} />

      <div className="ci-messages" aria-live="polite">
        {state.conversation.map((message, index) => (
          <div
            className={`ci-message ci-message-${message.role}`}
            key={`${message.role}-${index}`}
          >
            {message.role === "assistant" && (
              <span className="ci-message-avatar">C</span>
            )}
            <p>{message.text}</p>
          </div>
        ))}
      </div>

      {state.plan.status === "ready" &&
        state.comparabilityContract.status === "valid" && (
          <div className="ci-claw-insight">
            <span className="ci-eyebrow">Claw 已完成</span>
            <ul>
              <li>识别服务与版本</li>
              <li>匹配已接入的 5 类指标</li>
              <li>建立变更前可比基线</li>
            </ul>
          </div>
        )}

      {(state.plan.status === "clarification" ||
        state.plan.status === "blocked" ||
        state.comparabilityContract.status !== "valid") && (
        <div className="ci-claw-blocker">
          <span className="ci-eyebrow">Claw 需要补充</span>
          <p>
            {state.plan.status === "clarification"
              ? "缺少明确的服务名或版本号，暂不能生成巡检方案。"
              : state.plan.status === "blocked"
                ? "缺少变更指导书或业务知识图谱映射，CLAW 已停止生成，避免编造业务检查项。"
                : "当前基线不可比，补充对照组后才能完成方案校验。"}
          </p>
        </div>
      )}

      {state.reportSnapshot && (
        <button
          className="ci-explain-button"
          data-domain-action="REPORT_EXPLANATION_REQUESTED"
          onClick={() => dispatch({ type: "REPORT_EXPLANATION_REQUESTED" })}
          type="button"
        >
          请 Claw 解读最终报告
        </button>
      )}

      {state.stage === "draft" ? (
        <form onSubmit={submit}>
          <label htmlFor="claw-input">描述巡检需求</label>
          <textarea
            id="claw-input"
            onChange={(event) => setText(event.target.value)}
            placeholder={EXAMPLE}
            rows="4"
            value={text}
          />
          <button
            data-domain-action="INTENT_SUBMITTED"
            disabled={!text.trim()}
            type="submit"
          >
            生成巡检方案
            <span aria-hidden="true">↗</span>
          </button>
        </form>
      ) : (
        <div className="ci-plan-locked">
          <strong>方案已锁定</strong>
          <span>执行开始后不能改写本次巡检的方案。</span>
        </div>
      )}

      <details className="ci-demo-controls">
        <summary>演示非快乐路径</summary>
        {state.stage === "draft" && (
          <button
            data-domain-action="COMPARABILITY_INVALIDATED"
            onClick={() => dispatch({ type: "COMPARABILITY_INVALIDATED" })}
            type="button"
          >
            模拟基线不可比
          </button>
        )}
        <button
          data-domain-action="CASE_RESET"
          onClick={() => {
            dispatch({ type: "CASE_RESET" });
            setText("");
          }}
          type="button"
        >
          重新开始
        </button>
      </details>
    </aside>
  );
}
