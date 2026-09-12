# AI Employee OS — Visual Evolution Phase 1 调整方案（V0.5 样品）

> **性质**：**仅设计方案，不编码。** 本文基于 `UI_RESEARCH_DESKTOP_OS_REFERENCES.md`（三源 OS Shell 研究）+ `UI_INSPIRATION_LOCK.md`（七源产品工艺）对 Phase 1 做方向性调整。
> **核心诊断**：功能结构已接近产品，但**视觉范式仍偏 Web Dashboard** —— 三栏 grid + 卡片网格 + 边框分层，这是"网页"，不是"操作系统级空间界面"。
> **本轮目标**：把范式从 **Web Dashboard** 迁移到 **OS 级空间界面**，产出 **V0.5 样品**。
> **语言定位（总纲）**：**不是做 macOS clone**。目标是形成 AI Employee OS 自己的语言 = **Apple 克制 + Spatial 空间 + Agent 前瞻**（详见 `UI_INSPIRATION_LOCK.md` §0）。OS Shell 范式借鉴其"系统感 / 材质纪律 / 空间深度"，但员工是主角、Shell 是其舞台，而非像素级复刻 macOS。
> **前置**：P4-2 Hotfix 已收口（`17b4a5b`，四角布局 + 重叠断言）；本方案在此基础上演进，**不得回退 hotfix 成果**。

---

## 0. 总纲原则：不做 macOS Clone，做 AI Employee OS 自有语言

> 本节锁定差异化边界，所有 A–E 设计不得越过。

- **三根支柱**（详见 `UI_INSPIRATION_LOCK.md` §0）：
  1. **Apple 克制** — 深度靠玻璃/光/阴影，不靠边框；motion 短促物理不循环；密度高但安静（Linear calm density）。
  2. **Spatial 空间** — 知识与工作有空间深度（z 轴、相机、区域、流向），不是平面网格（tldraw / React Flow）。
  3. **Agent 前瞻** — 系统是「与 AI 员工协作」，员工是主角、Shell 是其舞台（Raycast + 自身隐喻）。
- **差异化红线**：不抄 macOS 红绿灯窗口控件；不做访达式文件管理器；不逐像素复制菜单栏；Dock 不系统级常驻（Phase 1 仅首页浮动）。
- **与三源 OS Shell 研究的关系**：react-ui-os / macos-react / StreamDeck 给出的是 OS Shell **范式形状**（Dock/Inspector/App Icon/Glass），本方案借鉴其形状与材质纪律，但语言归属 AI Employee OS，不归属 macOS 皮肤。

## 1. 与原 Phase 1 的差异

| 项 | 原计划（Design Review 后） | 本轮调整 |
|---|---|---|
| 范围 | R2 首页 / R6 Command Center / R3 Employee Card | A/B/C + **E 全局视觉语言**（地基先行）；**D 知识空间延后 Phase 2**（本轮只做空间化视觉预留） |
| 首页 | "首页视觉语言" | 明确为 **AI Employee Presence 首页**（不是更好看的 Dashboard） |
| Command Center | "右侧功能区域" | 明确为 **macOS Inspector / Control Center**（不是 sidebar） |
| Employee Card | "统一员工卡" | 明确为 **系统级 App Icon + Character AI**（不是列表项） |
| 视觉语言 | 未独立立项 | **独立为 E 段并作为地基先行**（Glass / Floating Panel / Depth / Blur / Motion） |
| 依据 | 设计直觉 | 三源外部研究（react-ui-os / macos-react / StreamDeck Liquid Glass） |

---

## 2. 范式迁移地图（一图看懂）

```
  现在：Web Dashboard                     目标：Desktop OS (V0.5)
┌────┬────────────────┬──────┐        ┌────────────────────────────┐
│ Sidebar            │Insight│        │ TopBar（系统级 28–44px）   │
│ (静态导航)          │(侧栏) │        ├────────────────────────────┤
├────┼────────────────┼──────┤   →    │                            │
│    │  Canvas        │      │        │   Presence 首页 / 工作区    │
│    │  (flat)        │      │        │   （空间化、有深度）        │
│    │                │      │        │                            │
└────┴────────────────┴──────┘        │      ╭──────────────╮      │
 三栏 grid · 边框分层 · 卡片网格         │      │ Employee Dock │      │
                                       │      ╰──────────────╯      │
                                       ├──────────────┬─────────────┤
                                       │  工作区       │ Inspector   │
                                       │              │ (玻璃分节)   │
                                       └──────────────┴─────────────┘
                                        玻璃材质 · 阴影分层 · 焦点模型
```

