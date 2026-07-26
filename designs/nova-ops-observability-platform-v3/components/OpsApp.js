"use client";

import { AppShell } from "./AppShell";
import { OpsProvider } from "./OpsContext";

export function OpsApp() {
  return (
    <OpsProvider>
      <AppShell />
    </OpsProvider>
  );
}
