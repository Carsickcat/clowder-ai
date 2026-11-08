import { describe, expect, it } from 'vitest';
import type { FashionDesignState, GarmentComponentSnapshot } from '@cat-cafe/shared';
import { canConfirmPhoto, confirmationFor, currentVersion, displayError } from '../atelier-model';

describe('Atelier decisions', () => {
  it('never treats the newest candidate as the adopted design', () => {
    const draft = { id: 'draft', createdAt: 1, status: 'draft' };
    const candidate = { id: 'candidate', createdAt: 2, status: 'candidate' };
    const state = { design: { activeVersionId: null }, versions: { draft, candidate } } as unknown as FashionDesignState;
    expect(currentVersion(state)).toBe(draft);
    state.design.activeVersionId = 'candidate'; // An invalid persisted pointer is not a usable base.
    expect(currentVersion(state)).toBe(draft);
  });
  it('requires matching hash and explicit visible photo evidence', () => {
    const part = {
      partId: 'left',
      partHash: 'new',
      confirmationId: 'c',
      visibilityByView: { front: 'visible' },
      evidence: [{ origin: 'photo', view: 'front' }],
    } as unknown as GarmentComponentSnapshot;
    const state = { confirmations: { c: { partId: 'left', partHash: 'old' } } } as unknown as FashionDesignState;
    expect(confirmationFor(state, part)).toBeNull();
    expect(canConfirmPhoto(part)).toBe(true);
    part.evidence.push({ origin: 'user-specified' });
    expect(canConfirmPhoto(part)).toBe(false);
  });
  it('explains stale edits and locked drift without offering unsafe adoption', () => {
    expect(displayError('protected_drift')).toContain('锁定');
    expect(displayError('stale_version')).toContain('更新');
  });
});
