# NOVA 变更巡检 Quality Gate

**检查时间：** 2026-07-30  
**作者：** 丢丢 / gpt-5.6-sol  
**Spec：** `feature-specs/2026-07-30-nova-change-inspection-journey.md`  
**研究：** `project-research/2026-07-30-change-lifecycle-inspection/`  
**Architecture cell：** Prototype-local frontend projection  
**Map delta：** none  
**Why：** 只替换高保真原型的首页投影和新增独立纯状态机，不增加 Store、Queue、Router、Adapter、Dispatcher、Binding 或外部契约。

## 愿景覆盖

原始需求来自 co-creator 2026-07-29 16:48 UTC 的线程消息：

1. “首先你要想清楚用户怎么用。”
2. “基于用户旅程涉及你的原子能力和交互方式。”
3. 变更前：自然语言提出巡检请求，自动生成检查项、执行并给出准入风险。
4. 变更中：按灰度阶段持续巡检，判断能否继续放量。
5. 变更后：与变更前比较，识别异常变化并形成现网验收。
6. 至少先让巡检一个能力形成完整、可用的产品视图。

实现把旧七菜单首页替换为一个 `ChangeInspectionCase`：Claw 负责意图和解释，页面负责确认、执行、观察、决策与审计。

## AC 矩阵

| AC    | 结果 | 实现与证据                                                              |
| ----- | ---- | ----------------------------------------------------------------------- |
| AC-1  | 通过 | `OpsApp.js` 直接渲染 `ChangeInspectionApp`；浏览器断言旧导航为 0。      |
| AC-2  | 通过 | Claw 自然语言输入生成 5 个检查项、基线、频率和窗口。                    |
| AC-3  | 通过 | `PLAN_CONFIRMED` 生成 admission Run、BaselineSnapshot、DecisionRecord。 |
| AC-4  | 通过 | 25% canary/stable 比较后发现风险；复验后进入 100% 放量。                |
| AC-5  | 通过 | 风险态必须记录处置并生成新的 Verification Run；旧风险 Run 保留。        |
| AC-6  | 通过 | acceptance Run 与变更前基线比较，并生成不可变 ReportSnapshot。          |
| AC-7  | 通过 | 用户动作与状态全中文；英文仅用于 ID、服务、Metric 和对象类型。          |
| AC-8  | 通过 | 1440、720、390 三视口完整路径通过，无横向溢出，console error 0。        |
| AC-9  | 通过 | 基线不可比与证据过期均为 `不可判定`，不会暴露准入或放量动作。           |
| AC-10 | 通过 | 两类阻断均能在同一 Case 内纠正，且不会越过后续执行动作。                |
| AC-11 | 通过 | 报告页面、时间线摘要与 Claw 解读全部来自同一 `ReportSnapshot`。         |
| AC-12 | 通过 | 意图解析从本次输入提取服务与版本；信息不全时进入澄清态，不生成方案或 Run。 |
| AC-13 | 通过 | 输入框初始为空；主界面的内部对象名已替换为中文用户语言。                |
| AC-14 | 通过 | 自定义服务完整旅程中的方案、五次 Run、Finding、基线与报告共享同一 service/version。 |
| AC-15 | 通过 | 全部持久证据及嵌套指标递归冻结；篡改历史 metric 或报告结论会抛出 `TypeError`。 |

## 产品原子能力

| 能力       | 页面证据                                                     |
| ---------- | ------------------------------------------------------------ |
| 巡检项生成 | Claw 请求后展示 5 个检查项与覆盖度。                         |
| 任务编排   | 三阶段旅程、执行频率、窗口、canary 策略和 Run 时间线。       |
| 报告生成   | 最终 ReportSnapshot 固化全部 Run 与决策。                    |
| 报告解读   | “请 Claw 解读最终报告”在同一 Case 对话中解释结论与风险复验。 |

## Dogfood-Your-Slice

**Scope verdict：** 必做，属于用户可感知 UI。

**端到端路径：**

自然语言请求 → 方案确认 → 变更前准入 → 25% 灰度风险 → 处置复验 → 100% 放量 → 变更后验收 → Claw 报告解读。

**实际命令：**

