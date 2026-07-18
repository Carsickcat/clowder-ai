# F010 Mobile Experience Recovery Implementation Plan

**Feature:** F010 — `docs/features/F010-mobile-cat.md`
**Goal:** 在同一套 Clowder AI PWA 中交付可验证的移动聊天工作面，使键盘、滚动、底部导航、状态提示和消息确认在 iPhone/Android 动态视口下保持一致。
**Acceptance Criteria:** 覆盖 AC-A0/A1/A3/A4/A5；390×844 键盘态无焦点缩放、无横向溢出、发送主操作完整、底栏隐藏且不占位；消息区单一纵向滚动；更新检查失败不遮挡聊天；服务端已提交消息不显示矛盾失败；composer 的文字、附件与 reply context 不因键盘/viewport/frame 变化丢失；production build 和隔离 HTTPS 验收可追溯到当前提交；验收 `/api/cats` 的每个展示成员均已进入运行时 `AgentRegistry`，否则验收 API fail closed。
**Architecture cell:** `hub-action-surface`, `bubble-pipeline`, `dispatch`
**Map delta:** none
**Map delta why:** 本轮收敛既有 AppShell、消息气泡和 messages route 行为，不改变 ownership 边界或新增扩展点。
**tips_exempt:** `{ reason: "Existing send-reliability contract repair; no new user action, capability, or guide entry point." }`
**Architecture:** `useVisualViewportCssVars` 继续作为 viewport 唯一写入者；chat route 使用一个受控 frame、一个 transcript scroll owner 和一个 Dock。消息发送复用现有 UUID 幂等边界完成 duplicate acknowledgement 与一次对账，不建立新队列或 store。每个可派发请求先持久化一个 `InvocationRecord` 原子 claim；实际排队时该 record 链接稳定的 `queueEntryId`，而 `InvocationQueue` entry 继续作为 queued API response owner。
**Tech Stack:** Next.js/React, Tailwind/CSS variables, Fastify, Vitest/Testing Library, Playwright/browser acceptance
**前端验证:** Yes — reviewer 必须检查 390/430/768/1024 浏览器状态，production PWA，键盘开闭、mention、Socket 降级和 update-check failure。

---

## Finish line

终态是隔离 HTTPS PWA 已运行当前构建，自动化与跨猫 review 通过，operator 可直接在同一台 iPhone 复验。不是本轮要做的内容：固定机型布局、通用 `dispatchReady` 模型、原生壳、完全离线发送、桌面 IA 重构。

## Terminal schema

- CSS projection: `--app-viewport-{top,left,width,height}` 是 VisualViewport 在 layout viewport 坐标系中的 CSS-pixel 矩形，只由 viewport hook 写入。AppShell 使用 `position: fixed` 直接定位到该矩形；不得再把 `top` 加进 `height`，也不得把 `keyboard inset` 追加到已经缩小的 visual viewport。
- Dock projection: `--mobile-dock-reserve` 是移动导航高度（含一次 safe-area）的唯一来源；`MobileOpsShell` 与 ChatContainer 只消费该 token。键盘态 token 为 `0px` 且 nav 隐藏，不再出现第二份 `4rem + safe-area`。
- UI modes: `browsing | composing` 是 viewport 的纯投影，不持久化。
- Immediate/force response（`InvocationRecord` owner）：
  - 新请求：`200 { status: 'processing', invocationId, userMessageId }`；
  - duplicate 且 durable message 已存在：`200 { status: 'acknowledged', invocationId, userMessageId }`；
  - duplicate record 为 `queued | running` 且 `userMessageId` 尚未回填：`202 { status: 'confirming', invocationId }`；客户端保留 optimistic 气泡并等待/对账，不生成新 UUID；
  - duplicate record 为 `failed | canceled` 且没有 durable message：`409 { status: 'failed', invocationId, retryWithNewIdempotencyKey: true }`；客户端才可明确失败，并由显式重试生成新 UUID。
