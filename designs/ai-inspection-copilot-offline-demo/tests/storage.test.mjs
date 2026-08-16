import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyInspectionLibrary } from '../lib/saved-inspections.mjs';
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

test('storage adapter hydrates a valid versioned library and treats corrupt data as empty', () => {
  const valid = JSON.stringify({
    schemaVersion: 1,
    revision: 3,
    savedInspections: [{ id: 'SAVED-001', name: '订单巡检', version: 1, updatedAt: '2026-08-16T06:00:00.000Z' }],
    runs: [],
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
  const current = {
    schemaVersion: 1,
    revision: 2,
    savedInspections: [{ id: 'SAVED-A', version: 1, name: 'A', updatedAt: '2026-08-16T06:00:00.000Z' }],
    runs: [{ id: 'RUN-A', status: 'locked' }],
  };
  const incoming = JSON.stringify({
    schemaVersion: 1,
    revision: 4,
    savedInspections: [{ id: 'SAVED-B', version: 1, name: 'B', updatedAt: '2026-08-16T06:05:00.000Z' }],
    runs: [{ id: 'RUN-B', status: 'locked' }],
  });

  const merged = adapter.merge(current, incoming);
  assert.deepEqual(merged.savedInspections.map((item) => item.id).sort(), ['SAVED-A', 'SAVED-B']);
  assert.deepEqual(merged.runs.map((item) => item.id).sort(), ['RUN-A', 'RUN-B']);
  assert.equal(merged.revision, 5);

  const idempotent = adapter.merge(merged, JSON.stringify(merged));
  assert.deepEqual(idempotent, merged);
});
