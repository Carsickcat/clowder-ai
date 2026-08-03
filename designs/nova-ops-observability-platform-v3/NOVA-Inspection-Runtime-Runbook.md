# NOVA 巡检真机版：运行手册

这是一版真实 connected runtime，不是单文件 Mock。页面通过 API 生成方案、创建 Case、采集本地只读 replay 证据、保存运行与决策，并从独立 SQLite 恢复不可变报告。

## Windows 一键启动

在仓库根目录打开 PowerShell：

```powershell
$env:API_SERVER_PORT = '3004'
$env:FRONTEND_PORT = '3003'
$env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:3004'
$env:CAT_CAFE_DATA_DIR = (Join-Path $PWD 'data\nova-local')
pnpm install --frozen-lockfile
pnpm start:direct --memory
```

看到 `Cat Cafe started!` 后打开：

`http://127.0.0.1:3003/observability/inspections`

`--memory` 只让与本次演示无关的 Cat Café 状态使用临时内存；NOVA 巡检本身仍持久化在：

`data/nova-local/nova-inspection/inspection.sqlite`

停止服务：在启动窗口按 `Ctrl+C`。

## 一条完整用户旅程

1. 页面显示 `DEV LOCAL · fixture-backed sources`，确认当前不是生产环境。
2. 在右侧 CLAW 输入服务、变更号和版本，点击“生成巡检方案”。
3. 查看三项检查、拓扑来源和未覆盖依赖；点击“确认方案并创建巡检”。
4. 依次采集变更前准入、灰度持续验证、变更后验收的本地只读证据。
5. A/B 可比且最新运行通过后，点击“人工接受并固化报告”。
6. 查看覆盖、证据可信度、可比性、新鲜度、风险闭环五维评分及每一项加权扣分。
7. 刷新页面或重启进程，历史 Case、来源快照和报告仍会恢复。

## 诚实边界

- 当前 replay 的指标值是固定开发 fixture；页面会同时显示 fixture 固化时间与本次本地回放时间。快照摘要由服务端重新生成，评分会对 fixture 新鲜度封顶折减，不把固定值伪装成实时遥测。
- production topology、真实 LLM、enterprise knowledge graph、生产 Prometheus 凭据均未接入；应用启动只注册本地 replay source，不读取可配置 Prometheus URL、scope 或 authorization。
- 服务端持久层强制 `admission → canary → post_change`；风险态才能进入 verification，且只有最新、通过、可比的 post-change 证据可以固化报告。
- 页面没有发布、放量、回滚或生产 remediation 路由；浏览器也不能填写证据、判定、时间戳或评分。
- `payments-router` 的连接池依赖没有批准的只读信号，因此报告会保留覆盖扣分；不会用高分掩盖未覆盖风险。
- connected API 断开时所有写动作禁用，页面不会回退到演示成功态。

## 已验证

- connected Chrome：空态、来源缺口、完成报告、断线态。
- 1440 / 720 / 390：无横向溢出；390 顺序为任务 → 详情 → CLAW → 执行计划。
- 浏览器刷新与 API 进程重启：同一报告可恢复。
- connected 旅程：console error `0`，unexpected network failure `0`。
- 服务端 observability：75/75；connected 页面合同：18/18；standalone：61/61。
