# AI Ops Unified Investigation Workbench Prototype Implementation Plan

**Feature:** AI 巡检与统一运维平台概念验证（独立可点击原型）
**Goal:** 交付一个高保真、真实可点击的事件中心工作台，证明监控、告警、日志、巡检、拨测可以在同一 `HealthEvent` 上完成证据调查与治理闭环。
**Acceptance Criteria:**

- AC-1：首页以 `HealthEvent` 工作队列为主入口，业务健康地图只作为筛选入口。
- AC-2：任一事件进入调查后，顶部持续展示并锁定 service / env / time / change / HealthEvent。
- AC-3：监控、告警、日志、巡检、拨测五个 Evidence Lens 可以真实切换，且不会重置调查上下文。
- AC-4：用户可将证据钉入调查；钉入后证据数量、调查时间线与 Finding 候选立即同步变化。
- AC-5：AI 输出明确分为事实、推断、证据缺口、建议动作，不展示隐式推理过程。
- AC-6：用户可从 Finding 候选形成结论、分派 Owner、开始整改并发起/完成复验。
- AC-7：`unknown`、数据新鲜度不足和基线漂移以阻断状态展示，不折算为健康。
- AC-8：桌面保持右侧 AI 窄栏；窄屏降级为可展开抽屉，核心旅程仍可操作。
- AC-9：自动化测试覆盖上下文继承、证据入案去重、Finding 与 Verification 状态机；浏览器验收走完一次完整 Golden Path 和一次 unknown 非快乐路径。

**Architecture cell:** prototype / product-design（仓库当前无 ownership map 对应目录）
**Map delta:** none
**Map delta why:** 原型只新增 `designs/` 下的静态设计验证，不改变 Cat Café 生产架构、路由或数据边界。
**Architecture:** 采用纯浏览器 ES Module 架构：`domain.mjs` 持有可测试状态机，`app.mjs` 只负责事件绑定和渲染，HTML/CSS 负责信息架构和视觉。所有数据为本地 mock，不请求 API、不访问 Redis、不执行生产动作。
**Tech Stack:** Semantic HTML, CSS custom properties, vanilla JavaScript ES modules, Node built-in test runner, Python static server for Hub preview.
**前端验证:** Yes — 必须执行 Node 测试、静态资源检查、真实浏览器交互、桌面与窄屏截图。

---

## Finish Line

打开 Hub Browser Panel 后，operator 无需输入 URL，即可点击完成：选择发布异常事件 → 切换日志 Lens → 钉入错误日志 → 接受 Finding → 分派整改 → 开始并完成复验；全过程顶栏上下文不变，时间线和证据计数随动作更新。

**不构建：** 后端、认证、真实遥测连接、生产变更执行、持久化、自由 Prompt 执行、全量模块配置页、厂商 ROI 展示。

## Terminal Schema

```js
HealthEvent = {
  id, title, service, env, timeRange, change,
  severity, healthState, coverage, freshness, baselineState,
  evidence[], timeline[], finding, action, verification
}

Evidence = { id, lens, timestamp, title, detail, source, status }

Finding = {
  status: "candidate" | "confirmed",
  title, confidence, evidenceIds[], owner
}

Verification = {
  status: "not_started" | "running" | "passed",
  startedAt, completedAt
}
```

## UI State Matrix

| Dimension | States represented | Prototype proof |
|---|---|---|
| Data | full / partial / unknown | 发布异常、证据缺口、采集器中断三类事件 |
| Health | unhealthy / unknown / recovering | 队列状态与标题区语义色，不存在 unknown→healthy 映射 |
| Baseline | comparable / drifted | 顶部黄色门禁与 Finding 限制提示 |
| Workflow | investigate / finding / action / verification | 顶部阶段条和 reducer 状态转换 |
| Viewport | desktop / mobile | CSS breakpoint，AI 常驻栏变抽屉 |
| Authority | analyst-confirmed actions only | 所有整改/复验按钮为显式人工动作；无自动生产执行 |

## Task 1: Domain State Machine — RED

**Files:**

- Create: `designs/aiops-unified-workbench/tests/domain.test.mjs`

1. 写失败测试：Lens 切换后 context identity 不变。
2. 写失败测试：同一证据重复钉入不重复计数，首次钉入会追加时间线。
3. 写失败测试：确认 Finding 后可分派 Owner、进入整改、运行并完成复验。
4. 写失败测试：unknown 与 drifted baseline 永远不能派生 healthy。
5. 运行：`node --test designs/aiops-unified-workbench/tests/domain.test.mjs`。
6. 预期：因 `domain.mjs` 不存在而失败。

## Task 2: Domain State Machine — GREEN

**Files:**

- Create: `designs/aiops-unified-workbench/domain.mjs`

1. 实现终态 schema、mock HealthEvents 与纯 reducer。
2. 实现 `selectEvent`、`switchLens`、`pinEvidence`、`confirmFinding`、`assignAction`、`startVerification`、`completeVerification`。
3. 运行聚焦测试并确认全部通过。
4. 重构命名，保持测试绿色。

## Task 3: High-Fidelity Shell and Investigation Canvas

**Files:**

- Create: `designs/aiops-unified-workbench/index.html`
- Create: `designs/aiops-unified-workbench/styles/tokens.css`
- Create: `designs/aiops-unified-workbench/styles/layout.css`
- Create: `designs/aiops-unified-workbench/styles/components.css`

1. 建立 L1 产品导航、HealthEvent 队列、全局上下文条、中央时间线/Lens、右侧 AI 窄栏。
2. 使用 semantic CSS variables；状态色同时配文字/图标，不仅依赖颜色。
3. 增加桌面、窄屏布局及 reduced-motion 降级。
4. 不写内联脚本或真实网络调用。

## Task 4: Interaction Wiring

**Files:**

- Create: `designs/aiops-unified-workbench/app.mjs`

1. 将所有交互绑定到 reducer，避免只切视觉 class 的假交互。
2. 切换事件与五种 Lens 时重新渲染上下文、证据与调查时间线。
3. 钉入证据后立即更新证据计数、时间线和 Finding 候选。
4. 接受 Finding 后展示 Owner 分派、整改与复验动作。
5. AI 栏只呈现事实/推断/缺口/建议动作和可核验来源。

## Task 5: Browser Proof and Quality Gate

**Files:**

- Create: `designs/aiops-unified-workbench/README.md`

1. 运行 `node --test designs/aiops-unified-workbench/tests/domain.test.mjs`，要求 0 failures。
2. 运行静态资源/模块语法检查，要求 0 errors。
3. 用独立非保留端口启动静态服务器，先确认 HTTP 200，再调用 Hub preview typed tool。
4. Golden Path：事件 → 日志 Lens → 钉入证据 → Finding → Owner → 整改 → 复验通过。
5. Non-happy Path：选择数据中断事件，确认 `unknown`、freshness 与 evidence gap 仍阻断。
6. 检查窄屏：AI 栏变抽屉、上下文不丢、关键动作可达。
7. 截图保存到临时 evidence 目录，不落仓库根目录。
8. 记录 worktree/cwd、URL、测试输出和已知边界。

## Review Focus

- 事件中心是否真的位于五模块之上，而不是改名后的大盘。
- Lens 切换与证据钉入是否修改同一个状态对象。
- `unknown` / drift 是否形成硬门禁。
- AI 与确定性事实、人工权限的视觉边界是否足够明确。
- 是否存在看似可点击但无状态反馈的控件。
