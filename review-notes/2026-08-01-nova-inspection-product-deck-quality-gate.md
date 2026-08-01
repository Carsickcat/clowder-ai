# NOVA Inspection Product Deck — Quality Gate

检查时间：2026-08-01  
工作树：E:\ClowderAI\cat-cafe-nova-inspection-product-deck  
基线：origin/main@75d991ee09d2c31edcfcb44b0f13b5586a598f9b

## 愿景覆盖

| #   | operator 原始需求         | 演示稿覆盖                                                                  | 状态       |
| --- | ------------------------- | --------------------------------------------------------------------------- | ---------- |
| 1   | 将产品方案总结为 PPT 材料 | 10 页结论式叙事，包含问题、原则、能力、对象、旅程、体验、边界、一期与路线图 | ✅         |
| 2   | 用 HTML 形式发送          | 单文件 HTML，CSS 与 JavaScript 全部内联，无外部资源                         | ✅         |
| 3   | 手机可以实际打开和阅读    | 390×844 浏览器验证；单页可见、纵向阅读、触控翻页                            | ✅         |
| 4   | 不是只给本地路径          | 交付阶段通过 rich file block 发布真实文件                                   | 待发布动作 |

## 功能验收

| 要求                              | 代码位置                                                                      | 验证                         |
| --------------------------------- | ----------------------------------------------------------------------------- | ---------------------------- |
| 10 页完整产品叙事                 | presentations/nova-inspection-product-vnext/NOVA-Inspection-Product-Next.html | deck-contract.test.mjs       |
| 键盘、按钮、触控、全屏、hash 导航 | HTML 内联脚本                                                                 | deck-contract + deck-browser |
| 手机单页显示、无横向溢出          | HTML 窄屏样式                                                                 | 390×844 browser test         |
| 桌面 10 页内容均不越界            | HTML 桌面布局                                                                 | 1440×900 逐页 browser test   |
| 离线零外链                        | 单文件资源合同                                                                | deck-contract.test.mjs       |
| 可打印为 16:9 页面                | print media contract                                                          | deck-contract.test.mjs       |

## Dogfood-Your-Slice

Scope verdict：✅ 必做。

- 真实路径：本地静态服务 5628 → Hub Browser Preview → 桌面键盘导航 → 手机第 7 页。
- 证据：桌面封面与 390×844 工作区截图保存在系统临时 evidence 目录，不写入仓库。
- 发现并修复：窄屏封面规则覆盖 active-state，造成封面与当前页叠加。
- 回归：手机可见 slide 数量固定为 1。

## 设计与工件卫生

- .pen 匹配：无。
- 根目录媒体工件：无。
- 截图：仅系统临时目录。
- Architecture cell：presentation artifact。
- Map delta：none；未修改 runtime、Store、Router、Adapter 或 connector。
- Capability tips：豁免；演示材料不是产品运行时能力或发现入口。

## 新鲜验证

| 命令                          | 结果                        |
| ----------------------------- | --------------------------- |
| deck contract + browser tests | 5/5 通过                    |
| Prettier targeted check       | 通过                        |
| NOVA standalone tests         | 53/53 通过                  |
| NOVA Vinext build             | 通过                        |
| NOVA npm audit high           | 0 vulnerabilities           |
| root pnpm lint                | 通过，只有主线既有 warnings |
| root pnpm build               | 通过                        |
| git diff --check              | 通过                        |

## 基线例外

root pnpm check 与 root pnpm test 在 Windows 上失败，但同一 exact-main 验收 worktree 亦失败：

- check：1,880 个既有 CRLF 格式诊断，本次 presentation 路径由根 Biome 明确排除。
- test：API 脚本使用 POSIX 环境变量语法，且 Web/MCP 存在同 SHA 的 Windows 基线失败。

本次新增文件的拥有者门禁、浏览器合同、根 build/lint 与独立 NOVA 全门禁均为绿灯；未批量改写无关基线文件。
