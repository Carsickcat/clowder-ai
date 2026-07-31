# NOVA Ops V4｜Quality Gate（丢丢 / Sonnet）

检查范围：`designs/nova-ops-observability-platform-v3`

原始反馈：烁烁的“设计风格与历年一致性”评审，以及 co-creator 对真实运维交互旅程的要求。

## 愿景覆盖

| 要求 | 实现证据 | 结论 |
| --- | --- | --- |
| 首页以角色与场景进入 | `JourneyHome.js`：发布负责人、值班 SRE、服务 Owner；四个场景入口 | 通过 |
| 恢复左—中—右三栏旅程 | `JourneyWorkspace.js`：任务/步骤、专业工作面、AI/人工决策 | 通过 |
| 场景 accent 区分 | 发布蓝、值班/保障琥珀、服务治理薄荷；状态语义色共享 | 通过 |
| 专业面不再降级为全局抽屉 | 监控、告警、日志、Trace、拨测、巡检成为中栏标签 | 通过 |
| 接入 Cat Café token 命名 | `globals.css` 使用 base → semantic → persona 三层 token | 通过 |
| 故障诊断成为独立值班旅程 | 告警/人工建案 → 影响 → Observation → Hypothesis → ActionProposal → 回写复验 | 通过 |

## Failure-mode audit

本轮五项意见属于同一 failure mode：以功能模块坐标组织平台，而非以用户决策旅程组织平台。

处理方式不是增加更多模块入口，而是统一改为角色/场景入口，并让七个工作面下沉为旅程步骤与产物。全局 Evidence Lens 导航已移除；Scope 来源、专业标签和人工 verdict 在每条旅程使用同一骨架。

## 设计与视觉证据

未发现与 NOVA Ops / AIOps 匹配的 `.pen` 文件；设计对照依据为 `designs/aiops-unified-workbench/final-design.md` 与烁烁评审笔记。

| 需求 | 证据 |
| --- | --- |
| 三个角色入口与场景 accent | `evidence/01-live-ops-desktop.png` |
| 发布旅程三栏与蓝色 accent | `evidence/02-change-verification-passed.png` |
| 服务治理三栏与薄荷 accent | `evidence/03-nl2-inspection-studio.png` |
| 跨场景动态旅程 | `evidence/nova-ops-v3-golden-path-15s.webm` |

手机端另以 390×844 真实浏览器检查角色入口与变更旅程：步骤转为横向进度，中栏保持专业标签，AI/人工决策移到正文终段；未发现横向页面溢出或不可读遮挡。

## Dogfood-Your-Slice

Scope verdict：必做（用户可见信息架构重构）。

端到端路径：

1. 角色入口 → 大促保障 → 调整高频巡检；
2. 返回角色入口 → 变更验证 → 回滚 → unknown 阻断 → Evidence 恢复 → Verification passed；
3. 返回角色入口 → NL2 巡检 → 修复 Gate → Replay → 审批 → Published Plan；
4. 返回角色入口 → 故障诊断 → 专业日志面 → Observation → Hypothesis test → ActionProposal。

实际命令：

```text
BASE_URL=http://127.0.0.1:5291/ npm run test:browser
Browser golden paths passed: desktop 3 journeys + mobile guide/studio, console 0.
```

## 验证

```text
npm run check
  Prettier: all matched files use Prettier code style
  Node tests: 19 passed, 0 failed
  Vite/Sites build: exit 0

npm audit --audit-level=high
  found 0 vulnerabilities

git diff --check
  pass

Artifact hygiene
  worktree root media: clean
  committed root media: clean
```

Fallback/hotfix scanner 在该 worktree 中未提供；人工 diff sweep 未发现新增多层 fallback。新增前端组件均低于 350 行：`AppShell` 99 行、`JourneyWorkspace` 193 行、`journeyModel` 239 行。

Architecture ownership：独立设计原型，不改变 Cat Café runtime ownership map。Capability tips：独立规划原型，不注册 Cat Café 用户能力，豁免。
