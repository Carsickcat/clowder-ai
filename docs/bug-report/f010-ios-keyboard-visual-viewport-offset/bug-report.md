# F010 iOS keyboard visual viewport offset

### Bug 诊断胶囊：iOS 输入法打开后 composer 被抬得过高

| 栏位 | 内容 |
|------|------|
| **1. 现象** | 期望：iPhone 打开输入法后，composer 紧贴键盘上沿，剩余可视高度用于展示当前消息与猫猫信息。实际：composer 被抬到键盘上方很远，二者之间出现大块空白，页面内容被压缩到顶部。 |
| **2. 证据** | co-creator 在 2026-07-17 提供的 iPhone 实机截图显示键盘与 composer 之间存在约半屏空白。代码审计发现 `useVisualViewportCssVars` 已分别发布 `visualViewport.height`、`offsetTop` 与 keyboard inset，但 `.app-viewport` 的高度只消费了 `height`。新增 CSS 契约测试在原实现 RED：缺少 `height + offsetTop` 公式。 |
| **3. 问题假设或根因** | iOS Safari 聚焦输入框时可能同时缩小 visual viewport 并产生非零 `visualViewport.offsetTop`。AppShell 从 layout viewport 顶部起算，却只取 visual viewport 的高度，导致其底边比真实可视底边高出 `offsetTop`；固定底部 chrome 又按 keyboard inset 对齐，最终把 composer 额外上抬。 |
| **4. 诊断策略** | 保留现有 `visualViewport` hook 作为唯一运行时真相源，只把 AppShell 底边不变量改为 `visualViewport.height + visualViewport.offsetTop`。固定导航继续消费既有 keyboard inset，不新增 UA 判断、焦点判断或第二套键盘高度。 |
| **5. 超时策略** | 若 iPhone 实机复测仍有空白，采集同一时刻的 `innerHeight`、`visualViewport.height`、`offsetTop` 与三个 CSS 变量，再核对 Safari 的 viewport 事件顺序；不靠猜测继续叠加 inset。 |
| **6. 预警策略** | 若修复需要新增 UA sniffing、额外 ResizeObserver、焦点专用高度或第三层 fallback，停止补丁并回到 AppShell 与 fixed chrome 的坐标系建模。 |
| **7. 用户可见交互修正** | 输入法打开后 composer 回到键盘上沿，键盘以外的可视区域继续显示当前对话与猫猫信息，不再被无意义空白挤走。 |
| **8. 验收** | RED：`mobile-overflow-contract` 在旧公式下 1 项失败；GREEN：实现消费 `--visual-viewport-offset-top` 后，viewport hook、mobile overflow、chat container 与 chat input 共 4 files / 19 tests 通过。最终仍需 co-creator 在同一台 iPhone 上复测真实 Safari/PWA 行为。 |

## Failure-mode audit

不变量：AppShell 的底边等于 visual viewport 的真实底边；键盘 inset 只负责固定底部 chrome 的定位，不能再次缩短 AppShell。

- `visualViewport.height`：描述当前可见高度。
- `visualViewport.offsetTop`：描述可见区域相对 layout viewport 顶部的位移。
- `height + offsetTop`：从 AppShell 起点到可见底边的距离。
- keyboard inset：继续由同一个 hook 计算，仅供 fixed mobile chrome 使用。
- 不支持 Visual Viewport API 的浏览器：两个 CSS fallback 仍分别为 `100dvh` 与 `0px`。

[宪宪/gpt-5.6-sol🐾]
