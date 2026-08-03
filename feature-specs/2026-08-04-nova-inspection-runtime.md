# NOVA Inspection Runtime — Thread-Scoped Product Increment

**Project truth source:** this document is the single scope anchor for the runtime phase.
**Evolved from:** `feature-specs/2026-08-03-nova-inspection-intelligence-design.md`
**Operator authorization:** thread message `0001785774553420-000133-33be0abf`
**Merged baseline:** `26231439a5a98461ca7c1d301b200e07724f1756`
**Architecture owner:** existing `packages/api/domains/observability` + `packages/web/observability` bounded slice
**Map delta:** none; this increment completes the existing slice and introduces no new ownership cell
**Owner:** Ragdoll / Sonnet
**Status:** complete
**tips_exempt:** This increment upgrades the existing `/observability/inspections` route and its existing navigation entry; it does not add a new launch action or capability-discovery surface. The connected-mode boundary is disclosed in the route banner and the mobile runbook.

## Why

The accepted NOVA workbench proves the interaction model, while the repository already contains a real connected inspection domain: shared inspection types, `InspectionService`, a durable `SqliteInspectionStore`, strict HTTP routes, read-only sources, and a connected web route. The next value is to join those two truths. An SRE must be able to start the local product, create and advance an inspection through connected APIs, refresh or restart without losing it, inspect source provenance, and receive an immutable report reconstructed by the server.

“Real machine” means real process, API, dedicated persistence, recovery, concurrency guards, and provenance. It does **not** mean pretending that local replay data is production telemetry, that a deterministic planner is a live LLM, or that the application can deploy or roll back production.

## Grounded Baseline

- The standalone contract passes 61/61 tests and offline Chrome journeys at 1440, 720, and 390 pixels.
- The connected implementation already persists `CandidateSet`, `Job`, `Revision`, `Case`, `Run`, `DecisionRecord`, and `ReportSnapshot` through `InspectionService` and `SqliteInspectionStore`.
- The connected route already fails closed when its API is unavailable and already prevents the browser from authoring evidence, verdicts, timestamps, and source snapshots.
- The remaining architecture defect is that the inspection store is opened on the memory/scheduler database rather than a dedicated inspection database.
- The remaining experience defect is that the connected workbench does not yet project the accepted four-region information architecture and complete five-dimensional report intelligence.

## Finish Line

One documented local command starts the existing web and API processes on isolated development ports. `/observability/inspections`:

1. loads sources, jobs, cases, and the selected workspace from `/api/observability/*`;
2. generates a candidate set, materializes a revision, and creates a case using server-owned data;
3. advances runs and decisions through idempotent, identity-scoped commands;
4. persists the full inspection lineage in a dedicated SQLite database with TTL `0`;
5. restores the same case after browser refresh and process restart;
6. exposes source kind, replay execution time, original fixture capture time, scope, snapshot hash, and omissions;
7. blocks progression when the API, source, evidence, or A/B basis is unavailable;
8. seals five-dimensional report intelligence from persisted evidence;
9. preserves the accepted left task rail / center decision / right CLAW / bottom execution plan at desktop, 720, and 390 pixels.

## Not Building

- No production Redis, production user data, production telemetry credentials, or production service-catalog access.
- No deployment, canary, rollback, remediation, or acceptance command against infrastructure.
- No second inspection reducer, event-log backend, case store, or client-authored domain truth.
- No new external dependency, hosted service, LLM call, vector store, or graph database.
- No silent fallback from a connected failure to demo data.
- No replacement shell or new top-level navigation family.

## Canonical Runtime Model

The existing server model remains authoritative:

```text
PlanningInput -> CandidateSet -> Job / Revision -> Case
  -> Run / CheckResult / SourceSnapshot
  -> DecisionRecord -> ReportAssessmentBasis -> ReportSnapshot
```

The browser owns only transient connection state, form drafts, selection, and command progress. Task history, current stage, next action, CLAW context, execution rows, and report presentation are pure projections of the server workspace.

