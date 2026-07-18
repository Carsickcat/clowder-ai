# F010 mobile chat shell quality gate

Date: 2026-07-18

Status: **second reporting-iPhone follow-up independently approved; reporting-iPhone acceptance pending**

Scope: `feature-specs/2026-07-18-f010-mobile-experience-recovery.md`, Task 8

## Vision coverage

| Co-creator need | Implementation | Evidence |
|---|---|---|
| Opening the keyboard must not lift useless page blocks above it. | The existing composing projection now covers both iOS viewport models. Dock reserve becomes `0px`; Dock and secondary Thinking/Execution/Queue/Vote chrome leave layout. | RED→GREEN hook regression plus 390×500 CDP projection: Dock `display:none`, secondary chrome `display:none`, composer bottom=`500`, document height=`500`. |
| Header must stop wrapping and consuming the chat. | Mobile/tablet header is one 56px content row with two 44px actions and a single-line thread title. Branding, export, voice, recording, project chip, and daemon detail are desktop-only in this row. | 390/430/768 browser metrics: rendered header height `57px`; 390 action bounds are 44×44 at x=8 and x=338. |
| Composer and Dock must not reserve the same safe area twice. | `--mobile-dock-reserve` is the sole Dock/safe-area owner. `ChatInput` no longer carries `safe-area-bottom`; mobile core Dock height is 56px. | Browsing metrics: at 430×932 composer bottom and Dock top both equal `876`; at 768×1024 both equal `968`. |
| The chat transcript must remain the work surface. | Mobile composer padding is compact and auto-grow is capped at 96px; secondary status rows hide while composing; transcript remains the sole page scroll owner. | Focused contracts and browser projection show document width/height equal viewport in all measured states. |

## TDD and verification

- RED: 5 targeted failures reproduced the simultaneous viewport shrink, missing composing chrome rule, duplicate composer safe-area, and desktop-height mobile header.
- GREEN: focused viewport/composer/header/overflow selection passed **31/31**.
- Full Web Vitest: **5036/5105 passed**, with 69 baseline failures in 16 files. The previous recorded baseline was 5028/5101 with 73 failures in 17 files; all four new shell regressions pass, and no changed test/source file appears in the failing-file list. The remaining failures stay in pre-existing color/Skills/F232/socket/governance/composer-copy/status-sheet/F252 families and are not represented as green.
- Current production Web build: passed in **36.8s**, generated 22 routes and BUILD_ID `w_4Uqp53TT0EkwyWK4D1U`; API, Socket and uploads rewrites all target isolated API `4311`.
- Runtime identity: isolated Web PID `13548`, start `2026-07-18 12:47:49 +08:00`, port `4310`; root returned HTTP 200 and embedded that BUILD_ID. API `4311` was not restarted; production ports/data were untouched.
- Hub Browser Preview opened port `4310`.
- Small gates: Next/PWA config **8/8**, hardcoded-color rule, feature truth, capability-tips tests **11/11**, targeted Biome, and `git diff --check` pass. Capability tips retains the disclosed no-`origin/main` and stale-anchor warnings. The referenced hotfix/fallback scripts and `vision-evidence-workflow.md` are absent on this branch, so no result is fabricated for them.
- CDP device-metric acceptance:

| State | Header | Composer | Dock | Reserve | Page scroll bounds |
|---|---:|---:|---|---|---|
| 390×500 composing, both viewports shrink | 57px | y=430, h=70, bottom=500 | none | `0px` | 390×500 |
| 430×932 browsing | 57px | bottom=876 | y=876, h=56 | `calc(3.5rem + 0px)` | 430×932 |
| 768×1024 browsing | 57px | bottom=968 | y=968, h=56 | `calc(3.5rem + 0px)` | 768×1024 |

## Architecture and source hygiene

- One ephemeral owner remains: `data-mobile-keyboard-open`; no Store/Queue/Router/Adapter/Dispatcher/Binding was added.
- The focus signal is a guard, not the geometry owner: it only admits an 80px shrink from a stable same-width VisualViewport baseline.
- No UA/device sniff, fixed iPhone height, second keyboard inset, or composer remount was added.
- External design claims were audited against Apple HIG, MDN/WebKit, and CSS Viewport primary sources in `docs/bug-report/f010-mobile-chat-shell-chrome-density/bug-report.md`.
- Terra's independent design pass converged on the same state matrix and explicitly found no value open question.
- No F010 `.pen` artifact exists in `designs/`; Pencil tooling was unavailable, so the design gate used the operator's three real-device screenshots, independent design convergence, browser projection, and exact layout metrics. Root-media and diff-media scans are both zero.
- The failure-mode audit covers both iOS geometry models, focus/no-focus admission, viewport-width baseline reset, keyboard-open/closed chrome projection, and the non-keyboard Dock reserve. No new architecture owner or extension point was introduced.

