import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activeScenario,
  activeStep,
  createInitialState,
  deriveScenarioStatus,
  MODULE_IDS,
  moduleDataset,
  reduceWorkbench,
  SCENARIO_IDS,
} from '../domain.mjs';

test('the product opens with three role-specific decision journeys', () => {
  const state = createInitialState();

  assert.deepEqual(state.scenarioOrder, SCENARIO_IDS);
  assert.deepEqual(SCENARIO_IDS, ['release', 'incident', 'inspection']);
  assert.equal(new Set(Object.values(state.scenarios).map((item) => item.role)).size, 3);
  assert.equal(state.screen, 'home');
  assert.equal(state.activeScenarioId, null);
});

test('starting and advancing a journey preserves its service and change context', () => {
  let state = createInitialState();
  state = reduceWorkbench(state, { type: 'start_scenario', scenarioId: 'release' });
  const context = structuredClone(activeScenario(state).context);
  const firstStep = activeStep(state);

  state = reduceWorkbench(state, {
    type: 'complete_current_step',
    actionId: firstStep.requiredAction,
  });

  assert.equal(state.screen, 'journey');
  assert.equal(state.activeStepIndex, 1);
  assert.notEqual(activeStep(state).module, firstStep.module);
  assert.deepEqual(activeScenario(state).context, context);
});

test('a journey cannot advance through a fake or unrelated action', () => {
  let state = createInitialState();
  state = reduceWorkbench(state, { type: 'start_scenario', scenarioId: 'incident' });

  const unchanged = reduceWorkbench(state, {
    type: 'complete_current_step',
    actionId: 'toggle-a-css-class',
  });

  assert.equal(unchanged.activeStepIndex, 0);
  assert.deepEqual(unchanged.scenarioProgress.incident.completedStepIds, []);
});

test('the five professional modules expose materially different data contracts', () => {
  const state = createInitialState();
  const release = state.scenarios.release;

  assert.deepEqual(MODULE_IDS, ['metrics', 'alerts', 'logs', 'checks', 'synthetics']);
  assert.ok(moduleDataset(release, 'metrics').slo);
  assert.ok(moduleDataset(release, 'metrics').topology);
  assert.ok(moduleDataset(release, 'alerts').clusters);
  assert.ok(moduleDataset(release, 'alerts').routes);
  assert.ok(moduleDataset(release, 'logs').patterns);
  assert.ok(moduleDataset(release, 'logs').facets);
  assert.ok(moduleDataset(release, 'checks').definitions);
  assert.ok(moduleDataset(release, 'checks').runs);
  assert.ok(moduleDataset(release, 'synthetics').journey);
  assert.ok(moduleDataset(release, 'synthetics').regions);

  const contractKeys = MODULE_IDS.map((module) => Object.keys(moduleDataset(release, module)).sort().join('|'));
  assert.equal(new Set(contractKeys).size, MODULE_IDS.length);
});

test('AI insights are reviewable artifacts, not one opaque answer', () => {
  let state = createInitialState();
  state = reduceWorkbench(state, { type: 'start_scenario', scenarioId: 'release' });
  const insight = activeScenario(state).ai.hypotheses[0];

  state = reduceWorkbench(state, { type: 'review_ai', insightId: insight.id, verdict: 'accepted' });

  assert.deepEqual(state.scenarioProgress.release.aiVerdicts[insight.id], 'accepted');
  assert.ok(insight.sourceIds.length > 0);
  assert.ok(activeScenario(state).ai.facts.every((item) => item.sourceIds.length > 0));
  assert.ok(activeScenario(state).ai.gaps.every((item) => item.verifyAction));
});

test('release journey ends with a human decision and measurable workflow value', () => {
  let state = createInitialState();
  state = reduceWorkbench(state, { type: 'start_scenario', scenarioId: 'release' });

  for (const step of activeScenario(state).steps) {
    state = reduceWorkbench(state, { type: 'complete_current_step', actionId: step.requiredAction });
  }
  state = reduceWorkbench(state, { type: 'choose_decision', decisionId: 'pause_release' });
  state = reduceWorkbench(state, { type: 'complete_journey' });

  const progress = state.scenarioProgress.release;
  assert.equal(progress.status, 'completed');
  assert.equal(progress.outcome.decision, 'pause_release');
  assert.ok(progress.outcome.evidencePackage.length >= 4);
  assert.ok(progress.outcome.value.manualJumpsAvoided > 0);
  assert.match(progress.outcome.value.timeToConclusion, /min/);
});

test('incident and inspection journeys produce different terminal artifacts', () => {
  let incident = createInitialState();
  incident = reduceWorkbench(incident, { type: 'start_scenario', scenarioId: 'incident' });
  for (const step of activeScenario(incident).steps) {
    incident = reduceWorkbench(incident, { type: 'complete_current_step', actionId: step.requiredAction });
  }
  incident = reduceWorkbench(incident, { type: 'choose_decision', decisionId: 'run_controlled_playbook' });
  incident = reduceWorkbench(incident, { type: 'complete_journey' });

  let inspection = createInitialState();
  inspection = reduceWorkbench(inspection, { type: 'start_scenario', scenarioId: 'inspection' });
  for (const step of activeScenario(inspection).steps) {
    inspection = reduceWorkbench(inspection, { type: 'complete_current_step', actionId: step.requiredAction });
  }
  inspection = reduceWorkbench(inspection, { type: 'choose_decision', decisionId: 'publish_with_unknown' });
  inspection = reduceWorkbench(inspection, { type: 'complete_journey' });

  assert.equal(incident.scenarioProgress.incident.outcome.artifactType, 'incident_handoff');
  assert.equal(inspection.scenarioProgress.inspection.outcome.artifactType, 'governance_report');
});

