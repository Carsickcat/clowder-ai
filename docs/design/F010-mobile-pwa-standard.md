---
feature_ids: [F010]
related_features: [F164, F190, F246]
topics: [mobile, pwa, tailscale, responsive]
doc_kind: design
status: approved
created: 2026-07-17
approved: 2026-07-17
parent: ../features/F010-mobile-cat.md
---

# F010 移动端 PWA 标准方案

> 状态：三位原作者两轮审核通过；operator 于 2026-07-17 批准进入实施。  
> 批准原话：“好滴，你开始搞吧，记得代码要拉大家一起审核。”  
> 上级真相源：[F010 手机端猫猫](../features/F010-mobile-cat.md)

## 1. 决策摘要

Clowder AI 手机端采用 **同一套 Next.js Web 应用 + 响应式移动壳 + 可安装 PWA + Tailscale Serve 私网 HTTPS**。不新建独立业务前端，不在本阶段重写 Swift、React Native 或 Flutter App。

目标不是把桌面三栏等比例缩小，而是在保留功能、数据、设计语言和猫猫人格的前提下，为手机重新编排信息层级。PWA 安装只负责消除浏览器外壳、提供桌面图标和系统级能力入口；真正的手机体验由移动信息架构、触控、软键盘、安全区与真机验收保证。

原生壳保留为后续能力门，不作为“网页看起来不好看”的修复手段。只有出现经验证无法由 Web/PWA 满足的系统能力需求时，才考虑用 Capacitor 包装同一套前端。

## 2. 用户目标

operator 在已加入 tailnet 的手机上，可以：

1. 通过私有 HTTPS 地址访问并安装 Clowder AI；
2. 像普通 App 一样从主屏幕全屏打开；
3. 完成桌面端已有的核心协作闭环：选 thread、召唤猫猫、发送文字/附件、查看执行状态、工作进度、产物和审批；
4. 访问 Memory、Mission、Signals、Settings 等全局模块；
5. 在断线、后台恢复和版本更新时看到明确、可恢复的状态；
6. 保持与桌面端一致的品牌、主题、猫猫头像、消息气泡和数据真相源。

## 3. 范围边界

### 3.1 本阶段包含

- 手机与平板响应式 AppShell；
- PWA 安装、standalone 识别、图标、manifest、Service Worker；
- Tailscale Serve 私网 HTTPS 访问路径；
- thread 内核心功能和全局模块的移动入口；
- iOS/Android 安全区、动态视口、软键盘和触控适配；
- 前台恢复、Socket 重连、离线快照标识和可恢复错误；
- 真机功能、视觉、可安装性与桌面回归验收。

### 3.2 本阶段不包含

- App Store / Google Play 分发；
- 独立原生 UI 或第二套业务状态管理；
- 公开互联网暴露 API；
- 完全离线聊天或离线排队发送；
- 为了逐像素复刻桌面端而保留手机上不适用的多栏布局；
- Watch、Widget、Share Extension、后台常驻语音等原生专项能力。

## 4. 架构标准

### 4.1 单一产品与单一真相源

- Web、PWA 与未来可选原生壳共享同一套页面、组件、API、Socket 协议和持久化数据。
- 不建立 `mobile-*` 业务 API，不复制 thread/message/task/artifact/approval store。
- 移动端允许使用不同的组合容器和交互形态，但业务组件与设计 token 应复用。
- 手机访问不得创建新的默认用户、数据命名空间或与桌面分叉的身份。

### 4.2 已有远程安全基线

本方案复用已经落地的远程安全底座，不重复设计或旁路它：

- `dataUserId` 与 `authSubject / authMethod / roles` 已分离，远程 owner 继续读取既有 `default-user` 数据；
- Tailscale Serve 身份只在 API loopback、精确 HTTPS origin 和 owner allowlist 同时成立时受信；
- HTTP 与 Socket 使用同一 session principal，Socket room 加入会校验 thread 访问权；
- 主机侧已经完成 HTTPS session、Secure/HttpOnly/SameSite Cookie、真实 WSS、PWA 首页和 Service Worker 验收。

对应代码真相源为 `packages/api/src/infrastructure/session-auth.ts`、`packages/api/src/infrastructure/websocket/SocketManager.ts` 与 `packages/api/src/index.ts`。F010 移动 UI 不修改这套身份契约；A0/A2 只做手机端端到端复验。任何后续远程入口变更必须回到安全底座所属工作流处理。

### 4.3 私网访问边界

```text
手机 PWA
  -> Tailscale tailnet
  -> Tailscale Serve HTTPS / MagicDNS 主机名
  -> Next.js Web（同源 /api、/socket.io、/uploads rewrite）
  -> Clowder AI API 与既有持久化存储
```

