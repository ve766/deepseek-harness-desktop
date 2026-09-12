# A3 · AI Employee OS Navigation Rail — Mini Plan

> **性质**：**仅设计方案，不编码。** 本文是 Phase 1 顺序中 **E → C → B → A(首页) → A3(Rail)** 的 A3 步 mini plan，供审查。
> **目标**：在已交付的 A（AI Employee Home，Presence 主场）与 B（AI Command Center，上下文控制）之上，补上**系统级 Navigation Rail** —— 它是"去哪里"的常驻窄条，与 Home（在场）/ Command Center（上下文控制）三者职责分离，构成 AI Employee OS 的 Shell 层骨架。
> **范围边界**：A3 **只产出组件 + 陈列验收面 + i18n 键 + capture 断言**；**不修改 Home 核心布局**、**不修改 CommandCenter 契约**、**不复用/不修改 SideNav**、**不接入真实路由/Shell 集成**。**Command Center 唤起入口仅预留（no-op）**。
> **前置**：A1/A2（Home + Status Narrative + Quick Actions，commit `d024e25`）已验收；B（Command Center，commit `afdb46a`）已交付；E0 token 体系与单玻璃层纪律已确立。
> **顺序纪律**：严格保持既有边界；A3 完成后**停验收节点**，**不自动进入下一阶段**。

---

## 0. 当前代码现状审计（A3 必须基于的事实）

| 项 | 现状 | 对 A3 的含义 |
|---|---|---|
| `src/components/Home.tsx` + `.css`（A1/A2） | `Home` 渲染 `<section className="home">`，合约 `HomeContext`；含 hero + narrative + quick actions + Dock（**唯一玻璃层**） | A3 **不修改** Home 内部；Rail 是**外层 Shell 容器**，在 showcase 中包住 Home 展示面，不改 Home 组件本身 |
| `src/components/CommandCenter.tsx` + `.css`（B） | 玻璃命令面，合约 `CommandCenterContext`，`variant: floating\|docked` | A3 **不修改**其合约；仅"预留"唤起入口（Rail 上独立 affordance，no-op） |
| `src/components/SideNav.tsx` + `MacWindowShell.tsx` | 现有**传统 Sidebar**：宽、带标签、含 brand + agents stack，用 `sidebar.*` 键，挂在真实 app shell（`App → MacWindowShell`） | A3 Rail **刻意区别于** SideNav：窄条 / icon-forward / 扁平非玻璃 / 系统级 7 项；**不复用** SideNav、不修改它；新键 `nav.*` 避免与 `sidebar.*` 冲突 |
| `src/P3Showcase.tsx` | 视觉演进陈列 harness（`p3DemoEntry` 挂载），用 `<section className="p3-region">` 陈列各组件（Home / CommandCenter 在此 showcase） | A3 **唯一验收落点**：新增「Navigation Rail」专区；**不侵入** Home/CommandCenter 内部 |
| `src/i18n/zh-CN.ts` / `en-US.ts` | 已有 `home.*`(7) / `cc.*`(11) / `sidebar.*`(5) / `settings.*` 等；`LanguageKey = keyof typeof zhCN` 强约束 | A3 仅补 `nav.*` 命名空间键（rail 标题 + 7 导航项 + CC 唤起 + marketplace.soon），**zh/en 严格 1:1**，不碰 `home.*`/`cc.*`/`sidebar.*`/`settings.*` |
| `src/styles/app.css`（E0）+ token 契约 | `--bg-layer-1..3`(不透明层) / `--label-*` / `--border-l1` / `--brand-primary` / `--aios-radius-*` / `--aios-motion-*`；玻璃仅 `--aios-glass-*`。**单玻璃层纪律**：仅 Dock（及 CommandCenter）为玻璃 | A3 Rail 用 `--bg-layer-1`(不透明、扁平) + `--border-l1` + `--label-*` + `--brand-primary`，**不引入** `--aios-glass-*`，保持单玻璃层预算 |
| `scripts/capture-showcase.cjs` | 含 `home` / `command-center` 等 surface（zh×en × light×dark+reduced + narrow 矩阵 + 几何断言） | A3 同法新增 `navigation-rail` surface + 断言（railItems / active / disabled / ccInvoke / glass / overflow） |
| `src/App.tsx` / `MacWindowShell.tsx` | 真实 app shell（`MacWindowShell` 含 `SideNav`，渲染 `CanvasRegion` / `WelcomeDashboard`） | A3 **不修改**；真实 app 集成（用 Rail 替换/并存 SideNav）属**未来 Shell 集成**，**不在 A3 范围** |

