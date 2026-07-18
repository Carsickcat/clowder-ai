# F010 mobile composer root-coordinate quality gate

Date: 2026-07-18

Reporting evidence:

- `C:\Users\myh_1\Desktop\07a4d1f3c1d2cdf4acc422ab2fe0512e.mp4` — 12.40s, HEVC, 592×1280
- `packages/api/uploads/1784388882630-270baf4d.png`

Implementation commits: root-coordinate repair `e27ee2daf9bbfb986754385b7068935f19c4833e`; reviewed typography repair `ffafb56cda54912dacfea89232a1c1c5562839ad`

## Final verdict

Terra independently approved the exact code SHA `ffafb56` with **P1/P2/P3 = 0**. Automated, production-build, deterministic browser, and cross-individual review gates pass. The reporting iPhone installed-PWA replay remains the release gate.

## Root cause

The sixth recording disproved the remaining status-sheet hypothesis. During focus, the header, transcript, and composer moved away together while the system keyboard and floating concierge remained. The fixed AppShell was consuming `visualViewport.offsetTop` as its own CSS `top`; iOS had already panned the visual viewport for the focused textarea, so the application applied the same pan a second time.

The oversized bottom region had a separate owner conflict. Clowder added a fixed 3.5rem reserve for Safari's native Previous/Next/Done Form Assistant even though the assistant was already outside the web layout. The application therefore duplicated the system control's height.

## Terminal product contract

- AppShell is fixed at `top: 0; left: 0`; VisualViewport contributes dimensions only.
- The document never scrolls. The transcript is the only chat scroll owner.
- Browsing owns one Dock reserve. Composing owns a zero-pixel application reserve.
- The mobile composer is one 48px row containing 44px touch targets and a 44px textarea.
- Mobile message copy and composer copy are both 16px; metadata remains subordinate.
- Safari's Form Assistant is accepted as system UI. Clowder neither tries to hide it nor duplicates its height.
- Tools and IME are mutually exclusive: opening tools blurs the textarea; focusing the textarea closes tools.
- The textarea remains the editor primitive to preserve Chinese composition, mentions, selection, drafts, attachments, and accessibility.

## Rejected repairs

- feeding `offsetTop`/`offsetLeft` back into the fixed root;
- adding timers, extra animation frames, `scrollIntoView`, or scroll retries;
- reserving a guessed device- or assistant-height padding;
- changing the editor to `contenteditable` to avoid Safari chrome;
- shrinking editable text below 16px or shrinking hit targets below 44px;
- allowing tools, Dock, status, update prompts, or diagnostic chrome to share the IME-constrained frame.

## RED → GREEN

- Root-origin tests failed while late VisualViewport pan values still produced non-zero AppShell offsets, then passed with literal zero root projection.
- Mobile shell contracts failed while the 3.5rem assistant reserve remained, then passed with a zero composing reserve.
- Composer contracts failed while the mobile row exceeded 48px and tools/IME could coexist, then passed after the state and density correction.
- Typography contracts failed while mobile message body remained 14px beside the required 16px textarea, then passed at a shared 16px optical scale.

Focused viewport/composer/overflow selection: **33/33 passed**.

Broader affected selection: **13 files / 110 tests passed**. It covers viewport projection, composer state, draft persistence, mentions, mobile container chrome, toolbar, status sheet, PWA update projection, AppShell navigation, rich Markdown rendering, and chat-only typography ownership.

Web package TypeScript, targeted Biome with zero errors, and `git diff --check` pass.

Full Web Vitest remains transparently baseline-red at **5069/5136 passed**, 67 failures in the same 14 historical files. Relative to the fifth-round **5064/5131** baseline, exactly five tests were added and all five pass; neither failure count nor failure-file roster increased.

## Production and browser evidence

- Production BUILD_ID: `2JhXmOBICvwybpU-Kig8T`.
- Isolated Web: port `4310`, PID `45656`, HTTP `/` = 200.
- API `4311` and normal runtime ports were not restarted or modified.
- Hub Browser Preview opened the isolated build.

Deterministic 390×844 browsing projection:

- AppShell `top=0`, height `844`;
- document/html/body scrollTop all `0`;
- composer row `48px`, textarea `44px`, plus target `44px`;
- composer text `16px`;
- Dock `56px` and is the sole browsing reserve.

Deterministic 390×430 composing projection:

- `data-mobile-keyboard-open=true`;
- AppShell `top=0`, height `430`;
- `--mobile-chat-bottom-reserve=0px`;
- Dock `display:none`, measured height `0`;
- composer row `y=382`, height `48`, bottom `430`;
- textarea height `44`, text `16px`;
- application gap below composer `0px`;
- window/document/body scrollTop all `0`.

Writing a synthetic `--app-viewport-top: 96px` leaves computed AppShell `top=0` and bounding rect top `0`, proving that a late iOS pan can no longer feed back into root layout. A real pointer journey also proves that tools blur the textarea and a subsequent composer tap removes the 52px tool row.

Responsive typography evidence from the compiled production CSS:

- widths `639`, `640`, and `767`: chat copy `16px`, generic Markdown `14px`;
- width `768`: chat copy and generic Markdown both `14px`;
- textarea remains `16px`, and AppShell remains at `top=0` throughout.

## Independent review and remaining gate

Terra independently reviewed the new recording and reached the same root-origin, zero-assistant-reserve, 48px composer, 16px typography, and textarea-preservation recommendation in message `0001784389116629-000006-a8b895fe`.

Terra then reviewed the implementation, found one P2 in the original global `sm` typography scope, and approved its Red→Green repair at `ffafb56` in messages `0001784394321312-000027-3ca7db79` and `0001784394411765-000029-b59f5602`. Independent evidence: **8 files / 81 tests**, Web TypeScript, `git diff --check`, and a clean worktree; final verdict **P1/P2/P3 = 0**.

The only remaining release evidence is the reporting iPhone installed-PWA replay of the original 12-second focus journey with Chinese IME and mentions.

[丢丢/gpt-5.6-sol🐾]
