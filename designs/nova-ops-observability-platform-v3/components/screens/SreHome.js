"use client";

import { useOps } from "../OpsContext";
import { objectCatalog, sreQueue } from "../objectModel";
import { Icon, Status } from "../ui";

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

function QueueRow({ item, onOpen }) {
  const definition = objectCatalog[item.type];
  return (
    <button
      type="button"
      className={`sre-queue-row object-${item.type}`}
      data-domain-action="object.opened"
      onClick={() => onOpen(item)}
    >
      <span className="queue-priority">
        <b>{item.urgency}</b>
        <i>{item.due}</i>
      </span>
      <span className="queue-object">
        <i className="object-type-icon">
          <Icon name={definition.icon} />
        </i>
        <span>
          <small>
            {definition.label} · {item.id}
          </small>
          <strong>{item.title}</strong>
          <em>{definition.impact}</em>
        </span>
      </span>
      <span className="queue-stage">
        <Status state={item.status}>{item.stage}</Status>
        {item.signal && <small>{item.signal}</small>}
      </span>
      <span className="queue-next">
        <small>下一判断</small>
        <strong>{item.nextAction}</strong>
        <i aria-hidden="true">→</i>
      </span>
    </button>
  );
}

export function SreHome() {
  const { state, dispatch } = useOps();
  const queue = sreQueue.map((item) => runtimeQueueItem(item, state));
  const openFindings = state.findings.filter(
    (finding) => finding.status !== "closed",
  );
  const unownedFindings = openFindings.filter(
    (finding) => finding.owner === "unassigned",
  );
  const runningAgentRuns = state.agentRuns.filter(
    (run) => run.status === "running",
  );

  const openObject = (item) =>
    dispatch({
      type: "OBJECT_OPEN",
      objectType: item.type,
      objectId: item.id,
    });

  return (
    <div className="sre-cockpit" data-screen="SreHome">
      <header className="cockpit-shift-bar">
        <div className="shift-identity">
          <span className="live-indicator" />
          <div>
            <span>Production · 当班现场</span>
            <strong>全球购核心链路</strong>
          </div>
        </div>
        <dl className="shift-readout">
          <div>
            <dt>Scope</dt>
            <dd>payments-router · cn-east + cn-south</dd>
          </div>
          <div>
            <dt>Open findings</dt>
            <dd>{openFindings.length}</dd>
          </div>
          <div>
            <dt>Agent runs</dt>
            <dd>{runningAgentRuns.length}</dd>
          </div>
        </dl>
        <span className="shift-time">20:18 · shift 04</span>
      </header>

      <div className="cockpit-grid">
        <section
          className="cockpit-decision-board sre-queue-panel"
          aria-label="待处置对象"
        >
          <header>
            <div>
              <span className="eyebrow">Decision queue · 待处置对象</span>
              <h1>当前需要决策</h1>
            </div>
            <p>按业务影响、阻塞程度与截止时间排序</p>
          </header>
          <div className="sre-queue">
            {queue.map((item) => (
              <QueueRow item={item} key={item.id} onOpen={openObject} />
            ))}
          </div>
        </section>

        <aside className="cockpit-live-rail" aria-label="值班运行态">
          <section className="cockpit-pulse">
            <header>
              <span className="eyebrow">In context</span>
              <h2>现场脉冲</h2>
            </header>
            <button
              type="button"
              className="pulse-item pulse-danger"
              onClick={() => openObject(objectCatalog.change)}
            >
              <span>证据缺口</span>
              <strong>华南拨测 stale 6m</strong>
              <small>CHG-23841 · Verification 仍不可判定</small>
            </button>
            <button
              type="button"
              className="pulse-item pulse-warning"
              onClick={() => openObject(objectCatalog.mission)}
            >
              <span>风险窗口</span>
              <strong>容量预测 20:24 越线</strong>
              <small>MIS-61801 · inventory-sync 尚未确认扩容</small>
            </button>
            <button
              type="button"
              className="pulse-item pulse-unknown"
              onClick={() => openObject(objectCatalog.incident)}
            >
              <span>责任缺口</span>
              <strong>{unownedFindings.length || 1} 个 Finding 未认领</strong>
              <small>先处理证据与 Owner，不折算为健康</small>
            </button>
          </section>

          <section className="cockpit-runs">
            <header>
              <span className="eyebrow">Automation</span>
              <h2>正在运行</h2>
            </header>
            <div className="run-list">
              {runningAgentRuns.length > 0 ? (
                runningAgentRuns.map((run) => (
                  <article className="run-item" key={run.id}>
                    <div>
                      <span>{run.kind}</span>
                      <Status state="running">live</Status>
                    </div>
                    <strong>{run.title}</strong>
                    <small>
                      {run.currentStep} · {run.elapsed}
                    </small>
                    <i>
                      <b style={{ width: `${run.progress}%` }} />
                    </i>
                  </article>
                ))
              ) : (
                <div className="run-empty-state">
                  <strong>没有运行中的 Agent</strong>
                  <small>新的诊断或验证任务会在这里显示进度。</small>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
