# NOVA 变更巡检最小验收包

这是 NOVA Connected Inspection MVP 的离线验收材料。它不会连接生产数据，也不会触发发布、放量、回滚或任何生产写操作。

## 一条命令启动

在仓库根目录执行：

```bash
pnpm demo:nova
```

默认地址：`http://127.0.0.1:5272`

- `/product`：完整 Mock 产品视图，可切换三阶段、展开证据摘要并导出内嵌数据。
- `/deck`：8 页中文产品介绍，支持左右方向键、PageUp/PageDown、空格翻页，可直接打印为 PDF。
- `/mock-data`：结构化 Mock JSON。

如 5272 被占用：

```bash
node scripts/serve-nova-deliverables.mjs --port 5273
```

两个 HTML 文件均为自包含文件，也可以脱离服务直接双击打开：

- `nova-inspection-mock.html`
- `nova-product-introduction.html`

## 验收顺序

1. 打开 `/product`，点击“变更前准入 / 灰度持续验证 / 变更后验收”，确认结论、指标与说明会同步切换。
2. 展开“查看证据摘要”，确认 source snapshot、observedAt、query digest 与人工决策都可追溯。
3. 检查覆盖缺口没有被绿色结论掩盖；Mock 页明确标注“仅用于演示”。
4. 打开 `/deck`，阅读产品定义、单屏布局、端到端旅程、可信边界和验收结果。
5. 打开 `/mock-data`，确认 change、topology、job、case、runs、assessment、decision、report 均有结构化数据。

## Mock 数据说明

字段结构来自隔离 acceptance SQLite 中实际跑通的完整链路；服务名、指标、阈值和报告内容是合成验收样例，不代表生产环境。Mock 数据有显式 `mockOnly: true`，避免与真实运行证据混淆。

真实 Connected 产品仍位于 `/observability/inspections`，由服务端拥有 Run、Assessment、A/B 和报告事实；本目录的静态 HTML 是可携带的验收与讲解材料，不替代真实产品。
