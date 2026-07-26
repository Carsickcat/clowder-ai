# NOVA Ops AI Observability Platform V3

面向 2026 智能运维规划的可点击高保真原型。产品坐标不是能力介绍门户，而是生产运行工作台：

- 智能巡检 Agent：Mission、Plan、Run、Assessment、Finding、Verification、Report
- 故障诊断 Agent：Investigation、Observation、Hypothesis、Revision、ActionProposal
- 三个角色入口：发布负责人、值班 SRE、服务 Owner
- 四条可操作旅程：大促保障、变更诊断与复验、独立故障诊断、NL2 巡检
- 旅程内采用左任务进度、中专业工作面、右 AI / 人工决策三栏
- 七个异构工作面继续作为旅程步骤与产物，不再承担一级模块导航

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
