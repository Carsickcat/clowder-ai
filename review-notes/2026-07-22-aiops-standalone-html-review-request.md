# Review Request: AI 运维原型离线单文件交付

Review-Target-ID: aiops-unified-workbench-prototype
Branch: feat/aiops-unified-workbench-prototype
HEAD: e27446f

## What

新增可重复构建的单文件打包器、离线依赖测试及 `NOVA-Ops-AI-Workbench-Standalone.html`。产物将六份 CSS、ES Module 状态机、视图和 mock 数据全部内嵌，可直接通过手机浏览器离线打开。

## Why

co-creator 当前从远端手机对话，无法访问 localhost、Hub Browser 或工作区路径；需要能从消息中下载的一份可交互 HTML 文件。

## Original Requirements

> “交付件能否给我一份可交互的 html 文件给我，我现在是远端手机跟你对话，交付件我访问不了”

- 来源：Cat Café thread `thread_mrrzdymcf3z6bx77`，消息 `0001784687807234-000057-1c847b54`
- **请判断附件是否真正不依赖 localhost/网络，并保留原型完整交互。**

## Tradeoff

- 提交生成后的 HTML 会增加约 84 KB 仓库体积，但保证最终交付物与构建器一起可追溯。
- 没有发布公网站点或改变访问权限；使用现有 `/uploads/` 文件附件链路交付。
- 保留未压缩脚本，方便审阅与调试；没有追求最小文件体积。

## Architecture Ownership

Architecture cell: prototype / product-design
Map delta: none
Why: 仅新增离线打包与交付工件，不改变生产 Store、Queue、Router、Adapter、Dispatcher 或 Binding。

## Open Questions

### 技术 OQ

1. 产物是否仍含外部 stylesheet、module import 或 localhost 依赖？
2. `file://` 直接打开时，Golden Path、unknown 门禁和移动抽屉是否保持可用？
3. 生成附件是否与当前源码一致，而不是手工维护的分叉副本？

### 价值 OQ

无。

## Next Action

请独立运行构建/测试，并用 Chrome 直接打开单文件，给出 `APPROVE` 或 `REQUEST-CHANGES`。

## Review Sandbox

- Source worktree: `E:\ClowderAI\cat-cafe-aiops-workbench`
- Reviewer sandbox: `/tmp/cat-cafe-review/aiops-unified-workbench-prototype/opus`
- Build: `node designs/aiops-unified-workbench/scripts/build-standalone.mjs`
- Open: `file:///E:/ClowderAI/cat-cafe-aiops-workbench/designs/aiops-unified-workbench/NOVA-Ops-AI-Workbench-Standalone.html`
- Ports: `web=none`, `api=none`

## 自检证据

```text
node --test domain.test.mjs server.test.mjs standalone.test.mjs
9 passed, 0 failed

AIOPS_PROTOTYPE_URL=file:///.../NOVA-Ops-AI-Workbench-Standalone.html
node tests/browser-smoke.mjs
BROWSER_SMOKE_OK; Golden Path + unknown blocked + mobile drawer; console 0

pnpm exec biome check scripts/build-standalone.mjs tests/standalone.test.mjs
exit 0

git diff --check
exit 0
```

离线测试明确断言：无 stylesheet link、无 `type="module"`、无相对 import；HTML 内含完整 CSS 与 bundled JavaScript。

## Artifact Delivery

- Repo artifact: `designs/aiops-unified-workbench/NOVA-Ops-AI-Workbench-Standalone.html`
- Message attachment: `/uploads/nova-ops-ai-workbench-standalone-8d400d3.html`
- Size: 86,245 bytes
- SHA-256: `94B04255449AEAAB5AA1FFB402924E1497052604D498B591F29BBADBFA8561F4`

## 工件卫生

- 目标 worktree 在写入本 review note 前为 clean。
- 根目录媒体/设计工件门禁为空；单文件 HTML 位于 `designs/` 正确归档目录。
- 主工作树原有研究稿保持未触碰；`packages/api/uploads/` 中新增 HTML 是本次远端附件交付的运行时副本，不纳入源码提交。