- 只把 Web 入口提供给 tailnet，不直接向手机暴露 API/Redis/SQLite 端口。
- 正式手机入口必须是浏览器认可的 HTTPS secure context；raw `http://100.x.x.x:port` 只可用于临时诊断，不作为安装路径。
- 首次加载应检测 secure context、Service Worker 和 manifest 可用性；不满足时给出诊断，不承诺“可安装”。
- Tailscale 负责私网设备边界，Clowder session/role/room ACL 负责应用授权；若未来入口跨出 tailnet，必须另立鉴权设计。

### 4.4 缓存与离线语义

- App 壳、字体、图标和静态资源可缓存。
- `/api/*` 与 `/socket.io/*` 保持网络真相源，不用 Service Worker 返回陈旧业务响应。
- 已有 IndexedDB thread/message 快照可以用于断线阅读，但必须显示“离线快照/可能非最新”。
- 离线状态不发送消息；恢复前台或网络后，以服务端快照重新对账。

## 5. 移动信息架构

### 5.1 两级导航

**第一级：手机高频工作闭环，固定底栏**

1. 对话
2. 工作
3. 产物
4. 审批

其中“对话 / 工作 / 产物”共享当前 `threadId`。“审批”是明确的作用域例外：它打开 F246 全局 Approval Hub，badge 统计全部待审批项，并提供“全部 / 当前 thread”过滤；从 thread 内审批深链进入时定位到具体 proposal，但不得因此隐藏其他 thread 的待审批事项。审批保留在底栏，是因为它是 operator 的高优先级动作，而不是因为它属于 thread 数据模型。

**第二级：全局产品模块，统一左侧导航抽屉**

- Thread 列表 / 项目切换
- Memory
- Mission
- Signals
- Settings

顶部左侧 `☰` 是全局模块的唯一 canonical carrier；本阶段不同时保留“更多”面板这一第二模型。抽屉按“Threads / 全局模块 / Settings”分组，选中目标后自动关闭；返回时保留来源 thread，并能通过深链恢复目标。全局模块不与高频工作闭环混在同一固定底栏，避免底栏超载和作用域歧义。

### 5.2 页面结构

```text
┌────────────────────────────┐
│ ☰  当前 Thread       连接/状态 │
├────────────────────────────┤
│                            │
│      当前主工作表面          │
│  对话 / 工作 / 产物 / 审批    │
│                            │
├────────────────────────────┤
│ ＋  输入消息…          发送   │
├────────────────────────────┤
│ 对话     工作     产物     审批 │
└────────────────────────────┘
```

- Thread 列表使用左侧抽屉；选中 thread 后自动关闭。
- 状态详情使用 Bottom Sheet；不常驻挤压消息宽度。
- 工作、产物和全局审批中心在手机上使用全屏表面；不得强塞桌面侧栏。
- 桌面浮窗/多栏能力在手机上降级为单表面切换，但功能入口不得消失。
- 返回行为必须可预测：系统返回键/边缘返回优先关闭 sheet 或抽屉，再离开页面。

### 5.3 响应式契约

- `compact`：小于 768px，手机单列 + 底栏；
- `medium`：768–1023px，仍使用移动工作表面，可按空间增加内容密度；
- `wide`：1024px 及以上，桌面 AppShell。

所有 JS 媒体查询与 Tailwind 显隐必须消费同一个可导入的 breakpoint 真相源，禁止分别硬编码数值。当前 `useIsDesktop` 的 768px 与部分 `lg` 组件的 1024px 语义不一致，实施前必须统一，避免平板同时进入桌面状态和移动 UI。

## 6. 视觉与交互标准

- 复用现有 Console token、主题、猫猫色、头像、消息气泡和品牌字体；不得另造“手机版主题”。
- “样式一致”指品牌和组件语义一致，不要求手机逐像素复制桌面布局。
- 主要触控目标最小 44×44 CSS px；仅装饰元素除外。
- 使用 `100dvh`、`viewport-fit=cover` 与四向 safe-area；不能只补顶部/底部后假设横屏安全。
- 打开软键盘后，输入框和发送按钮必须保持可见；消息列表不得跳到错误位置。
- 长 Markdown、表格、代码块、CLI 输出、图片和 rich block 不得撑破视口；需要局部横向滚动或移动呈现。
- light/dark 与主要猫猫主题均需截图回归，不能只验默认主题。
- 尊重 reduced motion、屏幕阅读器标签、焦点顺序和颜色对比。

## 7. 安装与更新体验

### 7.1 安装入口

- Android/支持 `beforeinstallprompt` 的浏览器使用原生安装 prompt。
- iOS 提供“分享 -> 添加到主屏幕”的手动步骤。
- 已处于 standalone 时不再展示安装入口。
- Global drawer / Settings 保留常驻“安装 Clowder AI”入口；仅在 secure、installable、非 standalone 且连接稳定时，额外显示一次 contextual banner。
- 安装入口不得遮挡输入框、底栏、审批或全局导航。用户关闭 contextual banner 后在本机持久化 30 天；不允许每次刷新重新弹出。
- 非 secure context、内嵌 WebView 或浏览器不支持时，应展示准确诊断而不是无条件宣称可以安装。

