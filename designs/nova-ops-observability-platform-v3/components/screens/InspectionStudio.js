"use client";

import { getPlanPublishBlockers } from "../../lib/domain.mjs";
import { useOps } from "../OpsContext";
import { PageHeading, Panel, Status } from "../ui";

const gateNames = {
  schema: "Schema resolved",
  sample: "Sample query",
  freshness: "Data freshness",
  permission: "Permission",
  baseline: "Baseline comparability",
  cost: "Projected cost",
};

export function InspectionStudio() {
  const { state, dispatch } = useOps();
  const plan = state.inspectionPlan;
  const blockers = getPlanPublishBlockers(state);

  return (
    <div data-screen="InspectionStudio">
      <PageHeading
        eyebrow={`${plan.id} · ${plan.version}`}
        title="NL2Inspection Studio"
        description="自然语言负责表达意图；结构化 Check、等价 Query、回放、门禁和审批决定它能否成为生产巡检。"
        meta={<Status state={plan.status}>{plan.status}</Status>}
        actions={[
          <button
            key="publish"
            type="button"
            className="button button-primary"
            data-domain-action="plan.published"
            disabled={blockers.length > 0 || plan.status === "published"}
            onClick={() => dispatch({ type: "PLAN_PUBLISH" })}
          >
            {plan.status === "published"
              ? "Published v2"
              : `发布 Plan · ${blockers.length} blockers`}
          </button>,
        ]}
      />

      <div className="studio-layout">
        <section className="studio-column intent-column">
          <header>
            <span>01</span>
            <div>
              <strong>意图与澄清</strong>
              <small>Agent 将业务语义编译为受控 Plan</small>
            </div>
          </header>
          <div className="prompt-box">
            <div className="prompt-author">服务 Owner</div>
            <p>{plan.prompt}</p>
          </div>
          <div className="clarification-list">
            {plan.clarifications.map((item) => (
              <div key={item.question}>
                <span>{item.question}</span>
                <strong>{item.answer}</strong>
              </div>
            ))}
          </div>
          <div className="ai-contract">
            <div className="eyebrow">AI compiled scope</div>
            <dl>
              <div>
                <dt>Target</dt>
                <dd>journey:checkout/payment</dd>
              </div>
              <div>
                <dt>Cadence</dt>
                <dd>2m during peak stage</dd>
              </div>
              <div>
                <dt>Outputs</dt>
                <dd>Finding + snapshot + final report</dd>
              </div>
              <div>
                <dt>Action</dt>
                <dd>proposal only · HIL required</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="studio-column plan-column">
          <header>
            <span>02</span>
            <div>
              <strong>结构化 Plan</strong>
              <small>{plan.checks.length} Checks · 可读、可测、可版本化</small>
            </div>
          </header>
          <div className="check-list">
            {plan.checks.map((check, index) => (
              <article
                className={index === 0 ? "check-row selected" : "check-row"}
                key={check.id}
              >
                <div>
                  <span className="check-id">{check.id}</span>
                  <strong>{check.name}</strong>
                  <small>
                    {check.source} · {check.window} · {check.owner}
                  </small>
                </div>
                <Status state="ready">compiled</Status>
              </article>
            ))}
          </div>
          <Panel
            title="CK-1 · 支付成功率"
            eyebrow="Executable check editor"
            className="embedded-panel"
          >
            <div className="definition-grid">
              <div>
                <span>Target</span>
                <strong>journey:checkout/payment</strong>
              </div>
              <div>
                <span>Window</span>
                <strong>5m · 2/3 runs</strong>
              </div>
              <div>
                <span>Compare</span>
                <strong>control + 30m baseline</strong>
              </div>
              <div>
                <span>Threshold</span>
                <strong>&lt; 99.85%</strong>
              </div>
            </div>
            <div className="query-editor">
              <div className="query-toolbar">
                <span>Equivalent query · read-only preview</span>
                <Status state="ready">132ms</Status>
              </div>
              <code>
                sum(rate(payment_success_total{"{service='payments-router'}"}
                [5m]))
                <br />/ sum(rate(payment_attempt_total
                {"{service='payments-router'}"}[5m]))
              </code>
            </div>
          </Panel>
        </section>

        <section className="studio-column gates-column">
          <header>
            <span>03</span>
            <div>
              <strong>发布门禁</strong>
              <small>验证可执行性，不评价文案质量</small>
            </div>
          </header>
          <div className="gate-stack">
            {Object.entries(plan.gates).map(([name, gate]) => (
              <div className="gate-row gate-detailed" key={name}>
                <div>
                  <strong>{gateNames[name]}</strong>
                  <small>{gate.detail}</small>
                </div>
                <Status state={gate.status}>{gate.status}</Status>
              </div>
            ))}
          </div>
          <div className="studio-actions">
            {plan.gates.permission.status !== "ready" && (
              <button
                type="button"
                className="button button-secondary button-full"
                data-domain-action="plan.gate.permission.resolved"
                onClick={() =>
                  dispatch({ type: "PLAN_GATE_RESOLVED", gate: "permission" })
                }
              >
                申请 cn-south 拨测只读权限
              </button>
            )}
            {plan.gates.baseline.status !== "ready" && (
              <button
                type="button"
                className="button button-secondary button-full"
                data-domain-action="plan.gate.baseline.resolved"
                onClick={() =>
                  dispatch({ type: "PLAN_GATE_RESOLVED", gate: "baseline" })
                }
              >
                补齐 5/5 可比运行
              </button>
            )}
            {plan.replay.status !== "completed" && (
              <button
                type="button"
                className="button button-secondary button-full"
                data-domain-action="plan.replay.completed"
                onClick={() => dispatch({ type: "PLAN_REPLAY_COMPLETED" })}
              >
                回放过去 7 天
              </button>
            )}
            {plan.replay.status === "completed" && (
              <div className="replay-result">
                <span>7d Replay</span>
                <strong>{plan.replay.triggers} triggers</strong>
                <small>
                  {plan.replay.matchedIncidents} matched incidents ·{" "}
                  {plan.replay.noise} 待标注
                </small>
              </div>
            )}
            {plan.approval !== "approved" && (
              <button
                type="button"
                className="button button-secondary button-full"
                data-domain-action="plan.approved"
                onClick={() => dispatch({ type: "PLAN_APPROVED" })}
              >
                审批 Draft v2 diff
              </button>
            )}
            <button
              type="button"
              className="button button-primary button-full"
              data-domain-action="plan.published"
              disabled={blockers.length > 0 || plan.status === "published"}
              onClick={() => dispatch({ type: "PLAN_PUBLISH" })}
            >
              {plan.status === "published"
                ? "Published v2 · 首次 Run 已排队"
                : blockers.length > 0
                  ? `不可发布 · ${blockers.join(" / ")}`
                  : "发布 Plan v2"}
            </button>
          </div>
          <div className="version-diff">
            <div className="eyebrow">Draft v2 diff</div>
            <span>+ 2 checks</span>
            <span>~ 1 threshold</span>
            <span>cadence 10m → 2m</span>
            <span>cost +31%</span>
          </div>
        </section>
      </div>
    </div>
  );
}
