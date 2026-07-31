# Review Request: NOVA Durable Connected Inspection Control Plane

Review-Target-ID: `aiops-observability-platform-hifi-v3`

Branch: `feat/aiops-observability-platform-hifi-v3`

Behavioral commits: `9bf6206`, `3aa209b`

Behavioral range: `84ab200..3aa209b`

Original handoff HEAD: `19b50a0` (the only delta after `3aa209b` is this review-request document)

Full original handoff range: `84ab200..19b50a0`

## What

This slice adds a server-authoritative connected inspection control plane alongside the unchanged standalone demo boundary:

- durable SQLite Job/current revision/Case/Run/evidence/Decision/report lifecycle;
- reusable Jobs with owner-scoped current-revision detail and revision N+1 editing;
- server-registered replay and optional Prometheus read-only sources;
- deterministic fail-closed evaluation and immutable provenance;
- a connected Web operations page with no fixture fallback;
- schema V11 integrity hardening, atomic acceptance, active-Run exclusion and interrupted-Run recovery.

## Why

The reviewed standalone prototype proved the operator journey but kept Jobs in fixtures and Cases in browser memory. The operator asked us to make generated inspection tasks reusable and to build a genuinely usable connected system rather than a better-looking mock. The chosen connected sandbox persists operator state and executes server-owned observations while preserving the no-production-data/no-write-action boundary.

## Original Requirements

> 1. 用户生成的巡检任务可持久复用；
> 2. 建立真实可用、而非换皮 mock 的系统代码。
> Connected 与 standalone 显式分层；读取失败时 unknown/degraded，不回退 fixture。
> 第一阶段只读，不接生产数据，不执行发布、放量、回滚。

- 来源：`feature-discussions/2026-07-31-nova-connected-inspection-control-plane-meeting-notes.md`
- **请对照上面的摘录判断交付物是否解决了 operator 的问题。**

## Tradeoff

- SQLite and a process-level Store keep this local connected sandbox auditable and durable without introducing Redis/queue ownership. Multi-instance shared-DB execution is deferred; restart recovery currently assumes one Store owner.
- Replay remains a deterministic acceptance source, but is explicitly labelled as server replay data and binds check ID to its configured query. It cannot impersonate an arbitrary live query.
- Prometheus is optional, server-configured, loopback/dev/acceptance/staging only, and read-only. Production telemetry and production action APIs remain prohibited.
- Strong AuthN/AuthZ is not claimed. `X-Cat-Cafe-User` is a trusted loopback gateway identity boundary for this sandbox.
- Scheduler, lease/DLQ and production rollout integrations are intentionally excluded.

## Architecture Ownership

Architecture cell: `packages/api observability domain + packages/shared inspection contracts + packages/web observability surface`

Map delta: `none`

Why: the implementation stays inside the existing API/shared/Web ownership cells; the new Store and source Adapters are domain-local extension points rather than parallel application stores or routers.

请 reviewer 检查：

- diff 是否与 `Map delta: none` 一致；
- `SqliteInspectionStore` 是否 remains the only connected inspection truth source；
- Replay/Prometheus Adapters 是否只能通过 `ObservabilitySource` port 进入 evaluator；
- API entrypoint additions是否没有形成 demo→connected fallback 或新的 action dispatcher；
- schema V11 triggers 与 Store transactions 是否共同守住 parent-chain / immutability / atomic accept。

## Open Questions

### 技术 OQ（给 reviewer）

1. 请重点对抗审 `acceptLatestPassedRun()` 的 `BEGIN IMMEDIATE` 边界、terminal evidence insert trigger 和 same-Case active-Run exclusion。
2. 请检查 Store constructor 的 interrupted-Run recovery 是否在当前单实例契约下合理；未来多实例需要 lease/heartbeat，但本 slice 不宣称支持。
3. 请检查 Prometheus run-level deadline、scalar validation、redirect/byte-budget/secret redaction 是否仍有 fail-open。
4. 请检查 owner-scoped Job detail + revision editor 是否在无 Case、旧 Case 绑定旧 revision 两种状态下保持正确。
5. 新 Web 单页仍有 Biome cognitive-complexity P3 debt；请判断它是否影响本次行为审查，或需要在合入前拆分。

### 价值 OQ（给 operator，如有）

无。运行时边界已经由三猫讨论和 ADR-013 收敛，没有把技术 A/B 再抛给 operator。

## Fresh-Context Findings

Agent: `[丢丢/gpt-5.6-sol🐾]`（全新只读 session finding generator）

SHA scanned: `9bf6206`

Original scan: 5 findings (2 P1, 3 P2). Two supplementary focused scans expanded the same failure-mode families.

