# NOVA Ops AI Observability Platform V5

面向 2026 智能运维规划的可点击高保真原型。产品坐标是 SRE 运行控制面，不是能力介绍门户或角色选择页：

- 智能巡检 Agent：Mission、Plan、Run、Assessment、Finding、Verification、Report
- 故障诊断 Agent：Investigation、Observation、Hypothesis、Revision、ActionProposal
- 首页以待处置对象队列为中心：Incident、Change、Mission、Inspection
- 对象工作台采用左对象流程、中专业证据、右 AI / 人工决策三栏
- 跨对象链路：源对象 → Incident → ActionProposal → 源 Finding → 源对象 Verification
- Reports 与 Governance 是版本化投影/治理视图，不是健康真相源
- 对象 accent 只表达对象类型，状态仍由 passed/warning/failed/unknown 表达

## 本地运行

```bash
npm install
npm run dev
```

访问 `http://localhost:5290/`。

## 验证

```bash
npm test
npm run test:browser
npm run build
```

完整操作说明见 [USER-GUIDE.md](./USER-GUIDE.md)。

## 数据边界

这是固定 Mock 数据的产品原型，不连接生产系统，不执行生产变更。
