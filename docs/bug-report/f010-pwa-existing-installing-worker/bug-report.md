# F010 existing installing worker update visibility

### Bug 诊断胶囊：挂载前已存在的 installing worker 不会进入 update-ready

| 栏位 | 内容 |
|------|------|
| **1. 现象** | 期望：controller 挂载时若 registration 已有 installing worker，该 worker 进入 waiting 后显示“新版本已就绪”。实际：只监听未来的 `updatefound`，因此这次状态转换可能无人观察。 |
| **2. 证据** | Terra 对 `461c5e3..c882900` 的复审指出 `PwaUpdateController.tsx` 的 `watchRegistration()` 首次注册仅调用 `surfaceWaitingWorker()`；现有测试只覆盖挂载后的 `updatefound`。 |
| **3. 问题假设或根因** | 根因是 installing worker 的观察器只在 `onUpdateFound` 内创建，registration 首次取得和同一 registration 重查都没有建立观察器。 |
| **4. 诊断策略** | 在测试 harness 中于 render 前设置 `registration.installing`，让它随后转为 `installed` 并设置 `registration.waiting`；审计 registration 的首次取得、同一对象重查和未来 `updatefound` 三个入口。 |
| **5. 超时策略** | 15 分钟内若最小复现不红，改用真实 Chromium Service Worker 生命周期日志核对事件顺序，不继续猜测 mock。 |
| **6. 预警策略** | 若共享 helper 仍需三个以上 fallback，或同一状态对象连续第三轮出现漏边，则停止补丁，回到状态转移表补协议。 |
| **7. 用户可见交互修正** | 页面在加载期间已经开始安装的新版本，完成后也会立即展示更新提示，无需等下一次前台恢复或联网事件。 |
| **8. 验收** | 新增“mount 前已有 installing worker，随后进入 waiting”回归测试，先在原实现失败；修复后运行 controller 套件、F010 受影响套件、类型检查、lint 与生产构建。 |

## Failure-mode audit

不变量：只要当前 registration 的 worker 可能从 installing 转为 waiting，controller 就必须观察该转换，且同一 worker 最多注册一个监听器。

- 首次取得 registration：必须同时检查 waiting 与现有 installing。
- 同一 registration 的 foreground/online 重查：必须补齐尚未观察的 installing，但不得重复监听。
- 未来 `updatefound`：复用同一 helper 观察新的 installing worker。