## Post-review P2 repair (`b480c1d`)

- Terra found that the composing-only secondary chrome selector was not bounded to the compact work surface, so a global keyboard attribute could hide execution/queue/vote/thinking status at the shared `lg=1024px` boundary.
- RED: the new responsive contract failed at **4/5** because `globals.css` had no `max-width: 1023px` boundary.
- GREEN: the exact contract passes **5/5**; the complete viewport/composer/header selection passes **32/32**; Next/PWA **8/8**, hardcoded-color rule, targeted Biome, production build and `git diff --check` pass.
- Browser Feature Gate on the current production bundle: with `data-mobile-keyboard-open=true`, both secondary wrappers compute to `display:block` at 1024px and `display:none` at 1023px.
- Failure-mode sweep: Dock already has `lg:hidden`, and the chat reserve already has `lg:pb-0`; only the new secondary-chrome selector leaked across the wide boundary. The detector remains global while only its compact projection is width-bounded.
- Terra re-reviewed `b480c1d` in message `0001784350462169-000473-efbef0d2` and returned **APPROVE — P1/P2/P3 = 0**.

## Second reporting-iPhone follow-up

The first chat-shell correction improved an already-open thread, but four new true-device screenshots showed three cross-route/global-page failures: a fresh thread restored Dock reserve under the keyboard, Memory tabs collapsed vertically, and root rubber-band scrolling displaced the entire fixed shell. The same audit also found inaccessible Signals tabs and a desktop-density Settings directory at 390px.

- **Navigation lifetime:** global-page thread creation/selection now uses Next client routing, preserving the mounted AppShell and its stable VisualViewport baseline instead of crossing documents with `location.assign`.
- **One frame / one scroller:** AppShell-scoped classes lock `html/body`; the global host no longer scrolls independently of page content. Chromeless routes are excluded. A closed-keyboard stale `visualViewport.offsetTop` projects as zero.
- **Compact global pages:** AppShell owns one 57px mobile global header. Memory, Signals, Ops, capability scope tabs, Mission Hub tabs, and the Settings directory are single-line horizontal rails. Signal content stacks at compact widths and each page owns its internal vertical scroll.
- **TDD:** the final focused route/viewport selection passes **47/47**; the earlier broad affected selection passes **106/106**. The CSS architecture gate is newly green after moving shell geometry out of the over-limit `globals.css` entrypoint.
- **Full baseline:** Web Vitest is transparently red at **5044/5112 passed**, 68 failures in 15 files. This improves the pre-follow-up **5042/5111**, 69 failures in 16 files: the added contract passes and `global-css-architecture` leaves the failing-file list. No remaining failed file is modified by this follow-up.
- **Production/runtime:** Web build passes, all 22 routes are generated, BUILD_ID is `3sb-dbE1RU4drK_umxkvl`, and the isolated `4310` process is PID `1536`. All API/Socket/upload rewrites target isolated API `4311`; production ports/data were untouched.
- **390×844 route matrix:** `/`, a fresh `/thread/:id`, `/memory`, `/memory/search`, `/settings?s=ops`, `/signals`, `/signals/sources`, `/mission-control`, and `/mission-hub` opened through Hub Browser Preview. Every measured document stayed 390px wide, root scroll stayed at zero after an attempted scroll, and the fixed shell remained top `0`, height `844`.
- **Visual metrics:** Memory tabs are one 43px row (`334/492px` client/scroll width); Signals tabs are visible in one 43px row; Settings categories are one 36px horizontal rail rather than a 42vh sidebar.
- **Independent review:** Terra confirmed the route-lifecycle, tab-overflow, and scroll-owner root causes from committed baseline `b778c0d`, then reviewed the implementation. The only P2 was an ES2018-only dotAll flag in a CSS contract test; `793cc7e` removed that redundant flag, restored complete `tsc --noEmit`, and Terra approved the final head in message `0001784355764196-000496-09d73a0a` with **P1/P2/P3 = 0**.

## Remaining gates

1. On the reporting iPhone, reopen the installed PWA and repeat: Memory tab swipe, global-page new-thread creation with Chinese keyboard already open, Dock/reserve visibility, and downward rubber-band gesture. Browser emulation is not represented as a substitute for Safari/PWA behavior.
2. Merge-gate infrastructure is unavailable in this local snapshot: `origin` has no URL or `origin/main`, and `gh` is not installed. Latest-main rebase, `pnpm gate`, PR creation, remote review, and merge must remain fail-closed until that infrastructure exists.

[宪宪/gpt-5.6-sol🐾]