**迁移三原则**：
1. **先结构，后材质** —— 只加玻璃不改结构 = 「好看的 Dashboard」。结构必须先变（Shell / Dock / Inspector）。
2. **材质承担装饰** —— 层级由玻璃 + 光 + 阴影表达，**减少边框与浅灰填充**（研究源 A 明确 North Star）。
3. **系统级一致性** —— 员工是"应用"，一处注册多处点亮（Employee Registry 思想）。

---

## 3. A — 首页：Dashboard → **AI Employee Presence 首页**

### 3.1 现状问题
- `.wd` 是**居中卡片网格**（`wd-card` + `wd-next`），本质是 landing page / dashboard 构图。
- 员工（Nox 等）在首页里只是"下一步建议"里的一个头像，**不是主角**。
- 首屏信息密度平均分配：品牌、卡片、CTA 各占一块，缺少**视觉主次**。

### 3.2 目标形态
**主角是一个 AI Employee 的 Presence（在场感）**，而非一组卡片。

```
┌────────────────────────────────────────────────────────────────┐
│ 🐾 AI Employee OS        Nox · 知识整理中            ⚙  🔍  🌐 │ ← TopBar（系统级）
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│                      ╭──────────────────╮                       │
│                      │                  │                       │
│                      │    🐈‍⬛  (avatar)  │  ← Presence 主体       │
│                      │                  │     96–160px 母版裁切  │
│                      ╰──────────────────╯                       │
│                                                                 │
│                    Nox · Research Agent                         │
│                    ● 工作中 · Lv.3 · 知识整理中                   │
│                                                                 │
│              「正在整理 3 份产品资料，已生成 2 条洞察」             │
│                                                                 │
│              [ 继续上次任务 ]   [ 派发新任务 ]                    │
│                                                                 │
│                                                                 │
│            ╭──────╮ ╭──────╮ ╭──────╮ ╭──────╮                  │
│            │  🐕  │ │  🐱  │ │ 🐈‍⬛* │ │  🐕  │  ← Employee Dock  │
│            ╰──────╯ ╰──────╯ ╰──────╯ ╰──────╯     浮动·玻璃·放大│
│             田园犬   布偶猫    Nox     边牧                       │
└────────────────────────────────────────────────────────────────┘
```

### 3.3 规格
| 元素 | 规格 |
|---|---|
| Presence 主体 | mascot **母版资产裁切**（禁止重新生成），96px（默认）/160px（首页主视觉）。带柔和投影 + 极轻 hover 微动（scale ≤1.06，允许轻微过冲曲线 —— 研究 §4.3 裁决） |
| 员工身份行 | 名称 + 角色（Research Agent / Knowledge / Coding…），i18n 双语文案 |
| 状态行 | 5 态指示点（工作中/待命/学习中/离线/异常）+ 等级 + 当前动作短语 |
| 当前任务摘要 | 一句话（来自 store），**不是卡片网格** |
| 主 CTA | 仅 2 个（继续任务 / 派发新任务），避免 button soup |
| Employee Dock | 浮动玻璃 dock，居中底部；当前员工有**指示点**；hover 放大（scale 1.06，140ms） |
| 背景 | 保留/演进现有渐变墙纸；可选极低幅视差（≤20px，rAF，`prefers-reduced-motion` 下关闭） |

### 3.4 明确不做
- ❌ 不做完整 Spotlight（留 Phase 2，本轮仅预留 TopBar 搜索入口）
- ❌ 不改 mock 数据逻辑 / 不改 demo sequencer
- ❌ 不改 i18n 结构（仅新增文案 key，zh/en 必须 1:1）

---

## 4. B — 右侧 Command Center：Sidebar → **macOS Inspector / Control Center**

### 4.1 现状问题
- `.insight` 是**内容型侧栏**：洞察文本 + 建议按钮 + 记忆列表 + Provider 状态，本质是"信息流"而非"检视器"。
- 缺少 **Inspector 的三个特征**：① 分节（可折叠）② label→value 值展示 ③ **随工作区上下文变化**。
- 视觉上用重 border + 面板填充分层，偏网页。

