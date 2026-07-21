# 统一 AI 运维平台最终设计方案

## 核心判断

统一运维平台不应把监控、告警、日志、巡检、拨测做成五张彼此相邻但仍然割裂的页面。正确坐标系是：

- 五个专业模块继续保留各自入口、查询能力和深链。
- 它们之上增加一个以 `HealthEvent / Investigation` 为核心的调查层。
- 用户从任意模块发现问题后，进入同一个事件工作区。
- 调查过程中持续继承 service / env / time / change / HealthEvent。
- 证据最终收敛为可分派、可整改、可复验的 `Finding`。

健康分只能用于队列排序和快速导航，不能成为视觉中心，也不能掩盖 blocker、unknown 或证据缺口。

## 参考的一手产品范式

| 产品 | 保留的产品范式 | 不照搬的部分 |
|---|---|---|
| [Datadog Bits AI SRE](https://docs.datadoghq.com/bits_ai/bits_ai_sre/investigate_issues/) | 从告警、APM、拨测或通用请求进入同一调查；观察—假设—验证；数据不足时输出 inconclusive；完成后提供结构化调查树 | 不展示完整 Agent Trace 或隐式推理，只展示查询、证据、结论修订和人工确认 |
| [Dynatrace Problems](https://docs.dynatrace.com/docs/dynatrace-intelligence/problems-app) | Problem record 持久承载影响、根因、相关事件、部署关系与自动化；跨应用钻取保持同一问题上下文 | 不把“AI 根因”当唯一结论，保留反证与 unknown |
| [Elastic Observability AI](https://www.elastic.co/docs/solutions/observability/ai/observability-ai-assistant) | 页面数据自动进入调查上下文；函数调用和返回可检查；会话可共享/导出；查询继承用户权限 | 不以通用聊天框作为产品主入口 |
| [AWS CloudWatch Investigations](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Investigations.html) | Observation、Hypothesis、accept/discard、时间线与报告形成可审计调查记录 | 不让 AI 直接跨越既有 runbook 与生产权限边界 |
| [Google Cloud Assist Investigations](https://docs.cloud.google.com/cloud-assist/investigations?hl=en) | 多假设、来源链接和 revision，使结论可以被复查和重跑 | 不用单次摘要替代调查对象 |
| [Azure Observability Agent](https://learn.microsoft.com/en-us/azure/azure-monitor/aiops/observability-agent-overview) | Issue 持久保存调查上下文；自动化受权限和人工决策约束 | 不开放自由文本直接执行生产变更 |

## 产品对象

```text
HealthUnit
  └─ HealthEvent / Investigation
       ├─ Context: service / env / time / change
       ├─ Evidence: metric / alert / log / check / synthetic
       ├─ Hypothesis: supported / contradicted / inconclusive
       ├─ Finding: candidate / confirmed
       ├─ Action: owner / status / permission boundary
       └─ Verification: running / passed / blocked / failed
```

- `HealthUnit`：需要被长期治理的业务、服务或关键用户旅程。
- `HealthEvent`：一次具体调查的容器，承载统一上下文和时间线。
- `Evidence`：来自五个专业模块的可回溯事实。
- `Finding`：可被人工确认、分派、整改和复验的结论对象。
- `Action`：受权限控制的整改任务，不等于 AI 建议。
- `Verification`：使用相同检查与拨测验证整改结果。

## 信息架构

### L1：专业模块入口

监控、告警、日志、巡检、拨测继续存在。用户可以从专业模块进入原始数据和高级查询；当用户点击“调查”或从问题进入时，系统创建或关联一个 `HealthEvent`。

### L2：HealthEvent 工作队列

首页是需要处理的事件队列，不是总健康分：

1. blocker 优先；
2. unknown 与 blocker 同级可见；
3. 业务影响、覆盖率和数据新鲜度共同参与排序；
4. 服务健康地图只用于筛选和定位，不替代工作队列。

### L3：统一调查工作区

- 左：HealthEvent 队列。
- 中上：锁定的全局上下文、业务影响、覆盖率、新鲜度和流程阶段。
- 中部：以时间线为骨架，假设树在节点上局部展开。
- 中下：监控、告警、日志、巡检、拨测五个 Evidence Lens。
- 右：AI 调查员窄栏，移动端改为抽屉。

## AI 输出契约

AI 的每次输出必须落入四个明确区域：

1. **事实**：带来源，可回到原始查询或数据。
2. **推断**：明确标为待确认，可被支持或反驳。
3. **证据缺口**：覆盖率、新鲜度、权限、基线或拓扑断点。
4. **建议动作**：必须经过 Owner、权限与人工确认。

不展示模型完整思维过程；用户需要的是可复核证据和结论修订记录，而不是看似详细但无法验证的 Agent Trace。

## 主用户旅程

### 旅程 A：发布后健康验证

```text
发布完成
  → 自动创建 HealthEvent
  → 关联告警与用户影响
  → 进入统一调查上下文
  → 切换五种 Evidence Lens
  → 钉入支持/反证
  → 人工确认 Finding
  → 分派整改并执行受控动作
  → 重跑检查与拨测
  → 进入恢复观察
```

### 旅程 B：关键服务日巡

```text
定时触发检查
  → 正常结果归档
  → unhealthy / unknown 进入队列
  → 定位检查失败或证据链断点
  → Finding + Owner
  → 整改
  → 使用同一检查定义复验
  → 报告与分享
```

日巡与发布验证不是两套产品，只是同一治理闭环的不同触发器。

## 硬门禁

- `unknown` 不得折算为 healthy，也不得默认过滤。
- 覆盖率、新鲜度或基线可比性未恢复时，Verification 必须进入 `blocked`，不能写入“检查通过”或恢复结论。
- 数据过期、缺失、未覆盖必须显示新鲜度和断点位置。
- 检查定义、基线、拓扑或模型版本变化时，趋势标记为不可比。
- Lens 切换不得重置 service / env / time / change / HealthEvent。
- AI 不能直接执行生产变更或替代最终判定。
- 证据必须可追溯到原始数据、查询和时间窗。
- Finding 没有 Owner、整改或复验时，不能被视为闭环完成。

## 原型覆盖

当前原型提供三个 mock 事件：

- `HE-1042`：发布后错误率升高，覆盖完整 Golden Path。
- `HE-1045`：检查定义与拓扑变化导致基线不可比。
- `HE-1047`：数据采集器中断，展示静默绿色失败模式。

可点击行为包括模块深链、事件筛选、业务健康地图、上下文时间窗调整、假设树、五种 Lens、证据钉入、AI 推荐证据、Finding 确认、Owner 分派、整改、复验门禁、AI 抽屉和移动端布局。

## 一期边界

一期只打穿“关键服务日巡 + 发布后健康验证”。不重建现有监控平台、不做全公司万能大屏、不允许自由 Prompt 执行生产动作，也不使用厂商式泛化 ROI 作为价值证明。

一期验证指标应围绕可观测产品行为：

- 从事件进入到第一条可核验证据的时间；
- unknown 被发现并分派的比例；
- Finding 具备 Owner 和复验记录的比例；
- 发布后验证完成率；
- 同类事件中调查证据和结论被复用的比例。
