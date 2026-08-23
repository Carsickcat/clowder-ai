---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [aiops, inspection, draft-page, review-request]
doc_kind: review
created: 2026-08-24
---

# Review Request: AI 巡检草案页行动优先改版

Review-Target-ID: feat-ai-inspection-draft-clarity
Branch: feat/ai-inspection-draft-clarity
PR: https://github.com/Carsickcat/clowder-ai/pull/12
Product / design continuity SHA: `ddbd418eb4ec28e2be8d2d61937f0af76a1029a9`

## What

- 草案页把需要用户表态的 AI 建议置顶，并用一句话概括执行数与待处理状态。
- 高关键度候选显示为必处理建议并阻断执行；中关键度候选显示为可选建议且不阻断。
- 正式检查降级为可展开的执行清单，候选按钮改为 `加查 / 不查`。
- 保留候选处置 ledger、既有门禁和阶段流，并补齐双向改选及离线浏览器回归覆盖。

## Why

原草案页把无需逐项操作的正式检查放在首屏主视觉，把真正需要用户判断的 AI 候选压到下方；用户无法快速回答“现在要我做什么”。本改版按行动优先重新组织信息，同时保证 UI 文案不夸大真实门禁。

## Original Requirements（必填）

> “任务草案的内容分布看不懂，建议修改得更直观。”
> 打开草案页应先看清需要自己处理什么，再按需查看系统将执行的检查。

- 来源：thread `thread_msg13xc7dv3dp4fb`；设计真相源 `designs/ai-inspection-copilot-offline-demo/DESIGN-DRAFT-PAGE.md`
- **请对照上面的摘录判断交付物是否解决了 operator 的问题。**

## Tradeoff

没有把所有 AI 候选都升级为硬门禁，也没有重写 reducer 或持久化 ledger。选择通过 selector 派生 `requiredPending / optionalPending`，让呈现准确反映现有领域规则；代价是草案页多一种中性的“可选建议”视觉态。

## Architecture Ownership（必填）

Architecture cell: offline demo presentation layer
Map delta: none
Why: 仅重排现有 renderer / CSS 并增加只读 selector 派生状态；没有新增 Store、Queue、Router、Adapter、Dispatcher、Binding 或持久化字段。

请 reviewer 检查：

- diff 是否与 `Map delta: none` 一致；
- 是否意外改变候选 ledger、执行门禁或阶段流；
- selector 的派生计数是否与 renderer 的文案和按钮状态一致。

## Open Questions

### 技术 OQ（给 reviewer）

1. `high 必处理 / medium 可选 / reconciliation blocked` 三类状态是否在所有草案入口保持一致？
2. `accepted → rejected → accepted` 回切是否同时守住 summary、ARIA 状态和 committed checks？
3. 390px 移动端是否保持无横溢、主动作无遮挡？

### 价值 OQ（给 operator，如有）

无。

## Fresh-Context Findings

Agent: `[宪宪/gpt-5.4🐾]`
SHA scanned: `21b5c3c`，修复后复验 `ddbd418e`
Total findings: 3（0 P1、2 P2、1 P3）

| # | Finding | Author 处置 | 状态 |
|---|---|---|---|
| FC-1 | medium 候选被写成必处理，与真实门禁分叉 | fixed：拆分 required / optional / reconciliation 状态（`ddbd418e`） | ✅ closed |
| FC-2 | 缺少 accepted / rejected 双向回切测试 | fixed：单元与离线 Chrome journey 均覆盖（`ddbd418e`） | ✅ closed |
| FC-3 | README 仍使用旧术语 | fixed：同步一句话摘要、`加查 / 不查`、执行清单术语（`ddbd418e`） | ✅ closed |

Fable 在 `ddbd418e` scoped recheck 中确认 `0 remaining findings`。正式 reviewer 请在 findings 中标注 `[FC:covered]`、`[FC:new]` 或 `[FC:N/A]`。

## Next Action

请对 PR #12 的最终 exact head 做跨个体正式 review，实际打开静态 demo 操作以下路径：

1. high 候选：按钮阻断，`加查 → 不查 → 再加查` 后状态与执行清单同步；
2. medium 候选：显示“可选建议”，不处置也能直接开始；
3. 展开正式检查后六字段完整，390px 无横溢。

若放行，请把 logical approval 作为 PR comment 落到 GitHub 时间线，并写明覆盖的 exact SHA。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/feat-ai-inspection-draft-clarity/opus`
- Start Command: `python -m http.server 4174 --directory designs/ai-inspection-copilot-offline-demo`
- Ports: `web=4174`, `api=n/a`（静态离线 demo）

### 沙盒 Bootstrap

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
pnpm --dir designs/ai-inspection-copilot-offline-demo check
python -m http.server 4174 --directory designs/ai-inspection-copilot-offline-demo
```

## 自检证据

### Spec 合规

- Quality gate：`review-notes/2026-08-23-ai-inspection-draft-clarity-quality-gate.md`
- AC-D1~D6 与新增 AC-D3a 全部闭合。
- 烁烁对 product SHA `ddbd418e` 给出 Design Continuity APPROVE；Fable fresh-context recheck 为 0 remaining findings。

### 测试结果

```text
pnpm --dir designs/ai-inspection-copilot-offline-demo check
  86/86 passed
  offline Chrome: 0 network requests, 0 browser errors

pnpm exec biome check <changed source/tests>
  exit 0

$env:PATH='C:\Program Files\Git\bin;'+$env:PATH; pnpm gate
  exact product head ddbd418e: passed in 80s
```

### 前端证据

- `designs/ai-inspection-copilot-offline-demo/evidence/05-draft-action-first.png`
- `designs/ai-inspection-copilot-offline-demo/evidence/05-plan-contract-expanded.png`
- `designs/ai-inspection-copilot-offline-demo/evidence/11-draft-optional-suggestion.png`
- `designs/ai-inspection-copilot-offline-demo/evidence/15-dual-entry-inspection-journey-15s.webm`

### 工件闸门

- `git status --short` 根目录媒体匹配：none
- `git diff --name-only origin/main...HEAD` 根目录媒体匹配：none
- 所有截图和录屏均位于正式 `designs/.../evidence/` 目录。
