# Review Request: Nova Ops V6 代码与边界复审

- Review-Target-ID: `feat-aiops-observability-platform-hifi-v3`
- Branch: `feat/aiops-observability-platform-hifi-v3`

## What

- 用新的 SRE cockpit 替换 V5 欢迎/角色/对象入口首页。
- 为四类 operational object 增加明确 layout metadata，并在一个
  `ObjectWorkspace` 中投影四种任务特异组合。
- 增加体验合同，禁止旧入口 shell 回归并强制四对象声明不同 composition。
- 更新 Playwright golden path、录屏脚本、用户指南和产品方案。

## Why

旧合同只证明了状态机、可点击性和对象边界，没有证明第一屏已是 SRE 现场，
也没有防止四个对象重新坍缩成同一个模板。真实体验因此连续两轮偏离 operator
要求。

## Original Requirements

> 当前页面优化和体验打磨；框架还没做完，内容高度重复。
> 不应再有“进入页”，也不需要选择角色，产品聚焦 SRE 使用。
> 不急着做公网地址。

- 来源：Cat Café thread `thread_mrrzdymcf3z6bx77`, message
  `0001785334354071-000213-4acfe9d1`
- **请对照上面的摘录判断交付物是否解决了 operator 的问题。**

## Tradeoff

- 没有分叉四套 React 状态树；layout 只是一层展示元数据，领域 reducer 和
  对象边界保持单一真相源。
- CSS 使用四个明确 composition，而不是在组件里加入大量响应式条件分支。
- 保留 V5 的领域链与报告投影，避免以视觉重做为由削弱已验证的状态约束。

## Architecture Ownership

- Architecture cell: prototype-local SRE UI projection
- Map delta: none
- Why: diff 不改变生产 owner、boundary、extension point 或 canonical anchor，
  也不新增 Store、Queue、Router、Adapter、Dispatcher 或 Binding。

请 reviewer 检查：

- diff 是否与 `Map delta: none` 一致
- `object.layout` 是否保持纯展示职责
- CSS composition 是否会在中间断点产生重叠/不可达交互

## Open Questions

### 技术 OQ

1. layout metadata → wrapper class → CSS grid 的链路是否足够稳健且无第二状态源？
2. 体验合同是否能阻止欢迎页、角色选择和同构模板回归，而不把文案细节锁死？
3. evidence recording 是否使用了稳定领域选择器并覆盖真实状态转移？

### 价值 OQ

无。产品形态由暹罗猫独立复审；本请求不要求代替 operator 决定发布。

## Next Action

请独立复跑测试并给明确 `APPROVE` / `REQUEST CHANGES`。每项 finding 标注
P1/P2/P3，重点审查 React 边界、状态机不变量、响应式 CSS、浏览器合同和测试
遗漏。

## Review Sandbox

- Path:
  `E:\ClowderAI\review-sandboxes\feat-aiops-observability-platform-hifi-v3\terra`
- Start Command: 在
  `designs/nova-ops-observability-platform-v3` 下运行
  `npm ci && npx vinext dev -p 5292`
- Ports: `web=5292`, `api=N/A`
- 当前作者实测实例：`http://localhost:5290/`

## 自检证据

### Spec 合规

`review-notes/2026-07-29-nova-ops-v6-quality-gate-sol.md`：PASS。

### 测试结果

```text
npm run check        # Prettier pass; node:test 33/33; build pass
npm run test:browser # golden paths pass; console 0
npm run evidence:video # deterministic domain-action journey saved
npm audit --audit-level=high # 0 vulnerabilities
git diff --check     # pass
```

### 根目录工件闸门

工作树和提交差异均无根目录媒体/设计工件；所有 PNG/WebM 位于
`designs/nova-ops-observability-platform-v3/evidence/`。

### 相关文档

- Plan:
  `feature-specs/2026-07-29-nova-ops-v6-operational-cockpit.md`
- Quality gate:
  `review-notes/2026-07-29-nova-ops-v6-quality-gate-sol.md`

[丢丢/gpt-5.6-sol🐾]
