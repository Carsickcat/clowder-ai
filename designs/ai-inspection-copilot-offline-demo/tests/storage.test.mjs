import assert from 'node:assert/strict';
import test from 'node:test';

import { compileInspectionRequest } from '../lib/compiler.mjs';
import {
  createContextOptions,
  createEmptyInspectionLibrary,
  createInspectionRun,
  createSavedInspectionDefinition,
} from '../lib/saved-inspections.mjs';
import { createInspectionLibraryStorage, INSPECTION_LIBRARY_STORAGE_KEY } from '../src/storage.mjs';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    read(key) {
      return values.get(key);
    },
  };
}

const request = { prompt: '巡检 fulfillment-service', targetService: 'fulfillment-service' };

function recordFixtures({
  definitionId = 'SAVED-001',
  runId = 'RUN-0048',
  name = '履约巡检',
  updatedAt = '2026-08-16T06:00:00.000Z',
} = {}) {
  const workspace = compileInspectionRequest(request);
  const taskInstance = {
    id: `INS-${runId}`,
    status: 'locked',
    inspectionPlan: {
      source: 'generated',
      sourcePlaybookRef: null,
      checkIds: workspace.committedChecks.map((check) => check.id),
      checks: structuredClone(workspace.committedChecks),
    },
    auditTrail: [{ type: 'task-locked' }],
  };
  const selectedContext = createContextOptions(workspace);
  return {
    definition: createSavedInspectionDefinition({
      id: definitionId,
      name,
      request,
      workspace,
      selectedContext,
      taskInstance,
      sourceRunId: runId,
      now: updatedAt,
    }),
    run: createInspectionRun({
      id: runId,
      definitionId,
      taskInstance,
      selectedContext,
      executionResults: workspace.execution,
      report: workspace.report,
      startedAt: updatedAt,
      completedAt: updatedAt,
    }),
  };
}

test('storage adapter hydrates a valid versioned library and treats corrupt data as empty', () => {
  const fixtures = recordFixtures();
  const valid = JSON.stringify({
    schemaVersion: 1,
    revision: 3,
    savedInspections: [fixtures.definition],
    runs: [fixtures.run],
  });
  assert.equal(
    createInspectionLibraryStorage(memoryStorage({ [INSPECTION_LIBRARY_STORAGE_KEY]: valid })).load().revision,
    3,
  );
  assert.deepEqual(
    createInspectionLibraryStorage(memoryStorage({ [INSPECTION_LIBRARY_STORAGE_KEY]: '{broken' })).load(),
    createEmptyInspectionLibrary(),
  );
});

test('storage adapter preserves valid definitions when one history record is corrupt', () => {
  const fixtures = recordFixtures();
  const serialized = JSON.stringify({
    schemaVersion: 1,
    revision: 4,
    savedInspections: [fixtures.definition],
    runs: [fixtures.run, { id: 'half-run' }],
  });
  const adapter = createInspectionLibraryStorage(memoryStorage({ [INSPECTION_LIBRARY_STORAGE_KEY]: serialized }));

  const hydrated = adapter.loadWithDiagnostics();
  assert.equal(hydrated.diagnostics.status, 'degraded');
  assert.equal(hydrated.diagnostics.rejectedRunCount, 1);
  assert.deepEqual(hydrated.library.savedInspections, [fixtures.definition]);
  assert.deepEqual(hydrated.library.runs, [fixtures.run]);
  assert.deepEqual(adapter.load(), hydrated.library);
});

test('storage adapter persists the normalized envelope under one stable key', () => {
  const storage = memoryStorage();
  const adapter = createInspectionLibraryStorage(storage);
  const library = { schemaVersion: 1, revision: 2, savedInspections: [], runs: [] };

  assert.deepEqual(adapter.save(library), { ok: true });
  assert.deepEqual(JSON.parse(storage.read(INSPECTION_LIBRARY_STORAGE_KEY)), library);
});

test('storage adapter reports unavailable and quota failures without throwing', () => {
  assert.deepEqual(createInspectionLibraryStorage(null).save(createEmptyInspectionLibrary()), {
    ok: false,
    reason: 'storage-unavailable',
  });
  const failing = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('quota');
    },
  };
  assert.deepEqual(createInspectionLibraryStorage(failing).load(), createEmptyInspectionLibrary());
  assert.deepEqual(createInspectionLibraryStorage(failing).save(createEmptyInspectionLibrary()), {
    ok: false,
    reason: 'storage-write-failed',
  });
});

test('storage event payload merges with the current library instead of replacing runs', () => {
  const adapter = createInspectionLibraryStorage(memoryStorage());
  const left = recordFixtures({ definitionId: 'SAVED-A', runId: 'RUN-A', name: 'A' });
  const right = recordFixtures({
    definitionId: 'SAVED-B',
    runId: 'RUN-B',
    name: 'B',
    updatedAt: '2026-08-16T06:05:00.000Z',
  });
  const current = {
    schemaVersion: 1,
    revision: 2,
    savedInspections: [left.definition],
    runs: [left.run],
  };
  const incoming = JSON.stringify({
    schemaVersion: 1,
    revision: 4,
    savedInspections: [right.definition],
    runs: [right.run],
  });

  const merged = adapter.merge(current, incoming);
  assert.deepEqual(merged.diagnostics, { status: 'available', rejectedRunCount: 0 });
  assert.deepEqual(merged.library.savedInspections.map((item) => item.id).sort(), ['SAVED-A', 'SAVED-B']);
  assert.deepEqual(merged.library.runs.map((item) => item.id).sort(), ['RUN-A', 'RUN-B']);
  assert.equal(merged.library.revision, 5);

  const idempotent = adapter.merge(merged.library, JSON.stringify(merged.library));
  assert.deepEqual(idempotent.library, merged.library);
  assert.deepEqual(idempotent.diagnostics, { status: 'available', rejectedRunCount: 0 });
});

test('storage event merge quarantines a malformed report and preserves its diagnostics', () => {
  const adapter = createInspectionLibraryStorage(memoryStorage());
  const left = recordFixtures({ definitionId: 'SAVED-A', runId: 'RUN-A', name: 'A' });
  const right = recordFixtures({
    definitionId: 'SAVED-B',
    runId: 'RUN-B',
    name: 'B',
    updatedAt: '2026-08-16T06:05:00.000Z',
  });
  const current = {
    schemaVersion: 1,
    revision: 2,
    savedInspections: [left.definition],
    runs: [left.run],
  };
  const incoming = JSON.stringify({
    schemaVersion: 1,
    revision: 4,
    savedInspections: [right.definition],
    runs: [{ ...right.run, report: {} }],
  });

  const merged = adapter.merge(current, incoming);
  assert.deepEqual(merged.diagnostics, { status: 'degraded', rejectedRunCount: 1 });
  assert.deepEqual(merged.library.savedInspections.map((item) => item.id).sort(), ['SAVED-A', 'SAVED-B']);
  assert.deepEqual(
    merged.library.runs.map((item) => item.id),
    ['RUN-A'],
  );
});
