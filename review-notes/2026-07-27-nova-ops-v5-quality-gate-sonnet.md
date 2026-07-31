# NOVA Ops V5｜Quality Gate Report

**Author:** 丢丢 / Sonnet

**Spec:** `feature-specs/2026-07-27-nova-ops-v5-sre-object-workbench.md`

**Design contract:** `review-notes/2026-07-26-nova-ops-v5-high-fidelity-design-contract-siamese.md`

**Worktree:** `E:\ClowderAI\cat-cafe-aiops-hifi-v3`

**Runtime evidence:** `http://localhost:5290/`

## 愿景覆盖

| Operator 原始要求                | 实现                                                                  | 证据                               |
| -------------------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| 产品只面向 SRE，不再区分角色     | 首页直接进入对象队列，角色入口与旧 Journey 模型已删除                 | `SreHome.js`、experience contract  |
| 烁烁定义产品形态，Sol 编码       | 以 V5 Siamese design contract 为唯一页面合同                          | 本报告 Design contract             |
| 以可处置对象而非功能官网组织系统 | Incident / Change / Mission / Inspection 成为一级运行对象             | SRE 首页截图                       |
| 保留真实可观测工作面             | 对象内保留 Metrics / Alerts / Logs / Traces / Synthetics / Inspection | ObjectWorkspace + 浏览器旅程       |
| 双 Agent 不越权                  | Incident 只生成并回写 ActionProposal；源对象 Verification 才能恢复    | domain tests + Incident 浏览器旅程 |
| 提供使用说明                     | V5 说明书按四对象与跨对象链路重写                                     | `USER-GUIDE.md` + 站内说明抽屉     |

## 功能验收

| 要求                                | 状态 | 测试 / 证据                                                   |
| ----------------------------------- | ---- | ------------------------------------------------------------- |
| 首页不再出现角色选择                | ✅   | `entry point is an SRE object queue`                          |
| 四类对象可从队列与导航进入          | ✅   | object reducer test + desktop browser                         |
| 四类对象使用统一三栏骨架            | ✅   | experience contract + desktop/mobile render                   |
| 跨对象来源与回写可追溯              | ✅   | `Incident preserves source provenance...` + browser writeback |
| Incident 不能关闭源对象             | ✅   | reducer 反例断言                                              |
| unknown/stale 不漂绿                | ✅   | existing recovery gate test + Change browser path             |
| 对象 accent 与状态色隔离            | ✅   | CSS contract + visual inspection                              |
| Reports / Governance 不作为运行对象 | ✅   | `OBJECT_OPEN(report)` rejected                                |

## 设计稿对照

`rg --files designs | rg '\.pen$'`：无匹配。本轮设计真相源是烁烁的 Markdown 高保真合同，因此按合同逐项对照。

| 合同页面                    | 实现证据                                            |
| --------------------------- | --------------------------------------------------- |
| SRE 运行工作台              | `evidence/01-sre-object-queue-desktop.png`          |
| Change 对象工作台与复验终态 | `evidence/02-change-object-verification-passed.png` |
| Inspection 手机折叠形态     | `evidence/03-inspection-object-mobile.png`          |
| 对象升级 / Incident / 回写  | `evidence/nova-ops-v5-sre-object-path-15s.webm`     |

## Dogfood-Your-Slice

**Scope verdict:** ✅ 必做（用户可见 UI 重构）

端到端路径：

`SRE queue → Mission 调频 → Change rollback → unknown blocked → Verification passed → Inspection gates/replay/publish → Change 升级 Incident → H1 test/confirm → ActionProposal 回写 FND-8821`

实际命令：

```text
BASE_URL=http://localhost:5290/ npm run test:browser
Browser golden paths passed: SRE queue, Mission, Change verification,
Inspection, Incident writeback, and mobile, console 0.
```

Dogfood 发现并当轮修复：

- Change Verification 已 passed 时，左栏仍显示静态 blocked、右栏仍给回滚建议。
- 修复后对象状态与 Decision Inspector 均由领域状态派生；浏览器新增 passed 一致性断言。

## 验证命令

```text
npm run check
→ Prettier clean
→ Node tests 21/21 pass
→ Vite/Sites build exit 0

BASE_URL=http://localhost:5290/ npm run test:browser
→ desktop + mobile golden paths pass
→ console 0

npm audit --audit-level=high
→ 0 vulnerabilities

git diff --check
→ clean
```

## 其他门禁

- `.pen`：无匹配；Markdown 设计合同已对照。
- Fallback / hotfix 检查脚本：本独立原型 worktree 未提供；本次不是 hotfix，也未新增 fallback 层。
- Architecture cell：`AI Ops SRE object workspace`
- Map delta：角色 Journey 坐标删除，新增 SRE Object Workspace；未新增第二套 Agent 或 Verification owner。
- Artifact hygiene：仓库根目录无媒体；正式证据收敛为 3 张截图 + 1 段约 15 秒录屏。
- 旧 V3 截图与录屏已由 V5 证据替换；删除可通过 Git 历史恢复。

## Review Focus

1. `ObjectWorkspace` 是否守住四类对象边界。
2. `INCIDENT_ESCALATED → ACTION_PROPOSAL_WRITTEN_BACK` 是否可追溯且不越权。
3. Object accent 是否与 status semantics 隔离。
4. 旧 role/journey 坐标是否已从运行路径移除。
