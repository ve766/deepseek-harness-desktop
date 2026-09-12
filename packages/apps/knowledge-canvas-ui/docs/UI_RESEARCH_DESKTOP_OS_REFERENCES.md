# UI Research — Desktop OS 范式参考源

> **性质**：只读研究 + 设计迁移分析。**不复制任何代码**，只抽取系统级设计范式、参数区间与反模式。
> **目的**：为「AI Employee OS 视觉范式从 Web Dashboard 迁移到 Desktop OS」提供外部证据。
> **关联**：`AI_EMPLOYEE_OS_UI_DESIGN_REVIEW.md`（R1–R8 决议）、`AI_EMPLOYEE_OS_VISUAL_EVOLUTION.md`（方向基线）、`AI_EMPLOYEE_OS_VISUAL_EVOLUTION_PHASE1_PLAN.md`（本研究的产出方案）。

---

## 0. TL;DR — 三源的共同范式

三个项目彼此独立，却收敛到同一组结论：

| 共同结论 | 对 AI Employee OS 的含义 |
|---|---|
| **内容以「数据」注册，系统负责组装**（App Registry） | AI Employee 应是一份数据（id/name/accent/icon/角色/能力），一处注册 → 同时点亮 Dock、Command Center、Spotlight、任务派发 |
| **主题 = token bag，不是 CSS 覆写** | Glass/Blur/Depth/Motion 必须是**可被主题整体替换的数据**，而非散落的 CSS 硬编码 |
| **材质承担装饰，而非渐变/边框** | 当前 UI 用 border + 浅灰填充表达层级；应改为玻璃 + 光 + 阴影 |
| **Motion 短促、物理、不回弹** | 140–300ms，亚像素位移，禁止循环 idle 动画 |
| **纯 CSS 控制 `backdrop-filter`** | 工具类框架（Tailwind/JS-in-CSS）会与精确玻璃配方打架 |
| **Window Manager 是唯一焦点真相源** | 任何可浮动/可聚焦面板都必须登记，避免"假窗口" |

---

## 1. 参考源 A — `react-ui-os`（saschb2b/react-ui-os）

**定位**：React 实现的 OS 风格桌面组件库。一个 `<Desktop apps={apps} theme={macosTheme} />` 标签产出全部：墙纸、Dock、可拖拽可缩放窗口、红绿灯、焦点追踪、Spotlight、设置。

### 1.1 App Registry —— 核心思想（最高迁移价值）

> "Apps are data. One object reaches four surfaces."
> "This library inverts the contract: you register apps; the library composes the system."

```ts
const notes: App = {
  id: "notes",
  name: "Notes",
  accent: "#f59e0b",
  content: ({ focused }) => <NotesEditor focused={focused} />,
}
```

一个对象同时点亮 **Dock / 菜单栏 / Spotlight / 键盘快捷键** 四个面，零额外接线。新增一个 app 不需要"把它接到各处"。

**为什么这对 AI Employee OS 是决定性的**：当前我们每个员工（Nox / 布偶猫 / 黑猫 / 边牧）是散落在 mock 数据、i18n、`AGENT_MAP` 里的隐式概念。若升级为 **Employee Registry**，"新增一个员工"就自动出现在首页 Dock、Command Center 的 Presence、任务派发列表、Spotlight 搜索里 —— 这正是「AI Employee OS」这个名字该有的系统感。

### 1.2 Theme = Token Bag

主题是**纯数据**，分类固定：`palette` / `shape` / `motion` / `blur` / `wallpaper` / `chrome`。

- `shape`：**三档就够** —— `windowRadius`(大)、`dockTileRadius`(大但不同，squircle)、`small`(pill/chip/tooltip)。明确反对加第四档。
- `motion`：**五个值覆盖全系统** —— window open / window close / dock hover / genie minimize / easings。
- `blur`：**由库决定"在哪应用"，由主题决定"应用多少"**。设成 `none` 组件仍应正常工作。
- `chrome`：结构变体开关（`windowControls` / `dockPosition` / `dockStyle` / `launcher` / `menuBar` / `quickSettings`）。

**关键约束（值得抄的态度）**：
> "Don't make tokens conditional on theme id. If a component needs to behave differently per theme, the difference belongs in a token."
> "If a design choice in a component prevents any of these three [themes], the choice is wrong."

即：**先加 token，再变行为**；不要写 `if (theme === 'dark')` 这种分支。

### 1.3 视觉 North Star

