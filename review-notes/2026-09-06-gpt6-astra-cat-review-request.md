---
feature_ids: [GPT6_ASTRA_CAT]
topics: [cat-roster, gpt-6-astra, runtime-config, review-request]
doc_kind: review_request
created: 2026-09-06
---

# Review Request: GPT-6 Astra 银渐层丢丢max

Review-Target-ID: gpt6-astra-cat
Branch: `feat/gpt6-astra-cat`
Code SHA: `85462ac9c0047371485ff07c133a3a87eef3be4f`
Base SHA: `2a508b701b8d`

## What

- 新增独立 `silver-chinchilla` 猫种与 `gpt6` 成员：银渐层，昵称“丢丢max”，职责仅为复杂架构设计。
- 复用 Codex/OpenAI OAuth 与 CLI 执行路径，模型 ID 为 `gpt-6-astra`，默认 reasoning effort 为 `xhigh`。
- 新增 `@gpt6`、`@gpt-6`、`@丢丢max`、`@diudiumax`、`@银渐层` 路由；保留既有 `@gpt` → `gpt52`，避免别名抢占。
- 将 `gpt-6-astra` 加入新安装环境的 Codex 内建模型目录，并修复默认 profile 遗漏 `models` 的既有构造缺口。
- 补齐头像、用量面板、消息导航、session chain 与 context health 的身份显示。

## Why

operator 要求把 GPT-6 加进猫猫，并明确它不是既有缅因猫的一个变体，而是一只名为“丢丢max”的独立银渐层，负责复杂架构设计。

## Original Requirements

> “不是，你想的太复杂了，就查询下gpt的模型id，你在猫猫里面参考sol配置下就行了”
>
> “gpt 6 加进去了没，给我加只新猫来，是银渐层 名字叫丢丢max，负责复杂架构设计”

来源：thread `thread_msg13xc7dv3dp4fb`。请 reviewer 重点判断交付是否保持了这个窄边界：独立银渐层、复杂架构职责、沿用 Sol/Codex 配置形态，不引入新的 provider 或认证系统。

## Tradeoff

- `@gpt` 继续属于 `gpt52`；新猫使用更精确的 GPT-6/丢丢max别名，避免破坏既有对话习惯。
- 上下文预算沿用 Sol 形态的 900K prompt / 850K assembled context 安全余量；官方窗口为 1.05M。
- 新猫默认 `xhigh`，符合复杂架构职责，但也意味着成本与延迟高于日常猫，因此 roster caution 明确限制用途。
- 本变更不自动重启当前生产运行时；合入后仍需按正常发布流程激活。

## Architecture Ownership

Architecture cell: Cat runtime configuration / breed registry and provider binding
Map delta: none
Why: 扩展现有 Breed → Variant → Codex account binding，不新增 Store、Queue、Router、Adapter、Dispatcher 或持久化边界。

请 reviewer 检查：

- `silver-chinchilla` 是否确实是独立 breed，而非 Maine Coon 的隐藏 variant；
- `gpt6` 是否只获得 `architect` 职责，且别名不会抢占 `@gpt`；
- 新安装的 Codex OAuth profile 是否真实暴露 `gpt-6-astra`；
- UI fallback 与运行时 catalog 是否一致，不会在局部仍显示为缅因猫。

## Open Questions

### 技术 OQ

1. 独立 breed 复用 `accountRef: codex` 的默认绑定是否覆盖所有 runtime invocation 路径？
2. `createDefaultProfiles()` 补回 `models` 是否会影响已有 profile 的迁移/覆盖语义？
3. 配置与 UI fallback 是否还有遗漏的 `catId` 穷举点？

### 价值 OQ

无。

## Verification Evidence

- 真实模型 smoke：`codex-cli 0.153.4` 调用 `--model gpt-6-astra`，返回精确 `OK`，turn completed。
- 配置与安装器专项：新猫加载/别名/职责/模型测试通过；fresh Codex OAuth profile 包含 `gpt-6-astra`。
- Web 全量：267 test files、1867 tests 全绿；`no-hardcoded-colors` 守卫通过。
- MCP 全量：73/73 通过。
- Production build：shared/API/MCP/Web 全部构建通过；Web 在 `NEXT_PUBLIC_API_URL=http://localhost:4421` 下重新 production build 通过。
- 隔离运行态：API `4421` 初始化日志列出 `gpt6`；`GET /api/cats` 返回 `银渐层 / 丢丢max / gpt-6-astra / complex-architecture`；头像从 Web `4420` 返回 `200 image/png`（1254×1254）。Hub Browser Preview 已成功打开 `4420`；当前会话无可接管 browser binding，因此没有伪造截图证据。
- 头像 SHA-256：`DEBFBEEB41EA9D3C886E3AE0AE4746BE5B16736FF02D2F8752F1539DBE41A252`。
- 受影响文件 Biome 通过；`git diff --check` 通过；根目录媒体闸门为空。

## Known Unrelated Baselines

- 根 `pnpm check` 在既有 Windows start-profile isolation 三项 `null !== 0` 失败；本变更未触及该路径。
- 根 `pnpm test` 的 API script 使用 Unix inline env 语法，在 PowerShell 中无法启动；直接运行 API broad suite 又暴露既有 backlog/preview 慢测和未关闭句柄。本次相关 API 窄集独立通过。
- `install-auth-config-script.test.js` 全文件中既有 shell-escaping 用例依赖 `sh`，当前 Windows PATH 下报 `spawnSync sh ENOENT`；新增 GPT-6 用例独立通过。
- `next dev` 存在既有 `@xterm/xterm/css/xterm.css` loader 错误；production build/start 与隔离 API 验收通过。

## Fresh-Context

未单独发起可选 pre-review scan；本轮直接请求跨个体正式 review。正式 reviewer 需独立验证，不以作者转述作为放行依据。

## Next Action

请在 detached/read-only checkout 审查精确代码 SHA `85462ac9c0047371485ff07c133a3a87eef3be4f`，回复 `APPROVE — 85462ac` 或 `REQUEST CHANGES`（附最小复现与严重性）。

[丢丢/gpt-5.6-sol🐾]