- Queue/TOCTOU response（`InvocationQueue` entry 是外部 response owner，不创建 optimistic 气泡；内部仍保留统一 `InvocationRecord` 原子 claim/lifecycle record，并持久化同一 `queueEntryId`）：
  - entry 已有 durable message：`202 { status: 'queued', entryId, userMessageId }`；deduped replay 返回同一组 ID；
  - deduped entry 尚未 backfill message id：`202 { status: 'confirming', entryId }`；客户端不添加气泡、不生成新 UUID，等待/再次查询既有 entry；
  - `429 QUEUE_FULL` 与 validation error 是确定失败，不做 ambiguous replay。
- 同一 UUID 的重放不产生第二条消息、InvocationRecord 或队列 entry；幂等 owner 不设置 TTL。durable message 持久化 `{ ownerKind, ownerId }` recovery pointer，旧 record/index 丢失时也必须在 tracker/queue/force side effect 前停止重派发。`confirming` 不是失败，也不是第二次提交许可。
- immediate/force record 为 `succeeded` 却没有 `userMessageId` 属于服务端不变量破坏，返回 `500 invariant_violation` 并告警，禁止客户端自动生成新 UUID，以免重复执行猫猫动作。
- Update UI: `update-ready` 可见；update-check error 只进入诊断/log，不占据常驻 chrome。
- Acceptance roster: 仅当验收开关启用时，在 API 启动阶段比较 resolved catalog IDs 与已注册 `AgentService` IDs；不一致即拒绝启动并列出缺失 ID，不向产品 schema 增加 `dispatchReady`。

## Invariants

- **INV-1:** chat 根与 document 不滚动；transcript 是聊天页唯一纵向滚动 owner。
- **INV-2:** 键盘态 mobile nav 不可见，chat bottom reserve 同步为 0。
- **INV-2a:** VisualViewport `top/left` 只在 AppShell 定位时消费一次；safe area 只在 frame/Dock 边缘消费一次；keyboard inset 不参与第二次几何补偿。
- **INV-3:** editable 字号在 compact/medium 上不小于 16 CSS px；用户缩放保持可用。
- **INV-4:** composer 主操作在 320px 以上宽度完整可见，触控目标至少 44px。
- **INV-5:** update-check rejection 不渲染阻塞 banner；waiting worker 仍渲染更新动作。
- **INV-6:** 同一 idempotency key 至多产生一条 durable user message 与一个持久化 InvocationRecord；若实际排队，再且仅再链接一个使用相同 `queueEntryId` 的 queue entry。InvocationRecord 是跨模式原子 claim，QueueEntry 是 queued response owner；duplicate 按对应外部 owner 响应，message id 未回填时不得伪造 acknowledged/queued。
- **INV-7:** response 丢失但 durable message 存在时，客户端不插入 failure system bubble。
- **INV-8:** 键盘/viewport/frame 变化不重挂载 composer；thread-scoped 文字、附件与 reply context 不丢失，mention tray 关闭不改写输入内容。
- **INV-9:** 验收 `/api/cats` 的展示集合必须是验收 API 的运行时 `AgentRegistry` 子集；否则启动门禁失败，证据不得宣称该 roster 可调用。

## Task 1: 冻结红色契约

**Files:**
- Modify: `packages/web/src/components/__tests__/mobile-overflow-contract.test.ts`
- Modify: `packages/web/src/hooks/__tests__/useVisualViewportCssVars.test.tsx`
- Modify: `packages/web/src/components/__tests__/chat-container-mobile.test.ts`
- Modify: `packages/web/src/components/__tests__/pwa-update-controller.test.tsx`
- Modify: `packages/web/src/hooks/__tests__/useSendMessage-thread-source.test.ts`
- Modify: `packages/web/src/hooks/__tests__/useSendMessage-upload-state.test.ts`
- Modify: `packages/web/src/components/__tests__/chat-input-draft-persistence.test.ts`
- Modify: `packages/api/test/messages-delivery-mode.test.js`
- Create: `packages/api/test/acceptance-roster-gate.test.js`