> ⚠️ **关键区分**：仓库内存在**两套导航语境**——(a) Knowledge Canvas 真实 shell 的 `SideNav`（宽、标签、agents）；(b) 本步设计的 AI Employee OS `NavigationRail`（窄、图标、系统级 7 项）。二者刻意并存，A3 只建设 (b)，不触碰 (a)。未来 Shell 统一归后续 Phase。

---

## 1. A3 核心定位：系统级 Navigation Rail（≠ Sidebar）

**一句话定义**：Navigation Rail 是 AI Employee OS 的**常驻系统级导航窄条**——它回答"**去哪里**"，与 Home（**在场主角**）、Command Center（**当前上下文控制**）构成三权分立的 Shell 关系：

| 层 | 职责（唯一） | 不做什么 |
|---|---|---|
| **Rail** | 去哪里（系统级目的地导航） | 不承载任务、不承载聊天、不承载 prompt、不做内容展示 |
| **Home** | AI Employee Presence 主场（员工在场 + 状态叙事 + 快捷动作） | 不 Dashboard 化、不扩展为任务管理器 |
| **Command Center** | 当前上下文控制（项目/员工/任务/动作/系统入口） | 不导航、不做 Sidebar |

**Rail 形态纪律**：
- **常驻窄条**：固定宽度（默认 72px），不随内容伸缩。
- **icon-forward**：以图标为主，label 仅作 aria-label / tooltip，不常驻文本（保持窄）。
- **非玻璃层**：扁平不透明表面，保持单玻璃层预算（仅 Dock / CommandCenter 为玻璃）。
- **系统级 7 项**：Home / Employees / Knowledge Space / Memory / Projects / Marketplace(置灰) / Settings。
- **Command Center 唤起入口**：独立 affordance（区别于 7 个导航项），本步仅预留（no-op）。

**明确避免（红线）**：
- ❌ 传统 Sidebar（宽栏 + 常驻标签 + 折叠树 / 页面列表 / agents stack）
- ❌ Notion 式导航树 / 文件管理器隐喻
- ❌ Dashboard 卡片墙 / 进度条 / 任务列表
- ❌ 聊天窗 / prompt 输入 / 对话历史
- ❌ 第二套视觉系统 / 新玻璃层

---

## 2. 目标信息层级 + Layout 草图

**Rail 内部优先级（从上到下，系统级目的地）**：

```
品牌标记 (可选, 小尺寸, 非导航)
    ↓
Home            ← 默认激活
Employees
Knowledge Space
Memory
Projects
Marketplace     ← 置灰 / aria-disabled / "soon" 徽标（未来）
Settings
    ↓ (hairline 分隔)
Command Center  ← 独立唤起入口 (reserved, no-op)，不与 7 项同级
```

**Layout 草图（竖向窄条，本步陈列用）**：

```
┌──┐  ← 品牌标记（可选，16px 圆点/字标）
│🏠│  Home            (active: --brand-primary 左侧指示条 + 图标高亮)
│🐾│  Employees
│◎ │  Knowledge Space
│💾│  Memory
│📁│  Projects
│🛒│  Marketplace     (置灰: --label-tertiary + 降透明度; aria-disabled)
│⚙ │  Settings
├──┤  ← hairline 分隔 (--border-l1)
│◈ │  Command Center  (预留唤起入口, 独立 affordance, onClick no-op)
└──┘
   ↑ 常驻窄条 ~72px · icon-forward · 扁平非玻璃(--bg-layer-1 + --border-l1 右侧分隔)
```

> 结构即论点：**Rail 只做"去哪里"的极简系统导航**，不展示内容、不承载上下文控制。这正是与 Sidebar / Dashboard 的根本区别，也是与 Home / Command Center 职责不混的保证。

---

## 3. 组件拆分（组合优于配置）

遵循既有组件共置纪律：**Navigation Rail = 扁平外壳 + 导航项列表 + 独立 CC 唤起项**，非巨型导航组件。

### 3.1 新组件（同一新文件 `NavigationRail.tsx` + 共置 `NavigationRail.css`）

