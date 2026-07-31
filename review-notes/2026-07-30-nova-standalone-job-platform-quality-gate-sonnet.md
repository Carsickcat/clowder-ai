# NOVA Standalone Job Platform — Quality Gate

**Author:** 丢丢 / `gpt-5.6-sol`  
**Date:** 2026-07-30  
**Spec:** `feature-specs/2026-07-30-nova-change-inspection-journey.md`  
**Plan:** `feature-specs/2026-07-30-nova-standalone-job-platform-implementation-plan.md`  
**Original request:** external-system leader demo needs one minimal HTML with Mock data and a reusable job platform so common inspections do not start from a blank prompt every time.

## Verdict

**Scoped product gate: PASS.** The standalone NOVA artifact now includes a reusable job platform and completes the reviewed change-inspection journey through the same reducer. No P1/P2 remains in the authored scope.

Repository-wide `pnpm check` is not usable as a clean baseline in this worktree: it reports 2,427 pre-existing Biome formatting diagnostics across repository CRLF files, beginning with `.dir-exceptions.json`, `.sync-provenance.json`, `biome.json`, and workspace `package.json` files. None is in this task's owned delta. The prototype package's canonical `npm run check` is green.

## Vision Coverage

| #   | Operator need                               | AC                  | Result                                                                   |
| --- | ------------------------------------------- | ------------------- | ------------------------------------------------------------------------ |
| 1   | “生成一个最小的 html，在外部系统给领导演示” | AC-J7 / AC-20       | ✅ One 314,842-byte offline HTML; `file://`, network 0                   |
| 2   | “数据可以 mock，可演示基础流程”             | AC-J6 / AC-19       | ✅ Admission → canary risk → remediation → verification → 100% → report  |
| 3   | “不要每次巡检都重新问”                      | AC-J1 / AC-16       | ✅ Three saved inspection jobs visible on entry                          |
| 4   | “历史任务固化后直接使用”                    | AC-J2 / AC-J17      | ✅ Selecting a job loads a reviewable plan                               |
| 5   | Reuse must not compromise evidence truth    | AC-J3/J4 / AC-17/18 | ✅ New Case starts with zero evidence; active Case cannot be overwritten |
| 6   | Add the scenario to product truth           | AC-J1–J8            | ✅ Feature spec, research synthesis, plan, and README updated            |

## Product / Design / Implementation Gates

- **Product placement:** The job platform is a left rail inside the existing journey workspace, not a new top-level product or menu shell.
- **State ownership:** Immutable `InspectionJobTemplate` fixtures only reuse plan definitions. `ChangeInspectionCase` remains the sole execution/evidence owner.
- **Human-in-the-loop:** Selecting a saved job never executes a Run. The first Run still requires “确认方案并执行变更前巡检”.
- **Active-case protection:** Job selection is disabled during `pre-change`, `canary`, and `post-change`.
- **Responsive layout:** 1440 uses three columns; ≤1180 moves jobs to a full-width row; 390 uses jobs → decision → Claw.
- **Implementation size:** All new/modified domain and component files remain at or below the 350-line frontend boundary.
- **Fallback-layer scan:** No fallback chain was added.
- **Architecture ownership:** `Prototype-local frontend projection`; `Map delta: none`; no Store/Queue/Router/Adapter/production boundary added.
- **Capability tips:** Exempt under the parent NOVA prototype spec because this independent artifact is not registered as a Clowder AI Console capability or Guide Catalog item.

## Stateful Object Proof

| Invariant                                             | Proof                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| INV-J1 templates deeply frozen                        | `publishes a deeply immutable library of reusable inspection jobs`        |
| INV-J2 selection creates no evidence                  | `selecting a saved job creates a fresh reviewable case without evidence`  |
| INV-J3 explicit confirmation creates first Run        | Domain test + browser saved-job journey                                   |
| INV-J4 current Case service/version owns all evidence | Existing custom-service truth test + saved-job journey                    |
| INV-J5 active Case cannot be replaced                 | `saved jobs cannot replace an active case but can start after completion` |
| INV-J6 reset removes provenance/evidence              | Same domain test                                                          |
| INV-J7 offline artifact uses no network               | Standalone browser golden path                                            |

## Dogfood-Your-Slice

**Scope verdict:** ✅ Required and completed.

**Worktree / runtime:** `E:\ClowderAI\cat-cafe-aiops-hifi-v3` → `http://localhost:5290/`

**End-to-end path:**

1. Open “作业平台”.
2. Select “库存服务发布巡检”.
3. Verify `inventory-service v2.4`, loaded plan, and zero Runs.
4. Confirm pre-change inspection.
5. Approve 25% canary.
6. Record remediation.
7. Execute verification.
8. Continue to 100%.
9. Execute post-change acceptance.
10. Verify final report `RPT-CHG-23856-V1`.

**Result:** final report rendered; browser console/page errors `[]`.

**Temporary evidence:**

- `%TEMP%\cat-cafe-evidence\nova-job-platform\01-job-platform-selected.png`
- `%TEMP%\cat-cafe-evidence\nova-job-platform\02-job-platform-report.png`
- `%TEMP%\cat-cafe-evidence\nova-job-platform\job-platform-journey.webm`

## Verification Evidence

| Command                                                          | Result                                                                            |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `node --test tests/change-inspection.test.mjs` after RED         | 3 expected failures: missing library/selection                                    |
| `node tests/golden-path.browser.mjs --standalone` before rebuild | Expected RED: “作业平台” absent                                                   |
| `npm test`                                                       | 50/50 pass                                                                        |
| `npm run test:standalone:browser`                                | `file://` launch, full saved-job journey, network 0, console 0                    |
| `BASE_URL=http://localhost:5290 npm run test:browser`            | Desktop/720/390 full journey, console 0                                           |
| `npm run check`                                                  | Exit 0: format, build, 50 tests, standalone browser                               |
| `git diff --check` on owned files                                | Exit 0                                                                            |
| root media hygiene checks                                        | No root-level media/design artifact                                               |
| `.pen` discovery                                                 | No matching `.pen`; implementation follows existing reviewed visual language      |
| repository `pnpm check`                                          | Baseline-blocked by 2,427 unrelated CRLF/Biome diagnostics; recorded for reviewer |

## Artifact

`designs/nova-ops-observability-platform-v3/NOVA-Ops-Intelligence-Standalone.html`

- Size: 314,842 bytes
- Contains all CSS, JavaScript, Mock data, job templates, and interaction state
- Requires no Node.js, server, localhost, or network
- Explicitly states that it uses demonstration data and cannot execute production actions

[丢丢/gpt-5.6-sol🐾]