### 4.2 目标形态
```
┌─ Inspector ────────────────────┐
│ ┌───────────────────────────┐  │
│ │ 🐈‍⬛  Nox          ● 工作中 │  │ ← ① Presence（复用 C 的卡）
│ │ Research Agent · Lv.3      │  │
│ └───────────────────────────┘  │
│                                │
│ ▾ 当前任务                      │ ← ② 可折叠 Section
│   整理 3 份产品资料             │
│   进度            ●●●○○○  62%  │   label → value
│                                │
│ ▸ 上下文动作                    │ ← 随工作区变化
│   [ 深入分析 ]  [ 生成摘要 ]    │
│                                │
│ ▸ 记忆                    3 条  │ ← 带计数徽标
│ ▸ 能力成长                      │
│                                │
│ ─────────────────────────────  │ hairline 分隔（0.5px）
│ ⚙ 设置    🧠 记忆    🏪 市场    │ ← ③ 系统入口（底部固定）
└────────────────────────────────┘
   玻璃材质 · hairline · 无重边框
```

### 4.3 规格
| 要素 | 规格 |
|---|---|
| 材质 | 玻璃层（见 §7 `--aios-glass-*`）；**用 hairline 0.5px 分隔替代 1px 实色边框** |
| 分节 | 可折叠 Section（项目已有 `DisclosureRow` 基础件），标题行右对齐 value/徽标 |
| Presence 区 | 顶部固定，复用 §5 的 Employee Card（**B 与 C 共用同一组件规格**） |
| 上下文动作 | 随 mode（space/growth/…）切换的动作集 —— 落实 R6「不再散落为画布覆盖按钮」（hotfix 已把覆盖按钮收拢到四角，本步迁入 Inspector） |
| 系统入口 | 底部固定一行（设置/记忆/市场），与 TopBar 状态簇职责分离 |
| 宽度 | 维持 320px（≤1040px 为 280px），不新增断点 |
| 焦点态 | 聚焦时顶边 accent 高光线（研究源 A 的窗口配方） |

### 4.4 明确不做
- ❌ 不做可拖拽/最小化（属 Window Manager，待决 D3）
- ❌ 不移动 `.insight` 的 grid 位置（仍是第 3 列 —— 结构改动留 Phase 2）
- ❌ 不重写 AI 洞察逻辑

---

## 5. C — Employee Card：列表项 → **系统级 App Icon + Character AI**

### 5.1 设计定位
研究源 A 的 Dock Tile 配方给出了直接答案：
> "Dock tile: squircle; background linear-gradient(accent → 同 accent 低 alpha); Indicator dot below the tile when the app is open; **iconArt 是 app 在 dock 里获得视觉身份的方式**。"

**AI Employee 的 iconArt = mascot 母版资产裁切**（既有 IP 规则：母版是唯一视觉来源，禁 ImageGen 重生成）。

### 5.2 App Icon 规格（系统级）

| 尺寸档 | 用途 | 规格 |
|---|---|---|
| 160px | 首页 Presence 主视觉 | 母版上半裁切（角色区），透明底，柔和投影 |
| 96px | Employee Card / Dock 大档 | squircle tile + accent 垂直渐变 + iconArt 居中 |
| 64px | Dock 常规 / 卡片头部 | 同上 |
| 40px | 气泡 / 任务行 | 同上（渐变可弱化） |
| 32px | TopBar / 列表 | 纯 iconArt，无 tile 渐变 |

- **Squircle 圆角**：tile 半径 ≈ 边长 22%（96px → ~21px），非纯圆角矩形。
- **accent 渐变**：员工主色从上到下、顶部实 / 底部低 alpha（研究源 A 配方）。
  - 田园犬 `#F5A623` · 布偶猫 `#A8C8EC` · 黑猫 `#1A1A1A` · 边牧 `#FFF`/`#1A1A1A`（沿用既有主色）
- **指示点**：tile 下方（聚焦亮 / 非聚焦暗），映射 5 态（项目已有 `EmployeeStatusDot` 薄层负责 5 态 → 4 态 StateDot 的映射）。

### 5.3 Character AI 层（人格，非装饰）
在 App Icon 之外，卡需要表达"这是一个在工作的角色"：

| 元素 | 说明 |
|---|---|
| 状态短语 | "正在整理 3 份产品资料…"（拟人，非 "Processing"） |
| 等级 / 成长 | Lv.3 + 进度环（accent 描边） |
| 能力标签 | Research / Knowledge / Coding…（pill，沿用现有 `Pill`） |
| 微动效 | 呼吸/眨眼（仅 mascot 图像层，允许循环 —— 角色资产特性）；系统控件仍禁止循环动画 |