| 组件 | 职责 | 数据来源 | 复用 |
|---|---|---|---|
| `NavigationRail` | 扁平窄条外壳：固定宽度 + 右侧 hairline + 图标导航项列表 + 独立 CC 唤起项；消费 `props`；管理激活态高亮 | 纯 props（mock） | 无 |
| `NavRailItem`（内部） | 单个导航项：图标按钮 + aria-label；`active` / `disabled` 视觉态；`onClick → onNavigate(route)` | `props` | 无 |
| `NavRailCCInvoke`（内部） | 底部独立 CC 唤起 affordance：与导航项视觉分隔；`onClick → onCommandCenter()`（A3 no-op） | `props` | 无 |

### 3.2 类型与 mock 配置（纯展示合约，**不进数据层**）

```ts
// 仅组件 props 合约，不写进 AgentProfile / mock / store
export type NavRoute =
  | 'home' | 'employees' | 'knowledge' | 'memory'
  | 'projects' | 'marketplace' | 'settings'

export interface NavigationRailProps {
  activeRoute: NavRoute
  /** A3: mock no-op（仅驱动高亮）；真实路由切换属未来 Shell 集成 */
  onNavigate?: (r: NavRoute) => void
  /** A3: 预留唤起入口，no-op；未来接 Command Center docked/floating 切换 */
  onCommandCenter?: () => void
}

// 导航项配置（组件内常量，不进全局 registry）
const NAV: { route: NavRoute; key: string; icon: string; disabled?: boolean }[] = [
  { route: 'home',        key: 'nav.home',        icon: '🏠' },
  { route: 'employees',   key: 'nav.employees',   icon: '🐾' },
  { route: 'knowledge',   key: 'nav.knowledge',   icon: '◎' },
  { route: 'memory',      key: 'nav.memory',      icon: '💾' },
  { route: 'projects',    key: 'nav.projects',    icon: '📁' },
  { route: 'marketplace', key: 'nav.marketplace', icon: '🛒', disabled: true }, // 未来
  { route: 'settings',    key: 'nav.settings',    icon: '⚙' },
]
```

> **关键约束**：`NavigationRailProps` 只作为组件 props（展示层 mock），**不修改 `AgentProfile` 类型、不修改 `mock/agents.ts`、不改 i18n 结构（仅补 `nav.*` 键）**。未来真实路由由 Shell 供给，组件无需改。

---

## 4. 与现有组件关系（职责不混）

| 关系 | 处理 | 红线 |
|---|---|---|
| `Home` | **不修改** Home 核心布局/组件；A3 仅在外层 showcase 容器包住 Home 展示面，不改 `<Home>` 内部 | ❌ 不碰 `Home.tsx` / `Home.css` |
| `CommandCenter` | **不修改**其合约；仅"预留"Rail 上的 CC 唤起入口（独立 affordance） | ❌ 不碰 `CommandCenter.tsx` / `.css` |
| `SideNav` | **不复用、不修改**；Rail 是新组件、新键 `nav.*`，与 `sidebar.*` 并存不冲突 | ❌ 不碰 `SideNav.tsx` / `MacWindowShell.tsx` |
| `App.tsx` / 真实 shell | **不修改**；真实 app 的 Rail 集成属未来 | ❌ 不碰 `App.tsx` |
| i18n | 仅补 `nav.*` 键（1:1），不碰 `home.*` / `cc.*` / `sidebar.*` / `settings.*` | ❌ 不破坏现有键基线 |
| 数据层 | mock-only；不接 Agent / Task / Memory runtime | ❌ 不新建 Registry / Manager |

```
   NavigationRail (A3, 新建)
        │  包住（仅 showcase 容器层）
        ▼
   Home (A, 不改)            CommandCenter (B, 不改)
   在场主角                    上下文控制
        │                          ▲
        └──── Rail 的 CC 唤起入口（预留, no-op）────┘
```
> 与 A/B 同构：**一处定义、未来点亮**。A3 先定义对"去哪里"的语言，后续 Shell 集成才不会退化成"又一个 Sidebar"。

---

## 5. 状态模型（active route mock）

A3 **不实现真实路由 / surface 挂载**，只 mock「激活态」以验证视觉与契约。

- **类型**：`NavRoute`（见 §3.2），7 个系统级目的地 + `marketplace` 为 `disabled`。
- **mock 状态**：在 `P3Showcase` 的 Rail 专区用 `useState<NavRoute>('home')` 驱动 `activeRoute` 高亮；`onNavigate={setRoute}` 仅更新高亮，**不挂载/切换任何 surface**。
- **默认激活**：`home`（与 A 的 Presence 主场一致）。
- **Marketplace**：`disabled: true` → 渲染为置灰 + `aria-disabled="true"` + "soon" 徽标/tooltip；点击 no-op。
- **CC 唤起**：`onCommandCenter` 在 A3 为 no-op（预留）；未来接 `CommandCenter` 的 `docked`/`floating` 切换。