1. 写 INV-1～INV-9 的聚焦失败测试；发送测试同时锁定 immediate/queue 在 message id 回填前的 duplicate 竞态。
2. 分组运行，确认每个测试因目标行为缺失而 RED，而不是 fixture 错误。
3. 把失败命令与原因写回 bug capsule。

## Task 2: 统一 mobile frame 与滚动 owner

**Files:**
- Modify: `packages/web/src/hooks/useVisualViewportCssVars.ts`
- Modify: `packages/web/src/app/globals.css`
- Modify: `packages/web/src/components/AppShell.tsx`
- Modify: `packages/web/src/components/MobileOpsShell.tsx`
- Modify: `packages/web/src/components/ChatContainer.tsx`

1. 让 hook 以 rAF 合并写入完整 `top/left/width/height` frame，保留无 API fallback；测试 offset 非零时 AppShell 不把 offset 重复加到高度。
2. AppShell 固定定位到 visual frame；chat shell 设为 `min-height:0; overflow:hidden`，移除 AppShell/chat 的重复纵向滚动和 `.mobile-keyboard-offset` 几何补偿。
3. 用唯一 `--mobile-dock-reserve` 驱动导航高度与 chat reserve；键盘打开时 token 归零并隐藏 nav，safe area 不重复预留。
4. 运行 viewport/chat 聚焦测试到 GREEN，再抽样非 chat 路由保持可滚动。

## Task 3: 收敛 composer 与 mention tray

**Files:**
- Modify: `packages/web/src/components/ChatInput.tsx`
- Modify: `packages/web/src/components/ChatInputMenus.tsx`
- Modify: `packages/web/src/components/__tests__/chat-input-mobile.test.ts`

1. 写 16px editable、单一主操作、44px target、bounded mention tray 与移动端隐藏桌面键盘提示测试；mention 最大高度相对 visual frame，IME composition 中不选择，关闭后恢复焦点且不改写输入。
2. 扩充现有 draft persistence 测试：键盘开关、visual viewport 更新与 frame class 切换不重挂载 `ChatInput`，文字、图片、reply context 保留；线程切换仍隔离；关闭 mention 不改写输入。
3. 确认 RED；实现 compact/medium 样式，desktop 行为保持；mode 只用 CSS/data projection，不以条件渲染替换 composer。
4. 运行 composer/mention/draft persistence 测试到 GREEN。

## Task 4: 压缩基础设施状态

**Files:**
- Modify: `packages/web/src/components/ConnectionStatusBar.tsx`
- Modify: `packages/web/src/components/pwa/PwaUpdateController.tsx`
- Modify: `packages/web/src/components/__tests__/connection-status-bar.test.tsx`
- Modify: `packages/web/src/components/__tests__/pwa-update-controller.test.tsx`

1. 写 mobile degraded 状态只显示一行摘要、update-check error 不渲染 banner、update-ready 仍可操作的测试。
2. 确认 RED；复用现有 status token 实现紧凑摘要与 details，错误保留日志/重试策略。
3. 运行状态与 PWA 测试到 GREEN。

## Task 5: 完成幂等 acknowledgement 与 ambiguous-send reconcile

**Files:**
- Modify: `packages/api/src/routes/messages.ts`
- Modify: `packages/web/src/hooks/useSendMessage.ts`
- Modify: `packages/api/test/messages-delivery-mode.test.js`
- Modify: `packages/web/src/hooks/__tests__/useSendMessage-thread-source.test.ts`
- Modify: `packages/web/src/hooks/__tests__/useSendMessage-upload-state.test.ts`

