"use client";

import { ForecastChart, MiniBars } from "../Charts";
import { useOps } from "../OpsContext";
import { Metric, PageHeading, Panel, Status } from "../ui";

const heatmapRows = ["业务", "SLO", "容量", "日志", "拨测", "依赖"];

export function MissionCommand() {
  const { state, dispatch } = useOps();
  const mission = state.mission;

  return (
    <div data-screen="MissionCommand">
      <PageHeading
        eyebrow={`${mission.id} · Plan v${mission.planVersion}`}
        title={mission.name}
        description="当前峰值阶段能否继续承载增长？进入下一阶段前还缺什么？"
        meta={
          <Status state={mission.status}>
            {mission.stage} · 43m remaining
          </Status>
        }
        actions={[
          <button
            key="frequency"
            type="button"
            className="button button-secondary"
            data-domain-action="mission.frequency.changed"
            onClick={() =>
              dispatch({
                type: "MISSION_FREQUENCY_CHANGED",
                frequency: mission.frequency === "1m" ? "2m" : "1m",
              })
            }
          >
            {mission.frequency === "1m" ? "恢复 2m 巡检" : "提升至 1m 巡检"}
          </button>,
          <button
            key="freeze"
            type="button"
            className="button button-danger"
            data-domain-action="mission.expansion.frozen"
            onClick={() => dispatch({ type: "MISSION_EXPANSION_FROZEN" })}
          >
            冻结扩流
          </button>,
        ]}
      />

      <section className="mission-stage">
        <div className="stage-meta">
          <span>
            Commander <strong>{mission.commander}</strong>
          </span>
          <span>{mission.services} services</span>
          <span>
            检查频率 <strong>{mission.frequency}</strong>
          </span>
          <span>
            估算成本 <strong>¥{mission.estimatedDailyCost}/day</strong>
          </span>
        </div>
        <div className="stage-track">
          {mission.stages.map((stage, index) => (
            <div
              key={stage}
              className={
                index < mission.stageIndex
                  ? "stage done"
                  : index === mission.stageIndex
                    ? "stage active"
                    : "stage"
              }
            >
              <i />
              <span>{stage}</span>
              <small>
                {index < mission.stageIndex
                  ? "complete"
                  : index === mission.stageIndex
                    ? "running"
                    : "pending"}
              </small>
            </div>
          ))}
        </div>
      </section>

      <div className="metrics-strip">
        <Metric
          label="Actual RPS"
          value="181k"
          detail="+18% vs plan"
          tone="warning"
        />
        <Metric
          label="Capacity"
          value="220k"
          detail="17.7% headroom"
          tone="good"
        />
        <Metric
          label="SLO burn"
          value="1.8×"
          detail="payment journey"
          tone="danger"
        />
        <Metric
          label="Runs / hour"
          value={mission.frequency === "1m" ? "60" : "30"}
          detail={`${mission.frequency} cadence`}
          tone="running"
        />
        <Metric
          label="Decision due"
          value={mission.nextDecisionAt}
          detail="inventory scale"
          tone="unknown"
        />
      </div>

      <div className="dashboard-grid mission-grid">
        <Panel title="业务交易漏斗" eyebrow="实时 vs 计划" className="span-4">
          <MiniBars
            values={mission.transactionFunnel.map((item) => item.realtime)}
            labels={mission.transactionFunnel.map((item) => item.name)}
          />
          <div className="funnel-legend">
            {mission.transactionFunnel.map((item) => (
              <span key={item.name}>
                {item.name} 计划 {item.plan}% / 昨同 {item.yesterday}%
              </span>
            ))}
          </div>
        </Panel>

        <Panel
          title="流量、容量与风险预测"
          eyebrow="Forecast readiness: ready"
          className="span-8"
        >
          <ForecastChart mission={mission} />
        </Panel>

        <Panel
          title="Inspection Run heatmap"
          eyebrow="最近 12 次高频运行"
          className="span-8"
        >
          <div className="heatmap">
            <div className="heatmap-times">
              <span />
              {Array.from({ length: 12 }, (_, index) => (
                <time key={index}>
                  {String(19 + Math.floor(index / 6)).padStart(2, "0")}:
                  {String((index % 6) * 2).padStart(2, "0")}
                </time>
              ))}
            </div>
            {mission.runHeatmap.map((row, rowIndex) => (
              <div className="heatmap-row" key={heatmapRows[rowIndex]}>
                <strong>{heatmapRows[rowIndex]}</strong>
                {row.map((cell, cellIndex) => (
                  <button
                    key={`${rowIndex}-${cellIndex}`}
                    type="button"
                    className={`heat-cell heat-${cell}`}
                    title={`${heatmapRows[rowIndex]} · Run ${cellIndex + 1} · ${cell}`}
                    onClick={() =>
                      dispatch({ type: "NAVIGATE", screen: "reports" })
                    }
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="heatmap-legend">
            <Status state="pass">pass</Status>
            <Status state="warning">warning</Status>
            <Status state="unhealthy">fail</Status>
            <Status state="unknown">unknown</Status>
          </div>
        </Panel>

        <Panel
          title="风险战情板"
          eyebrow="Owner / ETA / Verification"
          className="span-4"
        >
          <div className="finding-stack">
            {state.findings
              .filter((finding) => finding.source === mission.id)
              .map((finding) => (
                <article className="finding-card" key={finding.id}>
                  <div>
                    <span
                      className={`severity severity-${finding.severity.toLowerCase()}`}
                    >
                      {finding.severity}
                    </span>
                    <Status state={finding.status}>{finding.status}</Status>
                  </div>
                  <strong>{finding.title}</strong>
                  <span>
                    {finding.id} · {finding.evidence} evidence
                  </span>
                  <div className="owner-row">
                    <small>{finding.owner}</small>
                    <button
                      type="button"
                      className="button button-quiet"
                      data-domain-action="finding.claimed"
                      onClick={() =>
                        dispatch({
                          type: "FINDING_CLAIMED",
                          findingId: finding.id,
                          owner: "inventory-oncall",
                        })
                      }
                    >
                      认领
                    </button>
                  </div>
                </article>
              ))}
            <article className="finding-card">
              <div>
                <span className="severity severity-p1">P1</span>
                <Status state="investigating">investigating</Status>
              </div>
              <strong>支付 p95 相对 control +38%</strong>
              <span>FND-8821 · Investigation INV-7719</span>
              <button
                type="button"
                className="button button-quiet"
                data-domain-action="investigation.open"
                onClick={() =>
                  dispatch({ type: "NAVIGATE", screen: "investigation" })
                }
              >
                打开调查
              </button>
            </article>
          </div>
        </Panel>

        <Panel
          title="指挥动作与交班"
          eyebrow="Action / HIL / Audit"
          className="span-12"
        >
          <div className="command-strip">
            <button
              type="button"
              className="command-action"
              data-domain-action="mission.frequency.changed"
              onClick={() =>
                dispatch({ type: "MISSION_FREQUENCY_CHANGED", frequency: "1m" })
              }
            >
              <span>01</span>
              <strong>提高检查频率</strong>
              <small>2m → 1m · +¥84/day</small>
            </button>
            <button
              type="button"
              className="command-action danger"
              data-domain-action="mission.expansion.frozen"
              onClick={() => dispatch({ type: "MISSION_EXPANSION_FROZEN" })}
            >
              <span>02</span>
              <strong>冻结扩流</strong>
              <small>等待支付与库存风险闭环</small>
            </button>
            <button
              type="button"
              className="command-action"
              data-domain-action="report.open"
              onClick={() => dispatch({ type: "NAVIGATE", screen: "reports" })}
            >
              <span>03</span>
              <strong>生成阶段快照</strong>
              <small>Run / Finding / Action / Verification</small>
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
