---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [aiops, inspection, draft-page, quality-gate]
doc_kind: review
created: 2026-08-23
updated: 2026-08-24
---

# AI 巡检草案页直观性改版 — Quality Gate

Spec: `designs/ai-inspection-copilot-offline-demo/DESIGN-DRAFT-PAGE.md`

原始需求：co-creator 在 thread `thread_msg13xc7dv3dp4fb` 反馈“任务草案的内容分布看不懂，建议修改得更直观”。

## 愿景覆盖

| operator 体验 | AC | 实现 |
|---|---|---|
| 打开草案先知道自己要做什么 | D1 | AI 建议置顶；无候选时不渲染确认区 |
| 不再自己换算“必查 / 建议 / 待确认” | D2 / D3a | 单句动态摘要区分执行数、必处理建议与可选建议 |
| 操作用人话表达 | D3 | `加查 / 不查`，禁用按钮直接指向上方建议 |
| 默认不被技术细节淹没 | D4 | 正式检查默认单行，指标、规则、动作、来源按需展开 |
| 不改变候选门禁和审计语义 | D5 | reducer 未改；selector 只补呈现计数，候选仍写入原 disposition ledger |
| 手机端不横溢、不遮挡主动作 | D6 | 390px browser assertion 覆盖横溢、按钮归属和文案 |

## 功能验收

| AC | 状态 | 代码 / 证据 |
|---|---|---|
| D1 | ✅ | `src/render-plan.mjs`; `evidence/05-draft-action-first.png` |
| D2 | ✅ | `selectPlanSummary()` / `renderPlanSummary()`；UI contract + browser assertion |
| D3 | ✅ | `renderCandidate()` / `renderPlanAction()`；已处理项保留可改选按钮 |
| D3a | ✅ | `medium` 候选显示“可选建议”并保持主按钮可用；`high` 候选仍显示“需要你确认”并阻断 |
| D4 | ✅ | `renderCheck()`；browser 在展开前看不到指标、展开后可见完整字段 |
| D5 | ✅ | 产品 86/86；离线 Chrome 覆盖 `加查 → 不查 → 再加查`，完整 journey 通过 |
| D6 | ✅ | 390px `noOverflow=true`，主按钮位于 `[data-testid=inspection-plan]` 内 |

## Dogfood-Your-Slice

Scope verdict: ✅ 必做（用户可见 UI 改版）

端到端路径一：payment 配置变更 → 确认影响面 → 必处理草案 → `加查 → 不查 → 再加查` → 展开检查细节 → 确认并开始巡检。

端到端路径二：fulfillment 自定义巡检 → 可选建议 → 不处置候选直接开始巡检。

- Worktree: `E:/ClowderAI/cat-cafe-ai-inspection-draft-clarity`
- Preview: `http://127.0.0.1:4173/`
- 截图：`evidence/05-draft-action-first.png`、`evidence/05-plan-contract-expanded.png`、`evidence/11-draft-optional-suggestion.png`
- 录屏：`evidence/15-dual-entry-inspection-journey-15s.webm`（16.175s）
- 发现并当轮修复：fresh-context 指出 `medium` 候选被误写为必处理；现按 `requiredPending / optionalPending / reconciliationBlocked` 分开表达。

## 设计与架构检查

- `.pen`：按 `ai-inspection|draft` 关键词无匹配；本 slice 以 `DESIGN-DRAFT-PAGE.md` 为设计真相源。
- Architecture cell: offline demo presentation layer.
- Map delta: none.
- Why: 只重排和改写现有草案 renderer / CSS，不新增 Store、Queue、Router、Adapter 或持久化字段。
- Capability tips: exempt；这是既有流程的纯呈现修订，没有新增入口或可发现能力。
- Fallback layers: 仓库未提供 `scripts/check-fallback-layers.mjs`；人工 diff audit 未发现 fallback 层增长。
- Architecture ownership / capability tips 检查脚本在该开源仓库不可用；`tips_exempt` 已在设计 spec 中声明。
- Follow-up tail scan: fresh-context 的两个 P2 均已闭合，无未处置尾巴。
- Artifact hygiene: 仓库根目录无媒体工件；截图与录屏位于正式 `evidence/` 目录。

## 验证证据

- `pnpm check`（产品目录）→ 86/86，offline Chrome 0 network requests / 0 browser errors。
- `pnpm exec biome check <changed source/tests>` → exit 0。
- `$env:PATH='C:\Program Files\Git\bin;'+$env:PATH; pnpm check`（仓库根）→ exit 0；未加 Git Bash 的第一次环境运行因 `bash` 不在 PATH 得到 `exitCode=null`，不计绿。
- 同一 Git Bash PATH 下 `pnpm lint` → exit 0（仅既存 warnings）。
- 同一 Git Bash PATH 下 `pnpm -r --if-present run build` → exit 0。
- `pnpm test`（仓库根）→ Windows 不适用：package script 使用 Unix inline env assignment，API 报 `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT is not recognized`；仓库 Windows 合入真相源是 `pnpm gate` 的 Windows Smoke + 远端 Test (Public)。
- Exact-HEAD `pnpm gate`：提交后、请求 review 前执行；结果随 review packet 绑定 exact SHA，避免写回报告再次改变 review object。

## Gate 结论

Spec / UX / product acceptance 已闭合。正式 review 前仍须在最终提交对象运行仓库规定的 `pnpm gate`；任何失败均阻断 review 请求。
