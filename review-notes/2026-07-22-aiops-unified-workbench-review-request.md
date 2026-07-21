# Review Request: 统一 AI 运维调查工作台高保真原型

Review-Target-ID: aiops-unified-workbench-prototype
Branch: feat/aiops-unified-workbench-prototype

## What

新增一个真实可点击的统一运维原型：以 `HealthEvent` 为跨模块调查容器，以监控、告警、日志、巡检、拨测为可深链的 Evidence Lens，贯通证据、Finding、Owner、整改和复验。原型含桌面/窄屏形态、纯 reducer 状态机、5 个领域测试和真实 Chrome 用户旅程。

## Why

上一版只交付了不可点击的视觉结果，也仍以模块平铺为主坐标系。此次重构采用我们已对齐的“事件调查层 + 专业模块入口”结构，并把 `unknown`、证据新鲜度和基线漂移提升为阻断式产品状态。

## Original Requirements

> 围绕监控、告警、日志、巡检、拨测输出统一高保真；参考业界优秀 AI 运维产品，先讨论一致再画；可以 PNG，也可以最小可点击系统，要能看完整用户交互旅程。

- 来源：Cat Café thread `thread_mrrzdymcf3z6bx77`，消息 `0001784648405465-000037-424f8628` 与纠偏 `0001784651912678-000041-b38abe73`
- 规格转录：`feature-specs/2026-07-22-aiops-unified-workbench-prototype.md`
- **请对照上述 operator experience 判断交付物是否解决了“不可点击”和“五模块仍割裂”两个问题。**

## Tradeoff

- 没有把五模块吞进通用聊天框；保留专业模块入口和深链。
- 没有展示完整 Agent Trace；只展示可复核事实、推断、证据缺口、建议动作和来源。
- 没有接真实生产数据、权限或处置接口；本轮验证信息架构与交互闭环，所有数据为本地 mock。
- 健康地图仅作筛选入口，健康分不占视觉中心。

## Architecture Ownership

Architecture cell: prototype / product-design
Map delta: none
Why: 仅新增静态设计原型和测试，不改变生产路由、存储、队列、适配器或数据边界。

请 reviewer 检查：

- diff 是否与 `Map delta: none` 一致；
- 是否意外建立了平行生产 Store / Queue / Router / Adapter / Dispatcher / Binding；
- 事件调查层是否位于五模块之上，同时没有吞掉各模块专业入口。

## Open Questions

### 技术 OQ

1. 五个 Lens 切换是否真实继承 service / env / time / change / HealthEvent，而非仅复用视觉标题？
2. 钉入证据后是否即时且幂等地更新证据数、时间线和 Finding？
3. `unknown`、数据过期、基线漂移是否始终阻止健康结论？
4. 移动端 AI 抽屉是否不遮挡核心调查和治理动作？

### 价值 OQ

无。当前方向已由丢丢与 Terra 达成一致，本次请验证落实程度。

## Next Action

请独立运行领域测试与浏览器旅程，给出 `APPROVE` 或 `REQUEST-CHANGES`。尤其反证上述四个技术 OQ；如有 finding，请标 P1/P2/P3。

## Review Sandbox

- Source worktree: `E:\ClowderAI\cat-cafe-aiops-workbench`
- Reviewer sandbox: `/tmp/cat-cafe-review/aiops-unified-workbench-prototype/opus`
- Start command: `python -m http.server 5279 --directory designs/aiops-unified-workbench`
- Ports: `web=5279`, `api=none`
- 当前 operator 预览：`http://127.0.0.1:5278/`

## 自检证据

### Spec 合规

完整报告：`designs/aiops-unified-workbench/quality-gate-report.md`。AC-1 至 AC-9 均有实现或自动化证据；截图只保存在临时证据目录，不污染仓库。

### 测试结果

```text
node --test designs/aiops-unified-workbench/tests/domain.test.mjs
5 passed, 0 failed

node designs/aiops-unified-workbench/tests/browser-smoke.mjs
BROWSER_SMOKE_OK; desktop golden path + unknown guardrail + mobile drawer; console 0 error

pnpm exec biome check designs/aiops-unified-workbench feature-specs/2026-07-22-aiops-unified-workbench-prototype.md
exit 0, no warnings

pnpm lint
exit 0

pnpm -r --if-present run build
exit 0
```

全仓 `pnpm test` 与 `pnpm check` 在未改动的 `origin/main` 基线上已有 Web 测试和格式/CRLF 失败；本次未修改 `packages/`，差异和边界已记录在 quality-gate report，不能冒充全仓绿。

### 浏览器证据

- `C:\Users\myh_1\AppData\Local\Temp\cat-cafe-evidence\aiops-unified-workbench\01-golden-path-desktop.png`
- `C:\Users\myh_1\AppData\Local\Temp\cat-cafe-evidence\aiops-unified-workbench\02-unknown-guardrail.png`
- `C:\Users\myh_1\AppData\Local\Temp\cat-cafe-evidence\aiops-unified-workbench\03-mobile-investigation.png`

### 相关文档与提交

- Plan: `feature-specs/2026-07-22-aiops-unified-workbench-prototype.md`
- Final design: `designs/aiops-unified-workbench/final-design.md`
- Commits: `c3832e1`, `54a3417`, `541b2ce`

### 工件卫生

- Target worktree 在写入本 review note 前为 clean。
- 根目录媒体门禁：working tree 与 `origin/main...HEAD` 均无根目录图片/视频/PDF/PEN。
- 主工作树中 co-creator 原有未跟踪研究稿保持未触碰，不属于本分支。