- **Material does the work** — "Most decoration comes from frosted glass, light, and shadow. Not from gradients, borders, or illustrations baked into components."
- **Color signals identity, not mood** — 每个 app 拥有**一个 accent**，情绪由墙纸承担，语域由主题承担。
- **Native over novel** — 熟悉感 > 花哨。
- **Motion is short and physical** — 140–300ms，无弹跳弹簧，无循环 idle 动画；墙纸视差是唯一允许的"活着"的东西。

### 1.4 Motion 具体参数

| 动作 | 时长 | 曲线 | 位移/缩放 |
|---|---|---|---|
| Window open | ~180ms | ease-out | translateY 6px + scale 0.985→1 |
| Window close | 同上 | 反向同曲线 | 动画结束后卸载 |
| Genie minimize | ~280ms | `cubic-bezier(0.4,0,0.2,1)` | scale→0.08 并飞向 dock tile 中心（按 DOM rect 实时计算） |
| Dock hover | ~140ms | ease | translateY -3px + scale 1.06 |
| 墙纸视差 | 60Hz rAF | — | 约 20px 位移（可关） |

**硬约束**：`确保动画在 300ms 内结束且不循环`。

### 1.5 Dock Tile 配方

- Squircle 圆角
- 背景：`linear-gradient(accent → 同 accent 低 alpha)`，产生"垂直光泽"而不用伪元素
- 打开时 tile 下方**指示点**：聚焦亮 / 最小化或未聚焦暗
- Icon = 小型 Lucide 风格组件；另有 `iconArt`（主题插画）覆盖在 accent 渐变上 —— **这是 app 在 dock 里获得视觉身份的方式**

> 直接映射：AI Employee 的 **mascot 母版图** 就是 `iconArt` 的角色。

### 1.6 默认玻璃参数

菜单栏与 Dock：`blur(20px) saturate(160%)`。窗口材质：`palette.surface + blur.surface`，边框 1px，聚焦时阴影更深、失焦更浅；标题栏 32px，聚焦时顶边有 accent 高光线。菜单栏 28px。

### 1.7 明确反模式（Don'ts）

1. **不要把产品 chrome 塞进系统菜单栏** —— 菜单栏是系统级（左品牌 / 中当前 app 名 / 右状态簇）。
2. **不要把品牌烘进库** —— 品牌渐变、墙纸、字体属主题。
3. **不要用 Web 表面破坏 OS 隐喻** —— 页内 hero banner 是反模式；需要 hero 就放进 window 里。
4. **不要绕过 Window Manager** —— 「看起来像窗口但没有焦点模型的浮动面板」是反模式。
5. 不要要求消费者 import CSS 文件（库自注入 keyframes）。

---

## 2. 参考源 B — `macos-react`（ridvanonal/macos-react）

**定位**：浏览器内的 macOS 风格桌面 UI 实验。React + TypeScript + Tailwind + **Zustand** + **Framer Motion** + Vite。

### 2.1 结构

```
src/
├── apps/         # 模拟应用（每个 app 一个模块）
├── components/   # 可复用 UI（window / dock / menubar …）
├── store/        # Zustand 全局状态
└── utils/
```

- **窗口状态集中**：`store/` 用 Zustand 管理「窗口状态、活跃 app 等」。
- **扩展方式**："You can add new apps by extending the `/apps` folder."
- **能力**：可拖拽窗口 + dock、可启动 app、类文件 UI 元素。

### 2.2 迁移价值

| 观察 | 迁移判断 |
|---|---|
| app 以**目录/模块**为单位组织 | ✅ 与 Employee Registry 思路一致（数据 + 内容分离） |
| 窗口状态进 store 而非组件内部 | ✅ 我们已有 `canvasStore`；Phase 1 若引入浮层/检视器，焦点态同样应收归 store |
| Framer Motion 承担动画 | ⚠️ **待决**：需评估新增依赖。来源 A 与 C 都用**纯 CSS**达成同等观感；本项目历史上对"不新增依赖"有纪律 |
| Tailwind | ⚠️ 来源 C 明确反对（见 §3.5）；本项目用自有 token + 原生 CSS，保持一致更有利 |

**结论**：macos-react 主要贡献是**状态与目录组织范式**，而非视觉配方。视觉配方以来源 A / C 为准。

---

## 3. 参考源 C — StreamDeck DIY / macOS Tahoe Liquid Glass（Plattnericus/StreamDeck）

