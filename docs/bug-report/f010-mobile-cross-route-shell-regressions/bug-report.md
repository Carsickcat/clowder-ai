# F010 mobile cross-route shell regressions

Date: 2026-07-18

Reporter: co-creator, reporting iPhone installed PWA

Status: implementation and local runtime acceptance complete; independent code review and reporting-iPhone recheck pending

## Bug diagnosis capsule

| Field | Evidence |
|---|---|
| **1. Symptom** | The repaired existing-thread composer is materially better, but creating a conversation from a global page while the Chinese keyboard is open restores the four-item Dock and its reserve. Memory navigation labels wrap one Chinese character per line. Pulling the new-thread page down can shift the entire fixed shell below a large blank region. |
| **2. Evidence** | First correction: message `0001784346245464-000456-503eb180`, three true-device screenshots. Follow-up: message `0001784351392147-000475-2d49b6e3`, screenshots `1784351392109-2519c1c9.png`, `1784351392110-213f468b.png`, `1784351392111-f9fabce5.png`, and `1784351392112-7ff05aa5.png`. Runtime preflight: Web port 4310 / PID 13548 / BUILD_ID `w_4Uqp53TT0EkwyWK4D1U`; localhost and reporting HTTPS both served that build, so stale runtime was ruled out. Terra independently confirmed the three root causes from committed baseline `b778c0d` in message `0001784351745687-000476-0b719056`. |
| **3. Confirmed root cause** | The previous harness covered an already-mounted chat shell only. `ThreadSidebar` fell back to `location.assign` outside the chat route group, so creating/selecting a thread from Memory remounted AppShell after the keyboard had already reduced both layout and visual viewports. `AppShell` and global pages both claimed vertical scrolling, while `html/body` did not lock root scrolling. `MemoryNav` used six fixed-padding tabs without horizontal scrolling or no-wrap protection; Ops and shared ScopeTabs repeated the same failure mode. `visualViewport.offsetTop` was projected even when no keyboard was open, allowing a stale page/viewport offset to push the fixed shell down. Signals and Mission Hub repeated fixed desktop padding/tab/two-column patterns. |
| **4. Diagnostic strategy** | Trace navigation lifetime from global drawer to ThreadSidebar to chat layout; compare chat and global scroll owners; inspect representative primary global routes at 390px; add behavioral tests at each owner before implementation. |
| **5. Timeout strategy** | If one owner-level repair cannot close each RED contract, stop after two failed hypotheses and capture live VisualViewport/page-scroll metrics before changing another layer. |
| **6. Warning strategy** | A fix is wrong if it adds a second keyboard state/inset, stores keyboard-open state, hides global navigation, makes desktop tabs regress, or requires per-page body-scroll patches. Three failed repair attempts trigger an architecture review rather than another fallback. |
| **7. User-visible correction** | Global routes use one compact mobile app bar, one internal scroll viewport, horizontally reachable tabs, responsive single-column content, and SPA thread entry. Root scrolling is locked only while AppShell chrome is active; chromeless routes retain document scrolling. Closed-keyboard viewport offsets no longer move the fixed frame. |
| **8. Acceptance** | RED→GREEN regressions cover global→thread SPA navigation, stale closed-keyboard offset, scoped root scroll lock, mobile global header/viewport, Memory/Signal/Ops/Scope tabs, Signal inbox stacking, compact Settings navigation, and Mission Hub height/tab ownership. Final focused selection: 47/47; the earlier broad affected selection remains 106/106. Production build and the 390px route matrix pass; reporting-iPhone recheck remains final truth. |

## Failure-mode classification

This is a repeated harness defect, not a third isolated layout patch. The same reporting device exposed keyboard/Dock/shell blank-space failures twice in one thread. The corrective harness therefore crosses route boundaries and samples global pages, rather than adding another picker- or thread-specific assertion.

## Rejected repairs

- Persisting keyboard-open state in `sessionStorage` or another store: creates stale state and a second source of truth.
- Guessing keyboard state from a fixed initial screen height: fails across split view, rotation, browser chrome, and the two iOS viewport models.
- Patching only Memory tabs or adding page-specific body-scroll resets: leaves the sibling failure modes and owner conflict intact.
- Calling `scrollTo(0, 0)` on viewport scroll: fights the browser and hides the root ownership defect.

## Final local evidence

- Production Web build passed in 41.3 seconds and generated all 22 routes. The active isolated bundle has BUILD_ID `3sb-dbE1RU4drK_umxkvl`; HTTP `/` returns 200 and embeds the same ID.
- Port `4310` is owned by the isolated F010 `next start` process PID `1536`; API, Socket, and uploads rewrites target isolated API `4311`. API `4311` was not restarted and production ports/data were untouched.
- Hub Browser Preview opened `/`, a fresh `/thread/:id`, `/memory`, `/memory/search`, `/settings?s=ops`, `/signals`, `/signals/sources`, `/mission-control`, and `/mission-hub`.
- A deterministic 390×844 render probe found `document.scrollingElement.scrollTop=0` after attempted page scrolling on every representative route, shell bounds exactly `390×844` at top `0`, and no horizontal document overflow.
- Memory's six primary tabs share one 43px row and scroll horizontally (`334px` viewport / `492px` content). Signals' two tabs remain visible in one 43px row. Settings' category directory is one 36px horizontal rail, followed by the page content rather than a half-screen desktop sidebar.
- Full Web Vitest remains baseline-red but improves from **5042/5111 passed, 69 failures in 16 files** to **5044/5112 passed, 68 failures in 15 files**. The new test passes and the former `global-css-architecture` failure is now green; the remaining 15 failing files are outside this change set.
- Browser metrics and Chrome touch emulation prove layout ownership and responsive structure; they do not substitute for reporting-iPhone Safari/PWA keyboard, rubber-band, and Chinese-IME acceptance.

[宪宪/gpt-5.6-sol🐾]
