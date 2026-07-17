# F010 iOS keyboard visual viewport offset

### Bug 诊断胶囊：iOS 输入法打开后页面错位、composer 与键盘之间出现空洞

| 栏位 | 内容 |
|------|------|
| **1. 现象** | iPhone 打开输入法后，composer 曾被抬到键盘上方很远，消息区被压缩到顶部；修复旧空洞后，真机仍出现输入聚焦缩放、发送按钮裁切、候选框过高、底部导航与键盘争夺空间等问题。 |
| **2. 证据** | co-creator 于 2026-07-17 提供的四张 iPhone 13 Pro 截图同时显示：页面几何随键盘和滚动漂移、输入框聚焦后发生缩放、底部多层固定区域侵占阅读面积、PWA 更新检查失败以永久横幅遮挡内容。代码审计确认 AppShell、移动导航、composer 与状态层分别消费 viewport、safe-area、keyboard inset 和固定高度。 |
| **3. 根因** | 根因不是某个 iPhone 分辨率未硬编码，而是多个 viewport/fixed chrome owner 在不同坐标系中重复补偿。`height + offsetTop` 只是旧实现的中间假设：当 AppShell 已直接定位到 VisualViewport 矩形时，再把 offset 或 keyboard inset 叠入高度/底边会二次补偿，重新制造空洞。 |
| **4. 终态模型** | `useVisualViewportCssVars` 是唯一几何真相源，发布 VisualViewport 在 layout viewport 坐标系中的 `top/left/width/height` CSS pixel 矩形。AppShell 直接使用该矩形定位；safe-area 只由矩形边缘处理；已经缩小的 visual viewport height 不再追加 keyboard inset。消息区是唯一纵向滚动 owner，底部 Dock 高度只有一个写入者。 |
| **5. 输入态规则** | 键盘打开时隐藏四项底部导航，composer 贴近 visual viewport 底边；输入字体至少 16px，避免 iOS 聚焦自动放大；移动端只显示一个主操作。mention tray 锚定在 composer 上方，最大高度不超过 visual viewport 的 40%，不得改写草稿。 |
| **6. 错误分层** | 后台 Service Worker 注册/更新检查失败仅进入诊断日志，不再永久占据聊天页；只有 waiting worker 或用户可执行的更新动作才显示提示。Socket 降级压缩为单行状态入口。 |
| **7. 发送恢复** | transport/response-parse 不确定性只允许以同一 idempotency key 重放一次；服务端 duplicate 明确返回 acknowledged/confirming/failed/invariant violation。客户端在 confirming 时保留 optimistic bubble，等待 durable message 对账，不再插入与服务端成功相矛盾的红色系统消息。 |
| **8. 验收** | 自动化覆盖 VisualViewport 矩形、单 Dock reserve、键盘隐藏导航、16px composer、bounded mention、草稿/附件/reply context 保持、PWA 错误降噪、immediate/queue/TOCTOU 幂等竞态与 acceptance roster fail-closed。最终仍需在隔离 4310/4311 环境和同一台 iPhone 的 Safari/PWA 中复测。 |

## Failure-mode audit

不变量：

- `--app-viewport-top/left/width/height` 共同描述唯一的可见矩形，不能拆开后在不同组件重复推导。
- AppShell 直接定位到该矩形；禁止同时使用“layout viewport + transform”与“完整矩形定位”。
- 已缩小的 visual viewport height 不再叠加 keyboard inset。
- `--mobile-dock-reserve` 是聊天内容与移动导航共享的唯一 Dock 高度 token；键盘态归零。
- 页面根节点不滚动，消息区是唯一纵向滚动区域。
- 不支持 Visual Viewport API 时回退到 `top/left = 0`、`width = 100vw`、`height = 100dvh`。

## 被否决的中间假设

`height + offsetTop` 曾作为局部修复进入测试，但它仍让 AppShell 与 fixed chrome 分别解释坐标。真机复测暴露出该模型无法约束多层 fixed 区域，因此被完整矩形 + 单 Dock 模型取代；不再继续增加 UA sniffing、焦点专用高度或第三层 fallback。

[宪宪/gpt-5.6-sol🐾]
