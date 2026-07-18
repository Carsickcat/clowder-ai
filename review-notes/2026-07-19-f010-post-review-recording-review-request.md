# Review Request: F010 post-review recording repair

Review-Target-ID: F010
Branch: `feat/f010-mobile-pwa`
Code candidate: `466436f1465812ef11c9de4772da43eac413a219`
Code range: `617033bfd38a0b98326c77d302ec71341b76d2bc..466436f1465812ef11c9de4772da43eac413a219`

## What

- Reject unusable intermediate `visualViewport` frames without blocking legitimate compact
  landscape keyboard geometry.
- Prevent provisional width-changing pulses from staging a poisoned geometry baseline.
- Resolve explicit HTTPS browser access to the page's same origin; preserve HTTP Web+1 direct-port
  behavior.
- Make the Tailscale acceptance guard require `/`, `/api`, and `/socket.io` inside the exact `:8443`
  listener block; `:8444` is compatibility-only.

## Why

The reporting-iPhone recording shows the whole installed-PWA shell disappearing during keyboard
opening and the mention picker containing only `@thread`/`@all`. The former was a long-lived 112px
viewport pulse being committed as whole-shell geometry. The latter was an explicit HTTPS `:8443`
page being rewritten to a fragile second TLS origin at `:8444` instead of using valid same-origin
API/Socket routes.

## Original Requirements

> 读取桌面的“录屏.mp4”文件作为证据进行判断和修复，明早起来时候一定要搞定。

- Source: thread `thread_mrogfco44bos1sgn`, co-creator message at 2026-07-18 20:00 UTC.
- Please judge the delivery against the recording-visible shell collapse and missing routable cats,
  not only against the implementation description.

## Tradeoff

The repair intentionally does not add a longer debounce, device/UA sniff, a second geometry writer,
or a mandatory `:8444` mapping. A 144px composing-height floor is the smallest bounded invariant
that rejects the recorded 112px collapse while allowing the 160px compact-landscape case. HTTPS
uses same origin; explicit HTTP keeps the repository's direct Web+1 convention for local workflows.

## Architecture Ownership

Architecture cell: existing Web viewport projection and browser transport-origin resolution
Map delta: none
Why: the change strengthens invariants inside the existing hook, API client, and acceptance guard;
it creates no Store, Queue, Router, Adapter, Dispatcher, Binding, persistence owner, or parallel
geometry writer.

Please verify that the diff matches this ownership claim and does not create a hidden second
configuration or geometry owner.

## Open Questions

### Technical OQ

- Is the staged-baseline rollback correct for width-changing unusable pulses followed by a usable
  terminal resize/scroll frame?
- Does the listener parser prevent routes in `:8444` from satisfying a broken `:8443` block?
- Does HTTPS same-origin resolution preserve all existing explicit-HTTP direct-port behavior?

### Value OQ

None. These are reversible implementation details within the accepted F010 behavior.

## Fresh-Context Findings

Agent: independent Codex fresh-context scanner
SHA scanned: `6786790`
Total findings: 4 (1 P1, 2 P2, 1 P3)

| # | Finding | Author disposition | Status |
|---|---|---|---|
| FC-1 | Width-changing unusable pulse could poison the baseline | Fixed in `466436f` with RED-to-GREEN regression | closed |
| FC-2 | Serve guard regex could borrow routes across listener blocks | Fixed in `466436f` with exact-block parser and 2 tests | closed |
| FC-3 | Quality report named an older build | Corrected in the final quality report | closed |
| FC-4 | Focused test count was stale | Corrected to 23/23 focused and 91 affected | closed |

Reviewer: annotate findings as `[FC:covered]`, `[FC:new]`, or `[FC:N/A]` in the verdict.

## Next Action

Return a formal `APPROVE` or `REQUEST-CHANGES` verdict for exact code candidate `466436f`. Every
finding must have P1/P2/P3 severity and a clear blocking/non-blocking stance. Do not edit author
files. If approved, the author will deploy the exact reviewed Web artifact to the existing isolated
F010 Web listener without restarting the API.

## Review Sandbox

- Suggested path: `E:\ClowderAI\clowder-ai-f010-review-codex`
- Bootstrap: `git worktree add --detach E:\ClowderAI\clowder-ai-f010-review-codex 466436f`
- Suggested ports if runtime inspection is needed: `web=4322`, `api=4323`
- Start command: `pnpm --filter @cat-cafe/web exec next start packages/web -p 4322`

Before validation, clear an inherited production mode and install from the locked workspace:

```powershell
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
pnpm install --frozen-lockfile --offline
```

## Self-check evidence

### Spec compliance

`feature-specs/2026-07-18-f010-mobile-experience-recovery.md` Task 10 captures the recorded pulse,
compact-landscape, width-changing baseline, HTTPS origin, and exact-listener routing contracts.
The quality report records the scoped pass and the repository-wide baseline exceptions separately.

### Validation

- Focused viewport and URL suites: 23/23 passed.
- Affected Web selection: 10 files, 91 tests passed.
- Tailscale listener parser: 2/2 passed; live guard reports required `:8443` routes present.
- Web TypeScript and targeted Biome: passed.
- All five workspace buildable packages built successfully; exact `466436f` Web production build
  has BUILD_ID `NLgMJFRRSV9bzl_iQLbc5` and served HTTP 200 on isolated port 4312.
- Full `pnpm check`, `pnpm test`, and `pnpm gate` baseline/lineage failures are detailed in the
  attached quality report; none is represented as green.

### Related documents

- Spec: `feature-specs/2026-07-18-f010-mobile-experience-recovery.md`
- Diagnosis: `docs/bug-report/f010-post-review-recording-pulse-and-tunnel-origin/bug-report.md`
- Quality gate: `review-notes/2026-07-19-f010-post-review-recording-quality-gate.md`

[丢丢/gpt-5.6-sol🐾]
