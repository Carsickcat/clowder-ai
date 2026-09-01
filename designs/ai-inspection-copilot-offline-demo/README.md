---
feature_ids: [F257, AI_INSPECTION_COPILOT_OFFLINE_DEMO, AI_INSPECTION_PLAYBOOK_REUSE]
topics: [aiops, inspection, offline-demo, release-validation, acceptance]
doc_kind: guide
created: 2026-08-06
updated: 2026-09-02
---

# AI 巡检 Copilot 离线验收 Demo

这是一个无需安装、无需启动服务、无需占用端口的单文件产品 Demo。所有变更、指标、Trace、证据与 RC 诊断均为 mock，不会连接或修改生产系统。

## 直接验收

双击打开 `index.html`。首屏以变更单或发布单为主输入，风险关注点可选；两个示例只填充表单，仍可修改。

### 路径一：CHG-84501 → 覆盖诚实的 Pause 报告

1. 输入 `CHG-84501`，可选补充“关注扣款成功和 Redis 客户端”，点击“生成巡检计划”。
2. 候选计划应直接出现，不再经过“确认巡检信息”或“确认范围”页面。
3. 确认默认阻断范围只有 `payment-api`；`invoice-worker` 与 `settlement-db` 位于独立的 amber“影响面缺口”区，不会静默进入阻断检查。
4. `settlement-db` 因存在已批准规则，可点击“加入本次检查”；`invoice-worker` 无可信规则，只能保留为未覆盖风险。
5. 页面正常路径只有一颗授权按钮：“确认并开始巡检”。点击后锁定规则与范围，创建一个不可变 Run/Report。
6. 报告应显示 `Violated + Pause`、覆盖徽标“3 项已验证 · 1 项未覆盖”，并在残余风险中明确写出 `invoice-worker`。
7. 点击“启动 RC Agent”可查看共享配置包与连接池退化的证据链；诊断不能改写门禁结果。

### 路径二：任意已知发布 → 规则编辑与保存复访

1. 输入 `REL-FUL-72`，关注点可选，生成候选计划。
2. 展开“将执行的检查”，编辑允许修改的比较符或阈值；指标 ID、执行能力和事实来源保持只读。
3. 点击一次“确认并开始巡检”，报告、历史、比较、复制与导出均应读取同一锁定快照。
4. 在报告底部保存为个人巡检；回到首页后可直跑，并生成新的 Run，不覆盖历史报告。
5. 修改 Redis 延迟门禁为 `<= 3ms` 后执行，报告应变为 `Violated + Pause`，且锁定 Run 不出现第二份 `executionResults` 真相。

## 方案复用边界

- `REL-ORDER-480` 可命中已批准的订单发布 Playbook，但仍投影到同一候选计划，并通过唯一的 `PLAN_CONFIRMED` 锁定；不再出现独立 Playbook 直跑页。
- 小幅或重大漂移的旧 Playbook 只作匹配事实，不能恢复第二次授权或绕开当前 CandidateSet。
- 保存任务直跑仍保留事实刷新与漂移守门；每次执行创建新 Run。
- Playbook、保存任务和页面工作区都不是第二套可变业务真相；最终仍归入 CandidateSet / Job / Revision / Run / Report 链路。

## 本地验证

要求：Node.js 24+、本机 Chrome。没有第三方 npm 依赖。

```powershell
pnpm build
pnpm test
pnpm test:browser
```

浏览器验收直接从 `file://` 打开生成物，覆盖发布缺口、一次确认、规则编辑、exact Playbook 复用、保存/历史/分享以及 390px 响应式，并强制校验 0 个 HTTP(S) 请求和 0 个浏览器错误。

重录截图：

```powershell
node tests/offline.browser.mjs --evidence
```

## 文件说明

- `index.html`：唯一交付文件，双击即运行。
- `ARCHITECTURE.md`：对象、权限、证据和演进边界。
- `DESIGN-JOURNEY.md`：发布发起到覆盖诚实报告的用户旅程。
- `lib/compiler.mjs`：把变更引用和可选关注点编译成 CandidateSet 视图。
- `lib/scenarios.mjs`：不可变验收 fixture，不是业务模式或第二套 Store。
- `lib/reducer.mjs`：一次授权、锁 Revision、创建 Run/Report 的状态机。
- `src/`：纯渲染、响应式样式与浏览器事件适配。
- `tests/`：领域、旅程、UI、构建与真实 Chrome 验收。
- `evidence/`：桌面和 390px 验收截图。
