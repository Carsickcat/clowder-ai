"use client";

import { ForecastChart, JourneyTrendChart } from "../Charts";
import { useOps } from "../OpsContext";
import { Metric, PageHeading, Panel, Status } from "../ui";

function DecisionQueue() {
  const { state, dispatch } = useOps();
  const decisions = [
    {
      severity: "P1",
      title: "暂停 payments-router 扩流",
      context: state.change.id,
      due: "08:12",
      owner: "发布负责人",
      action: () => dispatch({ type: "NAVIGATE", screen: "change" }),
      label: "进入 Guard",
    },
    {
      severity: "P2",
      title: "库存同步延迟即将越线",
      context: state.mission.id,
      due: "05:42",
      owner: "inventory-oncall",
      action: () =>
        dispatch({
          type: "FINDING_CLAIMED",
          findingId: "FND-8832",
          owner: "inventory-oncall",
        }),
      label: "认领风险",
    },
    {
      severity: "P2",
      title: "华南拨测 freshness unknown",
      context: "FND-8828",
      due: "21:18",
      owner: "unassigned",
      action: () => dispatch({ type: "NAVIGATE", screen: "change" }),
      label: "处理缺口",
    },
  ];

  return (
    <div className="decision-list">
      {decisions.map((decision) => (
        <article className="decision-row" key={decision.title}>
          <div
            className={`severity severity-${decision.severity.toLowerCase()}`}
          >
            {decision.severity}
          </div>
          <div className="decision-main">
            <strong>{decision.title}</strong>
            <span>
              {decision.context} · {decision.owner}
            </span>
          </div>
          <div className="decision-due">
            <small>剩余</small>
            <strong>{decision.due}</strong>
          </div>
          <button
            type="button"
            className="button button-quiet"
            data-domain-action="decision.open"
            onClick={decision.action}
          >
            {decision.label}
          </button>
        </article>
      ))}
    </div>
  );
}

export function LiveOps() {
  const { state, dispatch, openDrawer } = useOps();
  const healthy = state.journeys.filter(
    (journey) => journey.health === "healthy",
  ).length;
  const degraded = state.journeys.filter(
    (journey) => journey.health === "degraded",
  ).length;
  const unknown = state.journeys.filter(
    (journey) => journey.health === "unknown",
  ).length;

  return (
    <div data-screen="LiveOps">
      <PageHeading
        eyebrow="Production · 2026-06-18 · Peak protection"
        title="今日生产运行"
        description="以关键业务旅程、待决策和 Agent 运行状态组织现场；没有总健康分。"
        meta={<Status state="running">峰值保障中 · 43m remaining</Status>}
        actions={[
          <button
            key="mission"
            type="button"
            className="button button-primary"
            data-domain-action="mission.open"
            onClick={() => dispatch({ type: "NAVIGATE", screen: "mission" })}
          >
            进入保障指挥
          </button>,
        ]}
      />

      <section className="decision-banner">
        <div>
          <span className="decision-kicker">P1 · 发布决策</span>
          <strong>payments-router 灰度已暂停扩流</strong>
          <p>支付 p95 +38%，2 个规则 blocker，1 个 freshness unknown。</p>
        </div>
        <div className="decision-clock">
          <small>决策剩余</small>
          <strong>08:12</strong>
        </div>
        <button
          type="button"
          className="button button-danger"
          data-domain-action="change.open"
          onClick={() => dispatch({ type: "NAVIGATE", screen: "change" })}
        >
          查看变更证据
        </button>
      </section>

      <div className="metrics-strip">
        <Metric
          label="关键旅程"
          value="6"
          detail={`${healthy} healthy`}
          tone="good"
        />
        <Metric
          label="性能退化"
          value={degraded}
          detail="结算 / 支付"
          tone="warning"
        />
        <Metric
          label="不可判定"
          value={unknown}
          detail="数据过期"
          tone="unknown"
        />
        <Metric
          label="Open Findings"
          value="4"
          detail="2 P1 · 2 P2"
          tone="danger"
        />
        <Metric
          label="Agent Runs"
          value="14"
          detail="12 inspection · 2 diagnosis"
          tone="running"
        />
      </div>

      <div className="dashboard-grid live-grid">
        <Panel
          title="关键旅程实时矩阵"
          eyebrow="Business journeys"
          className="span-7"
          action={<span className="panel-meta">updated 8s</span>}
        >
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Journey</th>
                  <th>Health</th>
                  <th>Success</th>
                  <th>p95</th>
                  <th>SLO</th>
                  <th>Region</th>
                  <th>Freshness</th>
                </tr>
              </thead>
              <tbody>
                {state.journeys.map((journey) => (
                  <tr
                    key={journey.id}
                    className="clickable-row"
                    onClick={() =>
                      openDrawer({
                        type: "content",
                        content: (
                          <div>
                            <div className="drawer-head">
                              <div>
                                <div className="eyebrow">Journey detail</div>
                                <h2>{journey.name}</h2>
                              </div>
                            </div>
                            <JourneyTrendChart
                              onEvidence={() =>
                                dispatch({
                                  type: "INVESTIGATION_EVIDENCE_PINNED",
                                  lens: "metrics",
                                  evidenceId: `JOURNEY-${journey.id}-2018`,
                                })
                              }
                            />
                            <button
                              type="button"
                              className="button button-primary button-full"
                              data-domain-action="investigation.open"
                              onClick={() =>
                                dispatch({
                                  type: "NAVIGATE",
                                  screen: "investigation",
                                })
                              }
                            >
                              进入故障调查
                            </button>
                          </div>
                        ),
                      })
                    }
                  >
                    <td>
                      <strong>{journey.name}</strong>
                    </td>
                    <td>
                      <Status state={journey.health}>{journey.health}</Status>
                    </td>
                    <td className="numeric">{journey.success}</td>
                    <td className="numeric">{journey.p95}</td>
                    <td className="numeric">{journey.slo}</td>
                    <td>{journey.region}</td>
                    <td
                      className={
                        journey.freshness.includes("stale")
                          ? "text-unknown"
                          : ""
                      }
                    >
                      {journey.freshness}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="待决策队列"
          eyebrow="Human-in-the-loop"
          className="span-5"
        >
          <DecisionQueue />
        </Panel>

        <Panel
          title="保障流量、容量与预测"
          eyebrow={`${state.mission.id} · ${state.mission.stage}`}
          className="span-8"
        >
          <ForecastChart mission={state.mission} />
        </Panel>

        <Panel
          title="Agent 运行现场"
          eyebrow="Public execution"
          className="span-4"
        >
          <div className="runtime-list">
            {state.agentRuns.slice(-4).map((run) => (
              <article key={run.id} className="runtime-row">
                <div className="runtime-top">
                  <Status state={run.status}>{run.kind}</Status>
                  <span>{run.elapsed}</span>
                </div>
                <strong>{run.title}</strong>
                <span>
                  {run.id} · {run.currentStep}
                </span>
                <div className="progress-track">
                  <i style={{ width: `${run.progress}%` }} />
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel
          title="风险与事件时间线"
          eyebrow="19:45–21:00"
          className="span-12"
        >
          <div className="horizontal-timeline">
            {state.timeline.map((event) => (
              <article
                key={`${event.at}-${event.title}`}
                className={`timeline-event event-${event.kind}`}
              >
                <time>{event.at}</time>
                <strong>{event.title}</strong>
                <span>{event.detail}</span>
              </article>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
