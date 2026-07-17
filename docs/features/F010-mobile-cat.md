---
feature_ids: [F010]
related_features: [F020, F022, F034]
topics: [mobile, cat]
doc_kind: note
created: 2026-02-26
tips_exempt: passive mobile layout, keyboard, update-noise, and send-reconciliation fixes do not introduce a discoverable user action
---

# F010: 手机端猫猫

> **Status**: in-progress | **Owner**: 宪宪（架构/实现）+ 三猫审核
> **Created**: 2026-02-26

## Why

operator 首次从手机经 Tailscale 使用 Clowder AI 时，桌面布局在窄屏上不好看，也不具备完整、可验证的 App 体验。目标是在不复制产品、不分叉数据和身份的前提下，让同一套 Clowder AI 在手机上可安装、好操作、可恢复。

> operator experience（2026-07-17）：“这是首次在手机上召唤你们，现在通过 tailscale 网页访问样式不太好看……功能和样式和当前保持一致。”

## Current State

- 已有 manifest、Service Worker、safe-area、移动底栏和部分移动工作表面；
- `useIsDesktop()` 的 768px 与 Tailwind `lg` 的 1024px 存在断点分叉；
- 候选 `PwaInstallPrompt` 已有基础测试，但尚未满足 30 天 dismiss、installability 诊断、常驻入口和全路由遮挡验收；
- 缺少统一全局抽屉、真机摩擦基线、更新保护和完整设备矩阵证据。
- 2026-07-18 恢复实现已在 feature worktree 完成单 VisualViewport 矩形、单消息滚动区、单 Dock reserve、键盘态隐藏导航、16px composer、bounded mention、PWA 错误降噪与幂等发送对账；自动化与隔离验收仍在闭环中，尚不宣称 F010 完成。
- 验收 API 新增仅在显式 acceptance 环境启用的 AgentRegistry fail-closed roster gate；正常产品启动与通用 `dispatchReady` 契约不变。

## What
- **F10**: 路线图：2026-02-20-mobile-cat-roadmap.md。决策：PWA 先行（两猫独立思考共识 + operator确认）。Phase A PWA 手机化 → B TTS/Voice Block → C 推送 → D 原生壳（如需要）。关联：F20/F22/F34。参考 Happy + OpenClaw
- **2026-07-17 批准实施**：[移动端 PWA 标准方案](../design/F010-mobile-pwa-standard.md)。三位原作者完成两轮审核并放行，operator 已批准按 A0 → A1 → A2 → A3 推进；候选安装提示不自动计为完成。
- **2026-07-18 真机体验恢复**：四张 iPhone 13 Pro 截图将 viewport、composer、状态密度、PWA 更新噪音与 ambiguous send 提升为同一恢复切片。三猫收敛方案与实施计划均已通过评审，Sonnet 正按 Red→Green→隔离验收推进；计划与评审只是中间门禁，工作结果才是本轮交付。

## User Journey

**Scope unit:** 同一位 operator、同一份 Clowder AI 数据、同一条 Tailscale 私网 HTTPS 入口。

1. operator 在手机 Safari/Chrome 打开 Tailscale Serve HTTPS 地址；
2. 从页面诊断确认 secure context、Service Worker 与安装能力，安装到主屏幕；
3. 通过左侧全局抽屉选择 thread 或进入 Memory、Mission、Signals、Settings；
4. 在底栏完成对话、工作、产物和全局审批闭环；
5. 经历软键盘、横竖屏、后台恢复、断线重连或版本更新时，草稿和当前上下文保持可恢复；
6. 返回桌面端时继续使用同一套功能与数据，无移动端分叉。

## Acceptance Criteria

- [ ] **AC-A0**：形成 390×844、430×932、768×1024、1024×768 的现状证据与路由 × 功能 × 设备矩阵；记录 operator 真机型号和主要摩擦。
- [ ] **AC-A1**：`<1024px` 统一使用移动工作表面；JS 与 Tailwind 消费同一 breakpoint 真相源；左侧抽屉提供 Threads / Memory / Mission / Signals / Settings，底栏保留对话 / 工作 / 产物 / 全局审批。
- [ ] **AC-A2**：安装体验覆盖 secure context、Service Worker、standalone、iOS 手动步骤、支持/不支持/WebView 诊断和本机 30 天 dismiss；API、Socket、上传下载保持 Tailscale HTTPS 同源。
- [ ] **AC-A3**：后台恢复、online/offline、Socket 重连和 Service Worker 更新均有明确状态；更新不会丢失草稿、当前 thread 或已提交业务动作。
- [ ] **AC-A4**：手机核心功能 parity checklist 无缺项；light/dark 与主要主题完成浏览器截图，iPhone/Android 完成关键旅程真机记录，桌面 AppShell 无回归。
- [ ] **AC-A5**：代码通过本轮测试、lint、check、build、浏览器 dogfood，并由 terra、Opus 4.5、Fable 5 给出明确代码 review verdict，P1/P2 清零。
- [ ] **AC-A6**：iPhone 13 Pro Safari/PWA 键盘开关、中文组合输入、`@` 候选、回复中、发送确认丢失、Socket 降级与更新检查失败均无横向滚动、输入缩放、按钮裁切、重复 Dock reserve 或永久遮挡；证据绑定当前 build ID。

## Key Decisions
- Phase A PWA 手机化 → B TTS/Voice Block → C 推送 → D 原生壳（如需要）
- 2026-07-17 operator 批准：同一套 Next.js 产品 + 响应式移动壳 + PWA + Tailscale Serve；原生壳仅由后台语音、Widget、Share Extension、商店/MDM 分发等真实能力门触发。
- 手机正式入口只接受 Tailscale Serve HTTPS secure context；raw IP/HTTP 仅用于诊断。
- 安装提示只是 A2 子项，不代表移动体验完成。

## Dependencies
- **Related**: F010（保留原始依赖记录见下）
- F20/F22/F34
- F020
- F022
- F034

## Risk
| 风险 | 缓解 |
|------|------|
| 历史文档口径与当前实现可能漂移 | 在 F094 批次里持续复跑审计脚本并按批次回填 |
| 无 Git 的本地阶段难以隔离与审计代码 | 功能代码先在不含配置/持久数据的隔离沙盒 TDD，并保留本地临时 Git diff；正式仓建立后导入提交再进入 review/merge |
| PWA 安装成功被误当成手机体验完成 | 以导航、键盘、安全区、恢复、更新、功能 parity 与真机证据共同验收 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-07-17 | 三位原作者完成两轮标准方案审核，全部 APPROVE |
| 2026-07-17 | operator 批准 PWA 先行终稿并授权开始实现，要求代码拉全体参与审核 |
| 2026-07-18 | 根据 iPhone 13 Pro 真机截图收敛移动体验恢复方案；两位独立 reviewer 复审 v2 后 P1/P2 清零，进入 TDD、隔离验收与代码 review |

## Tips Contribution（F244）

- 计划在移动全局抽屉或安装诊断中提供一条可操作提示，指向本方案的安装/故障诊断真相源；实现 review 时验证其时机和动作，不新增泛化口号。

## Links

- [F010 移动端 PWA 标准方案](../design/F010-mobile-pwa-standard.md)
- 实施计划：`feature-specs/2026-07-17-f010-mobile-pwa.md`
