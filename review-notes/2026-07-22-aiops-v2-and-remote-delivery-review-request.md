# Review Request: NOVA Ops V2 场景重构与远端交付修复

Review-Target-ID: aiops-unified-workbench-prototype

Branch: feat/aiops-unified-workbench-prototype

## What

- 将统一运维原型从“五个重复 Evidence Lens”重构为八项原子能力、三条角色旅程、五个不同专业工作面。
- 形成发布验证、告警风暴处置、关键服务日巡三条可完成的决策闭环。
- 修复远端交付：不再把 `E:\` 路径当下载链接，新增 `html_widget` 构建器、交付回归测试和无同源权限的手机沙箱 smoke。

## Why

旧原型只证明了状态机能点，没有证明用户为何使用 AI 运维、五模块如何支撑不同判断。重构后首次交付又错误使用本机路径，导致远端手机进入 Cat Café 异常页。最终交付必须同时满足产品可理解、旅程可完成和手机可访问。

## Original Requirements

> “各个页签的数据高度重合，根本看不出来用户的使用旅程，能给用户带来什么价值。”
>
> “希望从 AI 运维的系统基本原子能力、用户交互旅程、用户使用场景三个方面介绍。”
>
> “NOVA-Ops-AI-Workbench-Standalone.html 打开时报错：Application error...”

- 来源：`thread_mrrzdymcf3z6bx77`；收敛规格：`feature-specs/2026-07-22-aiops-unified-workbench-prototype.md`
- **请对照上述体验判断交付物是否真正解决了 operator 的问题。**

## Tradeoff

选择对话内 `html_widget` 而不是仓库路径、localhost 或临时公网托管：避免远端访问本机和引入外部依赖。代价是 142 KB HTML 进入富消息 payload，且 1200px 组件在手机端需要宿主页滚动；已有 payload 构建和手机沙箱测试保护。

## Architecture Ownership

Architecture cell: prototype / product-design

Map delta: none

Why: 仅修改静态高保真、mock 数据、测试与交付脚本，不改变生产 Router、Store、Queue、Adapter、权限或数据边界。

请 reviewer 检查：

- diff 是否与 `Map delta: none` 一致；
- 是否意外引入生产依赖或外部网络访问；
- 五模块是否确实不同，而不是换标题/换色；
- `unknown` 是否仍无法静默变绿。

## Open Questions

### 技术 OQ

1. `html_widget` 在手机安全沙箱中的 1200px 高度与抽屉交互是否可接受？
2. 交付构建器对本机路径、localhost、外部脚本/样式的拒绝是否完整？
3. 三条旅程的终局与证据包是否足以证明不同用户价值？

### 价值 OQ

无。当前仅请求 reviewer 对已冻结的产品坐标和交付质量做反证。

## Next Action

请独立运行桌面、手机和 widget 沙箱路径，并给出明确 `APPROVE` 或 `REQUEST-CHANGES`。重点审查产品叙事、五模块专业差异、三条终局价值和远端交付，不只审状态机。

## Review Sandbox

- Source: `E:\ClowderAI\cat-cafe-aiops-workbench`
- 建议隔离副本：`E:\ClowderAI\cat-cafe-review\aiops-unified-workbench-prototype\terra`
- Start Command: `$env:AIOPS_PORT='5291'; node designs\aiops-unified-workbench\serve.mjs`
- Ports: `web=5291`, `api=n/a`

该 worktree 已有依赖，无需生产配置、Redis、SQLite 或外部网络。

## 自检证据

### Spec 合规

`designs/aiops-unified-workbench/quality-gate-report.md` 已逐项覆盖 AC-1~10；`docs/bug-report/aiops-standalone-remote-delivery/bug-report.md` 记录交付故障根因和回归。

### 测试结果

```powershell
node --test designs/aiops-unified-workbench/tests/domain.test.mjs designs/aiops-unified-workbench/tests/server.test.mjs designs/aiops-unified-workbench/tests/standalone.test.mjs designs/aiops-unified-workbench/tests/delivery.test.mjs
# 13/13 pass

node designs/aiops-unified-workbench/tests/browser-smoke.mjs
# HTTP + file:// BROWSER_SMOKE_OK, console 0

node designs/aiops-unified-workbench/tests/widget-smoke.mjs
# WIDGET_SMOKE_OK sandbox=allow-scripts

pnpm exec biome check designs/aiops-unified-workbench/scripts/build-rich-widget.mjs designs/aiops-unified-workbench/tests/delivery.test.mjs designs/aiops-unified-workbench/tests/widget-smoke.mjs
# no fixes, exit 0

git diff --check
# exit 0
```

### 视觉证据

`C:\Users\myh_1\AppData\Local\Temp\cat-cafe-evidence\aiops-unified-workbench-v2\`

- `01-capability-and-scenarios.png`
- `02-release-outcome.png`
- `04-inspection-unknown-honest-report.png`
- `05-mobile-incident.png`

### 相关文档

- Plan: `feature-specs/2026-07-22-aiops-unified-workbench-prototype.md`
- Design: `designs/aiops-unified-workbench/final-design.md`
- Quality: `designs/aiops-unified-workbench/quality-gate-report.md`
- Bug: `docs/bug-report/aiops-standalone-remote-delivery/bug-report.md`

[丢丢/gpt-5.6-sol🐾]
