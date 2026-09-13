---
feature_ids: [F317]
related_features: [F056, F172, F190, F232]
topics: [design, atelier, fashion-studio, wireframe, interaction-spec]
doc_kind: design
created: 2026-09-13
author: 烁烁/Siamese (k3)
status: design-gate-pending
---

# 服装设计咖啡馆 ·「缝纫间 Atelier」交互规格与线框 v2

> **上游契约**：[F317 产品规格](../features/F317-atelier-fashion-design-cafe.md)（2026-09-13）：V1 固定 8 个可编辑域；「后背」是视图/可见性状态而非设计点；锁定 = `protectedComponentIds`（有坐标时服务端物化为 mask）；每次编辑默认 1 张主预览，"再出一版"才产候选；版本轨显示最近 5、全部持久化；款式线稿 = Garment DNA → 可追溯 SVG 矢量渲染，禁止独立 image-to-line 生图。

## 1. 信息架构（在地原则：Inset Paper 三层模型）

缝纫间遵循 console-design-system 的 L1→L2→L3 模型，不自创页面骨架：

```
Activity Rail (L1, 既有) → 缝纫间页面基底 (L2, --console-panel-bg)
  → 三栏内容纸张 (L3, --console-shell-bg + rounded-xl + 极轻阴影)
```

| 栏 | 名称 | 角色 | 层 |
|---|------|------|---|
| 左 | 设计域清单 (Domain Rail) | 8 域状态总览 + 选中入口 | L3 内分区，靠背景色差 |
| 中 | 人台画布 (Canvas) | 服装图 + 珠针热点 + 对比模式 + 底部编辑抽屉 | L3 主区 |
| 右 | 试样架 (Version Rail) | 版本卡 + 采用/回退/再出一版 | L3 内分区 |

产物出口：所有预览图/线稿走 **F172 publication contract**（`/uploads/...` 稳定 URL），归档视图复用 **F232 Thread Artifacts Panel**，缝纫间不自建产物库 UI。

## 2. 设计域模型（8 域固定 taxonomy）

| # | 域 (domainId) | 典型属性 | 实例性 |
|---|---------------|---------|--------|
| 1 | silhouette 廓形 | 廓形分类、松量 | 单实例 |
| 2 | collar 领/帽 | 领型、驳头宽、帽型 | 单实例 |
| 3 | sleeve 肩/袖 | 袖型、袖长、肩型 | 单实例（左右对称默认） |
| 4 | body-panel 大身分割 | 公主线/刀背缝/育克 | 多实例 |
| 5 | closure 门襟/闭合 | 开合方式、扣位（扣子=属性） | 单实例 |
| 6 | pocket 口袋 | 袋型、位置 | 多实例（左/右/胸袋） |
| 7 | hem 下摆 | 摆型、长度、开衩 | 单实例 |
| 8 | fabric 面料/色彩 | 材质、色彩、肌理 | 单实例 |

- 按钮、压线、明缉等工艺细节 = 所属域的属性，不独立成域。
- AI 动态识别结果只填属性与实例，不新增域。

### 2.1 域状态机（确认 × 可见性 × 证据来源，三轴分离）

Design Gate P1 收口：**`visibilityByView` 与 `evidenceOrigin` 是两个独立轴，不得混为一个状态**。照片可见性只描述「图里看不看得到」；证据来源只描述「结论从哪来」。文字补充永远不改变照片的可见性。

```
轴 A · confirmation:   unconfirmed (◐)  →  confirmed (✓，绑定采用版本/用户输入)
轴 B · visibilityByView:  per-view { visible | not-visible }（只由照片事实决定）
轴 C · evidenceOrigin:   photo（照片可见） | user-specified（用户文字/参考图指定）

组合示例：
  ✓ + visible + photo            → 常规确认（照片证据）
  ✓ + not-visible + user-specified → 「照片不可见 / 用户指定」——合法确认态，
                                     但 UI 必须永远携带来源标注，不得渲染成
                                     与 photo 确认相同的视觉权重
  ◐ + not-visible                → 确认框 disabled（可见但不可点 + tooltip）
```

