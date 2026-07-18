# F010 mobile composer product recovery — quality gate

Date: 2026-07-18

Spec: `feature-specs/2026-07-18-f010-mobile-experience-recovery.md`

Original report: thread message `0001784357537884-000498-e55d75f5`; screenshots `1784357537844-455e30ef.png` and `1784357537845-e8f055b9.jpg`; diagnosis capsule `docs/bug-report/f010-mobile-chat-composer-product-recovery/bug-report.md`.

## Vision coverage

Operator experience, condensed from the report:

> Tapping the conversation input lands in an unknown lower region. After repositioning, the app input and a confirmation-looking row consume most of the keyboard frame. Do not ask the operator to enumerate more pages; converge the conversation product against established mobile chat patterns.

| Requirement | Status | Evidence |
|---|---|---|
| No status-sheet/thread lifecycle leak while composing | Pass | Thread-keyed sheet state, blur-before-open, reset-to-header tests |
| One compact app-owned composer | Pass | 52px measured row, 44px textarea/actions, `enterKeyHint="send"` |
| No competing Dock/diagnostic/task chrome above the IME | Pass | Existing composing projection extended to all secondary chrome; 390×430 evidence |
| Treat Safari's Previous/Next/Done assistant as system UI | Pass | No unsupported suppression; product budget recorded from Apple/WebKit evidence |
| Preserve desktop and critical actions | Pass | Detailed diagnostics remain at `lg`; mobile authorization is discoverable from the existing status action and its sheet |

This is a complete correction slice, not a spike. F010 release completion remains separately gated on reporting-iPhone installed-PWA Safari with the Chinese IME.

## Functional acceptance

| Contract | Implementation | Tests |
|---|---|---|
| Status and composing are mutually exclusive | `ChatContainer.tsx`, `MobileStatusSheet.tsx` | `chat-container-mobile.test.ts`, `mobile-status-sheet.test.ts` |
| Programmatic composer focus does not scroll the document | `ChatInput.tsx` | `mobile-overflow-contract.test.ts` plus browser dogfood |
| Mobile hook failure is one row, full diagnostics stay desktop | `AgentHookHealthNotice.tsx`, `ChatContainer.tsx` | `agent-hook-health-notice.test.tsx` |
| Idle composer respects the compact chrome budget | `ChatInput.tsx` | `chat-input-mobile.test.ts` |
| Keyboard projection removes noncritical chrome and sheets | `globals.css`, `ChatContainer.tsx` | `mobile-overflow-contract.test.ts` plus browser dogfood |
| Critical authorization remains reachable without an IME overlay | `ChatContainerHeader.tsx`, `MobileStatusSheet.tsx`, `AuthorizationCard.tsx` | authorization/header/sheet component contracts |
| Expanded mobile tools and authorization actions retain 44px targets | `MobileInputToolbar.tsx`, `AuthorizationCard.tsx` | toolbar and authorization target-size contracts plus browser measurements |
| A waiting PWA update does not cover the keyboard-constrained chat surface | `PwaUpdateController.tsx` reuses the compact secondary-chrome projection | controller regression plus a real waiting-worker browser journey |

## Architecture ownership

- Architecture cell: F010 Web AppShell / mobile chat presentation.
- Map delta: none.
- Why: this extends the existing `browsing | composing` CSS projection and existing sheet/composer components. It introduces no Store, Queue, Router, Adapter, Dispatcher, Binding, viewport writer, scroll owner, or bottom-reserve owner.
- Diff mismatch scan: none.
- Branch note: `check-hotfix-pattern`, `check-fallback-layers`, and `check:architecture-ownership` are not present in this feature branch; availability was checked and recorded rather than fabricated.

## Design and artifact hygiene

