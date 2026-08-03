import type { InspectionReportIntelligence } from '@cat-cafe/shared';
import styles from './InspectionOperationsPage.module.css';

interface InspectionReportIntelligencePanelProps {
  readonly intelligence: InspectionReportIntelligence;
}

export function InspectionReportIntelligencePanel({ intelligence }: InspectionReportIntelligencePanelProps) {
  const deductionTotal = intelligence.score.deductions.reduce((sum, deduction) => sum + deduction.points, 0);

  return (
    <section className={styles.reportIntelligence} data-testid="report-intelligence">
      <header>
        <span>
          <small>AI REPORT INTELLIGENCE</small>
          <strong>{intelligence.score.overall}</strong>
          <em>{intelligence.score.grade} 级</em>
        </span>
        <span>
          评分模型 <code>{intelligence.score.modelVersion}</code>
        </span>
      </header>
      <div className={styles.scoreDimensions}>
        {intelligence.score.dimensions.map((dimension) => (
          <div key={dimension.id}>
            <span>{dimension.label}</span>
            <strong>{dimension.score}</strong>
            <small>
              权重 {dimension.weight}% · {dimension.explanation}
            </small>
          </div>
        ))}
      </div>
      <div className={styles.reportDeductions}>
        <strong>加权扣分 {deductionTotal.toFixed(1)}</strong>
        {intelligence.score.deductions.map((deduction) => (
          <p key={deduction.id}>
            <span>
              −{deduction.points} · {deduction.reason}
            </span>
            <code>{deduction.evidenceRefs.join(' · ')}</code>
          </p>
        ))}
      </div>
      <div className={styles.reportInterpretation}>
        <p>{intelligence.interpretation.executiveSummary}</p>
        {intelligence.interpretation.residualRisks.map((risk) => (
          <p key={risk.statement}>
            <strong>残余风险</strong> · {risk.statement}
          </p>
        ))}
        <p>{intelligence.interpretation.recommendation}</p>
      </div>
      <details className={styles.reportBasis}>
        <summary>查看冻结评分依据</summary>
        <dl>
          <div>
            <dt>候选方案</dt>
            <dd>{intelligence.assessmentBasis.candidateSetId ?? 'legacy'}</dd>
          </div>
          <div>
            <dt>可比性</dt>
            <dd>{intelligence.assessmentBasis.comparability}</dd>
          </div>
          <div>
            <dt>来源快照</dt>
            <dd>{intelligence.assessmentBasis.sourceSnapshotHashes.join(' · ')}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