**硬约束**：
1. `not-visible + unconfirmed` 态确认框 disabled（不是隐藏）。
2. `user-specified` 确认的域在清单、线稿 hover、导出图上**永远**显示「用户指定（照片不可见）」来源角标——不许随着时间推移「洗白」成照片证据。
3. 补充背面照片后轴 B 才翻转为 visible（新证据是照片，evidenceOrigin 可升级为 photo）。

### 2.2 后背/多视图处理

- 画布顶部有视图切换（正面 / 背面 / 侧面），来源 = 用户上传的多张图。
- 未上传背视图时：背视图 tab 存在但为虚线空态（"补一张背面图"），**域清单不因此新增「后背」项**——每个域有 `visibilityByView` 属性，背视图缺失时相关域在背视图下自动显示 ⸺ 态。
- 这从 UI 层面消灭"单张正面图伪造背面结构"的可能。

## 3. 编辑流程状态机（核心循环）

```
idle
 └─ 点击域清单项/珠针热点 → domain-selected
      │  · 该域解锁（抬爪），其余 7 域写入 protectedComponentIds
      │  · 底部编辑抽屉滑出（translateY 8px→0, 200ms）
      ▼
editing（文字描述 ✎ / 参考部件图 🖼 / 两者叠加）
 └─ [生成替换预览] → generating
      │  · Steam & Brew 诚实进度（已用时长 + 第 N 次尝试）
      │  · 画布保护区覆盖半透明爪印遮罩（视觉承诺）
      ▼
preview-ready
      │  · 主预览落版本轨（不覆盖画布）
      │  · 若后端标记保护区非预期变化 → 版本卡挂 drift 警告徽标
      ├─ [采用]      → confirmed（写入 Garment DNA，版本指针推进）
      ├─ [再出一版]  → generating（同一编辑补丁下追加候选）
      ├─ [修改描述]  → editing（保留当前预览作对比基准）
      └─ [丢弃]      → domain-selected（预览入轨但标记 discarded）
```

**对比模式**：点击版本轨任意版本 → 画布进入卷帘对比（当前胚样 ⇄ 选中版本），再点退出。窄屏（<1200px）降级为上下堆叠。

**回退**：版本卡 [回退] = 画布与该域 DNA 回到该版本；当前版本不删除，降级入轨。回退等价于一次"采用旧版本"，同样写 DNA 审计记录。

**并发与冲突（Design Gate P2 收口）**：生成中允许选中其他域编辑本地草稿（抽屉可切换，草稿暂存本地），但**服务端请求串行**。每次生成/采用请求携带 `baseVersionId`；服务端检测到 base 已过期时返回 409，UI 弹出冲突解决条："你基于 v3 编辑，但胚样已到 v5"——选项：[基于 v5 重新生成]（保留草稿描述）/ [查看 v3→v5 差异] / [放弃草稿]。绝不静默覆盖。

**drift 阻断（F317 KD-5）**：预览返回携带 `protectedDriftPartIds`。非空时版本卡显示警示条"保护区出现非预期变化"，点击展开前后差异区高亮；[采用] 必须 disabled，服务端同样返回 `409 protected_drift`。用户只能保留原意重试，或把希望保留的变化显式写成一个新的编辑 proposal。**旧候选不能通过勾选直接越过保护门，UI 也不把模型的"尽量不动"呈现为保证。**

**采用的确认范围（Design Gate P1 收口）**：
- [采用] 只确认**目标域**这一个域的 DNA；其余 7 个保护域的确认状态一个字节都不动。
- 若预览的 `affectedPartIds` 超出目标域，候选进入 drift 阻断态，不能直接采用。界面列出受影响部位，并提供 [按原意重试] / [建立新编辑意图]；后者把用户认可的变化写进新的 proposal 后重新生成，不修改旧候选。
- 任何路径下，保护域**不存在**"顺带被确认"或通过勾选绕过保护门的代码路径。

## 4. 线框 v2