> 结论：A3 的"状态"只是**视觉激活指示**；真实导航栈/路由表/深链属未来 Shell 集成（非 A3）。

---

## 6. i18n 规划（新增 `nav.*` 命名空间，zh/en 严格 1:1）

仅在两个 pack 各补以下键（不碰现有 `home.*` / `cc.*` / `sidebar.*` / `settings.*`）：

| Key | zh-CN | en-US |
|---|---|---|
| `nav.title` | AI Employee OS 导航 | AI Employee OS navigation |
| `nav.home` | 首页 | Home |
| `nav.employees` | 员工 | Employees |
| `nav.knowledge` | 知识空间 | Knowledge Space |
| `nav.memory` | 记忆 | Memory |
| `nav.projects` | 项目 | Projects |
| `nav.marketplace` | 市场 | Marketplace |
| `nav.marketplace.soon` | 即将推出 | Coming soon |
| `nav.settings` | 设置 | Settings |
| `nav.commandCenter` | 控制台 | Command Center |
| `nav.commandCenter.hint` | 唤起 AI 控制台 | Open AI Command Center |

- 解析：导航项 label 用 `t(nav.<route>)`；`aria-label` 同；Marketplace 置灰态附加 `t('nav.marketplace.soon')` 徽标；CC 唤起项用 `t('nav.commandCenter')` + `title={t('nav.commandCenter.hint')}`。
- 约束：`LanguageKey = keyof typeof zhCN` 强校验，缺键即编译错误；zh/en 必须 1:1。

---

## 7. Responsive 策略

Rail 是「常驻窄条 + icon-forward」，天然紧凑；响应式只在**极窄屏**切换排布：

| 断点 | 行为 |
|---|---|
| ≥ 760px | 左侧**竖向固定窄条**，宽 `--rail-w: 72px`；图标居中，label 仅 aria/tooltip |
| 560–759px | 维持竖向窄条（72px 在窄屏仍足够，内容区取剩余宽度） |
| < 560px | 转为**底部横向 tab 条**（full-width，图标横排），避免竖向 72px 挤压内容；Capture `home-narrow`(560) 已验证无溢出 |

- **showcase 容器内渲染**：A3 在 `P3Showcase` 中用相对定位容器包住 Rail（**非** `position: fixed` 钉视口），避免与其它陈列区重叠；真实 fixed 行为留待未来 Shell 集成。
- **降级 / reduced**：`prefers-reduced-motion` → 入场/变换过渡经 `--aios-motion-dur-*` token 自动折叠（组件 CSS 不写字面 ms）；capture 断言 `motionOff=ok`。

---

## 8. Token 使用表（全部来自 E0，零新增）

**允许使用的 E0 token（扁平非玻璃）**：

| 用途 | Token | 备注 |
|---|---|---|
| 轨道表面（扁平不透明） | `--bg-layer-1` | 不透明层，非玻璃 |
| 右侧分隔 hairline | `--border-l1` | 与内容区分隔 |
| 图标（未激活） | `--label-tertiary` | |
| 图标（激活 / 强调） | `--brand-primary` | 激活指示条 + 激活图标 |
| 文本 / tooltip | `--label-secondary` | |
| 激活指示条 | `--brand-primary` | 左侧 2–3px 竖条 |
| 命中区圆角 | `--aios-radius-md`(12) / `--aios-radius-full`(圆形按钮) | |
| 过渡 | `--aios-motion-dur-fast` / `--aios-motion-ease` | 受 E0 reduced 块自动折叠 |
| z 标度（未来集成） | `--aios-layer-*` | A3 showcase 容器内不依赖全局 z |

**明确禁止（违反即 fail）**：
- ❌ 使用 `--aios-glass-*` / `backdrop-filter`（保持单玻璃层预算，仅 Dock / CommandCenter 为玻璃）
- ❌ 新建任何 token（玻璃/blur/shadow/rail 专用）
- ❌ 组件 CSS 内裸 hex（颜色一律引用 token；裸色只出现在 token 定义块）
- ❌ 引入第二套视觉系统

