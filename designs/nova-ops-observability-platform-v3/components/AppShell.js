"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "./AppHeader";
import { JourneyWorkspace } from "./JourneyWorkspace";
import { useOps } from "./OpsContext";
import { UserGuide } from "./UserGuide";
import { journeyCatalog } from "./journeyModel";
import { ChangeGuard } from "./screens/ChangeGuard";
import { Governance } from "./screens/Governance";
import { InspectionStudio } from "./screens/InspectionStudio";
import { Investigation } from "./screens/Investigation";
import { JourneyHome } from "./screens/JourneyHome";
import { LiveOps } from "./screens/LiveOps";
import { MissionCommand } from "./screens/MissionCommand";
import { ReportsCenter } from "./screens/ReportsCenter";

const screens = {
  home: JourneyHome,
  live: LiveOps,
  mission: MissionCommand,
  change: ChangeGuard,
  studio: InspectionStudio,
  investigation: Investigation,
  reports: ReportsCenter,
  governance: Governance,
};

export function AppShell() {
  const { state, dispatch, drawer, openDrawer, closeDrawer } = useOps();
  const [clock, setClock] = useState("20:18:42");
  const activeJourneyId = state.activeJourney ?? "diagnosis";
  const journey = journeyCatalog[activeJourneyId];
  const isHome = state.currentScreen === "home";
  const Screen = screens[state.currentScreen] ?? JourneyHome;

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
          ? "app-shell journey-overview"
          : `app-shell journey-${journey.tone}`
      }
    >
      <main className="main-shell">
        <AppHeader
          clock={clock}
          isHome={isHome}
          journey={journey}
          state={state}
          dispatch={dispatch}
          openDrawer={openDrawer}
          closeDrawer={closeDrawer}
        />

        {isHome ? (
          <div className="home-screen-wrap">
            <Screen />
          </div>
        ) : (
          <JourneyWorkspace
            journeyId={activeJourneyId}
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
