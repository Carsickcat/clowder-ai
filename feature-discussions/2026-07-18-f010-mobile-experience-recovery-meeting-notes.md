# F010 移动体验恢复：三猫收敛纪要

**Feature:** [F010 手机端猫猫](../docs/features/F010-mobile-cat.md)
**Thread:** `thread_mrogfco44bos1sgn`
**日期:** 2026-07-18
**参与:** 宪宪 Sonnet（主导）、宪宪 Terra、宪宪 Opus 4.5
**输入:** [Sonnet 独立分析](../project-research/2026-07-18-f010-mobile-experience-recovery/sonnet-analysis.md)

## 1. 终点

这轮的终点不是再交一份方案，而是交付可以在隔离 PWA 验收环境运行的移动端修复：iPhone 输入不缩放、键盘态不浪费底栏空间、消息区是唯一纵向滚动面、基础设施提示不遮挡聊天、已被服务端接收的消息不再显示矛盾的失败气泡，并完成自动化、生产构建和真机复验入口。

## 2. 三份观点

### Sonnet

- 用一个 Visual Viewport frame、一个消息滚动 owner、一个底部 Dock 取代分散的 `fixed` 与 padding 补偿。
- 键盘打开进入创作模式：隐藏全局底栏，composer 贴近可视底边，editable 字号至少 16px。
- mention 候选改成受视觉视口约束的移动 tray。
- 更新检查失败降级为诊断；只有 waiting worker 才主动提示更新。
- 发送响应丢失先对账，再判失败。

### Terra

- 支持相同的单 owner 架构，明确反对继续增加 `calc()` 或 UA 特判。
- 指出截图对应的 Web 构建早于 `72b995f`：截图能证明整体体验失败，但不能作为该提交已失败的证据。
- 要求发送路径采用同一幂等键完成 `confirming -> reconcile -> retry`，并让验收截图关联运行构建身份。

### Opus 4.5

- 支持隐藏键盘态底栏、16px 输入、紧凑 mention、静默更新检查和单一滚动面。
- 要求先证明运行版本，再判断最新补丁；可靠性问题与视觉问题分波实现。
- 反对把产品级 `dispatchReady` / 路由模型塞入本轮 F010；若 Kimi 注册异常成立，应在所属 feature 修复。

## 3. 共识与决定

1. **不是设备分辨率问题。** 1170×2532 是 iPhone 13 Pro 的 3x 截图栅格；布局契约应基于动态 CSS viewport、safe area 与键盘态，不硬编码机型。
2. **统一几何 owner。** AppShell/chat shell 只拥有一个视觉视口 frame；thread 消息列表是聊天页唯一纵向滚动 owner。
3. **键盘态是独立模式。** 键盘打开时隐藏移动底栏，并同步取消其预留高度；composer 与唯一主操作完整可见。
4. **保持可访问缩放。** editable 控件使用至少 16px；否决 `maximum-scale=1` 与 `user-scalable=no`。
5. **状态让位于任务。** Socket 降级压缩成一行；更新检查失败不再常驻大横幅；真正 update-ready 才显示动作。
6. **消息结果可对账。** 同一 client UUID 写入 InvocationRecord 与 Message；duplicate acknowledgement 返回原 `userMessageId`；响应不明时先重放同一幂等请求对账，最终失败附着在用户消息上，而不是插入红色系统气泡。
7. **版本证据是验收前置条件。** 验收构建必须晚于目标提交，并记录 `BUILD_ID`、commit 与启动时间。
8. **实现复审后的 owner 澄清。** 所有可派发请求先用持久化 `InvocationRecord` 做跨模式原子 claim；queue/TOCTOU 路径再链接同一个稳定 `queueEntryId`。前者只承担并发 claim/lifecycle，`InvocationQueue` entry 仍是 queued API response owner。这个链路取代“queue 完全不创建 InvocationRecord”的早期表述，避免同 UUID 请求在 busy 状态变化时分裂为 immediate 与 queue 两次派发。

## 4. 分歧处理

唯一实质范围分歧是是否在本轮引入通用 `dispatchReady` 模型。

**决定：不纳入 F010。** 本轮只要求隔离验收 roster 不把已知不可路由的猫当成可调用能力；通用 catalog/adapter/runtime readiness 由其所属路由 feature 处理。这样既不掩盖“猫猫自动配置”的真实失败，也不让移动体验修复跨越 `identity-session` / `dispatch` 的产品边界。

F010 只增加**验收环境专属的 fail-closed 门禁**：API 完成 `AgentRegistry` 同步后，门禁比较 `/api/cats` 对应的 resolved catalog 与已注册 `AgentService`；只要有一个展示成员不能进入现有路由注册表，验收 API 就拒绝启动并输出缺失 ID。它不新增前端字段、产品端 readiness 状态或长期配置；通过后的证据逐项记录 `catId`、provider/client、适配器模式与 `AgentService` 注册结果，并关联实际 roster、构建身份和启动时间。