## Existing HTTP Contract

| Method | Path family | Purpose |
|---|---|---|
| `GET` | `/api/observability/sources` | server-owned source descriptors and safety scope |
| `GET/POST` | `/api/observability/inspection-candidate-sets` | list, fetch, or generate explainable candidates |
| `POST` | `/api/observability/inspection-candidate-sets/:id/materialize` | create a server-owned job revision from selected candidates |
| `GET/POST` | `/api/observability/inspection-jobs` | durable job history and revision management |
| `GET/POST` | `/api/observability/inspection-cases` | durable case history and creation |
| `GET` | `/api/observability/inspection-cases/:id` | exact current workspace projection |
| `POST` | `/api/observability/inspection-cases/:id/runs` | execute one server-owned read-only inspection run; requires `Idempotency-Key` |
| `POST` | `/api/observability/inspection-cases/:id/decisions` | record an attributable decision |

Unknown methods, malformed payloads, missing identity, unavailable sources, stale revisions, concurrent commands, and forbidden source scopes fail closed with structured errors.

## Stateful Object Census

| Object | Lifecycle owner | Storage / derivation rule |
|---|---|---|
| `CandidateSet` | `InspectionCandidateGenerator` + `InspectionService` | generated server-side and durably persisted |
| `Job` / `Revision` | `InspectionService` | durable immutable lineage; revisions are append-only |
| `Case` | `InspectionService` | durable selected revision and lifecycle anchor |
| `Run` / `CheckResult` / `SourceSnapshot` | source adapter + service | browser cannot author evidence or source metadata |
| `DecisionRecord` | service | attributable, durable, append-only decision truth |
| `ReportAssessmentBasis` | service | frozen from cited runs and decisions |
| `ReportSnapshot` | service + store | immutable verdict and five-dimensional intelligence sealed atomically |
| connected workspace | service | pure projection of the objects above |
| UI selection / connection state | browser | transient only; never a second domain store |

## User Journey

| Step | User action | Visible result | Runtime truth |
|---|---|---|---|
| Entry | Open the route | connection banner resolves, history and selected case load | connected API only; no fixture fallback |
| Plan | Enter service/version intent | three-source rationale, confidence, checks, omissions, and provenance appear | server generates and persists a `CandidateSet` |
| Materialize | Confirm selected checks | revision and case are created | service validates candidate ownership and revision lineage |
| Pre-change | Run the current stage | evidence and stage report appear together | source executes server-side and a durable run is stored |
| Canary | Record the decision and run the next stage | risk, remediation, and next action remain synchronized | decision and run lineage remain attributable |
| Compare | Reach A/B analysis | comparable evidence permits acceptance; incomparable evidence blocks | server computes comparability and readiness |
| Complete | Accept the latest passed basis | report shows score, deductions, residual risk, and citations | report and assessment basis are sealed atomically |
| Explain | Ask CLAW to explain | deterministic explanation cites the same report basis | report bytes and score remain unchanged |
| Recover | Refresh or restart | selected case and report return | dedicated SQLite is the only durable truth |

## Product / Responsive State Matrix

| State | Center decision surface | CLAW | Bottom execution plan | Allowed action |
|---|---|---|---|---|
| loading | “正在连接巡检服务，不会加载演示数据。” | connection progress | disabled placeholders | wait |
| empty | clear first-inspection prompt | intent composer | no execution rows | generate plan |
| partial | source versions plus omissions | corrective input | first blocked row | repair or regenerate |
| blocked | explicit cause and required evidence | explanation only | no executable production action | satisfy evidence requirement |
| running | current server command and prior evidence | API progress | exact active row | wait |
| completed | immutable report and citations | report explanation | all terminal rows | inspect evidence |
| error | “连接中断：无法读取 connected API。已禁止执行，不会回退到演示数据。” | no fabricated response | writes disabled | retry connection |
| 390px | task → detail → CLAW → execution order | composer remains reachable | sticky primary local action; no overflow | full journey |

