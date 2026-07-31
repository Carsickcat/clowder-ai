"use client";

import { useOps } from "../OpsContext";
import { Metric, PageHeading, Panel, Status } from "../ui";

const evidenceColumns = ["metrics", "logs", "traces", "synthetics", "alerts"];

export function Governance() {
  const { state, dispatch } = useOps();
  const governance = state.governance;

  return (
    <div data-screen="Governance">
      <PageHeading
        eyebrow="Platform governance · 128 Tier-1/2 services"
        title="健康判定与 Agent 治理"
        description="哪些服务看似绿色但其实不可判定？哪些 Plan、Forecast 或 Agent 工具需要治理？"
        meta={
          <Status state="unknown">
            {100 - governance.coverage}% not decidable
          </Status>
        }
        actions={[
          <button
            key="assign"
            type="button"
            className="button button-primary"
            data-domain-action="coverage.gap.assigned"
            onClick={() =>
              dispatch({
                type: "GOVERNANCE_GAP_ASSIGNED",
                service: "payments-router",
                owner: "payments-owner",
              })
            }
          >
            分派最高优先级缺口
          </button>,
        ]}
      />

      <div className="metrics-strip governance-metrics">
        <Metric
          label="健康可判定覆盖"
          value={`${governance.coverage}%`}
          detail="目标 ≥ 95%"
          tone="warning"
        />
        <Metric
          label="Stale sources"
          value={governance.staleSources}
          detail="3 P0 services"
          tone="unknown"
        />
        <Metric
          label="Baseline drift"
          value={governance.baselineDrift}
          detail="trend not comparable"
          tone="warning"
        />
        <Metric
          label="Degraded tools"
          value={governance.degradedTools}
          detail="Agent read-only tools"
          tone="danger"
        />
        <Metric
          label="Forecast not ready"
          value={governance.forecast.notReady}
          detail={`${governance.forecast.degraded} calibration degraded`}
          tone="unknown"
        />
      </div>

      <div className="dashboard-grid governance-grid">
        <Panel
          title="服务 × Evidence coverage matrix"
          eyebrow="缺失不折算为健康"
          className="span-8"
        >
          <div className="table-scroll">
            <table className="data-table coverage-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Tier</th>
                  <th>Owner</th>
                  {evidenceColumns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {governance.coverageMatrix.map((row) => (
                  <tr key={row.service}>
                    <td>
                      <strong>{row.service}</strong>
                    </td>
                    <td>{row.tier}</td>
                    <td>{row.owner}</td>
                    {evidenceColumns.map((column) => (
                      <td key={column}>
                        <span
                          className={
                            row[column]
                              ? "coverage-cell covered"
                              : "coverage-cell missing"
                          }
                        >
                          {row[column] ? "✓" : "—"}
                        </span>
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="button button-quiet"
                        data-domain-action="coverage.gap.assigned"
                        disabled={evidenceColumns.every(
                          (column) => row[column],
                        )}
                        onClick={() =>
                          dispatch({
                            type: "GOVERNANCE_GAP_ASSIGNED",
                            service: row.service,
                            owner: row.owner,
                          })
                        }
                      >
                        {row.assignment === "in_progress"
                          ? "已分派"
                          : "分派缺口"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Forecast readiness"
          eyebrow="具体指标 · 非全局风险分"
          className="span-4"
        >
          <div className="readiness-donut" aria-label="Forecast readiness">
            <div className="donut-ring">
              <strong>{governance.forecast.ready}</strong>
              <span>ready</span>
            </div>
            <div className="readiness-list">
              <div>
                <Status state="ready">ready</Status>
                <strong>{governance.forecast.ready}</strong>
              </div>
              <div>
                <Status state="unknown">not_ready</Status>
                <strong>{governance.forecast.notReady}</strong>
              </div>
              <div>
                <Status state="warning">calibration degraded</Status>
                <strong>{governance.forecast.degraded}</strong>
              </div>
            </div>
          </div>
          <div className="readiness-reasons">
            <span>2 · history &lt; 2 seasons</span>
            <span>1 · baseline drift</span>
            <span>1 · high residual variance</span>
          </div>
        </Panel>

        <Panel
          title="Plan 生命周期"
          eyebrow="Version / Run / Cost"
          className="span-5"
        >
          <div className="lifecycle-lanes">
            {[
              ["Draft", 18, "unknown"],
              ["In review", 6, "warning"],
              ["Published", 36, "ready"],
              ["Paused", 4, "unhealthy"],
            ].map(([label, count, status]) => (
              <div key={label}>
                <Status state={status}>{label}</Status>
                <strong>{count}</strong>
                <span>Plans</span>
              </div>
            ))}
          </div>
          <div className="version-queue">
            <article>
              <strong>PLAN-312 Draft v2</strong>
              <span>+2 checks · cadence 10m→2m · cost +31%</span>
              <Status state={state.inspectionPlan.status}>
                {state.inspectionPlan.status}
              </Status>
            </article>
            <article>
              <strong>PLAN-284 Draft v7</strong>
              <span>baseline comparator changed · owner pending</span>
              <Status state="blocked">blocked</Status>
            </article>
          </div>
        </Panel>

        <Panel
          title="Agent 执行健康"
          eyebrow="Frequency / success / limits"
          className="span-7"
        >
          <div className="agent-health-table">
            <div className="agent-health-row head">
              <span>Runtime</span>
              <span>7d Runs</span>
              <span>Error</span>
              <span>P95</span>
              <span>Rate limit</span>
              <span>Status</span>
            </div>
            <div className="agent-health-row">
              <strong>Inspection Agent</strong>
              <span>18,420</span>
              <span>1.8%</span>
              <span>42s</span>
              <span>72%</span>
              <Status state="running">healthy</Status>
            </div>
            <div className="agent-health-row">
              <strong>Diagnosis Agent</strong>
              <span>486</span>
              <span>3.1%</span>
              <span>4m18s</span>
              <span>38%</span>
              <Status state="warning">degraded</Status>
            </div>
            <div className="agent-health-row">
              <strong>Logs query tool</strong>
              <span>7,812</span>
              <span>0.4%</span>
              <span>1.8s</span>
              <span>65%</span>
              <Status state="ready">ready</Status>
            </div>
            <div className="agent-health-row">
              <strong>Synthetics detail</strong>
              <span>2,106</span>
              <span>12.8%</span>
              <span>3.4s</span>
              <span>81%</span>
              <Status state="unhealthy">degraded</Status>
            </div>
          </div>
        </Panel>

        <Panel
          title="Audit stream"
          eyebrow="Who / Agent / Tool / Decision"
          className="span-12"
        >
          <div className="audit-stream">
            {state.audit
              .slice()
              .reverse()
              .map((entry, index) => (
                <article key={`${entry.at}-${entry.action}-${index}`}>
                  <time>{entry.at}</time>
                  <strong>{entry.actor}</strong>
                  <code>{entry.action}</code>
                  <span>{entry.detail}</span>
                </article>
              ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
