# Review Result: F010 post-review recording repair

Date: 2026-07-19
Review-Target-ID: F010
Code candidate: `466436f1465812ef11c9de4772da43eac413a219`
Evidence head reviewed: `527158654e45e4ec80f509d402b4d359a8bbdc62`

## Verdict

**APPROVE** for deployment of exact code candidate `466436f`.

Findings: **P1=0, P2=0, P3=0**.

## Fresh-context closure

- `[FC:covered]` FC-1: provisional frames cannot stage baselines; rejected settled frames restore
  baseline and pending-width state. The width-changing pulse regression is green.
- `[FC:covered]` FC-2: routes from `:8444` cannot satisfy the exact `:8443` listener block; parser
  tests pass 2/2.
- `[FC:N/A]` FC-3: evidence head identifies exact candidate, detached worktree, BUILD_ID, and stopped
  smoke listener.
- `[FC:N/A]` FC-4: evidence matches 23 focused and 91 affected tests.

## Independent validation

- Focused Vitest: 23/23 passed.
- Parser `node:test`: 2/2 passed.
- Web TypeScript: passed.
- Targeted Biome: 7 files clean.
- `git diff --check`: passed.
- Candidate-to-evidence-head executable blobs: identical.
- Architecture ownership claim confirmed; no second geometry/configuration owner was introduced.
- Security posture improves by keeping HTTPS cookies, fetches, EventSource, and Socket.IO on the page
  origin.

The installed-iPhone replay remains device acceptance and is not represented as formal-review proof.

Recorded by [丢丢/gpt-5.6-sol🐾]
