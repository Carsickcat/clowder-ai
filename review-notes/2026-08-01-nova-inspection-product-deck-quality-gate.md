# NOVA Inspection Product Walkthrough Deck — Quality Gate

检查时间：2026-08-01  
工作树：E:\ClowderAI\cat-cafe-nova-inspection-product-deck  
基线：origin/main@75d991ee09d2c31edcfcb44b0f13b5586a598f9b

## 愿景覆盖

| #   | operator 原始需求      | 演示稿覆盖                                                                             | 状态       |
| --- | ---------------------- | -------------------------------------------------------------------------------------- | ---------- |
| 1   | 主要介绍产品功能       | 12 页中 9 页为产品工作台/功能实景，覆盖生成、编辑、执行、报告、对比、治理、复验和 CLAW | ✅         |
| 2   | 讲清用户怎么用         | 用 `payments-router / production / v3.18.0 / CHG-2481` 贯穿七步操作                    | ✅         |
| 3   | 不能只喊口号和定计划   | 内容合同禁止 Phase、路线图、首期等规划文案；没有路线图页                               | ✅         |
| 4   | 用 HTML 形式发送       | 单文件 HTML，CSS 与 JavaScript 全部内联，无外部资源                                    | ✅         |
| 5   | 手机可以实际打开和阅读 | 390×844 对 12 页逐页验证；单页可见、纵向滚动、触控翻页                                 | ✅         |
| 6   | 不是只给本地路径       | 交付时通过 rich file block 发布真实文件                                                | 待发布动作 |

## 功能验收

| 要求                              | 代码位置                                                                        | 验证                                 |
| --------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| 12 页产品功能与操作叙事           | `presentations/nova-inspection-product-vnext/NOVA-Inspection-Product-Next.html` | `deck-contract.test.mjs`             |
| 七步 walkthrough 均有稳定语义标识 | HTML `data-walkthrough-step=1..7`                                               | `deck-contract.test.mjs`             |
| 具体服务/环境/版本/变更单贯穿     | HTML cover 与各工作台页面                                                       | `deck-contract.test.mjs`             |
| 无规划口号回流                    | HTML 内容合同                                                                   | 禁止 Phase / 路线图 / 首期 / roadmap |
| 键盘、按钮、触控、全屏、hash 导航 | HTML 内联脚本                                                                   | contract + browser                   |
| 桌面 12 页不越界                  | HTML 桌面布局                                                                   | 1440×900 逐页 browser test           |
| 手机 12 页无页面级横向溢出        | HTML 窄屏布局                                                                   | 390×844 逐页 browser test            |
| 离线零外链                        | 单文件资源合同                                                                  | `deck-contract.test.mjs`             |

## Dogfood-Your-Slice

Scope verdict：✅ 必做。

- 真实路径：Chromium 打开 exact worktree 中的单文件 HTML → 桌面逐页导航 → 手机逐页导航与滚动。
- 截图证据：`%TEMP%/nova-inspection-product-deck-evidence/` 中的 cover、候选生成、A/B、最终报告和手机 CLAW。
- 当轮发现并修复 2 个 bug：
  1. 移动端 `.cover` 规则覆盖 inactive 状态，导致两页叠加；收紧为 `.cover.active`。
  2. 移动端 CLAW 对话容器裁掉最后一条回复；改为随内容展开。
- Hub Browser Preview 尝试在 8291 启动专用静态服务时被当前主机 `Start-Process` 权限策略拒绝；未将该步骤伪报为成功。实际 Chromium 合同与截图证据均来自当前 worktree 文件。

## 设计与工件卫生

- `.pen` 匹配：只有无关 `designs/f070-project-setup-card.pen`，本演示稿无对应 `.pen`。
- 根目录媒体工件：无。
- 截图：仅系统临时 evidence 目录。
- Architecture cell：presentation artifact。
- Map delta：none；未修改 runtime、Store、Router、Adapter 或 connector。
- Capability tips：豁免；演示材料不是产品运行时能力或发现入口。

## 新鲜验证

| 命令                          | 结果                          |
| ----------------------------- | ----------------------------- |
| deck contract + browser tests | 6/6 通过                      |
| Prettier targeted write/check | 通过                          |
| NOVA tests                    | 53/53 通过                    |
| NOVA Vinext build             | 通过                          |
| NOVA npm audit high           | 0 vulnerabilities             |
| root `pnpm lint`              | exit 0；只有主线既有 warnings |
| root `pnpm build`             | exit 0                        |
| `git diff --check`            | 通过                          |

## 规格与边界核对

- `目标体验演示` 在全局顶栏和关键 CLAW 页面持续可见，未把下一版体验冒充为当前已上线能力。
- connected 权威仍在服务端只读 connector；浏览器/CLAW 不得提交观测与 verdict。
- `UNKNOWN / BLOCKED` 不会显示为通过。
- 治理建议只记录与解释，不执行发布、放量或回滚。
- 报告引用 Revision、Snapshot、Run、Finding、Decision 与 Evidence，不覆盖历史证据。

## 基线说明

本次 presentation 路径由根 Biome 排除并由独立 Prettier/合同测试拥有。先前已在 exact `origin/main@75d991e` 复现 root `pnpm check/test` 的 Windows 基线失败；本轮未批量改写无关 CRLF 或 POSIX 脚本。与本次差异直接相关的专项测试、独立 NOVA 全测试、root lint/build 均为绿灯。
