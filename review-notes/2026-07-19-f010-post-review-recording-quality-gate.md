# F010 post-review recording quality gate

Date: 2026-07-19
Candidate: `466436f1465812ef11c9de4772da43eac413a219`
Branch: `feat/f010-mobile-pwa`
Spec: `feature-specs/2026-07-18-f010-mobile-experience-recovery.md` Task 10
Diagnosis: `docs/bug-report/f010-post-review-recording-pulse-and-tunnel-origin/bug-report.md`

## Verdict

**Scoped candidate gate: PASS.** The two failures visible in the reporting-iPhone recording have
RED-to-GREEN coverage, including compact-landscape geometry, the affected Web selection is green,
all workspace packages lint and build,
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
- Root media/design artifact scan, committed range `617033b..466436f`: none.
- `git diff --check 617033b..466436f`: pass.

## Dogfood-Your-Slice

Scope verdict: required; this changes an installed-PWA user journey.

- Detached worktree: `E:\ClowderAI\clowder-ai-f010-verify-466436f`
- Exact candidate: `466436f`
- Production build environment: `NEXT_PUBLIC_API_URL=http://localhost:4311`
- Final Web artifact: BUILD_ID `NLgMJFRRSV9bzl_iQLbc5`
- `http://localhost:4312/`: HTTP 200 from PID `35176`
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
| Focused/affected Vitest selection | 10 files, 91 tests passed |
| `pnpm --filter @cat-cafe/web exec tsc --noEmit` | exit 0 |
| Targeted Biome on the 7 changed executable/test files | 0 errors, 0 warnings |
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
- `pnpm gate`: reaches the clean-worktree and singleflight checks, then Step 1 tries to rebase the
  historical F010 snapshot onto the unrelated current `origin/main` lineage and produces repository-
  wide add/add conflicts. The disposable verifier was restored with `git rebase --abort`; the target
  worktree stayed clean. This is branch-lineage drift, not a validation failure in the F010 slice.

## Fresh-context findings

An independent fresh-context scan reviewed `6786790` before formal review and returned four
findings. All four are closed in the exact candidate or this evidence update:

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| FC-1 | P1 | A width-changing unusable pulse could stage a poisoned baseline and bypass the height guard | Fixed in `466436f`; a RED-to-GREEN regression now preserves both committed width and height until the usable terminal frame |
| FC-2 | P2 | The serve guard's unbounded regex could borrow routes from another HTTPS listener block | Fixed in `466436f`; the parser now isolates the exact `:8443` block and has 2/2 node:test coverage |
| FC-3 | P2 | Quality evidence still named an older candidate/build | Fixed in this report with the exact `466436f` detached artifact and BUILD_ID |
| FC-4 | P3 | The bug report's focused count lagged the added landscape test | Fixed in `466436f`; the report now records 23/23 focused and 91 affected tests |

## Formal review and isolated deployment

- Independent formal reviewer verdict for exact code SHA `466436f`: **APPROVE**.
- Findings: **P1=0, P2=0, P3=0**. FC-1/FC-2 were marked `[FC:covered]`; evidence-only
  FC-3/FC-4 were marked `[FC:N/A]` and verified closed at evidence head `5271586`.
- Reviewer independently reproduced focused Vitest 23/23, parser 2/2, Web TypeScript, targeted
  Biome, and `git diff --check`; executable blobs at code candidate and evidence head are identical.
- After approval, old Web PID `17084` / BUILD_ID `davuSC0P3wlGS5zAgfHp-` was replaced on isolated
  acceptance port 4310 by PID `47400` serving exact BUILD_ID `NLgMJFRRSV9bzl_iQLbc5`.
- Local root, Tailscale `:8443` root, same-origin `/api/cats`, and same-origin Socket.IO handshake
  returned HTTP 200. The roster contains `opus,sonnet,opus-45,fable-5`.
- API port 4311 remains PID `7580`; it was not rebuilt, restarted, or modified.
- Hub Browser Preview opened the deployed current-thread route on port 4310.
- Main merge is not claimed: the historical F010 branch cannot pass latest-main rebase/full gate.
  Installed-iPhone replay remains the release acceptance boundary.

## Capability tips

No new discoverable capability or guide is introduced. This is a corrective invariant inside an
existing mobile chat and transport path; the F244 checker passes without a new user tip.

[丢丢/gpt-5.6-sol🐾]
