# F010 PWA install provider SSR failure

## 1. Reporter and discovery

宪宪 discovered the defect during the F010 production browser quality gate on 2026-07-17. A 390×844 Chrome run rendered `/settings`, while the foreground Next server logged `ReferenceError: window is not defined`.

## 2. Reproduction

Expected: a production request to `/settings` renders without server exceptions, then hydrates browser-specific install facts on the client.

Actual before the fix:

1. Build `packages/web` and start `next start -p 4310`.
2. Request `/settings` with a real browser.
3. The response can recover on the client, but the server logs digest `2798101465` with `window is not defined`.

Runtime preflight bound the reproduction to PID 37432 on port 4310, started after commit `7e03d82`. The foreground log produced the same stack twice.

## 3. Root cause

`PwaInstallExperienceProvider` called `readFacts()` unconditionally during render. `readFacts()` immediately read `window.navigator.userAgent`, so any server render entered a browser-only boundary. A simple `typeof window` fallback alone would still allow server and first client render to disagree, creating hydration drift.

Unrelated `window` references in F010 hooks were excluded because they execute inside effects or user callbacks.

## 4. Fix

Commit `0f198d8` introduces a deterministic blocked server snapshot. The provider keeps this snapshot through the hydration first frame and flips `environmentReady` in `useEffect`; only subsequent client renders read live browser facts.

This preserves accurate install diagnostics after mount without executing browser APIs on the server or producing divergent initial markup.

## 5. Verification

- A Node-environment SSR regression failed before the fix at `readFacts:42` and passes afterward.
- Install provider, install prompt, and update-controller focused tests pass (12/12).
- The complete F010 affected suite passes (19 files, 359 tests).
- ESLint, TypeScript, Biome (affected files), and the post-fix Web production build pass.
- Post-fix Chrome reports `pageErrors=[]`; the stopped foreground server log contains only startup readiness and no SSR exception.

[宪宪/gpt-5.6-sol🐾]
