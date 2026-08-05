---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [aiops, inspection, offline-demo, acceptance]
doc_kind: guide
created: 2026-08-06
---

# AI 巡检 Copilot 离线验收 Demo

这是一个无需安装、无需启动服务、无需占用端口的单文件验收 Demo。所有指标、Trace、电子流、证据和 RC 诊断结果均为 mock，不会连接或修改任何生产系统。

## 直接验收

双击打开 `AI-Inspection-Copilot-Offline-Demo.html`，或把该文件发送到另一台电脑后用现代浏览器打开。

### 旅程一：自然语言巡检 → Scoped Proceed

1. 保持顶部“自然语言巡检”场景。
2. 点击“确认理解结果”。
3. 检查声明变更与运行时事实为 `Exact`，点击“接受范围并生成任务”。
4. 查看四个正式 Check 的目的、实体、指标、规则、基线、失败动作、来源与理由。
5. 点击“确认任务并开始执行”，连续运行四步 mock 检查。
6. 验收报告应显示：证据 `Verified`，行动 `Proceed`，并明确结论边界和残余风险。

### 旅程二：电子流巡检 → Pause + RC Agent

1. 切换到“电子流巡检”。
2. 完成输入确认和范围对账。
3. 验证系统识别出 `Observed-Superset`，将 `invoice-worker` 与 `settlement-db` 加入声明外影响面。
4. 未处置高关键度 AI 候选时，“确认任务”按钮必须禁用。
5. 点击候选项“纳入计划”，确认它成为正式 Check 后再开始执行。
6. 连续运行四步 mock 检查；报告应显示：证据 `Violated`，行动 `Pause`。
7. 点击“启动 RC Agent”，查看共享配置包导致数据库连接池退化的诊断链。

## 本地可重复验证

要求：Node.js 24+、本机 Chrome。没有第三方 npm 依赖。

```powershell
pnpm build
pnpm test
pnpm test:browser
```

浏览器验收会从 `file://` 打开产物，自动走完两条旅程，并校验：0 个 HTTP(S) 网络请求、0 个浏览器错误、手机视口无横向溢出。

需要重录验收截图时运行：

```powershell
node tests/offline.browser.mjs --evidence
```

## 文件说明

- `AI-Inspection-Copilot-Offline-Demo.html`：唯一交付文件。
- `ARCHITECTURE.md`：架构边界、核心契约和演进映射。
- `lib/`：不可变 mock 场景、领域契约、状态机与派生选择器。
- `src/`：纯渲染、高保真样式与浏览器事件适配。
- `scripts/build.mjs`：无依赖确定性单文件构建器。
- `tests/`：领域、旅程、UI、构建和浏览器验收。
- `evidence/`：桌面与手机验收截图。
