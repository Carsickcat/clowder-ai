---
feature_ids: []
topics: [nova, inspection, observability, mvp]
doc_kind: plan
tips_exempt:
  reason: NOVA inspection is an isolated acceptance prototype outside the product capability catalog.
created: 2026-08-02
updated: 2026-08-02
---

# NOVA change inspection atomic MVP

## Finish line

An SRE can describe a change, review an explainable candidate inspection package, materialize it as an immutable Playbook Revision, create a Case, execute a server-owned read-only stage Run, and read an evidence-grounded assessment from one connected screen.

## Product boundary

This slice extends the connected inspection control plane already present on `feat/aiops-observability-platform-hifi-v3`. It keeps the existing persisted chain:

`InspectionJob -> InspectionJobRevision -> InspectionCase -> InspectionRun -> InspectionReportSnapshot`

and adds one missing upstream durable object:

`InspectionCandidateSet -> InspectionJobRevision`

Stage reports, final A/B reports and assessments are deterministic projections of immutable Runs. They do not duplicate evidence in new mutable stores.

Architecture ownership:

- Cell: `observability / inspection control plane`
- Map delta: update required when this prototype is promoted into the product capability catalog
- Why: the slice adds `InspectionCandidateSet` upstream of the existing Job / Revision / Case / Run chain and adds report and assessment projections without creating a second evidence store

## State census

| Object | Owner | Lifecycle | Persistence | Terminal / immutable rule |
|---|---|---|---|---|
| `InspectionCandidateSet` | user + server generator | generated | SQLite, TTL 0 | immutable after generation |
| `InspectionJob` | user | active -> archived | SQLite, TTL 0 | never deleted |
| `InspectionJobRevision` | user | created per edit | SQLite, TTL 0 | immutable; records candidate origin and waivers |
| `InspectionCase` | user | ready -> running / blocked -> completed | SQLite, TTL 0 | never deleted |
| `InspectionRun` | server executor | running -> completed / failed | SQLite, TTL 0 | terminal Run and evidence immutable |
| `InspectionStageReport` | deterministic projection | derived per Run | reproducible from persisted Run | no independent mutation |
| `InspectionABReport` | deterministic projection | admission baseline vs latest post-change Run | reproducible from persisted Runs | query/source mismatch fails comparability closed |
| `InspectionAssessment` | deterministic projection | derived from latest Run + candidate origin | reproducible from persisted evidence | never changes evidence or machine verdict |
| `InspectionReportSnapshot` | human accept action | generated once | SQLite, TTL 0 | immutable final snapshot |

## Capability contracts

### 1. Candidate generation

Input: natural-language intent plus confirmed `service`, `environment`, `changeId`, `version`, and `connectorRef`.

Output: an immutable candidate set containing normalized change context, topology snapshot provenance, executable candidates classified as `required / recommended / optional`, reason/evidence references, and explicit coverage omissions.

MVP generator: deterministic server-owned rule and topology catalog. `payments-router` maps to the acceptance replay signals and an intentionally unmapped `connection-pool` dependency so the UI demonstrates honest coverage limits. Unknown services receive generic service checks without invented dependencies.

Failure handling: missing or malformed confirmed fields fail at the API boundary. A missing signal mapping becomes `COVERAGE_OMISSION`, never a fake `UNKNOWN` check and never healthy coverage.

### 2. Orchestration and reuse

Input: candidate set, selected executable candidates, and optional waivers.

Output: a persisted Job and immutable Revision bound to the candidate set.

Invariant: omitting a required candidate requires a non-empty waiver reason. The server revalidates selection; the browser cannot downgrade priorities or submit arbitrary evidence.

### 3. Stage execution and evidence

Input: Case, stage purpose (`admission / canary / verification / post_change`), and idempotency key.

Output: existing server-owned Run evidence and verdict (`passed / risk / unknown`).

Invariant: NOVA observes external rollout stages but never changes rollout, release, or rollback state.

### 4. Stage report

Input: persisted Run and bound Revision.

Output: stage, machine verdict, evidence quality, result counts, source provenance, and per-check facts. The projection is included in the Case workspace.

### 5. Assessment and interpretation

Input: latest immutable Run plus candidate coverage provenance.

Output: separate machine verdict, coverage state, decision readiness, confirmed facts, hypotheses, unknowns, and recommended next verification. Every statement carries evidence references.

Invariant: deterministic rules own the verdict. Interpretation never averages away a failing or unknown required check and never converts a coverage omission into a machine result.

### 6. Final A/B report

Input: the first admission Run and latest post-change Run bound to the same Case and immutable Revision.

Output: per-check before/after values, absolute and relative deltas, evidence references, and an explicit `valid / partial / unavailable` comparability state.

Invariant: source mismatch, query-digest drift, missing results or unusable evidence cannot produce a comparable delta. An unavailable or partial A/B blocks post-change decision readiness without rewriting either Run's machine verdict.

## UX state matrix

| State | Visible contract | Available action |
|---|---|---|
| loading | connected control plane loading | none |
| empty | intent composer + confirmed fields | generate candidate set |
| draft | candidate priorities, reasons, topology, omissions | select and materialize revision |
| ready | Case and stage rail | run admission/canary/verification/post-change |
| running | server-owned execution indicator | wait; duplicate command idempotent |
| risk | failing evidence + grounded hypothesis | pause/verify; no accept |
| unknown | missing/stale/source failure reason | repair evidence; no accept |
| passed with omission | in-scope pass + unclosed coverage risk | human review; accept remains explicit |
| completed | immutable final report | reopen evidence only |

Desktop uses a three-part single screen: journey/context, candidate/revision, and evidence/assessment. At narrow widths the same semantic order becomes a vertical flow without hiding provenance.

## Delivery steps

1. Add red contract tests for the candidate generator, V12 persistence, required-candidate waiver, stage reports, assessment separation, API routes, client methods, and connected page journey.
2. Extend shared contracts with candidate, coverage, provenance, stage-report, and assessment types while keeping current fields backward compatible.
3. Add schema V12 and immutable candidate-set / revision-origin persistence.
4. Implement deterministic candidate generation and server-side materialization in `InspectionService`.
5. Project stage reports, a fail-closed admission/post-change A/B report and grounded assessment into `InspectionWorkspace`.
6. Add bounded generation/materialization routes and Web API methods.
7. Recompose the existing inspection page around intent -> candidate package -> revision -> Case -> Run -> assessment while preserving manual job compatibility through existing endpoints.
8. Run targeted tests, package builds, repository checks, and isolated browser acceptance at ports 5172/3172/6328.

## Explicitly not building

- No production telemetry or production data boundary.
- No rollout, deployment, gray-release, rollback, or approval execution.
- No free-form workflow DAG.
- No external knowledge-graph, change-ticket, or LLM dependency in the runnable MVP.
- No browser-authored observations, verdicts, evidence timestamps, or source identities.
- No single blended score that can hide a failing check or missing evidence.
- No claim that the MVP's deterministic interpretation is a deployed generative model; it is a stable evidence contract independent of model availability.
