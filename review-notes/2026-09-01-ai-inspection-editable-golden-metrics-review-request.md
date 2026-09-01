---
feature_ids: [F257]
topics: [aiops, inspection, golden-metrics, rule-editing, parallel-execution, trend-evidence, review-request]
doc_kind: review_request
created: 2026-09-01
---

# Review Request: AI 巡检可编辑黄金指标与并行直跑

Review-Target-ID: feat-ai-inspection-editable-metrics
Branch: feat/ai-inspection-editable-metrics
Product / UI continuity SHA: `a343231710282fdd442d7ea867858e6375d71a00`
Fresh-context closure SHA: `a978224cc5a2816482b7226bcf24724dd9601581`

## What

- 将每张检查卡下钻为具体业务/服务黄金指标，展示指标名、metric ID、单位、采集能力、来源、比较符和阈值。
- SRE 可在目录白名单内编辑比较符与阈值；确认后规则一次物化进 immutable `InspectionPlan.checks[].metricRules`。
- 删除无依赖检查的逐项排队与“运行下一项”状态机；一次确认即批量完成所有检查并生成 Run/Report。
- 报告从锁定 measurement 快照展示折线、阈值线、当前值与状态；历史、复制和导出共享同一报告真相。
- 收口 fresh-context 暴露的旧门禁文案、运行时补造趋势、legacy comparison 旁路及过期 AI 稳定叙述。

## Why

此前“可用信号 → 将执行的检查”只给出粗粒度能力与固定文本规则，SRE 看不到实际业务黄金指标，也不能按场景调整门禁；无依赖检查被顺序 UI 表达成队列；最终报告只有当前值，缺少判断变化趋势所需的证据。终态应是“规则可审、一次直跑、证据可追溯”，同时继续保持 AI 只解释锁定证据、不参与裁决。

## Original Requirements（必填）

> operator 希望“将执行的检查”继续下钻到具体业务黄金指标，而不是停留在宽泛的可用信号维度。
>
> 检查中写明的判定规则应由具体 SRE 编辑，但采集能力、来源和指标语义仍受目录约束。
>
> 多个验证之间没有先后依赖时，应直接一次执行，不再用逐项步骤制造虚假的顺序关系。
>
> 巡检报告需要列出关键指标的折线证据，让当前值与阈值之外还有趋势上下文。
>
> 修改应继续落在既有离线任务中，并保持离线、可复访、可复制和可导出的完整体验。

- 来源：thread `thread_msg13xc7dv3dp4fb`，message `0001788191112860-000075-59a5a1aa`
- 规格真相源：`feature-specs/2026-08-31-ai-inspection-editable-golden-metrics.md`
- **请对照上面的 operator experience 判断交付物是否真正解决了问题。**

## Tradeoff

- 只允许编辑指标目录声明的比较符和有限阈值，不开放 PromQL、SQL、脚本或任意新指标录入。
- 趋势点必须来自持久化 raw fixture evidence；numeric measurement 缺 series 时新 Run fail closed，不在运行时合成曲线。
- `executionResults` 只保留为没有结构化 report 的 legacy comparison fallback；新 Run 始终优先 locked `report.checkResults`。
- 本 PR 不接生产数据源、不新增 provider adapter、DAG 编排、定时任务或自动处置。

## Architecture Ownership（必填）

Architecture cell: observability inspection control plane / AI inspection offline demo
Map delta: none
Why: 本 PR 只演进既有 Check Contract、session reducer 与 immutable Run/Report projection；没有新增 Store、Queue、Router、Adapter、Dispatcher、Binding 或生产数据边界。

请 reviewer 检查：

- diff 是否与 `Map delta: none` 一致；
- `MetricCatalogEntry → Check.metricRules → locked InspectionPlan → deterministic evaluator → immutable Run/Report` 是否保持唯一规则与证据链；
- transient override 是否只在 plan 阶段可写，确认后是否无法改写 locked plan；
- legacy 兼容是否只读旧数据，而没有弱化新 Run 的结构化报告真相；
- 是否意外形成并行 Store、Queue、Router、Adapter、Dispatcher 或 Binding。

## Open Questions

### 技术 OQ（给 reviewer）

1. 所有入口——首访计划、Playbook 复用和保存任务直跑——是否都通过一次确认完成整批检查，并恰好追加一个 Run？
2. 编辑后的门禁是否同时驱动 check status、Evidence Verdict、Action、摘要和 AI 解读，且不会泄漏旧规则叙述？
3. numeric measurement 缺持久化 series 时是否 fail closed；定性 evidence 是否始终不会伪造折线？
4. 当前报告、历史、复制、导出和运行对比是否都优先读取同一 locked `report.checkResults`？
5. 390px、键盘/可访问名称与单文件离线构建是否仍满足 0 HTTP(S) 请求、0 browser error？

### 价值 OQ（给 operator，如有）

无——本轮价值边界已由原始需求确定；目录约束、legacy fallback 和 fail-closed 属于可回滚技术选择，由猫猫自决。

## Fresh-Context Findings

Agent: `[宪宪/gpt-5.4🐾]`
SHA scanned: `a343231`；修复后 scoped recheck `a978224`
Total findings: 3（0 P1、3 P2、0 P3），全部 closed；scoped recheck 为 0 remaining findings。

