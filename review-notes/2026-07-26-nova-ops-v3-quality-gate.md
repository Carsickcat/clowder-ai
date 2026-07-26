# NOVA Ops V3｜Quality Gate Report

检查时间：2026-07-26

Spec：`feature-specs/2026-07-26-aiops-observability-platform-hifi-v3.md`

原始需求：co-creator 要求“先调研，再出方案，再出高保真，并给使用说明书”；页面必须是可用可观测系统，不是能力介绍官网。

## 愿景覆盖

| #   | 原始需求                                            | 设计合同                                                  | 实现 |
| --- | --------------------------------------------------- | --------------------------------------------------------- | ---- |
| 1   | 先做 Alibaba、Dynatrace、Datadog、Google Cloud 调研 | 只采官方一手资料，形成 Evidence Ledger                    | ✅   |
| 2   | 双 Agent 能力用于 2026 规划                         | 巡检 Agent 与诊断 Agent 分对象、共享证据、不可互相越权    | ✅   |
| 3   | 高频巡检支持大促、保障、变更                        | Mission、固定频次 Run、预测风险窗口、Finding 与报告       | ✅   |
| 4   | NL2 理解运维语义并生成可执行巡检                    | 意图澄清、结构化 Check、Query、权限/基线/回放/审批门禁    | ✅   |
| 5   | 高保真必须像生产系统而非官网                        | 首页直接进入 Live Ops；七个异构工作面与专业 Evidence Lens | ✅   |
| 6   | 交付使用说明书                                      | 站内抽屉 + `USER-GUIDE.md`                                | ✅   |

## 功能验收

| 要求                                  | 状态 | 实现 / 证据                                            |
| ------------------------------------- | ---- | ------------------------------------------------------ |
| unknown / stale / drift 不得折算健康  | ✅   | `lib/domain.mjs` + domain test                         |
| Action 完成不等于 Verification passed | ✅   | 整改完成后必须新建 Run 并统一评估 5 类 Gate            |
| passed 不得保留失败 Objective         | ✅   | 浏览器反例断言 + `02-change-verification-passed.png`   |
| NL2 不得绕过门禁发布                  | ✅   | `getPlanPublishBlockers` + 浏览器 disabled/unlock 验证 |
| Evidence 可钉入调查并形成 Observation | ✅   | Investigation Lens + reducer + browser Golden Path     |
| 预测不是总风险分                      | ✅   | 实际值、中位数、90% 区间、容量阈值、窗口和 readiness   |
| 七页不复用同一数据壳                  | ✅   | 每页独立组件、角色、触发、专有数据、动作和终态         |
| 手机可操作                            | ✅   | 390×844：打开使用说明、进入 NL2 Studio，console 0      |

## 设计稿对照

- 当前关键词 `nova-ops-observability-platform-v3` 下无 `.pen` 文件。
- Pencil 工具在本会话不可用，因此交付可编辑的 React/CSS 高保真实现，不伪造 `.pen`。
- 视觉证据为真实 Chrome 截图，不是生成式概念图。

## 需求 → 截图映射

| 需求                                                    | 截图                                         |
| ------------------------------------------------------- | -------------------------------------------- |
| 生产运行首页、风险队列、旅程矩阵、预测和 Agent 运行现场 | `evidence/01-live-ops-desktop.png`           |
| 变更前后证据、Objective、整改和复验一致终态             | `evidence/02-change-verification-passed.png` |
| NL2 意图、结构化 Plan、可执行 Query 与发布门禁          | `evidence/03-nl2-inspection-studio.png`      |

15 秒操作录屏：`evidence/nova-ops-v3-golden-path-15s.webm`。

## Close Gate Matrix

| AC                  | 结果 | 未完成尾巴 |
| ------------------- | ---- | ---------- |
| 官方调研与来源台账  | pass | 无         |
| 双 Agent 方案       | pass | 无         |
| 三条 Golden Path    | pass | 无         |
| 七个高保真工作面    | pass | 无         |
| 手机与使用说明      | pass | 无         |
| Mock / 生产边界声明 | pass | 无         |

`inconclusive → follow-up inspection draft` 是产品领域状态，不是本次交付延期项。

## Artifact Hygiene

- 仓库根目录媒体工件：无。
- 正式媒体仅归档在 `designs/nova-ops-observability-platform-v3/evidence/`。
- 关键字匹配 `.pen`：无。

## Architecture Ownership

- Architecture cell: standalone product prototype
- Map delta: none
- Why: 未接入现有 Store、Queue、Router、生产数据或动作执行面。
- Fallback layer: 自定义静态服务仅含安全路径解析、SPA fallback 和 404/500；不是业务 fallback 堆叠。

## Dogfood-Your-Slice

Scope verdict：✅ 必做。

端到端路径：

1. 大促保障：Live Ops → Mission → 提升频次，成本与审计同步更新。
2. 变更复验：回滚 → action completed → Verification blocked → 拨测恢复 → 新 Run → 5 类 Gate passed。
3. NL2：permission → baseline → replay → approval → publish。
4. 调查：Logs Lens → pin Evidence → Revision +1 → H1 next test → Confirm → ActionProposal。
5. 手机：打开站内说明 → 进入 NL2 Studio。

首次 Dogfood 发现并当轮修复：

- 页面切换保留旧滚动位置，标题会进入 sticky 顶栏下方；已增加页面切换滚动复位与浏览器断言。
- Verification 可在 Objective 仍失败时显示 passed；已改为整改完成前禁止启动，Gate 由领域层派生，并要求 objectives 一致通过。
- passed 页面仍显示旧 blocker 与可重复决策；已改为动态计数、verified 终态和决策锁定。
- 首次公开部署使用 vinext SSR 入口，部署状态虽成功，但未登录公网请求稳定返回 522；Worker 日志显示请求在应用执行前被取消。现改为单一静态 Worker 入口：Vite 生成 SPA 资源，构建器将资源嵌入标准 Fetch handler，不再依赖 SSR 源站。

## 最新验证证据

- `npm run check`：16/16 tests pass，Vite SPA + Sites Fetch Worker build exit 0。
- 静态 Worker 契约：`GET /`、不可变资源、SPA 深链与 hosting config 均通过自动测试。
- 构建会先清理旧 `dist/server/index.js`，回归测试确保站点不会重新选择失效的 SSR 入口。
- `BASE_URL=http://127.0.0.1:5291 npm run test:browser`：desktop 三条旅程 + mobile guide/studio 通过，console 0。
- `npm audit`：0 vulnerabilities。
- `git diff --check`：通过。
- 本地验收：worktree `E:\ClowderAI\cat-cafe-aiops-hifi-v3`，静态预览 `http://127.0.0.1:5291/`。