### 5.4 明确不做
- ❌ **不重新生成 mascot 图像**（母版资产规则，红线）
- ❌ 不新增员工角色（仍为四角色 MVP）

---

## 6. D — Knowledge Space：Canvas → **Spatial Knowledge Workspace**

### 6.1 现状问题
- `CanvasViewport` 是**平面节点图**（`.knode` + 连线），视觉上是"关系图/Diagram"。
- 层级信息弱：所有节点同一平面，靠缩放区分。
- 与「知识生命系统」（资料 → AI 理解 → 洞察 → 成长）的叙事不匹配。

### 6.2 目标形态（空间化）
引入**空间维度**而非改变数据：

- **深度（z）**：近处节点清晰、稍大；远处节点**景深模糊 + 降饱和**（用 blur 表达距离，与全局 Blur token 同源）。
- **生命周期流向**：知识沿「资料 → 理解 → 洞察 → 成长」在空间中有**方向性分布**（左→右 或 内→外），取代纯拓扑布局。
- **区域感**：知识簇形成"星系/区域"，区域间有空间留白与层次（现有 `GalaxyCanvas` 是雏形，可作为成长视图基础）。
- **AI 轨迹可视化**：Nox 的工作路径以光带/轨迹线呈现（现有 `lptrack` 已是雏形）。

### 6.3 Phase 1 范围（克制）
- ✅ 只做**视觉语言层**：深度模糊、分区、流向的**视觉表达**。
- ✅ 复用现有 `GalaxyCanvas` / `lptrack` 等雏形。
- ❌ **不改节点数据模型、不改布局算法、不改交互逻辑**（拖/连/选中保持）。
- ❌ 不做 3D / WebGL（性能与依赖风险）。
- ⚠️ **D 是否进 Phase 1 属待决（D6）** —— 若范围过大则留 Phase 2，Phase 1 只做 A/B/C/E。

---

## 7. E — 全局视觉语言（**地基，实施时先行**）

> 本节是 A/B/C/D 的共同依赖。**先立 token，再改组件**（研究源 A：「差异应属于 token，而非 `if (theme)` 分支」）。

### 7.1 Glass Layer

| Token | Light | Dark | 说明 |
|---|---|---|---|
| `--aios-glass-fill` | `rgba(255,255,255,0.12)` | `rgba(30,30,30,0.55)` | 暗色下**更不透明**（研究源 C），否则玻璃"消失" |
| `--aios-glass-fill-strong` | `rgba(255,255,255,0.72)` | `rgba(28,28,28,0.72)` | 菜单栏 / 高频面板 |
| `--aios-glass-hairline` | `rgba(255,255,255,0.25)` | `rgba(255,255,255,0.12)` | **0.5px** 亚像素描边（关键质感） |
| `--aios-glass-hairline-w` | `0.5px` | `0.5px` | 边框宽度单独 token |

**应用面**（白名单，避免玻璃滥用）：TopBar、Dock、Inspector、浮动面板、Spotlight（未来）。画布内节点**不用玻璃**。

### 7.2 Blur（分档，可整体降级）

| Token | 值 | 用途 |
|---|---|---|
| `--aios-blur-none` | `none` | 降级档 / `prefers-reduced-motion` 可选 |
| `--aios-blur-soft` | `blur(20px) saturate(160%)` | **性能档**（研究源 A 默认） |
| `--aios-blur-regular` | `blur(40px) saturate(180%)` | **视觉目标档**（研究源 C / Tahoe） |

> 默认档位属待决（D5）。建议：Electron 桌面默认 `regular`，提供 `soft` 自动降级开关。

### 7.3 Depth（阴影分层，替代边框分层）

| Token | Light | Dark |
|---|---|---|
| `--aios-depth-1`（休息面板） | `0 8px 32px rgba(0,0,0,0.18)` | `0 8px 32px rgba(0,0,0,0.45)` |
| `--aios-depth-2`（浮动面板） | 同向加强（更大 spread/blur） | 同 |
| `--aios-depth-3`（模态/Spotlight） | 最强 | 最强 |
| `--aios-depth-focus` | accent 高光/环（聚焦态） | 同 |

**规则**：层级优先用**阴影 + 玻璃**表达；现有 `border` 仅保留 hairline。

### 7.4 Floating Panel

