# NOVA 变更巡检旅程

**Feature:** NOVA Change Inspection Journey  
**Goal:** 用户从一句自然语言请求出发，在一个工作区内完成变更前准入、灰度持续验证和变更后验收。  
**Architecture cell:** Prototype-local frontend projection  
**Map delta:** none  
**Map delta why:** 只重构高保真原型的主对象、状态与交互，不增加后端、生产连接器或持久化契约。  
**Research:** `project-research/2026-07-30-change-lifecycle-inspection/`

## 产品门禁

在实现顶级导航或页面前，必须依次回答：

1. 用户旅程是什么？
2. 旅程需要哪些原子能力和持久对象？
3. 对话与页面分别负责什么？
4. 页面如何投影当前任务，而不是展示产品能力目录？

本轮答案：一个 `ChangeInspectionCase`，一个工作区，三个阶段；没有七菜单全局导航。

## 用户故事

作为发布负责人，我说“请帮我巡检 payments-router v3.18.0 是否可以灰度发布”，系统应：

1. 理解服务、版本、环境和风险目标；
2. 生成并解释巡检方案；
3. 经我确认后执行变更前巡检并给出准入结论；
4. 在灰度阶段按每个放量台阶执行 canary/control 验证；
5. 异常时停止在当前阶段，并给我证据和处置建议；
6. 变更完成后与变更前基线比较，生成最终验收报告。

## 终态对象

```js
ChangeInspectionCase = {
  id,
  service,
  change,
  environment,
  stage, // draft | pre-change | canary | post-change | completed
  planVersion,
  comparabilityContract,
  baselineSnapshot,
  runs: InspectionRun[],
  findings: Finding[],
  decisions: DecisionRecord[],
  reportSnapshot
}
```

`InspectionRun` 和 `ReportSnapshot` 一经生成不可原地修改。新的验证产生新的 Run。

## 状态与主动作

| 阶段        | 用户看到的主问题                 | 唯一主动作         |
| ----------- | -------------------------------- | ------------------ |
| draft       | 系统是否正确理解了我要检查什么？ | 确认方案并执行     |
| pre-change  | 当前版本是否具备灰度准入条件？   | 批准进入灰度       |
| canary-safe | 当前放量阶段是否健康？           | 继续到下一阶段     |
| canary-risk | 风险是否需要暂停？               | 记录处置并重新验证 |
| post-change | 与变更前相比是否出现异常？       | 完成验收并生成报告 |
| completed   | 最终结论和证据是否可追溯？       | 查看/导出报告      |

## 语言与理解性合同

- 用户可操作的标题、状态、按钮和说明全部中文。
- 英文仅保留系统 ID、服务名、Metric、Query 和代码字段。
- 每个状态首屏必须回答“我在做什么、当前结论是什么、下一步是什么”。
- `不可判定` 不能显示为绿色，也不能允许自动推进。
- 移动端不使用 `INC/CHG/INSP` 等缩写导航。

## Claw 安全边界

- 可以：理解请求、澄清范围、生成/修改方案草案、解释证据、建议下一步。
- 不可以：绕过确认直接执行生产动作、直接放量/回滚、篡改历史 Run、替用户发布最终报告。
- 对话建议和页面点击必须调用同一组领域动作，不产生两套状态机。

## 状态矩阵

| 维度 | 覆盖                           |
| ---- | ------------------------------ |
| 数据 | full、partial/stale、unknown   |
| 用户 | 本原型为单一发布负责人         |
| 设备 | 1440 desktop、390 mobile       |
| 异常 | 基线不可比、证据过期、灰度风险 |

## 验收标准

- AC-1：首屏无七菜单导航，直接进入单一变更巡检 Case。
- AC-2：用户能通过 Claw 输入生成包含范围、检查项、阈值、基线和频率的方案。
- AC-3：确认方案后生成变更前 Run、准入结论和 Decision Record。
- AC-4：灰度阶段至少演示两个放量台阶，并展示 canary/control 比较。
- AC-5：至少一个风险状态不能直接推进，必须记录处置并产生新的 Verification Run。
- AC-6：变更后 Run 与变更前基线比较，生成最终 Report Snapshot。
- AC-7：所有主操作中文；英文仅保留技术实体。
- AC-8：桌面与 390px 移动端均能完成 golden path，console error 为 0。
- AC-9：至少覆盖一个 `不可判定` 非 happy path，且不会误判为通过。

## 拒绝的替代方案

- 继续在旧七菜单中增加引导文案：拒绝，因为主对象和用户旅程仍然割裂。
- 把 Claw 做成唯一界面：拒绝，因为执行状态、证据和决策无法稳定审计。
- 把变更前/中/后做成三个模块：拒绝，因为用户心智里它们属于同一次变更。
- 让聊天直接放量：拒绝，因为高风险动作缺少显式确认与可追溯记录。