**玻璃预算（E0 硬约束）**：同屏活跃 `backdrop-filter` 层 **≤3**。A3 Rail **新增 0 个**玻璃层；P3 陈列时整页玻璃层仍为 Dock(展示 Home 时) / CommandCenter(展示 CC 时) ≤ 各自独立 ≤1。`singleGlass` 断言保持 `ok`。

---

## 9. 文件产出（执行阶段，本轮仅文档）

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/components/NavigationRail.tsx` | **新建** | 导出 `NavigationRail` + 内部 `NavRailItem` / `NavRailCCInvoke`；纯展示，无业务逻辑 |
| `src/components/NavigationRail.css` | **新建**（共置） | 扁平窄条 + 导航项 + CC 唤起项样式；遵循共置约定 |
| `src/P3Showcase.tsx` | **编辑** | 新增 `<section className="p3-region">`：Navigation Rail 专区（含 mock `activeRoute` + 7 项 + 置灰 Marketplace + CC 唤起预留；覆盖 light/dark/reduced 主题切换） |
| `scripts/capture-showcase.cjs` | **编辑** | 新增 `navigation-rail` surface：载入 p3 陈列入口，对新区跨 zh×en × light×dark(+reduced) + narrow 截图（矩阵并入 §10 验收） |
| `src/i18n/zh-CN.ts` / `en-US.ts` | **编辑** | 补 `nav.*` 命名空间键（11 个，见 §6），**zh/en 严格 1:1** |
| （无） | — | 不碰 `Home.*` / `CommandCenter.*` / `SideNav.*` / `MacWindowShell.*` / `App.tsx` / `types.ts` / `AgentProfile`；**不碰 `app.css` / E0 token**；不重新生成 mascot；不引入新依赖 |

---

## 10. 验收标准（基于 Phase 1 验收基线，A3 子集）

| # | 项 | 标准 |
|---|---|---|
| 1 | 回归不回退 | 现有 **home / command-center 等 surface 全绿**（hotfix 断言：`overlaps=[]` / `ctaSpill=[]` / `errors=0` / `404=0` / `data-theme` 首帧 / `motionOff=ok` / `cjkLeak=false` / `singleGlass=ok`） |
| 2 | 新 navigation-rail 矩阵 | 新增 `navigation-rail` surface：zh×en × light×dark(+reduced) + narrow(560)，几何断言同上 |
| 3 | 导航项计数 | `railItems=7`；`railActive=1`（仅 home 默认激活）；`railMarketplaceDisabled=1` |
| 4 | CC 唤起入口预留 | `railCCInvoke=1`（独立 affordance 存在，`onClick` no-op） |
| 5 | 单玻璃层 | Rail 无 `backdrop-filter`；`singleGlass` 仍 `ok`（仅 Dock / CommandCenter 玻璃） |
| 6 | reduced-motion | `motionOff=ok`；无 scale/tilt/视差（过渡经 `--aios-motion-dur-*` 折叠） |
| 7 | dark 对齐 | dark 下表面切到 `--bg-layer-1` dark 覆盖（与 light 不同，且不透明） |
| 8 | 窄屏无溢出 | `home-narrow` + `rail-narrow` `overflow=[]` |
| 9 | i18n | 仅补 `nav.*` 键，且 zh/en **1:1**；不破坏现有键基线 |
| 10 | 红线 | 未改 Home / CommandCenter / SideNav / App / MacWindowShell / types / AgentProfile；未引入新依赖；未新建 token；未新增玻璃层 |
| 11 | 内容呈现 | 7 项全部渲染（含 greyed marketplace）；CC 唤起项渲染；active 高亮出现 |

---

## 11. Command Center 唤起入口预留

- **位置**：Rail 底部，与 7 个导航项以 hairline 分隔的**独立 affordance**（图标 + `nav.commandCenter` aria-label + `nav.commandCenter.hint` tooltip）。
- **合约**：`onCommandCenter?: () => void` —— A3 实现为 **no-op**（仅占位/视觉），不触发任何行为。
- **职责分离**：导航项 = "去哪里"（route 切换）；CC 唤起 = "当前上下文控制"（context action）。二者**不混入**同一组；CC 唤起不属于 `NavRoute` 枚举。
- **未来联动**：Shell 集成阶段，此处接 `CommandCenter` 的 `docked` / `floating` 切换（复用 B 已定义的 `variant`），组件层无需改。

---

## 12. 明确非目标（Non-Goals，违反即 fail）

- ❌ **不是传统 Sidebar**（宽栏 / 常驻标签 / 折叠树 / 页面列表 / agents stack）
- ❌ **不是 Dashboard**（卡片堆叠 / 进度条 / 任务列表）
- ❌ **不是文件管理器**（目录 / 路径 / 资源隐喻）
- ❌ **不是聊天窗 / prompt 输入 / 对话历史**
- ❌ **不修改 Home 核心布局**
- ❌ **不修改 CommandCenter 契约**
- ❌ **不复用 / 不修改 SideNav / MacWindowShell**
- ❌ **不实现真实路由 / surface 挂载 / 深链**（仅 mock 激活态）
- ❌ **不接入真实 app Shell**（不包 `App.tsx`；真实集成属未来）
- ❌ **不接真实 Agent / Task / Memory runtime**（全部 mock）
- ❌ 不修改 `AgentProfile` / `mock` / i18n 结构（仅补 `nav.*` 1:1）
- ❌ 不新建 Registry / Memory / Task Engine
- ❌ 不新建玻璃 / blur / shadow token；不引入第二套视觉系统
- ❌ 不重新生成 mascot；不引入 3D / WebGL；不引入新依赖
- ❌ **不实现 CC 唤起逻辑**（仅预留 no-op 入口）

---

## 13. 待裁定（A3 级小决策，建议值可 Override）

| ID | 问题 | 选项 | 建议 |
|---|---|---|---|
| **A3-D1** | Rail 在 showcase 的渲染方式 | A. 相对容器包住（非 fixed，避免重叠） / B. `position: fixed` 钉视口 | **A**（A3 仅陈列；fixed 留待真实 Shell 集成） |
| **A3-D2** | Rail 宽度 | A. 72px（icon-forward 紧凑） / B. 64px / C. 80px | **A**（72px，图标 24px + 留白，足够窄且可点） |
| **A3-D3** | 极窄屏行为（<560px） | A. 转底部横向 tab 条 / B. 维持竖向窄条 | **A**（避免挤压内容；capture 已覆盖 560） |
| **A3-D4** | CC 唤起入口位置 | A. Rail 底部独立 affordance（hairline 分隔） / B. 浮动按钮右下角 | **A**（与导航项职责分离，留在 Rail 内） |
| **A3-D5** | 激活态 mock | A. `useState<NavRoute>('home')` 仅驱动高亮 / B. 静态写死 home 激活 | **A**（验证交互契约，不挂载 surface） |
| **A3-D6** | Settings 导航项键 | A. 新增 `nav.settings`（nav 命名空间自洽） / B. 复用 `settings.title` | **A**（命名空间隔离，避免跨域耦合） |
| **A3-D7** | Marketplace 置灰表示 | A. `aria-disabled` + 降透明度 + "soon" 徽标/tooltip / B. 仅降透明度 | **A**（语义 + 视觉双置灰） |
| **A3-D8** | 图标集 | A. emoji（🏠🐾◎💾📁🛒⚙）+ CC(◈) / B. 纯 unicode 符号 | **A**（与 B 的 CommandCenter 用 emoji 一致；可后续统一换 morphicon） |

---

## 14. 与更大蓝图的衔接

- **A（首页 Presence，已交付）**：Rail 是 Home 的**外层导航壳**；Home 仍是 Presence 主场，Rail 不侵入其内部。
- **B（Command Center，已交付）**：Rail 的 CC 唤起入口是其**未来联动点**（docked/floating 切换），本步仅预留。
- **SideNav（Knowledge Canvas 真实 shell）**：属不同产品语境；A3 Rail 与其并存，未来 Shell 统一（用 Rail 包裹 OS 各 surface + 替换/并存 SideNav）归后续 Phase，**不在 A3**。
- **未来 Shell 集成**：用 Rail 包裹 OS 各 surface（Home / Employees / Knowledge Space / Memory / Projects / Settings）+ CC 唤起，承载真实路由 —— 属后续 Phase，本步只建设组件与契约。
- **Registry（未来）**：`NavigationRailProps.activeRoute` 是 `NavRoute`（一个联合类型）→ 未来路由表扩展只需改该类型与 `NAV` 配置，组件无需改（呼应「apps are data，一处注册多处点亮」）。

> 结论：A3 是「**系统级去哪里 + 扁平非玻璃 + 单玻璃层纪律**」的支点。先做对 Navigation Rail 的语言，后续 Shell 集成才不会退化成"又一个 Sidebar"或破坏 Home/Command Center 的职责边界。
