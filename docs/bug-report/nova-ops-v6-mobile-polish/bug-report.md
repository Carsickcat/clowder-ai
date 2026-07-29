# Bug 诊断胶囊：Nova Ops V6 移动导航与空态打磨

Date: 2026-07-29

Reviewer source:
`review-notes/2026-07-29-nova-ops-v6-product-verdict-siamese.md`

| 栏位                    | 内容                                                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. 现象**             | 390px 底部导航不能同时识别全部入口，`Inspections` 被截断；对象页返回入口是透明轻文字；专业证据 tabs 的移动滚动意图不清；无 running Agent 时首页缺空态。                                      |
| **2. 证据**             | 烁烁在独立 `390×844` 浏览器复审中记录两项 P2、两项 P3；当前 CSS 让七个导航按钮各自 `min-width: 82px`，返回按钮无边框/背景，tabs 只声明 `overflow-x: auto`，`SreHome` 直接 map running runs。 |
| **3. 问题假设或根因**   | 移动端验收只证明“导航存在、页面可达”，没有约束首屏可识别性、逆向导航 affordance、tab 滚动语义和空集合呈现。                                                                                  |
| **4. 诊断策略**         | 在 390px Playwright 旅程读取导航/返回/tabs 的真实 geometry 与 computed styles；结构合同验证 compact labels、secondary-navigation role 和空态分支。                                           |
| **5. 超时策略**         | 20 分钟内若七入口无法在 390px 保持可识别，退回显式横向分页/scroll-snap，不引入新的导航层或隐藏入口。                                                                                         |
| **6. 预警策略**         | 修复后若按钮命中区小于约 44px、accessible name 丢失、主领域动作被返回按钮抢权重，说明方向错误。                                                                                              |
| **7. 用户可见交互修正** | 390px 下七个入口均以图标+稳定缩写呈现；返回入口成为次要按钮；专业 tabs 单行可横滑；无任务时显示明确空态。                                                                                    |
| **8. 验收**             | RED→GREEN：`experience-contract.test.mjs` + `golden-path.browser.mjs`；390px 截图；完整 `npm run check`、browser、audit、base-aware diff check。                                             |
