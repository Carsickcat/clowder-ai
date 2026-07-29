# NOVA Ops AI Observability Platform V6

面向 2026 智能运维规划的可点击高保真原型。产品坐标是 SRE 运行控制面，不是能力介绍门户或角色选择页：

- 智能巡检 Agent：Mission、Plan、Run、Assessment、Finding、Verification、Report
- 故障诊断 Agent：Investigation、Observation、Hypothesis、Revision、ActionProposal
- 打开即进入值班现场：当前决策、现场脉冲和 Agent Run，不再显示欢迎页、统计卡或第二套对象入口
- Incident / Change / Mission / Inspection 分别采用调查、验证、阶段指挥、计划编译四种构图
- 四种构图共享 Scope、专业证据、人工 verdict 与跨对象回写合同，不共享同一页面模板
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
