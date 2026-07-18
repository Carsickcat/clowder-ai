# F010 mobile mention picker is clipped and hard to select with the iPhone keyboard

Date: 2026-07-18

Reporter: co-creator, using the installed F010 PWA on the reporting iPhone.

## Bug diagnosis capsule

| Field | Evidence / decision |
| --- | --- |
| **1. Symptom** | Typing `@` opens a tall desktop-style list above the composer. With the Chinese keyboard open, earlier cat rows extend outside the visible app frame, long descriptions consume most of the height, and the bottom group rows are awkward to reach. Expected: the available cats remain visible, compact, and directly tappable inside the keyboard-shrunken frame. |
| **2. Evidence** | Operator screenshots `1784341440491-587f1546.png` and `1784341440492-3003b609.png`; isolated Web `4310`; source `ChatInputMenus.tsx` uses one-column rows, always-visible descriptions, `bottom-full`, and `max-h-[min(40dvh,20rem)]`. iOS standalone keyboard behavior is governed by the VisualViewport rectangle recorded in the F010 evidence source. |
| **3. Root cause** | The mobile menu still uses the desktop information density and sizes itself with viewport units rather than a compact interaction model. In installed iOS PWA keyboard mode, `40dvh` does not guarantee that the menu's top remains inside the usable VisualViewport distance above the composer. The one-column descriptions make the menu unnecessarily tall. |
| **4. Diagnostic strategy** | Lock the desired mobile contract with a rendered component regression: two columns, compact option rows, hidden descriptions, bounded internal scrolling, and desktop-only restoration of the detailed single-column layout. Then verify the real ChatInput integration and an isolated production preview. |
| **5. Timeout strategy** | If the compact menu still clips in Chromium device emulation, inspect the computed VisualViewport/app-frame geometry rather than adding another fixed-position fallback. Final iOS keyboard proof remains an operator touch test because the preview harness cannot programmatically open the iOS IME. |
| **6. Warning strategy** | Stop if the fix introduces another viewport writer, a second keyboard inset, or a separate mobile mention state owner. Those would violate the single VisualViewport rectangle invariant. |
| **7. User-visible correction** | On compact layouts the picker becomes a short two-column touch grid with avatars and names; descriptions remain available in the desktop menu. Overflow stays inside the picker instead of moving rows outside the app frame. |
| **8. Acceptance** | RED→GREEN component regression; existing mention keyboard guards; F010 mobile overflow contract; Web typecheck/build; browser preview at a compact viewport; final reporting-iPhone screenshot with keyboard open. |

## Reproduction

1. Open the installed F010 PWA on the reporting iPhone.
2. Focus the composer so the Chinese keyboard is visible.
3. Type `@` without a filter.
4. Observe the candidate list above the composer.

Expected: individual cats are immediately tappable within the visible frame and the list scrolls internally if needed.

Actual before repair: the tall one-column menu is visually clipped and difficult to operate.

## Fix and verification

Implemented in `ChatInputMenus.tsx`:

- Compact layouts render the candidates as a two-column touch grid with 48px minimum targets; descriptions are hidden so names and avatars carry the primary choice.
- The picker is inset 8px from both sides, bounded to `max-h-52`, and owns vertical scrolling with `overscroll-contain`; the desktop breakpoint restores the detailed single-column menu and 320px bound.
- The picker exposes `listbox` / `option` semantics, `aria-selected`, and explicit accessible names.
- Overflow affordance state is recomputed when a closed picker opens or the candidate count changes. This was a real adjacent defect: the previous mount-only effect ran while the menu DOM did not exist and could never show “还有更多猫猫”.

RED evidence:

- The new rendered-component contract first failed because the mobile menu had no stable selector and still used the desktop layout.
- The open-transition regression then failed because the overflow affordance was absent after a closed→open rerender with overflowing geometry.

GREEN evidence:

- Focused picker/layout/keyboard guards: 3 files, 9 tests passed.
- Web TypeScript: passed.
- Targeted Biome: exited 0 with repository-existing warnings only; `git diff --check`: passed.
- Production build: passed, 22 routes, BUILD_ID `TzTwY4Lmu7Y6BiMErzKW9`.
- The generated `/api`, `/socket.io`, and `/uploads` rewrites target isolated API `4311`; Web PID `39088` serves the new build on `4310`.
- HTTPS page, manifest, service worker, API health, four-cat roster, and current Sonnet provider projection all passed through `:8443`; Hub Browser Preview opened the current thread.

Broader ChatInput selection: 108/110 tests passed. The two repeatable failures are outside this diff and remain baseline debt: `chat-input-upload-feedback` expects the former image-specific error label while the component renders the current generic message label, and `chat-input-history` expects a history-store append that the current implementation does not perform. Neither touched file participates in this repair.

Final acceptance remains the reporting iPhone: refresh or reopen the installed PWA, open the Chinese keyboard, type `@`, and confirm the two-column picker stays fully inside the visible frame and each cat is directly tappable.

[宪宪/gpt-5.6-sol🐾]