仓库中现有 `PwaInstallPrompt` 是候选实现，不自动视为本方案已完成。它仍需按上述契约审核提示时机、dismiss 持久化、断点一致性、全路由遮挡和真机文案。

### 7.2 版本更新

- 新 Service Worker 就绪时给出明确的“更新并重新载入”路径，避免旧页面引用新构建不存在的 chunk。
- 更新不得丢失输入草稿、当前 thread 或未提交审批状态。
- foreground 恢复时进行版本/连接检查和服务端对账。

## 8. 原生壳能力门

只有满足以下至少一项、并有真机证据证明 PWA 不足时，才进入 F010 原生壳阶段：

- 后台常驻语音/音频是核心路径且 Web 生命周期无法满足；
- 需要系统 Share Extension、Widget、Shortcut、深层文件系统或蓝牙能力；
- 需要 App Store/MDM 分发；
- 推送或后台任务的可靠性达不到已批准的产品 SLA；
- 其他明确、不可由标准 Web API 满足的系统集成。

达到能力门后优先评估 Capacitor：原生工程只承载系统桥接、签名与分发，UI 和业务逻辑继续复用 Web。不得因为“更像 App”就复制一套 React Native/Swift UI。

## 9. 分阶段实施

### A0：真机基线与契约冻结

- 在 operator 实际手机上记录当前入口、关键截图/录屏和主要摩擦；
- 建立路由 × 功能 × 设备验收矩阵；
- 统一 breakpoint、safe-area、返回行为和滚动容器契约。

### A1：移动 AppShell 收口

- 完成两级导航、Thread 抽屉、状态 Sheet，以及“对话 / 工作 / 产物”三个 thread 工作表面与全局 Approval Hub；
- 修复软键盘、动态视口、触控热区和内容溢出；
- 保证所有桌面核心功能在手机上可达。

### A2：PWA 安装与 Tailscale HTTPS

- 固化 Tailscale Serve 私网 HTTPS 入口；
- 完成 installability 诊断、安装入口、standalone 状态和图标；
- 验证 API、Socket、上传和下载均走同源安全路径。

### A3：恢复与更新

- 验证后台切前台、断网重连、离线快照、Service Worker 更新；
- 不把完全离线聊天纳入本阶段。

### B/C/D 以后：按既有 F010 路线和能力门驱动

- Phase B 语音、Phase C Web Push/badge 按上级 F010 独立验收，不偷塞进本轮移动 AppShell；
- 后台能力或原生系统集成按独立 feature 验证；
- 只有跨过原生能力门才创建 Capacitor 壳。

## 10. 验收矩阵

### 10.1 设备与显示模式

| 平台 | 浏览器模式 | standalone PWA | 方向 |
|---|---:|---:|---:|
| iPhone Safari | 必测 | 必测 | 竖屏必测、横屏冒烟 |
| Android Chrome | 必测 | 必测 | 竖屏必测、横屏冒烟 |
| 768–1023px 平板 | 必测 | 条件允许则测 | 竖/横屏 |
| >=1024px 桌面 | 回归 | 非重点 | 横屏 |

最低视口覆盖 390×844、430×932、768×1024、1024×768；最终以 operator 真机尺寸补齐。

### 10.2 关键旅程

1. Tailscale HTTPS 首次打开 -> 安装 -> 主屏幕 standalone 再开；
2. 在 raw HTTP、非 secure context、内嵌 WebView 与不支持安装的浏览器中得到准确诊断，且不展示虚假“立即安装”；
3. 查看 Thread 列表 -> 切换项目/thread -> 返回当前对话；
4. 发送文字、附件、长文本，召唤单猫和多猫；
5. 查看执行中状态、工作计划和产物；进入全局审批中心、切换当前 thread 过滤并完成审批；
6. 从统一左侧抽屉进入并返回 Memory / Mission / Signals / Settings；
7. 前后台切换、断网、恢复网络、Socket 重连和快照对账；
8. Service Worker 更新时保留草稿与当前上下文；
9. light/dark、主要主题、长代码块、图片和 rich block 视觉回归；
10. 桌面端现有 AppShell、聊天、工作区与设置无回归。

### 10.3 完成证据

- 自动化：组件行为测试、路由可达性、断点契约、安装状态、重连/快照与桌面回归；
- 浏览器：390/430/768/1024 响应式截图；
- 真机：iPhone 与 Android 关键旅程录屏或验收记录；
- 网络：Tailscale Serve HTTPS、secure context、Service Worker、API/Socket 同源证据；
- 功能：桌面核心功能 -> 手机入口 parity checklist 无缺项。