1. API RED：JSON/multipart 的 immediate、force、queue 与 TOCTOU queue 分支都传递同一 `resolvedIdempotencyKey`；immediate/force 已有 message id 的 duplicate 返回 `200 acknowledged`，queue/TOCTOU 返回 `202 queued` 与稳定 `entryId`。
2. API 竞态 RED：分别暂停 immediate 的 append/backfill 与 queue entry 的 append/backfill，在窗口内重放同 UUID，必须分别返回含 `invocationId` 或 `entryId` 的 `202 confirming`；放行后再次重放返回同一 `userMessageId`。Immediate record 的 `failed | canceled` 且无 durable message 才返回 `409 failed` 与新 UUID 指引。另覆盖 300 秒后重放、bounded record eviction 与 Redis message owner round-trip，均不得再次进入派发 side effect。
3. Web RED：只有 transport exception 或 response parse ambiguity 才用同一 UUID 做一次对账重放；确定 4xx、validation error 与 `QUEUE_FULL` 不重放。`acknowledged` 替换 immediate/force optimistic identity；`confirming` 保留已有 optimistic 气泡并等待既有 Socket/后续对账；queue 本来没有 optimistic 气泡，直接采用服务端 `userMessageId`。只有确定 `failed` 才进入可重试状态，不插红色系统消息。
4. 确认 RED；最小实现到 GREEN；复跑 queue/immediate sibling paths 防止重复。

## Task 6: 三件套沉淀与范围护栏

**Files:**
- Modify: `docs/design/F010-mobile-pwa-standard.md`
- Modify: `docs/features/F010-mobile-cat.md`
- Modify: `docs/bug-report/f010-ios-keyboard-visual-viewport-offset/bug-report.md`
- Create: `feature-discussions/2026-07-18-f010-mobile-experience-recovery-meeting-notes.md`
- Create: `packages/api/src/config/acceptance-roster-gate.ts`
- Modify: `packages/api/src/index.ts`
- Create: `packages/api/test/acceptance-roster-gate.test.js`

1. 写入“一个 viewport/scroll/Dock owner”、构建身份门禁和被否决方案。
2. 明确通用猫猫 readiness 不属于本轮；增加验收专属启动 gate：启用时比较 resolved catalog 与 `AgentRegistry`，缺少任一执行服务即 fail closed；默认产品运行与 `/api/cats` schema 不变。
3. 集成测试覆盖 gate 关闭、完整 roster 通过、缺失成员失败并列出 ID；验收证据逐项记录 `catId`、provider/client、适配器模式、`AgentService` 注册结果与实际 `/api/cats`，未验证成员不得出现在“可调用 roster”结论中。
4. 记录 operator 纠正：计划/review 是中间状态，terminal request 未达成时不得当成交付。

## Task 7: Verification and review

1. 运行聚焦 Web/API tests、F010 suites、TypeScript、lint/format、`git diff --check`。
2. 运行 production Web build；记录 commit、BUILD_ID、build/start time。
3. 在隔离 API 4311 / Web 4310 / Redis 6398 DB15 上启用 roster gate 启动验收构建；门禁输出与 `/api/cats` 结果写入证据；不触碰 runtime 3003/3004 与用户 Redis 6399。
4. 浏览器验证 390×844、430×932、768×1024、1024×768：keyboard projection、single scroll、mention、connection degraded、update failure/ready、send reconciliation。
5. 发起跨个体代码 review；P1/P2 清零后再向 operator 报告实现结果，并保留同机 iPhone 最终复验入口。

[宪宪/gpt-5.6-sol🐾]

## Task 8: Correct the mobile chat-shell state projection

True-device evidence on 2026-07-18 invalidated the earlier assumption that the layout/visual viewport height difference detects every iOS keyboard geometry. The implementation keeps one ephemeral `data-mobile-keyboard-open` projection, but its input now covers both observed models: the direct viewport difference, or a composer-focused shrink from a stable same-width VisualViewport baseline. This is an evidence-based replacement for the earlier blanket rejection of any focus guard; it is not a focus-only fixed-height fallback.

**Files:**

- Modify: `packages/web/src/hooks/useVisualViewportCssVars.ts`
- Modify: `packages/web/src/app/globals.css`
- Modify: `packages/web/src/components/ChatContainerHeader.tsx`
- Modify: `packages/web/src/components/ChatContainer.tsx`
- Modify: `packages/web/src/components/ChatInput.tsx`
- Modify: focused viewport/header/composer contracts
- Create: `docs/bug-report/f010-mobile-chat-shell-chrome-density/bug-report.md`

