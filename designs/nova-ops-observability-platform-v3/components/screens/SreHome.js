"use client";

import { useOps } from "../OpsContext";
import { objectCatalog, sreQueue } from "../objectModel";
import { Icon, Status } from "../ui";

const posture = [
  {
    label: "Active Incidents",
    value: "2",
    detail: "1 P1 · 1 P2",
    tone: "fail",
  },
  {
    label: "Open Findings",
    value: "4",
    detail: "2 awaiting owner",
    tone: "warning",
  },
  {
    label: "Blocked Changes",
    value: "1",
    detail: "2 fail · 1 unknown",
    tone: "unknown",
  },
  {
    label: "Running Missions",
    value: "1",
    detail: "峰值 · cadence 2m",
    tone: "running",
  },
  {
    label: "Open Inspections",
    value: "7",
    detail: "3 gate blocked",
    tone: "unknown",
  },
];

function runtimeQueueItem(item, state) {
  if (item.type === "incident") {
    return { ...item, status: state.investigation.status };
  }
  if (item.type === "change") {
    return {
      ...item,
      status: state.change.status,
      stage: state.change.status === "passed" ? "复验通过" : item.stage,
      nextAction:
        state.change.status === "passed" ? "查看版本报告" : item.nextAction,
    };
  }
  if (item.type === "mission") {
    return { ...item, status: state.mission.status };
  }
  return {
    ...item,
    status: state.inspectionPlan.status,
    stage:
      state.inspectionPlan.status === "published" ? "首个 Run" : item.stage,
    nextAction:
      state.inspectionPlan.status === "published"
        ? "查看首次运行"
        : item.nextAction,
  };
}

export function SreHome() {
  const { state, dispatch } = useOps();
  const runtimePosture = posture.map((item) =>
    item.label === "Open Findings"
      ? {
          ...item,
          value: String(
            state.findings.filter((finding) => finding.status !== "closed")
              .length,
          ),
        }
      : item,
  );

  const openObject = (item) =>
    dispatch({
      type: "OBJECT_OPEN",
      objectType: item.type,
      objectId: item.id,
    });

  return (
    <div className="sre-home" data-screen="SreHome">
      <header className="sre-home-hero">
        <div>
          <span className="home-kicker">NOVA Ops · SRE control plane</span>
          <h1>SRE 运行工作台</h1>
          <p>
            从当前待处置对象进入，而不是先选择身份或功能模块。每个对象保留独立
            Scope、证据、人工决策与跨对象回写链。
          </p>
        </div>
        <div className="home-runtime-card">
          <div>
            <span className="live-indicator" />
            <strong>Production · Mock live</strong>
          </div>
          <span>
            {state.agentRuns.filter((run) => run.status === "running").length}{" "}
            Agent Runs
          </span>
          <span>
            {
              state.findings.filter((finding) => finding.status !== "closed")
                .length
            }{" "}
            Open Findings
          </span>
          <Status state="unknown">3 decisions due</Status>
        </div>
      </header>

      <section className="sre-posture-grid" aria-label="全局运行态势">
        {runtimePosture.map((item) => (
          <article className="sre-posture-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <Status state={item.tone}>{item.detail}</Status>
          </article>
        ))}
      </section>

      <section className="sre-queue-panel" aria-label="待处置对象">
        <header>
          <div>
            <span className="eyebrow">Priority queue</span>
            <h2>待处置对象</h2>
          </div>
          <p>按 blocker、业务影响与截止时间排序 · 不生成总健康分</p>
        </header>

        <div className="sre-queue-head" aria-hidden="true">
          <span>类型 / 对象</span>
          <span>当前阶段</span>
          <span>截止</span>
          <span>下一步动作</span>
        </div>
        <div className="sre-queue">
          {sreQueue.map((queueItem) => {
            const item = runtimeQueueItem(queueItem, state);
            const definition = objectCatalog[item.type];
            return (
              <button
                type="button"
                className={`sre-queue-row object-${item.type}`}
                data-domain-action="object.opened"
                key={item.id}
                onClick={() => openObject(item)}
              >
                <span className="queue-object">
                  <i className="object-type-icon">
                    <Icon name={definition.icon} />
                  </i>
                  <span>
                    <small>{definition.label}</small>
                    <strong>{item.id}</strong>
                    <em>{item.title}</em>
                  </span>
                </span>
                <span className="queue-stage">
                  <Status state={item.status}>{item.stage}</Status>
                  {item.signal && <small>{item.signal}</small>}
                </span>
                <span className="queue-due">
                  <small>{item.urgency}</small>
                  <strong>{item.due}</strong>
                </span>
                <span className="queue-next">
                  <strong>{item.nextAction}</strong>
                  <i aria-hidden="true">→</i>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="object-entry-section">
        <header>
          <div>
            <span className="eyebrow">Operational objects</span>
            <h2>对象类型入口</h2>
          </div>
          <span>Incident / Change / Mission / Inspection 是运行对象</span>
        </header>
        <div className="object-entry-grid">
          {Object.values(objectCatalog).map((item) => (
            <button
              type="button"
              className={`object-entry object-${item.type}`}
              data-domain-action="object.opened"
              key={item.type}
              onClick={() => openObject(item)}
            >
              <i className="object-type-icon">
                <Icon name={item.icon} />
              </i>
              <span>
                <strong>{item.label}</strong>
                <small>
                  {item.id} · {item.status}
                </small>
              </span>
              <b aria-hidden="true">→</b>
            </button>
          ))}
          <button
            type="button"
            className="object-entry object-view"
            onClick={() => dispatch({ type: "NAVIGATE", screen: "reports" })}
          >
            <i className="object-type-icon">
              <Icon name="report" />
            </i>
            <span>
              <strong>Reports</strong>
              <small>版本化运行投影</small>
            </span>
            <b aria-hidden="true">→</b>
          </button>
          <button
            type="button"
            className="object-entry object-view"
            onClick={() => dispatch({ type: "NAVIGATE", screen: "governance" })}
          >
            <i className="object-type-icon">
              <Icon name="grid" />
            </i>
            <span>
              <strong>Governance</strong>
              <small>覆盖与 Agent 健康视图</small>
            </span>
            <b aria-hidden="true">→</b>
          </button>
        </div>
      </section>
    </div>
  );
}
