"use client";

import { Status } from "./ui";

function ScopeDetails({ object, state, onClose }) {
  return (
    <>
      <div className="drawer-head">
        <div>
          <div className="eyebrow">Scope provenance</div>
          <h2>范围来源与继承</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </button>
      </div>
      <div className="scope-origin-card">
        <span>当前来源</span>
        <strong>{object?.source ?? "全局 SRE 运行视图"}</strong>
        <p>
          当前对象继承 service / env / region / time / change /
          mission。扩展范围会创建新 Incident Scope 分支，不会静默污染原证据链。
        </p>
      </div>
      <div className="scope-grid">
        {Object.entries(state.scope).map(([key, value]) => (
          <div key={key}>
            <span>{key}</span>
            <strong>{Array.isArray(value) ? value.join(" + ") : value}</strong>
          </div>
        ))}
      </div>
      <button type="button" className="button button-secondary" disabled>
        扩展范围 · 原型不创建真实 Investigation
      </button>
    </>
  );
}

export function AppHeader({
  clock,
  isHome,
  object,
  state,
  dispatch,
  openDrawer,
  closeDrawer,
}) {
  return (
    <header className="top-bar">
      <div className="top-brand">
        <button
          type="button"
          className="brand-mark"
          aria-label="返回 SRE 工作台"
          onClick={() => dispatch({ type: "OBJECT_CLOSE" })}
        >
          <span>N</span>
          <i aria-hidden="true">•</i>
        </button>
        <div>
          <strong>NOVA Ops</strong>
          <span className="version-stamp">CAT CAFÉ · V2026 FIELD</span>
        </div>
      </div>

      {!isHome && (
        <div className="scope-bar">
          {object && (
            <span className="scope-chip object-scope-chip">
              {object.label} · {object.id}
            </span>
          )}
          <span className="scope-chip strong">{state.scope.environment}</span>
          <span className="scope-chip">{state.scope.service}</span>
          <span className="scope-chip">{state.scope.regions.join(" + ")}</span>
          <button
            type="button"
            className="scope-chip locked scope-origin"
            onClick={() =>
              openDrawer({
                type: "content",
                content: (
                  <ScopeDetails
                    object={object}
                    state={state}
                    onClose={closeDrawer}
                  />
                ),
              })
            }
          >
            {object?.source ?? "全局 SRE 运行视图"} ↗
          </button>
        </div>
      )}

      <div className="top-runtime">
        <span>{clock}</span>
        <Status state="running">巡检 12</Status>
        <Status state="running">诊断 2</Status>
        <button
          type="button"
          className="manual-button"
          onClick={() => openDrawer({ type: "guide" })}
        >
          使用说明
        </button>
        {!isHome && (
          <button
            type="button"
            className="hil-button"
            onClick={() => dispatch({ type: "NAVIGATE", screen: "live" })}
          >
            运行队列 · 3
          </button>
        )}
      </div>
    </header>
  );
}
