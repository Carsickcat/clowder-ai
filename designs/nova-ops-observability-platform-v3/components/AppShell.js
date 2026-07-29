"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "./AppHeader";
import { ObjectWorkspace } from "./ObjectWorkspace";
import { useOps } from "./OpsContext";
import { UserGuide } from "./UserGuide";
import { objectCatalog } from "./objectModel";
import { ChangeGuard } from "./screens/ChangeGuard";
import { Governance } from "./screens/Governance";
import { InspectionStudio } from "./screens/InspectionStudio";
import { Investigation } from "./screens/Investigation";
import { LiveOps } from "./screens/LiveOps";
import { MissionCommand } from "./screens/MissionCommand";
import { ReportsCenter } from "./screens/ReportsCenter";
import { SreHome } from "./screens/SreHome";
import { Icon } from "./ui";

const screens = {
  home: SreHome,
  live: LiveOps,
  mission: MissionCommand,
  change: ChangeGuard,
  studio: InspectionStudio,
  investigation: Investigation,
  reports: ReportsCenter,
  governance: Governance,
};

const navItems = [
  { label: "工作台", shortLabel: "SRE", icon: "pulse", screen: "home" },
  {
    label: "Incidents",
    shortLabel: "INC",
    icon: "alert",
    objectType: "incident",
  },
  {
    label: "Changes",
    shortLabel: "CHG",
    icon: "branch",
    objectType: "change",
  },
  {
    label: "Missions",
    shortLabel: "MIS",
    icon: "shield",
    objectType: "mission",
  },
  {
    label: "Inspections",
    shortLabel: "INSP",
    icon: "wand",
    objectType: "inspection",
  },
  { label: "Reports", shortLabel: "RPT", icon: "report", screen: "reports" },
  {
    label: "Governance",
    shortLabel: "GOV",
    icon: "grid",
    screen: "governance",
  },
];

function GlobalNav({ state, dispatch }) {
  return (
    <aside className="sre-global-nav" aria-label="SRE 对象导航">
      <div className="sre-global-nav-label">Operate</div>
      {navItems.map((item) => {
        const definition = item.objectType
          ? objectCatalog[item.objectType]
          : null;
        const active = item.objectType
          ? state.activeObject?.type === item.objectType
          : !state.activeObject && state.currentScreen === item.screen;
        return (
          <button
            type="button"
            className={active ? "active" : ""}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            key={item.label}
            onClick={() =>
              item.objectType
                ? dispatch({
                    type: "OBJECT_OPEN",
                    objectType: item.objectType,
                    objectId: definition.id,
                  })
                : dispatch({ type: "NAVIGATE", screen: item.screen })
            }
          >
            <Icon name={item.icon} />
            <span className="nav-label-full">{item.label}</span>
            <span className="nav-label-compact" aria-hidden="true">
              {item.shortLabel}
            </span>
            {item.objectType && <i>{definition.id.split("-")[1]}</i>}
          </button>
        );
      })}
    </aside>
  );
}

export function AppShell() {
  const { state, dispatch, drawer, openDrawer, closeDrawer } = useOps();
  const [clock, setClock] = useState("20:18:42");
  const isHome = state.currentScreen === "home";
  const activeObjectType = state.activeObject?.type ?? null;
  const activeObject = activeObjectType
    ? objectCatalog[activeObjectType]
    : null;
  const isObjectWorkspace = Boolean(activeObject);
  const Screen = screens[state.currentScreen] ?? SreHome;

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
    <div
      className={
        isHome
          ? "app-shell object-overview"
          : `app-shell ${
              activeObject
                ? `object-${activeObject.tone}`
                : "object-global-view"
            }`
      }
    >
      <GlobalNav state={state} dispatch={dispatch} />
      <main className="main-shell">
        <AppHeader
          clock={clock}
          isHome={isHome}
          object={activeObject}
          state={state}
          dispatch={dispatch}
          openDrawer={openDrawer}
          closeDrawer={closeDrawer}
        />

        {isHome || !isObjectWorkspace ? (
          <div className="home-screen-wrap">
            <Screen />
          </div>
        ) : (
          <ObjectWorkspace
            objectType={activeObjectType}
            state={state}
            dispatch={dispatch}
            Screen={Screen}
          />
        )}
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
        {drawer?.type === "guide" && <UserGuide onClose={closeDrawer} />}
        {drawer?.type === "content" && drawer.content}
      </aside>
    </div>
  );
}