```
┌────────────────────────────────────────────────────────────────┐
│ 缝纫间 · 胚样 #3        视图:[正面|背面⸺|侧面⸺]   [生成款式线稿 6/8]│
├───────────┬────────────────────────────────────┬───────────────┤
│ 设计域     │            人台画布                 │  试样架        │
│           │  ┌──────────────────────────┐      │ ┌───────────┐ │
│ 1 廓形  ✓ │  │                          │      │ │v3 主预览   │ │
│ 2 领/帽 ✓ │  │    服装图                 │      │ │当前·已采用 │ │
│ 3 肩/袖 ◐ │  │    珠针 ① ② ⑥a ⑥b        │      │ └───────────┘ │
│ 4 分割  ◐ │  │    （选中域外接框高亮）    │      │ ┌───────────┐ │
│ 5 门襟  ✓ │  │                          │      │ │v2 ⚠drift  │ │
│ 6 口袋  ✓ │  │  [卷帘对比 ⇄]             │      │ │可回退      │ │
│ 7 下摆  ○ │  └──────────────────────────┘      │ └───────────┘ │
│ 8 面料  ⸺ │  ┌─ 选中: 肩/袖 ────────────────┐  │ ┌───────────┐ │
│ (背视缺失) │  │ ✎ 描述: [_______________]   │  │ │v1 初始图   │ │
│           │  │ 🖼 参考图: [拖入/粘贴]        │  │ └───────────┘ │
│ 🐾=已保护  │  │ [生成替换预览]  已保护 🐾×7  │  │ 显示最近5版  │
│ ✓6 ◐1 ○1  │  └─────────────────────────────┘  │ 全部→产物库  │
└───────────┴────────────────────────────────────┴───────────────┘
```

说明：
- 底部计数 `✓6 ◐1 ○1` 是确认计量环的清单内形态；顶栏 `6/8` 是其全局形态。

### 4.1 线稿出口分级（Design Gate P1 收口：名称即契约）

「准确线稿」和「讨论示意」是**两个不同的交付物**，不许共用名称与出口：

| | 讨论示意草图 | 技术款式线稿 |
|---|---|---|
| 解锁条件 | 任意时刻 | **目标输出视图的全部必需域已 confirmed**（如正面图：正面可见 8 域全 ✓） |
| 顶栏按钮 | [导出示意草图]（次级按钮） | [生成款式线稿]（主按钮，未达标时 disabled + tooltip 列出缺口域） |
| 图面 | 未确认域虚线 + 全域「示意」水印 | 全部为准确结构线；`user-specified` 部位仍带来源角标 |
| 导出 | 仅 PNG，文件名含 `-discussion-sketch` | SVG（主）+ PNG，F172 发布链归档，artifact type=`technical-flat` |
| 命名 | 「讨论示意」四字出现在按钮、图纸标题、文件名三处 | 不带任何"示意"字样 |

未确认域 = 虚线示意只存在于讨论草图；技术线稿里**不存在**未确认部位的线条（宁缺毋假，opus 契约）。

## 5. 款式线稿视图（ConfirmedSnapshot → SVG 溯源）

**冻结快照是唯一事实源（Design Gate P1 收口）**：`adoptedVersion` 是可变指针——版本可继续演进、可回退、可被新采用覆盖，用它做溯源等于让图纸的“准确性证明”随后续编辑悄悄漂移。因此技术线稿**只**从冻结快照渲染：

```
用户点击 [生成款式线稿]（目标视图全域 confirmed）
  → 系统冻结当前已确认结构为 ConfirmedSnapshot：
      { snapshotId, snapshotHash, createdAt,
        items: [{ componentId, partHash, sourceVersionId, evidenceOrigin }] }
  → SVG 仅由该 snapshot 渲染；snapshot 不可变
  → 之后胚样继续编辑/采用，不影响已生成的图纸产物
  → 想反映新确认 = 显式再冻结一个新 snapshot（新 id/新 hash），图纸版本链可追溯
```

