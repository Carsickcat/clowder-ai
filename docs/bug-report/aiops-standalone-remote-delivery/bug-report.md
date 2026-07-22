# NOVA Ops standalone 远端交付故障

## Bug 诊断胶囊

| 栏位 | 内容 |
|---|---|
| **1. 现象** | co-creator 在远端手机点击对话中的 `NOVA-Ops-AI-Workbench-Standalone.html` 后看到 `Application error: a client-side exception has occurred`；期望直接打开可交互原型。 |
| **2. 证据** | 原消息使用 `E:\ClowderAI\...\NOVA-Ops-AI-Workbench-Standalone.html` 作为链接目标；远端设备没有该磁盘。错误文案不在 standalone 中。artifact 仅含内联脚本和 data favicon；HTTP 与 `file://` Chrome smoke 均通过。 |
| **3. 根因** | 交付媒介错误：把本机 Windows 文件路径包装成聊天链接。远端点击后由 Cat Café 前端接管不可解析/不可访问的目标并显示自身异常页；不是原型 JavaScript 抛错。 |
| **4. 诊断策略** | 分别验证 artifact、localhost preview、无同源权限的 `html_widget` 沙箱三段；搜索错误文案与外部依赖；对照富消息的 HTML widget 合约。 |
| **5. 超时策略** | 15 分钟内沙箱仍不能运行则停止修改原型，改查富消息 payload 大小与客户端日志，不叠加 CSS/状态机修复。 |
| **6. 预警策略** | 若 HTTP/file/widget 三种环境任一出现相同脚本异常，推翻“仅交付媒介”结论并回到 artifact stack trace。 |
| **7. 用户可见修正** | 不再发送 `E:\` 路径；直接在对话内发送沙箱化、可点击的 HTML widget，手机无需访问本机或 localhost。 |
| **8. 验收** | `delivery.test.mjs` 禁止本地路径/localhost/外部依赖；`widget-smoke.mjs` 在 `sandbox="allow-scripts"`、390px 宽度完成场景进入、上下文继承与 AI 抽屉交互。 |

## 报告人

co-creator，2026-07-22，通过远端手机实际交付路径发现。

## 运行时预检

```text
PORT=5278
PID=45152
START_TIME=2026-07-22T02:38:33.0476299+08:00
HEAD=559661b59f4d1da1a6de5435eea0819ffe5f1e49
TARGET_COMMIT=559661b
PROCESS_AFTER_TARGET=false
LOG_EVIDENCE=serve.mjs intentionally logless; HTTP and Chrome probes used
```

进程早于目标提交，但静态服务器实时读取 worktree 文件；因此该字段不能用于推导“运行时未更新”。当前 HEAD 的 HTTP 浏览器验收仍通过。

## 修复

- 新增 `scripts/build-rich-widget.mjs`，从最终 standalone 生成 `html_widget` payload。
- 构建器拒绝本地磁盘、`file://`、localhost 与外部脚本/样式依赖。
- 新增 unit regression 与无同源权限的手机沙箱 smoke。
- 交付规范明确：远端聊天不得使用仓库路径作为附件链接。

## 验证

```text
delivery.test.mjs: PASS
widget-smoke.mjs: WIDGET_SMOKE_OK sandbox=allow-scripts
standalone file:// browser smoke: PASS
HTTP browser smoke: PASS
```
