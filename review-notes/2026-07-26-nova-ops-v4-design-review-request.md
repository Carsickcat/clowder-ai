# NOVA Ops V4 设计一致性复审请求

Review-Target-ID: `aiops-observability-platform-hifi-v3`

Branch: `feat/aiops-observability-platform-hifi-v3`

HEAD: `80be30edf9ad4dafcf04235cf05a3766aa36a930`

Reviewer: `@烁烁`

## Original Requirements

来源：本线程 co-creator 2026-07-26 产品与设计验收要求，以及
`project-research/2026-07-26-aiops-observability-platform-v3/product-solution.md`。

> 关闭登录鉴权，手机直接打开公开地址。  
> 评审重点不是代码与按钮功能，而是页面交互旅程和产品功能是否符合真实运维设计。  
> 首页从模块导航改为角色与场景入口。  
> 工作页恢复“旅程步骤 / 专业工作面 / 决策检查器”三栏骨架。  
> 大促保障、变更验证、日巡/NL2、故障诊断需要形成不同的专业旅程与场景语气。  
> 监控、告警、日志、Trace、拨测应成为旅程中的专业证据面，而不是全局抽屉。  
> 延续 Cat Café 的三层 token 命名、品牌标记与历年视觉语言。

## Review Scope

只审设计样式一致性、信息架构与用户旅程，不审代码、自动化测试或功能实现：

1. 首页是否以发布负责人、值班 SRE、服务 Owner 三种角色和四类场景进场。
2. 进入旅程后是否稳定呈现左侧五步任务、中间专业证据、右侧事实/假设/缺口/建议/人工 verdict。
3. release / on-call / service 三类场景 accent 是否既能区分语义，又仍属于同一套产品。
4. Metrics / Alerts / Logs / Traces / Synthetics / Inspection 是否处在当前旅程内，且没有退化为七个同构模块页。
5. 独立故障诊断入口及其 Investigation 旅程是否足以让值班人员理解“从告警到回写 Verification”。
6. 桌面和手机首屏是否都能看懂下一步行动，不像能力介绍官网。

## Architecture Ownership

- Architecture cell: `AI Ops operator journey shell`
- Map delta: `update required`
- Why: 导航坐标由“七个产品模块”变更为“角色/场景 → 旅程 → 专业证据 → 人工决策”；双 Agent 领域边界保持不变。

## Red → Green

- 首页模块导航 → 三角色、四场景入口。
- 单栏 dashboard → 三栏旅程工作台。
- 全站单一蓝青 → release 蓝 / on-call 琥珀 / service 薄荷绿。
- 全局 Evidence Lens → 旅程内六类专业工作面。
- 故障诊断附属于变更 → 独立告警/人工建案入口与 Investigation 闭环。
- 无品牌层次 → base / semantic / persona token 与 Cat Café 版本标记。

## Evidence

- 生产公开地址：<https://nova-ops-ai-observability-2026.saltfish001.chatgpt.site>
- Sites 版本：`6`，公开免登录。
- 生产 Chrome 截图已确认角色/场景首页真实渲染。
- 本地质量报告：`review-notes/2026-07-26-nova-ops-v4-quality-gate-sonnet.md`
- 页面使用说明：`designs/nova-ops-observability-platform-v3/USER-GUIDE.md`
- 浏览证据：
  - `designs/nova-ops-observability-platform-v3/evidence/01-live-ops-desktop.png`
  - `designs/nova-ops-observability-platform-v3/evidence/02-change-verification-passed.png`
  - `designs/nova-ops-observability-platform-v3/evidence/03-nl2-inspection-studio.png`
  - `designs/nova-ops-observability-platform-v3/evidence/nova-ops-v3-golden-path-15s.webm`

## Self-check

- `npm run check`: format clean、19/19 tests、Sites build 通过。
- `npm audit --audit-level=high`: 0 vulnerabilities。
- `git diff --check`: 通过。
- 本地真实 Chrome：desktop 3 journeys + mobile guide/studio，console 0。
- 生产匿名 HTTP：200，无登录提示。
- 生产真实 Chrome：V4 角色/场景首页完成渲染。
- 生产 Playwright 受 Cloudflare Bot Challenge 超时；这是自动化证据边界，不计为产品 verdict。
- 根目录媒体工件门禁：无命中。

## Open Questions

- 技术 OQ：无，本轮不评技术实现。
- 价值 OQ：无，四类场景与双 Agent 边界已由产品方案冻结。

请给明确 `APPROVE` 或 `REQUEST-CHANGES`；若退回，请仅按设计影响列 `P1/P2/P3`。
