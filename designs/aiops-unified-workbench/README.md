# NOVA Ops · 场景驱动 AI 运维工作台 V2

这是一个无后端、无真实生产数据的高保真交互原型，用来验证三件事：

1. AI 运维的原子能力能否被用户看懂；
2. 发布负责人、值班 SRE、服务 Owner 能否分别完成一条有结果的用户旅程；
3. 监控、告警、日志、巡检、拨测能否共享上下文，同时保留各自不可替代的专业工作面。

## 运行

```powershell
$env:AIOPS_PORT='5278'
node designs\aiops-unified-workbench\serve.mjs
```

打开 `http://127.0.0.1:5278/`。

## 三条可点击旅程

- 发布后健康验证：验证计划 → 监控影响 → 用户拨测 → 日志差异 → 放行决策。
- 告警风暴处置：告警归并 → 影响定界 → 根因验证 → 恢复拨测 → 受控 Runbook/交接。
- 关键服务日巡：覆盖审计 → 候选检查 → 证据链断点 → Finding/整改 → 带 unknown 的诚实报告。

专业模块导航可在任何旅程中深链打开，并继承当前 `service / env / time / change / scenario`。

## 验证

```powershell
node --test designs\aiops-unified-workbench\tests\domain.test.mjs
node --test designs\aiops-unified-workbench\tests\server.test.mjs
node --test designs\aiops-unified-workbench\tests\standalone.test.mjs
$env:AIOPS_PROTOTYPE_URL='http://127.0.0.1:5278/'
node designs\aiops-unified-workbench\tests\browser-smoke.mjs
```

浏览器证据默认写入系统临时目录：`cat-cafe-evidence/aiops-unified-workbench-v2/`。

## 离线单文件

```powershell
node designs\aiops-unified-workbench\scripts\build-standalone.mjs
```

输出：`NOVA-Ops-AI-Workbench-Standalone.html`。它不依赖 localhost、模块 import、外部样式或网络请求，可直接用 `file://` 打开。

## 远端对话内交付

不要把 `E:\...` 仓库路径当作远端下载链接。需要在 Cat Café 对话内交付时，生成沙箱化 `html_widget` payload：

```powershell
node designs\aiops-unified-workbench\scripts\build-rich-widget.mjs
```

该 payload 内嵌同一份 standalone，并拒绝本地路径、localhost 和外部脚本/样式依赖。验证命令：

```powershell
node --test designs\aiops-unified-workbench\tests\delivery.test.mjs
node designs\aiops-unified-workbench\tests\widget-smoke.mjs
```

## 产品边界

- AI 只做跨源归并、解释、候选、缺口识别和报告草稿。
- 规则/遥测提供事实，人负责最终判断、权限和生产动作。
- `unknown`、证据过期、覆盖不足、基线漂移不得折算为健康。
- 页面里的价值数字是本次 mock 旅程的操作计数，不是行业 ROI 承诺。