仅有单测、Lighthouse 分数或“成功安装”都不足以宣布完成。

## 11. 方案比较与否决

| 方案 | 结论 | 理由 |
|---|---|---|
| 响应式 PWA + Tailscale Serve | 推荐 | 复用现有产品和数据，直接解决手机布局与安装问题 |
| 立即加 Capacitor 壳 | 暂缓 | 能复用前端，但当前没有原生能力缺口证据；壳本身不会改善响应式布局 |
| Swift/React Native/Flutter 重写 | 否决 | 形成第二套 UI、状态和测试面，最容易造成手机/桌面功能漂移 |
| 继续直接访问 raw IP/HTTP | 否决为正式路径 | installability、secure context 与长期可维护性不足 |

## 12. Open Questions

### 技术 OQ（猫猫自决）

- breakpoint 单一真相源的具体文件格式与 Tailwind/TypeScript 消费方式；
- Service Worker 更新提示和草稿保护的具体状态机；
- 平板 `medium` 模式允许哪些额外密度，不改变其移动工作表面语义。

这些问题可在一个实现切片内回滚，不升级 operator；由实现计划、设计评审和真机测试决定。

### 价值决策（已批准）

**Decision：批准“PWA 先行，原生壳必须由能力门触发”作为 F010 的长期产品路线。**

- **推荐：批准本方案。** 继续使用同一套 Next.js 产品，通过响应式移动壳、PWA 与 Tailscale Serve 满足当前目标；原生壳只在后台语音、Widget、Share Extension、系统分发等能力门被真机证据触发后进入。
- **备选：PWA 与 Capacitor 同期建设。** 更早获得原生工程与分发入口，但当前没有原生能力缺口证据，会扩大签名、发布、平台桥接和双端验收成本；不推荐。
- **否决：立即原生重写。** 会形成第二套 UI、状态和测试面，不解决当前响应式布局根因。

批准后的含义：F010 已重新进入实施计划，先做 A0 真机基线，再按 A1 -> A2 -> A3 推进。现有安装提示仍只是候选，必须通过本方案的 TDD、浏览器/真机验收和跨猫代码审核后才进入完成口径。

## 13. 审核记录

首轮审核结果：

- terra：`APPROVE`；提出候选 prompt dismiss/诊断、768–1023 断点与全局深链矩阵问题。
- Fable 5：`APPROVE`；要求冻结全局入口 carrier、补 installability 负向旅程、建立 breakpoint 单一真相源。
- Opus 4.5：`REQUEST_CHANGES`；P1 为 Approval Hub 被误写成纯 thread 作用域；P2 为 Push 阶段漂移。

本版已采纳全部 P1/P2：审批改为全局聚合 + 可选 thread filter；全局入口冻结为左侧抽屉；Push 移回 Phase C；补负向安装旅程与 breakpoint 真相源。

最终差异复核：

- terra：`APPROVE`，无新增 P1/P2；
- Fable 5：`APPROVE`，无新增 P1/P2；
- Opus 4.5：`APPROVE`，确认原 P1/P2 全部闭合；
- 三位均明确：批准的是标准方案，不是候选 `PwaInstallPrompt` 代码。

## 14. 证据与 provenance

- 项目路线：[F010 手机端猫猫](../features/F010-mobile-cat.md)
- 全局审批边界：[F246 Approval Hub](../features/F246-approval-hub.md)
- 离线快照语义：[F164 Thread Snapshot Persistence](../features/F164-thread-snapshot-persistence.md)
- 远程安全实现：`packages/api/src/infrastructure/session-auth.ts`、`packages/api/src/infrastructure/websocket/SocketManager.ts`、`packages/api/src/index.ts`
- 当前移动/PWA 实现：`packages/web/src/components/MobileOpsShell.tsx`、`packages/web/src/app/layout.tsx`、`packages/web/next.config.js`、`packages/web/public/manifest.json`
- 讨论与审核 thread：`thread_mrogfco44bos1sgn`；关联远程安全/主机验收 thread：`thread_mrm61dqqot9n7iin`
- 外部一手资料：[Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve)、[WebKit Home Screen Web Apps / Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)、[Capacitor](https://capacitorjs.com/docs)

## 15. 收敛检查（operator 批准后执行）

1. 否决理由 -> ADR？**有**：原生重写与 raw HTTP 正式路径的否决已写入 F010 Key Decisions；若成为跨 feature 长期约束再补 ADR。
2. 踩坑教训 -> public-lessons.md？**待审核**：若确认“可安装不等于移动体验完成”是重复坑，则追加；否则没有。
3. 操作规则 -> 指引文件？**没有**：当前是 F010 产品/架构规则，不修改全局 AGENTS/shared-rules。
