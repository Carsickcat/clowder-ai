# Review Request: AI 巡检离线 Demo 用户驱动产品形态

Review-Target-ID: `feat-ai-inspection-offline-demo`
Branch: `feat/ai-inspection-offline-demo`
Target commit: exact HEAD supplied in the A2A handoff
Continuity base: `a9810bd` (Terra's last explicit APPROVE)
Gate-format commit: `87cbb19 style(aiops): satisfy repository format gate`

## What

把离线 Demo 从“两个预置场景组成的演示器”重构为一个由用户创建巡检工作区的完整产品：

- 默认进入空白的巡检需求表单，而不是场景切换导航；
- 用户可自由描述巡检意图、目标服务，并可选关联电子流；
- 请求编译器将任意输入编译为影响范围、Check Contracts、证据和行动结论；
- 两个原有场景降级为可编辑的示例填充与验收 fixture，不再决定产品信息架构；
- `RESET` 新建空白工作区，不再切回某个固定场景；
- 离线单文件、Mock 数据、证据下钻、RC Agent 联动继续保留。

### Merge-gate continuity delta

Terra 放行 `a9810bd` 后，latest-main `pnpm gate` 发现本 Demo 的新增源码尚未经过根仓 Biome。`87cbb19` 仅执行仓库标准 formatter、重建确定性 `index.html`，并刷新本文与 `QUALITY-GATE.md` 中的 bytes/SHA-256；产品 22 项测试与两条 `file://` 浏览器旅程保持全绿。

## Why

作者此前把“至少 1–2 个场景可跑完全旅程”的验收要求误解成了产品边界。operator 明确纠正：验收场景只负责证明产品能力，产品本身必须由用户决定如何使用，不能把两个样例做成唯一入口。

## Original Requirements（必填）

> 基于这套方案结构，请烁烁输出高保真设计；
> 丢丢完成架构设计和编码；
> 山本完成验收；
> 输出一份不需要起端口的离线可验收 Demo；
> 要求最少 1–2 个场景可跑完全旅程，数据可以直接 Mock；
> 有一点你没搞清楚，这是一个完成的产品；
> 产品构建用户决定怎么使用，而不是你直接限制住两个场景给用户用。

- 来源：当前 thread 的 operator 原始任务与 2026-08-09 纠正；产品真相源：`feature-specs/2026-08-06-ai-inspection-copilot-offline-demo.md`
- 请对照上述体验判断：交付物是否已经是“用户定义巡检需求的产品”，而不是换皮后的场景演示器。

## Tradeoff

- 这是离线 Mock 产品，因此请求编译器用本地目录与确定性规则模拟真实知识图谱、Trace、指标目录和电子流；它证明产品形态与契约，不声称具备生产泛化能力。
- 任意自定义服务会走通通用巡检编译链；`order-api` 与 `payment-api` 仍保留较丰富的领域 Mock，用来证明正常与风险分支。
- 本轮不接入后端、LLM 或真实数据源，以守住“不起端口、断网可验收”的交付边界。

## Architecture Ownership（必填）

Architecture cell: standalone AI inspection product workspace
Map delta: none
Why: 在既有离线 Demo 边界内，将固定 Scenario 状态模型替换为 `InspectionRequest -> InspectionWorkspace`；未新增 Store、Queue、Router、Adapter、Dispatcher、Binding 或生产数据边界。

请 reviewer 检查：

- diff 是否和 `Map delta: none` 一致；
- `compiler.mjs` 是否只是离线产品编译边界，而不是泄漏到 UI 的第三套状态源；
- 示例 fixture 是否仍以任何方式决定导航、状态机或页面信息架构。

## Open Questions

### 技术 OQ（给 reviewer）

1. 任意服务名与自由文本是否真的贯穿理解、计划、执行、报告，而非只改标题；
2. 两个示例是否彻底降级为表单填充，代码里是否仍有隐蔽的 `scenarioId` 产品分支；
3. 自定义工作区、风险工作区和移动端结果是否都能从 `file://` 独立跑通；
4. reset、建议项增删、证据状态与行动状态是否保持一致。

### 价值 OQ（给 operator）

无。本轮价值方向已由 operator 的产品形态纠正明确。

## Next Action

请对当前 A2A 消息给出的 exact HEAD 做 scoped continuity review：

1. 核对 `a9810bd..HEAD` 除 canonical Biome 格式、重建产物、证据哈希与本 continuity addendum 外无行为 delta；
2. 如需独立复跑，执行 package `pnpm check`，确认 22/22 与双 `file://` 旅程仍绿；
3. 明确写出“放行延续到 `{HEAD}`”或给出剩余阻断项。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/feat-ai-inspection-offline-demo/opus`
- Start Command: `pnpm check`
- Ports: none（验收对象直接以 `file://` 打开，不启动服务）
- Package directory: `designs/ai-inspection-copilot-offline-demo`

## 自检证据

### Spec 合规

- Quality gate：`designs/ai-inspection-copilot-offline-demo/QUALITY-GATE.md`
- 用户纠正已写入产品真相源；状态模型已从 `Scenario` 改为 `InspectionRequest / InspectionWorkspace`；
- 页面首屏为用户输入，示例不再是导航或模式；
- 产物继续满足单文件、断网、无端口、Mock 数据与完整证据链。

### 测试结果

在 `designs/ai-inspection-copilot-offline-demo` 运行：

```powershell
pnpm check
```

作者本轮结果：

- 构建成功；
- 22/22 测试通过；
- 浏览器完成两条用户驱动旅程：非 fixture 的 `fulfillment-service` 为 `Verified -> Proceed`，风险请求为 `Violated -> Pause -> RC Agent`；
- HTTP(S) 请求 0，浏览器错误 0；
- 390px 原生移动视口无横向溢出；
- `git diff --check` 通过；
- latest-main 根仓 `pnpm gate` 在 `87cbb19` 通过：check、lint、build、Windows smoke、startup acceptance 全绿；
- `index.html` 80,987 bytes；
- SHA-256：`D66F2052B2BCD89DABD7E95C31B4CBEA4F8897BEE9F39F4C02F77EEA68B8C931`。

### 浏览器证据

- `evidence/00-user-defined-intake.png`
- `evidence/01-user-defined-proceed.png`
- `evidence/03-mobile-report.png`
- `evidence/06-user-directed-risk-walkthrough-15s.webm`

### 工作树说明

旧 `ACCEPTANCE.md` 内容早于本次产品形态纠正，已原样保留到工作树外的 `E:\ClowderAI\local-artifacts\ai-inspection-offline-demo\ACCEPTANCE.pre-final-review.md`（SHA-256 `C5697B3967939D6C90A21FCE4F311D792B5A4B7F39FF61C47281542C6971DE67`），未纳入提交或当前验收真相源。请 reviewer 以本请求、feature spec 和 `QUALITY-GATE.md` 为准。

[丢丢/gpt-5.6-sol🐾]
