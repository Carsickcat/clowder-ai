# NOVA Ops V2 · Quality Gate Report

**Spec:** `feature-specs/2026-07-22-aiops-unified-workbench-prototype.md`

**Original request:** 从 AI 运维原子能力、用户使用场景、用户交互旅程三层重构统一运维高保真；五个模块必须呈现不同的专业判断与真实交互。

**Checked:** 2026-07-22

**Worktree:** `E:\ClowderAI\cat-cafe-aiops-workbench`

**Preview:** `http://127.0.0.1:5278/`

## Outcome First

旧版“同一事件 + 五个重复页签”的产品坐标已撤回。V2 以三个角色场景为入口，以八项原子能力解释系统能力，以五个专业工作面完成判断；统一的是上下文、证据链和治理状态，不是页面模板。

## Vision Coverage

| AC | Requirement | Implementation | Verification |
|---|---|---|---|
| AC-1 | 八项原子能力 + 三个场景入口 | 首页展示 `Observe → Contextualize → Detect → Correlate → Investigate → Decide → Act → Verify & Learn`，并说明规则、AI、人三方边界 | Browser smoke 断言能力图和三张场景卡可见 |
| AC-2 | 三条角色旅程 | 发布负责人、值班 SRE、服务 Owner 分别有触发、判断问题、五步旅程、终局决策和价值结果 | Domain tests + 三条桌面 Golden Path |
| AC-3 | 五模块专业差异 | 监控、告警、日志、巡检、拨测使用不同 schema、布局、数据和动作 | Domain schema test + Browser smoke 逐页唯一内容断言 |
| AC-4 | 上下文统一，页面不趋同 | `service / env / time / change / scenario` 被锁定并随模块深链继承；五类视图独立实现 | Context inheritance test + Browser deep-link path |
| AC-5 | 禁止伪交互 | 步骤推进、模块聚焦、AI verdict、人工决策、完成/阻断均进入 reducer 状态 | Reducer tests + UI path state assertions |
| AC-6 | AI 可复核、可反驳 | 事实 / 假设 / 缺口 / 建议分栏；每条支持接纳、反驳、请求补证据 | AI verdict test + UI accepted state proof |
| AC-7 | 防静默绿硬门禁 | `unknown`、新鲜度不足、覆盖缺口、基线漂移阻断健康结论；只能产出带 unknown 的诚实报告 | `mark_healthy` blocked regression + inspection non-happy path |
| AC-8 | 旅程必须产出价值 | 每条终局包含人工决策、证据包、Owner、复验门槛和本次 mock 流程计数 | Outcome tests + outcome screen assertions |
| AC-9 | 桌面、手机、离线单文件 | 响应式桌面/手机工作台；standalone 内嵌所有 CSS/JS，无 localhost 与外部依赖 | HTTP Chrome + mobile viewport + `file://` Chrome |
| AC-10 | 自动化与真实浏览器 | 领域、服务、standalone 测试和浏览器旅程覆盖快乐/非快乐路径 | 12/12 Node tests + 2 次 Browser smoke |

## Product Gate

### 原子能力责任边界

- 规则与遥测：提供可追溯事实、阈值、基线与状态。
- AI：跨源归并、候选解释、缺口识别、检查生成和报告草稿。
- 人：接纳或反驳推断，决定发布、升级、Runbook、豁免与生产动作。
- 产品不展示隐式 Agent Trace，也不允许自由文本直接执行生产操作。

### 三条旅程

| 场景 | 角色 | 旅程 | 终局输出 | 场景价值 |
|---|---|---|---|---|
| 发布后健康验证 | 发布负责人 | 验证计划 → 监控对比 → 拨测旅程 → 日志差异 → 发布决策 | 暂停/放行、证据包、Owner、复验门槛 | 减少跨系统拼证与漏检 |
| 告警风暴处置 | 值班 SRE | 告警归并 → 影响定界 → 根因验证 → 恢复拨测 → 受控处置 | 事件结论、责任路由、Runbook/交接 | 压缩噪声并缩短调查链路 |
| 关键服务日巡 | 服务 Owner | 覆盖审计 → 候选检查 → 证据缺口 → Finding → 诚实报告 | Finding、整改、复验或带 unknown 的报告 | 把一次性巡检升级为健康治理 |