| Token | 值 | 说明 |
|---|---|---|
| `--aios-radius-window` | 16px | 窗口/大面板 |
| `--aios-radius-panel` | 14px | 与现有 `radius-card`(14) 对齐，避免二次漂移 |
| `--aios-radius-tile` | ~22% 边长（squircle） | Employee tile |
| `--aios-radius-small` | pill | 沿用 `--radius-pill` |

**z-index 标度**（**不得破坏 hotfix 四角布局**）：

```
canvas 内容        0
浮动画布控件       60–75   (hotfix 既有：toolbar 70 / canvas-actions 75 / readout 60)
Inspector(停靠)    —       (grid 列，不参与 z 竞争)
浮动面板          80
Dock              90
Spotlight         200
Toast / 通知      300
拖拽中            400
```

> ⚠️ 现有 `.modeswitch` 为 90；若引入 Dock，需重新编排，Dock 与 ModeSwitch **不得同层共存于同一区域**（hotfix 的几何断言会捕获）。

### 7.5 Motion

| Token | 值 | 用途 |
|---|---|---|
| `--aios-motion-fast` | 140ms ease | hover / dock 放大（scale ≤1.06, translateY -3px） |
| `--aios-motion-base` | 180ms ease-out | 面板开合（translateY 6px + scale 0.985→1） |
| `--aios-motion-slow` | 280ms `cubic-bezier(0.4,0,0.2,1)` | 大位移/最小化类 |
| `--aios-motion-overshoot` | `cubic-bezier(0.34,1.56,0.64,1)` | **仅 mascot / Employee 图标**（人格化），scale ≤1.06 |
| `--aios-motion-reduced` | `0.01ms` / `none` | reduced-motion 覆盖 |

**硬规则**：
1. 系统控件动画 **≤300ms 且禁止循环**（研究源 A）。
2. 循环动画**只允许** mascot 呼吸/眨眼（角色资产）。
3. `prefers-reduced-motion: reduce` 下：关闭视差、位移、缩放；玻璃**可保留**（非运动），但取消所有 transform 过渡 —— 沿用并扩展现有 `app.css` reduced-motion 守卫。

### 7.6 性能与降级（必须实现）
- **活跃玻璃层 ≤3**（每层 `backdrop-filter` 都是全屏合成；Electron/集显下代价高）。
- `@supports not (backdrop-filter: blur(1px))` → 降级为实心 surface + hairline。
- 谨慎使用 `will-change` / `contain`（滥用反而掉帧）。
- 文字层：玻璃上若背景漂移影响可读性，加局部 scrim 或提高 `--aios-text-*` 不透明度。

---

## 8. 实施顺序（**E → C → B → A**）

> **用户已裁定顺序**：E（视觉语言地基）→ C（Employee Card）→ B（Command Center）→ A（AI Employee Home）。D 延后 Phase 2。

| 步 | 内容 | 依赖 | 产出 |
|---|---|---|---|
| **E0** | 全局视觉语言 token 包（§7）+ reduced-motion 扩展 + 降级路径 | 无 | 只加 token，**不改任何组件外观** |
| **C1** | Employee Card / App Icon 组件规格（§5） | E0 | 被 A、B 共用的基础件（先建，A/B 复用） |
| **B1** | Inspector / Command Center 改造（§4） | C1 | 右栏分节 / 值展示 / 命令面板 / 系统入口 |
| **A1** | Presence 首页重做（§3） | C1 | 首页新构图（mascot 主角 + Dock） |
| **D(Phase2)** | Spatial Knowledge（§6，视觉层） | E0 | 深度/分区/流向 —— **延后 Phase 2**，本轮仅做空间化视觉预留 |
| **R** | V0.5 截图矩阵回归 + 验收 | 全部 | 见 §9 |

> E0 先行是硬要求：后三步若各自造玻璃参数，必然产生新的 token 漂移（这正是 P4-1/5 token 收敛要解决的问题）。
> C1 先于 A1/B1：Employee Card 是 A 与 B 的共用件，先建可避免两处重复造卡。

---

## 9. 验收标准

| # | 项 | 标准 |
|---|---|---|
| 1 | Showcase 回归 | 现有 **28 张矩阵 + 窄视口断言全绿**（hotfix 断言不得回退：`overlaps=[]` / `ctaSpill=[]` / errors=0 / 404=0 / data-theme 首帧 / motionOff=ok / CJK=0） |
| 2 | V0.5 新矩阵 | 新增首页 / Inspector / Employee Card 的 zh×en × light×dark（+reduced）截图，几何断言同上 |
| 3 | 玻璃层预算 | 同屏活跃 `backdrop-filter` 层 ≤3 |
| 4 | reduced-motion | 全场景 `motionOff=ok`，无位移/缩放/视差 |
| 5 | i18n | 新增 key zh/en **1:1**（现有 308 基线不可失衡） |
| 6 | 母版资产 | mascot 母版文件 **byte-identical**，未被重新生成/替换 |
| 7 | 依赖 | 未引入新依赖（除非 D1 明确批准） |
| 8 | 性能 | 主观无掉帧（截图无法断言；需 Electron 下人工确认，集显机型重点） |

