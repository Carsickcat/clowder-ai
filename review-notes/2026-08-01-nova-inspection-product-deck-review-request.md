# Review Request: NOVA inspection product HTML deck

Review-Target-ID: nova-inspection-product-deck  
Branch: feat/nova-inspection-product-deck

## What

新增一份 10 页离线 HTML 演示稿及低保真蓝图：

- 总结本轮巡检产品方案、原子能力、领域对象、用户旅程和一期范围。
- 支持键盘、按钮、触控、全屏、hash 深链、打印和手机纵向阅读。
- 新增结构与浏览器合同；视觉 dogfood 抓到并修复移动端叠页。

## Why

co-creator 要求将本轮详细产品方案总结成 PPT 材料，并以实际 HTML 文件发送。此前本地路径在手机上不可用，因此本次必须同时满足单文件离线、真实文件交付和移动端可读。

## Original Requirements

> “产品方案挺详细的，你可以把产品方案总结成一份 ppt 材料，用 html 形式发给我吗”

- 来源：thread_mrrzdymcf3z6bx77，co-creator message 0001785558066237-000088-6605815a
- 请对照上面的摘录判断交付物是否解决了 operator 的问题。

## Tradeoff

- 选择可选择文字、可重排的单文件 HTML，没有使用逐页 raster 图片；视觉更克制，但手机阅读、离线性和可访问性更好。
- 控制为 10 页结论式演示，舍弃多猫讨论过程和全部领域字段，只保留影响产品决策的边界。
- 没有将演示稿接入 NOVA runtime 或构建产物，避免把一次评审材料变成产品运行时能力。

## Architecture Ownership

Architecture cell: presentation artifact  
Map delta: none  
Why: 只新增静态演示、测试与审查材料，不改变 runtime、Store、Router、Adapter、connector 或数据边界。

请 reviewer 检查 diff 是否与 Map delta 一致，且没有产生第二套产品状态机。

## Open Questions

### 技术 OQ

1. 10 页内容是否准确反映本轮收敛，尤其是 PlaybookRevision、fresh snapshot、successor Case 与证据状态边界。
2. 桌面与 390px 手机布局是否存在内容层级、可读性或误导问题。
3. 是否有任何措辞会让用户误以为依赖候选等于完整拓扑，或治理建议可以执行生产动作。

### 价值 OQ

无。

## Next Action

请烁烁只读 review exact SHA，给出 APPROVE 或带 P1/P2/P3 的 REQUEST-CHANGES。重点审内容表达、视觉层级、移动端阅读和产品误导风险；不重做已冻结的产品方案。

## Review Sandbox

- Path: E:\ClowderAI\review-sandboxes\nova-inspection-product-deck\siamese
- Start Command: python -m http.server 5629 --bind 127.0.0.1
- Ports: static=5629

## 自检证据

### Spec 合规

review-notes/2026-08-01-nova-inspection-product-deck-quality-gate.md

### 测试结果

- deck contract + browser tests：5/5 通过。
- Prettier targeted check：通过。
- NOVA standalone tests：53/53 通过。
- NOVA Vinext build：通过。
- NOVA npm audit high：0 vulnerabilities。
- root lint：exit 0；root build：exit 0。
- git diff --check：通过。

root check/test 的 Windows 基线失败已在 exact origin/main@75d991e 独立复现，非本次差异；详见 quality-gate report。

### 视觉证据

- C:\Users\myh_1\AppData\Local\Temp\nova-inspection-product-deck-evidence\desktop-cover.png
- C:\Users\myh_1\AppData\Local\Temp\nova-inspection-product-deck-evidence\mobile-workspace.png
