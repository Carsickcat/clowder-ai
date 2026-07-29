"use client";

import { CanaryControlChart } from "../Charts";
import { useOps } from "../OpsContext";
import { Metric, PageHeading, Panel, Status } from "../ui";

export function ChangeGuard() {
  const { state, dispatch } = useOps();
  const change = state.change;
  const verification = change.verification;
  const gates = verification.gates;
  const counts = change.objectiveRows.reduce(
    (result, objective) => ({
      ...result,
      [objective.status]: (result[objective.status] ?? 0) + 1,
    }),
    {},
  );
  const isResolved = verification.status === "passed";

  const evaluateGates = () => dispatch({ type: "VERIFICATION_EVALUATE" });

  return (
    <div className="change-verification-workbench" data-screen="ChangeGuard">
      <PageHeading
        eyebrow={`${change.id} · ${change.canaryPercent}% canary / ${change.controlPercent}% control`}
        title={change.title}
        description="本次灰度应该继续、延长观察还是回滚？规则 blocker、AI 证据摘要和未知门禁分开呈现。"
        meta={<Status state={change.status}>{change.status}</Status>}
        actions={
          isResolved
            ? [
                <button
                  key="resolved"
                  type="button"
                  className="button button-secondary"
                  disabled
                >
                  回滚已完成 · 复验已通过
                </button>,
              ]
            : [
                <button
                  key="observe"
                  type="button"
                  className="button button-secondary"
                  data-domain-action="change.decision.set"
                  onClick={() =>
                    dispatch({
                      type: "CHANGE_DECISION_SET",
                      decision: "observe",
                    })
                  }
                >
                  保持 10% · 观察 10m
                </button>,
                <button
                  key="rollback"
                  type="button"
                  className="button button-danger"
                  data-domain-action="change.decision.set"
                  onClick={() =>
                    dispatch({
                      type: "CHANGE_DECISION_SET",
                      decision: "rollback",
                    })
                  }
                >
                  提议回滚
                </button>,
              ]
        }
      />

      <section className="guard-decision-bar">
        <div>
          <span>建议</span>
          <strong>{change.recommendation}</strong>
        </div>
        <div className="guard-reasons">
          <span>
            <b>{counts.fail ?? 0}</b> rule blockers
          </span>
          <span>
            <b>3</b> AI linked evidence
          </span>
          <span className={counts.unknown ? "unknown" : ""}>
            <b>{counts.unknown ?? 0}</b> freshness unknown
          </span>
        </div>
        <div className="decision-clock">
          <small>{isResolved ? "事件状态" : "决策剩余"}</small>
          <strong>{isResolved ? "verified" : change.decisionRemaining}</strong>
        </div>
      </section>

      <div className="metrics-strip">
        <Metric
          label="支付成功率"
          value={change.liveMetrics.success}
          detail={change.liveMetrics.successDetail}
          tone={change.status === "passed" ? "good" : "danger"}
        />
        <Metric
          label="支付 p95"
          value={change.liveMetrics.p95}
          detail={change.liveMetrics.p95Detail}
          tone={change.status === "passed" ? "good" : "danger"}
        />
        <Metric
          label="DB pool wait"
          value={change.liveMetrics.poolWait}
          detail={change.liveMetrics.poolWaitDetail}
          tone={change.status === "passed" ? "good" : "warning"}
        />
        <Metric
          label="Objectives"
          value={
            isResolved
              ? `${counts.pass} pass`
              : `${counts.fail ?? 0}F · ${counts.warning ?? 0}W`
          }
          detail={
            isResolved
              ? "all current objectives passed"
              : `${counts.unknown ?? 0} unknown · ${counts.pass ?? 0} pass`
          }
          tone={isResolved ? "good" : "unknown"}
        />
        <Metric
          label="Verification"
          value={verification.status}
          detail={verification.blockedBy?.join(", ") ?? "not evaluated"}
          tone={verification.status === "passed" ? "good" : "unknown"}
        />
      </div>

      <div className="dashboard-grid change-grid">
        <Panel
          title="Canary vs control · p95"
          eyebrow="20m comparison window"
          className="span-7"
        >
          <CanaryControlChart
            change={change}
            onEvidence={() => {
              dispatch({
                type: "INVESTIGATION_EVIDENCE_PINNED",
                lens: "metrics",
                evidenceId: "METRIC-P95-ANOMALY-2013",
              });
              dispatch({ type: "NAVIGATE", screen: "investigation" });
            }}
          />
        </Panel>

        <Panel
          title="Decision rail"
          eyebrow="规则、审批、可逆性"
          className="span-5"
        >
          <div className="decision-rail">
            <button
              type="button"
              className="rail-option"
              data-domain-action="change.decision.set"
              disabled={isResolved}
              onClick={() =>
                dispatch({ type: "CHANGE_DECISION_SET", decision: "observe" })
              }
            >
              <span className="rail-index">A</span>
              <div>
                <strong>保持 10% 并观察 10m</strong>
                <small>可逆 · no approval · 预计多采 5 次 Run</small>
              </div>
            </button>
            <button
              type="button"
              className={
                isResolved ? "rail-option selected" : "rail-option danger"
              }
              data-domain-action="change.decision.set"
              disabled={isResolved}
              onClick={() =>
                dispatch({ type: "CHANGE_DECISION_SET", decision: "rollback" })
              }
            >
              <span className="rail-index">B</span>
              <div>
                <strong>
                  {isResolved ? "已回滚 v3.18.0" : "回滚 v3.18.0"}
                </strong>
                <small>
                  {isResolved
                    ? "执行完成 · Verification passed"
                    : "Runbook · L2 + oncall · 预计 3m"}
                </small>
              </div>
            </button>
            <button
              type="button"
              className="rail-option"
              disabled
              title="存在规则 blocker 与 unknown"
            >
              <span className="rail-index">C</span>
              <div>
                <strong>继续至 25%</strong>
                <small>blocked：2 fail + 1 unknown</small>
              </div>
            </button>
          </div>
        </Panel>

        <Panel
          title="Validation objectives"
          eyebrow="规则判定 · 非 AI 分数"
          className="span-8"
        >
          <div className="table-scroll">
            <table className="data-table objective-table">
              <thead>
                <tr>
                  <th>Objective</th>
                  <th>Status</th>
                  <th>Current</th>
                  <th>Control</th>
                  <th>Threshold</th>
                  <th>Freshness</th>
                  <th>Evidence</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {change.objectiveRows.map((objective) => (
                  <tr key={objective.name}>
                    <td>
                      <strong>{objective.name}</strong>
                    </td>
                    <td>
                      <Status state={objective.status}>
                        {objective.status}
                      </Status>
                    </td>
                    <td className="numeric">{objective.current}</td>
                    <td className="numeric">{objective.control}</td>
                    <td className="numeric">{objective.threshold}</td>
                    <td
                      className={
                        objective.freshness.includes("stale")
                          ? "text-unknown"
                          : ""
                      }
                    >
                      {objective.freshness}
                    </td>
                    <td className="numeric">{objective.evidence}</td>
                    <td>{objective.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Verification gate"
          eyebrow="Action ≠ Recovery"
          className="span-4"
        >
          <div className="gate-stack">
            {Object.entries(gates).map(([name, value]) => (
              <div className="gate-row" key={name}>
                <span>{name}</span>
                <Status state={value}>{value}</Status>
              </div>
            ))}
          </div>
          <div className="verification-actions">
            {change.actionState === "in_progress" && (
              <button
                type="button"
                className="button button-danger button-full"
                data-domain-action="change.action.completed"
                onClick={() => dispatch({ type: "CHANGE_ACTION_COMPLETED" })}
              >
                {change.decision === "rollback"
                  ? "确认回滚完成 · 等待复验"
                  : "确认 10m 观察窗完成"}
              </button>
            )}
            {verification.status === "not_started" &&
              change.actionState === "completed" && (
                <button
                  type="button"
                  className="button button-primary button-full"
                  data-domain-action="verification.started"
                  onClick={() => dispatch({ type: "VERIFICATION_START" })}
                >
                  启动复验 Run
                </button>
              )}
            {verification.status === "not_started" &&
              change.actionState !== "completed" && (
                <button
                  type="button"
                  className="button button-primary button-full"
                  disabled
                  title="先选择并完成整改动作"
                >
                  复验不可启动 · 整改未完成
                </button>
              )}
            {verification.status === "running" &&
              change.synthetic.state === "unknown" && (
                <button
                  type="button"
                  className="button button-primary button-full"
                  data-domain-action="verification.evaluate"
                  onClick={evaluateGates}
                >
                  评估当前 Gate
                </button>
              )}
            {verification.status === "blocked" &&
              change.synthetic.state === "unknown" && (
                <button
                  type="button"
                  className="button button-secondary button-full"
                  data-domain-action="synthetic.recovery.started"
                  onClick={() =>
                    dispatch({ type: "SYNTHETIC_RECOVERY_STARTED" })
                  }
                >
                  启动华南拨测恢复
                </button>
              )}
            {change.synthetic.state === "recovering" && (
              <button
                type="button"
                className="button button-secondary button-full"
                data-domain-action="synthetic.recovered"
                onClick={() => dispatch({ type: "SYNTHETIC_RECOVERED" })}
              >
                确认数据恢复 · 仍不标绿
              </button>
            )}
            {change.synthetic.state === "pass" &&
              verification.status !== "passed" && (
                <button
                  type="button"
                  className="button button-primary button-full"
                  data-domain-action="verification.evaluate"
                  onClick={evaluateGates}
                >
                  重跑 Gate 并生成结论
                </button>
              )}
          </div>
          <p className="gate-note">
            华南拨测恢复只改变 Evidence；只有全部 Gate pass 才关闭 Finding
            并更新旅程健康。
          </p>
        </Panel>

        <Panel
          title="Finding 与 Verification 时间线"
          eyebrow="Evidence → Action → Verification"
          className="span-12"
        >
          <div className="verification-timeline">
            {[
              ["20:00", "Baseline captured", "pass"],
              ["20:03", "Canary started", "pass"],
              ["20:06", "FND-8821 · p95 blocker", "unhealthy"],
              ["20:09", "FND-8828 · freshness unknown", "unknown"],
              ["20:12", "INV-7719 · testing H1", "running"],
              [
                "now",
                verification.status,
                verification.status === "passed" ? "pass" : "unknown",
              ],
            ].map(([time, title, status]) => (
              <div
                className={`verification-step step-${status}`}
                key={`${time}-${title}`}
              >
                <time>{time}</time>
                <i />
                <strong>{title}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
