import { projectExecutionSteps } from "../../lib/change-inspection-intelligence.mjs";
import { RunTimeline } from "./RunTimeline";

const statusLabel = {
  queued: "待执行",
  ready: "可执行",
  passed: "已通过",
  risk: "有风险",
  resolved: "已解决",
};

export function ExecutionPlanBoard({ state, onReportOpen }) {
  const steps = projectExecutionSteps(state);

  return (
    <section className="ci-execution-board" aria-label="巡检执行计划">
      <header className="ci-section-heading">
        <div>
          <span className="ci-eyebrow">Execution plan</span>
          <h2>巡检任务执行计划</h2>
        </div>
        <span className="ci-object-count">
          {
            steps.filter((step) => ["passed", "resolved"].includes(step.status))
              .length
          }
          /{steps.length || 0} 步已闭环
        </span>
      </header>

      {steps.length === 0 ? (
        <div className="ci-timeline-empty">
          生成可信方案后，这里会列出每一步执行计划、依赖关系与证据状态。
        </div>
      ) : (
        <ol className="ci-execution-steps">
          {steps.map((step, index) => (
            <li className={`ci-execution-step is-${step.status}`} key={step.id}>
              <span className="ci-step-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="ci-step-main">
                <span>{step.phase}</span>
                <strong>{step.label}</strong>
              </div>
              <div className="ci-step-dependencies">
                <span>依赖</span>
                <strong>
                  {step.dependencyIds.length
                    ? step.dependencyIds.join(" · ")
                    : "无"}
                </strong>
              </div>
              <div className="ci-step-evidence">
                <span>证据</span>
                <strong>
                  {step.evidenceRefs.length
                    ? `${step.evidenceRefs.length} 条已固化`
                    : step.evidenceKind}
                </strong>
              </div>
              <span className={`ci-step-status is-${step.status}`}>
                {statusLabel[step.status]}
              </span>
            </li>
          ))}
        </ol>
      )}

      <details className="ci-audit-details" open={state.runs.length > 0}>
        <summary>查看执行与决策证据时间线</summary>
        <RunTimeline onReportOpen={onReportOpen} state={state} />
      </details>
    </section>
  );
}
