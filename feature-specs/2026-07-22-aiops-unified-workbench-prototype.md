# NOVA Ops 场景驱动 AI 运维工作台 V2 Implementation Plan

**Feature:** AI 运维统一工作台高保真原型 V2（独立、可点击、可离线交付）
**Goal:** 让发布负责人、值班 SRE、服务 Owner 分别完成一条可见的运维决策旅程，并证明监控、告警、日志、巡检、拨测各自承担不可替代的专业判断。
**Acceptance Criteria:**

- AC-1：首页先解释 AI 运维的八项原子能力，并以三个真实工作场景而非模块菜单作为主要入口。
- AC-2：三条旅程分别服务发布负责人、值班 SRE、服务 Owner；每条旅程明确展示触发、判断、AI 增益、人工决策、输出物与价值结果。
- AC-3：监控页必须呈现 SLO/基线/拓扑/变更叠加；告警页必须呈现归并、影响面、路由与升级；日志页必须呈现查询、模式聚类、字段分布与证据截取；巡检页必须呈现覆盖、检查定义、Run、Finding、整改与复验；拨测页必须呈现用户步骤、地域/设备差异与瀑布。
- AC-4：五个模块共享 service / env / time / change / scenario 上下文，但不能共享同一套内容模板。
- AC-5：每个旅程步骤都改变领域状态并产生可观察结果，禁止只切 active class 或弹 toast 的伪交互。
- AC-6：AI 输出始终分为事实、假设、缺口、建议；每项带来源或验证动作，允许人工接纳、反驳或请求补证据。
- AC-7：`unknown`、证据过期、覆盖不足与基线漂移是硬门禁；不得通过健康分或“复验完成”产生静默绿。
- AC-8：每条旅程结束页必须展示决策、证据包、责任人、复验条件和可量化的流程价值；外部厂商 ROI 不作为承诺。
- AC-9：桌面和手机均能完成三条旅程；生成无外部依赖的 standalone HTML，直接 `file://` 打开可用；远端对话通过内嵌 `html_widget` 交付，不暴露本机文件路径。
- AC-10：自动化测试覆盖场景入口、上下文继承、模块数据差异、AI 人工确认、非快乐路径与旅程终态；真实浏览器覆盖桌面 Golden Paths 和手机抽屉/导航。

**Architecture cell:** prototype / product-design（仓库无生产 ownership map 变更）
**Map delta:** none
**Map delta why:** 仅重构 `designs/aiops-unified-workbench/` 下的静态高保真验证，不接生产数据、不改变平台路由或权限边界。
**Architecture:** 采用场景定义驱动的纯浏览器状态机。`scenario-data.mjs` 是三条旅程与五模块专业数据的唯一事实源；`domain.mjs` 管理旅程、人工判断和门禁；视图按专业页面拆分，避免五页复用同一证据卡模板。所有数据为 mock，只读且无网络请求。
**Tech Stack:** Semantic HTML, CSS custom properties, vanilla JavaScript ES modules, Node built-in test runner, Playwright/Chrome smoke, deterministic standalone builder.
**前端验证:** Yes — Node tests、静态资源检查、真实 Chrome 桌面/手机旅程、console 0、standalone `file://` 验收。
**tips_exempt:** 独立静态设计原型，不进入 Cat Café 生产能力目录或用户运行时发现面。

---

## Finish Line

operator 打开一个 HTML 后，能从首页理解能力地图，并完成：

1. 发布负责人：`rc3 发布 → AI 生成验证计划 → 监控判断影响 → 拨测确认用户体验 → 日志定位差异 → 暂停发布并生成复验条件`；
2. 值班 SRE：`37 条告警 → 归并成 1 个事件 → 监控确认影响 → 日志验证根因 → 受控 Runbook → 恢复验证`；
3. 服务 Owner：`日巡覆盖缺口 → 审核 AI 候选检查 → 执行 Run → Finding → 整改 → 复验/报告`。

每一步都显示“此刻用户要做的判断”“AI 省掉的人工编排”“本步新增的证据/状态”，结束页显示具体输出物与价值指标。

**不构建：** 真实遥测连接、认证、生产写操作、自由 Prompt 自愈、厂商式 ROI 宣称、完整监控平台配置能力、高管纯展示大屏。

## Terminal Schema

```js
Scenario = {
  id, role, trigger, decisionQuestion, context,
  steps: JourneyStep[], valueBaseline, valueCurrent, outcome
}

JourneyStep = {
  id, module, title, intent, aiContribution, humanDecision,
  screenKind, datasetKey, completion
}

ModuleDataset = {
  metrics: { slo, series, baseline, topology, changeMarker },
  alerts: { rawCount, clusters, routes, impact },
  logs: { query, patterns, facets, samples },
  checks: { coverage, definitions, runs, findings },
  synthetics: { journey, steps, regions, waterfall }
}

AIInsight = {
  facts[], hypotheses[], gaps[], recommendations[],
  acceptedIds[], rejectedIds[], requestedEvidenceIds[]
}

JourneyOutcome = {
  decision, owner, evidencePackage, verificationGate,
  value: { manualJumpsAvoided, timeToConclusion, evidenceCoverage }
}
```

