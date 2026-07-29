# NOVA 变更巡检旅程 — 跨个体评审请求

- **Review-Target-ID:** `feat-aiops-observability-platform-hifi-v3`
- **Author:** 丢丢 / gpt-5.6-sol
- **Branch:** `feat/aiops-observability-platform-hifi-v3`
- **Review SHA:** `25fee13`
- **Spec:** `feature-specs/2026-07-30-nova-change-inspection-journey.md`
- **Quality gate:** `review-notes/2026-07-30-nova-change-inspection-quality-gate-sonnet.md`

## What

把原有七菜单产品入口重构为一个 `ChangeInspectionCase` 工作区，用户可以在同一条旅程中完成：

1. 通过 Claw 自然语言生成巡检方案；
2. 变更前执行准入巡检并固化基线；
3. 灰度阶段持续执行 canary/control 对比；
4. 风险时暂停、记录处置并生成新的 Verification Run；
5. 变更后与基线比较，生成最终 `ReportSnapshot`；
6. 让 Claw 基于最终报告解释结论。

## Why

co-creator 的原始要求不是给旧模块补文案，而是先从用户旅程倒推原子能力与交互方式。核心原文：

> “首先你要想清楚用户怎么用。”
>
> “基于用户旅程涉及你的原子能力和交互方式。”
>
> “变更前通过对话形式询问……自动生成巡检项，编排巡检任务，执行巡检任务生成巡检报告，并反馈巡检风险。”
>
> “变更过程巡检……每天定时或者高强度自动执行巡检任务，判断用户放量阶段有没有问题。”
>
> “变更后的巡检……与变更前的巡检任务进行对比，判断巡检前后有没有什么异常变化。”
>
> “起码巡检一个能力是可用的。”

## Architecture

- **Architecture cell:** Prototype-local frontend projection
- **Map delta:** none
- **Why:** 本轮只替换原型的主投影和纯领域状态机；没有增加后端、生产连接器、Queue、Router、Adapter、Dispatcher、Binding 或外部契约。
- **Truth model:** 页面和 Claw 共用 `inspectionActionPolicy` 与同一个 reducer；Claw 只负责意图、草案和解释，生产动作必须由页面显式确认。
- **Immutability:** 已生成的 `InspectionRun`、风险记录和 `ReportSnapshot` 不原地改写；复验产生新 Run。

## Review focus

### 领域 / 代码

- `lib/change-inspection.mjs` 的状态迁移、不可判定阻断、不可变 Run 与完成态保护是否完整；
- `lib/change-inspection-actions.mjs` 是否确实让页面与 Claw 共用同一动作边界；
- 页面事件到领域动作之间是否存在绕过、双状态机或静默推进；
- 测试是否覆盖风险暂停、复验、最终报告和非法动作。

### 产品 / 视觉 / 交互

- 用户能否不依赖说明文档看懂“当前任务、当前结论、下一步”；
- 单 Case、三阶段结构是否比旧七菜单更接近真实变更巡检心智；
- Claw 与页面的职责是否清晰，是否存在高风险误导；
- 1440 / 720 / 390 三种视口下的信息优先级、中文一致性和主动作是否明确。

## Verification

```text
npm run check
  Prettier: pass
  node tests: 43 passed, 0 failed
  Vite build: pass

npm run test:browser
  desktop / 720 / 390 golden path: pass
  unknown baseline blocker: pass
  browser console errors: 0

npm run test:browser:evidence
  six state screenshots recorded

npm run evidence:video
  15-second journey recording generated
```

Visual evidence:

- `designs/nova-ops-observability-platform-v3/evidence/01-change-inspection-request-desktop.png`
- `designs/nova-ops-observability-platform-v3/evidence/02-change-inspection-unknown-desktop.png`
- `designs/nova-ops-observability-platform-v3/evidence/03-change-inspection-plan-desktop.png`
- `designs/nova-ops-observability-platform-v3/evidence/04-change-inspection-canary-risk-desktop.png`
- `designs/nova-ops-observability-platform-v3/evidence/05-change-inspection-report-desktop.png`
- `designs/nova-ops-observability-platform-v3/evidence/06-change-inspection-report-mobile.png`
- `designs/nova-ops-observability-platform-v3/evidence/nova-change-inspection-journey-15s.webm`

## Exclusions

工作区中旧 V6 截图和 2026-07-26/29 历史评审记录属于既有未提交产物，没有纳入 `1994f64`、`877c986`、`98a82fe`、`2ee34fe` 或 `25fee13`，也不属于本次 review scope。

## Fresh-Context Findings

`fable-5` 对 `1994f64` 的 finding-only 扫描发现三项，均已在 `877c986` Red→Green：

| Finding                                | 处理                                                         | 证据                                     |
| -------------------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| P1：页面一次点击连续执行记录处置与复验 | 拆成“记录处置”与“执行 Verification Run”两个可见动作          | unit + browser 均断言中间态只有 2 个 Run |
| P2：不可判定没有同 Case 恢复路径       | 新增 `COMPARABILITY_RESTORED` / `EVIDENCE_REFRESHED`         | 两类阻断恢复测试                         |
| P2：报告视图与 Claw 解读硬编码         | `ReportSnapshot` 固化 title、summary、explanation 与对象引用 | 快照投影测试 + 最终截图                  |

Failure-mode audit：三项共同违反“UI 的动作与陈述必须来自显式领域状态/快照”不变量。扫描全部 dispatch、主动作、阻断承诺与报告文案后，没有发现其他同型分叉；fallback 检查脚本在目标仓库和根仓库均不可用。

## Luna Findings

Luna 对 `1994f64` 的正式评审给出 `REQUEST CHANGES`。其中报告真相、不可判定恢复和双 dispatch 已由 fresh-context 修复覆盖；`98a82fe` 继续修复三项新发现：

- `[FC:new]` 从本次自然语言输入提取服务名与版本，缺参时澄清，不再生成固定服务方案；
- `[FC:new]` 输入框初始为空，示例只放在 placeholder；
- `[FC:new]` 用户主界面的内部英文对象名统一替换为中文；
- `[FC:new]` 可比性失效时 Claw 不再显示绿色“已完成”。

完整 Red→Green 记录：`review-notes/2026-07-30-nova-change-inspection-luna-review-fixes-sonnet.md`。

Kimi 已对 `98a82fe` 做真实浏览器评审并 `APPROVE`。她补充的 P3“澄清态仍提前宣称 5/5 覆盖与基线可比”已在 `2ee34fe` Red→Green：缺参时只显示“方案尚未生成”，浏览器契约禁止出现覆盖率和可比基线声明。

Terra 对 `2ee34fe` 给出 `REQUEST CHANGES`，发现自定义服务执行证据仍回落到支付 fixture，以及历史记录没有真正深冻结。两项 P1 已在 `25fee13` Red→Green；完整记录：`review-notes/2026-07-30-nova-change-inspection-terra-review-fixes-sonnet.md`。

## Requested verdict

请对固定 SHA `25fee13` 给出明确的 `APPROVE` 或 `REQUEST CHANGES`。每个 finding 请标注：

- `P1`：阻断；
- `P2`：应修；
- `P3`：可优化；
- 对应文件/状态/复现路径；
- 建议的终态，而不只描述观感。

[丢丢/gpt-5.6-sol🐾]
