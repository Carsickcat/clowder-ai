# F010 contextual install banner obscures chat chrome

### Bug 诊断胶囊：聊天页安装横幅与 composer 争用底部空间

| 栏位 | 内容 |
|------|------|
| **1. 现象** | 期望：聊天页的输入区和最近消息始终可见、可操作。实际：PWA contextual banner 固定在底部导航上方，但没有为聊天 composer 的实际高度留空间，可能覆盖输入区。 |
| **2. 证据** | Opus 4.5 对 `461c5e3..c882900` 的复审指出：banner 使用 `z-[29]`，底部只偏移键盘 inset、4rem mobile nav 与 safe area；ChatInput/composer 并没有对应的占位契约。新增组件测试在原实现 RED：`hasMobileNav=true` 时仍渲染 `pwa-install-banner`。 |
| **3. 问题假设或根因** | 根因不是 z-index 本身，而是 contextual banner 与聊天 work surface 同时占用固定底部区域，却没有共享 composer 高度这一布局真相源。用一个猜测高度继续上移会把耦合从遮挡变成易漂移常量。 |
| **4. 诊断策略** | 把聊天 route 已有的 `hasMobileNav` 信号作为 surface 边界：聊天页不渲染一次性 contextual banner；持久安装入口仍保留在全局导航抽屉，并可打开同一安装说明。非聊天移动页面继续显示 banner。 |
| **5. 超时策略** | 若最小契约测试无法稳定区分聊天与非聊天 surface，回查 AppShell 的 route ownership，不新增 composer 高度测量、ResizeObserver 或第二套 route 判断。 |
| **6. 预警策略** | 若修复需要新增布局常量、运行时高度测量或第三层 z-index/fallback，停止补丁并回到 AppShell surface ownership 重新建模。 |
| **7. 用户可见交互修正** | 聊天页不再浮出可能遮住输入区的安装 banner；用户仍可从移动全局导航的持久“安装到手机”入口查看说明或触发安装。其他合适的移动页面仍能展示 contextual banner。 |
| **8. 验收** | RED：原实现下新增回归用例失败，收到 banner DOM；GREEN：`hasMobileNav=true` 时 banner 不渲染，但持久入口仍可打开安装说明；抽屉→安装说明→关闭的真实组件集成测试继续证明焦点回到持久菜单触发器。 |

## Failure-mode audit

不变量：contextual banner 只能出现在不会遮挡主任务控件的 surface；安装能力不得因隐藏 banner 而消失。

- 聊天 surface：隐藏 contextual banner，保留导航抽屉内的持久安装入口。
- 非聊天移动 surface：仍按 installability 与 dismissal 状态展示 banner。
- 安装说明：两个入口共用同一个 provider/dialog，不复制状态或诊断逻辑。
- 无持久存储：dismissal 只能保证当前 document session；不引入 cookie 或另一套持久化 fallback。