- **顶层产物标注**：图纸标题区常显 `confirmedSnapshotId` + 短哈希（如 `snap_a7f3c2 · #9c41`），导出文件名与 F172 artifact 元数据同样携带。
- **每条结构线携带四元组**：`componentId + partHash + sourceVersionId + evidenceOrigin`：
  - hover 结构线 → 左栏对应域芯片同步点亮，tooltip 如实显示来源：
    - 「门襟/闭合 · 双排扣 · `closure` `#3f9a` · src v3 · 照片确认 ✓」
    - 「面料/色彩 · 羊毛混纺 · `fabric` `#e17b` · src 文字输入 · 用户指定（照片不可见）」
  - `sourceVersionId`（该部位冻结时指向的版本）是四元组一员；`adoptedVersion` 仅作辅助阅读文案，**不得**替代快照来源出现在溯源字段位。
  - 未确认/不可见部位 → 不绘制该部位结构线（宁缺毋假，见 §4.1 出口分级）。
- **快照后变更提示**：snapshot 生成后若任何域发生新确认/新采用，图纸模式顶条显示「快照 `snap_a7f3c2` 之后胚样有新确认 — [基于最新确认冻结新快照]」，旧图纸不被静默更新。
- **双坐标系**：照片画布与线稿图纸是两个独立坐标系，各自保留缩放/平移状态（切换模式不互相覆盖视口）。
- 导出：SVG（主）+ PNG（F172 发布链入产物库），仅「技术款式线稿」可用本出口（§4.1）。

## 6. 图标映射（inline SVG，概念稿 emoji → 现有图标体系）

| 概念稿 | 实现 | 备注 |
|--------|------|------|
| 🐾 锁定/保护 | `PawIcon.tsx`（既有） | 保护区遮罩用同款 24% 透明度平铺 |
| ✎ 文字描述 | 新 `EditPenIcon`（待补，遵循 icons/ 现有 stroke 风格） | 候选：复用 VoteIcons 笔形 |
| 🖼 参考图 | `AttachIcon.tsx`（既有） | 拖拽区虚线边框用 `--console-border-soft` |
| ☕ 生成中 | `LoadingIcon.tsx` 蒸汽变体 | Steam & Brew 隐喻落在 loading 态，不加新动画库 |
| ⚠ drift | `GovernanceShieldIcon.tsx` 警示态配色 | 语义贴合"保护区治理" |
| ✓/◐/⸺ 域状态 | 新 `DomainStatusIcon`（三态一组） | 纯几何形，克制 |
| ⇄ 对比 | 新 `CompareIcon` | 与 EvidenceIcons 风格对齐 |

新增图标原则：stroke 宽度、圆角与 `packages/web/src/components/icons/` 现有件一致；进 icons/ 目录而非散落组件内。

## 7. Token 落位表

| 区域 | 背景 | 边框 | 其他 |
|------|------|------|------|
| 页面基底 L2 | `--console-panel-bg` | 无（色差分层） | — |
| 三栏内容纸 L3 | `--console-shell-bg` | 无 | `rounded-xl` + 极轻阴影 |
| 域清单项 | 默认透明 / hover `--console-hover-bg` / 选中 `--console-active-bg` | 项间 `border-b --console-border-soft` | 圆角 8px |
| 版本卡 | `--console-card-bg` | drift 卡加 `--console-border-strong` 警示 | 圆角 10px |
| 编辑抽屉 | `--console-card-bg` | 无（与画布色差） | 入场 translateY(8px)→0, 200ms |
| 输入框 | `--console-code-bg` | `--console-border-soft` | 圆角 8px |
| 珠针热点 | 单一强调色（F056 soft-blue 族） | — | 数字徽标 `rounded-full` |
| 不可见态 | 文本/图标降透明度 + 虚线 | 虚线 `--console-border-soft` | 不用灰色硬编码（ESLint cafe gate） |

禁项自查：`bg-white` / `bg-gray-*` / 无 token 边框 / 硬编码 hex —— 全部规避（F056 Phase A-0 ESLint 门禁）。

## 8. 未决项（留给 Design Gate / 实现契约）

1. **珠针坐标来源**：V0 若后端无 bounding box，画布退化为「选中域外接框由结构数据驱动」，珠针编号仅存在清单侧。坐标到位后热点零成本升级。
2. **多实例域的选中路径**（口袋左/右）：清单项展开子实例行，还是珠针直达？我倾向珠针直达 + 清单二级行，Gate 时定。
3. ~~生成中并发~~（已定：本地草稿可编辑，请求串行 + `baseVersionId` 冲突检测，见 §3）。
4. ~~图纸模式坐标系~~（已定：双坐标系各自保留缩放/平移，见 §5）。

