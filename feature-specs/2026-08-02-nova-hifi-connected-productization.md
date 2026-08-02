---
feature_ids: []
topics: [nova, inspection, observability, productization]
doc_kind: implementation-plan
created: 2026-08-02
updated: 2026-08-02
---

# NOVA 高保真巡检工作台接入计划

## 终态

把已经合入的服务端巡检能力接回 `7d991e` / 5272 已确认的产品形态。用户进入
`/observability/inspections` 后看到的是一个围绕当前变更 Case 的单屏工作台，而不是后端对象的
CRUD 控制台。

视觉与交互真相源：

- `designs/nova-ops-observability-platform-v3/presentations/nova-inspection-product-vnext/assets/hifi-plan-75d991e.png`
- `designs/nova-ops-observability-platform-v3/presentations/nova-inspection-product-vnext/assets/hifi-canary-risk-75d991e.png`
- `designs/nova-ops-observability-platform-v3/presentations/nova-inspection-product-vnext/assets/hifi-report-75d991e.png`
- `feature-specs/2026-07-30-nova-change-inspection-journey.md`

能力与数据真相源继续使用现有 connected API、SQLite 持久对象和不可变证据链，不另造演示状态机。

## 不可偏离的产品合同

1. 首屏保持五个固定区域：变更上下文、三阶段旅程、左侧作业与方案、中央结论与证据、右侧 CLAW；底部是一条执行与决策时间线。
2. 页面始终回答三个问题：我在巡检什么、当前结论是什么、下一步是什么。
3. 所有用户操作文案为中文；英文只允许出现在服务名、Metric、Query、摘要和系统 ID 中，并默认收进证据详情。
4. CLAW 与页面主按钮调用同一组 connected API 命令，不维护第二套状态机，不伪造 Run、证据或结论。
5. 作业只复用方案。每次执行仍创建独立 Case，Run、决策与最终报告保持不可变。
6. 风险、未知、覆盖缺口和连接中断全部 fail closed；不得用绿色状态或可点击主按钮误导用户继续。
7. 变更前、灰度持续验证、变更后验收属于同一个 Case，不拆成模块或长表单。

## 状态矩阵

| 状态 | 中央决策面 | CLAW | 主动作 |
| --- | --- | --- | --- |
| 加载 | 正在连接巡检服务 | 只显示连接说明 | 禁用 |
| 空白 | 从一句话开始 | 输入变更意图 | 生成巡检方案 |
| 方案草稿 | 检查项、阈值、基线、覆盖缺口 | 解释生成依据 | 确认方案并创建 Case |
| 待执行 | 当前阶段与方案摘要 | 解释执行边界 | 执行本阶段巡检 |
| 执行中 | 服务端采集中 | 说明正在等待证据 | 禁用 |
| 风险/未知 | 风险事实、假设、未知、建议 | 解释证据，不代替决策 | 禁止接受，允许复验 |
| 通过但有缺口 | 机器结论与覆盖状态分列 | 明示缺口 | 人工复核后推进 |
| 已完成 | A/B 与不可变报告摘要 | 解读同一报告快照 | 查看报告 |
| 连接中断 | 无法读取权威证据 | 明示不回退演示数据 | 全部禁用 |

## 实施步骤

1. 先写失败的产品形态回归测试：固定单屏区域、中文主操作、CLAW 输入、真实 API 调用和 fail-closed。
2. 把当前 1000 行页面拆成 controller 与可复用视觉组件，保留现有 API client 和领域对象。
3. 用 connected workspace 派生实际阶段、结论、下一步和时间线，不再让下拉框决定旅程高亮。
4. 将候选生成/选择/waiver、执行、Assessment、A/B 和最终报告装入既定单屏骨架；内部 provenance 收进可展开证据详情。
5. 按 1440px、720px、390px 验证 golden path、风险/未知、空态和断连；浏览器 console error 必须为 0。
6. 运行 focused Web tests、类型检查、API 回归与 public pre-merge gate；交给视觉猫复核后再合入。

## 验收边界

- 不新增生产连接器，不触发发布、放量、回滚或生产写操作。
- 不改服务端证据所有权和持久化契约。
- 不把旧 5172 CRUD 视图作为兼容目标；它只保留为这次偏差的反例。
- 验收以真实 connected 页面和隔离数据为准，不以静态 PPT、测试绿灯或组件存在性代替产品验收。
