# NOVA Ops Standalone HTML — Formal Review Request

Review-Target-ID: `feat-aiops-observability-platform-hifi-v3`  
Branch: `feat/aiops-observability-platform-hifi-v3`  
Target commit: `b8d8b55a7cdb5773b00715e011aba71ad2522f13`  
Base commit: `d4b1c06102257c8534036dc8208d0d1325d9aff5`

## What

Package the already reviewed NOVA change-inspection experience as one production-built
HTML file:

`designs/nova-ops-observability-platform-v3/NOVA-Ops-Intelligence-Standalone.html`

The file contains the current CSS, JavaScript, and fixed demonstration data. It opens
directly from `file://` on another computer without Node.js, a local process, a backend,
or network access.

## Original Requirements

Sources:

- Direct operator request in thread `thread_mrogfco44bos1sgn`, 2026-07-30:
  “我想在另外一台电脑上仅看html就行，数据你可以直接给我mock，我也不需要做二次开发，你直接给我生成一个html吧”
- Correction in the same thread:
  “我要的是运维系统的html……我另外一台设备是电脑打开做演示这套系统能力”
- Product coordinate:
  `project-research/2026-07-23-aiops-observability-agents/prompt.md`
- Product synthesis:
  `project-research/2026-07-23-aiops-observability-agents/opus-synthesis.md`

Operator experience to judge:

1. The downloaded object is the NOVA operations system, not Cat Café/F010.
2. The operator can copy it to a second computer and open it by double-clicking.
3. No repository clone, dependency install, port, process, login, or backend is needed.
4. The UI is interactive rather than a screenshot: an SRE can describe a service change,
   generate an inspection plan, pass admission, encounter canary risk, remediate, reverify,
   continue rollout, and inspect the final report.
5. All data is explicitly demonstration data and no action can reach production.
6. `unknown`, stale, and incomparable evidence remain blockers rather than being shown as
   healthy.

## Why

The reviewed product source already satisfies the operations journey. This delta changes
only its delivery form, so the artifact is generated from the production Vite output
rather than reimplementing or redesigning the UI.

## Architecture Ownership

Architecture cell: design artifact distribution  
Map delta: none  
Why: this adds a deterministic compiler from the existing static distribution to one
portable HTML file. It adds no Store, Queue, Router, Adapter, Dispatcher, Binding, runtime
API, or production data boundary.

## Scope

Six files in `d4b1c06..b8d8b55`:

- generated standalone HTML artifact;
- deterministic builder;
- static contract and hostile-input tests;
- real `file://` Chrome acceptance;
- package scripts and download instructions.

Existing modified evidence PNGs and untracked reviewer artifacts in this shared worktree
are unrelated and excluded from the commit.

## Fresh-Context Findings

Finding-generator scan produced three P2 findings; all were closed before the target
commit:

- FC-1: mixed-case `</script>` / `</style>` raw-text terminators now use
  case-insensitive escaping with adversarial fixtures.
- FC-2: `npm run check` now rebuilds the production static source, verifies the checked-in
  HTML is byte-identical, and opens that checked-in file in Chrome.
- FC-3: external origins, encoded traversal, and malformed asset references now have
  rejection regressions.

Fresh-context output was finding-only, not an approval verdict.

## Quality Gate

- `NODE_ENV=production npm run check`:
  - formatting clean;
  - production Vite build passed;
  - 46/46 tests passed;
  - checked artifact equals a fresh build byte-for-byte;
  - standalone Chrome acceptance passed with network requests 0 and console errors 0.
- Full golden path against the standalone `file://` URL passed:
  Chinese and custom-service journeys, clarification and unknown blockers, pre-change
  admission, canary verification, post-change report, desktop/720/mobile, console 0.
- `git diff --check d4b1c06..b8d8b55`: clean.
- Artifact size: 308,069 bytes.
- Artifact SHA-256:
  `76B7633CE552187CA2E17B73585C38CD427DD117FBFD685744347526A4E3B73E`.
- Root media hygiene: no root-level media/design artifacts.
- Matching `.pen`: none.
- Capability tips exemption: this is a portable design artifact distribution, not a new
  Clowder runtime capability or guide.

### Dogfood-Your-Slice

Scope verdict: required and completed.

Actual path:

`file:///.../NOVA-Ops-Intelligence-Standalone.html`
→ enter `请检查 inventory-service v2.4 是否可以灰度`
→ generate plan
→ complete the existing change-inspection golden path.

Fresh screenshots from the final file are in the local temporary evidence directory:

- `nova-ops-browser-evidence/01-change-inspection-request-desktop.png`
- `nova-ops-browser-evidence/05-change-inspection-report-desktop.png`

## Review Focus

Please independently verify:

1. the builder cannot inline external or path-escaping assets;
2. HTML raw-text terminators and replacement-template characters cannot corrupt the file;
3. the checked artifact is provably generated from current reviewed source;
4. opening the committed HTML by `file://` makes no HTTP(S) request and has no console
   error;
5. the visible system and full interaction are the NOVA operations journey requested by
   the operator, with persistent demonstration-data disclosure.

## Tradeoffs

- The artifact is intentionally generated and committed so a non-developer can download
  one file from GitHub.
- The builder requires exactly one JavaScript and one stylesheet asset from the current
  Vite output. A future code split must deliberately extend the builder and tests instead
  of silently producing a partial demo.
- The HTML contains fixed mock data and is not a deployable live operations backend.

## Open Questions

Technical: none.  
Value decisions: none.

## Requested Verdict

Please return `APPROVE` or `REQUEST_CHANGES` for target commit `b8d8b55`, with explicit
P1/P2/P3 counts and independent verification evidence.

[丢丢/gpt-5.6-sol🐾]
