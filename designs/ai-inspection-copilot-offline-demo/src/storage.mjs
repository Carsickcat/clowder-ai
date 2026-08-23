import {
  createEmptyInspectionLibrary,
  mergeInspectionLibraries,
  parseInspectionLibraryWithDiagnostics,
  serializeInspectionLibrary,
} from '../lib/saved-inspections.mjs';

export const INSPECTION_LIBRARY_STORAGE_KEY = 'nova.inspection-library.v1';

export function createInspectionLibraryStorage(storage, key = INSPECTION_LIBRARY_STORAGE_KEY) {
  function loadWithDiagnostics() {
    if (!storage) {
      return {
        library: createEmptyInspectionLibrary(),
        diagnostics: { status: 'unavailable', rejectedRunCount: 0 },
      };
    }
    try {
      return parseInspectionLibraryWithDiagnostics(storage.getItem(key));
    } catch {
      return {
        library: createEmptyInspectionLibrary(),
        diagnostics: { status: 'unavailable', rejectedRunCount: 0 },
      };
    }
  }

  return {
    load() {
      return loadWithDiagnostics().library;
    },

    loadWithDiagnostics,

    save(library) {
      if (!storage) return { ok: false, reason: 'storage-unavailable' };
      try {
        storage.setItem(key, serializeInspectionLibrary(library));
        return { ok: true };
      } catch {
        return { ok: false, reason: 'storage-write-failed' };
      }
    },

    merge(current, serialized) {
      const incoming = parseInspectionLibraryWithDiagnostics(serialized);
      return {
        library: mergeInspectionLibraries(current, incoming.library),
        diagnostics: incoming.diagnostics,
      };
    },
  };
}
