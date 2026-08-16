import {
  createEmptyInspectionLibrary,
  mergeInspectionLibraries,
  parseInspectionLibrary,
  serializeInspectionLibrary,
} from '../lib/saved-inspections.mjs';

export const INSPECTION_LIBRARY_STORAGE_KEY = 'nova.inspection-library.v1';

export function createInspectionLibraryStorage(storage, key = INSPECTION_LIBRARY_STORAGE_KEY) {
  return {
    load() {
      if (!storage) return createEmptyInspectionLibrary();
      try {
        return parseInspectionLibrary(storage.getItem(key));
      } catch {
        return createEmptyInspectionLibrary();
      }
    },

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
      return mergeInspectionLibraries(current, parseInspectionLibrary(serialized));
    },
  };
}