- `designs/**/*.pen` match for F010/mobile/chat/composer: none. UI changed without a matching Pencil artifact; product-pattern decisions are recorded in `project-research/2026-07-18-mobile-chat-composer-product-patterns/sonnet-synthesis.md`.
- Root media/design artifacts in worktree diff: none.
- Formal evidence is under `project-evidence/f010-mobile-pwa/`.
- Three final implementation screenshots exist: `mobile-auth-toolbar-final-20260718-390x844.png`, `mobile-status-sheet-final-20260718-390x844.png`, and `mobile-composer-final-20260718-390x430.png`. A synthetic recording was not manufactured; Chrome evidence remains structural, while real iPhone video/screenshots remain the release truth.

## Dogfood-your-slice

Scope verdict: required and performed.

Journey: no-cache 390×844 chat → focus textarea → open header status → verify focus transfer and sheet header → project 390×430 composing geometry.

Observed:

- document/root width `390`, root scrollTop `0`;
- header `57`, composer `52`, textarea `44`, browsing Dock `56`;
- status click moves focus from textarea to `BODY`; sheet opens at `scrollTop=0` with its title visible;
- composing projection places composer bottom at visual bottom, hides Dock, shows zero secondary chrome, and hides the status sheet.
- all three expanded tool actions measure exactly 44px high; the mobile status target also measures 44px;
- with a real waiting Service Worker present, the 88px update prompt remains available while browsing but computes to `display:none` while composing.

Dogfood bugs found and fixed in this slice: transient sheet carry-over across client thread navigation, the textarea inline baseline that inflated the measured composer from 52px to 58px, and the waiting-worker prompt covering the keyboard-constrained transcript.

## Fresh verification

- RED: six initial failures across five suites, isolated RED proofs for thread carry-over and textarea line-box inflation, two reviewer P2 proofs for authorization reachability and 44px actions, and one browser-discovered waiting-worker prompt proof.
- Final affected Vitest: **10 files / 79 tests passed**.
- Count provenance: `agent-hook-health-notice` 5 + `authorization-card-mobile` 2 + `chat-container-header-thread-indicator` 14 + `chat-container-mobile` 9 + `chat-input-mobile` 13 + `mobile-input-toolbar` 6 + `mobile-overflow-contract` 8 + `mobile-status-sheet` 11 + `pwa-update-controller` 8 + `useVisualViewportCssVars` 3 = **79**. Relative to Terra's independently reported 77, the author's explicitly listed roster includes the two `authorization-card-mobile` action tests because they directly prove the repaired P2.
- TypeScript: `pnpm exec tsc --noEmit` → exit 0.
- Targeted Biome: exit 0, zero errors; repository-existing warnings only.
- Capability tips: 11/11 guard tests and the hard check pass; existing stale-anchor/origin warnings only. The F010 feature truth already declares `tips_exempt` for passive mobile layout/keyboard fixes.
- `git diff --check`: exit 0.
- Production Web build: exit 0, 22 routes.
- Full Web Vitest remains transparently baseline-red. The latest managed JSON after the reviewer repairs was **5055/5123**, 68 failures in the same 14-file roster; its sole added failure was the new raw-pixel typography guard, which was fixed to `text-micro` and whose targeted F190 guard is green. The later waiting-worker delta is green in its 8/8 controller suite and production build. No full-suite green is claimed.
- Product recovery commit: `20adebde118b08e2b1cfb0b8e92a056846f8739a`.
- Reviewer P2 repair commit: `066762d` (mobile authorization reachability and 44px action targets).
- Browser failure-mode repair commit: `49a4853` (waiting PWA update exits the composing projection).
- Final runtime: isolated Web `4310` PID `39524` started at 2026-07-18 17:01:16 +08:00; BUILD_ID `jcnYuX0LWcqvp7oKHGqSM`; HTTP `/` 200; isolated API `4311` was untouched.

## Verdict

Author quality gate: pass. Terra approved `ad32068` in message `0001784365910648-000530-9e400c32` with **P1=0, P2=0, P3=1**; the P3 evidence-count discrepancy is resolved above by listing the two additional authorization tests and does not change code. Release gate remains open only for reporting-iPhone Safari/installed-PWA Chinese-IME acceptance.

[宪宪/gpt-5.6-sol🐾]