1. RED: simultaneous `innerHeight` and `visualViewport.height` shrink while the composer is focused must enter composing mode; duplicate composer safe-area, desktop-height mobile header, and keyboard-visible secondary chrome must fail contracts.
2. GREEN: project a 56px single-line mobile header; remove low-frequency desktop controls from its primary row; make Dock reserve the only bottom safe-area consumer; hide Dock and secondary liveness chrome in composing mode; cap the mobile composer near three lines.
3. Preserve critical control: the composer stop action remains reachable while secondary status rows are hidden.
4. Verify focused suites, production build, isolated compact/medium browser preview, independent review, and the same-device iPhone PWA acceptance.

[宪宪/gpt-5.6-sol🐾]

## Task 9: Commit installed-PWA keyboard geometry as a state machine

The seventh true-device recording after `ffafb56` proves that the viewport owner still lacks event chronology. A resize-time intermediate height can collapse the entire fixed AppShell, while WebKit publishes the terminal focused geometry through `visualViewport.scroll`. Removing root offset projection was correct; removing the scroll event source was not.

### State transitions

| State | Input | Immediate projection | Stable commit |
| --- | --- | --- | --- |
| `closed-stable` | composer focus + focused viewport shrink/pan | latch `data-mobile-keyboard-open=true`; keep last stable shell geometry | after the geometry event stream settles, commit current width/height |
| `opening-uncommitted` | further `resize` / `scroll` frames | keep composing mode; do not expose animation-time height to AppShell | restart the single settle window |
| `open-stable` | typing, mention, transcript scroll | keep fixed origin and settled height | no geometry write without a viewport/window event |
| `closing-uncommitted` | blur + restoring geometry | retain composing projection so Dock cannot flash back mid-animation | clear keyboard state only when restored geometry settles |
| any | width-class/orientation change | stage the new width; if the keyboard is open, retain the last closed-height baseline | commit the settled new frame, then adopt the restored height after blur/geometry growth |

### Invariants

- `visualViewport.resize` and `visualViewport.scroll` are both input events; cleanup removes both.
- `offsetTop/offsetLeft` never translate AppShell. A focused pan may only help classify keyboard state.
- Baseline height shrink is measured independently of pan; subtracting `offsetTop` must not cancel a real shrink.
- Keyboard-open may latch before geometry commits. Keyboard-close may occur only with a settled restored frame.
- Only one quiet-window timer and one animation-frame reader exist; raw animation frames never write shell dimensions.
- An open-keyboard orientation frame cannot become the new closed-height baseline; the pending width baseline resolves only after composer blur and viewport-height restoration.
- The terminal frame still comes from current `visualViewport.width/height`; no device ratio, assistant reserve, or UA-specific coordinate owner is introduced.
- Mention tokens end at whitespace, Unicode punctuation, or symbols; Chinese/Latin letters, numbers, combining marks, `_`, and `-` remain valid filter text.

### Red contract

1. Focus composer; mutate `height/offsetTop`; dispatch only `visualViewport.scroll`. The old hook must fail to enter composing mode or commit the final height.
2. Dispatch a resize frame with a near-zero intermediate height. Before the settle boundary, the committed AppShell height must remain the previous stable value.
3. Dispatch the final scroll frame. After settling, the new height commits once, root top remains zero, and Dock/secondary chrome are projected out.
4. Blur and restore through intermediate geometry. Keyboard state remains latched until the restored terminal frame settles.
5. `@opus，继续` and `@opus,continue` close the picker; `@布偶猫` and `@co-creator` remain valid triggers.
6. Rotate while the keyboard is open. The new width/height commits, composing remains latched, and the baseline resolves only after blur plus restored geometry.
7. Unmount with a settle timer pending, then dispatch both viewport events. No delayed CSS/data write may occur. Symbols terminate mentions; numbers, combining marks, and `_` remain valid filters.

[丢丢/gpt-5.6-sol🐾]
