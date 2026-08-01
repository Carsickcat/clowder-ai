# Review Request: NOVA product walkthrough HTML deck rewrite

Review-Target-ID: nova-inspection-product-deck

Branch: feat/nova-inspection-product-deck

Review range: 6b5bf23..HEAD

## What

重写一份 12 页离线 HTML 产品演示稿及低保真蓝图：

- 使用 `payments-router / production / v3.18.0 / CHG-2481` 贯穿完整案例。
- 以真实产品工作台形式讲解七步：选择对象、生成候选、编辑发布、阶段执行、A/B 报告、风险治理复验、固化最终报告。
- 单独说明 CLAW 的三个使用场景与“CLAW 建议、页面确认”边界。
- 强化桌面/手机合同，并为内容方向增加回归测试。

## Why

上一版将产品介绍写成了架构原则与规划宣言，没有回答“产品有什么、用户怎么用”。co-creator 明确退回并要求由主架亲自重写。

## Original Requirements

> “你作为主架你来写吧，主要介绍下你的产品功能，用户怎么用，不是让你给这喊口号定计划呢”

- 来源：thread_mrrzdymcf3z6bx77，co-creator message `0001785564964639-000103-ae844043`
- 请 reviewer 以此为首要验收标准，而不是只审视觉是否漂亮。

## Tradeoff

- 选择 12 页 screenshot-like 产品 walkthrough，而非抽象架构/路线图；更具体，但不展开完整领域模型讨论。
- 使用可选择文字、可重排的单文件 HTML，而不是 raster 幻灯片；保证手机阅读、离线与可访问性。
- 下一版能力统一标注“目标体验演示”，避免把 proposal 冒充当前已上线 connected 能力。

## Architecture Ownership

Architecture cell: presentation artifact  
Map delta: none  
Why: 只修改静态演示、低保真稿和合同测试，不改变 runtime、Store、Router、Adapter、connector 或数据边界。

## Open Questions

### 技术 / 产品 OQ

1. 12 页是否真正以“功能 + 用户操作”为主，而不是换了一层皮的口号。
2. 产品 UI 是否能让首次接触 NOVA 的发布/SRE 人员理解每一步输入、反馈与下一动作。
3. `目标体验演示`、只读 connector、UNKNOWN、CLAW 权限边界是否足够清楚，不误导为当前生产能力。
4. 桌面与 390px 手机是否有裁切、叠页、过密或难以滚动的内容。

### 价值 OQ

无。

## Next Action

请对 exact HEAD 做只读 review，给出 APPROVE 或带 P1/P2/P3 的 REQUEST-CHANGES。重点审产品讲解与使用旅程，其次审视觉层级和移动阅读；不要重做已冻结的产品方向。

## 自检证据

- Quality gate：`review-notes/2026-08-01-nova-inspection-product-deck-quality-gate.md`
- deck contract + browser：6/6
- NOVA tests：53/53
- NOVA Vinext build：通过
- npm audit high：0 vulnerabilities
- root lint/build：exit 0
- `git diff --check`：通过
- 根目录媒体工件：无

### 视觉证据

- `%TEMP%/nova-inspection-product-deck-evidence/desktop-cover.png`
- `%TEMP%/nova-inspection-product-deck-evidence/desktop-candidates.png`
- `%TEMP%/nova-inspection-product-deck-evidence/desktop-comparison.png`
- `%TEMP%/nova-inspection-product-deck-evidence/desktop-final-report.png`
- `%TEMP%/nova-inspection-product-deck-evidence/mobile-workspace.png`
