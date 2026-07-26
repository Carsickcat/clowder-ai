# NOVA Ops AI Observability Platform V3

面向 2026 智能运维规划的可点击高保真原型。产品坐标不是能力介绍门户，而是生产运行工作台：

- 智能巡检 Agent：Mission、Plan、Run、Assessment、Finding、Verification、Report
- 故障诊断 Agent：Investigation、Observation、Hypothesis、Revision、ActionProposal
- 三条可操作旅程：大促保障、变更诊断与复验、NL2 巡检
- 七个异构工作面：运行态势、保障任务、变更验证、巡检工程、故障调查、报告中心、治理审计

## 本地运行

```bash
npm install
npm run dev
```

访问 `http://127.0.0.1:5290/`。

## 验证

```bash
npm test
npm run build
```

完整操作说明见 [USER-GUIDE.md](./USER-GUIDE.md)。

## 数据边界

这是固定 Mock 数据的产品原型，不连接生产系统，不执行生产变更。
