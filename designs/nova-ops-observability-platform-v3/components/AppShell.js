"use client";

import { useEffect, useState } from "react";
import { useOps } from "./OpsContext";
import { UserGuide } from "./UserGuide";
import { Icon, Status } from "./ui";
import { ChangeGuard } from "./screens/ChangeGuard";
import { Governance } from "./screens/Governance";
import { InspectionStudio } from "./screens/InspectionStudio";
import { Investigation } from "./screens/Investigation";
import { LiveOps } from "./screens/LiveOps";
import { MissionCommand } from "./screens/MissionCommand";
import { ReportsCenter } from "./screens/ReportsCenter";

const nav = [
  { id: "live", label: "运行态势", icon: "pulse", badge: "3" },
  { id: "mission", label: "保障任务", icon: "shield", badge: "2 active" },
  { id: "change", label: "变更验证", icon: "branch", badge: "1 blocker" },
  { id: "studio", label: "巡检工程", icon: "wand", badge: "4 drafts" },
  {
    id: "investigation",
    label: "故障调查",
    icon: "search",
    badge: "2 running",
  },
  { id: "reports", label: "报告中心", icon: "report", badge: "3 live" },
  { id: "governance", label: "治理审计", icon: "grid", badge: "7 gaps" },
];

const lenses = [
  { id: "metrics", label: "监控", icon: "metric" },
  { id: "alerts", label: "告警", icon: "alert" },
  { id: "logs", label: "日志", icon: "logs" },
  { id: "traces", label: "Trace", icon: "trace" },
  { id: "synthetics", label: "拨测", icon: "synthetic" },
];

const screens = {
  live: LiveOps,
  mission: MissionCommand,
  change: ChangeGuard,
  studio: InspectionStudio,
  investigation: Investigation,
  reports: ReportsCenter,
  governance: Governance,
};

function LensDrawer({ lens }) {
  const { state, dispatch, closeDrawer } = useOps();
  const evidenceId = `${lens.id.toUpperCase()}-${state.investigation.evidence.length + 601}`;

  return (
    <>
      <div className="drawer-head">
        <div>
          <div className="eyebrow">Evidence Lens</div>
          <h2>{lens.label} · 当前调查上下文</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={closeDrawer}
          aria-label="关闭"
        >
          ×
        </button>
      </div>
      <div className="scope-grid">
        {Object.entries(state.scope).map(([key, value]) => (
          <div key={key}>
            <span>{key}</span>
            <strong>{Array.isArray(value) ? value.join(" + ") : value}</strong>
          </div>
        ))}
      </div>
      <section className="lens-evidence">
        <div className="eyebrow">可复核查询</div>
        <code>
          {lens.id === "logs"
            ? "service:payments-router version:v3.18.0 @error.kind:acquire_timeout"
            : `scope:${state.scope.service} source:${lens.id} change:${state.scope.changeId}`}
        </code>
        <div className="lens-result-row">
          <Status state="unhealthy">异常</Status>
          <strong>{evidenceId}</strong>
          <span>20:04–20:12 · 12s freshness</span>
        </div>
      </section>
      <button
        type="button"
        className="button button-primary"
        data-domain-action="investigation.evidence.pinned"
        onClick={() => {
          dispatch({
            type: "INVESTIGATION_EVIDENCE_PINNED",
            lens: lens.id,
            evidenceId,
          });
          closeDrawer();
          dispatch({ type: "NAVIGATE", screen: "investigation" });
        }}
      >
        钉入 {state.investigation.id} 并打开调查
      </button>
    </>
  );
}

export function AppShell() {
  const { state, dispatch, drawer, openDrawer, closeDrawer } = useOps();
  const [clock, setClock] = useState("20:18:42");
  const Screen = screens[state.currentScreen] ?? LiveOps;

  useEffect(() => {
    const timer = setInterval(() => {
      setClock((current) => {
        const [h, m, s] = current.split(":").map(Number);
        const date = new Date(2026, 5, 18, h, m, s + 1);
        return date.toTimeString().slice(0, 8);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [state.currentScreen]);

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand">
          <div className="brand-mark">N</div>
          <div>
            <strong>NOVA Ops</strong>
            <span>AI Observability</span>
          </div>
        </div>
        <nav className="primary-nav" aria-label="Agent 工作面">
          <div className="nav-section-label">Agent workspaces</div>
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                state.currentScreen === item.id ? "nav-item active" : "nav-item"
              }
              onClick={() => dispatch({ type: "NAVIGATE", screen: item.id })}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              <small>{item.badge}</small>
            </button>
          ))}
          <div className="nav-divider" />
          <div className="nav-section-label">Evidence lenses</div>
          {lenses.map((lens) => (
            <button
              key={lens.id}
              type="button"
              className="nav-item lens-item"
              onClick={() => openDrawer({ type: "lens", lens })}
            >
              <Icon name={lens.icon} />
              <span>{lens.label}</span>
              <small>↗</small>
            </button>
          ))}
        </nav>
        <div className="nav-foot">
          <span className="live-indicator" />
          <div>
            <strong>Production connected</strong>
            <small>mock data · updated 8s</small>
          </div>
        </div>
      </aside>

      <main className="main-shell">
        <header className="top-bar">
          <div className="scope-bar">
            <span className="scope-chip strong">{state.scope.environment}</span>
            <span className="scope-chip">{state.scope.business}</span>
            <span className="scope-chip">{state.scope.service}</span>
            <span className="scope-chip">
              {state.scope.regions.join(" + ")}
            </span>
            <span className="scope-chip">{state.scope.timeRange}</span>
            <span className="scope-chip locked">
              锁定 {state.scope.changeId}
            </span>
          </div>
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
            <button
              type="button"
              className="hil-button"
              onClick={() => dispatch({ type: "NAVIGATE", screen: "live" })}
            >
              3 decisions
            </button>
          </div>
        </header>

        <div className="screen-wrap">
          <Screen />
        </div>
      </main>

      <div
        className={drawer ? "drawer-backdrop open" : "drawer-backdrop"}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <aside
        className={drawer ? "drawer open" : "drawer"}
        aria-label="详情抽屉"
      >
        {drawer?.type === "lens" && <LensDrawer lens={drawer.lens} />}
        {drawer?.type === "guide" && <UserGuide onClose={closeDrawer} />}
        {drawer?.type === "content" && drawer.content}
      </aside>
    </div>
  );
}
