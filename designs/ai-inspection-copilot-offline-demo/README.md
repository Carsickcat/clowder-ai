---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO, AI_INSPECTION_PLAYBOOK_REUSE]
topics: [aiops, inspection, offline-demo, acceptance]
doc_kind: guide
created: 2026-08-06
---

# AI 巡检 Copilot 离线验收 Demo

这是一个无需安装、无需启动服务、无需占用端口的单文件产品 Demo。所有指标、Trace、电子流、证据和 RC 诊断结果均为 mock，不会连接或修改任何生产系统。

## 直接验收

双击打开 `index.html`，或把该文件发送到另一台电脑后用现代浏览器打开。

打开后不会要求选择固定场景。先在“创建任意巡检工作区”中描述自己的目标；目标服务和电子流 / 发布单均为可选补充。页面中的两个示例只会填充表单，内容仍可修改。

### 验收路径一：自定义服务 → Scoped Proceed

1. 输入“升级 inventory-api v2.3.1，验证库存锁定和下游调用是否正常”。
2. 可选填写目标服务 `inventory-api` 和发布单 `REL-20260809-17`，点击“编译巡检工作区”。
3. 确认理解结果，检查自定义服务已传播到影响面、指标、依赖和正式 Check。
4. 接受范围并生成任务，先看一句话执行摘要；“可选建议”可以加查或不处理，再按需展开“将执行的检查”查看来源与判定依据。
5. 执行四步 mock 检查；报告应显示 `Verified + Proceed` 并明确结论边界。

### 验收路径二：可编辑示例 → Pause + RC Agent

1. 在空白入口点击“配置变更示例”；确认它只填充表单，然后自行提交。
2. 完成输入确认和范围对账；电子流 `CHG-84217` 是本次请求的附加来源，不是产品模式。
3. 验证系统识别出 `Observed-Superset`，将 `invoice-worker` 与 `settlement-db` 加入声明外影响面。
4. 未处置高关键度 AI 候选时，“确认任务”按钮必须禁用。
5. 点击候选项“加查”，确认它进入“将执行的检查”；再点“不查”验证决定可改回且会留痕，最后重新“加查”并开始执行。
6. 连续运行四步 mock 检查；报告应显示：证据 `Violated`，行动 `Pause`。
7. 点击“启动 RC Agent”，查看共享配置包导致数据库连接池退化的诊断链。

## 方案复用验收

- 订单升级示例：命中 `订单发布后验证 · v4`，确认后直接执行，但创建新的任务实例并重新采集证据。
- 支付配置示例：命中 `支付配置变更巡检 · v3`，先确认当前依赖与指标差异，再进入适配计划。
- 输入“payment-api 拆分出 risk-api，重新验证支付确认链路”：旧方案因重大漂移只能作为参考；看完差异后重新生成，`risk-api` 会进入当前 scope 与正式 Check。
- 报告阶段的“保存方案/提交更新”只创建待审批的新版本提案，不修改已锁定任务或历史方案。

无匹配时页面不出现方案区域，普通用户自定义旅程保持原样。

## 本地可重复验证

要求：Node.js 24+、本机 Chrome。没有第三方 npm 依赖。

```powershell
pnpm build
pnpm test
pnpm test:browser
```

浏览器验收会从 `file://` 打开产物，自动走完无匹配、精准匹配、小幅差异和重大漂移四类用户驱动路径，并校验：0 个 HTTP(S) 网络请求、0 个浏览器错误、手机视口无横向溢出。

需要重录验收截图时运行：

```powershell
node tests/offline.browser.mjs --evidence
```

## 文件说明

- `index.html`：唯一交付文件，双击即运行。
- `ARCHITECTURE.md`：架构边界、核心契约和演进映射。
- `lib/compiler.mjs`：把用户目标和可选上下文编译为巡检工作区。
- `lib/scenarios.mjs`：编译器后的不可变验收 fixture，不是产品模式。
- `lib/` 其余文件：领域契约、状态机与派生选择器。
- `src/`：纯渲染、高保真样式与浏览器事件适配。
- `scripts/build.mjs`：无依赖确定性单文件构建器。
- `tests/`：领域、旅程、UI、构建和浏览器验收。
- `evidence/`：桌面与手机验收截图。
