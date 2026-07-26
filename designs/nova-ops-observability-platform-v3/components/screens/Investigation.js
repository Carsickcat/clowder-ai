"use client";

import { useState } from "react";
import { CanaryControlChart } from "../Charts";
import { useOps } from "../OpsContext";
import { PageHeading, Panel, Status } from "../ui";

const lensEvidence = {
  metrics: {
    query:
      "p95(span.duration), by:{version} | filter service == payments-router",
    id: "METRIC-P95-2018",
    result: "canary 149ms / control 105ms",
  },
  logs: {
    query:
      "service:payments-router version:v3.18.0 @error.kind:acquire_timeout",
    id: "LOG-ACQUIRE-991",
    result: "127 events · new pattern after 20:03",
  },
  traces: {
    query: "trace.service:checkout downstream:payments-router version:v3.18.0",
    id: "TRACE-DBPOOL-514",
    result: "DB acquire = 41% critical path",
  },
  synthetics: {
    query: "journey:checkout region:cn-south step:payment",
    id: "SYNTH-CNSOUTH-388",
    result: "unknown · source stale 6m",
  },
  changes: {
    query: "service:payments-router time:20:00–20:21",
    id: "CHANGE-23841",
    result: "v3.18.0 · 10% canary",
  },
};

export function Investigation() {
  const { state, dispatch } = useOps();
  const [lens, setLens] = useState("metrics");
  const investigation = state.investigation;
  const selectedEvidence = lensEvidence[lens];

  return (
    <div data-screen="Investigation">
      <PageHeading
        eyebrow={`${investigation.id} · Revision ${investigation.revision}`}
        title={investigation.title}
        description="影响是什么、哪个假设最可信、下一条可证伪测试是什么？"
        meta={
          <Status state={investigation.status}>{investigation.status}</Status>
        }
        actions={[
          <button
            key="inconclusive"
            type="button"
            className="button button-secondary"
            data-domain-action="investigation.inconclusive"
            onClick={() =>
              dispatch({ type: "INVESTIGATION_CONCLUDE_INCONCLUSIVE" })
            }
          >
            证据不足 · Conclude inconclusive
          </button>,
        ]}
      />

      <section className="investigation-issue-bar">
        <div>
          <span>Impact</span>
          <strong>{investigation.impact}</strong>
        </div>
        <div>
          <span>Coverage</span>
          <strong>{investigation.coverage}%</strong>
        </div>
        <div>
          <span>Evidence</span>
          <strong>{investigation.evidence.length}</strong>
        </div>
        <div className="unknown">
          <span>Data gap</span>
          <strong>1 · cn-south</strong>
        </div>
      </section>

      <div className="investigation-layout">
        <section className="evidence-canvas">
          <Panel title="证据时间线" eyebrow="Facts only · source-linked">
            <div className="evidence-timeline">
              {state.timeline.map((event) => (
                <article
                  className={`evidence-event event-${event.kind}`}
                  key={`${event.at}-${event.title}`}
                >
                  <time>{event.at}</time>
                  <i />
                  <div>
                    <strong>{event.title}</strong>
                    <span>{event.detail}</span>
                  </div>
                </article>
              ))}
              {investigation.observations.map((observation) => (
                <article
                  className="evidence-event event-evidence"
                  key={observation.id}
                >
                  <time>{observation.source}</time>
                  <i />
                  <div>
                    <strong>{observation.statement}</strong>
                    <span>
                      {observation.id} · {observation.evidenceId}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          <Panel
            title="专业 Evidence Lens"
            eyebrow="同一 ScopeContext · 不复制 Observation 卡"
          >
            <div className="lens-tabs">
              {Object.keys(lensEvidence).map((name) => (
                <button
                  key={name}
                  type="button"
                  className={lens === name ? "lens-tab active" : "lens-tab"}
                  onClick={() => setLens(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="lens-workbench">
              <div className="lens-query">
                <span>可复核 Query</span>
                <code>{selectedEvidence.query}</code>
              </div>
              <div className="lens-result">
                <Status state={lens === "synthetics" ? "unknown" : "unhealthy"}>
                  {lens === "synthetics" ? "unknown" : "correlated"}
                </Status>
                <strong>{selectedEvidence.result}</strong>
                <small>{selectedEvidence.id} · freshness 12s</small>
              </div>
              <button
                type="button"
                className="button button-primary"
                data-domain-action="investigation.evidence.pinned"
                disabled={investigation.evidence.includes(selectedEvidence.id)}
                onClick={() =>
                  dispatch({
                    type: "INVESTIGATION_EVIDENCE_PINNED",
                    lens,
                    evidenceId: selectedEvidence.id,
                  })
                }
              >
                {investigation.evidence.includes(selectedEvidence.id)
                  ? "已钉入当前 Revision"
                  : "钉入 Evidence 并生成 Observation"}
              </button>
            </div>
          </Panel>

          <Panel title="Canary / control 反证视图" eyebrow="点击异常点钉入证据">
            <CanaryControlChart
              change={state.change}
              onEvidence={() =>
                dispatch({
                  type: "INVESTIGATION_EVIDENCE_PINNED",
                  lens: "metrics",
                  evidenceId: "METRIC-CANARY-CONTROL-149",
                })
              }
            />
          </Panel>
        </section>

        <aside className="hypothesis-board">
          <div className="hypothesis-head">
            <div>
              <span className="eyebrow">Diagnosis Agent</span>
              <h2>可证伪假设</h2>
            </div>
            <Status state="running">testing</Status>
          </div>
          {investigation.hypotheses.map((hypothesis) => (
            <article
              className={`hypothesis hypothesis-${hypothesis.status}`}
              key={hypothesis.id}
            >
              <div className="hypothesis-top">
                <span>{hypothesis.id}</span>
                <strong>{Math.round(hypothesis.confidence * 100)}%</strong>
              </div>
              <h3>{hypothesis.claim}</h3>
              <div className="confidence-track">
                <i style={{ width: `${hypothesis.confidence * 100}%` }} />
              </div>
              <div className="evidence-balance">
                <span className="supporting">
                  + {hypothesis.supporting} supporting
                </span>
                <span className="refuting">
                  − {hypothesis.refuting} refuting
                </span>
              </div>
              <div className="next-test">
                <span>Next test</span>
                <code>{hypothesis.nextTest}</code>
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className="button button-secondary"
                  data-domain-action="hypothesis.test.completed"
                  disabled={hypothesis.tested}
                  onClick={() =>
                    dispatch({
                      type: "HYPOTHESIS_TEST_RUN",
                      hypothesisId: hypothesis.id,
                    })
                  }
                >
                  {hypothesis.tested ? "Test completed" : "运行测试"}
                </button>
                {hypothesis.id === "H1" && (
                  <button
                    type="button"
                    className="button button-primary"
                    data-domain-action="hypothesis.confirmed"
                    disabled={
                      !hypothesis.tested || hypothesis.status === "confirmed"
                    }
                    onClick={() =>
                      dispatch({
                        type: "HYPOTHESIS_CONFIRMED",
                        hypothesisId: hypothesis.id,
                      })
                    }
                  >
                    Confirm
                  </button>
                )}
              </div>
            </article>
          ))}
          {investigation.actionProposal && (
            <section className="action-proposal">
              <div className="eyebrow">ActionProposal</div>
              <strong>{investigation.actionProposal.action}</strong>
              <span>{investigation.actionProposal.runbook}</span>
              <small>{investigation.actionProposal.approval}</small>
              <button
                type="button"
                className="button button-danger button-full"
                data-domain-action={
                  investigation.actionProposal.sourceObject?.type === "change"
                    ? "change.decision.set"
                    : "action-proposal.written_back"
                }
                disabled={!investigation.actionProposal.sourceObject}
                onClick={() => {
                  const sourceObject =
                    investigation.actionProposal.sourceObject;
                  if (sourceObject.type === "change") {
                    dispatch({
                      type: "CHANGE_DECISION_SET",
                      decision: "rollback",
                    });
                  } else {
                    dispatch({ type: "ACTION_PROPOSAL_WRITTEN_BACK" });
                  }
                  dispatch({
                    type: "OBJECT_OPEN",
                    objectType: sourceObject.type,
                    objectId: sourceObject.id,
                  });
                }}
              >
                {investigation.actionProposal.sourceObject?.type === "change"
                  ? "进入 Change Guard 审批并执行"
                  : investigation.actionProposal.sourceObject
                    ? `回写 ${investigation.actionProposal.sourceObject.id} Finding → Verification`
                    : "关联源对象后回写"}
              </button>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
