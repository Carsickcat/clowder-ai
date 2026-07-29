import { useState } from "react";

const EXAMPLE = "请帮我巡检 payments-router v3.18.0 是否可以灰度发布";

export function ClawPanel({ state, dispatch }) {
  const [text, setText] = useState(EXAMPLE);

  function submit(event) {
    event.preventDefault();
    if (!text.trim()) return;
    dispatch({ type: "INTENT_SUBMITTED", text });
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

      {state.plan.status === "ready" && (
        <div className="ci-claw-insight">
          <span className="ci-eyebrow">Claw 已完成</span>
          <ul>
            <li>识别服务与版本</li>
            <li>匹配已接入的 5 类指标</li>
            <li>建立变更前可比基线</li>
          </ul>
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
            placeholder="例如：请帮我检查支付服务是否可以灰度"
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
          <span>执行开始后不能改写本次 Case 的巡检方案。</span>
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
            setText(EXAMPLE);
          }}
          type="button"
        >
          重新开始
        </button>
      </details>
    </aside>
  );
}
