# NOVA Current-UI AI Product Deck — Quality Gate

检查时间：2026-08-01  
工作树：`E:\ClowderAI\cat-cafe-nova-inspection-product-deck`
本轮基点：`78573bab531e912512af43c0089f0dbd6d12e894`

## 愿景覆盖

| #   | operator 原始需求                        | 本轮实现                                                                                  | 状态 |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------- | ---- |
| 1   | 材料与实际页面保持一致                   | 演示稿直接复用 connected 页面标签与“左持久作业 + 右一屏 workspace”结构                    | ✅   |
| 2   | 保留当前阶段一屏操作，不盲目增加多级左树 | 删除旧 `.side-nav/.nav-item`；Revision、Case、阶段、Run、报告仍在同屏                     | ✅   |
| 3   | 详细分析巡检项生成与编排                 | 展示 Context Pack 输入、候选输出合同、理由/阈值/依赖路径/覆盖缺口，以及 Revision 内增删改 | ✅   |
| 4   | 详细分析报告生成与解读                   | 展示“权威事实 → AI 解释 → 人工决策”管线，以及五个操作问题与逐条证据引用                   | ✅   |
| 5   | 说明为什么需要 AI                        | 独立对比“没有 AI / 有 AI”；明确 AI 处理语义归并与证据化解释，规则继续做确定性判定         | ✅   |
| 6   | 用 HTML 发送，手机能实际打开             | 单文件、无外链；桌面 1440×900 与手机 390×844 全 12 页浏览器合同通过                       | ✅   |

## 功能验收

| 要求                | 实现锚点                                                 | 自动验证                                           |
| ------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| 真实 UI 标签同源    | `InspectionOperationsPage.tsx` + deck `data-ui-contract` | contract test 从源组件读取 7 个关键标签并比对 deck |
| 不出现多级侧栏菜单  | deck 使用 `.job-pane/.workspace-pane`                    | contract 禁止 `.side-nav/.nav-item`                |
| 当前/目标能力不混淆 | “当前已具备：单巡检项” / “AI 增强目标：多巡检项”         | contract 正则                                      |
| AI 生成能力完整     | `data-ai-capability="inspection-design"`                 | 生成理由、覆盖缺口、自然语言草稿等内容合同         |
| AI 报告能力完整     | `data-ai-capability="report-interpretation"`             | 摘要、关联、风险、治理、不确定性、证据引用内容合同 |
| AI 不越权           | “AI 不生成观测值 / 不决定 PASS / FAIL”                   | 内容合同 + 边界页                                  |
| 单文件与交互        | 内联 CSS/JS，hash、键盘、触控、全屏、打印                | contract + browser                                 |
| 桌面/手机可读       | 12 页逐页检测                                            | Playwright browser contract                        |

## Dogfood-Your-Slice

Scope verdict：✅ 必做。

- 路径：Chromium 直接打开当前 worktree 的 HTML 文件 → 逐页桌面/手机导航 → 检查 child overflow、页面级横向溢出与运行时异常。
- 视觉证据：`%TEMP%/nova-inspection-product-deck-evidence/`。
- 人工检查：封面、Why AI、候选生成、Revision 编排、报告管线、报告解读、手机 CLAW。
- 当轮发现并修复：全高 console 的首行被 CSS Grid 拉伸，造成空白；补 `grid-template-rows: auto minmax(0, 1fr)`，移动端恢复 auto rows。

## 设计、架构与工件卫生

- `.pen`：无与本演示稿匹配的设计稿；本轮直接以真实 connected React/CSS 为视觉真相。
- Architecture cell：presentation artifact。
- Map delta：none；没有修改 runtime、Store、Router、Adapter、connector 或生产边界。
- Capability tips：豁免；这是 presentation artifact，不是运行时用户发现入口。
- 根目录媒体工件：工作树与已提交差异均无。

## 新鲜验证

| 命令                 | 结果                        |
| -------------------- | --------------------------- |
| deck Prettier check  | 通过                        |
| deck contract        | 7/7 通过                    |
| deck browser         | 1/1 通过；桌面/手机 12 页   |
| NOVA native tests    | 53/53 通过                  |
| NOVA Vinext build    | 通过                        |
| NOVA npm audit high  | 0 vulnerabilities           |
| root `pnpm lint`     | exit 0；仅主线既有 warnings |
| root recursive build | exit 0                      |
| `git diff --check`   | 通过                        |

## 基线说明

root `pnpm check/test` 在此 Windows checkout 仍为已知基线红灯：Biome 将全仓 CRLF 判为 1880 个格式错误；Web 测试环境出现成批既有失败。本轮 exact delta 仅 4 个 presentation 文件，未改 `packages/**`。相同 main 基线此前已在 `origin/main@75d991e` 独立复现；本轮没有批量改写无关文件来伪造绿灯。

## 交付完整性

这次交付是完整的 HTML deck 修订，不依赖后续重写。未来产品实现可以扩展 deck 中标注的 AI 目标能力，但本材料已经明确区分当前能力、目标能力与权威边界。
