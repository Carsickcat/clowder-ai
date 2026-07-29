import { getPrimaryAction } from "../../lib/change-inspection.mjs";

const statusClass = {
  waiting: "neutral",
  ready: "ready",
  working: "ready",
  passed: "passed",
  risk: "risk",
  unknown: "unknown",
};

function PlanView({ state }) {
  if (state.plan.status === "empty") {
    return (
      <div className="ci-empty-state">
        <span className="ci-empty-icon">✦</span>
        <h3>从一句话开始</h3>
        <p>
          在右侧告诉 Claw
          你要变更哪个服务。它会生成检查项、基线、阈值和执行频率，先给你审阅。
        </p>
      </div>
    );
  }

  return (
    <section className="ci-plan" data-testid="inspection-plan">
      <div className="ci-section-heading">
        <div>
          <span className="ci-eyebrow">巡检方案 v{state.plan.version}</span>
          <h3>系统准备检查什么</h3>
        </div>
        <span className="ci-coverage">5/5 风险面已覆盖</span>
      </div>
      <div className="ci-plan-meta">
        <div>
          <span>执行频率</span>
          <strong>{state.plan.frequency}</strong>
        </div>
        <div>
          <span>观察窗口</span>
          <strong>{state.plan.window}</strong>
        </div>
        <div>
          <span>比较基线</span>
          <strong>{state.plan.baseline}</strong>
        </div>
      </div>
      <div className="ci-comparability">
        <span
          className={`ci-signal ci-signal-${state.comparabilityContract.status}`}
        />
        <div>
          <strong>{state.comparabilityContract.label}</strong>
          <p>{state.comparabilityContract.detail}</p>
        </div>
      </div>
      <div className="ci-check-list">
        {state.plan.checks.map((check) => (
          <div className="ci-check" key={check.id}>
            <span className="ci-check-mark">✓</span>
            <div>
              <strong>{check.name}</strong>
              <code>{check.metric}</code>
            </div>
            <small>{check.rule}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function LatestEvidence({ state }) {
  const run = state.runs.at(-1);
  if (!run) return null;

  return (
    <section className="ci-evidence" data-testid="latest-run">
      <div className="ci-section-heading">
        <div>
          <span className="ci-eyebrow">{run.phase}</span>
          <h3>{run.label}</h3>
        </div>
        <span className={`ci-run-result ci-run-${run.result}`}>
          {run.result === "risk" ? "发现风险" : "检查通过"}
        </span>
      </div>
      <p className="ci-comparison">{run.comparison}</p>
      <div className="ci-metrics">
        {run.metrics.map((metric) => (
          <div
            className={`ci-metric ci-metric-${metric.status}`}
            key={metric.name}
          >
            <span>{metric.name}</span>
            <strong>{metric.value}</strong>
            <small>{metric.delta}</small>
          </div>
        ))}
      </div>
      <div className={`ci-run-summary ci-run-summary-${run.result}`}>
        <span>{run.result === "risk" ? "!" : "✓"}</span>
        <p>{run.summary}</p>
      </div>
      {state.decision.status === "risk" && (
        <div className="ci-finding">
          <div>
            <span className="ci-eyebrow">风险定位</span>
            <strong>连接池在 canary 实例出现排队</strong>
          </div>
          <p>
            建议把连接池上限从 80 调整到 120，保持 25% 流量并生成新的复验 Run。
          </p>
        </div>
      )}
    </section>
  );
}

function FinalReport({ state }) {
  if (!state.reportSnapshot) return null;
  return (
    <section className="ci-final-report" data-testid="final-report">
      <span className="ci-report-icon">✓</span>
      <div>
        <span className="ci-eyebrow">最终报告 · {state.reportSnapshot.id}</span>
        <h3>{state.reportSnapshot.title}</h3>
        <p>{state.reportSnapshot.summary}</p>
      </div>
    </section>
  );
}

export function DecisionSurface({ state, onAction }) {
  const action = getPrimaryAction(state);
  const tone = statusClass[state.decision.status] ?? "neutral";

  return (
    <article className="ci-decision-surface">
      <header className="ci-decision-header">
        <div>
          <span className="ci-eyebrow">当前任务</span>
          <p>{state.plan.intent || "创建一份变更巡检方案"}</p>
        </div>
        <span
          className={`ci-status ci-status-${tone} status-${state.decision.status}`}
        >
          {state.decision.label}
        </span>
      </header>

      <section className={`ci-current-decision ci-current-${tone}`}>
        <span className="ci-eyebrow">当前结论</span>
        <h2>{state.decision.title}</h2>
        <p>{state.decision.summary}</p>
      </section>

      {state.runs.length === 0 ? (
        <PlanView state={state} />
      ) : (
        <LatestEvidence state={state} />
      )}
      <FinalReport state={state} />

      <footer className="ci-next-action">
        <div>
          <span className="ci-eyebrow">下一步</span>
          <p>{action.reason ?? "此动作会写入本次变更的决策记录。"}</p>
        </div>
        <button
          className="ci-primary-button"
          data-domain-action={action.type}
          data-ui-role="primary-action"
          disabled={action.disabled}
          onClick={() => onAction(action.type)}
          type="button"
        >
          {action.label}
          <span aria-hidden="true">→</span>
        </button>
      </footer>
    </article>
  );
}