**定位**：浏览器内完整复刻 macOS Tahoe Liquid Glass 桌面（窗口、Dock、菜单栏、玻璃、弹簧动画），同时是一个可用的 Stream Deck 控制器。React 18 + Vite + 纯 CSS Modules + CSS 变量。

### 3.1 玻璃配方（核心可迁移资产）

```css
.window {
  background: rgba(255, 255, 255, 0.12);              /* 近乎无的白填充 */
  backdrop-filter: blur(40px) saturate(180%);         /* 模糊 + 提饱和 */
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border: 0.5px solid rgba(255, 255, 255, 0.25);      /* 细白边（关键：亚像素） */
  border-radius: 12px;
}
```

> "`backdrop-filter` is the key. It applies the blur to everything *behind* the element — so the glass surface feels real and reacts to whatever's underneath it."

**注意 `0.5px` 边框**：亚像素描边是苹果玻璃"有边但不抢戏"的关键，比 1px 实色边高级。

### 3.2 玻璃 Token 表（含暗色）

| Token | Light | Dark |
|---|---|---|
| `--glass-bg` | `rgba(255,255,255,0.12)` | `rgba(30,30,30,0.55)` |
| `--glass-blur` | `blur(40px) saturate(180%)` | 同（一般不变） |
| `--glass-border` | `rgba(255,255,255,0.25)` | `rgba(255,255,255,0.12)` |
| `--glass-shadow` | `0 8px 32px rgba(0,0,0,0.18)` | `0 8px 32px rgba(0,0,0,0.45)` |
| `--dock-bg` | `rgba(255,255,255,0.18)` | — |
| `--menubar-bg` | `rgba(255,255,255,0.72)` | `rgba(28,28,28,0.72)` |
| `--text-primary` | `rgba(0,0,0,0.85)` | `rgba(255,255,255,0.88)` |
| `--text-secondary` | `rgba(0,0,0,0.45)` | `rgba(255,255,255,0.42)` |

**观察**：暗色下玻璃 **更不透明**（0.12 → 0.55），阴影**更重**（0.18 → 0.45）。这与直觉相反但必要 —— 暗背景下过透的玻璃会"消失"。

### 3.3 窗口管理器状态形状

```js
{
  id: 'finder',
  title: 'Finder',
  position: { x: 120, y: 80 },   // 鼠标事件驱动拖拽
  size:     { w: 780, h: 520 },   // 可缩放
  zIndex: 3,                       // 谁在上层
  minimized: false,
  maximized: false,
}
```

拖拽用 `onMouseDown/Move/Up` 直接更新 state —— **无第三方库**。

### 3.4 Dock 放大与弹簧

```css
.dock-icon { transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.dock-icon:hover { transform: scale(1.6); }
/* 相邻图标用 :has() 获得递减弱化 */
```

`cubic-bezier(0.34,1.56,0.64,1)` 是"过冲回弹"曲线 —— 与来源 A 的"禁止弹跳"**冲突**。取舍见 §4.3。

### 3.5 为什么是纯 CSS（重要）

> "The macOS Tahoe Liquid Glass effects require very specific control over `backdrop-filter`, layered `rgba` values and `mix-blend-mode`. **Utility-class frameworks work against this** — they make it hard to express the precise, layered glass surfaces that macOS uses."

### 3.6 其它

- CSS Modules + CSS 变量，无 Tailwind、无 CSS-in-JS。
- 窗口：红绿灯按钮、minimize/maximize/close、z-index 堆叠、minimize-to-dock。
- 菜单栏：时钟、下拉、系统托盘。
- 弹簧动画用 **CSS spring 曲线**实现（非 JS 物理库）。

---

## 4. 交叉分析与取舍

### 4.1 两个"门派"的玻璃参数差异

| | react-ui-os | StreamDeck (Tahoe) |
|---|---|---|
| blur | `blur(20px) saturate(160%)` | `blur(40px) saturate(180%)` |
| glass fill | 主题给（`palette.surface`） | light `rgba(255,255,255,0.12)` / dark `rgba(30,30,30,0.55)` |
| border | 1px `palette.border` | `0.5px rgba(255,255,255,0.25)` |
| 定位 | 通用骨架、克制的"素颜" | 高保真模仿 Tahoe、更戏剧 |

**取舍**：AI Employee OS 是**产品**而非库，需要更强的第一眼观感 → 以 **Tahoe 档（40px/180%）** 为视觉目标，但保留 **20px/160% 作为性能降级档**（token 化，可切）。

### 4.2 关于"每个 app 一个 accent"