| # | Finding | Author 处置 | 状态 |
|---|---|---|---|
| FC-1 | 编辑门禁后通过态摘要仍泄漏旧阈值 | 从 materialized rule truth 重写 locked summary；回归覆盖 5ms 不再显示 6ms（`a978224`） | ✅ closed |
| FC-2 | 标量测量在运行时被补造成虚构趋势 | 只复制持久化 numeric series；缺 series 时 fail closed（`a978224`） | ✅ closed |
| FC-3 | 新运行对比仍读取 legacy `executionResults` | 优先 locked `report.checkResults`，legacy 仅无结构化报告时回退（`a978224`） | ✅ closed |
| FC-audit | 裁决变化后复用旧“保持稳定”AI 叙述 | execution truth 改变时抑制旧叙述并从锁定证据投影（`a978224`） | ✅ closed |

Fable 在 exact `a978224` 独立复跑 targeted 18/18 与 diff hygiene，返回 0 findings。请正式 reviewer 在 findings 中标注 `[FC:covered]`、`[FC:new]` 或 `[FC:N/A]`。

## Formal Review Round 1 Fixes

山本在 PR head `18884c7` 返回 `REQUEST_CHANGES`：

- P1：部分可编辑规则没有同源 numeric measurement，编辑后不参与锁定裁决。
- P2：新 Run 继续持久化计划外 `workspace.execution`，拒绝的候选仍留在第二份执行真相中。

作者按 Red→Green 收口为一个 plan/evidence projection 不变量：

- order、payment、generic 三类 fixture 的每条 editable rule 都有 numeric value 与持久化 series；参数化测试逐条改变门禁并验证 locked report。
- materialization 改为 rule-first；缺失或非 numeric 的 editable evidence 显式变为 `NotEvaluated`，不再静默继承通过态。
- 新 Run 不再写 `executionResults`；selector 仍可只读没有 structured report 的 legacy Run。
- 四入口覆盖 generated、playbook、generic first-use 与 saved direct-run；拒绝候选不出现在完整 Run snapshot。
- Chrome dogfood 额外收口多规则展示：同一 check 内通过的 measurement 不再继承 sibling violation。

修复 exact SHA 与 clean-tree `pnpm gate` 结果在 Round 2 A2A handoff 中提供。

## Next Action

请山本在 detached/read-only sandbox 对远端最终 exact HEAD 做跨个体正式 review：

- 对照原始需求和 AC-G1～G8 做愿景与契约检查；
- 独立复跑高风险测试并打开单文件 Demo，实际走通规则编辑 → 一次并行直跑 → 趋势报告 → 历史/复制/导出 → 390px；
- 返回 `APPROVE — <exact SHA>` 或带可复现 P1/P2 的 `REQUEST_CHANGES`；
- 若放行，将 logical approval 作为 PR #14 comment 落到 GitHub 时间线，写明 exact SHA、独立验证证据与签名。

## Review Sandbox（必填）

- Logical Path: `/tmp/cat-cafe-review/feat-ai-inspection-editable-metrics/opus`
- Windows Path: `E:\ClowderAI\review-sandboxes\feat-ai-inspection-editable-metrics\opus-<sha>`
- Start Command: `python -m http.server 4183 --bind 127.0.0.1 --directory designs/ai-inspection-copilot-offline-demo`
- Ports: `web=4183`, `api=n/a`（静态离线 Demo）

### 沙盒 Bootstrap

```powershell
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
pnpm install --frozen-lockfile
pnpm --dir designs/ai-inspection-copilot-offline-demo check
python -m http.server 4183 --bind 127.0.0.1 --directory designs/ai-inspection-copilot-offline-demo
```

## 自检证据

### Spec 合规

- Plan：`feature-specs/2026-08-31-ai-inspection-editable-golden-metrics.md`
- Feature truth：`docs/features/F257-ai-inspection-real-system.md`
- Architecture：`designs/ai-inspection-copilot-offline-demo/ARCHITECTURE.md`
- AC-G1～G8 全部闭合，无删除或 waiver。
- UI continuity：烁烁在 `a343231` 检查四项原始体验后 APPROVE；后续 `a978224` 只收口 evidence truth 与回归。
- Fresh-context：Fable 对 `a978224` 的 FC-1～FC-3 + 同型 audit scoped recheck 为 0 findings。

### 测试结果

```text
pnpm --dir designs/ai-inspection-copilot-offline-demo check
  100/100 passed
  offline Chrome: 0 network requests, 0 browser errors

node --test tests/editable-golden-metrics.test.mjs tests/saved-inspections.test.mjs
  18/18 passed（Fable 独立复跑）

pnpm gate
  passed on exact HEAD a978224cc5a2816482b7226bcf24724dd9601581

git diff --check a343231..a978224
  clean
```

### 前端证据

- 规则编辑：`designs/ai-inspection-copilot-offline-demo/evidence/05-plan-contract-expanded.png`
- 异常趋势报告：`designs/ai-inspection-copilot-offline-demo/evidence/02-electronic-flow-pause.png`
- 390px 报告：`designs/ai-inspection-copilot-offline-demo/evidence/19-mobile-report-v2.png`
- 离线录屏：`designs/ai-inspection-copilot-offline-demo/evidence/15-dual-entry-inspection-journey-15s.webm`（16.18 秒）

### 工件门禁

- `git status --short` 根目录媒体匹配：none
- `git diff --name-only origin/main...HEAD` 根目录媒体匹配：none
- 媒体证据均在正式 `designs/ai-inspection-copilot-offline-demo/evidence/` 目录。
