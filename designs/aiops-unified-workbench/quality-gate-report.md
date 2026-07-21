# AI Ops Unified Workbench — Quality Gate Report

**Spec:** `feature-specs/2026-07-22-aiops-unified-workbench-prototype.md`  
**Original request:** 统一监控、告警、日志、巡检、拨测，参考优秀 AI 运维产品，提供真实可点击的用户旅程。  
**Checked:** 2026-07-22  
**Worktree:** `E:\ClowderAI\cat-cafe-aiops-workbench`  
**Preview:** `http://127.0.0.1:5278/`

## Vision Coverage

| Requirement | Implementation | Evidence |
|---|---|---|
| 五模块统一但保留专业入口 | Product nav 深链到同一事件的五种 Evidence Lens | 浏览器 smoke：`data-module='logs'` 后仍为 `HE-1042` |
| 真实可点击 | 所有导航、证据、Finding、Owner、整改与复验均由 reducer 驱动 | `tests/browser-smoke.mjs` Golden Path |
| AI 不是摘要秀 | 事实 / 推断 / 证据缺口 / 建议动作四分栏 | AI 调查员右栏 |
| unknown 不得静默变绿 | coverage 与 baseline 门禁优先派生 unknown | unit test + `HE-1045` / `HE-1047` |
| 上下文不丢 | service / env / time / change / HealthEvent 顶部锁定 | unit test + browser smoke |
| 桌面与移动端 | 桌面常驻窄栏，移动端 AI 抽屉 | desktop / mobile screenshots |

## Product and State Matrix

- Entry: L1 专业模块 + L2 HealthEvent 工作队列。
- Data: full / partial / unknown。
- Health: unhealthy / unknown / recovering。
- Baseline: comparable / drifted。
- Workflow: investigate / finding / action / verification。
- Viewport: desktop / mobile。
- Authority: 所有生产相关动作只模拟人工确认，不执行外部调用。

## Design-System Check

- 视觉值全部经 CSS custom properties 组织。
- 状态不只依赖颜色，同时带中文标签、数值和门禁文本。
- 交互按钮均有显式 `type="button"`。
- 装饰性 SVG 标记 `aria-hidden="true"`；按钮保留可访问名称。
- `prefers-reduced-motion` 有降级。
- 未匹配到 `designs/**/*.pen` 中与 aiops / unified / workbench 相关的设计稿，因此无 `.pen` 对照流程。

## Dogfood-Your-Slice

**Scope verdict:** 必做，已完成。

Golden Path：

```text
HE-1042
→ 日志专业模块
→ 钉入 timeout 与 config 两条证据
→ 人工确认 Finding
→ 分派陈曦
→ 开始整改
→ 发起复验
→ 完成复验
→ recovering
```

Non-happy Path：

```text
HE-1047
→ unknown
→ 证据链中断门禁
→ 日志 Lens
→ 仍显示 HE-1047 / member-service / 23m freshness
```

Dogfood 中发现并修复：

1. favicon 404 导致浏览器 console error；改为 inline data favicon。
2. unknown 事件日志摘要误复用发布事件的 `842`；改为事件相关值。
3. 移动端截图发生在抽屉退出动画中；验收等待动画结束并检查 bounding rect。
4. Finding 状态显示英文枚举；改为中文用户文案。

## Fresh Verification

| Command / Path | Result |
|---|---|
| `node --test designs/aiops-unified-workbench/tests/domain.test.mjs` | 5/5 pass |
| `node designs/aiops-unified-workbench/tests/browser-smoke.mjs` | `BROWSER_SMOKE_OK`，console 0 error |
| `pnpm exec biome check designs/aiops-unified-workbench feature-specs/... --diagnostic-level=error` | exit 0 |
| HTTP preflight `http://127.0.0.1:5278/` | 200，title present |
| `pnpm lint` | exit 0 |
| `pnpm -r --if-present run build` | exit 0 |
| `pnpm test` | exit 1：`origin/main` 既有 Web 测试失败；本次未修改 `packages/` |
| `pnpm check` | exit 1：`origin/main` 既有格式/CRLF 差异；本次目标路径 Biome check 为 0 |

## Visual Evidence

截图保存在临时证据目录，不进入仓库：

`C:\Users\myh_1\AppData\Local\Temp\cat-cafe-evidence\aiops-unified-workbench`

- `01-golden-path-desktop.png`
- `02-unknown-guardrail.png`
- `03-mobile-investigation.png`

## Artifact Hygiene

- 仓库根目录无新增 PNG / JPG / WebP / GIF / WebM / MP4 / PDF / PEN。
- 所有截图均位于临时 evidence 目录。
- 原型不访问 Redis、SQLite、现有 runtime 或外部 API。

## Architecture Ownership

**Architecture cell:** prototype / product-design  
**Map delta:** none  
**Why:** 仅新增静态设计原型和测试，不改变生产路由、存储、队列、适配器或数据边界。

## Known Boundary

原型状态只在页面内存中存在，刷新后重置。它证明交互与信息架构，不代表真实遥测接入、权限系统或生产处置能力已经实现。
