# NOVA Standalone Job Platform Review — Bug Report

Reporter: 山本 (`@opus`), independent review of fixed SHA `afd329f`.

## Bug diagnosis capsule

| Field                          | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Symptom**                 | Repeating the same saved job produces intersecting Case/Run/Finding/Decision/Report IDs. A clean Windows checkout cannot reproduce the declared `npm test` and `npm run check` gates or the checked-in standalone artifact.                                                                                                                                                                                                                                                                                                                                                                   |
| **2. Evidence**                | Reviewer reproduction on detached SHA `afd329f`; local source inspection of `change-inspection-jobs.mjs`, `change-inspection.mjs`, `build-standalone.mjs`, `standalone-html.test.mjs`, and `package.json`; Git uses `core.autocrlf=true`; `static-dist/` is ignored.                                                                                                                                                                                                                                                                                                                          |
| **3. Confirmed root causes**   | Job loading assigns a template-derived static Case ID while all evidence IDs restart from local collection length. The standalone equality test consumes ignored `static-dist/` without a test precondition. The builder preserves source EOL while injecting LF, and the large standalone file is treated as binary by Git, so its committed CRLF is not normalized. Prettier defaults to LF while clean Windows checkout supplies CRLF. The Vite command also inherits ambient `NODE_ENV`, so a development shell produces a different React bundle than the committed production artifact. |
| **4. Diagnostic strategy**     | Trace every Case/evidence ID constructor; add a two-execution set-intersection test. Feed CRLF fixtures through the standalone builder and inspect raw bytes. Treat a clean `npm test` as the build-precondition contract and `npm run check` as the package gate.                                                                                                                                                                                                                                                                                                                            |
| **5. Timeout strategy**        | If one Red→Green cycle does not isolate each failure, stop and compare the reviewer sandbox rather than layering fallbacks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **6. Warning strategy**        | Any reducer-global mutable counter, random value generated inside the reducer, or gate narrowed to hide existing package files means the direction is wrong. Three failed fixes require architecture escalation.                                                                                                                                                                                                                                                                                                                                                                              |
| **7. User-visible correction** | Re-running a saved job remains the same visual journey, but every execution and all of its evidence become independently auditable. The offline HTML remains a single no-network file.                                                                                                                                                                                                                                                                                                                                                                                                        |
| **8. Acceptance**              | Same job twice has disjoint Case/Run/Finding/Decision/Report IDs; CRLF fixture produces LF-only output; clean checkout `npm test` and `npm run check` exit 0; rebuilt standalone is byte-identical; `file://` browser golden path passes.                                                                                                                                                                                                                                                                                                                                                     |

## Root-cause analysis

The three findings are independent failure modes:

1. **Execution identity boundary:** `createCaseFromJob` used `CIC-DEMO-${job.id}`, while
   runs, findings, decisions, and reports used local ordinals or `changeId`. A fresh object
   therefore looked empty but did not have a fresh audit identity.
2. **Build-input boundary:** `tests/standalone-html.test.mjs` used the ignored
   `static-dist/index.html` as an implicit fixture. Clean checkouts did not contain it.
3. **Cross-platform text boundary:** the builder mixed retained CRLF with injected LF, and
   Prettier's LF default disagreed with clean Windows checkout EOLs.
4. **Build-mode boundary:** `vite build` inherited ambient `NODE_ENV`, allowing a clean
   development install to generate a different React bundle from the checked artifact.

## Repair design

- Generate an execution token at the UI/action boundary, not inside the reducer.
- Derive the Case and every evidence ID from that Case ID.
- Make `npm test` build its ignored static fixture through an explicit `pretest`.
- Run the Sites build through one script that fixes production mode before importing Vite.
- Normalize all standalone builder inputs to LF and mark the checked artifact as LF text.
- Let Prettier accept the checkout's existing EOL while continuing to check formatting.

No new Store, queue, backend, or production action is introduced.