```text
npm run test:browser
Browser golden paths passed: Chinese single journey, unknown baseline blocker,
pre-change admission, canary risk and verification, post-change report,
desktop/720/mobile, console 0.
```

**本轮 dogfood 捕获并修复：**

1. `CASE_RESET` 按钮已派发但 reducer 未实现；新增失败单测后修复。
2. CSS 内部 import 在 Vinext 与静态 Vite 使用不同相对基准；改为两个入口分别显式导入。
3. 粘性品牌栏会遮挡长页面证据；改为普通页头。
4. 报告页有静态按钮且 Claw 缺少报告解读；统一接到最终 ReportSnapshot，并补领域动作。
5. 完成后的 Case 仍接受 draft 动作；增加领域动作策略，拒绝改写已执行方案和最终报告。
6. 页面把“记录处置”和“执行复验”连续 dispatch；拆成两个可见状态并补浏览器断言。
7. `不可判定` 只有禁用 CTA 和 demo reset；补充同一 Case 内的基线恢复与证据刷新动作。
8. 最终报告部分文案与 Claw 解读硬编码；改为完整投影不可变 `ReportSnapshot`。
9. 录屏脚本仍依赖旧的一步复验；同步为两步真实旅程后重新生成动态证据。
10. 任意自然语言输入都会被套用 `payments-router v3.18.0`；新增意图解析与缺参澄清，禁止伪造服务上下文。
11. 输入框预填完整请求会让演示看起来像用户已输入；改为空输入，仅以 placeholder 提供示例，并在空输入时禁用提交。
12. 页面仍暴露 `Run`、`DecisionRecord`、`ReportSnapshot` 等内部术语；替换为“巡检记录、决策、报告快照”等中文用户语言。
13. 基线从可比变为不可比后，Claw 仍显示绿色“已完成”；改为互斥的琥珀色补充信息状态。
14. 缺参澄清页仍展示“5/5 风险面已覆盖”和“基线可比”；改为独立的“方案尚未生成”状态，并用浏览器契约禁止提前宣称覆盖与可比性。
15. 自定义服务只改变方案，执行后又套回支付服务 Run/Finding；改为从同一 Case service 派生每次执行证据，并补自定义服务完整浏览器旅程。
16. Run 与最终报告虽声明不可变，但嵌套字段仍可直接改写；在 reducer 出口建立递归冻结边界，并补逐层冻结与篡改失败测试。

## 视觉证据映射

| 需求                 | 截图                                                    |
| -------------------- | ------------------------------------------------------- |
| 自然语言创建入口     | `evidence/01-change-inspection-request-desktop.png`     |
| 不可判定阻断         | `evidence/02-change-inspection-unknown-desktop.png`     |
| 自动生成巡检方案     | `evidence/03-change-inspection-plan-desktop.png`        |
| 灰度风险与处置       | `evidence/04-change-inspection-canary-risk-desktop.png` |
| 最终报告与完整时间线 | `evidence/05-change-inspection-report-desktop.png`      |
| 390px 完整旅程       | `evidence/06-change-inspection-report-mobile.png`       |
| 动态旅程             | `evidence/nova-change-inspection-journey-15s.webm`      |

## 设计稿检查

`rg --files | rg '\.pen$'`：无匹配。当前环境未暴露 Pencil MCP，因此本轮以可执行页面、六张状态截图和一段录屏作为设计真相源，没有伪造 `.pen`。

## 验证输出

```text
npm run check
  format:check: all matched files use Prettier
  node tests: 43 passed, 0 failed
  Vite build: exit 0

npm run test:browser
  desktop / 720 / 390 golden paths passed
  custom-service evidence truth passed through final report
  clarification state cannot claim coverage or baseline comparability
  console errors: 0

git diff --check
  exit 0

root media hygiene
  clean
```

`MODULE_TYPELESS_PACKAGE_JSON` 和 npm env config 为既有工具链 warning，不影响测试或构建退出码。

## Gate 结论

**PASS — 可以进入跨个体 review。**

- 没有未满足 AC。
- 没有延期尾巴或静态占位动作。
- Tips exempt：这是独立外部产品原型，不存在 Cat Café `capability-tips` 注册面。
- 本轮只提交本报告列出的新旅程文件；旧 V6 评审截图与旧评审信不纳入作者提交。
