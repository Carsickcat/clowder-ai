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
| Preserve desktop and critical actions | Pass | Detailed diagnostic remains at `lg`; stop/send/authorization ownership unchanged |

This is a complete correction slice, not a spike. F010 release completion remains separately gated on reporting-iPhone installed-PWA Safari with the Chinese IME.

## Functional acceptance

| Contract | Implementation | Tests |
|---|---|---|
| Status and composing are mutually exclusive | `ChatContainer.tsx`, `MobileStatusSheet.tsx` | `chat-container-mobile.test.ts`, `mobile-status-sheet.test.ts` |
| Programmatic composer focus does not scroll the document | `ChatInput.tsx` | `mobile-overflow-contract.test.ts` plus browser dogfood |
| Mobile hook failure is one row, full diagnostics stay desktop | `AgentHookHealthNotice.tsx`, `ChatContainer.tsx` | `agent-hook-health-notice.test.tsx` |
| Idle composer respects the compact chrome budget | `ChatInput.tsx` | `chat-input-mobile.test.ts` |
| Keyboard projection removes noncritical chrome and sheets | `globals.css`, `ChatContainer.tsx` | `mobile-overflow-contract.test.ts` plus browser dogfood |

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
- Three implementation screenshots exist. A synthetic 15-second recording was not manufactured; Chrome evidence remains structural, while real iPhone video/screenshots remain the release truth.

## Dogfood-your-slice

Scope verdict: required and performed.

Journey: no-cache 390×844 chat → focus textarea → open header status → verify focus transfer and sheet header → project 390×430 composing geometry.

Observed:

- document/root width `390`, root scrollTop `0`;
- header `57`, composer `52`, textarea `44`, browsing Dock `56`;
- status click moves focus from textarea to `BODY`; sheet opens at `scrollTop=0` with its title visible;
- composing projection places composer bottom at visual bottom, hides Dock, shows zero secondary chrome, and hides the status sheet.

Dogfood bugs found and fixed in this slice: transient sheet carry-over across client thread navigation and the textarea inline baseline that inflated the measured composer from 52px to 58px.

## Fresh verification

- RED: six failures across five suites, plus isolated RED proofs for thread carry-over and textarea line-box inflation.
- Affected Vitest: **5 files / 44 tests passed**.
- TypeScript: `pnpm exec tsc --noEmit` → exit 0.
- Targeted Biome: exit 0, zero errors; repository-existing warnings only.
- Capability tips: 11/11 guard tests and the hard check pass; existing stale-anchor/origin warnings only. The F010 feature truth already declares `tips_exempt` for passive mobile layout/keyboard fixes.
- `git diff --check`: exit 0.
- Production Web build: exit 0, 22 routes.
- Full Web Vitest: transparently baseline-red at **5050/5117**, 67 failures in 14 files, improving from **5044/5112**, 68 failures in 15 files. The five changed suites are green; the known ChatInput history/upload debts remain unchanged.
- Runtime before commit: isolated Web `4310`, API `4311`, BUILD_ID `mGL-QVkc-C-VUCAe52vBT`, HTTP `/` 200. A post-commit build/process identity is required before the review request becomes final.

## Verdict

Code-review gate: pass once the candidate commit and post-commit runtime identity are recorded. Release gate: open only for reporting-iPhone Safari/installed-PWA Chinese-IME acceptance.

[宪宪/gpt-5.6-sol🐾]