来源 A 强调 accent 驱动 dock tile 渐变 + 聚焦窗口顶边高光。
**映射到 AI Employee OS**：每个员工已有主色（田园犬 #F5A623 / 布偶猫 #A8C8EC / 黑猫 #1A1A1A / 边牧 #FFF+#1A1A1A）—— 天然契合。员工的 accent 应驱动：Dock tile 渐变、聚焦态高光、状态点、任务进行中的进度环。

### 4.3 Motion：回弹 vs 不回弹（冲突裁决）

- 来源 A：**禁止弹跳弹簧**，140–300ms，位移/缩放极克制。
- 来源 C：Dock 用 `cubic-bezier(0.34,1.56,0.64,1)`（明显过冲）。

**裁决**：
- **功能性运动**（面板开合、窗口、状态切换）→ 采用 A 档：克制、180–280ms、无过冲。
- **角色亲密感运动**（Dock/Employee 图标 hover、mascot 微动）→ 允许 C 档轻微过冲（scale ≤1.06，非 1.6），因为这是"角色人格"而非"系统行为"。
- **任何循环/闲置动画**：仅 mascot 呼吸/眨眼允许（角色资产特性），系统控件一律禁止。

### 4.4 风险与约束（必须写进方案）

| 风险 | 说明 | 缓解 |
|---|---|---|
| **`backdrop-filter` 性能** | 每层玻璃都是一次全屏合成；层数过多在 Electron/集显上掉帧 | 限定**同时存在的玻璃层数**（建议 ≤3 层活跃），静态层降级为半透明纯色；`will-change`/`contain` 谨慎使用 |
| **浏览器兼容** | 需硬件加速 | 提供 `@supports not (backdrop-filter: blur(1px))` 降级到实心 surface |
| **可访问性** | `prefers-reduced-motion` 下必须关闭视差/弹簧 | 沿用项目现有 reduced-motion 守卫；玻璃可保留（非运动）但取消位移与缩放 |
| **对比度** | 玻璃上文字可读性随背景漂移 | 文字层用足够不透明的局部 scrim，或强制 `--text-*` 最低对比 |
| **"Dashboard 残留"** | 只加玻璃不改结构 → 变成"好看的 Dashboard" | 结构必须先从 grid-dashboard 变为 Shell+Dock+Inspector，材质只是第二步 |

---

## 5. 对 AI Employee OS 的直接映射表

| 参考源概念 | AI Employee OS 对应物 | 现状 | Phase 1 目标 |
|---|---|---|---|
| App Registry | **Employee Registry**（员工即"应用"） | 隐式（mock/i18n 分散） | 单一数据注册，点亮多面 |
| Desktop / Wallpaper | **AI Employee Home（Presence 首页）** | Welcome Dashboard（卡片网格） | 以员工 Presence 为核心的空间首页 |
| Dock | **Employee Dock**（角色切换/启动） | 无（左 sidebar 静态导航） | 浮动 dock，mascot iconArt |
| Menu Bar | **TopBar（系统级）** | 44px 顶栏 + 品牌 | 系统级：左品牌 / 中当前员工 / 右状态簇 |
| Window Manager | **Floating Panel 管理器** | 无（grid 固定分栏） | 焦点/层级收归 store |
| Quick Settings / Control Center | **右侧 Command Center → Inspector** | `.insight` 侧栏（AI 洞察） | macOS Inspector 风格：分节、可折叠、上下文动作 |
| Spotlight | **全局命令/员工搜索** | 无 | Phase 2+（本轮仅预留） |
| App Icon + iconArt | **Employee Card（mascot 母版 + accent）** | 无统一卡 | 系统级 App Icon 规格 + Character AI 状态 |
| Theme token bag | **Glass/Depth/Blur/Motion token 包** | 散落旧 token（`--bg-layer-*`）+ 已有 `--glass-*` | 统一为 `aios.*` 语义 token 包 |

---

## 6. 本研究的边界（明确不做的）

- ❌ 不复制任何实现代码；所有配方以**参数区间与原则**形式记录。
- ❌ 不引入第三方库作为既定事实 —— Framer Motion / liquid-glass-* 等列为**待决项**，需用户确认后才可评估。
- ❌ 不改动现有架构；Employee Registry / Window Manager 是否落地、落地到什么程度，属 Phase 1 方案的**待决问题**。
- ❌ 不重新生成 mascot 图像 —— 母版资产仍是唯一视觉来源（既有规则）。
