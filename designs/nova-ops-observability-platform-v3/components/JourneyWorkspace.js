"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon, Status } from "./ui";
import {
  getDecisionSummary,
  getJourneyStep,
  journeyCatalog,
  professionalWorkspaces,
} from "./journeyModel";

function JourneyRail({ journey, journeyId, state, dispatch }) {
  const activeStep = getJourneyStep(journeyId, state);

  return (
    <aside className="journey-rail" aria-label="角色任务与旅程进度">
      <button
        type="button"
        className="journey-home-link"
        onClick={() => dispatch({ type: "JOURNEY_EXIT" })}
      >
        ← 返回角色入口
      </button>
      <div className="journey-role-block">
        <span>当前角色</span>
        <strong>{journey.role}</strong>
        <small>{journey.scene}</small>
      </div>
      <div className="journey-question">
        <span>本次必须回答</span>
        <strong>{journey.question}</strong>
      </div>
      <ol className="journey-steps">
        {journey.steps.map((step, index) => (
          <li
            className={
              index < activeStep
                ? "complete"
                : index === activeStep
                  ? "active"
                  : ""
            }
            key={`${journeyId}-${step.label}`}
          >
            <button
              type="button"
              onClick={() =>
                dispatch({ type: "NAVIGATE", screen: step.screen })
              }
            >
              <span>{index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.hint}</small>
              </div>
            </button>
          </li>
        ))}
      </ol>
      <div className="journey-output">
        <span>可见终态</span>
        <strong>{journey.output}</strong>
      </div>
    </aside>
  );
}

function ProfessionalWorkbench({
  journey,
  activeWorkspace,
  onWorkspaceChange,
}) {
  const workspace = professionalWorkspaces[activeWorkspace];

  return (
    <section className="professional-workbench" aria-label="专业工作面">
      <div className="professional-workbench-tabs">
        <span>专业工作面</span>
        {journey.workspaces.map((workspaceId) => {
          const item = professionalWorkspaces[workspaceId];
          return (
            <button
              type="button"
              className={activeWorkspace === workspaceId ? "active" : ""}
              aria-pressed={activeWorkspace === workspaceId}
              key={workspaceId}
              onClick={() => onWorkspaceChange(workspaceId)}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="professional-focus">
        <div>
          <span>{workspace.label} · 当前判断</span>
          <strong>{workspace.decision}</strong>
        </div>
        <code>{workspace.query}</code>
        <div>
          <span
            className={workspace.freshness === "stale" ? "text-unknown" : ""}
          >
            freshness {workspace.freshness}
          </span>
          <strong>{workspace.evidence}</strong>
        </div>
      </div>
    </section>
  );
}

function DecisionInspector({ summary }) {
  const layers = [
    ["事实", summary.fact, "fact"],
    ["假设", summary.hypothesis, "hypothesis"],
    ["证据缺口", summary.gap, "gap"],
    ["建议", summary.suggestion, "suggestion"],
  ];

  return (
    <aside className="decision-inspector" aria-label="AI 分析与人工结论">
      <header>
        <div>
          <span className="eyebrow">Agent assist</span>
          <h2>证据与决策</h2>
        </div>
        <Status state="running">live</Status>
      </header>
      <div className="decision-layers">
        {layers.map(([label, value, kind]) => (
          <section className={`decision-layer layer-${kind}`} key={label}>
            <span>{label}</span>
            <p>{value}</p>
          </section>
        ))}
      </div>
      <section className="human-verdict">
        <span>人工结论</span>
        <Status state={summary.verdictState}>{summary.verdictState}</Status>
        <strong>{summary.verdict}</strong>
        <dl>
          <div>
            <dt>决策人</dt>
            <dd>{summary.owner}</dd>
          </div>
          <div>
            <dt>截止</dt>
            <dd>{summary.due}</dd>
          </div>
        </dl>
        <small>
          AI 只能给出事实、假设和建议；人工 verdict 与复验结果分别留痕。
        </small>
      </section>
    </aside>
  );
}

export function JourneyWorkspace({ journeyId, state, dispatch, Screen }) {
  const journey = journeyCatalog[journeyId];
  const [activeWorkspace, setActiveWorkspace] = useState(journey.workspaces[0]);
  const summary = useMemo(
    () => getDecisionSummary(journeyId, state),
    [journeyId, state],
  );

  useEffect(() => {
    setActiveWorkspace(journey.workspaces[0]);
  }, [journey]);

  return (
    <div className="journey-workspace">
      <JourneyRail
        journey={journey}
        journeyId={journeyId}
        state={state}
        dispatch={dispatch}
      />
      <section className="journey-center">
        <ProfessionalWorkbench
          journey={journey}
          activeWorkspace={activeWorkspace}
          onWorkspaceChange={setActiveWorkspace}
        />
        <div className="screen-wrap">
          <Screen />
        </div>
      </section>
      <DecisionInspector summary={summary} />
    </div>
  );
}
