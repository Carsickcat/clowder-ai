"use client";

import { useReducer } from "react";
import {
  changeInspectionReducer,
  createChangeInspectionState,
} from "../../lib/change-inspection.mjs";
import { ClawPanel } from "./ClawPanel";
import { DecisionSurface } from "./DecisionSurface";
import { JourneyHeader } from "./JourneyHeader";
import { RunTimeline } from "./RunTimeline";

export function ChangeInspectionApp() {
  const [state, dispatch] = useReducer(
    changeInspectionReducer,
    undefined,
    createChangeInspectionState,
  );

  function openReport() {
    document
      .querySelector("[data-testid='final-report']")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handlePrimaryAction(type) {
    if (type === "REPORT_OPENED") {
      openReport();
      return;
    }
    dispatch({ type });
  }

  return (
    <div className="ci-app" data-screen="change-inspection">
      <JourneyHeader state={state} />
      <main className="ci-main">
        <div className="inspection-layout">
          <div className="inspection-decision-column">
            <DecisionSurface state={state} onAction={handlePrimaryAction} />
          </div>
          <div className="inspection-claw-column">
            <ClawPanel dispatch={dispatch} state={state} />
          </div>
        </div>
        <RunTimeline onReportOpen={openReport} state={state} />
      </main>
      <footer className="ci-page-footer">
        <span>NOVA · 变更巡检</span>
        <span>所有数据均为演示，不会触发真实生产动作</span>
      </footer>
    </div>
  );
}