三猫对其余技术方向一致，无真实二选一争议，因此不举行形式投票。若正式评审出现新的冲突，再对具体命题投票，不对已形成共识的内容做表演性表决。

## 5. 否决项

- 按 iPhone 13 Pro 固定宽高布局；
- 再叠一层 keyboard inset、UA sniff 或焦点专用 fallback；
- 键盘打开时把底栏抬到键盘上方；
- 用禁止缩放掩盖 14px 输入控件；
- 把每次 Service Worker 检查异常升级为阻塞 banner；
- 把网络响应不明直接等同于服务端未提交；
- 在未验证执行注册时仅复制 catalog 就宣称猫猫可调用。

## 6. Stateful object census

| 对象 | lifecycle owner | 状态 / 事件 | 不变量与测试 |
|---|---|---|---|
| Visual viewport projection | `useVisualViewportCssVars` | resize/scroll/orientation -> CSS vars | `top/left/width/height` 是 VisualViewport 在 layout viewport 坐标系中的 CSS-pixel 矩形；只有该 hook 写变量；AppShell 直接定位到该矩形，不再叠加 offset 或 keyboard inset |
| Mobile composition mode | `data-mobile-keyboard-open` 的纯投影 | closed/open | 不新建持久 store；open 时 nav 不显示且不预留高度 |
| Mobile Dock geometry | global CSS dock token + `MobileOpsShell` | nav visible/hidden；safe area；compact/wide breakpoint | CSS token 是 Dock 高度和 chat reserve 的唯一来源；nav 只消费一次 safe area；键盘态 token 归零，ChatContainer 不自行复制 `4rem + safe-area` |
| Composer session | `ChatInput` 的 thread-scoped draft/image/reply maps + session storage | input/image/reply/mention；viewport、键盘、线程与 remount 事件 | frame/mode 变化不得重挂载输入区；文字、附件、reply context 保留；mention tray 可关闭但不得改写输入内容；复用并扩充 draft persistence 测试 |
| Mention tray | `ChatInput`（open/filter/selection/IME）+ `ChatInputMenus`（anchor/visual bound） | closed/open/filtering/composing/selecting | 上锚 composer，最大高度受 visual viewport 约束；IME composition 中不触发选择；关闭后恢复 composer 焦点且不改输入 |
| Connection status projection | `useConnectionStatus` 数据 + `ConnectionStatusBar` 纯投影 | healthy/degraded/recovering/offline | healthy 不占位；移动端异常只占一行摘要，可展开明细；恢复不新建持久状态 |
| Immediate/force send cycle | `useSendMessage` + `InvocationRecord` | optimistic -> processing/acknowledged / confirming -> reconciled / failed | JSON/multipart/force 共用一个 client UUID；仅 transport/parse ambiguity 同 key 对账一次；duplicate 从 record 返回原 message id；确定 4xx 不重放 |
| Queue send cycle | `useSendMessage` + `InvocationRecord` atomic claim + existing `InvocationQueue` entry | claimed -> enqueued/deduped-confirming/queued/full/failed | queue 没有 optimistic 气泡；record 持久化同一 `queueEntryId`，entry 是外部 response owner；deduped entry 有 message id 即返回原 id，无 id 则 confirming；TOCTOU、QUEUE_FULL 与确定 validation error 不重放 |
| PWA update state | `PwaUpdateController` | idle/checking/update-ready/error-diagnostic | 检查失败不遮挡任务面；waiting worker 才可提示安装 |

对抗场景：POST 提交后响应丢失、即时/排队路径在 message id 回填前收到重复请求、重复重试、Socket 降级、键盘快速开关、地址栏/方向改变、frame 变化与线程切换期间的 composer session、SW update check rejection。以上均有聚焦测试，且不创建第二套 durable UI state。

Failure-mode audit 结论：评审发现的两类遗漏都不是孤立点。发送竞态必须同时覆盖 immediate 与 queue sibling paths；输入区则按 text、image、reply context、mention 四类本地状态逐项检查，不用单个 happy path 代替生命周期契约。

## 7. 实施范围

- P0：版本身份、viewport/scroll/dock、composer 16px、键盘态底栏隐藏。
- P1：mention tray 边界、连接状态压缩、更新错误降噪。
- P1：幂等消息 acknowledgement 与一次性对账。
- P1：隔离验收 roster fail-closed 门禁与证据输出；不改变产品 catalog 契约。
- P2：视觉抛光与多尺寸浏览器证据。
- 范围外：通用猫猫 readiness 模型、Capacitor/native、新导航层级、完全离线发送。

## 8. 评审门槛

评审猫必须明确 `APPROVE` 或 `REQUEST_CHANGES`，并逐项确认：观点是否被准确表达、范围拆分是否合理、状态对象是否完整、验收能否证明用户问题消失。只有评审通过才进入代码；报告通过后仍不是终点，代码、构建、隔离验收与 review 全部完成才可向 operator 报告完成。

[宪宪/gpt-5.6-sol🐾]
