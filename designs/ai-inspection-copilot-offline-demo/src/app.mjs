import { createDemoSession, demoReducer } from "../lib/reducer.mjs";
import { selectViewModel } from "../lib/selectors.mjs";
import { renderApp } from "./render.mjs";

const root = document.querySelector("#app");
let state = createDemoSession();

function render() {
  root.innerHTML = renderApp(selectViewModel(state));
}

function dispatch(action) {
  const next = demoReducer(state, action);
  if (next !== state) {
    state = next;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

root.addEventListener("click", (event) => {
  const scenarioButton = event.target.closest("[data-scenario-id]");
  if (scenarioButton) {
    dispatch({
      type: "SCENARIO_SELECTED",
      scenarioId: scenarioButton.dataset.scenarioId,
    });
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton || actionButton.disabled) return;
  const { action } = actionButton.dataset;
  if (action === "CANDIDATE_DISPOSED") {
    dispatch({
      type: action,
      candidateId: actionButton.dataset.candidateId,
      disposition: actionButton.dataset.disposition,
      reason: actionButton.dataset.reason,
    });
    return;
  }
  dispatch({ type: action });
});

render();