## Architecture and Safety Gates

- `SqliteInspectionStore` opens a dedicated inspection SQLite file under the configured local data root; it must not use `memoryServices.store.getDb()` or the F153 scheduler database.
- Existing strict routes and `InspectionService` remain the only write path.
- Browser payloads may select intent, candidate ids, decisions, and idempotency keys; they may not author evidence, source snapshots, verdicts, report scores, or timestamps.
- Source adapters are read-only and server-side. The replay source is labeled `DEV LOCAL · fixture-backed sources`; it preserves the fixture's original capture time separately from the current local replay execution time, and report freshness is capped rather than presenting fixed values as live telemetry.
- The local runtime registers only the replay source. The Prometheus adapter remains an independently tested future capability but is not imported or configured by the application startup path; production source scopes and production actions are unavailable by construction.
- The durable store enforces `admission → canary → post_change`, with `verification` permitted only after non-passing canary/verification/post-change evidence. Acceptance requires the latest run to be a completed, passed, comparable `post_change`; idempotent retries remain valid.
- A separate “dry-run” API is intentionally not added: every implemented source is read-only, all state changes are limited to the isolated inspection audit database, and no production command route exists. The UI still requires explicit confirmation and labels the action as a local replay.
- Report intelligence is deterministic, versioned, cited, and stored with the immutable report snapshot.

## In-Context Observability

```yaml
in_context_observability:
  primary_surface: "NOVA top connection banner + center current conclusion + disabled next action"
  why_not_dashboard_only: "The operator must see the failure at the exact decision point; a remote dashboard cannot prevent an unsafe click."
  deep_dive_surface: "Current case source, run, decision, and report evidence details"
  noise_dedup_policy: "Keep one current connection or command error per selected case and replace it on retry."
```

## Invariants

- **INV-1:** one accepted four-region IA renders connected truth; runtime does not create another shell.
- **INV-2:** one user command produces at most one durable mutation; retries with the same idempotency key return the original result.
- **INV-3:** job, revision, case, run, decision, and report lineage remains identity-scoped and immutable.
- **INV-4:** a report reconstructed after restart has the same verdict, score, deductions, evidence basis, and citations.
- **INV-5:** runtime/API/source failures never mutate the case and never switch to demo success.
- **INV-6:** every source, run, decision, deduction, and citation resolves to server-owned provenance.
- **INV-7:** production data and production actions are unavailable in development mode.
- **INV-8:** clients cannot skip a run stage or seal admission, canary, or verification evidence as a final report.
- **INV-8:** concurrent runs or acceptance attempts serialize or fail without duplicate durable truth.
- **INV-9:** desktop, 720px, and 390px show the same selected case and next action.

## Adversarial Verification Matrix

| Scenario | Expected proof |
|---|---|
| process restart after report acceptance | exact workspace and report intelligence return from the dedicated database |
| two tabs start the same run | one durable run; conflicting attempt fails or receives original idempotent result |
| response is lost and command retried | original result returns; durable count is unchanged |
| memory/scheduler database is unavailable | inspection domain remains isolated and testable on its own database |
| source is missing, stale, or production-scoped | run or acceptance blocks; no browser-authored substitute appears |
| API is unreachable | visible connected error; no demo fallback; write actions disabled |
| A/B basis is incomparable | accept/report action remains blocked |
| explanation is requested twice | report bytes, score, and citations remain unchanged |

## Acceptance Criteria

