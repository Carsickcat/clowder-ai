import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import { OpsApp } from "../components/OpsApp";

const root = document.getElementById("root");

if (!root) {
  throw new Error("NOVA Ops root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <OpsApp />
  </StrictMode>,
);
