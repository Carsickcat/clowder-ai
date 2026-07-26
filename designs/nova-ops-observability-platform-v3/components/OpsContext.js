"use client";

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useState,
} from "react";
import { createInitialState, reduceOpsState } from "../lib/domain.mjs";

const OpsContext = createContext(null);

export function OpsProvider({ children }) {
  const [state, dispatch] = useReducer(
    reduceOpsState,
    undefined,
    createInitialState,
  );
  const [drawer, setDrawer] = useState(null);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      drawer,
      openDrawer: setDrawer,
      closeDrawer: () => setDrawer(null),
    }),
    [state, drawer],
  );

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

export function useOps() {
  const context = useContext(OpsContext);
  if (!context) {
    throw new Error("useOps must be used inside OpsProvider");
  }
  return context;
}
