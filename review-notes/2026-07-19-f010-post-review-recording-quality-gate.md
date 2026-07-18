# F010 post-review recording quality gate

Date: 2026-07-19
Candidate: `6131f5721aa047e84f965679b82d05e9926f18f3`
Branch: `feat/f010-mobile-pwa`
Spec: `feature-specs/2026-07-18-f010-mobile-experience-recovery.md` Task 10
Diagnosis: `docs/bug-report/f010-post-review-recording-pulse-and-tunnel-origin/bug-report.md`

## Verdict

**Scoped candidate gate: PASS.** The two failures visible in the reporting-iPhone recording have
RED-to-GREEN coverage, the affected Web selection is green, all workspace packages lint and build,
and the exact candidate production artifact serves successfully from an isolated port.

The repository-wide `pnpm check` and `pnpm test` are not claimed green. Their failures are recorded
below and occur outside the changed files before exercising this slice. They do not replace or
weaken the scoped evidence.

## Vision and original requirement

Original operator instruction, thread `thread_mrogfco44bos1sgn`:

> Read the desktop `录屏.mp4` as evidence, judge and repair the problem, and have it ready by morning.

| Operator-visible requirement | Contract | Implementation |
|---|---|---|
| Focusing the composer must not blank the whole installed PWA | An event-quiet `112px` pulse cannot replace the `844px` usable shell; a later `500px` scroll frame still commits | `useVisualViewportCssVars.ts` bounded usable-frame invariant |
| `@` must list routable cats without a fragile second TLS port | Explicit HTTPS `:8443` resolves to the page origin; direct HTTP retains Web+1 | `api-client.ts` browser-origin resolver |
| Acceptance routing must match the terminal architecture | Only 8443 Web/API/Socket routes are mandatory | `f010-tailscale-serve-guard.mjs` |

## Architecture ownership

- Architecture cell: existing Web viewport projection and browser transport-origin resolution
- Map delta: none
- Why: the change strengthens invariants inside the existing hook and API client. It adds no Store,
  Queue, Router, Adapter, Dispatcher, Binding, persistence owner, or second geometry writer.

The quality-gate skill references `check-hotfix-pattern.mjs`, `check-fallback-layers.mjs`, and a
`check:architecture-ownership` script, but none exists in this checkout. This instruction/runtime
drift is reported rather than represented as a pass. Manual fallback sweep found one existing quiet
timer plus one bounded frame predicate; no new fallback layer or timer was introduced.

## Design and artifact hygiene

- `designs/**/*.pen`: no `designs` directory in this checkout; no design draft to compare.
- Root media/design artifact scan, worktree: none.
- Root media/design artifact scan, committed range `617033b..6131f57`: none.
- `git diff --check 617033b..6131f57`: pass.

## Dogfood-Your-Slice

Scope verdict: required; this changes an installed-PWA user journey.

- Detached worktree: `E:\ClowderAI\clowder-ai-f010-verify-6131f57`
- Exact candidate: `6131f57`
- Production build environment: `NEXT_PUBLIC_API_URL=http://localhost:4311`
- Final Web artifact: BUILD_ID `v4qGJCRJiDgYm6tn-Uolh`
- `http://localhost:4312/`: HTTP 200 from PID `37188`
- Hub Browser Preview: `cat_cafe_preview_open` returned `allowed=true` for port 4312
- Local `4311/api/cats`: 4 cats (`opus,sonnet,opus-45,fable-5`)
- Same-origin Tailscale `8443/api/cats`: the same 4 cats
- The temporary 4312 listener was terminated after the smoke; the pre-existing 4310/4311 services
  were not rebuilt, restarted, or modified.

An installed-iOS visual replay cannot be manufactured by desktop preview. The morning acceptance
journey remains: cold-start the installed PWA, focus with Chinese IME, type `@`, select a cat, send,
and dismiss the keyboard. The code is not presented as device-accepted until that replay occurs.

## Fresh verification

| Command | Result |
|---|---|
| Focused/affected Vitest selection | 10 files, 89 tests passed |
| `pnpm --filter @cat-cafe/web exec tsc --noEmit` | exit 0 |
| Targeted Biome on the 5 changed executable/test files | 0 errors, 0 warnings |
| `pnpm check:features` | pass; 254 feature docs scanned |
| `pnpm check:capability-tips` | pass; warnings are existing missing anchors/discovery drift |
| `pnpm check:followup-tails` | pass; no tail detected |
| `pnpm lint` | exit 0; existing warnings only, none in changed files |
| `pnpm -r --if-present run build` | exit 0 for all 5 buildable packages |
| Isolated `@cat-cafe/web` production build | exit 0 |

### Repository-wide baseline attempts

- `pnpm check`: stopped in the initial whole-repository Biome phase with 4,493 CRLF formatting
  diagnostics across the Windows checkout. The changed executable/test files pass targeted Biome.
- `pnpm test`: Finance 12/12 and Shared 85/85 pass, then the API package script fails under `cmd`
  because `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 command` is POSIX syntax.
- Retrying with pnpm's script shell set to Git Bash advances past that parser boundary but then the
  existing `with-test-home.sh` launch fails at `/c/Program Files/nodejs/node` with `Argument list too
  long`. No failure names a changed F010 file or exercises the new URL/viewport contracts.

## Capability tips

No new discoverable capability or guide is introduced. This is a corrective invariant inside an
existing mobile chat and transport path; the F244 checker passes without a new user tip.

[丢丢/gpt-5.6-sol🐾]
