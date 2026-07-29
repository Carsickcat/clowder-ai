"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon, Status } from "./ui";
import {
  getObjectDecisionSummary,
  getObjectStep,
  objectCatalog,
  professionalWorkspaces,
} from "./objectModel";

const sourceFindings = {
  change: "FND-8821",
  mission: "FND-8832",
  inspection: "FND-8840",
};

function ObjectRail({ object, objectType, state, dispatch }) {
  const activeStep = getObjectStep(objectType, state);
  const sourceObject =
    objectType === "incident" ? state.investigation.sourceObject : null;
  const runtimeStatus = {
    incident: state.investigation.status,
    change: state.change.status,
    mission: state.mission.status,
    inspection: state.inspectionPlan.status,
  }[objectType];

  return (
    <aside
      className="object-rail journey-rail"
      aria-label="对象上下文与处置流程"
    >
      <button
        type="button"
        className="journey-home-link"
        onClick={() => dispatch({ type: "OBJECT_CLOSE" })}
      >
        ← 返回 SRE 工作台
      </button>
      <div className="journey-role-block object-context-block">
        <span>当前对象 · {object.label}</span>
        <strong>{object.id}</strong>
        <small>{object.title}</small>
        <Status state={runtimeStatus}>{runtimeStatus}</Status>
      </div>
      <div className="journey-question object-impact">
        <span>{sourceObject ? "来源对象" : "Scope 来源"}</span>
        <strong>
          {sourceObject
            ? `${objectCatalog[sourceObject.type].label} · ${sourceObject.id}`
            : object.source}
        </strong>
        <small>{object.impact}</small>
        {sourceObject && (
          <button
            type="button"
            className="inline-object-link"
            data-domain-action="object.opened"
            onClick={() =>
              dispatch({
                type: "OBJECT_OPEN",
                objectType: sourceObject.type,
                objectId: sourceObject.id,
              })
            }
          >
            返回 {sourceObject.id} ↗
          </button>
        )}
      </div>
      <ol className="journey-steps object-steps">
        {object.steps.map((step, index) => (
          <li
            className={
              index < activeStep
                ? "complete"
                : index === activeStep
                  ? "active"
                  : ""
            }
            key={`${objectType}-${step.label}`}
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
        <strong>{object.output}</strong>
      </div>
    </aside>
  );
}

function ProfessionalWorkbench({ object, activeWorkspace, onWorkspaceChange }) {
  const workspace = professionalWorkspaces[activeWorkspace];

  return (
    <section className="professional-workbench" aria-label="专业证据工作面">
      <div className="professional-workbench-tabs">
        <span>专业证据</span>
        {object.workspaces.map((workspaceId) => {
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

function CrossObjectAction({ objectType, state, dispatch }) {
  if (objectType === "incident") {
    if (!state.investigation.sourceObject) {
      return (
        <div className="cross-object-note">
          独立告警建案 · 形成 ActionProposal 后可关联目标 Finding。
        </div>
      );
    }
    if (state.investigation.sourceObject.type === "change") {
      return (
        <button
          type="button"
          className="button button-primary cross-object-button"
          data-domain-action="change.decision.set"
          disabled={!state.investigation.actionProposal}
          onClick={() => {
            dispatch({
              type: "CHANGE_DECISION_SET",
              decision: "rollback",
            });
            dispatch({
              type: "OBJECT_OPEN",
              objectType: "change",
              objectId: state.investigation.sourceObject.id,
            });
          }}
        >
          进入 Change Guard 记录整改与门禁
        </button>
      );
    }
    if (state.investigation.writeback?.status === "written_back") {
      return (
        <div className="cross-object-receipt">
          <Status state="running">written back</Status>
          <strong>
            {state.investigation.writeback.targetFindingId} 已进入 pending
            action
          </strong>
          <small>恢复结论仍由源对象 Verification Run 负责。</small>
        </div>
      );
    }
    return (
      <button
        type="button"
        className="button button-primary cross-object-button"
        data-domain-action="action-proposal.written_back"
        disabled={!state.investigation.actionProposal}
        onClick={() => dispatch({ type: "ACTION_PROPOSAL_WRITTEN_BACK" })}
      >
        回写 {state.investigation.sourceObject.id} Finding → Verification
      </button>
    );
  }

  if (objectType === "change" && state.change.status === "passed") {
    return (
      <div className="cross-object-note">
        Change 已由 Verification Run 判定通过；新的异常应创建新的 Finding /
        Incident，不复用已关闭事件。
      </div>
    );
  }

  const currentFinding = sourceFindings[objectType];
  const sourceFinding = state.findings.find(
    (finding) => finding.id === currentFinding,
  );
  const linkedWriteback =
    state.investigation.writeback?.status === "written_back" &&
    state.investigation.writeback?.targetFindingId === currentFinding &&
    state.investigation.writeback?.targetObject?.type === objectType &&
    state.investigation.writeback?.targetObject?.id ===
      objectCatalog[objectType].id;
  const remediationReceipt = state.remediationReceipts.find(
    (receipt) =>
      receipt.status === "completed" &&
      receipt.sourceFindingId === currentFinding &&
      receipt.sourceObject.type === objectType &&
      receipt.sourceObject.id === objectCatalog[objectType].id,
  );

  if (["mission", "inspection"].includes(objectType) && linkedWriteback) {
    if (remediationReceipt) {
      return (
        <div className="cross-object-receipt">
          <Status state="running">awaiting verification</Status>
          <strong>整改回执 {remediationReceipt.id} 已绑定源 Finding</strong>
          <small>Inspection Agent 只按回执后的证据与 Gate 判定。</small>
        </div>
      );
    }
    return (
      <button
        type="button"
        className="button button-primary cross-object-button"
        data-domain-action="source.remediation.recorded"
        disabled={sourceFinding?.status !== "pending_action"}
        onClick={() =>
          dispatch({
            type: "SOURCE_REMEDIATION_RECORDED",
            sourceObject: {
              type: objectType,
              id: objectCatalog[objectType].id,
            },
            findingId: currentFinding,
            evidenceIds: [
              `ACTION-RECEIPT-${objectCatalog[objectType].id}-${currentFinding}`,
            ],
          })
        }
      >
        记录整改回执 → 进入源对象复验
      </button>
    );
  }

  const alreadyLinked =
    state.investigation.sourceObject?.type === objectType &&
    state.investigation.sourceObject?.id === objectCatalog[objectType].id;

  if (alreadyLinked) {
    return (
      <button
        type="button"
        className="button button-secondary cross-object-button"
        data-domain-action="object.opened"
        onClick={() =>
          dispatch({
            type: "OBJECT_OPEN",
            objectType: "incident",
            objectId: state.investigation.objectId,
          })
        }
      >
        打开 {state.investigation.objectId} 调查 ↗
      </button>
    );
  }

  return (
    <button
      type="button"
      className="button button-secondary cross-object-button"
      data-domain-action="incident.escalated"
      onClick={() =>
        dispatch({
          type: "INCIDENT_ESCALATED",
          sourceObject: {
            type: objectType,
            id: objectCatalog[objectType].id,
          },
          findingId: currentFinding,
        })
      }
    >
      升级为 Incident 调查
    </button>
  );
}

function DecisionInspector({ objectType, summary, state, dispatch }) {
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
          AI 只提供可复核事实、假设与建议；人工 verdict 与源对象复验分别留痕。
        </small>
      </section>
      <CrossObjectAction
        objectType={objectType}
        state={state}
        dispatch={dispatch}
      />
    </aside>
  );
}

export function ObjectWorkspace({ objectType, state, dispatch, Screen }) {
  const object = objectCatalog[objectType];
  const [activeWorkspace, setActiveWorkspace] = useState(object.workspaces[0]);
  const summary = useMemo(
    () => getObjectDecisionSummary(objectType, state),
    [objectType, state],
  );

  useEffect(() => {
    setActiveWorkspace(object.workspaces[0]);
  }, [object]);

  return (
    <div
      className={`object-workspace journey-workspace layout-${object.layout}`}
      data-workspace-layout={object.layout}
    >
      <ObjectRail
        object={object}
        objectType={objectType}
        state={state}
        dispatch={dispatch}
      />
      <section className="object-center journey-center">
        <ProfessionalWorkbench
          object={object}
          activeWorkspace={activeWorkspace}
          onWorkspaceChange={setActiveWorkspace}
        />
        <div className="screen-wrap">
          <Screen />
        </div>
      </section>
      <DecisionInspector
        objectType={objectType}
        summary={summary}
        state={state}
        dispatch={dispatch}
      />
    </div>
  );
}
