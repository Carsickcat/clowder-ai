import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTION_STATUSES,
  EVIDENCE_VERDICTS,
  assertCheckContract,
  reconcileChange,
} from "../lib/domain.mjs";
import { scenarios } from "../lib/scenarios.mjs";

test("every committed check is executable, explainable, and source-grounded", () => {
  for (const scenario of scenarios) {
    const sourceIds = new Set(scenario.contextSources.map((source) => source.id));
    for (const check of scenario.committedChecks) {
      assert.equal(assertCheckContract(check, sourceIds), true);
    }
  }
});

test("a formal check rejects missing decision fields and invented sources", () => {
  const check = structuredClone(scenarios[0].committedChecks[0]);
  delete check.failureAction;
  assert.throws(
    () => assertCheckContract(check, new Set(["intent"])),
    /failureAction/,
  );

  assert.throws(
    () =>
      assertCheckContract(
        { ...scenarios[0].committedChecks[0], sourceRefs: ["invented"] },
        new Set(["intent"]),
      ),
    /Unknown sourceRef/,
  );
});

test("observed superset expands the resolved scope instead of silently passing", () => {
  const scenario = scenarios.find((item) => item.id === "change-ticket-risk");
  const result = reconcileChange(
    scenario.declaredChange,
    scenario.observedChange,
  );

  assert.equal(result.status, "Observed-Superset");
  assert.deepEqual(result.addedEntities, ["invoice-worker", "settlement-db"]);
  assert.deepEqual(result.resolvedEntities, [
    "invoice-worker",
    "payment-api",
    "settlement-db",
  ]);
});

test("scenario evidence and action use orthogonal vocabularies", () => {
  assert.deepEqual(EVIDENCE_VERDICTS, [
    "Verified",
    "Violated",
    "Inconclusive",
    "NotEvaluated",
  ]);
  assert.deepEqual(ACTION_STATUSES, [
    "Proceed",
    "Proceed-with-conditions",
    "Pause",
    "Rollback",
  ]);

  for (const scenario of scenarios) {
    assert.ok(EVIDENCE_VERDICTS.includes(scenario.report.evidenceVerdict));
    assert.ok(ACTION_STATUSES.includes(scenario.report.action));
    assert.notEqual(scenario.report.evidenceVerdict, scenario.report.action);
  }
});

test("scenario fixtures are deeply immutable", () => {
  assert.ok(Object.isFrozen(scenarios));
  assert.ok(Object.isFrozen(scenarios[0]));
  assert.ok(Object.isFrozen(scenarios[0].committedChecks));
  assert.ok(Object.isFrozen(scenarios[0].report));
});
