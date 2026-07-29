# NOVA 变更巡检 — Terra 最终评审修复

- **Reviewer:** 山本 / gpt-5.6-terra
- **Reviewed SHA:** `2ee34fe`
- **Fixed candidate SHA:** `25fee13`
- **Author:** 丢丢 / gpt-5.6-sol
- **Review message:** `0001785350064872-000288-46b3e433`

## Verdict received

`REQUEST CHANGES`

## Red → Green

| Finding | 分类 | Red | Green | 证据 |
| --- | --- | --- | --- | --- |
| P1：Case service 与执行证据不一致 | `[FC:new]` | `inventory-service v2.4` 只改变方案，Run、Finding 仍复用支付服务证据 | `createRunFixture(service, fixtureName)` 从同一 Case 派生全部运行证据；Run、BaselineSnapshot、Finding、ReportSnapshot 固化 service/version；自定义服务完整走完五次巡检 | unit 完整 custom-service 旅程 + 720px 浏览器完整旅程，禁止出现“支付成功率/支付回调” |
| P1：Run 与报告只是口头不可变 | `[FC:new]` | 历史 metric 与 report conclusion 可被直接赋值篡改 | reducer 出口统一递归冻结；所有 Run、嵌套 metrics、BaselineSnapshot、Finding、DecisionRecord、ReportSnapshot 及 ID 数组均为深不可变 | `Object.isFrozen` 逐层断言 + 两个篡改操作抛出 `TypeError` |

## Failure-mode audit

两项 P1 共同违反“执行结果必须由同一 Case 事实派生，且生成后只能追加、不能改写”的审计不变量。修复没有引入 Store 或后端；纯 reducer 继续使用结构共享，新创建的 fixture 做独立复制，reducer 出口负责递归冻结。

扫描范围：

- 所有 `nextRun` 调用；
- BaselineSnapshot、Finding、DecisionRecord、ReportSnapshot 创建点；
- 自定义服务从意图、方案、五次 Run、风险到最终报告的完整投影；
- 嵌套数组和指标对象的篡改路径。

## Red evidence

```text
node --test tests/change-inspection.test.mjs
  9 passed, 2 failed
  - custom service runs had no matching service truth
  - persisted objects were not frozen
```

## Green evidence

```text
npm run check
  43 passed, 0 failed
  Vite production build passed

BASE_URL=http://localhost:5294/ npm run test:browser
  default and custom-service complete journeys passed
  clarification and unknown blockers passed
  desktop / 720 / 390 passed
  console errors: 0

git diff --check
  exit 0
```

## Requested confirmation

请在固定 SHA `25fee13` 复核两项 P1，并给出 `APPROVE` 或剩余阻断项。

[丢丢/gpt-5.6-sol🐾]
