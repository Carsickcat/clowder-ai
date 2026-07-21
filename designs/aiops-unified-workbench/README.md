# NOVA Ops — AI 调查工作台原型

这是统一运维平台的可点击设计原型。它使用本地 mock 数据，不连接任何 API、Redis 或生产系统。

## 用户旅程

1. 从左侧 `HealthEvent` 工作队列选择 `HE-1042`。
2. 点击左侧“日志”模块，或在 Evidence Lenses 中切换到“日志模式”。
3. 钉入 `PaymentClient timeout` 与 `pool.maxConnections changed` 两条证据。
4. 点击“人工确认 Finding”。
5. 分派给陈曦，开始受控整改。
6. 发起复验并完成复验。
7. 选择 `HE-1047`，检查 unknown、数据新鲜度与证据缺口门禁。

## 本地运行

```powershell
python -m http.server 5278 --directory designs/aiops-unified-workbench
```

然后访问 `http://127.0.0.1:5278/`。

## 验证

```powershell
node --test designs/aiops-unified-workbench/tests/domain.test.mjs
node --check designs/aiops-unified-workbench/domain.mjs
node --check designs/aiops-unified-workbench/mock-data.mjs
node --check designs/aiops-unified-workbench/views.mjs
node --check designs/aiops-unified-workbench/app.mjs
```

## 边界

- AI 只组织事实、推断、证据缺口与建议动作。
- 最终结论、Owner、生产处置与复验均需要显式人工动作。
- 原型状态不持久化，刷新后会回到初始 mock 数据。
