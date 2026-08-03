const dimensionLabel = {
  coverage: "覆盖完整度",
  integrity: "证据可信度",
  comparability: "基线可比性",
  freshness: "证据新鲜度",
  risk_closure: "风险闭环度",
};

function ScoreRing({ score, grade }) {
  return (
    <div
      className="ci-score-ring"
      style={{ "--score": `${score * 3.6}deg` }}
      aria-label={`报告评分 ${score} 分`}
    >
      <div>
        <strong>{score}</strong>
        <span>{grade} · 可信</span>
      </div>
    </div>
  );
}

export function ReportIntelligence({ report }) {
  const { score, interpretation } = report.intelligence;

  return (
    <section
      className="ci-report-intelligence"
      data-testid="report-intelligence"
    >
      <header>
        <div>
          <span className="ci-eyebrow">AI report intelligence</span>
          <h3>巡检报告评分与解读</h3>
          <p>{interpretation.executiveSummary}</p>
        </div>
        <ScoreRing grade={score.grade} score={score.overall} />
      </header>

      <div className="ci-score-dimensions">
        {score.dimensions.map((dimension) => (
          <div className="ci-score-dimension" key={dimension.id}>
            <div>
              <span>{dimensionLabel[dimension.id] ?? dimension.label}</span>
              <strong>{dimension.score}</strong>
            </div>
            <span className="ci-score-track">
              <span style={{ width: `${dimension.score}%` }} />
            </span>
            <p>{dimension.explanation}</p>
          </div>
        ))}
      </div>

      <div className="ci-report-reading-grid">
        <section>
          <span className="ci-eyebrow">关键结论</span>
          {interpretation.keyEvidence.map((item) => (
            <p key={item.statement}>{item.statement}</p>
          ))}
        </section>
        <section className="ci-residual-risk">
          <span className="ci-eyebrow">剩余风险</span>
          {interpretation.residualRisks.length ? (
            interpretation.residualRisks.map((item) => (
              <p key={item.statement}>{item.statement}</p>
            ))
          ) : (
            <p>没有未闭环的高风险项。</p>
          )}
        </section>
      </div>

      <div className="ci-report-recommendation">
        <span>模型建议</span>
        <strong>{interpretation.recommendation}</strong>
        <small>
          解释置信度 {Math.round(interpretation.confidence * 100)}% · 评分模型{" "}
          {score.modelVersion}
        </small>
      </div>

      <details className="ci-report-citations">
        <summary>引用证据 · {interpretation.citations.length} 条</summary>
        <div>
          {interpretation.citations.map((citation) => (
            <code key={citation}>{citation}</code>
          ))}
        </div>
      </details>
    </section>
  );
}
