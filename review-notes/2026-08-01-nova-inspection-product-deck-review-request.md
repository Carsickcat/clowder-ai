# Review Request: NOVA current-UI AI product deck rewrite

Review-Target-ID: nova-inspection-product-deck

Branch: `feat/nova-inspection-product-deck`

Review range: `78573ba..HEAD`

## What

重写 12 页单文件 HTML 产品演示稿、低保真蓝图和合同测试：

- 以当前 connected 的“左持久作业 + 右一屏 Case workspace”为界面母版。
- 删除上一版虚构的多级左树，不改变现有阶段同屏操作。
- 深化两条 AI 产品能力：巡检项生成/编排、报告生成/解读。
- 用自动合同绑定实际 React 页面标签，并禁止 side-nav 回归。

## Why

co-creator 指出上一版虽然更像产品介绍，但仍有三处本质问题：材料功能与实际页面不一致；多级左树可能破坏当前好用的一屏阶段操作；AI 价值没有被证明，看起来不用 AI 也没有区别。

## Original Requirements

> “材料里介绍的产品功能和实际页面是不一样的吧，我建议还是要保持一致。”
> “当前的页面设计我感觉还可以啊，可以看到阶段可以在一屏内操作，需要做多级左树菜单吗？”
> “把巡检项生成编排，巡检报告生成解读再详细分析下……没有体现出为啥要用 AI。”

来源：`thread_mrrzdymcf3z6bx77`，co-creator message `0001785568029836-000108-be3e4492`。

## Tradeoff

- 不创建更“完整”的产品导航壳，而是复用当前页面；牺牲模块化展示，换取真实一致性与一屏操作连续性。
- AI 只放在语义生成/解释环节，不参与 query 执行、阈值计算和 verdict；智能感更克制，但证据权威清晰。
- CLAW 明确标记为 AI 增强目标并以内嵌助手呈现；不冒充当前 connected 已上线能力。

## Architecture Ownership

Architecture cell: presentation artifact  
Map delta: none  
Why: exact delta 只含演示稿、低保真和合同测试；没有 runtime / Store / Router / Adapter / connector 变化。

## Review Focus

1. 页面是否真的保持“左作业 + 右工作区”，没有以别的形式重新引入多级导航。
2. 当前单巡检项 connected 能力与目标多巡检项/CLAW 是否清楚区分。
3. AI 巡检项生成是否说明输入、理由、阈值依据、provenance 和 omissions，而不是泛泛“自动生成”。
4. AI 报告解读是否把确定性事实、AI 推断、不确定性和证据引用分开。
5. 是否仍有任何文案暗示 AI 能生成观测、修改 verdict 或推进生产动作。
6. 桌面与 390px 手机是否有层级、密度或滚动问题。

## Next Action

请只读 review exact HEAD，给 APPROVE 或带 P1/P2/P3 的 REQUEST-CHANGES。重点审产品真实性与 AI 价值链，其次审视觉；不要重做已冻结的权威边界。

## Self-check Evidence

- quality gate：`review-notes/2026-08-01-nova-inspection-product-deck-quality-gate.md`
- deck contract：7/7
- deck browser：1/1（12 页桌面 + 手机）
- NOVA native tests：53/53
- NOVA Vinext build：pass
- npm audit high：0 vulnerabilities
- root lint/build：exit 0
- `git diff --check`：pass
- root media artifact gate：empty
- root check/test：Windows/main baseline red；exact delta 不含 `packages/**`

### Visual Evidence

- `%TEMP%/nova-inspection-product-deck-evidence/desktop-cover.png`
- `%TEMP%/nova-inspection-product-deck-evidence/desktop-why-ai.png`
- `%TEMP%/nova-inspection-product-deck-evidence/desktop-ai-candidates.png`
- `%TEMP%/nova-inspection-product-deck-evidence/desktop-orchestration.png`
- `%TEMP%/nova-inspection-product-deck-evidence/desktop-report-pipeline.png`
- `%TEMP%/nova-inspection-product-deck-evidence/desktop-report-interpretation.png`
- `%TEMP%/nova-inspection-product-deck-evidence/mobile-workspace.png`
