# NOVA Ops — AI 调查工作台原型

这是统一运维平台的可点击设计原型。它使用本地 mock 数据，不连接任何 API、Redis 或生产系统。

## 用户旅程

1. 从左侧 `HealthEvent` 工作队列选择 `HE-1042`。
2. 点击左侧“日志”模块，或在 Evidence Lenses 中切换到“日志模式”。
3. 钉入 `PaymentClient timeout` 与 `pool.maxConnections changed` 两条证据。
4. 点击“人工确认 Finding”。
5. 分派给陈曦，开始受控整改。
6. 发起复验并完成复验。
7. 展开假设树，验证证据、假设与验证条件的对应关系。
8. 解锁上下文，将时间窗改为“最近 2 小时”，再次切换 Lens，确认时间窗继续继承。
9. 从“业务健康地图”进入 `HE-1047`，执行一次复验，确认系统显式显示 `blocked`，不产生恢复结论。

## 本地运行

```powershell
node designs/aiops-unified-workbench/serve.mjs
```

然后访问 `http://127.0.0.1:5278/`。

## 离线单文件交付

```powershell
node designs/aiops-unified-workbench/scripts/build-standalone.mjs
```

产物为 `NOVA-Ops-AI-Workbench-Standalone.html`。CSS、JavaScript、mock 数据全部内嵌，可直接复制到手机并离线打开。

## 验证

```powershell
node --test designs/aiops-unified-workbench/tests/domain.test.mjs
node --test designs/aiops-unified-workbench/tests/server.test.mjs
node --test designs/aiops-unified-workbench/tests/standalone.test.mjs
node --check designs/aiops-unified-workbench/domain.mjs
node --check designs/aiops-unified-workbench/mock-data.mjs
node --check designs/aiops-unified-workbench/views.mjs
node --check designs/aiops-unified-workbench/app.mjs
```

## 边界

- AI 只组织事实、推断、证据缺口与建议动作。
- 最终结论、Owner、生产处置与复验均需要显式人工动作。
- 覆盖率、新鲜度或基线门禁未恢复时，复验只能进入 `blocked`，不得写入“通过”。
- `serve.mjs` 不向宿主 stdout/stderr 写访问日志，避免预览会话与进程管道解耦后出现空响应。
- 原型状态不持久化，刷新后会回到初始 mock 数据。