---

## 10. 红线与约束

- ❌ **不复制参考源码** —— 仅采用参数区间与设计原则。
- ❌ **不重新生成 mascot**（母版资产 = 唯一视觉来源）。
- ❌ **不新增依赖** —— 未经 D1 批准。
- ❌ **不改数据层 / mock / demo sequencer / i18n 结构**。
- ❌ **不回退 P4-2 Hotfix 成果**（四角布局、重叠与溢出断言）。
- ❌ **不做 3D / WebGL / 真 Window Manager**（待决 D3 未批准前）。
- ✅ 允许：新增 CSS token、新增展示型组件、重构展示层布局。

---

## 11. 待决问题（需你裁定后才进入编码）

| ID | 问题 | 选项 | 建议 |
|---|---|---|---|
| **D1** | 动效实现：引入动效库 vs 纯 CSS？ | A. 纯 CSS（研究源 A/C 均如此，无新依赖） / B. 引入 Framer Motion（macos-react 路线，表现力更强） | **A**（契合"不新增依赖"纪律；Tahoe 观感纯 CSS 可达） |
| **D2** | Employee Registry（数据层）是否在 Phase 1 落地？ | A. Phase 1 仅视觉，注册表留 Phase 2 / B. Phase 1 一并落地（改数据层） | **A**（保持"不改数据层"红线；但按 Registry 形状**预留**结构） |
| **D3** | 是否引入真 Window Manager（可拖拽/最小化窗口）？ | A. 不引入，Inspector 仍停靠 / B. 引入，面板可浮动 | **A**（Phase 1 范围可控；研究源 A 警告"假窗口"反模式，故宁可不浮动） |
| **D4** | Employee Dock 位置？ | A. 首页底部居中浮动 / B. 全局常驻（跨页面） / C. 仅首页内嵌不做独立 dock | **A**（Phase 1 最小闭环；全局常驻留 Phase 2） |
| **D5** | 玻璃强度默认档？ | A. `regular` 40px/180%（Tahoe 观感） / B. `soft` 20px/160%（性能优先） | **A + 自动降级开关**（桌面端性能可接受，降级路径必做） |
| **D6** | Spatial Knowledge（D 段）是否进 Phase 1？ | A. 进（视觉层） / B. 留 Phase 2 | **★ 已裁决：B（延后 Phase 2）** —— A/B/C/E 已构成完整 V0.5，D 单独一轮更稳；本轮仅做空间化视觉预留（保留现有 GalaxyCanvas / lptrack 雏形） |
| **D7** | TopBar 是否改造为系统菜单栏（研究源 A：左品牌/中当前员工/右状态簇）？ | A. 一并改 / B. 保持现状 | **A**（成本低、对"去 Dashboard 化"贡献大） |

---

## 12. 与研究文档的对应关系

| 本方案章节 | 研究依据 |
|---|---|
| §2 范式地图 | §0 共同范式、§1.7 反模式 3（不用 Web 表面破坏 OS 隐喻） |
| §3 A 首页 | §1.5 Dock Tile 配方、§4.3 Motion 裁决、§5 映射表 |
| §4 B Inspector | §1.7 反模式 1（不把产品 chrome 塞系统栏）、§1.6 聚焦高光 |
| §5 C Employee Card | §1.5 `iconArt`、§1.2「每 app 一个 accent」、§4.2 accent 映射 |
| §6 D Spatial | §5 映射（Window Manager/工作区） |
| §7 E 视觉语言 | §1.2 token bag、§3.1–3.2 玻璃配方与 token 表、§3.5 纯 CSS、§4.1 参数取舍、§4.4 风险 |
| §0 总纲 / 全篇 | `UI_INSPIRATION_LOCK.md` §0 三根支柱（Apple 克制 + Spatial 空间 + Agent 前瞻）、§1 shadcn token 纪律、§6 Raycast 命令面板、§7 Linear calm density、§4/§5 tldraw/React Flow 空间范式 |
