# F010 iOS keyboard follow-up — Quality Gate Report

Spec: `feature-specs/2026-07-17-f010-mobile-pwa.md` Task 5 / AC-A0 / AC-A4

Original experience standard: `docs/design/F010-mobile-pwa-standard.md` §6, §9 A0/A1, §10

Check time: 2026-07-17 23:29 Asia/Hong_Kong

Worktree: `E:\ClowderAI\clowder-ai-f010-local-sandbox` (`feat/f010-mobile-pwa`)

Acceptance URL: `https://desktop-9o1va3o.tail58c13e.ts.net:8443/`

## Verdict

The implementation, automated regression, production build, and isolated acceptance deployment are green. Release acceptance remains explicitly pending one positive repetition of the reporting iPhone keyboard journey; this report does not claim full F010 closure or Android completion.

## Vision and requirement coverage

| Operator requirement | Truth-source coverage | Implementation / evidence |
| --- | --- | --- |
| Opening the keyboard must not squeeze other information out of view | Design §6: input/send visible and message list must not jump; Task 5: soft-keyboard input remains visible | AppShell bottom now consumes `visualViewport.height + visualViewport.offsetTop`; regression is RED→GREEN. |
| Cat information should match the current configuration | Design §6: reuse existing cat identity/theme truth; no second mobile store | Acceptance API reads a disposable hash-verified snapshot of the current catalog; `/api/cats` returns the current five-cat roster. Source config and credentials are not rewritten. |
| Existing conversations must remain isolated and recoverable | F010 INV-9 plus runtime data-safety rules | Acceptance remains on Redis `127.0.0.1:6398/15`; DB size stayed 10 across the verified API restart; TTL overrides are 0. |

## Functional acceptance

| Requirement | Status | Code / evidence |
| --- | --- | --- |
| iOS Visual Viewport bottom alignment | ✅ code + contract | `packages/web/src/app/globals.css`; `mobile-overflow-contract.test.ts` |
| No second keyboard coordinate system | ✅ | Existing `useVisualViewportCssVars` remains the only producer; no UA/focus/observer fallback added. |
| Production PWA contains repair | ✅ | BUILD_ID `ACK6eNPRIsEDqb70A0Elf`; bundled CSS contains the exact formula. |
| Same-origin acceptance surface healthy | ✅ | Root, manifest, SW, `/api/health`, BUILD_ID asset all HTTP 200 through Tailscale HTTPS. |
| Current cat roster visible | ✅ | `/api/cats`: `opus`, `sonnet`, `opus-45`, `fable-5`, `cat-komzvl9r` with current provider/model bindings. |
| Positive device-level keyboard journey | ⏳ operator evidence | Must repeat on the reporting iPhone after refreshing/reopening the PWA. |

## Architecture and failure-mode checks

- Architecture cell: AppShell / responsive layout projection.
- Map delta: none.
- Why: one existing coordinate transform now consumes the already-published `offsetTop`; no Store, Queue, Router, Adapter, Dispatcher, Binding, persistence source, or fallback layer was introduced.
- `scripts/check-hotfix-pattern.mjs`, `scripts/check-fallback-layers.mjs`, and `check:architecture-ownership` do not exist in this feature worktree baseline, so no synthetic green result is claimed. Manual diff audit found one formula change and zero new fallback branches.
- Capability tips: `pnpm check:capability-tips` passed (11/11 harness tests; baseline anchor warnings only). This repair changes correctness of an existing documented mobile behavior and adds no new entry point or guide.

## Design and artifact hygiene

- `designs/` does not exist in this worktree; no F010/mobile/PWA `.pen` match is available for comparison.
- Root-level media/design artifact scan: no matches.
- The operator screenshot remains a runtime upload; it was not copied into the repository.

## Dogfood-Your-Slice

Scope verdict: device-specific positive confirmation remains required.

Production path exercised from the feature worktree:

1. build with public HTTPS origin and local `API_SERVER_PORT=4311`;
2. verify routes manifest rewrites API/Socket/uploads to `localhost:4311`;
3. serve BUILD_ID `ACK6eNPRIsEDqb70A0Elf` on `4310` through Tailscale `:8443`;
4. fetch root, manifest, SW, health, build asset, session, and cats through the public origin;
5. inspect the served build's CSS artifact for the repaired `height + offsetTop` formula.

Dogfood finding caught and repaired during this gate: the first managed build silently inherited the wrong API port and generated `localhost:3014` rewrites. It was rejected before restart, rebuilt with explicit PowerShell environment, and reverified at `localhost:4311`.

Remaining device step: open the reporting iPhone PWA, focus the composer, and confirm it sits directly above the keyboard while message/cat information remains visible.

## Fresh verification evidence

- Regression selection: **4 files / 19 tests passed**.
- Targeted Biome: **1 file checked, 0 errors**.
- Web TypeScript: `tsc --noEmit`, exit 0.
- Production Web build: exit 0; 22 routes generated; pre-existing lint warnings only.
- `pnpm check:features`: pass (`features=254`).
- `pnpm check:capability-tips`: pass; baseline warnings recorded above.
- `git diff --check`: exit 0 (Windows LF→CRLF notices only).
- Redis DB15: 10 keys before and after API restart; no flush/delete performed.

[宪宪/gpt-5.6-sol🐾]
