const purposeLabel = {
  admission: "准入",
  progressive: "持续验证",
  verification: "复验",
  acceptance: "验收",
};

export function RunTimeline({ state, onReportOpen }) {
  return (
    <section className="ci-timeline-panel">
      <header className="ci-section-heading">
        <div>
          <span className="ci-eyebrow">执行与决策记录</span>
          <h2>一条时间线看完整次变更</h2>
        </div>
        <span className="ci-object-count">
          {state.runs.length} InspectionRun · {state.decisions.length}{" "}
          DecisionRecord
        </span>
      </header>

      {state.runs.length === 0 ? (
        <div className="ci-timeline-empty">
          确认方案后，每一次执行、风险和人工决定都会留在这里。
        </div>
      ) : (
        <ol className="ci-run-timeline">
          {state.runs.map((run) => (
            <li
              className={`ci-run-item ci-run-item-${run.result}`}
              key={run.id}
            >
              <div className="ci-run-dot" />
              <time>{run.time}</time>
              <div className="ci-run-content">
                <div>
                  <span>{purposeLabel[run.purpose]}</span>
                  <code>{run.id}</code>
                </div>
                <strong>{run.label}</strong>
                <p>{run.summary}</p>
              </div>
              <span className={`ci-run-pill ci-run-pill-${run.result}`}>
                {run.result === "risk" ? "风险" : "通过"}
              </span>
            </li>
          ))}
        </ol>
      )}

      {state.reportSnapshot && (
        <footer className="ci-report-snapshot">
          <div>
            <span className="ci-eyebrow">ReportSnapshot</span>
            <strong>{state.reportSnapshot.id}</strong>
          </div>
          <p>
            结论：通过 · 已固化 {state.reportSnapshot.runIds.length} 次执行证据
          </p>
          <button onClick={onReportOpen} type="button">
            查看完整报告
          </button>
        </footer>
      )}
    </section>
  );
}
