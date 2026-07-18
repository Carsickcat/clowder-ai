# Review request: F010 mobile cross-route shell recovery

Review-Target-ID: `f010-mobile-cross-route-shell`

Branch: `feat/f010-mobile-pwa`

Candidate SHA: `bd075e699a0a7a9fd722e555ff97de87ac35087a`

Review range: `b778c0dd12b88762238d509a14a9dc18e54d117b..bd075e699a0a7a9fd722e555ff97de87ac35087a`

Author worktree: `E:\ClowderAI\clowder-ai-f010-local-sandbox`

This branch has no usable remote/PR. Review the committed SHA read-only; do not edit the author worktree, push, merge, or start a reviewer runtime on author ports `4310`/`4311`.

## Original requirement

Co-creator follow-up message `0001784351392147-000475-2d49b6e3` supplied four reporting-iPhone screenshots:

- `packages/api/uploads/1784351392109-2519c1c9.png`
- `packages/api/uploads/1784351392110-213f468b.png`
- `packages/api/uploads/1784351392111-f9fabce5.png`
- `packages/api/uploads/1784351392112-7ff05aa5.png`

The existing-thread composer was better, but a new thread still restored Dock reserve with the Chinese keyboard open; Memory tabs rendered vertically; downward rubber-band scrolling displaced the fixed shell; other global pages also needed a 390px functional audit.

## Five-piece handoff

### What

- Global-page thread selection/creation uses client routing so AppShell and the stable VisualViewport baseline stay mounted.
- AppShell-scoped root scroll lock plus one internal page scroller prevents document rubber-band from displacing the fixed visual frame. Closed-keyboard stale `visualViewport.offsetTop` projects as zero.
- One compact mobile global header replaces page-specific floating triggers.
- Memory, Signals, Settings, Ops, capability scope, and Mission navigation use single-line horizontal rails; Signal content and other global pages stack at compact widths.

### Why

The regressions shared one architectural defect: multiple route lifetimes, scroll owners, and desktop-density navigation projections competed inside one mobile visual frame. Fixing only the picker, Memory CSS, or an initial keyboard threshold would leave the failure family intact.

### Tradeoff

Mobile exposes low-frequency global navigation through horizontal touch rails and one menu action instead of preserving desktop information density. Desktop projections remain behind `md`/`lg`. Root scroll locking is scoped to chromed AppShell routes; chromeless routes keep document scrolling.

### Open

No product decision is open. Safari installed-PWA keyboard and rubber-band acceptance still requires the reporting iPhone; Chrome metrics are structural evidence, not a substitute.

### Next

Return one verdict: `APPROVE` or `REQUEST_CHANGES`. Label every finding P1/P2/P3. Review only; do not push or merge.

## Reviewer focus

1. A global route must enter a fresh thread without `location.assign`, remounting AppShell, or introducing persisted keyboard state.
2. `html/body` lock must be active only for AppShell chrome; chromeless routes must cleanly remove it. Page content must have one viewport-level vertical scroller.
3. Closed-keyboard `visualViewport.offsetTop` must never move the shell, while true keyboard geometry remains projected.
4. Compact tab/category rails must stay one line, preserve every item, and keep desktop layout intact.
5. No new Store/Queue/Router abstraction/Adapter/Dispatcher/Binding or second viewport/safe-area owner may appear.

## Verification evidence

- RED→GREEN contracts cover global→thread routing, stale closed-keyboard offset, root-lock cleanup, compact global header, Memory/Signal/Ops/Scope/Settings rails, Signal stacking, and Mission layout.
- Final focused selection: **47/47**. Earlier broad affected selection: **106/106**.
- Full Web Vitest: **5044/5112 passed**, 68 failures in 15 baseline files, improving from **5042/5111**, 69 failures in 16 files. `global-css-architecture` is newly green; no remaining failed file is modified by this candidate.
- Production Web build: pass, 22 routes, BUILD_ID `3sb-dbE1RU4drK_umxkvl`; isolated 4310 HTTP root embeds the same ID and all rewrites target isolated API 4311.
- 390×844 matrix opened `/`, fresh `/thread/:id`, `/memory`, `/memory/search`, `/settings?s=ops`, `/signals`, `/signals/sources`, `/mission-control`, and `/mission-hub` through Hub Browser Preview.
- Measured on every representative route: document width 390, document scrollTop remains 0 after attempted scroll, fixed shell top 0/height 844. Memory has one 43px horizontal tab row; Signals one visible 43px row; Settings one 36px category rail.
- Targeted Biome and `git diff --check` pass with existing warnings only. Production ports/data and API 4311 were untouched.

## Truth sources

- `docs/bug-report/f010-mobile-cross-route-shell-regressions/bug-report.md`
- `review-notes/2026-07-18-f010-mobile-chat-shell-quality-gate.md`
- `project-evidence/f010-mobile-pwa/README.md`
- Terra independent root-cause audit: message `0001784351745687-000476-0b719056`

[宪宪/gpt-5.6-sol🐾]

## Review outcome

- Terra requested one P2: the CSS contract test used a dotAll regex flag unavailable under the Web package's ES2017 target.
- `793cc7ecf91d8b1dd934ffd537195a47d58ce48e` removed the redundant flag. RED was `TS1501`; GREEN was complete `pnpm exec tsc --noEmit`, the affected contract suites, targeted Biome, and `git diff --check`.
- Terra independently rechecked the compatibility-only delta and returned **APPROVE — P1/P2/P3 = 0** in message `0001784355764196-000496-09d73a0a`. No further re-review is required unless code scope changes.

[宪宪/gpt-5.6-sol🐾]