| # | Finding | Author 处置 | 状态 |
|---|---|---|---|
| FC-1 | Prometheus `Number(null|''|false)` 可变 0 假绿 | strict scalar validation + regression tests (`3aa209b`) | fixed |
| FC-2 | restart 后 connector ID scope 漂移未在执行时复验 | revise/run-time scope revalidation (`3aa209b`) | fixed |
| FC-3 | crash-left `running` Run 无 recovery | constructor recovery → failed/unknown + Case blocked + new key test (`3aa209b`) | fixed |
| FC-4 | distinct keys 可在同 Case 开多个 active Run | immediate transaction + active exclusion + idempotent replay (`3aa209b`) | fixed |
| FC-5 | connected Web 无 revision N+1 workflow | owner-scoped Job detail + revise helper/editor + reload tests (`3aa209b`) | fixed |
| FC-6 | terminal Run 仍可 INSERT 新 evidence，间接改变 report | schema V11 terminal insert trigger (`3aa209b`) | fixed |
| FC-7 | latest-pass check / Decision / report / Case seal 不原子 | single `acceptLatestPassedRun()` immediate transaction; rollback test (`3aa209b`) | fixed |
| FC-8 | Case/revision、Decision/Run、Report/revision parent chain 只靠 happy path | schema V11 durable parent-chain triggers + migration tests (`3aa209b`) | fixed |
| FC-9 | Replay 按 check ID 动态签任意 query digest | bundle query binding; mismatch → error/unknown; transparent replay UI (`3aa209b`) | fixed |
| FC-10 | Prometheus timeout 每 check 重置，可放大到约 40 秒 | one run-level deadline across all checks (`3aa209b`) | fixed |
| FC-11 | Prometheus 无 baseline 却接受 relative operators | source capability contract; create/revise reject unsupported relative checks (`3aa209b`) | fixed |
| FC-12 | caller 可自行提供 trusted user header | dismissed for this slice: explicit loopback gateway sandbox boundary, documented as non-AuthN; production readiness remains excluded | closed |

**Reviewer delta tracking:** 正式 reviewer 请在 findings 中标注 `[FC:covered]`、`[FC:new]` 或 `[FC:N/A]`。

## Next Action

请对最终 HEAD 做正式跨个体 review，给出明确 `APPROVE` 或 `REQUEST CHANGES`，每个 finding 标 P1/P2/P3。重点先读 ADR、implementation plan、quality-gate report，再独立复跑最高风险 API tests；不要仅依赖 author 证据。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/aiops-observability-platform-hifi-v3/opus`
- Start Command: `pnpm review:start`（或在 Windows reviewer checkout 使用等价隔离入口）
- Requested ports: `web=3213`, `api=3214`；若 allocator 改号，请在 verdict 中记录实际端口。

### Sandbox Bootstrap

PowerShell:

```powershell
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
pnpm install --frozen-lockfile
pnpm --filter @cat-cafe/shared build
pnpm --filter @cat-cafe/api run build
```

Bash equivalent:

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
pnpm --filter @cat-cafe/shared build
pnpm --filter @cat-cafe/api run build
```

## 自检证据

### Spec 合规

- Quality gate: `review-notes/2026-08-01-nova-connected-inspection-quality-gate-sonnet.md`
- AC-C1 through AC-C10: scoped PASS.
- Root media/design artifact gate: empty.
- Connected Browser Preview: production build on author-isolated `web=3113`, `api=3114`; Job→revision 2→reload→Case→Run→report→reload passed with console 0.
- Standalone browser acceptance: `file://`, interaction, network 0, console 0.

### 测试结果

```powershell
pnpm --filter @cat-cafe/api build
# PASS

node --test packages/api/test/observability/*.test.js
# 51 passed, 0 failed, 6 suites

$env:NODE_ENV='test'
pnpm --filter @cat-cafe/web exec vitest run `
  src/utils/__tests__/inspection-api.test.ts `
  src/components/__tests__/inspection-operations-page.test.tsx
# 16 passed, 0 failed, 2 files

pnpm --filter @cat-cafe/shared lint
pnpm --filter @cat-cafe/api lint
pnpm --filter @cat-cafe/web exec tsc --noEmit
# PASS

$env:NEXT_PUBLIC_API_URL='http://127.0.0.1:3114'
pnpm --filter @cat-cafe/web build
# PASS; /observability/inspections present

pnpm check:env-registry   # 3 passed
pnpm check:env-example    # 4 passed
pnpm check:env-ports      # 20 passed
pnpm check:features       # PASS

node designs/nova-ops-observability-platform-v3/tests/standalone.browser.mjs
# PASS: file://, network 0, console 0
```

Scoped Biome over 25 owned files exits 0 with no format/error finding. It retains 9 warnings in pre-existing aggregation/migration functions and the new single-page Web complexity; details are in the quality report.

Repository-wide `pnpm check`, start-profile isolation and two concurrently owned standalone build-identity assertions remain existing/shared blockers documented in the quality report. They are not represented as green and are not included in this connected commit.

### 相关文档

- Discussion: `feature-discussions/2026-07-31-nova-connected-inspection-control-plane-meeting-notes.md`
- Plan: `feature-specs/2026-07-31-nova-connected-inspection-control-plane-implementation-plan.md`
- ADR: `docs/decisions/013-nova-demo-connected-runtime-boundary.md`
- Quality gate: `review-notes/2026-08-01-nova-connected-inspection-quality-gate-sonnet.md`

---

[丢丢/gpt-5.6-sol🐾]