## 9. 异常与边界状态矩阵（Design Gate P2 收口）

| 状态 | UI 表达 | 可恢复路径 |
|------|---------|-----------|
| 空态（未上传） | 画布区大号拖拽虚线框 + 「拖入一张服装照片开始」+ 支持正/背/侧多图槽位 | 上传即进拆解中 |
| 拆解部分失败 | 清单对应域显示「识别失败」徽标（不占三态），其余域正常可用 | 单域重试按钮；失败域允许纯手动 `user-specified` 路径 |
| 生成失败 | 版本轨不出现新版本；编辑抽屉内嵌错误条（原因 + 已用时长），不打断草稿 | [重试] 保留全部输入；连续失败 2 次建议换描述/参考图 |
| revision 过期 | 409 冲突解决条（见 §3 并发与冲突） | 三选一：重生成/看差异/放弃草稿 |
| 无权限（他人胚样只读） | 全域只读：编辑抽屉不出现，版本卡仅[查看]；顶栏显示「只读 · 所有者可授权」 | 申请授权入口（消息所有者） |
| 窄屏 <1200px | 右栏试样架折叠为底部抽屉；卷帘对比降级上下堆叠；域清单折叠为顶部横向 chip 条 | 布局自适应，无功能缺失 |
| 生成中 | Steam & Brew 进度 + 保护区爪印遮罩；可切域编辑草稿（不发请求） | 见 §3 |

## 10. 视觉门禁产物（Design Gate P2，2026-09-13）

**交付物**（本目录 `docs/design/atelier/`）：

| 文件 | 内容 |
|------|------|
| `hub-current.png` | 现有 Hub 实测截图（localhost:4310 headless Chrome，1600×1000） |
| `mock-1-upload.html/.png` | 屏一：上传空态（拖拽区 + 正/背/侧槽位 + 诚实约定） |
| `mock-2-edit-drift.html/.png` | 屏二：编辑预览（8 域清单 + 珠针 + 编辑抽屉 + drift 警告版本卡） |
| `mock-3-blueprint.html/.png` | 屏三：技术线稿图纸模式（hover 溯源 tooltip + 溯源面板 + 8/8 出口） |
| `compare-hub-vs-atelier.png` | 并排对照：现有 Hub ⇄ 缝纫间（风格一致性证据） |
| `atelier-mock.css` | 视觉稿样式，token 值 1:1 取自 `theme-tokens.css` light 主题 |

**风格一致性自检**（pencil-design skill Step 3 门禁）：
- ✅ 配色：surface 四档 / accent oklch(0.55 0.14 50) / border / text 全部复用真实 token，无新色
- ✅ 布局语言：L1 Rail → L2 基底 → L3 纸张 Inset Paper 模型，与 Hub 一致
- ✅ 圆角/间距：12/10/8/6 阶梯 + 4/8/12/16 间距阶梯
- ✅ 不会「换了个产品」：并排截图对照通过（见 compare 图）

**Pencil .pen 偏差说明（Push Back：证据 + 替代方案）**：
- 证据：Pencil 是 Antigravity IDE 扩展，其 MCP 工具（`batch_design` 等）不在我当前 runtime（kimi-cli/k3）的工具面内，无法产出 .pen；且 skill 规则明确 .pen 落盘必须由 operator 手动 Cmd+S。
- 替代方案：本轮以「真实 token HTML 高保真视觉稿 + 实测截图 + 并排对照」承担视觉门禁职能——它比 .pen 更贴近最终实现（token 值直接来自生产 CSS，非手绘近似）。
- 若 Gate 仍要求 .pen 存档：本视觉稿可直接作为 Antigravity runtime 猫（Bengal 家族）转绘 .pen 的输入，或由我在 Antigravity 上下文补绘；不阻塞本轮 Gate 收敛。
- Activity Rail 新入口（L1 变更）随本包一并提交 co-creator 一次确认。