### 五模块不可替代性

| 模块 | 独有数据 | 独有判断 | 独有交互 |
|---|---|---|---|
| 监控 | SLO、基线、对照组、变更标记、拓扑 | 是否偏离 SLO，影响如何扩散 | 切换比较组、选择拓扑节点 |
| 告警 | Raw/Cluster/Event 漏斗、影响面、路由 | 哪些信号属于同一事件，应交给谁 | 展开告警簇、确认归并、调整路由 |
| 日志 | Query、Pattern、Facet、样本 | 哪个模式与版本/实例/时间相关 | 聚焦模式、比较字段、钉入样本 |
| 巡检 | 覆盖、检查定义、Run、Finding | 覆盖是否足够，结论是否可治理 | 审核候选、执行 Run、分派与复验 |
| 拨测 | 地域/设备、用户步骤、Waterfall | 用户在哪一步、哪里失败 | 切换地域、展开步骤瀑布、验证恢复 |

## TDD Evidence

1. 首轮领域测试先因缺失 `MODULE_IDS` 与 scenario model 失败。
2. 引入三套场景数据与 reducer 后转绿。
3. 新增模块聚焦持久化测试先失败，再实现 `focus_module_item`。
4. 新增 blocked 决策恢复测试先失败，再实现状态从 `blocked` 回到 `active`。
5. `unknown` 回归测试固定为 `blocked / unknown`，且不得写入恢复结论。

## Fresh Verification

| Check | Result |
|---|---|
| Domain + server + standalone | 12/12 pass |
| HTTP Chrome desktop | 三条 Golden Path、五模块差异、AI verdict、console 0 |
| HTTP Chrome mobile | 旅程导航和 AI 抽屉可达，console 0 |
| Offline `file://` Chrome | 三条旅程与 unknown 门禁通过，console 0 |
| Targeted Biome | 24 files checked, no fixes, exit 0 |
| `git diff --check` | exit 0 |
| Standalone | 142,510 bytes；SHA-256 `C51A382DFAA703068CADC84A7F7ACD3CEDBCDEC6CE82E1D734620F86833B48D1` |

当前分支基线未提供 `check-hotfix-pattern.mjs`、`check-fallback-layers.mjs`、`check:architecture-ownership`、`check:capability-tips`，因此这些检查记录为 **unavailable**，不伪报通过。该 slice 是独立静态产品原型，不进入 Cat Café 运行时能力发现面；spec 已写明 `tips_exempt`。

## Visual Evidence

临时证据目录：

`C:\Users\myh_1\AppData\Local\Temp\cat-cafe-evidence\aiops-unified-workbench-v2`

- `01-capability-and-scenarios.png`：原子能力与三场景入口。
- `02-release-outcome.png`：发布验证终局、证据包与复验门槛。
- `04-inspection-unknown-honest-report.png`：unknown 阻断与诚实报告。
- `module-*.png`：五个专业工作面差异复核。

## Accessibility and Design-System Check

- 颜色、间距、排版与状态均经 CSS custom properties 组织。
- 状态同时使用文字、图标/标签和数值，不只依赖颜色。
- 交互控件使用语义按钮并具备可访问名称。
- `prefers-reduced-motion` 有降级。
- 桌面 AI 区为辅助检查栏，手机端为可关闭抽屉，不遮蔽主任务。
- 未发现与本原型匹配的 `.pen` 文件，因此没有伪造 Pencil 对照结论。

## Artifact Hygiene

- 仓库根目录没有新增 PNG/JPG/WebP/GIF/WebM/MP4/PDF/PEN。
- 截图只保存在系统临时 evidence 目录。
- 原型不访问 Redis、SQLite、生产 runtime 或外部 API。
- 代码内 `P2` 仅为 mock 告警严重度标签，不是遗留 TODO。

## Architecture Ownership

**Architecture cell:** prototype / product-design

**Map delta:** none

**Why:** 仅重构静态高保真原型及测试；不改变生产路由、存储、队列、适配器、权限或数据边界。

## Known Boundary

原型状态只存在于页面内存，刷新后重置。它验证信息架构、交互旅程和产品判断，不代表真实遥测接入、认证、权限审批或生产处置已经实现。页面中的价值数字仅为本次 mock 旅程的可核算操作计数，不是行业 ROI 承诺。