test('unknown coverage blocks a healthy or verified inspection conclusion', () => {
  let state = createInitialState();
  state = reduceWorkbench(state, { type: 'start_scenario', scenarioId: 'inspection' });
  for (const step of activeScenario(state).steps) {
    state = reduceWorkbench(state, { type: 'complete_current_step', actionId: step.requiredAction });
  }
  state = reduceWorkbench(state, { type: 'choose_decision', decisionId: 'mark_healthy' });
  state = reduceWorkbench(state, { type: 'complete_journey' });

  assert.equal(deriveScenarioStatus(state, 'inspection'), 'blocked');
  assert.equal(state.scenarioProgress.inspection.outcome, null);
  assert.match(state.scenarioProgress.inspection.blockReason, /unknown|覆盖/);

  state = reduceWorkbench(state, { type: 'choose_decision', decisionId: 'publish_with_unknown' });
  assert.equal(deriveScenarioStatus(state, 'inspection'), 'active');
  assert.equal(state.scenarioProgress.inspection.blockReason, null);
  state = reduceWorkbench(state, { type: 'complete_journey' });
  assert.equal(deriveScenarioStatus(state, 'inspection'), 'completed');
  assert.equal(state.scenarioProgress.inspection.outcome.healthState, 'unknown');
});

test('coverage, freshness, and baseline gates all prevent a positive health projection', () => {
  const gateCases = [
    {
      gates: { coverageState: 'unknown', freshnessState: 'fresh', baselineState: 'comparable' },
      reason: /覆盖/,
    },
    {
      gates: { coverageState: 'complete', freshnessState: 'stale', baselineState: 'comparable' },
      reason: /过期/,
    },
    {
      gates: { coverageState: 'complete', freshnessState: 'fresh', baselineState: 'drifted' },
      reason: /基线/,
    },
  ];

  for (const { gates, reason } of gateCases) {
    let state = createInitialState();
    state = {
      ...state,
      scenarios: {
        ...state.scenarios,
        inspection: { ...state.scenarios.inspection, riskGates: gates },
      },
    };
    state = reduceWorkbench(state, { type: 'start_scenario', scenarioId: 'inspection' });
    for (const step of activeScenario(state).steps) {
      state = reduceWorkbench(state, { type: 'complete_current_step', actionId: step.requiredAction });
    }

    state = reduceWorkbench(state, { type: 'choose_decision', decisionId: 'mark_healthy' });
    state = reduceWorkbench(state, { type: 'complete_journey' });
    assert.equal(state.scenarioProgress.inspection.status, 'blocked');
    assert.match(state.scenarioProgress.inspection.blockReason, reason);

    state = reduceWorkbench(state, { type: 'choose_decision', decisionId: 'publish_with_unknown' });
    state = reduceWorkbench(state, { type: 'complete_journey' });
    assert.equal(state.scenarioProgress.inspection.status, 'completed');
    assert.equal(state.scenarioProgress.inspection.outcome.healthState, 'unknown');
  }
});

test('module deep links preserve the active scenario instead of resetting the journey', () => {
  let state = createInitialState();
  state = reduceWorkbench(state, { type: 'start_scenario', scenarioId: 'release' });
  const context = structuredClone(activeScenario(state).context);

  state = reduceWorkbench(state, { type: 'open_module', module: 'logs' });

  assert.equal(state.activeModule, 'logs');
  assert.equal(state.screen, 'module');
  assert.equal(state.activeScenarioId, 'release');
  assert.deepEqual(activeScenario(state).context, context);
});

test('professional module interactions persist their selected artifact in journey state', () => {
  let state = createInitialState();
  state = reduceWorkbench(state, { type: 'start_scenario', scenarioId: 'release' });
  const context = structuredClone(activeScenario(state).context);

  state = reduceWorkbench(state, {
    type: 'focus_module_item',
    module: 'logs',
    artifactId: 'LOG-CONFIG-120-40',
  });

  assert.equal(state.scenarioProgress.release.moduleSelections.logs, 'LOG-CONFIG-120-40');
  assert.deepEqual(activeScenario(state).context, context);
});

test('log query and sample pinning are reducer-backed and contribute verifiable evidence', () => {
  let state = createInitialState();
  state = reduceWorkbench(state, { type: 'start_scenario', scenarioId: 'release' });
  state = reduceWorkbench(state, { type: 'run_log_query' });

  assert.equal(state.scenarioProgress.release.moduleOperations.logs.queryStatus, 'completed');
  assert.equal(
    state.scenarioProgress.release.moduleOperations.logs.executedQuery,
    state.scenarios.release.datasets.logs.query,
  );

  state = reduceWorkbench(state, {
    type: 'pin_log_sample',
    sampleId: 'LOG-SAMPLE-RELEASE-TIMEOUT',
  });

  assert.deepEqual(state.scenarioProgress.release.moduleOperations.logs.pinnedSampleIds, [
    'LOG-SAMPLE-RELEASE-TIMEOUT',
  ]);
  assert.ok(state.scenarioProgress.release.evidencePackage.includes('LOG-SAMPLE-RELEASE-TIMEOUT'));

  const duplicate = reduceWorkbench(state, {
    type: 'pin_log_sample',
    sampleId: 'LOG-SAMPLE-RELEASE-TIMEOUT',
  });
  assert.deepEqual(duplicate.scenarioProgress.release.moduleOperations.logs.pinnedSampleIds, [
    'LOG-SAMPLE-RELEASE-TIMEOUT',
  ]);
});