- [x] **AC-1:** the documented development command starts the existing API/web application on isolated ports and opens `/observability/inspections`.
- [x] **AC-2:** inspection objects persist in a dedicated TTL-0 SQLite database and survive browser and process restart.
- [x] **AC-3:** strict identity, schema, idempotency, source-scope, concurrency, and immutable-report guards remain enforced.
- [x] **AC-4:** connected source and run evidence expose kind, replay execution time, original fixture capture time, scope, snapshot hash, and omissions without browser-authored truth.
- [x] **AC-5:** the connected UI covers loading, empty, partial, blocked, running, completed, and error without silent demo fallback.
- [x] **AC-6:** the accepted four-region layout and complete user journey remain usable at 1440, 720, and 390 pixels.
- [x] **AC-7:** five-dimensional report scoring and CLAW explanation are reconstructed from durable evidence and immutable across restart/explanation.
- [x] **AC-8:** the offline standalone remains deterministic, network-free, and explicitly separate from connected mode.
- [x] **AC-9:** focused unit/API/web/browser tests cover the state table, invariants, and adversarial matrix; all existing gates remain green.
- [x] **AC-10a:** Kimi high-fidelity journey gate passed in message `0001785774802914-000134-537e97d5`.
- [x] **AC-10b:** Terra architecture gate passed with hard constraints in message `0001785774803181-000136-dcc162d1`.
- [x] **AC-10c:** independent code review and merged-commit acceptance pass.

## Design-in-Context Evidence

- Existing elements reused: route, API client, service, store, source adapters, source cards, timeline semantics, and report acceptance flow.
- The accepted standalone contributes information architecture and copy hierarchy only; it does not become a second domain implementation.
- The top connection banner replaces the demo badge. No new navigation or permanent dashboard is added.
- At 390px the DOM and visual order are task rail → decision surface → CLAW → execution plan; at 720px the same truth adapts without horizontal overflow.
- The coordinate transform is: authoritative `InspectionWorkspace` → four visual regions. There is no second client store to reconcile.

## User Visibility Disclosure

| Surface | Runtime delivery | Explicit boundary |
|---|---|---|
| task history | durable jobs/cases and selected workspace | local development data only |
| plan generation | API-backed candidates, rationale, confidence, omissions, provenance | deterministic planner; no live LLM/enterprise graph |
| execution | idempotent read-only source runs and attributable decisions | no production infrastructure command |
| report | immutable five-dimensional intelligence and evidence basis | local replay evidence, not production telemetry |
| CLAW | deterministic projection and explanation of server truth | no autonomous action or hidden state |

## Requirement Trace

| Operator requirement | Coverage | Status |
|---|---|---|
| “下个阶段就做真机版本” | AC-1 through AC-9 | complete |
| “拉个分支开发” | isolated `feat/nova-inspection-runtime` worktree from exact `origin/main` | complete |
| “高保真让 kimi 整体再细化一下细节和用户旅程” | state matrix, responsive journey, Kimi gate | complete |
| “方案上和 terra 再 check 下” | canonical model, dedicated DB, server-owned truth | complete |
| “明早起来给我一版可运行的方案” | runnable route, verification, independent review, merged acceptance | complete |

## Verification Evidence

- Merged PR: `#6`; squash commit `3fc82d782add7bf478583bc92c2bb09e0fa8b926`.
- Merged-commit acceptance: isolated detached environment; connected Chrome `empty/partial/completed/error` at `1440/720/390`, unexpected console/network `0/0`, expected fail-closed API errors `3/3`, and process-restart report recovery `true`.
- Runtime: API `3184`, web `3183`, isolated data root `E:\ClowderAI\acceptance-runtime-data\nova-inspection-runtime`.
- Golden connected user: `nova-acceptance-30048-1785777683187`.
- Process-restart recovery: `scripts/nova-connected-runtime-acceptance.mjs --recovery-only` returned `recoveredAfterProcessRestart: true`.
- Browser states: empty, partial, completed, connected error.
- Viewports: 1440, 720, 390; horizontal overflow `0`; mobile region order `1/2/3`.
- Browser runtime: console errors `0`, unexpected failed requests `0`.
- Evidence screenshots: `E:\ClowderAI\acceptance-runtime-data\nova-inspection-runtime\evidence`.
- API observability tests: 73/73.
- Connected page tests: 18/18; full web suite and production build passed.
- Standalone regression: 61/61 plus both offline Chrome journeys, console/network `0/0`.