## Product Gate

### 1. 八项原子能力

`Observe → Contextualize → Detect → Correlate → Investigate → Decide → Act → Verify & Learn`

规则/遥测提供事实，AI 负责归并、解释、候选与缺口，人负责最终判断和生产动作。

### 2. 场景 × 页面决策矩阵

| 场景 | 角色 | 入口 | 必经专业页面 | 终局决策 | 价值证明 |
|---|---|---|---|---|---|
| 发布后验证 | 发布负责人 | 变更事件 | 巡检计划 → 监控对比 → 拨测旅程 → 日志差异 → 决策 | 继续 / 暂停 / 回滚 | 跨系统跳转、结论耗时、证据覆盖 |
| 故障处置 | 值班 SRE | 告警簇 | 告警归并 → 监控影响 → 日志根因 → 受控动作 → 复验 | 升级 / 执行 Runbook / 观察 | 原始告警压缩、调查耗时、交接完整度 |
| 关键服务日巡 | 服务 Owner | 定时 Run | 覆盖矩阵 → 候选检查 → Run 结果 → Finding → 整改/报告 | 接受 / 驳回 / 补证据 / 豁免 | 覆盖率、逾期项、复验闭环率 |

### 3. 五模块不可替代交互

| 模块 | 只能在此完成的判断 | 独特交互 |
|---|---|---|
| 监控 | 是否偏离 SLO/基线，影响经哪条依赖扩散 | 切换发布前后/对照组，选择拓扑节点 |
| 告警 | 多条信号是否属于同一事件、应路由给谁 | 展开告警簇、确认归并、调整责任路由 |
| 日志 | 哪个异常模式与时间/版本/实例相关 | 查询、模式聚类、facet 对比、钉入样本 |
| 巡检 | 检查覆盖是否足够、Finding 是否可治理 | 审核候选检查、运行、分派、复验 |
| 拨测 | 用户在哪一步、哪个地域/设备失败 | 切换地域/设备、展开步骤瀑布与失败截图 |

## UI State Matrix

| Dimension | States | Required proof |
|---|---|---|
| Entry | capability map / 3 scenario cards | 首页可解释、可进入任一旅程 |
| Journey | not_started / active / completed / blocked | stepper 与页面状态同步 |
| Evidence | raw / accepted / rejected / missing | 人工反馈改变证据包 |
| Health | healthy / unhealthy / unknown / recovering | unknown 永不派生 healthy |
| Baseline | comparable / drifted / rebuilding | 漂移时阻断趋势结论 |
| Viewport | desktop / mobile | 旅程导航与 AI 区均可达 |

## TDD Execution

### Task 1 — RED: 场景与模块差异

- 修改 `tests/domain.test.mjs`：断言首页有三条角色旅程；每条旅程上下文独立；五模块 dataset schema 不同；旅程切步保留上下文。
- 新增 AI 人工反馈、`unknown` 门禁、三条 outcome 测试。
- 运行测试，确认旧实现因缺少 scenario model 而失败。

### Task 2 — GREEN: 场景状态机与数据

- 创建 `scenario-data.mjs`，写三套不重叠业务数据与五类专业 dataset。
- 重写 `domain.mjs`：进入场景、切步、模块专业动作、AI verdict、完成旅程与门禁。
- 仅实现测试所需行为并保持纯 reducer。

### Task 3 — 高保真信息架构与专业页面

- 重写 `index.html` 为：品牌/场景入口、能力地图、旅程 rail、专业主画布、AI inspector、价值结果区。
- 拆分视图：`views-shell.mjs` 负责入口/导航，`views-modules.mjs` 负责五种专业 screen，`views-ai.mjs` 负责事实/假设/缺口/建议。
- token first；页面必须在内容结构上不同，而不只是颜色或标题不同。

### Task 4 — 真实交互

- 重写 `app.mjs`，所有按钮 dispatch domain action。
- 三条 Golden Path 都能形成 outcome；至少一条 `unknown` 非快乐路径保持 blocked。
- 手机端旅程 rail 变为顶部 stepper，AI inspector 变抽屉。

### Task 5 — 验证与交付

- 更新 browser smoke：三条桌面旅程、unknown 门禁、手机旅程。
- 运行 Node 全量测试、Biome/diff check、真实 Chrome console 0。
- 重建 standalone，校验无外部依赖、`file://` 可交互。
- 在无 `allow-same-origin` 的 HTML widget 沙箱中验证手机场景与 AI 抽屉。
- 跨个体 reviewer 按 AC-1~10 复审后交付。

## Evidence Basis

- Datadog Bits AI：多入口调查、假设验证、结构化调查树，以及证据不足时 `inconclusive`。
- AWS CloudWatch Investigations：Observation/Hypothesis 人工接纳或丢弃、调查时间线与报告。
- Google Cloud Assist Investigations：Observation 回链源数据、多假设与 revision。
- 本项目产品边界：`unknown`、覆盖率、新鲜度、基线可比性、Finding → Action → Verification。

只吸收工作流，不复制厂商视觉，不把 Preview 能力或营销效率数字当作本产品承诺。
